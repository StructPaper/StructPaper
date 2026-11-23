import { describe, it, expect } from 'vitest';
import {
  applyBorders,
  deleteCols,
  deleteRows,
  expandRange,
  fromGrid,
  insertCols,
  insertRows,
  mergeRange,
  patchRange,
  setHeadRows,
  setText,
  toGrid,
  unmergeAt,
  colsOfGrid,
} from '@/lib/table-grid';
import type { PaperTable } from '@/types/paper';

const table = (): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'Bảng',
  headers: ['A', 'B', 'C'],
  rows: [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']],
  headerRows: [[{ text: 'A', isHeader: true }, { text: 'B', isHeader: true }, { text: 'C', isHeader: true }]],
  bodyRows: [
    [{ text: '1' }, { text: '2' }, { text: '3' }],
    [{ text: '4' }, { text: '5' }, { text: '6' }],
    [{ text: '7' }, { text: '8' }, { text: '9' }],
  ],
  fontSize: '8pt',
  colWeights: [1, 1, 1],
});

const texts = (g: ReturnType<typeof toGrid>) => g.cells.map((r) => r.map((c) => (c.covered ? '·' : c.text)));

describe('a table as a grid', () => {
  it('goes to a grid and back without changing a word', () => {
    const t = table();
    const back = fromGrid(toGrid(t), t);
    expect(back.headerRows?.map((r) => r.map((c) => c.text))).toEqual([['A', 'B', 'C']]);
    expect(back.bodyRows?.map((r) => r.map((c) => c.text))).toEqual([['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']]);
    expect(back.fontSize).toBe('8pt');
    expect(back.colWeights).toEqual([1, 1, 1]);
  });

  it('keeps merged cells as one cell with the places it covers pointing to it', () => {
    const t = table();
    t.bodyRows![0] = [{ text: '1', colSpan: 2 }, { text: '3' }];
    const g = toGrid(t);
    expect(g.cells[1][0]).toMatchObject({ text: '1', colSpan: 2 });
    expect(g.cells[1][1].covered).toEqual({ r: 1, c: 0 });
    expect(fromGrid(g, t).bodyRows![0]).toHaveLength(2);
  });

  it('writes the flat fields too, with the merged head joined by " / "', () => {
    const t = table();
    t.headerRows = [[{ text: 'Nhóm', colSpan: 2, isHeader: true }, { text: 'C', isHeader: true, rowSpan: 2 }], [{ text: 'a' }, { text: 'b' }]];
    const out = fromGrid(toGrid(t), t);
    expect(out.headers).toEqual(['Nhóm / a', 'Nhóm / b', 'C']);
    expect(out.rows[0]).toEqual(['1', '2', '3']);
  });
});

