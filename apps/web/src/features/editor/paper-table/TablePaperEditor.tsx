'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PaperTable } from '@/types/paper';
import { resolveTheme } from '@/lib/theme-config';
import { getJournalTemplate } from '@/lib/templates';
import { resolvePublication } from '@/lib/publication';
import { applyMarkup, stripMarkup, styleAt } from '@/lib/inline-markup';
import { deriveTableLayout, weightsFromWidths } from '@/lib/table-layout';
import { columnWidthsPt } from '@/lib/table-pages';
import {
  applyBorders,
  colsOfGrid,
  deleteCols,
  deleteRows,
  expandRange,
  fromGrid,
  insertCols,
  insertRows,
  mapText,
  mergeRange,
  normalizeRange,
  originAt,
  patchRange,
  setHeadRows,
  setText,
  toGrid,
  unmergeAt,
  type BorderMode,
  type Range,
  type TableGrid,
} from '@/lib/table-grid';
import { TableSettingsModal } from '../components/TableSettingsModal';
import { runningHeader } from '../overview/PageChrome';
import { TablePaperPages, type TablePaperLayoutInfo } from './TablePaperPages';
import { TablePaperToolbar, type PaperTableFormat, type PaperTableOps } from './TablePaperToolbar';
import type { BrandColor } from '../overview/overview-ui';
import type { PieceHandlers } from './table-paper-parts';
import { usePaperTableContext } from './paper-table-context';

const PX_PER_PT = 96 / 72;

interface Props {
  /** The table as it is now; the editor works on its own copy and hands every change over at once (onChange). */
  table: PaperTable;
  onChange: (table: PaperTable) => void;
  onClose: () => void;
}

interface Cell {
  r: number;
  c: number;
}

const numberSideOf = (position: string): 'alternating' | 'left' | 'center' | 'right' => {
  const align = position.split('-')[1];
  return align === 'left' || align === 'right' || align === 'center' ? align : 'alternating';
};

/**
 * The paper view of a table: the table alone on sheets of the real size, on a dark ground, with its settings beside it and the tools of a
 * spreadsheet over it. Whatever is done shows on the sheet at once and goes to the paper at once.
 */
