'use client';

import React, { useState, useEffect } from 'react';
import { TablePlacementAndBreak } from './TablePlacementAndBreak';
import { resolveBodyFill } from '@/lib/table-fill';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PaperTable } from '@/types/paper';
import {
  X,
  Sliders,
  Check,
  Columns,
  RotateCw,
  RotateCcw,
  Table as TableIcon,
} from 'lucide-react';

interface TableSettingsModalProps {
  layoutId?: string;
  isOpen?: boolean;
  triggerRect?: DOMRect;
  table: PaperTable;
  onSave: (updated: PaperTable) => void;
  onClose: () => void;
}

export const TableSettingsModal: React.FC<TableSettingsModalProps> = ({
  layoutId,
  isOpen = true,
  triggerRect,
  table,
  onSave,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);

  // Initial column span
  const initialSpan = table.columnSpan || (table.isFullWidth === false ? '1-column' : '2-column');

  const [columnSpan, setColumnSpan] = useState<'1-column' | '2-column'>(initialSpan);
  const [isRotated, setIsRotated] = useState<boolean>(!!table.isRotated);
  const [fontSize, setFontSize] = useState<'7pt' | '8pt' | '9pt' | '10pt'>(table.fontSize || '8pt');
  const [rowStretch, setRowStretch] = useState<number>(table.rowStretch || 1.4);
  const [bodyFill, setBodyFill] = useState<'plain' | 'zebra' | 'shaded'>(resolveBodyFill(table));
  const [placement, setPlacement] = useState<'auto' | 'top' | 'here' | 'bottom'>(table.placement || 'auto');
  const [breakAcrossPages, setBreakAcrossPages] = useState<'auto' | 'always' | 'never'>(table.breakAcrossPages || 'auto');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const span = table.columnSpan || (table.isFullWidth === false ? '1-column' : '2-column');
      setColumnSpan(span);
      setIsRotated(!!table.isRotated);
      setFontSize(table.fontSize || '8pt');
      setRowStretch(table.rowStretch || 1.4);
      setBodyFill(resolveBodyFill(table));
      setPlacement(table.placement || 'auto');
      setBreakAcrossPages(table.breakAcrossPages || 'auto');
    }
  }, [isOpen, table]);

  if (!mounted) return null;

  const handleReset = () => {
    setColumnSpan('2-column');
    setIsRotated(false);
    setFontSize('8pt');
    setRowStretch(1.4);
    setBodyFill('plain');
    setPlacement('auto');
  };

  const handleSave = () => {
    const updated: PaperTable = {
      ...table,
      columnSpan,
      isFullWidth: columnSpan === '2-column',
      isRotated,
      fontSize,
      rowStretch,
      bodyFill,
      hasZebraStripes: bodyFill === 'zebra',
      placement,
      breakAcrossPages,
    };
    onSave(updated);
    onClose();
  };

  if (!mounted) return null;

  const modalStyle: React.CSSProperties = triggerRect
    ? {
      position: 'fixed',
      top: Math.max(16, Math.min(triggerRect.top, (typeof window !== 'undefined' ? window.innerHeight : 800) - 560)),
      right: Math.max(16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - triggerRect.right),
    }
    : {
      position: 'fixed',
      top: '12%',
      right: '25%',
    };

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-auto">
      {/* 1. Transparent Backdrop to click outside and close - No dark tint, no blur */}
      <div
        key="table-backdrop"
        className="fixed inset-0 bg-transparent cursor-default"
        onClick={onClose}
      />

      {/* 2. Compact Word-like Contextual Popover Card with Omnidirectional 4-Sided Shadow & Borderless */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        style={modalStyle}
        className="z-10 w-[330px] sm:w-[350px] max-w-[calc(100vw-2rem)] max-h-[min(540px,88vh)] rounded-[22px] border border-gray-50 bg-[#FBFBFC]/70 backdrop-blur-sm shadow-[0_12px_44px_rgba(0,0,0,0.20),0_4px_16px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col text-left select-none pointer-events-auto"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div
            className="px-3.5 py-2.5 bg-gray-200/50 backdrop-blur-sm rounded-b-[18px] flex items-center justify-between flex-shrink-0"
            title="Bảng điều khiển thông số hiển thị bảng dữ liệu"
          >
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-xs text-zinc-900 tracking-tight flex items-center gap-1.5">
                Cài đặt {table.num ? `Bảng ${table.num}` : ''}
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-6 h-6 rounded-lg bg-zinc-200 hover:bg-zinc-300 text-zinc-600 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer"
              title="Đóng bảng cài đặt (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 custom-scrollbar">
            {/* 1. BỐ CỤC SỐ CỘT BẢNG (Compact Micro-Diagram Cards) */}
            <div className="space-y-1.5">
              <label
                className="text-[12px] font-bold text-zinc-600 flex items-center gap-1.5"
                title="Bố cục số cột: Chọn bảng thu gọn 1 cột hoặc trải ngang toàn bộ 2 cột"
              >
                <Columns className="w-3.5 h-3.5 text-zinc-400" />
                Bố cục số cột bảng
              </label>
              <div className="grid grid-cols-2 gap-2">
                {/* Option: 1 Cột */}
                <button
                  type="button"
                  onClick={() => setColumnSpan('1-column')}
                  className={`p-2 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${columnSpan === '1-column'
                    ? 'bg-white border-[#78C841] shadow-2xs ring-2 ring-[#78C841]/25'
                    : 'bg-white/80 hover:bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
                    }`}
                  title="1 Cột: Bảng thu gọn trong 1 cột văn bản (thích hợp bảng ít cột dữ liệu, bảng 2-3 cột)"
                >
                  {columnSpan === '1-column' && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[#78C841] text-white flex items-center justify-center shadow-xs">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                  {/* Compact Diagram 1 column */}
                  <div className="w-full h-8 bg-zinc-50 rounded-lg border border-zinc-150 p-1 flex gap-1 mb-1.5">
                    <div className="w-1/2 h-full bg-[#D9F99D]/80 rounded border border-[#B4E50D]/60 flex flex-col justify-center gap-0.5 p-0.5">
                      <div className="w-full h-1 bg-[#14532D] rounded-xs" />
                      <div className="w-full h-0.5 bg-[#14532D]/60 rounded-xs" />
                      <div className="w-full h-0.5 bg-[#14532D]/40 rounded-xs" />
                    </div>
                    <div className="w-1/2 h-full bg-zinc-200/80 rounded flex flex-col justify-center gap-0.5 px-1">
                      <div className="w-full h-0.5 bg-zinc-400 rounded-full" />
                      <div className="w-3/4 h-0.5 bg-zinc-300 rounded-full" />
                      <div className="w-5/6 h-0.5 bg-zinc-300 rounded-full" />
                    </div>
                  </div>
                  <div className="font-extrabold text-[11px] text-zinc-900 leading-tight">1 Cột</div>
                  <div className="text-[10px] text-zinc-500 leading-snug">Vừa 1 cột văn bản</div>
                </button>

                {/* Option: 2 Cột */}
                <button
                  type="button"
                  onClick={() => setColumnSpan('2-column')}
                  className={`p-2 rounded-xl border text-left transition-all relative flex flex-col justify-between cursor-pointer ${columnSpan === '2-column'
                    ? 'bg-white border-[#78C841] shadow-2xs ring-2 ring-[#78C841]/25'
                    : 'bg-white/80 hover:bg-white border-zinc-200 text-zinc-700 hover:border-zinc-300'
                    }`}
                  title="2 Cột: Bảng trải ngang cả 2 cột của trang tài liệu (thích hợp bảng rộng, nhiều cột dữ liệu)"
                >
                  {columnSpan === '2-column' && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[#78C841] text-white flex items-center justify-center shadow-xs">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                  {/* Compact Diagram 2 columns */}
                  <div className="w-full h-8 bg-zinc-50 rounded-lg border border-zinc-150 p-1 flex flex-col justify-center mb-1.5">
                    <div className="w-full h-full bg-[#D9F99D]/80 rounded border border-[#B4E50D]/60 flex flex-col justify-center gap-0.5 p-0.5">
                      <div className="w-full h-1 bg-[#14532D] rounded-xs" />
                      <div className="w-full h-0.5 bg-[#14532D]/60 rounded-xs" />
                      <div className="w-full h-0.5 bg-[#14532D]/40 rounded-xs" />
                    </div>
                  </div>
                  <div className="font-extrabold text-[11px] text-zinc-900 leading-tight">2 Cột</div>
                  <div className="text-[10px] text-zinc-500 leading-snug">Trải ngang 2 cột</div>
                </button>
              </div>
            </div>

            {/* 2. HƯỚNG HIỂN THỊ / XOAY BẢNG (Segmented Control) */}
            <div className="space-y-1.5">
              <label
                className="text-[12px] font-bold text-zinc-600 flex items-center gap-1.5"
                title="Hướng hiển thị: Xoay bảng 90 độ (Landscape) sang trang ngang nếu bảng có nhiều cột"
              >
                <RotateCw className="w-3.5 h-3.5 text-zinc-400" />
                Hướng hiển thị
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setIsRotated(false)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${!isRotated
                    ? 'bg-white text-zinc-900 shadow-2xs font-extrabold'
                    : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  title="Chiều dọc: Bảng hiển thị thẳng đứng theo chiều dọc tiêu chuẩn của trang"
                >
                  {!isRotated && <Check className="w-3 h-3 text-[#78C841] stroke-[3]" />}
                  <span>Chiều dọc</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRotated(true)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${isRotated
                    ? 'bg-white text-zinc-900 shadow-2xs font-extrabold'
                    : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  title="Xoay ngang 90°: Xoay bảng sang chế độ xoay ngang (Landscape / sidewaystable) giúp chứa được bảng rất nhiều cột"
                >
                  {isRotated && <Check className="w-3 h-3 text-[#78C841] stroke-[3]" />}
                  <span>Xoay ngang 90°</span>
                </button>
              </div>
            </div>

            {/* 3. CỠ CHỮ & ĐỘ GIÃN DÒNG */}
            <div className="grid grid-cols-2 gap-3">
              {/* Cỡ chữ */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className="text-[12px] font-bold text-zinc-600"
                    title="Cỡ chữ bảng: Giảm cỡ chữ để bảng có nhiều cột dữ liệu không bị tràn lề"
                  >
                    Cỡ chữ
                  </label>
                  <span
                    className="text-[10px] font-bold text-[#14532D]"
                    title={`Cỡ chữ hiện tại: ${fontSize}`}
                  >
                    {fontSize}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { sz: '7pt' as const, desc: '7pt - Cỡ chữ rất nhỏ (cho bảng cực kỳ rộng và nhiều cột)' },
                    { sz: '8pt' as const, desc: '8pt - Cỡ chữ nhỏ gọn tiêu chuẩn cho bài báo 2 cột' },
                    { sz: '9pt' as const, desc: '9pt - Cỡ chữ trung bình dễ đọc' },
                    { sz: '10pt' as const, desc: '10pt - Cỡ chữ lớn bằng chữ thân bài' },
                  ].map(({ sz, desc }) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setFontSize(sz)}
                      className={`py-1 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${fontSize === sz
                        ? 'bg-gray-400 text-white shadow-2xs'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      title={desc}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>

              {/* Giãn dòng */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    className="text-[12px] font-bold text-zinc-600"
                    title="Giãn dòng: Khoảng cách đệm giữa các hàng của bảng"
                  >
                    Giãn dòng
                  </label>
                  <span
                    className="text-[10px] font-bold text-[#14532D]"
                    title={`Độ giãn dòng hiện tại: ${rowStretch}x`}
                  >
                    {rowStretch}x
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { st: 1.1, desc: '1.1x - Dày đặc, tiết kiệm diện tích' },
                    { st: 1.4, desc: '1.4x - Tiêu chuẩn, cân đối và thoáng đãng' },
                    { st: 1.6, desc: '1.6x - Rộng rãi, thoải mái cho các ô nhiều dòng' },
                  ].map(({ st, desc }) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setRowStretch(st)}
                      className={`py-1 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${rowStretch === st
                        ? 'bg-gray-400 text-white shadow-2xs'
                        : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                        }`}
                      title={desc}
                    >
                      {st}x
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 4. SỌC ZEBRA & VỊ TRÍ NEO TRANG */}
            <div className="grid grid-cols-2 gap-3">
              <TablePlacementAndBreak
                placement={placement}
                onPlacement={setPlacement}
                breakAcrossPages={breakAcrossPages}
                onBreakAcrossPages={setBreakAcrossPages}
                bodyFill={bodyFill}
                onBodyFill={setBodyFill}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-3.5 py-2.5 bg-white/10 backdrop-blur-sm border-t border-[#EAECEF] flex items-center justify-between gap-2 rounded-b-[20px] flex-shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] py-1 px-1.5 text-zinc-500 hover:text-zinc-800 font-semibold flex items-center gap-1 cursor-pointer"
              title="Khôi phục tất cả cài đặt bảng về giá trị mặc định ban đầu"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Mặc định</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                title="Hủy các thay đổi và đóng bảng cài đặt"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="btn-pill-lime text-[11px] py-1 px-3 font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="Lưu các thông số cài đặt này cho bảng dữ liệu"
              >
                <Check className="w-3 h-3" />
                <span>Lưu</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};
