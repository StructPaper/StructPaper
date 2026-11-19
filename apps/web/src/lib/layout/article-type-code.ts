import { resolveProfile } from '@structpaper/journal-profiles';
import { journalKeyOf } from '@/lib/templates';

const norm = (s?: string | null): string => (s ?? '').trim().toLowerCase();

/**
 * The code of the journal's article type a paper's free-text article type names ("Bài báo nghiên cứu" ->
 * "research"), found among the types the journal accepts. undefined when it names none of them: the editor
 * lets an author type any name, so a paper may not belong to a type of the journal at all.
 */
export function articleTypeCodeFor(journalId?: string | null, label?: string | null): string | undefined {
  if (!journalId || !label) return undefined;
  let types: { id: string; label?: Record<string, string> }[] = [];
  try {
    types = resolveProfile(journalKeyOf(journalId)).articleTypes ?? [];
  } catch {
    return undefined;
  }
  const wanted = norm(label);
  return types.find((t) => t.id === wanted || norm(t.label?.vi) === wanted || norm(t.label?.en) === wanted)?.id;
}
