'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  Baseline,
  Bold,
  ChevronDown,
  Columns3,
  Grid3x3,
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

export interface PaperTableOps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  mark: (key: 'b' | 'i' | 'u') => void;
  textColor: (hex: string | null) => void;
  fill: (hex: string | null) => void;
  align: (a: 'left' | 'center' | 'right') => void;
  valign: (v: 'top' | 'middle' | 'bottom') => void;
  borders: (mode: BorderMode) => void;
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
    className={`h-8 ${wide ? 'px-2' : 'w-8'} rounded-lg flex items-center justify-center gap-1 text-[11px] font-semibold transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
      active ? 'bg-white/25 text-white' : 'text-zinc-200 hover:bg-white/12'
    }`}
  >
    {children}
  </button>
);

const Sep = () => <span className="w-px h-5 bg-white/15 mx-1 flex-shrink-0" aria-hidden />;

/** A button that opens a small panel under it (closed by a click outside or Esc). */
const Menu: React.FC<{ title: string; label: React.ReactNode; testId?: string; children: (close: () => void) => React.ReactNode; width?: number }> = ({ title, label, testId, children, width = 232 }) => {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false);
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
        className={`h-8 px-1.5 rounded-lg flex items-center gap-0.5 text-[11px] font-semibold cursor-pointer transition-colors ${open ? 'bg-white/25 text-white' : 'text-zinc-200 hover:bg-white/12'}`}
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
    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] font-medium flex items-center gap-2 cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
      danger ? 'text-red-600 hover:bg-red-50' : 'hover:bg-zinc-100'
    }`}
  >
    {children}
  </button>
);

const SWATCHES = [
  '#000000', '#434343', '#666666', '#999999', '#CCCCCC', '#FFFFFF', '#E5E5E5', '#E7ECF7',
  '#FF0000', '#FF9900', '#FFE08A', '#00B050', '#2B74B7', '#9900FF', '#FFC7CE', '#CFE8FF',
  '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#CFE2F3', '#D9D2E9', '#EAD1DC', '#F4CCCC',
];

const ColorPanel: React.FC<{ onPick: (hex: string | null) => void; clearLabel: string }> = ({ onPick, clearLabel }) => (
  <div>
    <div className="grid grid-cols-8 gap-1.5">
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          aria-label={c}
          onClick={() => onPick(c)}
          className="w-5 h-5 rounded-md border border-zinc-300 cursor-pointer hover:scale-110 transition-transform"
          style={{ background: c }}
        />
      ))}
    </div>
    <div className="flex items-center justify-between gap-2 mt-2">
      <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 cursor-pointer">
        Màu khác
        <input type="color" className="w-6 h-6 p-0 border-0 bg-transparent cursor-pointer" onChange={(e) => onPick(e.target.value.toUpperCase())} />
      </label>
      <button type="button" onClick={() => onPick(null)} className="text-[11px] font-semibold text-zinc-500 hover:text-zinc-900 cursor-pointer">
        {clearLabel}
      </button>
    </div>
  </div>
);

const BORDER_ITEMS: Array<{ mode: BorderMode; label: string }> = [
  { mode: 'all', label: 'Tất cả viền' },
  { mode: 'outer', label: 'Viền ngoài' },
  { mode: 'inner', label: 'Viền trong' },
  { mode: 'inner-h', label: 'Kẻ ngang bên trong' },
  { mode: 'inner-v', label: 'Kẻ dọc bên trong' },
  { mode: 'top', label: 'Viền trên' },
  { mode: 'bottom', label: 'Viền dưới' },
  { mode: 'left', label: 'Viền trái' },
  { mode: 'right', label: 'Viền phải' },
  { mode: 'none', label: 'Bỏ hết viền (ô chọn)' },
  { mode: 'reset', label: 'Theo kiểu kẻ của bảng' },
];

export const TablePaperToolbar: React.FC<{ ops: PaperTableOps }> = ({ ops }) => {
  const [rowH, setRowH] = useState('14');
  return (
    <div data-testid="table-paper-toolbar" className="flex items-center gap-0.5 overflow-x-auto no-scrollbar px-1 min-w-0" onMouseDown={(e) => {
      if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
    }}>
      <Btn title="Hoàn tác (Ctrl+Z)" onClick={ops.undo} disabled={!ops.canUndo} testId="tp-undo">
        <Undo2 className="w-4 h-4" />
      </Btn>
      <Btn title="Làm lại (Ctrl+Y)" onClick={ops.redo} disabled={!ops.canRedo} testId="tp-redo">
        <Redo2 className="w-4 h-4" />
      </Btn>
      <Sep />
      <Btn title="In đậm (Ctrl+B)" onClick={() => ops.mark('b')} testId="tp-bold">
        <Bold className="w-4 h-4" />
      </Btn>
      <Btn title="In nghiêng (Ctrl+I)" onClick={() => ops.mark('i')} testId="tp-italic">
        <Italic className="w-4 h-4" />
      </Btn>
      <Btn title="Gạch chân (Ctrl+U)" onClick={() => ops.mark('u')} testId="tp-underline">
        <Underline className="w-4 h-4" />
      </Btn>
      <Menu title="Màu chữ" label={<Baseline className="w-4 h-4" />} testId="tp-text-color" width={216}>
        {(close) => <ColorPanel clearLabel="Về màu đen" onPick={(c) => { ops.textColor(c); close(); }} />}
      </Menu>
      <Menu title="Màu nền ô" label={<PaintBucket className="w-4 h-4" />} testId="tp-fill" width={216}>
        {(close) => <ColorPanel clearLabel="Bỏ màu nền" onPick={(c) => { ops.fill(c); close(); }} />}
      </Menu>
      <Sep />
      <Btn title="Căn trái" onClick={() => ops.align('left')} testId="tp-align-left">
        <AlignLeft className="w-4 h-4" />
      </Btn>
      <Btn title="Căn giữa" onClick={() => ops.align('center')} testId="tp-align-center">
        <AlignCenter className="w-4 h-4" />
      </Btn>
      <Btn title="Căn phải" onClick={() => ops.align('right')} testId="tp-align-right">
        <AlignRight className="w-4 h-4" />
      </Btn>
      <Menu title="Căn theo chiều dọc của ô (áp cho cả hàng)" label={<AlignVerticalJustifyCenter className="w-4 h-4" />} testId="tp-valign" width={248}>
        {(close) => (
          <>
            <MenuItem onClick={() => { ops.valign('top'); close(); }} testId="tp-valign-top">
              <AlignVerticalJustifyStart className="w-3.5 h-3.5" /> Sát trên
            </MenuItem>
            <MenuItem onClick={() => { ops.valign('middle'); close(); }} testId="tp-valign-middle">
              <AlignVerticalJustifyCenter className="w-3.5 h-3.5" /> Ở giữa
            </MenuItem>
            <MenuItem onClick={() => { ops.valign('bottom'); close(); }} testId="tp-valign-bottom">
              <AlignVerticalJustifyEnd className="w-3.5 h-3.5" /> Sát dưới
            </MenuItem>
            <p className="px-2.5 pt-1.5 text-[10px] leading-snug text-zinc-500">Trong PDF các ô của một hàng được căn dọc cùng nhau, nên lựa chọn này áp cho cả hàng của ô chọn.</p>
          </>
        )}
      </Menu>
      <Menu title="Đường viền cho các ô đã chọn" label={<Grid3x3 className="w-4 h-4" />} testId="tp-borders" width={232}>
        {(close) =>
          BORDER_ITEMS.map((it) => (
            <MenuItem key={it.mode} testId={`tp-border-${it.mode}`} onClick={() => { ops.borders(it.mode); close(); }}>
              {it.label}
            </MenuItem>
          ))
        }
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
      <button type="button" onMouseDown={noDown} onClick={ops.fit} title="Vừa khít chiều rộng" data-testid="tp-zoom-fit" className="h-8 px-1.5 rounded-lg text-[11px] font-bold text-zinc-200 hover:bg-white/12 cursor-pointer tabular-nums w-12">
        {Math.round(ops.zoom * 100)}%
      </button>
      <Btn title="Phóng to" onClick={() => ops.setZoom(Math.min(2.5, Math.round((ops.zoom + 0.1) * 10) / 10))} testId="tp-zoom-in">
        <ZoomIn className="w-4 h-4" />
      </Btn>
      <span className="ml-2 text-[11px] font-semibold text-zinc-400 whitespace-nowrap" data-testid="tp-selection">{ops.selectionLabel}</span>
    </div>
  );
};
