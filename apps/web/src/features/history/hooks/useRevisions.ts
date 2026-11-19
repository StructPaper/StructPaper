'use client';

import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import {
  listManuscriptRevisions,
  getManuscriptRevision,
  getManuscript,
  createManuscriptRevision,
  updateManuscriptRevision,
  deleteManuscriptRevision,
  restoreManuscriptRevision,
  duplicateManuscriptRevision,
  type RevisionSummary,
  type Revision,
  type RestoreRevisionResult,
  type Manuscript,
} from '@structpaper/api-client';
import { docFromStored } from '@structpaper/doc-diff';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';

export type RevisionFilter = 'all' | 'named' | 'auto' | 'pre-risk' | 'restore';

const PAGE = 50;

export const revisionsKey = (paperId: string, filter: RevisionFilter = 'all') => ['history', 'revisions', paperId, filter] as const;
export const revisionKey = (paperId: string, revisionId: string) => ['history', 'revision', paperId, revisionId] as const;
export const currentDocKey = (paperId: string) => ['history', 'current', paperId] as const;

/** The versions of a paper, newest first, a page at a time. */
export function useRevisions(paperId: string, filter: RevisionFilter) {
  const client = useOptionalQueryClient();
  return useInfiniteQuery(
    {
      queryKey: revisionsKey(paperId, filter),
      queryFn: ({ pageParam, signal }) =>
        listManuscriptRevisions(paperId, { limit: PAGE, ...(filter !== 'all' ? { kind: filter } : {}), ...(pageParam ? { before: pageParam } : {}) }, undefined, signal),
      initialPageParam: '' as string,
      getNextPageParam: (last) => last.nextBefore ?? undefined,
      enabled: !!client && !!paperId,
      staleTime: 10_000,
    },
    client ?? idleQueryClient,
  );
}

/** One version with the paper as it was. A version never changes, so it is kept. */
export function useRevision(paperId: string, revisionId: string | null) {
  const client = useOptionalQueryClient();
  return useQuery<Revision>(
    {
      queryKey: revisionKey(paperId, revisionId ?? ''),
      queryFn: ({ signal }) => getManuscriptRevision(paperId, revisionId!, undefined, signal),
      enabled: !!client && !!paperId && !!revisionId,
      staleTime: Infinity,
      gcTime: 10 * 60_000,
    },
    client ?? idleQueryClient,
  );
}

/** The paper as it is on the server now: the "current version" at the top of the list and what a version is compared with. */
export function useCurrentDoc(paperId: string) {
  const client = useOptionalQueryClient();
  return useQuery<{ manuscript: Manuscript; doc: Record<string, any> }>(
    {
      queryKey: currentDocKey(paperId),
      queryFn: async ({ signal }) => {
        const manuscript = await getManuscript(paperId, undefined, signal);
        // the app stores a paper flat or wrapped in `doc`: read either
        return { manuscript, doc: docFromStored((manuscript.metadata ?? {}) as Record<string, any>) as Record<string, any> };
      },
      enabled: !!client && !!paperId,
      staleTime: 0,
    },
    client ?? idleQueryClient,
  );
}

/** All the writes of the history page; each refreshes the list. */
export function useRevisionActions(paperId: string) {
  const client = useOptionalQueryClient() ?? idleQueryClient;
  const refresh = () => client.invalidateQueries({ queryKey: ['history'] });

  const save = useMutation<RevisionSummary, Error, { name: string; description?: string }>(
    {
      mutationFn: (v) => createManuscriptRevision(paperId, { name: v.name, ...(v.description ? { description: v.description } : {}), kind: 'named' }),
      onSuccess: refresh,
    },
    client,
  );
  const rename = useMutation<RevisionSummary, Error, { id: string; name?: string; description?: string | null }>(
    { mutationFn: ({ id, ...body }) => updateManuscriptRevision(paperId, id, body), onSuccess: refresh },
    client,
  );
  const remove = useMutation<unknown, Error, string>({ mutationFn: (id) => deleteManuscriptRevision(paperId, id), onSuccess: refresh }, client);
  const restore = useMutation<RestoreRevisionResult, Error, string>(
    {
      mutationFn: (id) => restoreManuscriptRevision(paperId, id),
      onSuccess: async () => {
        await refresh();
        // the editor shows what the server holds: make sure it asks again
        await client.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] });
        await client.invalidateQueries({ queryKey: ['manuscripts'] });
      },
    },
    client,
  );
  const duplicate = useMutation<Manuscript, Error, string>(
    {
      mutationFn: (id) => duplicateManuscriptRevision(paperId, id),
      onSuccess: async () => {
        await client.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] });
        await client.invalidateQueries({ queryKey: ['manuscripts'] });
      },
    },
    client,
  );
  return { save, rename, remove, restore, duplicate };
}
