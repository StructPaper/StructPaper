import { useMemo } from 'react';
import { resolveProfile } from '@structpaper/journal-profiles';
import { journalKeyOf } from '@/lib/templates';
import { usePublishedProfiles } from './usePublishedProfiles';

export interface ArticleTypeOption {
  /** "research" */
  code: string;
  vi: string;
  en: string;
}

/**
 * The article types a paper of this journal can be. They are the journal's own (kept on the server and
 * registered from what it published), or the app's built-in list while nothing has been published.
 */
export function useJournalArticleTypeOptions(journalId?: string | null): ArticleTypeOption[] {
  const { data: published } = usePublishedProfiles();
  return useMemo(() => {
    if (!journalId) return [];
    try {
      const types = resolveProfile(journalKeyOf(journalId)).articleTypes ?? [];
      return types.map((t) => ({ code: t.id, vi: t.label?.vi ?? t.id, en: t.label?.en ?? t.label?.vi ?? t.id }));
    } catch {
      return [];
    }
    // the registry changes when the server's published profiles arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journalId, published]);
}
