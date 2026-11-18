import { useQuery } from '@tanstack/react-query';
import { getPublishedProfiles, type PublishedProfiles } from '@structpaper/api-client';
import { clearRemoteProfiles, registerRemoteProfiles, type ArticleTypeProfile, type JournalTierProfile } from '@structpaper/journal-profiles';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';

export const PUBLISHED_PROFILES_KEY = ['journals', 'published-profiles'] as const;
const FIVE_MINUTES = 5 * 60 * 1000;

/** The layout rules every journal publishes (one request, shared by every screen through the query cache). */
export function usePublishedProfiles() {
  const client = useOptionalQueryClient();
  return useQuery<PublishedProfiles>(
    {
      queryKey: PUBLISHED_PROFILES_KEY,
      queryFn: ({ signal }) => getPublishedProfiles(undefined, signal),
      staleTime: FIVE_MINUTES,
      retry: 1,
      enabled: !!client,
    },
    client ?? idleQueryClient,
  );
}

/** Hands what the server published to the profile resolver, so the parser, QC and LaTeX writer use it. */
export function registerPublished(published: PublishedProfiles | undefined): void {
  // version 0 = the server answered from its built-ins (no database): nothing of its own to register
  if (!published || published.base.version === 0) {
    clearRemoteProfiles();
    return;
  }
  registerRemoteProfiles({
    base: published.base.config,
    journals: Object.fromEntries(
      Object.entries(published.journals).map(([key, tier]) => [key, tier.config as unknown as JournalTierProfile]),
    ),
    articleTypes: Object.fromEntries(
      Object.entries(published.articleTypes ?? {}).map(([key, types]) => [
        key,
        Object.fromEntries(Object.entries(types).map(([code, tier]) => [code, tier.config as unknown as ArticleTypeProfile])),
      ]),
    ),
  });
}

