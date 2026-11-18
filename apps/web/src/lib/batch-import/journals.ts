import type { ManagedJournalProfile } from '@/lib/templates/journal-storage';
import { getDefaultVnuhcmJournals } from '@/lib/templates/journal-storage';
import type { BatchJournal } from './types';

/** The journal fields a paper gets from a template card (same rule as the single-file flow). */
export function toBatchJournal(managed: ManagedJournalProfile): BatchJournal {
  return {
    journalId: `VNUHCM-${managed.id.toUpperCase()}`,
    journalName: managed.profile.names?.vi || managed.profile.names?.en || managed.id,
    journalAbbv: managed.profile.names?.short || managed.id.toUpperCase(),
  };
}

/** Managed journal that a template id such as "VNUHCM-HS" (or the old "VNUHCM-STDJ") stands for. */
export function managedJournalFor(templateId?: string): ManagedJournalProfile | null {
  const id = (templateId || '').replace(/^VNUHCM-/i, '').toLowerCase();
  if (!id) return null;
  const alias = id === 'stdj' ? 'std' : id;
  return getDefaultVnuhcmJournals().find((j) => j.id.toLowerCase() === alias) ?? null;
}

/** No template chosen: the journal the file itself states, else the generic one. */
export function autoBatchJournal(parsedJournalId: string | undefined, fallback: BatchJournal): BatchJournal {
  const managed = managedJournalFor(parsedJournalId);
  return managed ? toBatchJournal(managed) : fallback;
}
