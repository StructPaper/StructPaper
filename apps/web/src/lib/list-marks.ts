/**
 * Lists. A list item is a paragraph that starts with its mark: a bullet ("• Chữ thích…"), a dash, a number ("1. …", "2) …") or a
 * letter ("a) …"). The mark is part of the text, so a list survives every editor, the Word import and the exports without a block of
 * its own; what makes it a list is how it is set: the mark hangs out to the left of the text, as the printed journal sets it.
 */
const MARK = /^(?:[•●▪◦‣]|[-–])\s+|^(?:\d{1,2}[.)]|[a-z]\))\s+/;

/** The mark a paragraph starts with, with the space after it ("• ", "2. "), or null when it is not a list item. */
export function listMarkOf(text: string | undefined | null): string | null {
  const m = MARK.exec((text ?? '').replace(/^<[^>]+>/, ''));
  return m ? m[0] : null;
}

/** The mark and the rest of a list item. */
export function splitListItem(text: string): { mark: string; rest: string } | null {
  const mark = listMarkOf(text);
  if (!mark) return null;
  const at = text.indexOf(mark);
  return { mark: mark.trim(), rest: text.slice(at + mark.length) };
}

/** Is it a bullet (not a number or a letter)? */
export const isBullet = (mark: string): boolean => /^[•●▪◦‣\-–]$/.test(mark.trim());
