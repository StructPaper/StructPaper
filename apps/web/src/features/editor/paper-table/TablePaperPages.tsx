'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PaperTable } from '@/types/paper';
import type { ResolvedTheme } from '@/lib/theme-config';
import type { TablePlan } from '@/lib/table-plan';
import { deriveTableLayout } from '@/lib/table-layout';
import {
  cutIntoPieces,
  marginsOf,
  type PageFrame,
  type Piece,
  type TableMetrics,
} from '@/lib/table-pages';
import type { Range, TableGrid } from '@/lib/table-grid';
import { PieceTable, type PieceHandlers } from './table-paper-parts';
import './paper-table.css';

const PX_PER_PT = 96 / 72;

export interface TablePaperLayoutInfo {
  plan: TablePlan;
  frame: PageFrame;
  sheets: number;
  pieces: number;
}

export interface TablePaperPagesProps {
  table: PaperTable;
  grid: TableGrid;
  theme: ResolvedTheme;
  paperSize: string;
  isOneColumn: boolean;
  lang: 'vi' | 'en';
  /** The line printed at the top of every sheet. */
  header: string;
  /** The number the first sheet of the table carries, and where the numbers are printed. */
  firstPageNumber: number;
  numberPosition: 'alternating' | 'left' | 'center' | 'right';
  showNumbers: boolean;
  selection: Range | null;
  active: { r: number; c: number } | null;
  handlers: PieceHandlers;
  onLayout?: (info: TablePaperLayoutInfo) => void;
}

const words = (lang: 'vi' | 'en', appendix: boolean, n: number, theme: ResolvedTheme) => {
  if (appendix) {
    const label = lang === 'en' ? `Appendix ${n}` : `Phụ lục ${n}`;
    return {
      label: `${label}.`,
      cont: `${label} ${lang === 'en' ? '(continued)' : '(tiếp theo)'}`,
      foot: lang === 'en' ? 'Continued on next page' : 'Xem tiếp ở trang sau',
    };
  }
  return {
    label: `${lang === 'en' ? 'Table' : 'Bảng'} ${n}:`,
    cont: theme.continuedTitleText.replace('{n}', String(n || '')),
    foot: theme.continuedFootText,
  };
};

const sameMetrics = (a: TableMetrics | null, b: TableMetrics): boolean =>
  !!a &&
  Math.abs(a.caption - b.caption) < 0.05 &&
  Math.abs(a.source - b.source) < 0.05 &&
  Math.abs(a.head - b.head) < 0.05 &&
  Math.abs(a.cont - b.cont) < 0.05 &&
  Math.abs(a.foot - b.foot) < 0.05 &&
  a.rows.length === b.rows.length &&
  a.rows.every((h, i) => Math.abs(h - b.rows[i]) < 0.05);

/**
 * The table on the sheets of the journal: set to the width LaTeX gives it, cut where longtable / supertabular cut it, with the caption,
 * the head repeated, the "continued" lines, the source, the running head and the page number. The rows are measured as they stand on the
 * screen (the same fonts and sizes as the PDF's), and the cut is worked out from those measures.
 */
