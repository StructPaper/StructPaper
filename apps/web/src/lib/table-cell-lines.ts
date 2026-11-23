import type { PaperTable, TableCell } from '@/types/paper';

/**
 * The lines of single cells. A table has its own style (lines above and below, between rows, between columns …); a cell may say for each
 * of its sides 'line' (draw one) or 'none' (leave it out), whatever the style says. These helpers work out, boundary by boundary, which
 * lines are drawn, so that the LaTeX export and the paper view of the table draw the same ones.
 */

export interface TableRules {
  top: boolean;
  bottom: boolean;
  hInner: boolean;
  vInner: boolean;
  vOuter: boolean;
}

/** The rows of the table, head first, and how many of them are head. */
export function rowsOf(table: PaperTable): { rows: TableCell[][]; head: number } {
  const headerRows = table.headerRows && table.headerRows.length > 0 ? table.headerRows : [];
  const body = table.bodyRows && table.bodyRows.length > 0 ? table.bodyRows : (table.rows ?? []).map((r) => r.map((text) => ({ text })));
  const head = headerRows.length > 0 ? headerRows.length : 1;
  const headCells: TableCell[][] = headerRows.length > 0 ? headerRows : [(table.headers ?? []).map((text) => ({ text }))];
  return { rows: [...headCells, ...body], head };
}

export interface Placed {
  cell: TableCell;
  row: number;
  col: number;
  colSpan: number;
  rowSpan: number;
}

/** Which cell stands on each place of the grid (a merged cell on every place it covers). */
export function occupancy(rows: TableCell[][], cols: number): (Placed | undefined)[][] {
  const grid: (Placed | undefined)[][] = rows.map(() => Array(cols).fill(undefined));
  rows.forEach((row, r) => {
    let col = 0;
    for (const cell of row) {
      while (col < cols && grid[r][col]) col++;
      if (col >= cols) break;
      const cs = Math.max(1, Math.min(cell.colSpan ?? 1, cols - col));
      const rs = Math.max(1, Math.min(cell.rowSpan ?? 1, rows.length - r));
      const placed: Placed = { cell, row: r, col, colSpan: cs, rowSpan: rs };
      for (let dr = 0; dr < rs; dr++) for (let dc = 0; dc < cs; dc++) if (grid[r + dr]) grid[r + dr][col + dc] = placed;
      col += cs;
    }
  });
  return grid;
}

export const hasCellBorders = (table: PaperTable): boolean => {
  const { rows } = rowsOf(table);
  return rows.some((r) => r.some((c) => c.borders && Object.values(c.borders).some((v) => v === 'line' || v === 'none')));
};

/**
 * The horizontal line under row `b - 1` (boundary b: 0 is above the first row, rows.length under the last), column by column, and whether
 * any cell has a say in it (when none has, the table's style is left to draw it as it always did).
 */
export function horizontalLine(table: PaperTable, rules: TableRules, b: number, cols: number): { lines: boolean[]; explicit: boolean } {
  const { rows } = rowsOf(table);
  const R = rows.length;
  const grid = occupancy(rows, cols);
  const base = b === 0 ? rules.top : b === R ? rules.hInner || rules.bottom : rules.hInner;
  const lines = Array(cols).fill(base);
  let explicit = false;
  for (let c = 0; c < cols; c++) {
    const above = b > 0 ? grid[b - 1]?.[c] : undefined;
    const below = b < R ? grid[b]?.[c] : undefined;
    const a = above && above.row + above.rowSpan - 1 === b - 1 ? above.cell.borders?.bottom : undefined;
    const d = below && below.row === b ? below.cell.borders?.top : undefined;
    // a cell merged down runs through the line: no line is drawn across it
    if (above && below && above === below) {
      explicit = true;
      lines[c] = false;
      continue;
    }
    if (a === undefined && d === undefined) continue;
    explicit = true;
    lines[c] = a === 'line' || d === 'line' ? true : false;
  }
  return { lines, explicit };
}

/** The vertical lines of row r: boundary k stands left of column k (0 and `cols` are the edges). */
export function verticalLines(table: PaperTable, rules: TableRules, r: number, cols: number): { lines: boolean[]; explicit: boolean } {
  const { rows } = rowsOf(table);
  const grid = occupancy(rows, cols);
  const lines = Array.from({ length: cols + 1 }, (_, k) => (k === 0 || k === cols ? rules.vOuter : rules.vInner));
  const said: ('line' | 'none' | undefined)[] = Array(cols + 1).fill(undefined);
  let explicit = false;
  for (let c = 0; c < cols; c++) {
    const p = grid[r]?.[c];
    if (!p || p.col !== c) continue;
    const left = p.cell.borders?.left;
    const right = p.cell.borders?.right;
    if (left) {
      explicit = true;
      said[c] = said[c] === 'line' || left === 'line' ? 'line' : 'none';
    }
    if (right) {
      explicit = true;
      said[c + p.colSpan] = said[c + p.colSpan] === 'line' || right === 'line' ? 'line' : 'none';
    }
  }
  said.forEach((v, k) => {
    if (v) lines[k] = v === 'line';
  });
  return { lines, explicit };
}

/**
 * Where the text stands in the height of the cells of a row. LaTeX can align the paragraph columns of a row only against each other
 * (array's m and b), so it is a thing of the row: a cell that says 'middle' or 'bottom' sets it for the cells of its row that say nothing.
 */
export function rowValign(cells: Array<Pick<TableCell, 'valign'>>): 'top' | 'middle' | 'bottom' {
  if (cells.some((c) => c.valign === 'middle')) return 'middle';
  if (cells.some((c) => c.valign === 'bottom')) return 'bottom';
  return 'top';
}
