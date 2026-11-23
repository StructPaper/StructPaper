import { describe, it, expect } from 'vitest';
import { tableToLatex } from '@/lib/latex-table';
import { resolveTheme } from '@/lib/theme-config';
import type { PaperTable } from '@/types/paper';

const latex = (t: PaperTable) => tableToLatex(t, { isOneColumn: false, theme: resolveTheme(undefined) });

/** The strut that gives a row its least height may not stand before a \multicolumn: TeX stops with "Misplaced \omit". */
const strutBeforeOmit = (tex: string) => /\\rule\[[^\]]*\]\{0pt\}\{[^}]*\}\s*\\multicolumn/.test(tex);

const base = (): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'B',
  headers: ['A', 'B', 'C'],
  rows: [],
  headerRows: [[{ text: 'Nhóm', isHeader: true, colSpan: 2 }, { text: 'C', isHeader: true }]],
  bodyRows: [
    [{ text: 'gộp', colSpan: 2 }, { text: '1' }],
    [{ text: 'a', valign: 'middle' }, { text: 'b' }, { text: 'c' }],
    [{ text: 'x', rowSpan: 2 }, { text: 'y' }, { text: 'z' }],
    [{ text: 'q' }, { text: 'r' }],
  ],
  columnSpan: '1-column',
  rowHeights: [20, 20, 20, 20],
  headerHeight: 18,
});

describe('a row with a least height whose first cell is merged', () => {
  it('has the strut inside the first cell, never before a \\multicolumn', () => {
    const tex = latex(base());
    expect(strutBeforeOmit(tex)).toBe(false);
    // the merged first cell of the head and of the body carry it themselves
    expect(tex).toMatch(/\\multicolumn\{2\}\{.*\}\{\\rule\[/);
  });

  it('also when the row says where its text stands, or draws lines of its own', () => {
    const t = base();
    t.bodyRows![1][0] = { text: 'a', borders: { right: 'line' }, valign: 'bottom' };
    expect(strutBeforeOmit(latex(t))).toBe(false);
  });

  it('a table without row heights is set as it was', () => {
    const t = base();
    delete t.rowHeights;
    delete t.headerHeight;
    expect(latex(t)).not.toContain('\\rule[');
  });
});
