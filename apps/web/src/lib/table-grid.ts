import type { CellBorderMode, CellBorders, PaperTable, TableCell } from '@/types/paper';
import { occupancy, rowsOf } from './table-cell-lines';

/**
 * A table as a grid of cells, the way a person edits it: a merged cell sits on every place it covers (the places it covers beyond its
 * own point to it), the first `head` rows are the head. Every edit is a pure function that returns the grid it makes; `fromGrid` writes
 * a grid back as the table the exporters read.
 */
export interface GridCell {
  text: string;
  colSpan: number;
  rowSpan: number;
  align?: TableCell['align'];
  valign?: TableCell['valign'];
  fill?: string;
  borders?: CellBorders;
  /** Set on the places a merged cell covers beyond its own: where that cell is. */
  covered?: { r: number; c: number };
}

export interface TableGrid {
  cells: GridCell[][];
  head: number;
}

export interface Range {
  r0: number;
  c0: number;
  r1: number;
  c1: number;
}

const blank = (): GridCell => ({ text: '', colSpan: 1, rowSpan: 1 });

export const colsOfGrid = (g: TableGrid): number => g.cells.reduce((m, r) => Math.max(m, r.length), 1);

export function toGrid(table: PaperTable): TableGrid {
  const { rows, head } = rowsOf(table);
  const cols = Math.max(1, table.headers?.length ?? 0, ...rows.map((r) => r.reduce((n, c) => n + Math.max(1, c.colSpan ?? 1), 0)));
  const occ = occupancy(rows, cols);
  const cells: GridCell[][] = rows.map((_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const p = occ[r][c];
      if (!p) return blank();
      if (p.row === r && p.col === c) {
        const { cell } = p;
        return {
          text: cell.text ?? '',
          colSpan: p.colSpan,
          rowSpan: p.rowSpan,
          ...(cell.align ? { align: cell.align } : {}),
          ...(cell.valign ? { valign: cell.valign } : {}),
          ...(cell.fill ? { fill: cell.fill } : {}),
          ...(cell.borders ? { borders: { ...cell.borders } } : {}),
        };
      }
      return { text: '', colSpan: 1, rowSpan: 1, covered: { r: p.row, c: p.col } };
    })
  );
  return { cells, head };
}

const cellOut = (c: GridCell, isHeader: boolean): TableCell => ({
  text: c.text,
  ...(c.colSpan > 1 ? { colSpan: c.colSpan } : {}),
  ...(c.rowSpan > 1 ? { rowSpan: c.rowSpan } : {}),
  ...(c.align ? { align: c.align } : {}),
  ...(c.valign ? { valign: c.valign } : {}),
  ...(c.fill ? { fill: c.fill } : {}),
  ...(c.borders && Object.keys(c.borders).length > 0 ? { borders: c.borders } : {}),
  ...(isHeader ? { isHeader: true } : {}),
});

/** The table the exporters read, from a grid: the other fields of `table` (size, lines, widths …) stay as they are. */
export function fromGrid(grid: TableGrid, table: PaperTable): PaperTable {
  const cols = colsOfGrid(grid);
  const head = Math.max(1, Math.min(grid.head, grid.cells.length));
  const rowCells = (r: number, isHeader: boolean): TableCell[] => grid.cells[r].filter((c) => !c.covered).map((c) => cellOut(c, isHeader));
  const headerRows = grid.cells.slice(0, head).map((_, r) => rowCells(r, true));
  const bodyRows = grid.cells.slice(head).map((_, i) => rowCells(head + i, false));
  // the flat fields older readers use: one title per column (the titles of a merged head joined by " / "), the text of each body place
  const textAt = (r: number, c: number): string => {
    const cell = grid.cells[r]?.[c];
    if (!cell) return '';
    if (!cell.covered) return cell.text;
    return grid.cells[cell.covered.r]?.[cell.covered.c]?.text ?? '';
  };
  const headers = Array.from({ length: cols }, (_, c) => {
    const seen: string[] = [];
    for (let r = 0; r < head; r++) {
      const t = textAt(r, c).trim();
      if (t && !seen.includes(t)) seen.push(t);
    }
    return seen.join(' / ');
  });
  const rows = grid.cells.slice(head).map((row, i) => row.map((c, k) => (c.covered ? '' : textAt(head + i, k))));
  return {
    ...table,
    headers,
    rows,
    headerRows,
    bodyRows,
    // a row's own height follows the row it was set for: the list keeps its length with the rows
    ...(table.rowHeights ? { rowHeights: Array.from({ length: bodyRows.length }, (_, i) => table.rowHeights?.[i] ?? null) } : {}),
    ...(table.colWeights && table.colWeights.length !== cols ? { colWeights: undefined } : {}),
  };
}

