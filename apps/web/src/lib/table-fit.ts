import type { PaperTable, TableCell } from '@/types/paper';
import { stripMarkup } from './inline-markup';
import { occupancy, rowsOf } from './table-cell-lines';

/**
 * What TeX cannot work out by itself and a table drawn from HTML hides: a word does not break inside a column (it runs over the next
 * cell when the column is narrower than the word), and a cell merged down does not make its rows taller (its lines run out of the last
 * row). These helpers estimate the widths of words and the lines a cell needs, so that columns are given room for their longest word and
 * the last row under a merged cell is made tall enough. Estimates from average glyph widths (serif type), good to some ten percent.
 */

const TABCOLSEP = 6;
const REGULAR_EM = 0.5;
const BOLD_EM = 0.56;

const glyph = (fontPt: number, bold: boolean) => fontPt * (bold ? BOLD_EM : REGULAR_EM);

const paragraphsOf = (text: string | undefined): string[] => stripMarkup(text ?? '').split(/\r?\n/);

/** The width in points of the longest word of a text. */
export function longestWordWidth(text: string | undefined, fontPt: number, bold: boolean): number {
  let longest = 0;
  for (const p of paragraphsOf(text)) for (const w of p.split(/[\s]+/)) longest = Math.max(longest, w.length);
  return longest * glyph(fontPt, bold);
}

/** How many lines a text takes in a column whose text is `contentPt` wide (a word wider than the column takes its own line and runs over). */
export function linesNeeded(text: string | undefined, contentPt: number, fontPt: number, bold: boolean): number {
  const cw = glyph(fontPt, bold);
  const room = Math.max(cw, contentPt);
  let lines = 0;
  for (const p of paragraphsOf(text)) {
    let used = 0;
    let n = 1;
    for (const word of p.split(/\s+/).filter(Boolean)) {
      const w = word.length * cw;
      const need = used === 0 ? w : used + cw + w;
      if (need <= room || used === 0) used = need;
      else {
        n += 1;
        used = w;
      }
    }
    lines += n;
  }
  return Math.max(1, lines);
}

/**
 * The shares of the columns, widened where a column is narrower than its longest word: those columns get the width of their word (at
 * most `cap` of the room), the others share what is left in proportion to their own shares. When the words cannot all fit, the columns
 * share the room in proportion to their words. Integers, as the LaTeX writes them (`*42/626`).
 */
export function fitWeightsToWords(weights: number[], minContent: number[], tableWidth: number, cap = 0.4): number[] {
  const n = weights.length;
  const free = tableWidth - 2 * TABCOLSEP * n;
  if (n === 0 || free <= 0) return weights;
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const mins = minContent.map((m) => Math.min(m, free * cap));
  const want = weights.map((w) => (free * w) / total);
  if (want.every((c, i) => c >= mins[i])) return weights;
  const fixed = new Set<number>();
  let widths = want.slice();
  for (let round = 0; round <= n; round++) {
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (!fixed.has(i) && widths[i] < mins[i]) {
        fixed.add(i);
        changed = true;
      }
    }
    const taken = [...fixed].reduce((a, i) => a + mins[i], 0);
    const left = free - taken;
    const others = weights.reduce((a, w, i) => (fixed.has(i) ? a : a + w), 0);
    if (left <= 0 || others <= 0) {
      // not everything fits: in proportion to the words
      const sum = mins.reduce((a, b) => a + b, 0) || 1;
      widths = mins.map((m) => (free * m) / sum);
      break;
    }
    widths = weights.map((w, i) => (fixed.has(i) ? mins[i] : (left * w) / others));
    if (!changed) break;
  }
  const sum = widths.reduce((a, b) => a + b, 0) || 1;
  return widths.map((w) => Math.max(1, Math.round((w / sum) * 1000)));
}

/** The longest word of each column, in points: the head in bold, the body as it is set; merged-across cells say nothing about one column. */
export function wordMinimums(table: PaperTable, cols: number, fontPt: number): number[] {
  const { rows, head } = rowsOf(table);
  const mins = Array(cols).fill(0);
  rows.forEach((row, r) => {
    let col = 0;
    for (const cell of row) {
      const span = Math.max(1, cell.colSpan ?? 1);
      if (span === 1 && col < cols) mins[col] = Math.max(mins[col], longestWordWidth(cell.text, cell.fontSize ?? fontPt, r < head));
      col += span;
    }
  });
  return mins;
}

/**
 * The least height each row needs so that the cells merged down fit in the rows they span (index = row of the table, head first; a row the
 * estimate leaves alone has no entry), and how far the text of each merged cell is raised: LaTeX sets it in the last row of its cells, so
 * it is lifted by half the rows above it to stand in the middle of the span, as the paper view draws it (key "row:column" of the cell's
 * first row). `colWidths` are the widths of the columns in points (the padding included).
 */
export function rowSpanLayout(
  table: PaperTable,
  colWidths: number[],
  fontPt: number,
  stretch: number,
  userMin: (row: number) => number | undefined
): { minima: Map<number, number>; raise: Map<string, number> } {
  const { rows, head } = rowsOf(table);
  const cols = colWidths.length;
  const line = Math.round((fontPt + 2) * 2) / 2;
  const padV = (line * stretch - line) / 2;
  const grid = occupancy(rows, cols);
  const contentWidth = (col: number, span: number) => {
    let w = 0;
    for (let k = col; k < Math.min(cols, col + span); k++) w += colWidths[k];
    return w - 2 * TABCOLSEP;
  };
  const heightOf = (cell: TableCell, col: number, span: number, isHead: boolean): number => {
    const f = cell.fontSize ?? fontPt;
    const lh = Math.round((f + 2) * 2) / 2;
    return linesNeeded(cell.text, contentWidth(col, span), f, isHead) * lh + 2 * padV;
  };
  // what each row is on its own, from its cells that do not span rows
  const own: number[] = rows.map((_, r) => {
    let h = line * stretch;
    for (let c = 0; c < cols; c++) {
      const p = grid[r]?.[c];
      if (p && p.row === r && p.col === c && p.rowSpan === 1) h = Math.max(h, heightOf(p.cell, c, p.colSpan, r < head));
    }
    return Math.max(h, userMin(r) ?? 0);
  });
  const out = new Map<number, number>();
  rows.forEach((_, r) => {
    for (let c = 0; c < cols; c++) {
      const p = grid[r]?.[c];
      if (!p || p.row !== r || p.col !== c || p.rowSpan < 2) continue;
      const last = r + p.rowSpan - 1;
      const spanned = own.slice(r, last + 1).reduce((a, b) => a + b, 0);
      const need = heightOf(p.cell, c, p.colSpan, r < head) + 2;
      if (need > spanned) out.set(last, Math.max(out.get(last) ?? 0, own[last] + (need - spanned)));
    }
  });
  // the rows as they come out (an estimate, the least height included), and the lift of each merged cell
  const final = own.map((h, i) => out.get(i) ?? h);
  const raise = new Map<string, number>();
  rows.forEach((_, r) => {
    for (let c = 0; c < cols; c++) {
      const p = grid[r]?.[c];
      if (!p || p.row !== r || p.col !== c || p.rowSpan < 2) continue;
      const last = r + p.rowSpan - 1;
      raise.set(`${r}:${c}`, Math.round((final.slice(r, last).reduce((a, b) => a + b, 0) / 2) * 10) / 10);
    }
  });
  return { minima: out, raise };
}
