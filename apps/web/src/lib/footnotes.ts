/**
 * Footnotes live inside a paragraph's text as `[[fn: text]]`, right where they are cited: imported from Word, or typed by the
 * author. Every output reads them from there: LaTeX prints them at the foot of the page, JATS makes them inline <fn> elements,
 * Word and HTML show them in parentheses.
 */

export type FootnotePart = { kind: 'text'; text: string } | { kind: 'note'; text: string };

const MARKER = /\[\[fn:([\s\S]*?)\]\]/g;

export const hasFootnotes = (text: string): boolean => text.includes('[[fn:');

/** The paragraph cut into plain text and notes, in order. */
export function splitFootnotes(text: string): FootnotePart[] {
  const parts: FootnotePart[] = [];
  let last = 0;
  for (const m of text.matchAll(MARKER)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: 'text', text: text.slice(last, at) });
    const note = m[1].trim();
    if (note) parts.push({ kind: 'note', text: note });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}

/** The notes of a text, in order. */
export const footnotesOf = (text: string): string[] => splitFootnotes(text).filter((p) => p.kind === 'note').map((p) => p.text);

/** The text with each note in parentheses (for outputs that have no footnotes of their own). */
export function inlineFootnotes(text: string, label = 'Chú thích'): string {
  if (!hasFootnotes(text)) return text;
  return splitFootnotes(text)
    .map((p) => (p.kind === 'note' ? ` (${label}: ${p.text})` : p.text))
    .join('')
    .replace(/\s+([.,;:])/g, '$1');
}

/** The text without its notes. */
export const withoutFootnotes = (text: string): string => splitFootnotes(text).filter((p) => p.kind === 'text').map((p) => p.text).join('');