const clone = (g: TableGrid): TableGrid => ({
  head: g.head,
  cells: g.cells.map((r) => r.map((c) => ({ ...c, ...(c.borders ? { borders: { ...c.borders } } : {}), ...(c.covered ? { covered: { ...c.covered } } : {}) }))),
});

export const normalizeRange = (a: { r: number; c: number }, b: { r: number; c: number }): Range => ({
  r0: Math.min(a.r, b.r),
  c0: Math.min(a.c, b.c),
  r1: Math.max(a.r, b.r),
  c1: Math.max(a.c, b.c),
});

/** The selection grown until it holds whole merged cells (a half of a merged cell is not a thing a person can select). */
export function expandRange(grid: TableGrid, range: Range): Range {
  let { r0, c0, r1, c1 } = range;
  let changed = true;
  while (changed) {
    changed = false;
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = grid.cells[r]?.[c];
        if (!cell) continue;
        const o = cell.covered ?? { r, c };
        const origin = grid.cells[o.r]?.[o.c];
        if (!origin) continue;
        const nr0 = Math.min(r0, o.r);
        const nc0 = Math.min(c0, o.c);
        const nr1 = Math.max(r1, o.r + origin.rowSpan - 1);
        const nc1 = Math.max(c1, o.c + origin.colSpan - 1);
        if (nr0 !== r0 || nc0 !== c0 || nr1 !== r1 || nc1 !== c1) {
          r0 = nr0;
          c0 = nc0;
          r1 = nr1;
          c1 = nc1;
          changed = true;
        }
      }
    }
  }
  return { r0, c0, r1, c1 };
}

/** The cell standing at a place (the merged cell, for a place it covers). */
export function originAt(grid: TableGrid, r: number, c: number): { r: number; c: number } {
  return grid.cells[r]?.[c]?.covered ?? { r, c };
}

export function setText(grid: TableGrid, r: number, c: number, text: string): TableGrid {
  const g = clone(grid);
  const o = originAt(g, r, c);
  if (g.cells[o.r]?.[o.c]) g.cells[o.r][o.c].text = text;
  return g;
}

/** Sets the same look on every cell of the range (a cell merged over several places once). */
export function patchRange(grid: TableGrid, range: Range, patch: Partial<Pick<GridCell, 'align' | 'valign' | 'fill' | 'text'>>): TableGrid {
  const g = clone(grid);
  const r = expandRange(g, range);
  for (let y = r.r0; y <= r.r1; y++) {
    for (let x = r.c0; x <= r.c1; x++) {
      const cell = g.cells[y]?.[x];
      if (!cell || cell.covered) continue;
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete (cell as unknown as Record<string, unknown>)[k];
        else (cell as unknown as Record<string, unknown>)[k] = v;
      }
    }
  }
  return g;
}

export function mapText(grid: TableGrid, range: Range, fn: (text: string) => string): TableGrid {
  const g = clone(grid);
  const r = expandRange(g, range);
  for (let y = r.r0; y <= r.r1; y++) for (let x = r.c0; x <= r.c1; x++) {
    const cell = g.cells[y]?.[x];
    if (cell && !cell.covered) cell.text = fn(cell.text);
  }
  return g;
}

export function mergeRange(grid: TableGrid, range: Range): TableGrid {
  const g = clone(grid);
  const r = expandRange(g, range);
  if (r.r0 === r.r1 && r.c0 === r.c1) return g;
  // a merge does not cross the edge between the head and the body
  if (r.r0 < g.head && r.r1 >= g.head) return grid;
  const parts: string[] = [];
  for (let y = r.r0; y <= r.r1; y++) for (let x = r.c0; x <= r.c1; x++) {
    const cell = g.cells[y][x];
    if (!cell.covered && cell.text.trim()) parts.push(cell.text);
  }
  const first = g.cells[r.r0][r.c0];
  const keep = first.covered ? { ...blank() } : first;
  const merged: GridCell = { ...keep, text: parts.join(' '), colSpan: r.c1 - r.c0 + 1, rowSpan: r.r1 - r.r0 + 1, covered: undefined };
  delete merged.covered;
  g.cells[r.r0][r.c0] = merged;
  for (let y = r.r0; y <= r.r1; y++) for (let x = r.c0; x <= r.c1; x++) {
    if (y === r.r0 && x === r.c0) continue;
    g.cells[y][x] = { text: '', colSpan: 1, rowSpan: 1, covered: { r: r.r0, c: r.c0 } };
  }
  return g;
}

export function unmergeAt(grid: TableGrid, range: Range): TableGrid {
  const g = clone(grid);
  const r = expandRange(g, range);
  for (let y = r.r0; y <= r.r1; y++) for (let x = r.c0; x <= r.c1; x++) {
    const cell = g.cells[y]?.[x];
    if (!cell || cell.covered || (cell.colSpan === 1 && cell.rowSpan === 1)) continue;
    const { colSpan, rowSpan } = cell;
    cell.colSpan = 1;
    cell.rowSpan = 1;
    for (let dy = 0; dy < rowSpan; dy++) for (let dx = 0; dx < colSpan; dx++) {
      if (dy === 0 && dx === 0) continue;
      g.cells[y + dy][x + dx] = blank();
    }
  }
  return g;
}

