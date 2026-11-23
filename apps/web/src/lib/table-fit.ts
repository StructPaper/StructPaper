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

/**
 * The width of a glyph of the table's serif type as a part of its size, by kind: capitals and digits are wide, lower-case letters (the
 * accents change nothing) narrow, punctuation narrower still. A little on the wide side, so that a column made for a word is never too
 * narrow for it.
 */
export const GLYPH_EM = { capital: 0.68, digit: 0.5, lower: 0.46, space: 0.25, punct: 0.32, boldExtra: 1.07 };

/**
 * The widths (thousandths of the size) of the letters of Times, the face the tables are set in (Times New Roman and its look-alikes have
 * the same ones): regular, then bold. An accented letter is as wide as the letter it is made on; what is not listed takes a width by kind.
 */
const TIMES_REGULAR = 'a444b500c444d500e444f333g500h500i278j278k500l278m778n500o500p500q500r333s389t278u500v500w722x500y500z444A722B667C667D722E611F556G722H722I333J389K722L611M889N722O722P556Q722R667S556T611U722V722W944X722Y722Z611 250.250,250:278;278-333/278(333)333%833+564=564±564–500—1000\'333"408[333]333&778';
const TIMES_BOLD = 'a500b556c444d556e444f333g500h556i278j333k556l278m833n556o500p556q556r444s389t333u556v500w722x500y500z444A722B667C722D722E667F611G778H778I389J500K778L667M944N722O778P611Q778R722S556T667U722V722W1000X722Y722Z667 250.250,250:333;333-333/278(333)333%1000+570=570±570–500—1000\'278"500[333]333&833';
const parseWidths = (src: string): Map<string, number> => {
  const m = new Map<string, number>();
  const re = /(.)(\d+)/gs;
  let hit: RegExpExecArray | null;
  while ((hit = re.exec(src))) m.set(hit[1], Number(hit[2]) / 1000);
  return m;
};
const WIDTHS_REGULAR = parseWidths(TIMES_REGULAR);
const WIDTHS_BOLD = parseWidths(TIMES_BOLD);

const isCapital = (ch: string) => ch !== ch.toLowerCase() && ch === ch.toUpperCase();

const glyphWidth = (ch: string, fontPt: number, bold: boolean): number => {
  const table = bold ? WIDTHS_BOLD : WIDTHS_REGULAR;
  // (đ and Đ have no decomposition: they are as wide as d and D; an accent is the letter underneath it)
  const base = ch === 'đ' ? 'd' : ch === 'Đ' ? 'D' : ch.normalize('NFD')[0];
  const known = table.get(base);
  if (known !== undefined) return fontPt * known;
  let em = GLYPH_EM.lower;
  if (/\s/.test(ch)) em = GLYPH_EM.space;
  else if (/[0-9]/.test(ch)) em = GLYPH_EM.digit;
  else if (isCapital(ch)) em = GLYPH_EM.capital;
  else if (/[.,;:!?()\[\]{}\/\\'"\-–—·|]/.test(ch)) em = GLYPH_EM.punct;
  else if (/[⺀-鿿가-힯＀-￯]/.test(ch)) em = 1;
  return fontPt * em * (bold ? GLYPH_EM.boldExtra : 1);
};

/** The width in points of a string (no line breaks in it). */
export function textWidth(text: string, fontPt: number, bold: boolean): number {
  let w = 0;
  for (const ch of text) w += glyphWidth(ch, fontPt, bold);
  return w;
}

const paragraphsOf = (text: string | undefined): string[] => stripMarkup(text ?? '').split(/\r?\n/);

/** The width in points of the longest word of a text. */
export function longestWordWidth(text: string | undefined, fontPt: number, bold: boolean): number {
  let longest = 0;
  for (const p of paragraphsOf(text)) for (const w of p.split(/\s+/)) longest = Math.max(longest, textWidth(w, fontPt, bold));
  return longest;
}

/** How many lines a text takes in a column whose text is `contentPt` wide (a word wider than the column takes its own line and runs over). */
export function linesNeeded(text: string | undefined, contentPt: number, fontPt: number, bold: boolean): number {
  const space = textWidth(' ', fontPt, bold);
  const room = Math.max(space, contentPt);
  let lines = 0;
  for (const p of paragraphsOf(text)) {
    let used = 0;
    let n = 1;
    for (const word of p.split(/\s+/).filter(Boolean)) {
      const w = textWidth(word, fontPt, bold);
      const need = used === 0 ? w : used + space + w;
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
  userMin: (row: number) => number | undefined,
  /** The line spacing of the paper (the body's \linespread, which the lines of the table share: 8 pt type stands on 10 pt x 1.13). */
  spread = 1.13
): { minima: Map<number, number>; raise: Map<string, number> } {
  const { rows, head } = rowsOf(table);
  const cols = colWidths.length;
  const line = (Math.round((fontPt + 2) * 2) / 2) * spread;
  const padV = (line * stretch - line) / 2;
  const grid = occupancy(rows, cols);
  const contentWidth = (col: number, span: number) => {
    let w = 0;
    for (let k = col; k < Math.min(cols, col + span); k++) w += colWidths[k];
    return w - 2 * TABCOLSEP;
  };
  const heightOf = (cell: TableCell, col: number, span: number, isHead: boolean): number => {
    const f = cell.fontSize ?? fontPt;
    const lh = (Math.round((f + 2) * 2) / 2) * spread;
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
      // every row of the span is given the height it was estimated at (a strut), so that it is that tall and no taller or shorter: the text of the
      // cell stands at the baseline of its last row, which is then in a known place, and the lift of the text (half the rows above it) is exact
      for (let k = r; k <= last; k++) out.set(k, Math.max(out.get(k) ?? 0, own[k]));
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
      // (multirow already lifts the text by half of the rows above it taken as ordinary rows of a line each: only what the rows above are taller than that is added)
      const above = final.slice(r, last).reduce((a, b) => a + b, 0);
      raise.set(`${r}:${c}`, Math.round(((above - (last - r) * line * stretch) / 2) * 10) / 10);
    }
  });
  return { minima: out, raise };
}
