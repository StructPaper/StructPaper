import { findJournalTemplate, listJournalTemplates } from './templates';

/** Lower case, no diacritics, "&" and "và" read as "and", everything else a single space. */
const fold = (s: string): string =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/&|\bva\b/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** STD and STDJ are the same journal (two ids kept for old papers). */
const canonical = (id: string) => (id === 'VNUHCM-STDJ' ? 'VNUHCM-STD' : id);

/**
 * Which VNUHCM journal does this text say it is? Only EXPLICIT identifiers count:
 * the journal's DOI prefix, its ISSN, its printed English name or abbreviation, its header line.
 * A subject word ("kinh tế", "kỹ thuật") says nothing about the journal, so it never decides.
 *
 * Returns the template id (e.g. "VNUHCM-HS"), or null when nothing is stated or the text points at
 * more than one journal (it never guesses).
 */
export function identifyJournal(text: string, fileName?: string): string | null {
  const raw = `${text || ''}\n${fileName || ''}`.toLowerCase();
  const folded = ` ${fold(`${text || ''} ${fileName || ''}`)} `;
  const found = new Set<string>();

  // DOI prefix of the journals: 10.32508/vnuhcmj-hs ..., and the older 10.32508/stdj...
  for (const m of raw.matchAll(/10\.32508\/(vnuhcmj-([a-z]+)|stdj)/g)) {
    const id = m[2] ? `VNUHCM-${m[2].toUpperCase()}` : 'VNUHCM-STD';
    if (findJournalTemplate(id)) found.add(canonical(id));
  }

  // DOI prefix a journal declares for itself (a journal an admin added has no fixed pattern)
  for (const t of listJournalTemplates()) {
    if (t.doiPrefix && raw.includes(t.doiPrefix.toLowerCase())) found.add(canonical(t.id));
  }

  // ISSN, which only counts when exactly one journal owns it
  const byIssn = new Map<string, Set<string>>();
  for (const t of listJournalTemplates()) {
    for (const issn of [t.issn, t.eIssn].filter(Boolean) as string[]) {
      if (!byIssn.has(issn)) byIssn.set(issn, new Set());
      byIssn.get(issn)!.add(canonical(t.id));
    }
  }
  for (const [issn, owners] of byIssn) {
    if (raw.includes(issn) && owners.size === 1) found.add([...owners][0]);
  }

  // Names the journal prints about itself
  for (const t of listJournalTemplates()) {
    const phrases = [t.officialNameEn, t.officialAbbvEn, t.headerText, t.name].filter(Boolean).map((p) => fold(p as string));
    if (phrases.some((p) => p.length > 8 && folded.includes(` ${p} `))) found.add(canonical(t.id));
  }

  return found.size === 1 ? [...found][0] : null;
}