export const TablePaperPages: React.FC<TablePaperPagesProps> = ({
  table,
  grid,
  theme,
  paperSize,
  isOneColumn,
  lang,
  header,
  firstPageNumber,
  numberPosition,
  showNumbers,
  selection,
  active,
  handlers,
  onLayout,
}) => {
  const layout = useMemo(() => deriveTableLayout(table, theme, { isOneColumn, paperSize }), [table, theme, isOneColumn, paperSize]);
  const { plan, sheet, frame, look, cols, weights, widthPt } = layout;
  const margins = useMemo(() => marginsOf(theme), [theme]);
  const nBody = Math.max(0, grid.cells.length - grid.head);
  const w = words(lang, !!table.appendix, table.num, theme);

  // ---- measure the rows at their width ----
  const measureRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<TableMetrics | null>(null);
  const measurePiece: Piece = useMemo(() => ({ start: 0, end: nBody, first: true, last: true, sheet: 0, column: 0 }), [nBody]);
  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const h = (el: Element | null | undefined) => (el ? (el as HTMLElement).getBoundingClientRect().height / PX_PER_PT : 0);
    const caption = root.querySelector('[data-measure="caption"]');
    const source = root.querySelector('[data-measure="source"]');
    const head = Array.from(root.querySelectorAll('tr[data-kind="head"]')).reduce((a, tr) => a + h(tr), 0);
    const rows = Array.from({ length: nBody }, (_, i) => h(root.querySelector(`tr[data-kind="body"][data-row="${i}"]`)));
    const next: TableMetrics = {
      caption: h(caption) + 1.4,
      source: source && (source as HTMLElement).textContent?.trim() ? h(source) + 2.5 : 0,
      head,
      rows,
      cont: h(root.querySelector('tr[data-kind="cont"]')),
      foot: h(root.querySelector('tr[data-kind="foot"]')),
    };
    setMetrics((prev) => (sameMetrics(prev, next) ? prev : next));
  });

  const pieces = useMemo(() => {
    if (!metrics) return [] as Piece[];
    return cutIntoPieces(metrics, { first: frame.table.h, next: frame.table.h }, { repeatHead: theme.repeatTableHeader, columns: frame.columns, mode: plan.mode });
  }, [metrics, frame, theme.repeatTableHeader, plan.mode]);
  const sheets = pieces.length > 0 ? Math.max(...pieces.map((p) => p.sheet)) + 1 : 1;

  useEffect(() => {
    onLayout?.({ plan, frame, sheets, pieces: pieces.length });
  }, [onLayout, plan, frame, sheets, pieces.length]);

  const blockHeight = (p: Piece): number => {
    if (!metrics) return 0;
    const rows = metrics.rows.slice(p.start, p.end).reduce((a, b) => a + b, 0);
    return (p.first ? metrics.caption : 0) + (p.first ? metrics.head : theme.repeatTableHeader ? metrics.cont + metrics.head : metrics.cont) + rows + (p.last ? metrics.source : metrics.foot);
  };

  const pieceProps = {
    table,
    grid,
    theme,
    look,
    weights,
    widthPt,
    lang,
    label: w.label,
    continuedTitle: w.cont,
    continuedFoot: w.foot,
    roomPt: frame.table.w,
  };

  const lineStep = 12.35;
  const sheetNumber = (i: number) => firstPageNumber + i;
  const numberSide = (n: number): 'left' | 'center' | 'right' => (numberPosition === 'alternating' ? (n % 2 === 0 ? 'left' : 'right') : numberPosition);

  const renderSheet = (index: number) => {
    const here = pieces.filter((p) => p.sheet === index);
    const n = sheetNumber(index);
    const side = numberSide(n);
    const portrait = frame.landscape ? { w: sheet.w, h: sheet.h } : { w: frame.sheet.w, h: frame.sheet.h };
    const chrome = (
      <div className="tp-chrome" style={{ width: `${portrait.w}pt`, height: `${portrait.h}pt`, ...(frame.landscape ? { transformOrigin: '0 0', transform: `translate(${portrait.h}pt, 0) rotate(90deg)` } : {}) }}>
        <span className="tp-run-head">{header}</span>
        <i className="tp-run-rule" />
        {showNumbers && (
          <span className="tp-page-no" style={side === 'left' ? { left: `${margins.textLeft}pt` } : side === 'right' ? { right: `${margins.textRight}pt` } : { left: '50%', transform: 'translateX(-50%)' }}>
            {n}
          </span>
        )}
      </div>
    );
    const colW = frame.table.w;
    const placeBlock = (p: Piece, content: React.ReactNode, top: number) => {
      const left = frame.region.x + p.column * (colW + margins.colSep);
      const block = (
        <div key={`${p.sheet}-${p.column}-${p.start}`} className="tp-block" style={{ left: `${left}pt`, top: `${top}pt`, width: `${colW}pt` }}>
          {content}
        </div>
      );
      if (frame.blockTurned) {
        // the table is turned on the upright sheet: set across the turned text, then turned a quarter round
        return (
          <div key={`${p.sheet}-t`} className="tp-block" style={{ left: `${frame.region.x}pt`, top: `${frame.region.y + frame.table.w}pt`, width: `${frame.table.w}pt`, transformOrigin: '0 0', transform: 'rotate(-90deg)' }}>
            {content}
          </div>
        );
      }
      return block;
    };

    const skeletons: React.ReactNode[] = [];
    const blocks: React.ReactNode[] = [];
    if (plan.mode === 'float') {
      const p = here[0];
      const bh = p ? blockHeight(p) : 0;
      const placement = table.placement ?? 'auto';
      const colWidth = frame.table.w;
      const regionTop = frame.region.y;
      const regionH = frame.region.h;
      const gap = 8;
      let top = regionTop;
      if (placement === 'here') top = regionTop + lineStep * 6;
      if (placement === 'bottom') top = Math.max(regionTop, regionTop + regionH - bh);
      const leftCol = frame.region.x;
      const rightCol = frame.region.x + colWidth + margins.colSep;
      const spans = !plan.spansOneColumn || frame.table.w > colWidth + 1;
      if (p) blocks.push(placeBlock(p, <PieceTable {...pieceProps} piece={p} interactive selection={selection} active={active} handlers={handlers} />, top));
      if (plan.spansOneColumn) {
        // the text goes round it: the column beside it, and above and below it in its own column
        skeletons.push(<div key="sk-r" className="tp-skeleton" style={{ left: `${rightCol}pt`, top: `${regionTop}pt`, width: `${colWidth}pt`, height: `${regionH}pt` }} />);
        if (top > regionTop) skeletons.push(<div key="sk-a" className="tp-skeleton" style={{ left: `${leftCol}pt`, top: `${regionTop}pt`, width: `${colWidth}pt`, height: `${Math.max(0, top - regionTop - gap)}pt` }} />);
        const below = top + bh + gap;
        if (below < regionTop + regionH) skeletons.push(<div key="sk-b" className="tp-skeleton" style={{ left: `${leftCol}pt`, top: `${below}pt`, width: `${colWidth}pt`, height: `${regionTop + regionH - below}pt` }} />);
      } else {
        const colW2 = (frame.region.w - margins.colSep) / 2;
        const below = top + bh + gap;
        if (top > regionTop) skeletons.push(<div key="sk-a" className="tp-skeleton" style={{ left: `${leftCol}pt`, top: `${regionTop}pt`, width: `${frame.region.w}pt`, height: `${Math.max(0, top - regionTop - gap)}pt` }} />);
        if (below < regionTop + regionH) {
          skeletons.push(<div key="sk-b1" className="tp-skeleton" style={{ left: `${leftCol}pt`, top: `${below}pt`, width: `${colW2}pt`, height: `${regionTop + regionH - below}pt` }} />);
          skeletons.push(<div key="sk-b2" className="tp-skeleton" style={{ left: `${leftCol + colW2 + margins.colSep}pt`, top: `${below}pt`, width: `${colW2}pt`, height: `${regionTop + regionH - below}pt` }} />);
        }
        void spans;
      }
    } else {
      for (const p of here) {
        blocks.push(placeBlock(p, <PieceTable {...pieceProps} piece={p} interactive selection={selection} active={active} handlers={handlers} />, frame.region.y));
      }
      if (plan.mode === 'column-flow') {
        // the text goes on in the column under the last piece, and in the column beside it when the table ends in the first one
        const last = here[here.length - 1];
        if (last && last.last) {
          const colWidth = frame.table.w;
          const left = frame.region.x + last.column * (colWidth + margins.colSep);
          const below = frame.region.y + blockHeight(last) + 8;
          if (below < frame.region.y + frame.region.h) skeletons.push(<div key="sk-b" className="tp-skeleton" style={{ left: `${left}pt`, top: `${below}pt`, width: `${colWidth}pt`, height: `${frame.region.y + frame.region.h - below}pt` }} />);
          if (last.column === 0) skeletons.push(<div key="sk-r" className="tp-skeleton" style={{ left: `${frame.region.x + colWidth + margins.colSep}pt`, top: `${frame.region.y}pt`, width: `${colWidth}pt`, height: `${frame.region.h}pt` }} />);
        }
      }
    }

    return (
      <div key={index} className="tp-sheet-wrap">
        <div className="tp-sheet-label">{lang === 'en' ? `Page ${n}` : `Trang ${n}`}{sheets > 1 ? ` · ${index + 1}/${sheets}` : ''}</div>
        <div className="tp-sheet" data-sheet={index + 1} style={{ width: `${frame.sheet.w}pt`, height: `${frame.sheet.h}pt` }}>
          {chrome}
          {skeletons}
          {blocks}
        </div>
      </div>
    );
  };

  return (
    <div className="tp-root" data-testid="table-paper-pages">
      {/* the rows are measured here, out of sight, at the width they are set to */}
      <div ref={measureRef} aria-hidden style={{ position: 'absolute', left: -99999, top: 0, width: `${frame.table.w}pt`, visibility: 'hidden', pointerEvents: 'none' }} className="tp-block" data-measure-root>
        <PieceTable {...pieceProps} piece={measurePiece} measure />
      </div>
      {Array.from({ length: sheets }, (_, i) => renderSheet(i))}
    </div>
  );
};
