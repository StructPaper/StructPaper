import { describe, it, expect } from 'vitest';
import { fitWeightsToWords, linesNeeded, longestWordWidth, rowSpanLayout, textWidth, wordMinimums } from '@/lib/table-fit';
import { columnWidthsPt } from '@/lib/table-pages';
import { tableToLatex } from '@/lib/latex-table';
import { resolveTheme } from '@/lib/theme-config';
import type { PaperTable } from '@/types/paper';

describe('what TeX does not do by itself', () => {
  it('measures the longest word and the lines a text needs in a column', () => {
    expect(longestWordWidth('một hai nghiên cứu', 8, false)).toBeCloseTo(textWidth('nghiên', 8, false), 5);
    // capitals and digits are wider than lower-case letters, bold wider than regular
    expect(textWidth('FEV1/FVC;', 8, false)).toBeGreaterThan(textWidth('nghiencuu', 8, false));
    expect(textWidth('abc', 8, true)).toBeGreaterThan(textWidth('abc', 8, false));
    expect(longestWordWidth('<b>nghiên</b>', 8, true)).toBeGreaterThan(longestWordWidth('nghiên', 8, false));
    expect(linesNeeded('một hai ba', 200, 8, false)).toBe(1);
    expect(linesNeeded('một hai ba bốn năm sáu bảy tám chín mười', 40, 8, false)).toBeGreaterThan(2);
    // a word wider than the column is a line of its own, and the text goes on
    expect(linesNeeded('siêu_dài_không_ngắt xin chào', 40, 8, false)).toBe(2);
    expect(linesNeeded('a\nb\nc', 100, 8, false)).toBe(3);
  });

  it('gives a column the room of its longest word and takes it from the others', () => {
    const weights = [100, 100, 100];
    // the middle column holds a word wider than the share it would get
    const out = fitWeightsToWords(weights, [0, 120, 0], 400);
    const widths = columnWidthsPt(out, 400);
    expect(widths[1] - 12).toBeGreaterThanOrEqual(119);
    // the others gave up what it needed
    expect(widths[0]).toBeLessThan(400 / 3);
    expect(widths.reduce((a, b) => a + b, 0)).toBeCloseTo(400, 3);
  });

  it('leaves the shares alone when every word fits, and shares by the words when they cannot all fit', () => {
    expect(fitWeightsToWords([50, 50], [10, 10], 300)).toEqual([50, 50]);
    const out = fitWeightsToWords([10, 10, 10], [100, 100, 100], 200);
    const w = columnWidthsPt(out, 200);
    expect(Math.max(...w) - Math.min(...w)).toBeLessThan(2);
  });

  it('reads the longest word of each column from the head (bold) and the body, leaving merged-across cells out', () => {
    const t: PaperTable = {
      id: 't', num: 1, caption: 'B', headers: ['A', 'B'], rows: [],
      headerRows: [[{ text: 'rất_là_dài_nhưng_gộp', colSpan: 2 }], [{ text: 'ngắn' }, { text: 'nghiên_cứu' }]],
      bodyRows: [[{ text: 'a' }, { text: 'bb' }]],
    };
    const mins = wordMinimums(t, 2, 8);
    expect(mins[0]).toBeCloseTo(textWidth('ngắn', 8, true), 5);
    expect(mins[1]).toBeCloseTo(textWidth('nghiên_cứu', 8, true), 5);
  });
});

describe('a cell merged down', () => {
  const table = (): PaperTable => ({
    id: 't', num: 1, caption: 'B', headers: ['A', 'B'], rows: [],
    headerRows: [
      [{ text: 'Tác giả (năm) thiết kế nghiên cứu của bài báo này', rowSpan: 2 }, { text: 'Nhóm', colSpan: 1 }],
      [{ text: 'x' }],
    ],
    bodyRows: [[{ text: 'a' }, { text: 'b' }]],
  });

  it('makes the last row under it as tall as its lines need, and lifts its text to the middle of the span', () => {
    const { minima, raise } = rowSpanLayout(table(), [40, 60], 8, 1.2, () => undefined);
    // five or so lines of 10 pt do not fit in two single-line rows: the last row grows
    expect(minima.get(1)).toBeGreaterThan(24);
    // multirow already lifts a text by half of ordinary rows (8 pt type on 11.3 pt lines, x 1.2: 13.56 pt each): only what the rows above are taller than that is added
    expect(raise.get('0:0')).toBeDefined();
    const taller = rowSpanLayout(table(), [40, 60], 8, 1.2, (r) => (r === 0 ? 40 : undefined));
    expect(taller.raise.get('0:0')).toBeCloseTo((40 - 10 * 1.13 * 1.2) / 2, 1);
  });

  it('is not made taller when the rows are tall enough already', () => {
    const { minima } = rowSpanLayout(table(), [40, 60], 8, 1.2, () => 100);
    // (the rows of the span are held at the height they have, so that the lift of the text is exact)
    expect(minima.get(1)).toBe(100);
    expect(minima.get(0)).toBe(100);
  });

  it('is set in a box as wide as its column measured by the table (not by the cell), lifted and centred', () => {
    const tex = tableToLatex(table(), { isOneColumn: false, theme: resolveTheme(undefined) });
    expect(tex).toMatch(/\\multirow\{-2\}\{\*\}\{\\raisebox\{[\d.]+pt\}\[0pt\]\[0pt\]\{\\parbox\[c\]\{\\dimexpr\(\\sptw-/);
    expect(tex).toContain('\\setlength{\\sptw}{\\linewidth}');
  });
});
