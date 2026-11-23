import type { PaperTable } from '@/types/paper';
import type { ResolvedTheme } from './theme-config';
import { choosePlacement, estimateHeight, JOURNAL_GEOMETRY, measureTable } from './table-placement';
import { stripMarkup } from './inline-markup';
import { fitWeightsToWords, wordMinimums } from './table-fit';

/**
 * Where a table goes on the printed page and how it is set: the one decision the LaTeX export and the paper view of the table share, so
 * that what the editor draws is what the PDF prints.
 *
 *   float          a `table` / `table*` that finds its place in a column or across the page (or `sidewaystable` when turned)
 *   column-flow    a long table in one column: `supertabular`, flowing from column to column with its header repeated
 *   own-pages      a long table (over both columns, turned, or kept apart) on pages of its own: `longtable`
 */
export type TableMode = 'float' | 'column-flow' | 'own-pages';

export interface TablePlan {
  mode: TableMode;
  isRotated: boolean;
  spansOneColumn: boolean;
  isLong: boolean;
  /** Own pages across the whole sheet, over the side column (QR code, contact), rather than within the text area. */
  wide: boolean;
  fontSize: string;
}

/** The sheet in points (the sample PDFs): 216 × 279 mm. */
export const SHEET_PT = { width: 612.28, height: 790.7 };

/**
 * Does a table on pages of its own take the whole width of the sheet, over the side column (QR code, contact)? Only when the author set it so
 * (`sideColumn: 'full'`), or for an appendix table (the journals set those across the page) that is not kept in the text. A table of the text
 * stays in the text area unless the author says otherwise.
 */
export const wideOf = (table: Pick<PaperTable, 'sideColumn' | 'appendix'>, spansOneColumn: boolean): boolean =>
  table.sideColumn === 'full' || (!!table.appendix && table.sideColumn !== 'text' && !spansOneColumn);

/** The decision, as the LaTeX export takes it (see lib/latex-table). */
export function planTable(table: PaperTable, theme: ResolvedTheme, opts: { isOneColumn: boolean; inline?: boolean }): TablePlan {
  const inline = !!opts.inline;
  const rawHeaders = table.headers && table.headers.length > 0 ? table.headers : ['Cột 1'];
  const rawRows = table.rows || [];
  const maxCols = Math.max(rawHeaders.length, ...rawRows.map((r) => r.length), 1);
  const headers = Array(maxCols).fill('').map((_, i) => rawHeaders[i] || '');
  const paddedRows = rawRows.map((row) => Array(maxCols).fill('').map((_, i) => row[i] || ''));
  const bodyCount = table.bodyRows && table.bodyRows.length > 0 ? table.bodyRows.length : paddedRows.length;

  // a table whose author has not chosen one column, two or turned: its size decides
  const undecided = table.columnSpan === undefined && table.isFullWidth === undefined && table.isRotated === undefined;
  const auto = undecided ? choosePlacement(table) : undefined;
  const isRotated = auto ? auto.rotated : !!table.isRotated;
  const spansOneColumn = opts.isOneColumn || (auto ? auto.columnSpan === '1-column' : table.columnSpan === '1-column' || table.isFullWidth === false);
  const fontSize = table.fontSize || auto?.fontSize || '8pt';

  const breakMode = table.breakAcrossPages ?? 'auto';
  const fontPt = parseFloat(fontSize) || 8;
  // A float cannot be cut: a table taller than the room it has would run off the page, so it is set to flow over as many pages as it needs
  const room = isRotated
    ? { width: JOURNAL_GEOMETRY.sidewaysWidth, height: JOURNAL_GEOMETRY.sidewaysHeight }
    : { width: spansOneColumn ? JOURNAL_GEOMETRY.column : JOURNAL_GEOMETRY.page, height: JOURNAL_GEOMETRY.pageHeight * 0.85 };
  const tooTall = breakMode !== 'never' && estimateHeight(measureTable({ headers, rows: paddedRows, bodyRows: table.bodyRows }, fontPt), room.width, fontPt) > room.height;
  // (a table set "across the whole page" takes pages of its own, however short)
  const isLong = breakMode === 'always' || tooTall || table.sideColumn === 'full' || (breakMode === 'auto' && bodyCount > theme.longTableRowThreshold) || (isRotated && theme.turnSheets);

  if (isLong && spansOneColumn && !isRotated && !inline) return { mode: 'column-flow', isRotated, spansOneColumn, isLong, wide: false, fontSize };
  if (isLong || inline) {
    const wide = !inline && wideOf(table, spansOneColumn);
    return { mode: 'own-pages', isRotated, spansOneColumn, isLong, wide, fontSize };
  }
  return { mode: 'float', isRotated, spansOneColumn, isLong, wide: false, fontSize };
}

/**
 * The relative width of each column. The author's own (`colWeights`) when set; otherwise like a typeset journal table: the longest
 * line of a column decides, softened by a square root so that a column of short names still gets about a third of the width next to a
 * column of long sentences. A banner merged over several columns says nothing about one column's width: the leaf header row decides,
 * and merged cells are left out.
 */
export function columnWeights(
  table: PaperTable,
  headers: string[],
  bodyRows: Array<Array<{ text?: string; colSpan?: number } | string>>,
  /** The width the columns share (points) and the size of the type: a column is then given the room of its longest word, which TeX does not break. */
  fit?: { width: number; fontPt: number }
): number[] {
  const maxCols = headers.length;
  const explicit = table.colWeights && table.colWeights.length === maxCols && table.colWeights.every((w) => w > 0) ? table.colWeights.map((w) => Math.max(1, Math.round(w * 100))) : null;
  if (explicit) return explicit;
  const headerText = (c: number): string => stripMarkup(String(headers[c] ?? '')).split(' / ').pop() ?? '';
  const base = headers.map((_h, c) => {
    const cells = [
      headerText(c),
      ...bodyRows
        .filter((r) => !((r[c] as { colSpan?: number })?.colSpan && (r[c] as { colSpan?: number }).colSpan! > 1))
        .map((r) => stripMarkup(String((r[c] as { text?: string })?.text ?? r[c] ?? ''))),
    ];
    const longestLine = Math.max(...cells.flatMap((t) => t.split(/\r?\n/).map((l) => l.length)), 1);
    const L = Math.min(110, Math.max(6, longestLine));
    // a label that fits on one line ("KCN Hiệp Phước GĐ1") gets the room to stay on it: grows linearly up to ~28 characters
    return Math.max(Math.round(Math.sqrt(L) * 10), L <= 28 ? Math.round(L * 3.2) : 0);
  });
  return fit ? fitWeightsToWords(base, wordMinimums(table, maxCols, fit.fontPt), fit.width) : base;
}
