import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { resolveProfile as resolveProfileApi, upgradeManuscriptProfile, type PublishedProfiles } from '@structpaper/api-client';
import type { ResolvedProfile } from '@structpaper/journal-profiles';
import type { CompletePaper } from '@/types/paper';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';
import { journalKeyOf } from '@/lib/templates';
import { layoutFromProfile, type LayoutProfile } from '@/lib/layout/profile-layout';
import {
  profileCacheKey,
  profileForPaper,
  profileRefOf,
  rememberPinnedProfile,
  type PaperProfileRef,
} from '@/lib/layout/paper-profile';
import { usePublishedProfiles } from './usePublishedProfiles';

type Pin = NonNullable<CompletePaper['profilePin']>;

/** "base:1,journal:2,type:3": how the API names a pin. */
export const formatPin = (pin: Pin): string =>
  [pin.base && `base:${pin.base}`, pin.journal && `journal:${pin.journal}`, pin.articleType && `type:${pin.articleType}`].filter(Boolean).join(',');

const hasPin = (pin?: Pin): pin is Pin => !!pin && !!(pin.base || pin.journal || pin.articleType);

/** The versions the server publishes now for a paper's journal and article type. */
export function latestPinOf(published: PublishedProfiles | undefined, ref: PaperProfileRef | undefined): Pin | undefined {
  if (!published || !ref || published.base.version === 0) return undefined;
  const key = journalKeyOf(ref.journal);
  const journal = published.journals[key];
  if (!journal) return undefined;
  const type = ref.articleType ? published.articleTypes?.[key]?.[ref.articleType] : undefined;
  return { base: published.base.version, journal: journal.version, ...(type ? { articleType: type.version } : {}) };
}

/** The paper's pin is behind: the journal published newer rules since the paper was written (or last upgraded). */
export function isPinBehind(pin: Pin | undefined, latest: Pin | undefined): boolean {
  if (!hasPin(pin) || !latest) return false;
  return (['base', 'journal', 'articleType'] as const).some((k) => (latest[k] ?? 0) > (pin[k] ?? 0));
}

export interface UsePaperProfileOptions {
  /** Called when the pinned rules turn out to lay the page out differently from the latest ones the editor used first. */
  onLayoutChange?: () => void;
}

/**
 * The profile a paper is laid out under. A pinned paper keeps the rules of the versions it was written with:
 * they are fetched once (a version never changes) and handed to the layout code. Also says whether newer rules exist.
 */
export function usePaperProfile(paper: CompletePaper | null | undefined, options: UsePaperProfileOptions = {}) {
  const client = useOptionalQueryClient();
  const ref = paper ? profileRefOf(paper) : undefined;
  const pinned = !!ref && hasPin(ref.pin);
  const key = ref ? profileCacheKey(ref) : '';

  const query = useQuery<ResolvedProfile>(
    {
      queryKey: ['journals', 'paper-profile', key],
      queryFn: ({ signal }) =>
        resolveProfileApi(
          { journal: journalKeyOf(ref!.journal), ...(ref!.articleType ? { type: ref!.articleType } : {}), pin: formatPin(ref!.pin!) },
          undefined,
          signal,
        ) as unknown as Promise<ResolvedProfile>,
      enabled: !!client && pinned,
      staleTime: Infinity,
      gcTime: Infinity,
      retry: 1,
    },
    client ?? idleQueryClient,
  );

  const { data: published } = usePublishedProfiles();
  const latest = useMemo(() => latestPinOf(published, ref), [published, ref?.journal, ref?.articleType]);

  // layout the code would have used for this paper before the pinned rules arrived
  const usedFirst = useRef<string | null>(null);
  if (paper && usedFirst.current === null) usedFirst.current = JSON.stringify(layoutFromProfile(profileForPaper(paper) as LayoutProfile | undefined));

  const { onLayoutChange } = options;
  useEffect(() => {
    if (!ref || !query.data) return;
    rememberPinnedProfile(ref, query.data);
    const now = JSON.stringify(layoutFromProfile(query.data as LayoutProfile));
    if (usedFirst.current !== null && usedFirst.current !== now) {
      usedFirst.current = now;
      onLayoutChange?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, key]);

  return {
    profile: query.data ?? (paper ? profileForPaper(paper) : undefined),
    isLoading: pinned && query.isLoading,
    latestPin: latest,
    /** Newer rules exist than the ones the paper is pinned to. */
    isOutdated: isPinBehind(ref?.pin, latest),
  };
}

/** Moves a paper to the rules published now (the author asks for it; a paper never moves on its own). */
export function useUpgradeProfile() {
  const client = useOptionalQueryClient() ?? idleQueryClient;
  return useMutation({ mutationFn: (manuscriptId: string) => upgradeManuscriptProfile(manuscriptId) }, client);
}
