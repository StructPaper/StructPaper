import type { PaperFigure, PaperTable } from '@/types/paper';
import { choosePlacement } from '@/lib/table-placement';
import { resolveBodyFill } from '@/lib/table-fill';

/** The same decision the LaTeX export makes: does this table run over both columns, and is it turned sideways? */
export function tablePlacement(table: PaperTable, isOneColumn: boolean): { spansBoth: boolean; rotated: boolean } {
  const undecided = table.columnSpan === undefined && table.isFullWidth === undefined && table.isRotated === undefined;
  const auto = undecided ? choosePlacement(table) : undefined;
  const rotated = auto ? auto.rotated : !!table.isRotated;
  const oneCol = isOneColumn || (auto ? auto.columnSpan === '1-column' : table.columnSpan === '1-column' || table.isFullWidth === false);
  return { spansBoth: !oneCol, rotated };
}

/** Does a figure run over both columns? (as the Word and LaTeX exports read the same fields) */
export function figureSpansBoth(fig: PaperFigure, isOneColumn: boolean): boolean {
  if (isOneColumn) return false;
  return fig.columnSpan === '2-column' || (fig.columnSpan !== '1-column' && !!fig.isFullWidth);
}

/** The table's look as CSS variables and data attributes for the overview. */
export function tableLook(table: PaperTable, theme: { tableHeaderColor: string; tableZebraColor: string }) {
  const fontSize = parseFloat(table.fontSize ?? '8') || 8;
  const stretch = table.rowStretch || 1.2;
  const vars: Record<string, string> = {
    '--ov-tsize': `${fontSize}pt`,
    // the LaTeX line height grows with the type size (8 pt -> 10 pt) and the row stretch widens the rows
    '--ov-tline': `${Math.round((fontSize + 2) * stretch * 2) / 2}pt`,
    '--ov-thead': table.headerFill || theme.tableHeaderColor,
    '--ov-ttint': table.bodyTint || theme.tableZebraColor,
  };
  if (table.borderColor) vars['--ov-tcolor'] = table.borderColor;
  if (table.borderWidth) vars['--ov-tweight'] = `${table.borderWidth}pt`;
  return { vars, border: table.borderStyle ?? 'journal', fill: resolveBodyFill(table) };
}