describe('editing the grid', () => {
  it('sets the text of a cell, and of a merged cell from any place it covers', () => {
    let g = toGrid(table());
    g = mergeRange(g, { r0: 1, c0: 0, r1: 1, c1: 1 });
    g = setText(g, 1, 1, 'gộp');
    expect(g.cells[1][0].text).toBe('gộp');
  });

  it('merges a range into one cell holding the texts, and splits it again', () => {
    let g = toGrid(table());
    g = mergeRange(g, { r0: 1, c0: 0, r1: 2, c1: 1 });
    expect(g.cells[1][0]).toMatchObject({ text: '1 2 4 5', colSpan: 2, rowSpan: 2 });
    expect(texts(g)[2]).toEqual(['·', '·', '6']);
    g = unmergeAt(g, { r0: 1, c0: 0, r1: 1, c1: 0 });
    expect(g.cells[1][0]).toMatchObject({ colSpan: 1, rowSpan: 1 });
    expect(g.cells[2][1].covered).toBeUndefined();
  });

  it('does not merge across the edge between the head and the body', () => {
    const g = toGrid(table());
    expect(mergeRange(g, { r0: 0, c0: 0, r1: 1, c1: 0 })).toBe(g);
  });

  it('a selection takes in whole merged cells', () => {
    let g = toGrid(table());
    g = mergeRange(g, { r0: 1, c0: 1, r1: 2, c1: 2 });
    expect(expandRange(g, { r0: 1, c0: 0, r1: 1, c1: 1 })).toEqual({ r0: 1, c0: 0, r1: 2, c1: 2 });
  });

  it('adds rows and columns where asked, and a merged cell that runs through the place grows', () => {
    let g = toGrid(table());
    g = mergeRange(g, { r0: 1, c0: 0, r1: 2, c1: 0 });
    g = insertRows(g, 2);
    expect(g.cells).toHaveLength(5);
    expect(g.cells[1][0].rowSpan).toBe(3);
    expect(texts(g)[2][0]).toBe('·');
    g = insertCols(g, 1);
    expect(colsOfGrid(g)).toBe(4);
    expect(g.cells[0][1].text).toBe('');
    expect(g.cells[0][2].text).toBe('B');
  });

  it('takes rows and columns out; a merged cell shrinks; the head and the table keep a row', () => {
    let g = toGrid(table());
    g = mergeRange(g, { r0: 1, c0: 0, r1: 3, c1: 0 });
    g = deleteRows(g, 2, 2);
    expect(g.cells).toHaveLength(3);
    expect(g.cells[1][0]).toMatchObject({ rowSpan: 2 });
    g = deleteCols(g, 1, 1);
    expect(colsOfGrid(g)).toBe(2);
    expect(deleteRows(toGrid(table()), 0, 0).cells).toHaveLength(4); // the only head row stays
    expect(deleteCols(toGrid(table()), 0, 2).cells[0]).toHaveLength(3); // the last columns stay
  });

  it('a row whose first row of a merged cell is deleted leaves the cell to the row under it', () => {
    let g = toGrid(table());
    g = mergeRange(g, { r0: 1, c0: 0, r1: 2, c1: 0 });
    g = deleteRows(g, 1, 1);
    expect(g.cells[1][0]).toMatchObject({ rowSpan: 1, text: '1 4' });
  });

  it('sets align, vertical align and fill on every cell of the range', () => {
    let g = toGrid(table());
    g = patchRange(g, { r0: 1, c0: 0, r1: 2, c1: 1 }, { align: 'center', valign: 'middle', fill: '#ffeeaa' });
    expect(g.cells[1][0]).toMatchObject({ align: 'center', valign: 'middle', fill: '#ffeeaa' });
    expect(g.cells[2][1]).toMatchObject({ align: 'center', fill: '#ffeeaa' });
    expect(g.cells[3][2].fill).toBeUndefined();
    g = patchRange(g, { r0: 1, c0: 0, r1: 1, c1: 0 }, { fill: undefined });
    expect(g.cells[1][0].fill).toBeUndefined();
  });

  it('sets the number of head rows, cutting a merged cell that crosses the new edge', () => {
    let g = toGrid(table());
    g = mergeRange(g, { r0: 1, c0: 0, r1: 2, c1: 0 });
    g = setHeadRows(g, 2);
    expect(g.head).toBe(2);
    expect(g.cells[1][0].rowSpan).toBe(1);
  });
});

describe('lines round the cells you choose', () => {
  it('draws the outline of the selection only', () => {
    const g = applyBorders(toGrid(table()), { r0: 1, c0: 0, r1: 2, c1: 1 }, 'outer');
    expect(g.cells[1][0].borders).toMatchObject({ top: 'line', left: 'line' });
    expect(g.cells[1][0].borders?.bottom).toBeUndefined();
    expect(g.cells[2][1].borders).toMatchObject({ bottom: 'line', right: 'line' });
    expect(g.cells[3][0].borders?.top).toBe('line'); // the line is one line: the cell under it says it too
    expect(g.cells[1][2].borders?.left).toBe('line');
  });

  it('draws only the line under the selection', () => {
    const g = applyBorders(toGrid(table()), { r0: 1, c0: 0, r1: 1, c1: 2 }, 'bottom');
    expect(g.cells[1].every((c) => c.borders?.bottom === 'line' && !c.borders?.top)).toBe(true);
  });

  it('takes the lines away ("none") or gives the table\'s style back ("reset")', () => {
    let g = applyBorders(toGrid(table()), { r0: 1, c0: 0, r1: 1, c1: 0 }, 'all');
    g = applyBorders(g, { r0: 1, c0: 0, r1: 1, c1: 0 }, 'none');
    expect(g.cells[1][0].borders).toEqual({ top: 'none', bottom: 'none', left: 'none', right: 'none' });
    g = applyBorders(g, { r0: 1, c0: 0, r1: 1, c1: 0 }, 'reset');
    expect(g.cells[1][0].borders).toBeUndefined();
  });

  it('draws the lines between the cells of the selection', () => {
    const g = applyBorders(toGrid(table()), { r0: 1, c0: 0, r1: 2, c1: 1 }, 'inner');
    expect(g.cells[1][0].borders).toMatchObject({ bottom: 'line', right: 'line' });
    expect(g.cells[1][0].borders?.top).toBeUndefined();
  });
});
