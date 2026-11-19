import { useCallback, useMemo } from 'react';
import { useListJournals } from '@structpaper/api-client';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';
import {
  builtInJournals,
  findJournal,
  isLegacyJournal,
  NEUTRAL_JOURNAL_COLOR,
  toJournalInfo,
  type JournalInfo,
} from '../resolve';

const FIVE_MINUTES = 5 * 60 * 1000;


export interface UseJournalsResult {
  journals: JournalInfo[];
  /** First load in flight: screens show a shimmer. */
  isLoading: boolean;
  /** The server could not be reached: `journals` is then the built-in list. */
  isFallback: boolean;
  find: (ref?: string | null) => JournalInfo | undefined;
}

/**
 * The journal list from the server (name, code, colour, status), shared by every screen through the
 * query cache: calling it in each card costs one request. Journals rarely change, so it stays fresh for minutes.
 */
export function useJournals(): UseJournalsResult {
  const client = useOptionalQueryClient();
  const query = useListJournals({ query: { staleTime: FIVE_MINUTES, retry: 1, enabled: !!client } }, client ?? idleQueryClient);
  const isFallback = !client || (query.isError && !query.data);

  const journals = useMemo<JournalInfo[]>(() => {
    if (Array.isArray(query.data) && query.data.length > 0) {
      const current = query.data.filter((j) => !isLegacyJournal(j));
      return (current.length > 0 ? current : query.data).map(toJournalInfo);
    }
    return isFallback ? builtInJournals() : [];
  }, [query.data, isFallback]);

  const find = useCallback((ref?: string | null) => findJournal(journals, ref), [journals]);
  return { journals, isLoading: !!client && query.isLoading, isFallback, find };
}

export interface JournalBadge {
  color: string;
  /** "VNUHCM-HS" */
  code: string;
  name?: string;
  /** Nothing to show yet: the journal list is still loading and the paper carries no copy of its journal. */
  isLoading: boolean;
}

/**
 * Colour and code of the journal a paper belongs to. A journal the server joined onto the paper wins
 * (it is the freshest); otherwise the id is looked up in the journal list.
 */
export function useJournalBadge(journalId?: string, record?: ManuscriptRecord): JournalBadge {
  const { find, isLoading } = useJournals();
  const embedded = (record?.doc as any)?.journal || (record as any)?.remoteData?.journal;
  return useMemo(() => {
    const found = find(embedded?.slug || embedded?.code || journalId);
    const color: string | undefined = embedded?.color || found?.color;
    const code: string | undefined = embedded?.code || found?.code || (record?.doc?.meta as any)?.journalAbbv;
    return {
      color: color || NEUTRAL_JOURNAL_COLOR,
      code: code || 'VNUHCM',
      name: embedded?.name || found?.name,
      isLoading: isLoading && !color && !code,
    };
  }, [find, isLoading, embedded, journalId, record]);
}
