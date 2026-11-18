import { useMemo } from 'react';
import { useGetManuscript, isMockModeEnabled, type ManuscriptAccess } from '@structpaper/api-client';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import type { Decision } from '@/lib/access';

/**
 * What the current user may do with ONE paper, named by business meaning.
 *
 * Capabilities (lib/access) answer "what can I do in general?"; this answers "what can I do with
 * THIS paper?". The API computes the answer per paper (owner, member role, general access, workflow
 * status) with the same rules it enforces, and sends it as `access`. The UI never compares roles
 * or statuses: screens, menus, the title bar and the editor all ask the object built here.
 *
 *   server paper   -> the flags from the API (default deny when they are missing)
 *   local paper    -> a draft that only exists on this machine: the user's own
 *   still loading  -> everything denied (default deny), `status` says why
 */

export type PaperAction = 'view' | 'edit' | 'share' | 'delete';

/** Where the answer comes from. */
export type PaperAccessSource =
  | { kind: 'local' }
  | { kind: 'server'; access?: ManuscriptAccess | null; loading?: boolean };

export interface PaperAccess {
  status: 'loading' | 'ready';
  canView: boolean;
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
  /** Can read but not edit: the paper opens as a plain, read-only view. */
  readOnly: boolean;
  can: (action: PaperAction) => boolean;
  /** Same as `can`, with the reason when denied (same vocabulary as lib/access). */
  explain: (action: PaperAction) => Decision;
}

/** Pure factory (no React): easy to unit test and to reuse in lists. */
export function createPaperAccess(source: PaperAccessSource): PaperAccess {
  const loading = source.kind === 'server' && Boolean(source.loading);
  const flags =
    source.kind === 'local'
      ? { canView: true, canEdit: true, canShare: false, canDelete: true } // nobody to share a local draft with
      : {
          canView: Boolean(source.access),
          canEdit: Boolean(source.access?.canEdit),
          canShare: Boolean(source.access?.canShare),
          canDelete: Boolean(source.access?.canDelete),
        };

  const allowed = (action: PaperAction): boolean => {
    if (loading) return false;
    switch (action) {
      case 'view':
        return flags.canView;
      case 'edit':
        return flags.canEdit;
      case 'share':
        return flags.canShare;
      case 'delete':
        return flags.canDelete;
    }
  };

  const explain = (action: PaperAction): Decision =>
    loading ? { allowed: false, reason: 'LOADING' } : allowed(action) ? { allowed: true } : { allowed: false, reason: 'NO_PERMISSION' };

  return {
    status: loading ? 'loading' : 'ready',
    canView: allowed('view'),
    canEdit: allowed('edit'),
    canShare: allowed('share'),
    canDelete: allowed('delete'),
    readOnly: !loading && flags.canView && !flags.canEdit,
    can: allowed,
    explain,
  };
}

/** Access for a paper shown in a list: server papers carry the API's answer, local ones are the user's own. */
export function paperAccessOfRecord(record: ManuscriptRecord): PaperAccess {
  const remote = (record as any)?.remoteData;
  return createPaperAccess(remote ? { kind: 'server', access: remote.access } : { kind: 'local' });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only papers that live on the server have an answer to ask for (and people to share with). */
export const isServerPaperId = (id?: string | null): id is string => !!id && UUID.test(id) && !isMockModeEnabled();

/**
 * Access to one paper by id (title bar, paper page). Asks the server once (shared by every caller
 * through the query cache). When the server can not be reached the local copy keeps working, as the
 * paper is then the user's own cached draft; the API still refuses writes it should not accept.
 */
export function usePaperAccess(paperId?: string | null): { access: PaperAccess; title?: string } {
  const onServer = isServerPaperId(paperId);
  const query = useGetManuscript(paperId ?? '', { query: { enabled: onServer, staleTime: 30_000, retry: false } });

  return useMemo(() => {
    if (!onServer) return { access: createPaperAccess({ kind: 'local' }) };
    if (query.isLoading) return { access: createPaperAccess({ kind: 'server', loading: true }) };
    if (query.isError && !query.data) return { access: createPaperAccess({ kind: 'local' }) }; // offline
    return { access: createPaperAccess({ kind: 'server', access: query.data?.access }), title: query.data?.title };
  }, [onServer, query.isLoading, query.isError, query.data]);
}
