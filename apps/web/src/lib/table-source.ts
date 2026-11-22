import { stripMarkup } from './inline-markup';

/**
 * The lines printed under a table ("Nguồn: Tác giả", "Chú thích: …"): how each is set, worked out in one place so that the PDF, the
 * overview page, the form and the Word export all agree. The author can choose bold, italic and alignment for the whole block;
 * what is not chosen is what the journal prints: a note ("Chú thích:") in italic, a source upright, both to the left.
 */
export type SourceAlign = 'left' | 'center' | 'right';

export interface TableSourceStyle {
  bold?: boolean;
  italic?: boolean;
  align?: SourceAlign;
}

export interface SourceLook {
  bold: boolean;
  italic: boolean;
  align: SourceAlign;
}

const NOTE_LINE = /^(chú thích|ghi chú|notes?)\s*:/i;

/** Is this line a note (printed in italic unless the author said otherwise)? */
export const isNoteLine = (line: string): boolean => NOTE_LINE.test(stripMarkup(line).trim());

/** The lines to print: one per line the author typed, empty lines left out. */
export function sourceLinesOf(source: string | undefined | null): string[] {
  return (source ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/** How one line is set: the author's choice for the block, else the journal's. */
export function sourceLook(style: TableSourceStyle | undefined, line: string): SourceLook {
  return { bold: style?.bold ?? false, italic: style?.italic ?? isNoteLine(line), align: style?.align ?? 'left' };
}

/** A style with only what was chosen (nothing chosen: undefined, so the table keeps no empty object). */
export function cleanSourceStyle(style: TableSourceStyle): TableSourceStyle | undefined {
  const out: TableSourceStyle = {};
  if (style.bold) out.bold = true; // not bold is what every line is without a choice
  if (style.italic !== undefined) out.italic = style.italic; // both ways mean something: a note can be set upright, a source in italic
  if (style.align && style.align !== 'left') out.align = style.align; // to the left is what every line is without a choice
  return Object.keys(out).length > 0 ? out : undefined;
}