interface Origin {
  r: number;
  c: number;
  cell: GridCell;
}

const originsOf = (g: TableGrid): Origin[] => {
  const out: Origin[] = [];
  g.cells.forEach((row, r) => row.forEach((cell, c) => {
    if (!cell.covered) out.push({ r, c, cell });
  }));
  return out;
};

/** A grid from the cells that start somewhere (and how many rows and columns it has): every place a cell covers points to it, the rest is blank. */
function build(origins: Origin[], rows: number, cols: number, head: number): TableGrid {
  const cells: GridCell[][] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => blank()));
  const taken: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  for (const { r, c, cell } of origins) {
    if (r < 0 || c < 0 || r >= rows || c >= cols || taken[r][c]) continue;
    const rs = Math.max(1, Math.min(cell.rowSpan, rows - r));
    const cs = Math.max(1, Math.min(cell.colSpan, cols - c));
    // (a cell does not run over a place another cell has taken)
    let h = rs;
    let w = cs;
    for (let dy = 0; dy < rs; dy++) for (let dx = 0; dx < cs; dx++) if (taken[r + dy][c + dx]) { h = Math.min(h, Math.max(1, dy || 1)); w = Math.min(w, Math.max(1, dx || 1)); }
    const placed: GridCell = { ...cell, rowSpan: h, colSpan: w };
    delete placed.covered;
    cells[r][c] = placed;
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) {
      taken[r + dy][c + dx] = true;
      if (dy === 0 && dx === 0) continue;
      cells[r + dy][c + dx] = { text: '', colSpan: 1, rowSpan: 1, covered: { r, c } };
    }
  }
  return { cells, head: Math.max(1, Math.min(head, rows)) };
}

/** Adds `count` blank rows before row `at` (at = number of rows: at the end). A merged cell that runs through the place grows by them. */
export function insertRows(grid: TableGrid, at: number, count = 1): TableGrid {
  const pos = Math.max(0, Math.min(at, grid.cells.length));
  const origins = originsOf(grid).map(({ r, c, cell }) => {
    if (r >= pos) return { r: r + count, c, cell };
    if (r + cell.rowSpan > pos) return { r, c, cell: { ...cell, rowSpan: cell.rowSpan + count } };
    return { r, c, cell };
  });
  return build(origins, grid.cells.length + count, colsOfGrid(grid), pos < grid.head ? grid.head + count : grid.head);
}

export function insertCols(grid: TableGrid, at: number, count = 1): TableGrid {
  const cols = colsOfGrid(grid);
  const pos = Math.max(0, Math.min(at, cols));
  const origins = originsOf(grid).map(({ r, c, cell }) => {
    if (c >= pos) return { r, c: c + count, cell };
    if (c + cell.colSpan > pos) return { r, c, cell: { ...cell, colSpan: cell.colSpan + count } };
    return { r, c, cell };
  });
  return build(origins, grid.cells.length, cols + count, grid.head);
}

/** Takes rows out. The head keeps at least one row and so does the table; a merged cell shrinks by the rows taken from it. */
export function deleteRows(grid: TableGrid, r0: number, r1: number): TableGrid {
  const total = grid.cells.length;
  const from = Math.max(0, r0);
  const to = Math.min(total - 1, r1);
  const count = to - from + 1;
  if (count <= 0 || count >= total) return grid;
  const headTaken = Math.max(0, Math.min(to, grid.head - 1) - from + 1);
  if (grid.head - headTaken < 1) return grid;
  const origins: Origin[] = [];
  for (const { r, c, cell } of originsOf(grid)) {
    const last = r + cell.rowSpan - 1;
    const overlap = Math.max(0, Math.min(last, to) - Math.max(r, from) + 1);
    const rowSpan = cell.rowSpan - overlap;
    if (rowSpan <= 0) continue;
    const newR = r > to ? r - count : r < from ? r : from;
    origins.push({ r: newR, c, cell: { ...cell, rowSpan } });
  }
  return build(origins, total - count, colsOfGrid(grid), grid.head - headTaken);
}

export function deleteCols(grid: TableGrid, c0: number, c1: number): TableGrid {
  const cols = colsOfGrid(grid);
  const from = Math.max(0, c0);
  const to = Math.min(cols - 1, c1);
  const count = to - from + 1;
  if (count <= 0 || count >= cols) return grid;
  const origins: Origin[] = [];
  for (const { r, c, cell } of originsOf(grid)) {
    const last = c + cell.colSpan - 1;
    const overlap = Math.max(0, Math.min(last, to) - Math.max(c, from) + 1);
    const colSpan = cell.colSpan - overlap;
    if (colSpan <= 0) continue;
    const newC = c > to ? c - count : c < from ? c : from;
    origins.push({ r, c: newC, cell: { ...cell, colSpan } });
  }
  return build(origins, grid.cells.length, cols - count, grid.head);
}

