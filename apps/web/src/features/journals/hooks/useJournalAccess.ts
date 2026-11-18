import { useQuery } from '@tanstack/react-query';
import { getJournalAccess } from '@structpaper/api-client';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';
import { useAccess } from '@/lib/access/access';

export interface JournalAccess {
  canEdit: boolean;
  canCreate: boolean;
  isLoading: boolean;
}

/**
 * What the signed-in user may do with a journal. The API is the judge (a manager of one journal may edit
 * that journal only), so the screen asks it instead of guessing from global capabilities.
 *
 * While the answer is on its way, or if it cannot be had, the global `journal:manage` capability stands in. With no
 * query client at all (a screen rendered on its own, in tests) nothing is hidden: the API still refuses what is not allowed.
 */
export function useJournalAccess(journalKey: string, enabled = true): JournalAccess {
  const client = useOptionalQueryClient();
  const global = useAccess().can('journal:manage');
  const query = useQuery(
    {
      queryKey: ['journals', 'access', journalKey],
      queryFn: ({ signal }) => getJournalAccess(journalKey, undefined, signal),
      enabled: !!client && enabled && !!journalKey,
      staleTime: 60_000,
      retry: false,
    },
    client ?? idleQueryClient,
  );
  if (!client) return { canEdit: true, canCreate: true, isLoading: false };
  if (query.data) return { canEdit: query.data.canEdit, canCreate: query.data.canCreate, isLoading: false };
  return { canEdit: global, canCreate: global, isLoading: !!client && enabled && query.isLoading };
}
