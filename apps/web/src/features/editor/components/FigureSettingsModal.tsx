'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PaperFigure } from '@/types/paper';
import { IndexedDbAssetRepo, defaultDatabase } from '@structpaper/storage';
import {
  X,
  Sliders,
  Check,
  Columns,
  Maximize2,
  RotateCcw,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image as ImageIcon,
  Database,
} from 'lucide-react';

interface FigureSettingsModalProps {
  layoutId?: string;
  isOpen?: boolean;
  triggerRect?: DOMRect;
  figure: PaperFigure;
  onSave: (updated: PaperFigure) => void;
  onClose: () => void;
}

export const FigureSettingsModal: React.FC<FigureSettingsModalProps> = ({
  layoutId,
  isOpen = true,
  triggerRect,
  figure,
  onSave,
  onClose,
}) => {
  const [mounted, setMounted] = useState(false);

  // Determine initial column span
  const initialSpan = figure.columnSpan || (figure.isFullWidth === false ? '1-column' : '2-column');

  const [columnSpan, setColumnSpan] = useState<'1-column' | '2-column'>(initialSpan);
  const [scalePercent, setScalePercent] = useState<number>(figure.scalePercent || 100);
  const [alignment, setAlignment] = useState<'center' | 'left' | 'right'>(figure.alignment || 'center');
  const [hasBorder, setHasBorder] = useState<boolean>(figure.hasBorder !== false);
  const [placement, setPlacement] = useState<'auto' | 'top' | 'here' | 'bottom'>(figure.placement || 'auto');
  const [assetId, setAssetId] = useState<string>(figure.assetId || '');
  const [assetStatus, setAssetStatus] = useState<'idle' | 'checking' | 'found' | 'not_found'>('idle');
  const [assetMeta, setAssetMeta] = useState<{ size?: number; mime?: string } | null>(null);

  const checkAssetHash = async (hashToCheck: string) => {
    const trimmed = hashToCheck.trim();
    if (!trimmed) {
      setAssetStatus('idle');
      setAssetMeta(null);
      return;
    }
    setAssetStatus('checking');
    try {
      const repo = new IndexedDbAssetRepo(defaultDatabase);
      const blob = await repo.getByHash(trimmed);
      if (blob) {
        setAssetStatus('found');
        setAssetMeta({ size: blob.size, mime: blob.type });
      } else {
        setAssetStatus('not_found');
        setAssetMeta(null);
      }
    } catch {
      setAssetStatus('not_found');
      setAssetMeta(null);
    }
  };

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
      const span = figure.columnSpan || (figure.isFullWidth === false ? '1-column' : '2-column');
      setColumnSpan(span);
      setScalePercent(figure.scalePercent || 100);
      setAlignment(figure.alignment || 'center');
      setHasBorder(figure.hasBorder !== false);
      setPlacement(figure.placement || 'auto');
      const initialAsset = figure.assetId || '';
      setAssetId(initialAsset);
      if (initialAsset) {
        checkAssetHash(initialAsset);
      } else {
        setAssetStatus('idle');
        setAssetMeta(null);
      }
    }
  }, [isOpen, figure]);

  if (!mounted) return null;

  const handleReset = () => {
    setColumnSpan('2-column');
    setScalePercent(100);
    setAlignment('center');
    setHasBorder(true);
    setPlacement('auto');
    setAssetId(figure.assetId || '');
    if (figure.assetId) {
      checkAssetHash(figure.assetId);
    } else {
      setAssetStatus('idle');
      setAssetMeta(null);
    }
  };

  const handleSave = () => {
    const updated: PaperFigure = {
      ...figure,
      columnSpan,
      isFullWidth: columnSpan === '2-column',
      scalePercent,
      alignment,
      hasBorder,
      placement,
      assetId: assetId.trim() || undefined,
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
        key="figure-backdrop"
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
        className="z-10 w-[330px] sm:w-[350px] max-w-[calc(100vw-2rem)] max-h-[min(540px,88vh)] border border-gray-50 rounded-3xl bg-[#FBFBFC]/70 backdrop-blur-sm shadow-[0_12px_44px_rgba(0,0,0,0.20),0_4px_16px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col text-left select-none pointer-events-auto"
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div
            className="px-3.5 py-2.5 bg-gray-200/50 backdrop-blur-md rounded-b-[18px] flex items-center justify-between flex-shrink-0"
            title="Bảng điều khiển thông số hiển thị hình ảnh"
          >
            <div className="flex items-center gap-2">

              <h3 className="font-extrabold text-xs text-zinc-900 tracking-tight flex items-center gap-1.5">
                Cài đặt {figure.num ? `Hình ${figure.num}` : ''}
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
            {/* 1. BỐ CỤC SỐ CỘT (Compact Micro-Diagram Cards) */}
            <div className="space-y-1.5">
              <label
                className="text-[12px] font-bold text-zinc-600 flex items-center gap-1.5"
                title="Bố cục số cột: Chọn ảnh vừa 1 cột hay trải rộng toàn bộ 2 cột"
              >
                <Columns className="w-3.5 h-3.5 text-zinc-400" />
                Bố cục số cột
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
                  title="1 Cột: Thu gọn hình ảnh nằm trọn trong 1 cột văn bản (phù hợp ảnh dọc, biểu đồ đơn lẻ)"
                >
                  {columnSpan === '1-column' && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[#78C841] text-white flex items-center justify-center shadow-xs">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                  {/* Compact Diagram 1 column */}
                  <div className="w-full h-8 bg-zinc-50 rounded-lg border border-zinc-150 p-1 flex gap-1 mb-1.5">
                    <div className="w-1/2 h-full bg-[#D9F99D]/80 rounded border border-[#B4E50D]/60 flex items-center justify-center">
                      <ImageIcon className="w-3 h-3 text-[#14532D]" />
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
                  title="2 Cột: Mở rộng hình ảnh sang cả 2 cột văn bản (phù hợp sơ đồ lớn, ảnh toàn cảnh)"
                >
                  {columnSpan === '2-column' && (
                    <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-[#78C841] text-white flex items-center justify-center shadow-xs">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </div>
                  )}
                  {/* Compact Diagram 2 columns */}
                  <div className="w-full h-8 bg-zinc-50 rounded-lg border border-zinc-150 p-1 flex flex-col justify-center mb-1.5">
                    <div className="w-full h-full bg-[#D9F99D]/80 rounded border border-[#B4E50D]/60 flex items-center justify-center gap-1">
                      <ImageIcon className="w-3 h-3 text-[#14532D]" />
                      <span className="text-[9px] font-bold text-[#14532D]">Toàn trang</span>
                    </div>
                  </div>
                  <div className="font-extrabold text-[11px] text-zinc-900 leading-tight">2 Cột</div>
                  <div className="text-[10px] text-zinc-500 leading-snug">Trải rộng 2 cột</div>
                </button>
              </div>
            </div>

            {/* 2. KÍCH THƯỚC / CHIỀU RỘNG HÌNH */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  className="text-[12px] font-bold text-zinc-600 flex items-center gap-1.5"
                  title="Kích thước ảnh: Tỷ lệ % chiều rộng của hình so với độ rộng cột"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-zinc-400" />
                  Kích thước ảnh
                </label>
                <span
                  className="text-[10px] font-bold text-[#14532D] bg-[#D9F99D] px-2 py-0.5 rounded-full"
                  title={`Độ rộng hiện tại: ${scalePercent}%`}
                >
                  {scalePercent}%
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { pct: 50, desc: 'Thu nhỏ 50% độ rộng cột' },
                  { pct: 70, desc: 'Thu gọn 70% độ rộng cột' },
                  { pct: 85, desc: 'Kích thước tiêu chuẩn 85% độ rộng cột' },
                  { pct: 100, desc: 'Tối đa 100% toàn bộ chiều rộng' },
                ].map(({ pct, desc }) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setScalePercent(pct)}
                    className={`py-1 px-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${scalePercent === pct
                      ? 'bg-gray-400 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                      }`}
                    title={desc}
                  >
                    {pct}%
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="40"
                max="100"
                step="5"
                value={scalePercent}
                onChange={(e) => setScalePercent(parseInt(e.target.value, 10))}
                className="w-full accent-[#78C841] cursor-pointer h-1.5 bg-zinc-200 rounded-lg mt-1"
                title={`Kéo trượt để điều chỉnh kích thước: ${scalePercent}%`}
              />
            </div>

            {/* 3. CĂN LỀ & KHUNG NỀN */}
            <div className="grid grid-cols-2 gap-3">
              {/* Căn lề */}
              <div className="space-y-1.5">
                <label
                  className="text-[12px] font-bold text-zinc-600 block"
                  title="Căn vị trí: Căn chỉnh hình ảnh theo lề trái, giữa hoặc phải"
                >
                  Căn vị trí
                </label>
                <div className="flex bg-zinc-100 p-1 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => setAlignment('left')}
                    className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all cursor-pointer ${alignment === 'left' ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'text-zinc-500'
                      }`}
                    title="Căn lề trái"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlignment('center')}
                    className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all cursor-pointer ${alignment === 'center' ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'text-zinc-500'
                      }`}
                    title="Căn giữa (Khuyên dùng để đạt thẩm mỹ tốt nhất)"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlignment('right')}
                    className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-all cursor-pointer ${alignment === 'right' ? 'bg-white text-zinc-900 shadow-2xs font-bold' : 'text-zinc-500'
                      }`}
                    title="Căn lề phải"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Khung nền mờ */}
              <div className="space-y-1.5">
                <label
                  className="text-[12px] font-bold text-zinc-600 block"
                  title="Khung nền mờ: Viền khung bo góc nhẹ bao quanh ảnh"
                >
                  Khung nền mờ
                </label>
                <button
                  type="button"
                  onClick={() => setHasBorder(!hasBorder)}
                  className={`w-full py-1.5 px-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${hasBorder
                    ? 'bg-[#D9F99D]/40 border-[#B4E50D]/60 text-[#14532D]'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                    }`}
                  title={hasBorder ? 'Đang bật khung viền (bấm để tắt)' : 'Đang tắt khung viền (bấm để bật)'}
                >
                  <span>{hasBorder ? 'Có khung' : 'Không'}</span>
                  {hasBorder && <Check className="w-3 h-3 text-[#78C841] stroke-[3]" />}
                </button>
              </div>
            </div>

            {/* 4. VỊ TRÍ NEO TRANG (FLOAT PLACEMENT) */}
            <div className="space-y-1.5">
              <label
                className="text-[12px] font-bold text-zinc-600 block"
                title="Vị trí neo trang LaTeX: Vị trí ưu tiên đặt hình khi biên dịch file PDF [placement]"
              >
                Vị trí neo trang LaTeX
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { key: 'auto', label: 'Tự động', desc: 'Tự động [!htbp]: LaTeX tự tính toán vị trí đẹp nhất' },
                  { key: 'top', label: 'Đầu trang', desc: 'Đầu trang [t]: Ưu tiên đặt hình ở đầu trang giấy' },
                  { key: 'here', label: 'Tại vị trí', desc: 'Tại vị trí [!h]: Cố gắng đặt hình ngay vị trí văn bản hiện tại' },
                  { key: 'bottom', label: 'Cuối trang', desc: 'Cuối trang [b]: Đặt hình ở dưới cùng của trang giấy' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setPlacement(item.key as any)}
                    className={`py-1.5 px-1 rounded-xl text-center text-xs font-bold transition-all cursor-pointer ${placement === item.key
                      ? 'bg-gray-400 text-white shadow-2xs'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                      }`}
                    title={item.desc}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. LIÊN KẾT ASSET STORAGE (SHA-256) */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-200/60">
              <div className="flex items-center justify-between">
                <label
                  className="text-[12px] font-bold text-zinc-600 flex items-center gap-1.5"
                  title="Liên kết Asset SHA-256 từ kho lưu trữ IndexedDB"
                >
                  <Database className="w-3.5 h-3.5 text-zinc-400" />
                  Asset SHA-256 (Storage)
                </label>
                {assetStatus === 'found' && (
                  <span className="text-[10px] font-bold text-[#14532D] bg-[#D9F99D] px-2 py-0.5 rounded-full">
                    Đã liên kết
                  </span>
                )}
                {assetStatus === 'checking' && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    Kiểm tra...
                  </span>
                )}
                {assetStatus === 'not_found' && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                    Chưa lưu
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="text"
                  value={assetId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAssetId(val);
                    checkAssetHash(val);
                  }}
                  placeholder="SHA-256 asset hash (vd: e3b0c442...)"
                  className="w-full px-2.5 py-1.5 rounded-xl border border-zinc-200 bg-white text-xs font-mono text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#78C841]/50 shadow-2xs"
                />
              </div>

              {assetMeta && (
                <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-2 px-1">
                  <span>MIME: {assetMeta.mime || 'application/octet-stream'}</span>
                  <span>•</span>
                  <span>Dung lượng: {Math.round((assetMeta.size || 0) / 1024)} KB</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-3.5 py-2.5 bg-white/10 backdrop-blur-sm border-t border-[#EAECEF] flex items-center justify-between gap-2 rounded-b-[20px] flex-shrink-0">
            <button
              type="button"
              onClick={handleReset}
              className="text-[11px] py-1 px-1.5 text-zinc-500 hover:text-zinc-800 font-semibold flex items-center gap-1 cursor-pointer"
              title="Khôi phục tất cả cài đặt hình ảnh về giá trị mặc định ban đầu"
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
                title="Lưu các thông số cài đặt này cho hình ảnh"
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
