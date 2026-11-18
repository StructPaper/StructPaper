import { useMutation, useQuery } from '@tanstack/react-query';
import { listProfileVersions, rollbackProfile, type ProfileVersion } from '@structpaper/api-client';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';
import { PUBLISHED_PROFILES_KEY } from './usePublishedProfiles';

export type ProfileScope = 'base' | 'journal' | 'article_type';

export const profileVersionsKey = (id: string, scope: ProfileScope = 'journal') => ['journals', 'profile-versions', scope, id] as const;

/** Every version of a scope's rules (a journal's, or the base), newest first (needs a signed-in user who may read journals). */
export function useProfileVersions(id: string | undefined, scope: ProfileScope = 'journal') {
  const client = useOptionalQueryClient();
  return useQuery<ProfileVersion[]>(
    {
      queryKey: profileVersionsKey(id ?? '', scope),
      queryFn: ({ signal }) => listProfileVersions(scope, id!, undefined, signal),
      enabled: !!client && !!id,
      staleTime: 30_000,
    },
    client ?? idleQueryClient,
  );
}

/** Publishes a copy of an earlier version as a new one: history is never rewritten. */
export function useRollbackProfile(id: string, scope: ProfileScope = 'journal') {
  const client = useOptionalQueryClient() ?? idleQueryClient;
  return useMutation(
    {
      mutationFn: (toVersion: number) => rollbackProfile(scope, id, { toVersion }),
      onSuccess: async () => {
        await Promise.all([
          client.invalidateQueries({ queryKey: profileVersionsKey(id, scope) }),
          client.invalidateQueries({ queryKey: PUBLISHED_PROFILES_KEY }),
        ]);
      },
    },
    client,
  );
}
