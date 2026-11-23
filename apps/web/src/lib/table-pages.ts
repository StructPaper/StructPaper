import type { PaperTable } from '@/types/paper';
import type { ResolvedTheme } from './theme-config';
import type { TablePlan } from './table-plan';

/**
 * Where a table stands on the printed sheets, in points. The sheet and its margins are the ones the LaTeX template sets (the text area
 * from 15.4 pc to 3.1 pc, or the whole width over the side column), and a long table is cut between two of its rows exactly as longtable
 * and supertabular do: the head repeated, "continued" over it and under it. The heights of the pieces come from the measured rows.
 */

const CM = 28.3465;
const PC = 12;

export interface Sheet {
  w: number;
  h: number;
}

export function sheetSize(paperSize: string | undefined): Sheet {
  const inch = 72;
  const mm = 72 / 25.4;
  if (paperSize === 'a4') return { w: 210 * mm, h: 297 * mm };
  if (paperSize === 'letter') return { w: 8.5 * inch, h: 11 * inch };
  if (paperSize === 'b5') return { w: 182 * mm, h: 257 * mm };
  return { w: 8.51 * inch, h: 11 * inch };
}

export interface Region {
  /** From the left and top edge of the sheet as it is seen. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Margins {
  top: number;
  bottom: number;
  textLeft: number;
  textRight: number;
  wideLeft: number;
  wideRight: number;
  colSep: number;
}

export function marginsOf(theme: ResolvedTheme): Margins {
  return {
    top: theme.margins.top * CM,
    bottom: (theme.margins.bottom + 1.4) * CM,
    textLeft: 15.4 * PC,
    textRight: 3.1 * PC,
    wideLeft: theme.margins.left * CM,
    wideRight: theme.margins.right * CM,
    colSep: 1 * PC,
  };
}

export interface PageFrame {
  /** The sheet as it is seen. */
  sheet: Sheet;
  /** The sheet is turned on its side (the PDF has it landscape): the running head and the foot stand along the long edges. */
  landscape: boolean;
  /** The block the table is set in, in the sheet as it is seen. */
  region: Region;
  /** The block is turned a quarter round inside an upright sheet (the table is turned, the sheet is not). */
  blockTurned: boolean;
  /** Width the table is set to, and the room it has in height, whichever way the block is turned. */
  table: { w: number; h: number };
  /** The columns a long table flows through (supertabular in the text): 1 or 2, each `table.w` wide. */
  columns: 1 | 2;
  /** The text area has the side column to the left (the table does not use it). */
  sideColumn: boolean;
}

/** The frame of the sheets a table is set on. */
export function frameFor(plan: TablePlan, theme: ResolvedTheme, sheet: Sheet): PageFrame {
  const m = marginsOf(theme);
  const bodyH = sheet.h - m.top - m.bottom;
  const textW = sheet.w - m.textLeft - m.textRight;
  const wideW = sheet.w - m.wideLeft - m.wideRight;
  const colW = (textW - m.colSep) / 2;
  if (plan.isRotated) {
    const regionW = plan.wide ? wideW : textW;
    const regionX = plan.wide ? m.wideLeft : m.textLeft;
    // (the table is set across the turned page: its width is the height of the text, less 1.6 cm that keeps it clear of the head and foot)
    const tableW = bodyH - 1.6 * CM;
    if (theme.turnSheets) {
      // the PDF's page is turned to the reader: its left margin is now at the top, its bottom margin at the left
      const landscape: Sheet = { w: sheet.h, h: sheet.w };
      return {
        sheet: landscape,
        landscape: true,
        region: { x: m.bottom, y: regionX, w: tableW, h: regionW },
        blockTurned: false,
        table: { w: tableW, h: regionW },
        columns: 1,
        sideColumn: false,
      };
    }
    return {
      sheet,
      landscape: false,
      region: { x: regionX, y: m.top, w: regionW, h: bodyH },
      blockTurned: true,
      table: { w: tableW, h: regionW },
      columns: 1,
      sideColumn: !plan.wide,
    };
  }
  if (plan.mode === 'own-pages') {
    const w = plan.wide ? wideW : textW;
    return {
      sheet,
      landscape: false,
      region: { x: plan.wide ? m.wideLeft : m.textLeft, y: m.top, w, h: bodyH },
      blockTurned: false,
      table: { w, h: bodyH },
      columns: 1,
      sideColumn: !plan.wide,
    };
  }
  if (plan.mode === 'column-flow') {
    return {
      sheet,
      landscape: false,
      region: { x: m.textLeft, y: m.top, w: textW, h: bodyH },
      blockTurned: false,
      table: { w: colW, h: bodyH },
      columns: 2,
      sideColumn: true,
    };
  }
  // a float: in one column, or across the text area
  const w = plan.spansOneColumn ? colW : textW;
  return {
    sheet,
    landscape: false,
    region: { x: m.textLeft, y: m.top, w: textW, h: bodyH },
    blockTurned: false,
    table: { w, h: bodyH },
    columns: 1,
    sideColumn: true,
  };
}

