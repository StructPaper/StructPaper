import type { PaperTable } from '@/types/paper';
import type { ResolvedTheme } from './theme-config';
import { columnWeights, planTable, type TablePlan } from './table-plan';
import { frameFor, lookOf, sheetSize, type PageFrame, type TablePaperLook, type Sheet } from './table-pages';

/** Everything that fixes how a table is set on the sheet, from the table and the paper's settings: the one place the paper view and its editing tools read it. */
export interface TableLayout {
  plan: TablePlan;
  sheet: Sheet;
  frame: PageFrame;
  look: TablePaperLook;
  cols: number;
  /** The share of each column (what LaTeX takes the columns' `p{}` widths from). */
  weights: number[];
  /** The width the columns together are set to, in points. */
  widthPt: number;
}

export function deriveTableLayout(table: PaperTable, theme: ResolvedTheme, opts: { isOneColumn: boolean; paperSize: string; /** The line spacing of the paper (1.13 by default). */ lineSpread?: number }): TableLayout {
  const plan = planTable(table, theme, { isOneColumn: opts.isOneColumn });
  const sheet = sheetSize(opts.paperSize);
  const frame = frameFor(plan, theme, sheet);
  const look = lookOf(table, plan.fontSize, opts.lineSpread);
  const cols = Math.max(table.headers?.length ?? 0, ...(table.bodyRows ?? []).map((r) => r.reduce((n, c) => n + Math.max(1, c.colSpan ?? 1), 0)), ...(table.rows ?? []).map((r) => r.length), 1);
  const headers = Array.from({ length: cols }, (_, i) => table.headers?.[i] ?? '');
  const body = table.bodyRows && table.bodyRows.length > 0 ? table.bodyRows : (table.rows ?? []).map((r) => r.map((text) => ({ text })));
  const percent = table.widthPercent && table.widthPercent > 0 && table.widthPercent < 100 ? table.widthPercent : 100;
  const widthPt = (frame.table.w * percent) / 100;
  const weights = columnWeights(table, headers, body, { width: widthPt, fontPt: look.fontPt });
  return { plan, sheet, frame, look, cols, weights, widthPt };
}

/** The share each column has when its width in points is `width` (the padding of the columns, 6 pt on each side, is not shared). */
export function weightsFromWidths(widths: number[], tableWidth: number, tabcolsep = 6): number[] {
  const free = Math.max(1, tableWidth - 2 * tabcolsep * widths.length);
  const raw = widths.map((w) => Math.max(0.0001, w - 2 * tabcolsep));
  const total = raw.reduce((a, b) => a + b, 0) || free;
  return raw.map((w) => w / total);
}