export const TablePaperEditor: React.FC<Props> = ({ table: initial, onChange, onClose }) => {
  const ctx = usePaperTableContext();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // the ground fades in first; the sheets and the settings follow it (drawing them takes a moment that would stop the fade)
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 140);
    return () => clearTimeout(t);
  }, []);

  const [table, setTable] = useState<PaperTable>(initial);
  const tableRef = useRef(table);
  tableRef.current = table;
  const grid = useMemo(() => toGrid(table), [table]);
  const gridRef = useRef(grid);
  gridRef.current = grid;

  // ---- history of this view (the paper's own history sees every change as the paper changes) ----
  const past = useRef<PaperTable[]>([]);
  const future = useRef<PaperTable[]>([]);
  const lastKey = useRef<{ key: string; at: number } | null>(null);
  const [, bump] = useState(0);
  const commit = useCallback(
    (next: PaperTable, key?: string) => {
      const now = Date.now();
      const same = !!key && lastKey.current?.key === key && now - lastKey.current.at < 1200;
      if (!same) {
        past.current.push(tableRef.current);
        if (past.current.length > 200) past.current.shift();
      }
      lastKey.current = key ? { key, at: now } : null;
      future.current = [];
      tableRef.current = next;
      setTable(next);
      onChange(next);
      bump((n) => n + 1);
    },
    [onChange]
  );
  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(tableRef.current);
    lastKey.current = null;
    tableRef.current = prev;
    setTable(prev);
    onChange(prev);
    bump((n) => n + 1);
  }, [onChange]);
  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(tableRef.current);
    lastKey.current = null;
    tableRef.current = next;
    setTable(next);
    onChange(next);
    bump((n) => n + 1);
  }, [onChange]);
  const applyGrid = useCallback((g: TableGrid, key?: string) => commit(fromGrid(g, tableRef.current), key), [commit]);

  // ---- the paper this table is in ----
  const paper = ctx?.paper;
  const layoutSettings = ctx?.layout;
  const lang = ctx?.lang ?? 'vi';
  const theme = useMemo(() => {
    const m = paper?.metadata;
    const color = (paper as { color?: string } | undefined)?.color || (m as { journalColor?: string } | undefined)?.journalColor || (m ? getJournalTemplate(m.journalId).color : undefined);
    return resolveTheme(layoutSettings, color);
  }, [paper, layoutSettings]);
  const isOneColumn = layoutSettings?.columnLayout === '1-column';
  const paperSize = layoutSettings?.paperSize ?? 'custom';
  const pageNum = layoutSettings?.pageNumbering;
  const header = useMemo(() => (paper ? runningHeader(paper) : ''), [paper]);
  const firstPage = useMemo(() => {
    if (!paper) return 1;
    const n = Number(resolvePublication(paper.metadata).firstPage);
    return (Number.isFinite(n) && n > 0 ? n : 1) + 1;
  }, [paper]);

  const layout = useMemo(() => deriveTableLayout(table, theme, { isOneColumn, paperSize }), [table, theme, isOneColumn, paperSize]);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // ---- selection ----
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [focus, setFocus] = useState<Cell | null>(null);
  const dragging = useRef(false);
  const [multi, setMulti] = useState(false);
  const range: Range | null = useMemo(() => {
    if (!anchor || !focus) return null;
    const r = normalizeRange(anchor, focus);
    const rows = grid.cells.length;
    const cols = colsOfGrid(grid);
    if (r.r1 >= rows || r.c1 >= cols) return null;
    return expandRange(grid, r);
  }, [anchor, focus, grid]);
  const rangeRef = useRef(range);
  rangeRef.current = range;
  const isSingle = !!range && range.r0 === range.r1 && range.c0 === range.c1;
  const active = anchor && focus && anchor.r === focus.r && anchor.c === focus.c ? anchor : range ? { r: range.r0, c: range.c0 } : null;

  useEffect(() => {
    const up = () => {
      dragging.current = false;
    };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, []);

  const select = (a: Cell, f: Cell) => {
    setAnchor(a);
    setFocus(f);
  };

  const focusCell = useCallback((r: number, c: number) => {
    const el = document.querySelector<HTMLElement>(`.tp-root td[data-r="${r}"][data-c="${c}"] .tp-cell`);
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel) {
      const rg = document.createRange();
      rg.selectNodeContents(el);
      rg.collapse(false);
      sel.removeAllRanges();
      sel.addRange(rg);
    }
  }, []);

  // ---- what the sheet's cells report ----
  const handlers: PieceHandlers = useMemo(
    () => ({
      onCellDown: (r, c, e) => {
        if (e.button !== 0) return;
        const o = originAt(gridRef.current, r, c);
        if (e.shiftKey && anchor) {
          e.preventDefault();
          setFocus(o);
        } else {
          setAnchor(o);
          setFocus(o);
        }
        setMulti(false);
        dragging.current = true;
      },
      onCellEnter: (r, c) => {
        if (!dragging.current) return;
        const o = originAt(gridRef.current, r, c);
        setFocus((prev) => {
          if (!prev || prev.r !== o.r || prev.c !== o.c) return o;
          return prev;
        });
        setAnchor((a) => {
          if (a && (a.r !== o.r || a.c !== o.c)) {
            // more than one cell: the text is not being edited, the cells are chosen
            setMulti(true);
            (document.activeElement as HTMLElement | null)?.blur?.();
            window.getSelection()?.removeAllRanges();
          }
          return a;
        });
      },
      onCellText: (r, c, text) => {
        applyGrid(setText(gridRef.current, r, c, text), `text:${r}:${c}`);
      },
      onCellKey: (r, c, e) => {
        const g = gridRef.current;
        if (e.key === 'Tab') {
          e.preventDefault();
          const cols = colsOfGrid(g);
          const o = originAt(g, r, c);
          const cell = g.cells[o.r][o.c];
          let nr = o.r;
          let nc = e.shiftKey ? o.c - 1 : o.c + cell.colSpan;
          if (nc >= cols) {
            nc = 0;
            nr += 1;
          }
          if (nc < 0) {
            nc = cols - 1;
            nr -= 1;
          }
          if (nr < 0 || nr >= g.cells.length) return;
          const t = originAt(g, nr, nc);
          select(t, t);
          setMulti(false);
          requestAnimationFrame(() => focusCell(t.r, t.c));
        } else if (e.key === 'Escape') {
          (e.currentTarget as HTMLElement).blur();
          e.stopPropagation();
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          // at the first or last line of a cell the arrow goes to the cell under or over it
          const sel = window.getSelection();
          const el = e.currentTarget as HTMLElement;
          if (sel && sel.rangeCount && sel.isCollapsed) {
            const rect = sel.getRangeAt(0).getClientRects()[0];
            const box = el.getBoundingClientRect();
            const atEdge = !rect || (e.key === 'ArrowDown' ? rect.bottom >= box.bottom - 2 : rect.top <= box.top + 2);
            if (atEdge) {
              const o = originAt(g, r, c);
              const cell = g.cells[o.r][o.c];
              const nr = e.key === 'ArrowDown' ? o.r + cell.rowSpan : o.r - 1;
              if (nr >= 0 && nr < g.cells.length) {
                e.preventDefault();
                const t = originAt(g, nr, o.c);
                select(t, t);
                requestAnimationFrame(() => focusCell(t.r, t.c));
              }
            }
          }
        }
      },
      onCaption: (text) => commit({ ...tableRef.current, caption: text }, 'caption'),
      onSource: (text) => commit({ ...tableRef.current, source: text || undefined }, 'source'),
      onResizeStart: (kind, index, e) => startResize(kind, index, e),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [anchor, applyGrid, commit, focusCell]
  );

  // ---- zoom ----
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoomState] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const userZoomed = useRef(false);
  const setZoom = (z: number) => {
    userZoomed.current = true;
    setZoomState(z);
  };
  const fit = useCallback(() => {
    userZoomed.current = false;
    const box = scroller.current;
    if (!box) return;
    const sheetPx = layoutRef.current.frame.sheet.w * PX_PER_PT;
    const z = Math.max(0.35, Math.min(1.25, (box.clientWidth - 56) / sheetPx));
    setZoomState(Math.round(z * 100) / 100);
  }, []);
  useLayoutEffect(() => {
    if (!mounted) return;
    fit();
    const box = scroller.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (!userZoomed.current) fit();
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, [mounted, fit, layout.frame.sheet.w]);

  // ---- dragging the edges of columns and rows ----
  const resizing = useRef<null | { kind: 'col' | 'row'; index: number; startX: number; startY: number; base: PaperTable; widths: number[]; startH: number; shares: number[] }>(null);
  const [resizeKind, setResizeKind] = useState<'col' | 'row' | null>(null);
  // the blue line over the table that follows the edge being dragged (vertical for a column, horizontal for a row)
  const [guide, setGuide] = useState<{ kind: 'col' | 'row'; at: number; from: number; to: number } | null>(null);
  function startResize(kind: 'col' | 'row', index: number, e: React.PointerEvent) {
    e.preventDefault();
    const L = layoutRef.current;
    const cell = (e.currentTarget as HTMLElement).closest('td');
    const tr = (e.currentTarget as HTMLElement).closest('tr');
    const widths = columnWidthsPt(L.weights, L.widthPt);
    resizing.current = {
      kind,
      index,
      startX: e.clientX,
      startY: e.clientY,
      base: tableRef.current,
      widths,
      startH: tr ? tr.getBoundingClientRect().height / PX_PER_PT / zoomRef.current : cell ? cell.getBoundingClientRect().height / PX_PER_PT / zoomRef.current : 12,
      shares: L.weights.map((w) => w / (L.weights.reduce((a, b) => a + b, 0) || 1)),
    };
    setResizeKind(kind);
    const tbl = (e.currentTarget as HTMLElement).closest('table')?.getBoundingClientRect();
    const handle = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startAt = kind === 'col' ? handle.left + handle.width / 2 : handle.top + handle.height / 2;
    if (tbl) setGuide({ kind, at: startAt, from: kind === 'col' ? tbl.top : tbl.left, to: kind === 'col' ? tbl.bottom : tbl.right });
    const move = (ev: PointerEvent) => {
      const s = resizing.current;
      if (!s) return;
      setGuide((g) => (g ? { ...g, at: startAt + (g.kind === 'col' ? ev.clientX - s.startX : ev.clientY - s.startY) } : g));
      const k = zoomRef.current * PX_PER_PT;
      const dx = (ev.clientX - s.startX) / k;
      const dy = (ev.clientY - s.startY) / k;
      const Lc = layoutRef.current;
      if (s.kind === 'col') {
        const cols = s.widths.length;
        if (s.index >= cols - 1) {
          // the right edge of the table: the table grows or shrinks, its columns keep their shares
          const room = Lc.frame.table.w;
          const next = Math.max(60, Math.min(room, s.widths.reduce((a, b) => a + b, 0) + dx));
          const pct = Math.round((next / room) * 1000) / 10;
          commitResize({ ...s.base, widthPercent: pct >= 99.5 ? undefined : pct, colWeights: s.base.colWeights ?? s.shares }, 'resize-col');
        } else {
          const w = [...s.widths];
          const min = 26;
          const d = Math.max(min - w[s.index], Math.min(dx, w[s.index + 1] - min));
          w[s.index] += d;
          w[s.index + 1] -= d;
          commitResize({ ...s.base, colWeights: weightsFromWidths(w, s.widths.reduce((a, b) => a + b, 0)) }, 'resize-col');
        }
      } else {
        const head = gridRef.current.head;
        const h = Math.max(8, Math.round((s.startH + dy) * 2) / 2);
        if (s.index < head) commitResize({ ...s.base, headerHeight: h }, 'resize-row');
        else {
          const n = gridRef.current.cells.length - head;
          const heights = Array.from({ length: n }, (_, i) => s.base.rowHeights?.[i] ?? null);
          heights[s.index - head] = h;
          commitResize({ ...s.base, rowHeights: heights }, 'resize-row');
        }
      }
    };
    const up = () => {
      resizing.current = null;
      setResizeKind(null);
      setGuide(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }
  const commitResize = (next: PaperTable, key: string) => commit(next, key);

  // ---- the tools ----
  const rangeCells = (): Range => rangeRef.current ?? { r0: 0, c0: 0, r1: 0, c1: 0 };
  const inCell = () => {
    const a = document.activeElement as HTMLElement | null;
    return !!a && a.classList.contains('tp-cell') && a.getAttribute('contenteditable') === 'true';
  };

  // the text chosen in a cell is remembered, so that a tool that takes the focus (a panel of colours) can still work on it
  const savedSelection = useRef<{ cell: HTMLElement; range: globalThis.Range } | null>(null);
  const [, bumpSel] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onSel = () => {
      const sel = window.getSelection();
      const a = document.activeElement as HTMLElement | null;
      if (sel && sel.rangeCount && a && a.classList?.contains('tp-cell') && a.contains(sel.anchorNode)) savedSelection.current = { cell: a, range: sel.getRangeAt(0).cloneRange() };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => bumpSel((n) => n + 1));
    };
    document.addEventListener('selectionchange', onSel);
    return () => {
      document.removeEventListener('selectionchange', onSel);
      cancelAnimationFrame(raf);
    };
  }, []);
  /** Runs `fn` with the caret back in the cell it was in (when a tool took the focus away). */
  const inSavedCell = (fn: () => void): boolean => {
    if (inCell()) {
      fn();
      return true;
    }
    const saved = savedSelection.current;
    if (saved && saved.cell.isConnected && !saved.range.collapsed) {
      saved.cell.focus();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(saved.range);
      fn();
      return true;
    }
    return false;
  };

  const COMMANDS = { b: 'bold', i: 'italic', u: 'underline', sup: 'superscript', sub: 'subscript' } as const;
  const mark = (key: 'b' | 'i' | 'u' | 'sup' | 'sub') => {
    if (isSingle && inSavedCell(() => document.execCommand(COMMANDS[key]))) return;
    const r = rangeCells();
    const g = gridRef.current;
    // on if every cell with text already has it on, else all turned on
    let all = true;
    let any = false;
    for (let y = r.r0; y <= r.r1; y++) for (let x = r.c0; x <= r.c1; x++) {
      const cell = g.cells[y]?.[x];
      if (!cell || cell.covered || !stripMarkup(cell.text)) continue;
      any = true;
      const st = styleAt(cell.text, 0, stripMarkup(cell.text).length);
      if (!st[key]) all = false;
    }
    if (!any) return;
    applyGrid(mapText(g, r, (t) => (stripMarkup(t) ? applyMarkup(t, 0, stripMarkup(t).length, { key, on: !all }) : t)));
  };
  const textColor = (hex: string | null) => {
    if (isSingle && inSavedCell(() => document.execCommand('foreColor', false, hex ?? '#000000'))) return;
    const r = rangeCells();
    applyGrid(mapText(gridRef.current, r, (t) => (stripMarkup(t) ? applyMarkup(t, 0, stripMarkup(t).length, { key: 'color', color: hex }) : t)));
  };
  const fill = (hex: string | null) => applyGrid(patchRange(gridRef.current, rangeCells(), { fill: hex ?? undefined }));
  const align = (a: 'left' | 'center' | 'right') => applyGrid(patchRange(gridRef.current, rangeCells(), { align: a }));
  const valign = (v: 'top' | 'middle' | 'bottom') => {
    const r = rangeCells();
    // in the PDF the cells of a row are aligned together, so the whole row takes it
    applyGrid(patchRange(gridRef.current, { r0: r.r0, r1: r.r1, c0: 0, c1: colsOfGrid(gridRef.current) - 1 }, { valign: v === 'top' ? undefined : v }));
  };
  const [lineColorChoice, setLineColorChoice] = useState<string | null>(null);
  const baseLine = table.borderColor || '#000000';
  const borders = (mode: BorderMode) => applyGrid(applyBorders(gridRef.current, rangeCells(), mode, 'line', lineColorChoice ?? undefined));
  const merge = () => applyGrid(mergeRange(gridRef.current, rangeCells()));
  const unmerge = () => applyGrid(unmergeAt(gridRef.current, rangeCells()));
  const insertRow = (where: 'above' | 'below') => {
    const r = rangeCells();
    const g = gridRef.current;
    const at = where === 'above' ? r.r0 : r.r1 + 1;
    // a row cannot be added between the head and the body "above the head": above the first body row it is a body row
    const next = insertRows(g, at);
    const head = where === 'below' && r.r1 < g.head - 1 ? g.head : where === 'above' && at < g.head ? g.head + 1 : g.head;
    applyGrid({ ...next, head });
  };
  const insertCol = (where: 'left' | 'right') => {
    const r = rangeCells();
    const g = insertCols(gridRef.current, where === 'left' ? r.c0 : r.c1 + 1);
    commit(fromGrid(g, { ...tableRef.current, colWeights: undefined }));
  };
  const delRows = () => {
    const r = rangeCells();
    const g = deleteRows(gridRef.current, r.r0, r.r1);
    if (g === gridRef.current) return;
    commit(fromGrid(g, { ...tableRef.current, rowHeights: undefined }));
    setAnchor(null);
    setFocus(null);
  };
  const delCols = () => {
    const r = rangeCells();
    const g = deleteCols(gridRef.current, r.c0, r.c1);
    if (g === gridRef.current) return;
    commit(fromGrid(g, { ...tableRef.current, colWeights: undefined }));
    setAnchor(null);
    setFocus(null);
  };
  const setHead = (n: number) => {
    const g = gridRef.current;
    if (n < 1 || n >= g.cells.length) return;
    applyGrid(setHeadRows(g, n));
  };
  const cols = colsOfGrid(grid);
  const selectRows = () => {
    const r = rangeCells();
    select({ r: r.r0, c: 0 }, { r: r.r1, c: cols - 1 });
    setMulti(true);
  };
  const selectCols = () => {
    const r = rangeCells();
    select({ r: 0, c: r.c0 }, { r: grid.cells.length - 1, c: r.c1 });
    setMulti(true);
  };
  const selectAll = () => {
    select({ r: 0, c: 0 }, { r: grid.cells.length - 1, c: cols - 1 });
    setMulti(true);
  };
  const distributeCols = () => commit({ ...tableRef.current, colWeights: Array(colsOfGrid(gridRef.current)).fill(1 / colsOfGrid(gridRef.current)) });
  const autoCols = () => commit({ ...tableRef.current, colWeights: undefined });
  const setRowHeight = (pt: number | null, scope: 'selection' | 'all') => {
    const g = gridRef.current;
    const t = tableRef.current;
    const n = g.cells.length - g.head;
    const heights = Array.from({ length: n }, (_, i) => t.rowHeights?.[i] ?? null);
    const r = rangeCells();
    const from = scope === 'all' ? 0 : Math.max(0, r.r0 - g.head);
    const to = scope === 'all' ? n - 1 : r.r1 - g.head;
    for (let i = from; i <= to; i++) if (i >= 0 && i < n) heights[i] = pt;
    const touchesHead = scope === 'all' || r.r0 < g.head;
    commit({ ...t, rowHeights: heights.some((h) => h) ? heights : undefined, ...(touchesHead ? { headerHeight: pt ?? undefined } : {}) });
  };

  const fmt: PaperTableFormat = (() => {
    const base: PaperTableFormat = { b: false, i: false, u: false, sup: false, sub: false };
    if (!range) return base;
    const g = grid;
    const cells: Array<{ text: string; align?: string; fill?: string; row: number }> = [];
    for (let y = range.r0; y <= range.r1; y++) {
      for (let x = range.c0; x <= range.c1; x++) {
        const c = g.cells[y]?.[x];
        if (c && !c.covered) cells.push({ text: c.text, align: c.align ?? (y < g.head ? 'center' : 'left'), fill: c.fill, row: y });
      }
    }
    const same = <T,>(xs: T[]): T | undefined => (xs.length > 0 && xs.every((v) => v === xs[0]) ? xs[0] : undefined);
    const out: PaperTableFormat = { ...base };
    out.align = same(cells.map((c) => c.align)) as PaperTableFormat['align'];
    out.fill = same(cells.map((c) => c.fill));
    // the vertical alignment is the row's (see rowValign): the rows of the range agree or the button shows none
    const rowKinds = Array.from({ length: range.r1 - range.r0 + 1 }, (_, k) => range.r0 + k).map((y) => {
      const cs = g.cells[y]?.filter((c) => !c.covered) ?? [];
      return cs.some((c) => c.valign === 'middle') ? 'middle' : cs.some((c) => c.valign === 'bottom') ? 'bottom' : 'top';
    });
    out.valign = same(rowKinds) as PaperTableFormat['valign'];
    if (inCell() && isSingle) {
      // typing in a cell: what the caret is in
      const q = (c: string) => {
        try {
          return document.queryCommandState(c);
        } catch {
          return false;
        }
      };
      out.b = q('bold');
      out.i = q('italic');
      out.u = q('underline');
      out.sup = q('superscript');
      out.sub = q('subscript');
    } else {
      const withText = cells.filter((c) => stripMarkup(c.text));
      const all = (k: 'b' | 'i' | 'u' | 'sup' | 'sub') => withText.length > 0 && withText.every((c) => styleAt(c.text, 0, stripMarkup(c.text).length)[k]);
      out.b = all('b');
      out.i = all('i');
      out.u = all('u');
      out.sup = all('sup');
      out.sub = all('sub');
      out.color = same(withText.map((c) => styleAt(c.text, 0, stripMarkup(c.text).length).color));
    }
    return out;
  })();
  const tableFont = layout.look.fontPt;
  const sizeOfCells = (() => {
    if (!range) return tableFont;
    const sizes: number[] = [];
    for (let y = range.r0; y <= range.r1; y++) {
      for (let x = range.c0; x <= range.c1; x++) {
        const c = grid.cells[y]?.[x];
        if (c && !c.covered) sizes.push(c.fontSize ?? tableFont);
      }
    }
    return sizes.length > 0 && sizes.every((v) => v === sizes[0]) ? sizes[0] : tableFont;
  })();
  // with cells chosen the size is theirs; with none chosen it is the size of the whole table's text
  const setFontSize = (pt: number | null) => {
    if (!rangeRef.current) {
      if (pt) commit({ ...tableRef.current, fontSize: `${pt}pt` as `${number}pt` }, 'font');
      return;
    }
    applyGrid(patchRange(gridRef.current, rangeCells(), { fontSize: pt && pt !== tableFont ? pt : undefined }));
  };
  const fillLead: BrandColor[] = [
    { label: 'Màu dải tiêu đề', hex: (table.headerFill || theme.tableHeaderColor).toUpperCase() },
    { label: 'Màu nền ô mặc định (hàng xen kẽ)', hex: (table.bodyTint || theme.tableZebraColor).toUpperCase() },
  ];
  const selectionLabel = !range
    ? 'Chọn một ô để bắt đầu'
    : isSingle
      ? `Ô ${range.r0 + 1}:${range.c0 + 1}`
      : `${range.r1 - range.r0 + 1} hàng × ${range.c1 - range.c0 + 1} cột`;
  const origin = range ? grid.cells[range.r0]?.[range.c0] : undefined;
  const canMerge = !!range && !isSingle && !(range.r0 < grid.head && range.r1 >= grid.head);
  const canUnmerge = !!range && grid.cells.slice(range.r0, range.r1 + 1).some((row) => row.slice(range.c0, range.c1 + 1).some((c) => !c.covered && (c.colSpan > 1 || c.rowSpan > 1)));
  void origin;

  const ops: PaperTableOps = {
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    fmt,
    fontSize: sizeOfCells,
    setFontSize,
    fillLead,
    journalId: paper?.metadata.journalId,
    lineColor: lineColorChoice ?? baseLine,
    setLineColor: (hex) => setLineColorChoice(hex),
    mark,
    textColor,
    fill,
    align,
    valign,
    borders,
    merge,
    unmerge,
    canMerge,
    canUnmerge,
    insertRow,
    insertCol,
    deleteRows: delRows,
    deleteCols: delCols,
    head: grid.head,
    setHead,
    selectRows,
    selectCols,
    selectAll,
    distributeCols,
    autoCols,
    setRowHeight,
    widthPercent: table.widthPercent && table.widthPercent > 0 && table.widthPercent < 100 ? table.widthPercent : 100,
    setWidthPercent: (p) => commit({ ...tableRef.current, widthPercent: p >= 100 ? undefined : p }, 'width'),
    tableAlign: table.tableAlign ?? 'center',
    setTableAlign: (a) => commit({ ...tableRef.current, tableAlign: a === 'center' ? undefined : a }),
    zoom,
    setZoom,
    fit,
    selectionLabel,
  };

  // ---- keys ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // a menu or a panel of colours that is open takes the Esc first (and a cell, below)
        if (document.querySelector('[role="menu"], [data-testid="color-panel"]')) return;
        // inside a cell Esc first leaves the cell
        if (document.activeElement && (document.activeElement as HTMLElement).classList?.contains('tp-cell')) return;
        onClose();
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      if (mod) {
        const k = e.key.toLowerCase();
        // (the history of this view, in a cell too: the browser's own would undo the typing but not the table)
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          undo();
        } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          redo();
        } else if (inCell()) {
          return;
        } else if (k === 'a') {
          e.preventDefault();
          selectAll();
        } else if (k === 'b' || k === 'i' || k === 'u') {
          e.preventDefault();
          mark(k);
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && multi && !inCell() && range) {
        e.preventDefault();
        applyGrid(mapText(gridRef.current, range, () => ''));
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, undo, redo, multi, range]);

  // a cell that moved to another sheet while it was being typed in keeps the caret (the sheets are cut again as the rows grow)
  const info = useRef<TablePaperLayoutInfo | null>(null);
  const onLayout = useCallback((i: TablePaperLayoutInfo) => {
    info.current = i;
    bump((n) => n + 1);
  }, []);
  const wasFocused = useRef<Cell | null>(null);
  useLayoutEffect(() => {
    const a = document.activeElement as HTMLElement | null;
    if (a && a.classList?.contains('tp-cell')) {
      const td = a.closest('td');
      if (td?.dataset.r !== undefined) wasFocused.current = { r: Number(td.dataset.r), c: Number(td.dataset.c) };
    } else if (wasFocused.current && (!a || a === document.body) && isSingle && !multi) {
      const f = wasFocused.current;
      wasFocused.current = null;
      requestAnimationFrame(() => focusCell(f.r, f.c));
    }
  });

  // the table set to stand: Esc, the click on the dark ground
  if (!mounted || !ctx) return null;

  const L = info.current;
  const chips: string[] = [];
  if (L) {
    chips.push(L.plan.isRotated ? 'Xoay ngang' : L.plan.mode === 'column-flow' ? '1 cột (chảy qua trang)' : L.plan.spansOneColumn ? '1 cột' : L.plan.wide ? '2 cột · phủ cột bên trái' : '2 cột');
    chips.push(`${L.sheets} trang`);
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="fixed inset-0 z-[9998] flex flex-col text-zinc-900"
      style={{ background: 'rgba(244, 245, 247, 0.74)', backdropFilter: 'blur(22px) saturate(1.1)', WebkitBackdropFilter: 'blur(22px) saturate(1.1)', paddingTop: 'var(--titlebar-height, 38px)' }}
      role="dialog" aria-label="Bảng trên trang giấy" data-testid="table-paper-editor">
      <div className="flex items-center gap-3 px-4 h-12 flex-shrink-0 border-b border-black/10 bg-white/50">
        <div className="min-w-0 flex items-baseline gap-2">
          <h2 className="text-sm font-extrabold tracking-tight whitespace-nowrap">Bảng trên trang giấy</h2>
          {chips.map((c) => (
            <span key={c} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/5 text-zinc-600 whitespace-nowrap">
              {c}
            </span>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <TablePaperToolbar ops={ops} />
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Xong (Esc)"
          aria-label="Đóng"
          data-testid="table-paper-close"
          className="h-8 px-3 rounded-full bg-[#B4E50D] hover:bg-[#c3f016] text-zinc-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
          Xong
        </button>
      </div>

      <div className="flex-1 min-h-0 flex">
        <div
          ref={scroller}
          className={`flex-1 min-w-0 overflow-auto ${multi ? 'tp-dragging' : ''} ${resizeKind === 'col' ? 'tp-resizing-col' : resizeKind === 'row' ? 'tp-resizing-row' : ''}`}
          onPointerDown={(e) => {
            // a click on the dark ground leaves the cell
            if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('tp-stack')) {
              setAnchor(null);
              setFocus(null);
              setMulti(false);
            }
          }}
        >
          {ready && (
          <motion.div
            className="tp-stack flex flex-col items-center gap-8 py-8 min-w-max mx-auto"
            style={{ zoom }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
          >
            <TablePaperPages
              table={table}
              grid={grid}
              theme={theme}
              paperSize={paperSize}
              isOneColumn={isOneColumn}
              lang={lang}
              header={header}
              firstPageNumber={firstPage}
              numberPosition={pageNum ? numberSideOf(pageNum.position) : 'alternating'}
              showNumbers={pageNum?.enabled !== false}
              selection={multi ? range : isSingle ? null : range}
              active={active}
              handlers={handlers}
              onLayout={onLayout}
            />
          </motion.div>
          )}
        </div>

        <aside className="w-[380px] max-w-[42vw] flex-shrink-0 border-l border-black/10 p-3 overflow-hidden hidden md:block" data-testid="table-paper-settings">
          {ready && (
            <motion.div className="h-full" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }}>
              <TableSettingsModal docked table={table} onSave={() => undefined} onClose={onClose} onLive={(next) => commit(next, 'settings')} />
            </motion.div>
          )}
        </aside>
      </div>
      {guide && (
        <i
          aria-hidden
          data-testid="tp-guide"
          className="fixed z-[10001] pointer-events-none"
          style={guide.kind === 'col' ? { left: guide.at - 1, top: guide.from, height: guide.to - guide.from, width: 2, background: '#3b82f6' } : { top: guide.at - 1, left: guide.from, width: guide.to - guide.from, height: 2, background: '#3b82f6' }}
        />
      )}
      {/* the paper's own history (Ctrl+Z / Ctrl+Y) sleeps while a view like this is open: what is undone here is this table */}
      <span data-testid="modal-portal-root" hidden />
    </motion.div>,
    document.body
  );
};
