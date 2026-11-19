import { resolveProfile, type JournalProfile } from '@structpaper/journal-profiles';
import { getDefaultVnuhcmJournals, type JournalStatus, type ManagedJournalProfile } from '@/lib/templates/journal-storage';
import type { JournalInfo } from './resolve';

const STATUSES: JournalStatus[] = ['published', 'draft', 'validated', 'archived'];

/** A journal the server added that the code has no profile for yet borrows the standard layout. */
function profileFor(j: JournalInfo): JournalProfile {
  try {
    return resolveProfile(j.key);
  } catch {
    return { ...resolveProfile('std'), id: j.key };
  }
}

/**
 * Template cards from the server's journals. What the server owns (name, code, colour, status) wins;
 * the layout rules of a template still come from the code's profile of the same key.
 */
export function journalTemplatesFrom(server: readonly JournalInfo[]): ManagedJournalProfile[] {
  const builtIn = getDefaultVnuhcmJournals();
  return server.map((j) => {
    const base = builtIn.find((b) => b.id.toLowerCase() === j.key);
    const profile = base?.profile ?? profileFor(j);
    return {
      id: j.key,
      isCustom: !base,
      status: (STATUSES as string[]).includes(j.status) ? (j.status as JournalStatus) : 'published',
      updatedAt: base?.updatedAt,
      profile: {
        ...profile,
        color: j.color,
        names: { ...profile.names, vi: j.name, short: j.code },
      },
    };
  });
}
