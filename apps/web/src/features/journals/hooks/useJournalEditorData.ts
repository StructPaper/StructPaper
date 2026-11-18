import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { resolveProfile } from '@structpaper/api-client';
import type { JournalProfile } from '@structpaper/journal-profiles';
import { getManagedJournalById, type JournalStatus, type ManagedJournalProfile } from '@/lib/templates/journal-storage';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';
import { useJournals } from './useJournals';

export interface JournalEditorData {
  managed: ManagedJournalProfile | null;
  /** The journal's version on the server (its ETag); undefined when it came from the offline copy. */
  serverVersion?: number;
  isLoading: boolean;
  notFound: boolean;
  /** The server could not be reached: the editor shows the offline copy and cannot save. */
  isOffline: boolean;
}

export const resolvedProfileKey = (key: string) => ['journals', 'resolved-profile', key] as const;

const toManagedStatus = (status: string): JournalStatus =>
  status === 'draft' || status === 'archived' || status === 'published' ? status : 'published';

/**
 * What the journal editor opens: the journal as the server holds it (name, code, colour, status) with
 * its resolved layout rules. Offline it falls back to the copy kept on this machine.
 */
export function useJournalEditorData(id: string, enabled = true): JournalEditorData {
  const client = useOptionalQueryClient();
  const { isLoading: listLoading, isFallback, find } = useJournals();
  const journal = enabled ? find(id) : undefined;
  const key = journal?.key ?? id;

  const resolved = useQuery(
    {
      queryKey: resolvedProfileKey(key),
      queryFn: ({ signal }) => resolveProfile({ journal: key }, undefined, signal),
      enabled: !!client && enabled && !!journal && !isFallback,
      staleTime: 30_000,
      retry: 1,
    },
    client ?? idleQueryClient,
  );

  return useMemo<JournalEditorData>(() => {
    if (!enabled) return { managed: null, isLoading: false, notFound: false, isOffline: false };
    if (listLoading || (!!journal && !isFallback && resolved.isLoading)) {
      return { managed: null, isLoading: true, notFound: false, isOffline: false };
    }
    if (isFallback || (journal && resolved.isError)) {
      const local = getManagedJournalById(id);
      return { managed: local, isLoading: false, notFound: !local, isOffline: true };
    }
    if (!journal || !resolved.data) return { managed: null, isLoading: false, notFound: true, isOffline: false };

    const rules = resolved.data as unknown as JournalProfile;
    return {
      managed: {
        id: journal.key,
        status: toManagedStatus(journal.status),
        isCustom: !['std', 'hs', 'ssh', 'ebl', 'et', 'ees', 'arns'].includes(journal.key),
        profile: {
          ...rules,
          id: journal.key,
          names: { vi: journal.name, en: journal.nameEn || rules.names?.en || journal.name, short: journal.code },
          color: journal.color,
        },
      },
      serverVersion: journal.version || undefined,
      isLoading: false,
      notFound: false,
      isOffline: false,
    };
  }, [enabled, listLoading, journal, isFallback, resolved.isLoading, resolved.isError, resolved.data, id]);
}