export function setHeadRows(grid: TableGrid, head: number): TableGrid {
  const g = clone(grid);
  const n = Math.max(1, Math.min(head, g.cells.length - (g.cells.length > 1 ? 0 : 0)));
  // a merged cell that crosses the new edge is cut at it
  let cut = grid;
  for (let c = 0; c < colsOfGrid(g); c++) {
    const cell = g.cells[n - 1]?.[c];
    const o = cell?.covered ?? { r: n - 1, c };
    const origin = g.cells[o.r]?.[o.c];
    if (origin && o.r + origin.rowSpan - 1 >= n) cut = unmergeAt(cut, { r0: o.r, c0: o.c, r1: o.r, c1: o.c });
  }
  const out = clone(cut);
  out.head = n;
  return out;
}

export type BorderMode = 'all' | 'outer' | 'inner' | 'inner-h' | 'inner-v' | 'top' | 'bottom' | 'left' | 'right' | 'none' | 'reset';

/** Draws (or takes away) lines round the cells of the range only. */
export function applyBorders(grid: TableGrid, range: Range, mode: BorderMode, value: CellBorderMode = 'line'): TableGrid {
  const g = clone(grid);
  const r = expandRange(g, range);
  const set = (y: number, x: number, side: keyof CellBorders, v: CellBorderMode | undefined) => {
    const o = originAt(g, y, x);
    const cell = g.cells[o.r]?.[o.c];
    if (!cell) return;
    // (only a side that is on the cell's own edge: a merged cell carries the lines of its outer sides)
    const lastRow = o.r + cell.rowSpan - 1;
    const lastCol = o.c + cell.colSpan - 1;
    if ((side === 'top' && y !== o.r) || (side === 'bottom' && y !== lastRow) || (side === 'left' && x !== o.c) || (side === 'right' && x !== lastCol)) return;
    const b = { ...(cell.borders ?? {}) };
    if (v === undefined) delete b[side];
    else b[side] = v;
    if (Object.keys(b).length > 0) cell.borders = b;
    else delete cell.borders;
  };
  const v: CellBorderMode | undefined = mode === 'reset' ? undefined : mode === 'none' ? 'none' : value;
  for (let y = r.r0; y <= r.r1; y++) {
    for (let x = r.c0; x <= r.c1; x++) {
      const top = y === r.r0;
      const bottom = y === r.r1;
      const left = x === r.c0;
      const right = x === r.c1;
      const sides: Array<keyof CellBorders> = [];
      if (mode === 'all' || mode === 'none' || mode === 'reset') sides.push('top', 'bottom', 'left', 'right');
      if (mode === 'outer') {
        if (top) sides.push('top');
        if (bottom) sides.push('bottom');
        if (left) sides.push('left');
        if (right) sides.push('right');
      }
      if (mode === 'inner' || mode === 'inner-h') {
        if (!top) sides.push('top');
        if (!bottom) sides.push('bottom');
      }
      if (mode === 'inner' || mode === 'inner-v') {
        if (!left) sides.push('left');
        if (!right) sides.push('right');
      }
      if (mode === 'top' && top) sides.push('top');
      if (mode === 'bottom' && bottom) sides.push('bottom');
      if (mode === 'left' && left) sides.push('left');
      if (mode === 'right' && right) sides.push('right');
      for (const s of sides) set(y, x, s, v);
    }
  }
  // the neighbour's side on the same edge says the same, so that the line is one line
  const mirror = (y: number, x: number, side: keyof CellBorders, ny: number, nx: number, nside: keyof CellBorders) => {
    const o = originAt(g, y, x);
    const val = g.cells[o.r]?.[o.c]?.borders?.[side];
    if (ny < 0 || nx < 0 || ny >= g.cells.length || nx >= colsOfGrid(g)) return;
    const no = originAt(g, ny, nx);
    if (no.r === o.r && no.c === o.c) return;
    set(ny, nx, nside, val);
  };
  for (let x = r.c0; x <= r.c1; x++) {
    mirror(r.r0, x, 'top', r.r0 - 1, x, 'bottom');
    mirror(r.r1, x, 'bottom', r.r1 + 1, x, 'top');
  }
  for (let y = r.r0; y <= r.r1; y++) {
    mirror(y, r.c0, 'left', y, r.c0 - 1, 'right');
    mirror(y, r.c1, 'right', y, r.c1 + 1, 'left');
  }
  return g;
}
