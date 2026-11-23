import { describe, it, expect } from 'vitest';
import { columnWidthsPt, cutIntoPieces, frameFor, sheetSize, type TableMetrics } from '@/lib/table-pages';
import { planTable } from '@/lib/table-plan';
import { resolveTheme } from '@/lib/theme-config';
import type { PaperTable } from '@/types/paper';

const theme = resolveTheme(undefined);
const sheet = sheetSize('custom');
const metrics = (rows: number[], extra: Partial<TableMetrics> = {}): TableMetrics => ({ caption: 14, source: 10, head: 14, rows, cont: 12, foot: 12, ...extra });
const tbl = (extra: Partial<PaperTable> = {}): PaperTable => ({
  id: 't', num: 1, caption: 'B', headers: ['A', 'B'], rows: [['1', '2']], columnSpan: '1-column', ...extra,
});

describe('the sheet and the room a table has on it', () => {
  it('is the journal\'s sheet: 216 × 279 mm, the text from 15.4 pc, two columns of 189 pt', () => {
    expect(sheet.w).toBeCloseTo(612.7, 0);
    const f = frameFor(planTable(tbl(), theme, { isOneColumn: false }), theme, sheet);
    expect(f.region.x).toBeCloseTo(184.8, 1);
    expect(f.table.w).toBeCloseTo(189.2, 0);
    expect(f.region.h).toBeGreaterThan(640);
  });

  it('a table over both columns has the width of the text, one over the side column the width of the page', () => {
    const two = frameFor(planTable(tbl({ columnSpan: '2-column' }), theme, { isOneColumn: false }), theme, sheet);
    expect(two.table.w).toBeCloseTo(390.7, 0);
    const wide = frameFor(planTable(tbl({ columnSpan: '2-column', sideColumn: 'full', breakAcrossPages: 'always' }), theme, { isOneColumn: false }), theme, sheet);
    expect(wide.table.w).toBeCloseTo(sheet.w - (theme.margins.left + theme.margins.right) * 28.3465, 0);
    expect(wide.region.x).toBeCloseTo(theme.margins.left * 28.3465, 0);
  });

  it('a turned table on a turned sheet: the sheet is on its side, the table across the long edge', () => {
    const t = tbl({ columnSpan: '2-column', isRotated: true });
    const f = frameFor(planTable(t, theme, { isOneColumn: false }), theme, sheet);
    expect(f.landscape).toBe(true);
    expect(f.sheet.w).toBeCloseTo(sheet.h, 1);
    expect(f.blockTurned).toBe(false);
    expect(f.table.w).toBeGreaterThan(550);
  });

  it('with the sheets kept upright the block is turned inside the upright sheet', () => {
    const t = tbl({ columnSpan: '2-column', isRotated: true });
    const upright = resolveTheme({ theme: { turnSheets: false } } as never);
    const f = frameFor(planTable(t, upright, { isOneColumn: false }), upright, sheet);
    expect(f.landscape).toBe(false);
    expect(f.blockTurned).toBe(true);
  });
});

describe('where a table is cut', () => {
  it('a table that fits stays in one piece with the caption and the source', () => {
    const p = cutIntoPieces(metrics([10, 10, 10]), { first: 200, next: 200 }, { repeatHead: true, columns: 1, mode: 'own-pages' });
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ start: 0, end: 3, first: true, last: true });
  });

  it('a long table goes on over pieces, each of whole rows, the foot under each that goes on', () => {
    const rows = Array(40).fill(10);
    const p = cutIntoPieces(metrics(rows), { first: 200, next: 200 }, { repeatHead: true, columns: 1, mode: 'own-pages' });
    expect(p.length).toBeGreaterThan(2);
    expect(p[0].first && !p[0].last).toBe(true);
    expect(p[p.length - 1].last).toBe(true);
    // the rows are the rows, once each, in order
    expect(p.reduce((n, x) => n + (x.end - x.start), 0)).toBe(40);
    p.slice(1).forEach((x, i) => expect(x.start).toBe(p[i].end));
    // a piece never holds more than the room: first piece is the caption, the head, the rows and the foot
    expect(14 + 14 + (p[0].end - p[0].start) * 10 + 12).toBeLessThanOrEqual(200 + 0.01);
  });

  it('the later pieces need room for the "continued" line and the head again, so they hold fewer rows than without', () => {
    const rows = Array(60).fill(10);
    const repeat = cutIntoPieces(metrics(rows), { first: 200, next: 200 }, { repeatHead: true, columns: 1, mode: 'own-pages' });
    const plain = cutIntoPieces(metrics(rows), { first: 200, next: 200 }, { repeatHead: false, columns: 1, mode: 'own-pages' });
    expect(repeat[1].end - repeat[1].start).toBeLessThan(plain[1].end - plain[1].start);
  });

  it('flows from column to column, two to a sheet', () => {
    const rows = Array(60).fill(10);
    const p = cutIntoPieces(metrics(rows), { first: 200, next: 200 }, { repeatHead: true, columns: 2, mode: 'column-flow' });
    expect(p.slice(0, 4).map((x) => [x.sheet, x.column])).toEqual([[0, 0], [0, 1], [1, 0], [1, 1]]);
  });

  it('puts a row taller than the room alone on a piece, and goes on', () => {
    const p = cutIntoPieces(metrics([500, 10, 10]), { first: 100, next: 100 }, { repeatHead: true, columns: 1, mode: 'own-pages' });
    expect(p[0].end - p[0].start).toBe(1);
    expect(p[p.length - 1].last).toBe(true);
  });

  it('a float is one piece', () => {
    const p = cutIntoPieces(metrics([10, 10]), { first: 5, next: 5 }, { repeatHead: true, columns: 1, mode: 'float' });
    expect(p).toHaveLength(1);
  });
});

describe('the columns as LaTeX sets them', () => {
  it('shares the width left after the padding, in the proportion of the weights', () => {
    const w = columnWidthsPt([10, 30], 200, 6);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(200, 5);
    expect(w[1] / w[0]).toBeGreaterThan(2.5);
  });
});
