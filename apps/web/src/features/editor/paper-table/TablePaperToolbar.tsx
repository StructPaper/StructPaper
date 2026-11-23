'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  Bold,
  ChevronDown,
  Columns3,
  Italic,
  Merge,
  PaintBucket,
  Redo2,
  Rows3,
  Split,
  Trash2,
  Underline,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { BorderMode } from '@/lib/table-grid';
import { ColorPanel, Popover, type BrandColor } from '../overview/overview-ui';

/** What the cells chosen are set as now (what a toolbar of a word processor shows as pressed). */
export interface PaperTableFormat {
  b: boolean;
  i: boolean;
  u: boolean;
  sup: boolean;
  sub: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  valign?: 'top' | 'middle' | 'bottom';
  fill?: string;
  color?: string;
}

export interface PaperTableOps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  fmt: PaperTableFormat;
  mark: (key: 'b' | 'i' | 'u' | 'sup' | 'sub') => void;
  /** The size of the text of the cells chosen in points (what the table sets when they have none of their own), and the setter (null: back to the table's). */
  fontSize: number;
  setFontSize: (pt: number | null) => void;
  textColor: (hex: string | null) => void;
  fill: (hex: string | null) => void;
  /** The colours this table's fills start from: the header band and the tinted rows. */
  fillLead: BrandColor[];
  journalId?: string;
  align: (a: 'left' | 'center' | 'right' | 'justify') => void;
  valign: (v: 'top' | 'middle' | 'bottom') => void;
  borders: (mode: BorderMode) => void;
  lineColor: string;
  setLineColor: (hex: string | null) => void;
  merge: () => void;
  unmerge: () => void;
  canMerge: boolean;
  canUnmerge: boolean;
  insertRow: (where: 'above' | 'below') => void;
  insertCol: (where: 'left' | 'right') => void;
  deleteRows: () => void;
  deleteCols: () => void;
  head: number;
  setHead: (n: number) => void;
  selectRows: () => void;
  selectCols: () => void;
  selectAll: () => void;
  distributeCols: () => void;
  autoCols: () => void;
  setRowHeight: (pt: number | null, scope: 'selection' | 'all') => void;
  widthPercent: number;
  setWidthPercent: (p: number) => void;
  tableAlign: 'left' | 'center' | 'right';
  setTableAlign: (a: 'left' | 'center' | 'right') => void;
  zoom: number;
  setZoom: (z: number) => void;
  fit: () => void;
  selectionLabel: string;
}

const noDown = (e: React.MouseEvent) => e.preventDefault();

const BTN = 'h-8 rounded-lg flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed';
const idle = 'text-zinc-600 hover:bg-black/5 hover:text-zinc-900';
const on = 'bg-black/10 text-zinc-900';

const Btn: React.FC<{ title: string; onClick?: () => void; active?: boolean; disabled?: boolean; testId?: string; children: React.ReactNode; wide?: boolean }> = ({
  title,
  onClick,
  active,
  disabled,
  testId,
  children,
  wide,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    aria-pressed={active}
    disabled={disabled}
    data-testid={testId}
    onMouseDown={noDown}
    onClick={onClick}
    className={`${BTN} ${wide ? 'px-2' : 'w-8'} ${active ? on : idle}`}
  >
    {children}
  </button>
);

const Sep = () => <span className="w-px h-5 bg-black/10 mx-1 flex-shrink-0" aria-hidden />;

/** A button that opens a small panel under it (closed by a click outside or Esc). The panel is drawn on the page: the toolbar scrolls sideways and would cut it. */
const Menu: React.FC<{ title: string; label: React.ReactNode; testId?: string; children: (close: () => void) => React.ReactNode; width?: number; active?: boolean }> = ({ title, label, testId, children, width = 232, active }) => {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !panel.current?.contains(t) && !(t as Element).closest?.('[data-testid="color-panel"]')) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [open]);
  return (
    <div ref={box} className="relative flex-shrink-0">
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        data-testid={testId}
        onMouseDown={noDown}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt({ left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)), top: r.bottom + 6 });
          setOpen((v) => !v);
        }}
        className={`${BTN} px-1.5 gap-0.5 ${open || active ? on : idle}`}
      >
        {label}
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            style={{ width, left: at.left, top: at.top, position: 'fixed', zIndex: 10000, maxHeight: 'calc(100vh - 80px)', overflowY: 'auto' }}
            className="rounded-2xl border border-zinc-200 bg-white p-2 shadow-2xl text-zinc-800 text-xs"
            onMouseDown={(e) => {
              // keep the text of the cell selected while a choice is made (but let a field take the focus)
              if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
            }}
          >
            {children(() => setOpen(false))}
          </div>,
          document.body
        )}
    </div>
  );
};

