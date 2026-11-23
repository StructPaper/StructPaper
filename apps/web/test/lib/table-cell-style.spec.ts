import { describe, it, expect } from 'vitest';
import { tableToLatex } from '@/lib/latex-table';
import { resolveTheme } from '@/lib/theme-config';
import { horizontalLine, verticalLines, occupancy, rowsOf } from '@/lib/table-cell-lines';
import { tableRulesOf } from '@/lib/table-style';
import type { PaperTable } from '@/types/paper';

const theme = resolveTheme(undefined);
const base = (extra: Partial<PaperTable> = {}): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'Bảng',
  headers: ['A', 'B', 'C'],
  rows: [['1', '2', '3'], ['4', '5', '6']],
  headerRows: [[{ text: 'A', isHeader: true }, { text: 'B', isHeader: true }, { text: 'C', isHeader: true }]],
  bodyRows: [
    [{ text: '1' }, { text: '2' }, { text: '3' }],
    [{ text: '4' }, { text: '5' }, { text: '6' }],
  ],
  columnSpan: '1-column',
  ...extra,
});
const tex = (t: PaperTable) => tableToLatex(t, { isOneColumn: false, theme });

describe('lines of single cells', () => {
  it('a table without cell lines is set as it was', () => {
    const out = tex(base());
    expect(out).not.toContain('\\cline');
    expect(out).not.toContain('\\multicolumn{1}');
  });

  it('a line under some cells only is a \\cline over those columns', () => {
    const t = base({
      bodyRows: [
        [{ text: '1', borders: { bottom: 'line' } }, { text: '2' }, { text: '3', borders: { bottom: 'line' } }],
        [{ text: '4' }, { text: '5' }, { text: '6' }],
      ],
    });
    const out = tex(t);
    expect(out).toContain('\\cline{1-1}\\cline{3-3}');
  });

  it('a line above a cell is the line under the cell over it', () => {
    const t = base({
      bodyRows: [
        [{ text: '1' }, { text: '2' }, { text: '3' }],
        [{ text: '4' }, { text: '5', borders: { top: 'line' } }, { text: '6' }],
      ],
    });
    expect(tex(t)).toContain('\\cline{2-2}');
  });

  it('"none" takes a line of the table\'s style away from that cell only', () => {
    const t = base({
      borderStyle: 'grid',
      bodyRows: [
        [{ text: '1' }, { text: '2', borders: { bottom: 'none' } }, { text: '3' }],
        [{ text: '4' }, { text: '5' }, { text: '6' }],
      ],
    });
    const out = tex(t);
    // the first row ends with lines under columns 1 and 3 only
    expect(out).toContain('\\cline{1-1}\\cline{3-3}');
  });

  it('a line on the left or right of a cell is drawn by its column spec', () => {
    const t = base({
      bodyRows: [
        [{ text: '1', borders: { right: 'line' } }, { text: '2' }, { text: '3' }],
        [{ text: '4' }, { text: '5' }, { text: '6' }],
      ],
    });
    const out = tex(t);
    expect(out).toMatch(/\\multicolumn\{1\}\{>\{\\raggedright\\arraybackslash\}p\{[^}]*\}\|\}/);
  });

  it('a cell can stand in the middle or at the bottom of its row', () => {
    const t = base({
      bodyRows: [
        [{ text: '1', valign: 'middle' }, { text: '2', valign: 'bottom' }, { text: '3' }],
        [{ text: '4' }, { text: '5' }, { text: '6' }],
      ],
    });
    const out = tex(t);
    expect(out).toContain('arraybackslash}m{');
    expect(out).toContain('arraybackslash}b{');
  });

  it('a head of one row with a filled cell is set from its cells', () => {
    const t = base({ headerRows: [[{ text: 'A', isHeader: true, fill: '#ff0000' }, { text: 'B', isHeader: true }, { text: 'C', isHeader: true }]] });
    expect(tex(t)).toContain('\\cellcolor[RGB]{255, 0, 0}');
  });
});

describe('the grid of lines', () => {
  const t = base({
    headerRows: [[{ text: 'AB', isHeader: true, colSpan: 2 }, { text: 'C', isHeader: true, rowSpan: 2 }], [{ text: 'a' }, { text: 'b' }]],
    bodyRows: [[{ text: '1' }, { text: '2' }, { text: '3' }]],
  });
  it('knows which cell stands where, a merged cell on every place it covers', () => {
    const { rows } = rowsOf(t);
    const g = occupancy(rows, 3);
    expect(g[0][0]).toBe(g[0][1]);
    expect(g[0][2]).toBe(g[1][2]);
    expect(g[1][0]?.cell.text).toBe('a');
  });
  it('draws the table\'s own lines when no cell has a say', () => {
    const rules = tableRulesOf(t);
    expect(horizontalLine(t, rules, 2, 3).explicit).toBe(false);
    // …except that no line is drawn across a cell merged down (column 3 of the head)
    const across = horizontalLine(t, { ...rules, hInner: true }, 1, 3);
    expect(across.explicit).toBe(true);
    expect(across.lines).toEqual([true, true, false]);
    expect(verticalLines(t, rules, 0, 3).explicit).toBe(false);
  });
});

describe('a table narrower than its room', () => {
  it('shares the width the author chose, and stands where the author put it', () => {
    const t = base({ widthPercent: 60, tableAlign: 'left', breakAcrossPages: 'always', sideColumn: 'text', columnSpan: '2-column' });
    const out = tex(t);
    expect(out).toContain('0.600\\linewidth');
    expect(out).toContain('\\begin{longtable}[l]');
    const short = tex(base({ widthPercent: 60, tableAlign: 'right' }));
    expect(short).toContain('\\raggedleft');
  });
  it('a table of the whole width is set as it always was', () => {
    expect(tex(base())).not.toMatch(/0\.\d+\linewidth/);
    expect(tex(base({ widthPercent: 100 }))).not.toMatch(/0\.\d+\linewidth/);
  });
});
