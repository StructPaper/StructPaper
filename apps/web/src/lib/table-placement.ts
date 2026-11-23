import { stripMarkup } from './inline-markup';
import type { PaperTable } from '@/types/paper';

/**
 * Where should a table go? Estimated from what it holds, the way a typesetter would size it up:
 *  - how wide it must be (the longest word of each column cannot be broken) and how wide it likes to be (the longest line of each column),
 *  - how tall it becomes once its columns have the width of a column, of the page, or of the page turned on its side.
 *
 * One column when it fits comfortably; across both columns when its words need more than a column; turned sideways when even the
 * page width is too narrow. The type size is never reduced: the printed tables are 8-9 pt, as measured on the sample PDFs.
 *
 * The measures are those of the journals' printed pages (612 pt wide, text from 185 pt, two columns of 189 pt).
 */
export interface PlacementGeometry {
  /** Width of one column, pt. */
  column: number;
  /** Width across both columns, pt. */
  page: number;
  /** Width a table turned on its side may have (the text height of the page), pt. */
  sidewaysWidth: number;
  /** Height a turned table may have, pt (the text width of the page less the caption). */
  sidewaysHeight: number;
  /** Text height of a page, pt. */
  pageHeight: number;
}

export const JOURNAL_GEOMETRY: PlacementGeometry = { column: 189, page: 390, sidewaysWidth: 640, sidewaysHeight: 350, pageHeight: 660 };

export interface TablePlacement {
  columnSpan: '1-column' | '2-column';
  rotated: boolean;
  /** Smaller type for a long, wide table that would otherwise not fit across the page. */
  fontSize?: '7pt';
  reason: string;
}

const CELL_PADDING = 12; // two \tabcolsep
const AVG_CHAR = 0.47; // average character width in em (Times, with Vietnamese letters)

const textOf = (c: unknown): string => stripMarkup(String((c as { text?: string })?.text ?? c ?? ''));

interface Measured {
  /** Narrowest each column can be (its longest word), pt. */
  min: number[];
  /** Width each column likes (its longest line, up to 45 characters), pt. */
  want: number[];
  /** Characters of each cell, row by row (the longest line), for the height estimate. */
  cells: number[][];
}

export function measureTable(table: Pick<PaperTable, 'headers' | 'rows' | 'bodyRows'>, fontPt: number): Measured {
  const cw = fontPt * AVG_CHAR;
  const headers = (table.headers && table.headers.length ? table.headers : []).map((h) => stripMarkup(String(h ?? '')).split(' / ').pop() ?? '');
  const body: string[][] = table.bodyRows && table.bodyRows.length ? table.bodyRows.map((r) => r.map(textOf)) : (table.rows || []).map((r) => r.map(textOf));
  const cols = Math.max(headers.length, ...body.map((r) => r.length), 1);
  const min: number[] = [];
  const want: number[] = [];
  const all = [headers, ...body];
  for (let c = 0; c < cols; c++) {
    let longestWord = 1;
    let longestLine = 1;
    for (const row of all) {
      const text = row[c] ?? '';
      for (const line of text.split(/\r?\n/)) {
        longestLine = Math.max(longestLine, line.length);
        for (const word of line.split(/[\s/]+/)) longestWord = Math.max(longestWord, word.length);
      }
    }
    min.push(Math.min(longestWord, 30) * cw + CELL_PADDING);
    want.push(Math.min(longestLine, 45) * cw + CELL_PADDING);
  }
  const cells = all.map((row) => Array.from({ length: cols }, (_, c) => Math.max(1, ...String(row[c] ?? '').split(/\r?\n/).map((l) => l.length))));
  return { min, want, cells };
}

/** Height of the table, pt, when set `width` wide: columns share it in proportion to what they want, never below their minimum. */
export function estimateHeight(m: Measured, width: number, fontPt: number): number {
  const cw = fontPt * AVG_CHAR;
  const lineH = fontPt * 1.25;
  const totalWant = m.want.reduce((a, b) => a + b, 0);
  const widths = m.want.map((w, i) => Math.max(m.min[i], (w / totalWant) * width));
  let height = 0;
  for (const row of m.cells) {
    let lines = 1;
    row.forEach((chars, c) => {
      lines = Math.max(lines, Math.ceil((chars * cw) / Math.max(10, widths[c] - CELL_PADDING)));
    });
    height += lines * lineH + 4;
  }
  return height;
}

export function choosePlacement(
  table: Pick<PaperTable, 'headers' | 'rows' | 'bodyRows'> & { fontSize?: string },
  geometry: PlacementGeometry = JOURNAL_GEOMETRY,
  hints: { landscapeInWord?: boolean } = {}
): TablePlacement {
  const fontPt = parseFloat(table.fontSize || '8') || 8;
  const m = measureTable(table, fontPt);
  const need = m.min.reduce((a, b) => a + b, 0);
  const want = m.want.reduce((a, b) => a + b, 0);

  // it likes about a column or less: one column (its rows stay short)
  if (want <= geometry.column * 1.1 && !hints.landscapeInWord) return { columnSpan: '1-column', rotated: false, reason: 'fits one column' };
  // a short table of up to four columns whose words fit a column and whose rows hold little text (printed rows of about a hundred
  // characters are the research summaries that run across the page): one column, the cells wrap
  const rowChars = m.cells.slice(1).map((r) => r.reduce((x, y) => x + y, 0)).sort((x, y) => x - y);
  const typical = rowChars.length ? rowChars[Math.floor(rowChars.length / 2)] : 0;
  if (need <= geometry.column && m.min.length <= 4 && typical < 110 && !hints.landscapeInWord) return { columnSpan: '1-column', rotated: false, reason: 'few columns, little text per row' };
  if (need <= geometry.page) return { columnSpan: '2-column', rotated: false, reason: 'needs the page width' };

  // wider than the page even with every word kept whole
  const sidewaysFits = need <= geometry.sidewaysWidth && estimateHeight(m, geometry.sidewaysWidth, fontPt) <= geometry.sidewaysHeight;
  if (sidewaysFits) return { columnSpan: '2-column', rotated: true, reason: 'turned on its side: one page' };

  // wider than the page: turned, however long it is (the printed journals turn such tables; none sets them in a smaller type)
  return { columnSpan: '2-column', rotated: true, reason: 'too wide for the page: turned' };
}
