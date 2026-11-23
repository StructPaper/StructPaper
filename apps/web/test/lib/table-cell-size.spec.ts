import { describe, it, expect } from 'vitest';
import { migrateV1toV2, adaptV2toV1 } from '@structpaper/doc-model';
import { tableToLatex } from '@/lib/latex-table';
import { resolveTheme } from '@/lib/theme-config';
import { createEmptyPaper, type CompletePaper, type PaperTable } from '@/types/paper';
import { fromGrid, patchRange, toGrid } from '@/lib/table-grid';

const table = (): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'B',
  headers: ['A', 'B'],
  rows: [['1', '2']],
  headerRows: [[{ text: 'A', isHeader: true }, { text: 'B', isHeader: true }]],
  bodyRows: [[{ text: '1', fontSize: 10 }, { text: '2' }]],
  columnSpan: '1-column',
});

describe('a cell with a size of its own', () => {
  it('is set in that size on a baseline that grows with it', () => {
    const tex = tableToLatex(table(), { isOneColumn: false, theme: resolveTheme(undefined) });
    expect(tex).toContain('{\\fontsize{10pt}{12pt}\\selectfont 1}');
    // the others stay as the table sets them
    expect(tex.match(/\\fontsize\{10pt\}/g)).toHaveLength(1);
  });

  it('is given to the cells of the range in the grid, and taken off again', () => {
    let g = patchRange(toGrid(table()), { r0: 1, c0: 0, r1: 1, c1: 1 }, { fontSize: 9 });
    expect(fromGrid(g, table()).bodyRows![0].map((c) => c.fontSize)).toEqual([9, 9]);
    g = patchRange(g, { r0: 1, c0: 0, r1: 1, c1: 1 }, { fontSize: undefined });
    expect(fromGrid(g, table()).bodyRows![0].map((c) => c.fontSize)).toEqual([undefined, undefined]);
  });

  it('comes back through saving and loading', () => {
    const p: CompletePaper = createEmptyPaper('VNUHCM-HS');
    p.sections = [{ id: 's', type: 'table', content: '', table: table() }];
    const out = adaptV2toV1(migrateV1toV2(p as never) as never) as unknown as CompletePaper;
    expect(out.sections[0].table!.bodyRows![0][0].fontSize).toBe(10);
  });
});
