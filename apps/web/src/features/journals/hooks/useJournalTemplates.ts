import { useMemo } from 'react';
import { getDefaultVnuhcmJournals, type ManagedJournalProfile } from '@/lib/templates/journal-storage';
import { journalTemplatesFrom } from '../journal-templates';
import { useJournals } from './useJournals';

export interface UseJournalTemplatesResult {
  templates: ManagedJournalProfile[];
  isLoading: boolean;
}

/** Journal template cards (create-paper dialogs) with the name, code and colour the server holds. */
export function useJournalTemplates(): UseJournalTemplatesResult {
  const { journals, isLoading, isFallback } = useJournals();
  const templates = useMemo(
    () => (isFallback ? getDefaultVnuhcmJournals() : journalTemplatesFrom(journals.filter((j) => j.status !== 'archived'))),
    [journals, isFallback],
  );
  return { templates, isLoading };
}
