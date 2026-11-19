import { useMutation, useQuery } from '@tanstack/react-query';
import { applyProfileToPapers, resolveProfile, type ApplyProfileToPapersResult } from '@structpaper/api-client';
import type { JournalProfile } from '@structpaper/journal-profiles';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';

/**
 * The journal's rules as they were in one version (a version never changes, so it is fetched once and kept).
 * The base rules are the ones in force now, as the server resolves them.
 */
export function useJournalVersionProfile(journalKey: string, version: number | null | undefined) {
  const client = useOptionalQueryClient();
  return useQuery<JournalProfile>(
    {
      queryKey: ['journals', 'journal-version-profile', journalKey, version],
      queryFn: ({ signal }) =>
        resolveProfile({ journal: journalKey, pin: `journal:${version}` }, undefined, signal) as unknown as Promise<JournalProfile>,
      enabled: !!client && !!journalKey && !!version,
      staleTime: Infinity,
      gcTime: Infinity,
      retry: 1,
    },
    client ?? idleQueryClient,
  );
}

/** Moves every paper of a journal to the rules published now. Irreversible, so the caller's password goes with it. */
export function useApplyProfileToPapers(journalKey: string) {
  const client = useOptionalQueryClient() ?? idleQueryClient;
  return useMutation<ApplyProfileToPapersResult, Error, string>(
    { mutationFn: (password) => applyProfileToPapers(journalKey, { password }) },
    client,
  );
}