const MenuItem: React.FC<{ onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean; testId?: string }> = ({ onClick, children, danger, disabled, testId }) => (
  <button
    type="button"
    role="menuitem"
    disabled={disabled}
    data-testid={testId}
    onClick={onClick}
    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-2.5 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
      danger ? 'text-red-600 hover:bg-red-50' : 'hover:bg-zinc-100'
    }`}
  >
    {children}
  </button>
);

/** A colour button with the colour in use under its icon; it opens the app's own panel of colours. */
const ColorMenu: React.FC<{
  title: string;
  panelTitle: string;
  icon: React.ReactNode;
  swatch: string;
  value?: string;
  lead?: BrandColor[];
  leadLabel?: string;
  clearLabel: string;
  journalId?: string;
  testId: string;
  onPick: (hex: string | null) => void;
}> = ({ title, panelTitle, icon, swatch, value, lead, leadLabel, clearLabel, journalId, testId, onPick }) => (
  <Popover
    label={null}
    title={title}
    width={300}
    chevron={false}
    testId={testId}
    trigger={(open, toggle) => (
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={open}
        data-testid={testId}
        onMouseDown={noDown}
        onClick={toggle}
        className={`${BTN} w-8 relative ${open ? on : idle}`}
      >
        {icon}
        <span aria-hidden className="absolute left-1.5 right-1.5 bottom-[3px] h-[3px] rounded-full" style={{ background: swatch, boxShadow: '0 0 0 0.5px rgba(0,0,0,.3)' }} />
      </button>
    )}
  >
    {(close) => (
      <ColorPanel
        title={panelTitle}
        value={value ?? null}
        journalId={journalId}
        lead={lead}
        leadLabel={leadLabel}
        clearLabel={clearLabel}
        onPick={(hex) => {
          onPick(hex);
          close();
        }}
      />
    )}
  </Popover>
);

/** The size of the text: a minus, the number, a plus (the size of the table's text when the cells have none of their own). */
const FontSize: React.FC<{ value: number; onChange: (pt: number | null) => void }> = ({ value, onChange }) => {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);
  const clamp = (n: number) => Math.max(5, Math.min(24, Math.round(n * 2) / 2));
  const commit = () => {
    setEditing(false);
    const n = parseFloat(text.replace(',', '.'));
    if (Number.isFinite(n) && n > 0) onChange(clamp(n));
    else setText(String(value));
  };
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0" data-testid="tp-font-size">
      <button type="button" title="Giảm cỡ chữ" aria-label="Giảm cỡ chữ" data-testid="tp-font-minus" onMouseDown={noDown} onClick={() => onChange(clamp(value - 1))} className={`${BTN} w-6 text-base ${idle}`}>
        −
      </button>
      <input
        value={text}
        inputMode="decimal"
        aria-label="Cỡ chữ (pt)"
        title="Cỡ chữ (pt)"
        data-testid="tp-font-input"
        onFocus={(e) => {
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
            (e.currentTarget as HTMLInputElement).blur();
          }
          if (e.key === 'Escape') {
            e.stopPropagation();
            setEditing(false);
            setText(String(value));
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        className="w-9 h-7 rounded-md border border-zinc-300/80 bg-white/60 text-center text-[12px] font-semibold text-zinc-800 outline-none focus:border-[#78C841] focus:bg-white"
      />
      <button type="button" title="Tăng cỡ chữ" aria-label="Tăng cỡ chữ" data-testid="tp-font-plus" onMouseDown={noDown} onClick={() => onChange(clamp(value + 1))} className={`${BTN} w-6 text-base ${idle}`}>
        +
      </button>
    </div>
  );
};

/** The lines a border choice draws, as a little picture of a 3 × 3 grid: the dotted ones are the lines the choice leaves out. */
export const BorderIcon: React.FC<{ mode: BorderMode }> = ({ mode }) => {
  const on = '#18181b';
  const off = '#d4d4d8';
  const inner = mode === 'inner' || mode === 'all';
  const innerH = inner || mode === 'inner-h';
  const innerV = inner || mode === 'inner-v';
  const outer = mode === 'all' || mode === 'outer';
  const edge = (side: 'top' | 'bottom' | 'left' | 'right') => outer || mode === side;
  const stroke = (lit: boolean) => ({ stroke: lit ? on : off, strokeWidth: lit ? 1.6 : 1, strokeDasharray: lit ? undefined : '1.5 1.5' });
  const none = mode === 'none';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="flex-shrink-0">
      <g fill="none" strokeLinecap="square">
        <line x1="6" y1="3" x2="6" y2="15" {...stroke(innerV)} />
        <line x1="12" y1="3" x2="12" y2="15" {...stroke(innerV)} />
        <line x1="3" y1="6" x2="15" y2="6" {...stroke(innerH)} />
        <line x1="3" y1="12" x2="15" y2="12" {...stroke(innerH)} />
        <line x1="3" y1="3" x2="15" y2="3" {...stroke(edge('top'))} />
        <line x1="3" y1="15" x2="15" y2="15" {...stroke(edge('bottom'))} />
        <line x1="3" y1="3" x2="3" y2="15" {...stroke(edge('left'))} />
        <line x1="15" y1="3" x2="15" y2="15" {...stroke(edge('right'))} />
        {none && <line x1="3" y1="15" x2="15" y2="3" stroke="#ef4444" strokeWidth="1.4" />}
        {mode === 'reset' && <path d="M5 9a4 4 0 1 1 1.2 2.8M5 12V9h3" stroke="#16a34a" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />}
      </g>
    </svg>
  );
};

const BORDER_GRID: Array<{ mode: BorderMode; label: string }> = [
  { mode: 'all', label: 'Tất cả viền' },
  { mode: 'inner', label: 'Viền trong' },
  { mode: 'inner-h', label: 'Kẻ ngang bên trong' },
  { mode: 'inner-v', label: 'Kẻ dọc bên trong' },
  { mode: 'outer', label: 'Viền ngoài' },
  { mode: 'top', label: 'Viền trên' },
  { mode: 'bottom', label: 'Viền dưới' },
  { mode: 'left', label: 'Viền trái' },
  { mode: 'right', label: 'Viền phải' },
  { mode: 'none', label: 'Bỏ hết viền (ô chọn)' },
];

export const TablePaperToolbar: React.FC<{ ops: PaperTableOps }> = ({ ops }) => {
  const [rowH, setRowH] = useState('14');
  const f = ops.fmt;
  return (
    <div
      data-testid="table-paper-toolbar"
      className="flex items-center gap-0.5 overflow-x-auto no-scrollbar px-1 min-w-0"
      onMouseDown={(e) => {
        if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
      }}
    >
      <Btn title="Hoàn tác (Ctrl+Z)" onClick={ops.undo} disabled={!ops.canUndo} testId="tp-undo">
        <Undo2 className="w-4 h-4" />
      </Btn>
      <Btn title="Làm lại (Ctrl+Y)" onClick={ops.redo} disabled={!ops.canRedo} testId="tp-redo">
        <Redo2 className="w-4 h-4" />
      </Btn>
      <Sep />
      <FontSize value={ops.fontSize} onChange={ops.setFontSize} />
      <Sep />
      <Btn title="In đậm (Ctrl+B)" onClick={() => ops.mark('b')} active={f.b} testId="tp-bold">
        <Bold className="w-4 h-4" />
      </Btn>
      <Btn title="In nghiêng (Ctrl+I)" onClick={() => ops.mark('i')} active={f.i} testId="tp-italic">
        <Italic className="w-4 h-4" />
      </Btn>
      <Btn title="Gạch chân (Ctrl+U)" onClick={() => ops.mark('u')} active={f.u} testId="tp-underline">
        <Underline className="w-4 h-4" />
      </Btn>
      <Btn title="Chỉ số trên (m², 10⁶)" onClick={() => ops.mark('sup')} active={f.sup} testId="tp-sup">
        <span className="text-[13px] font-bold leading-none">
          x<sup className="text-[8px] -mt-1">2</sup>
        </span>
      </Btn>
      <Btn title="Chỉ số dưới (H₂O, FEV₁)" onClick={() => ops.mark('sub')} active={f.sub} testId="tp-sub">
        <span className="text-[13px] font-bold leading-none">
          x<sub className="text-[8px]">2</sub>
        </span>
      </Btn>
      <ColorMenu
        title="Màu chữ"
        panelTitle="Màu chữ"
        icon={<Baseline className="w-4 h-4" />}
        swatch={f.color ?? '#000000'}
        value={f.color}
        clearLabel="Về màu đen"
        journalId={ops.journalId}
        testId="tp-text-color"
        onPick={ops.textColor}
      />
      <ColorMenu
        title="Màu nền ô"
        panelTitle="Màu nền ô"
        icon={<PaintBucket className="w-4 h-4" />}
        swatch={f.fill ?? 'transparent'}
        value={f.fill}
        lead={ops.fillLead}
        leadLabel="Màu hay dùng cho bảng"
        clearLabel="Bỏ màu nền"
        journalId={ops.journalId}
        testId="tp-fill"
        onPick={ops.fill}
      />
      <Sep />
      <Btn title="Căn trái" onClick={() => ops.align('left')} active={f.align === 'left'} testId="tp-align-left">
        <AlignLeft className="w-4 h-4" />
      </Btn>
      <Btn title="Căn giữa" onClick={() => ops.align('center')} active={f.align === 'center'} testId="tp-align-center">
        <AlignCenter className="w-4 h-4" />
      </Btn>
      <Btn title="Căn phải" onClick={() => ops.align('right')} active={f.align === 'right'} testId="tp-align-right">
        <AlignRight className="w-4 h-4" />
      </Btn>
      <Btn title="Căn đều hai bên" onClick={() => ops.align('justify')} active={f.align === 'justify'} testId="tp-align-justify">
        <AlignJustify className="w-4 h-4" />
      </Btn>
      <Menu
        title="Căn theo chiều dọc của ô (áp cho cả hàng)"
        label={f.valign === 'bottom' ? <AlignVerticalJustifyEnd className="w-4 h-4" /> : f.valign === 'top' ? <AlignVerticalJustifyStart className="w-4 h-4" /> : <AlignVerticalJustifyCenter className="w-4 h-4" />}
        testId="tp-valign"
        width={248}
        active={f.valign === 'middle' || f.valign === 'bottom'}
      >
        {(close) => (
          <>
            <MenuItem onClick={() => { ops.valign('top'); close(); }} testId="tp-valign-top">
              <AlignVerticalJustifyStart className="w-3.5 h-3.5" /> Sát trên {f.valign === 'top' && <b className="ml-auto text-[#14532D]">✓</b>}
            </MenuItem>
            <MenuItem onClick={() => { ops.valign('middle'); close(); }} testId="tp-valign-middle">
              <AlignVerticalJustifyCenter className="w-3.5 h-3.5" /> Ở giữa {f.valign === 'middle' && <b className="ml-auto text-[#14532D]">✓</b>}
            </MenuItem>
            <MenuItem onClick={() => { ops.valign('bottom'); close(); }} testId="tp-valign-bottom">
              <AlignVerticalJustifyEnd className="w-3.5 h-3.5" /> Sát dưới {f.valign === 'bottom' && <b className="ml-auto text-[#14532D]">✓</b>}
            </MenuItem>
            <p className="px-2.5 pt-1.5 text-[10px] leading-snug text-zinc-500">Trong PDF các ô của một hàng được căn dọc cùng nhau, nên lựa chọn này áp cho cả hàng của ô chọn.</p>
          </>
        )}
      </Menu>
      <Menu title="Đường viền và màu đường kẻ" label={<BorderIcon mode="all" />} testId="tp-borders" width={292}>
        {() => (
          <div>
            <div className="flex gap-2">
              <div className="grid grid-cols-5 gap-1">
                {BORDER_GRID.map((it) => (
                  <button
                    key={it.mode}
                    type="button"
                    title={it.label}
                    aria-label={it.label}
                    data-testid={`tp-border-${it.mode}`}
                    onClick={() => ops.borders(it.mode)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer hover:bg-zinc-100 transition-colors"
                  >
                    <BorderIcon mode={it.mode} />
                  </button>
                ))}
              </div>
              <span className="w-px bg-zinc-200" aria-hidden />
              <div className="flex flex-col gap-1 justify-start">
                <Popover
                  label={null}
                  title="Màu đường kẻ"
                  width={300}
                  chevron={false}
                  testId="tp-line-color-pop"
                  align="right"
                  trigger={(open, toggle) => (
                    <button
                      type="button"
                      title="Màu đường kẻ: các đường kẻ vẽ sau đó dùng màu này"
                      aria-label="Màu đường kẻ"
                      data-testid="tp-line-color"
                      onClick={toggle}
                      className={`w-9 h-9 rounded-lg relative flex items-center justify-center cursor-pointer transition-colors ${open ? 'bg-zinc-100' : 'hover:bg-zinc-100'}`}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                        <path d="M3.5 10.5 10.8 3.2a1.4 1.4 0 0 1 2 0l0 0a1.4 1.4 0 0 1 0 2L5.5 12.5 2.8 13z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                      </svg>
                      <span aria-hidden className="absolute left-2 right-2 bottom-1 h-[3px] rounded-full" style={{ background: ops.lineColor, boxShadow: '0 0 0 0.5px rgba(0,0,0,.3)' }} />
                    </button>
                  )}
                >
                  {(closeColor) => (
                    <ColorPanel
                      title="Màu đường kẻ"
                      value={ops.lineColor}
                      journalId={ops.journalId}
                      clearLabel="Về màu đường kẻ của bảng"
                      onPick={(hex) => {
                        ops.setLineColor(hex);
                        closeColor();
                      }}
                    />
                  )}
                </Popover>
                <button
                  type="button"
                  title="Theo kiểu kẻ của bảng (bỏ đường kẻ riêng của các ô chọn)"
                  aria-label="Theo kiểu kẻ của bảng"
                  data-testid="tp-border-reset"
                  onClick={() => ops.borders('reset')}
                  className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer hover:bg-zinc-100 transition-colors"
                >
                  <BorderIcon mode="reset" />
                </button>
              </div>
            </div>
            <p className="px-1 pt-2 text-[10px] leading-snug text-zinc-500">Chọn kiểu viền và màu theo thứ tự nào cũng được, bao nhiêu lần cũng được: bảng này mở cho đến khi bạn bấm ra ngoài. Đường kẻ vẽ ra mang màu đang chọn (gạch dưới biểu tượng bút).</p>
          </div>
        )}
      </Menu>
      <Sep />
      <Btn title="Gộp các ô đã chọn" onClick={ops.merge} disabled={!ops.canMerge} testId="tp-merge">
        <Merge className="w-4 h-4" />
      </Btn>
      <Btn title="Tách ô đã gộp" onClick={ops.unmerge} disabled={!ops.canUnmerge} testId="tp-unmerge">
        <Split className="w-4 h-4" />
      </Btn>
      <Menu title="Hàng và cột" label={<><Rows3 className="w-4 h-4" /><Columns3 className="w-4 h-4" /></>} testId="tp-structure" width={252}>
        {(close) => (
          <>
            <MenuItem onClick={() => { ops.insertRow('above'); close(); }} testId="tp-row-above">Chèn hàng phía trên</MenuItem>
            <MenuItem onClick={() => { ops.insertRow('below'); close(); }} testId="tp-row-below">Chèn hàng phía dưới</MenuItem>
            <MenuItem onClick={() => { ops.insertCol('left'); close(); }} testId="tp-col-left">Chèn cột bên trái</MenuItem>
            <MenuItem onClick={() => { ops.insertCol('right'); close(); }} testId="tp-col-right">Chèn cột bên phải</MenuItem>
            <div className="my-1 border-t border-zinc-200" />
            <MenuItem onClick={() => { ops.deleteRows(); close(); }} danger testId="tp-del-rows"><Trash2 className="w-3.5 h-3.5" /> Xóa hàng đã chọn</MenuItem>
            <MenuItem onClick={() => { ops.deleteCols(); close(); }} danger testId="tp-del-cols"><Trash2 className="w-3.5 h-3.5" /> Xóa cột đã chọn</MenuItem>
            <div className="my-1 border-t border-zinc-200" />
            <div className="flex items-center justify-between px-2.5 py-1">
              <span className="text-[12px] font-medium">Số hàng tiêu đề</span>
              <span className="flex items-center gap-1">
                <button type="button" className="w-6 h-6 rounded-md border border-zinc-300 font-bold cursor-pointer hover:bg-zinc-100" onClick={() => ops.setHead(ops.head - 1)} aria-label="Bớt một hàng tiêu đề">−</button>
                <b data-testid="tp-head-count" className="w-5 text-center">{ops.head}</b>
                <button type="button" className="w-6 h-6 rounded-md border border-zinc-300 font-bold cursor-pointer hover:bg-zinc-100" onClick={() => ops.setHead(ops.head + 1)} aria-label="Thêm một hàng tiêu đề">+</button>
              </span>
            </div>
            <div className="my-1 border-t border-zinc-200" />
            <MenuItem onClick={() => { ops.selectRows(); close(); }}>Chọn cả hàng</MenuItem>
            <MenuItem onClick={() => { ops.selectCols(); close(); }}>Chọn cả cột</MenuItem>
            <MenuItem onClick={() => { ops.selectAll(); close(); }}>Chọn cả bảng</MenuItem>
          </>
        )}
      </Menu>
      <Menu title="Kích thước bảng, cột và hàng" label={<span className="px-0.5">Kích thước</span>} testId="tp-size" width={300}>
        {(close) => (
          <>
            <div className="px-2 pb-2">
              <div className="flex items-center justify-between text-[12px] font-medium mb-1">
                <span>Chiều rộng bảng</span>
                <b data-testid="tp-width-value">{Math.round(ops.widthPercent)}%</b>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={1}
                value={Math.round(ops.widthPercent)}
                onChange={(e) => ops.setWidthPercent(Number(e.target.value))}
                className="w-full accent-[#78C841]"
                aria-label="Chiều rộng bảng"
                data-testid="tp-width"
              />
              <p className="text-[10px] text-zinc-500 leading-snug mt-0.5">Cũng kéo được mép phải của bảng. Bảng hẹp hơn chỗ của nó thì đứng theo vị trí dưới đây.</p>
              <div className="flex items-center gap-1 mt-1.5">
                {(['left', 'center', 'right'] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => ops.setTableAlign(a)}
                    aria-pressed={ops.tableAlign === a}
                    className={`flex-1 h-7 rounded-lg text-[11px] font-semibold cursor-pointer border ${ops.tableAlign === a ? 'bg-[#ECFCCB] border-[#B4E50D] text-[#14532D]' : 'border-zinc-200 hover:bg-zinc-100'}`}
                  >
                    {a === 'left' ? 'Sát trái' : a === 'center' ? 'Ở giữa' : 'Sát phải'}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-zinc-200 pt-1.5">
              <MenuItem onClick={() => { ops.distributeCols(); close(); }} testId="tp-distribute">Chia đều chiều rộng các cột</MenuItem>
              <MenuItem onClick={() => { ops.autoCols(); close(); }} testId="tp-auto-cols">Cột tự chia theo nội dung</MenuItem>
            </div>
            <div className="border-t border-zinc-200 mt-1.5 pt-2 px-2">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-medium">Chiều cao hàng</span>
                <input
                  type="number"
                  min={6}
                  max={200}
                  value={rowH}
                  onChange={(e) => setRowH(e.target.value)}
                  aria-label="Chiều cao hàng (pt)"
                  data-testid="tp-row-height"
                  className="w-16 h-7 rounded-lg border border-zinc-300 px-2 text-[12px]"
                />
                <span className="text-[11px] text-zinc-500">pt</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <button type="button" className="px-2 h-7 rounded-lg border border-zinc-200 text-[11px] font-semibold hover:bg-zinc-100 cursor-pointer" onClick={() => { ops.setRowHeight(Number(rowH) || null, 'selection'); close(); }}>Áp cho hàng chọn</button>
                <button type="button" className="px-2 h-7 rounded-lg border border-zinc-200 text-[11px] font-semibold hover:bg-zinc-100 cursor-pointer" data-testid="tp-row-height-all" onClick={() => { ops.setRowHeight(Number(rowH) || null, 'all'); close(); }}>Áp cho mọi hàng</button>
                <button type="button" className="px-2 h-7 rounded-lg border border-zinc-200 text-[11px] font-semibold hover:bg-zinc-100 cursor-pointer" onClick={() => { ops.setRowHeight(null, 'all'); close(); }}>Tự theo chữ</button>
              </div>
            </div>
          </>
        )}
      </Menu>
      <Sep />
      <Btn title="Thu nhỏ" onClick={() => ops.setZoom(Math.max(0.3, Math.round((ops.zoom - 0.1) * 10) / 10))} testId="tp-zoom-out">
        <ZoomOut className="w-4 h-4" />
      </Btn>
      <button type="button" onMouseDown={noDown} onClick={ops.fit} title="Vừa khít chiều rộng" data-testid="tp-zoom-fit" className={`${BTN} px-1.5 tabular-nums w-12 font-bold ${idle}`}>
        {Math.round(ops.zoom * 100)}%
      </button>
      <Btn title="Phóng to" onClick={() => ops.setZoom(Math.min(2.5, Math.round((ops.zoom + 0.1) * 10) / 10))} testId="tp-zoom-in">
        <ZoomIn className="w-4 h-4" />
      </Btn>
      <span className="ml-2 text-[11px] font-semibold text-zinc-500 whitespace-nowrap" data-testid="tp-selection">{ops.selectionLabel}</span>
    </div>
  );
};