/** What was measured of the table set to its width, in points. */
export interface TableMetrics {
  caption: number;
  source: number;
  /** The head rows together. */
  head: number;
  /** Each body row. */
  rows: number[];
  /** The "continued" line over a next piece and the foot line under a piece that goes on. */
  cont: number;
  foot: number;
}

export interface Piece {
  /** Body rows from `start` up to `end` (not including it). */
  start: number;
  end: number;
  first: boolean;
  last: boolean;
  /** Which sheet it stands on (from 0), and in which column of it. */
  sheet: number;
  column: number;
}

/**
 * Cuts the rows into pieces, as the LaTeX package does: the first piece carries the caption, a later piece has the "continued" line
 * (and the head again when the theme repeats it), a piece that goes on has the foot line, the last one has the source. A row is never
 * cut. A piece takes at least one row, however tall it is.
 */
export function cutIntoPieces(metrics: TableMetrics, room: { first: number; next: number }, opts: { repeatHead: boolean; columns: 1 | 2; mode: 'float' | 'column-flow' | 'own-pages' }): Piece[] {
  const n = metrics.rows.length;
  if (opts.mode === 'float') return [{ start: 0, end: n, first: true, last: true, sheet: 0, column: 0 }];
  const pieces: Piece[] = [];
  let start = 0;
  let index = 0;
  while (start <= n) {
    const first = pieces.length === 0;
    const head = first ? metrics.head : opts.repeatHead ? metrics.cont + metrics.head : metrics.cont;
    const top = (first ? metrics.caption : 0) + head;
    const room_ = first ? room.first : room.next;
    // can everything left go here, with the source?
    const rest = metrics.rows.slice(start).reduce((a, b) => a + b, 0);
    if (top + rest + metrics.source <= room_ + 0.01 || start >= n) {
      pieces.push({ start, end: n, first, last: true, sheet: Math.floor(index / opts.columns), column: index % opts.columns });
      break;
    }
    // otherwise as many rows as fit with the foot line under them (one at least)
    let used = top + metrics.foot;
    let end = start;
    while (end < n && (end === start || used + metrics.rows[end] <= room_ + 0.01)) {
      used += metrics.rows[end];
      end++;
    }
    pieces.push({ start, end, first, last: false, sheet: Math.floor(index / opts.columns), column: index % opts.columns });
    start = end;
    index++;
    if (index > 500) break;
  }
  return pieces;
}

/** The look of the table as the sheets draw it. */
export interface TablePaperLook {
  fontPt: number;
  /** The distance between two lines of a cell (the font's baseline skip), and the least row height the row stretch gives. */
  linePt: number;
  stretch: number;
}

export function lookOf(table: Pick<PaperTable, 'fontSize' | 'rowStretch'>, fontSize: string): TablePaperLook {
  const fontPt = parseFloat(table.fontSize ?? fontSize) || 8;
  const linePt = Math.round((fontPt + 2) * 2) / 2;
  return { fontPt, linePt, stretch: table.rowStretch || 1.2 };
}

/** Width of each column in points, as the LaTeX columns are set: the weights share the width left after the padding of the columns. */
export function columnWidthsPt(weights: number[], width: number, tabcolsep = 6): number[] {
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const free = width - 2 * tabcolsep * weights.length;
  return weights.map((w) => (free * w) / total + 2 * tabcolsep);
}
