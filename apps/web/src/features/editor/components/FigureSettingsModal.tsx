'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { PaperFigure } from '@/types/paper';
import { IndexedDbAssetRepo, defaultDatabase } from '@structpaper/storage';
import { Check, Columns, Maximize2, RotateCcw, Image as ImageIcon, Database } from 'lucide-react';
import { POPUP_EDGE, POPUP_TOP } from '@/lib/popup-bounds';
import { SegmentedOptions } from './sections/SegmentedOptions';
import {
  ChoiceCard,
  Field,
  MiniPage,
  SettingsCard,
  SettingsFooter,
  SettingsHeader,
  sectionListClass,
  ToggleRow,
  ValueBadge,
  textInputClass,
} from './settings-ui';

interface FigureSettingsModalProps {
  layoutId?: string;
  isOpen?: boolean;
  triggerRect?: DOMRect;
  figure: PaperFigure;
  onSave: (updated: PaperFigure) => void;
  onClose: () => void;
}

const PLACEMENTS = [
  { value: 'auto' as const, label: 'Tự động', title: 'Tự động [!htbp]: LaTeX tự tính toán vị trí đẹp nhất' },
  { value: 'top' as const, label: 'Đầu trang', title: 'Đầu trang [t]: Ưu tiên đặt hình ở đầu trang giấy' },
  { value: 'here' as const, label: 'Tại vị trí', title: 'Tại vị trí [!h]: Cố gắng đặt hình ngay vị trí văn bản hiện tại' },
  { value: 'bottom' as const, label: 'Cuối trang', title: 'Cuối trang [b]: Đặt hình ở dưới cùng của trang giấy' },
];

const SIZES = [50, 70, 85, 100];

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
  const [appendix, setAppendix] = useState<boolean>(!!figure.appendix);
  const [sideColumn, setSideColumn] = useState<'auto' | 'text' | 'full'>(figure.sideColumn || 'auto');
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
      setAppendix(!!figure.appendix);
      setSideColumn(figure.sideColumn || 'auto');
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
    setSideColumn('auto');
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
      sideColumn,
      appendix: appendix || undefined,
      assetId: assetId.trim() || undefined,
    };
    onSave(updated);
    onClose();
  };

  // never taller than the window, and placed so the whole dialog stays on screen
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const maxH = Math.min(680, viewportH - POPUP_TOP - POPUP_EDGE);
  const modalStyle: React.CSSProperties = triggerRect
    ? {
      position: 'fixed',
      top: Math.max(POPUP_TOP, Math.min(triggerRect.top, viewportH - maxH - POPUP_EDGE)),
      maxHeight: maxH,
      right: Math.max(16, (typeof window !== 'undefined' ? window.innerWidth : 1200) - triggerRect.right),
    }
    : {
      position: 'fixed',
      top: POPUP_TOP,
      maxHeight: maxH,
      right: '25%',
    };

  const title = `Cài đặt ${figure.num ? `Hình ${figure.num}` : 'hình'}`;

  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-hidden pointer-events-auto">
      {/* Transparent backdrop: a click outside closes */}
      <div key="figure-backdrop" className="fixed inset-0 bg-transparent cursor-default" onClick={onClose} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        style={modalStyle}
        role="dialog"
        aria-label={title}
        className="z-10 w-[400px] max-w-[calc(100vw-2rem)] rounded-[28px] border border-white/60 bg-[#F8F9FA] shadow-[0_12px_44px_rgba(0,0,0,0.20),0_4px_16px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col text-left select-none pointer-events-auto"
      >
        <SettingsHeader
          compact
          title={title}
          subtitle="Kích thước, căn lề và vị trí của hình trên PDF"
          onClose={onClose}
          closeTitle="Đóng bảng cài đặt (Esc)"
        />

        <div className={`flex-1 overflow-y-auto px-5 py-3 custom-scrollbar ${sectionListClass}`}>
          {/* 1. Columns and size */}
          <SettingsCard title="Kích thước" hint="Hình vừa một cột hay trải cả trang, và chiếm bao nhiêu chiều rộng." icon={<Columns />}>
            <div role="radiogroup" aria-label="Bố cục số cột" className="grid grid-cols-2 gap-2.5">
              <ChoiceCard
                selected={columnSpan === '1-column'}
                onClick={() => setColumnSpan('1-column')}
                title="1 cột"
                sub="Vừa trong một cột văn bản"
                tooltip="1 Cột: Hình nằm trọn trong 1 cột văn bản (phù hợp ảnh dọc, biểu đồ đơn lẻ)"
              >
                <MiniPage>
                  <span className="flex-1 rounded-md bg-[#D9F99D]/80 border border-[#B4E50D]/60 flex items-center justify-center">
                    <ImageIcon className="w-3.5 h-3.5 text-[#14532D]" />
                  </span>
                  <span className="flex-1 rounded-md bg-zinc-200/70" />
                </MiniPage>
              </ChoiceCard>
              <ChoiceCard
                selected={columnSpan === '2-column'}
                onClick={() => setColumnSpan('2-column')}
                title="2 cột"
                sub="Trải rộng cả trang"
                tooltip="2 Cột: Hình mở rộng sang cả 2 cột văn bản (phù hợp sơ đồ lớn, ảnh toàn cảnh)"
              >
                <MiniPage>
                  <span className="flex-1 rounded-md bg-[#D9F99D]/80 border border-[#B4E50D]/60 flex items-center justify-center">
                    <ImageIcon className="w-3.5 h-3.5 text-[#14532D]" />
                  </span>
                </MiniPage>
              </ChoiceCard>
            </div>

            <Field
              label="Chiều rộng hình"
              title="Tỷ lệ chiều rộng của hình so với độ rộng cột"
              aside={<ValueBadge title={`Độ rộng hiện tại: ${scalePercent}%`}>{scalePercent}%</ValueBadge>}
              hint="Tỷ lệ so với độ rộng cột đã chọn."
            >
              <SegmentedOptions
                ariaLabel="Chiều rộng hình"
                value={SIZES.includes(scalePercent) ? String(scalePercent) : ''}
                onChange={(v) => setScalePercent(Number(v))}
                options={SIZES.map((pct) => ({
                  value: String(pct),
                  label: `${pct}%`,
                  title: pct === 85 ? 'Kích thước tiêu chuẩn 85% độ rộng cột' : `${pct}% độ rộng cột`,
                }))}
              />
              <input
                type="range"
                min="40"
                max="100"
                step="5"
                value={scalePercent}
                onChange={(e) => setScalePercent(parseInt(e.target.value, 10))}
                aria-label="Chiều rộng hình (%)"
                className="w-full accent-[#78C841] cursor-pointer h-1.5 mt-1"
                title={`Kéo để điều chỉnh: ${scalePercent}%`}
              />
            </Field>
          </SettingsCard>

          {/* 2. Alignment and frame */}
          <SettingsCard title="Căn lề và khung" icon={<Maximize2 />}>
            <Field label="Căn vị trí" title="Căn hình theo lề trái, giữa hoặc phải">
              <SegmentedOptions
                ariaLabel="Căn vị trí hình"
                value={alignment}
                onChange={setAlignment}
                options={[
                  { value: 'left', label: 'Trái', title: 'Căn lề trái' },
                  { value: 'center', label: 'Giữa', title: 'Căn giữa (khuyên dùng)' },
                  { value: 'right', label: 'Phải', title: 'Căn lề phải' },
                ]}
              />
            </Field>
            <ToggleRow checked={hasBorder} onChange={setHasBorder} label="Khung viền quanh hình" hint="Viền mảnh bao quanh ảnh khi in." />
          </SettingsCard>

          {/* Appendix and the whole page */}
          <SettingsCard title="Phụ lục và cả trang" hint="Hình phụ lục có số riêng. Hình chiếm cả trang nằm riêng một trang, kể cả chỗ cột mã QR và liên hệ.">
            <ToggleRow checked={appendix} onChange={setAppendix} label="Đây là phụ lục" hint="Chuyển hình này sang thẻ Phụ lục." testId="figure-appendix-toggle" />
            <SegmentedOptions
              ariaLabel="Hình chiếm cột bên"
              value={sideColumn}
              onChange={setSideColumn}
              options={[
                { value: 'auto', label: 'Tự động', title: 'Hình nằm trong cột chữ, hoặc theo trang phụ lục' },
                { value: 'text', label: 'Trong cột chữ', title: 'Luôn giữ hình trong phần chữ, chừa cột mã QR bên trái' },
                { value: 'full', label: 'Cả trang', title: 'Hình nằm riêng một trang, chiếm toàn bộ bề ngang kể cả cột mã QR' },
              ]}
            />
          </SettingsCard>

          {/* 3. Float anchor */}
          <SettingsCard title="Vị trí neo trên trang" hint="Nơi LaTeX ưu tiên đặt hình khi dàn trang.">
            <SegmentedOptions ariaLabel="Vị trí neo trang" value={placement} onChange={setPlacement} options={PLACEMENTS} />
          </SettingsCard>

          {/* 4. Linked file (advanced) */}
          <SettingsCard
            title="Liên kết tệp ảnh"
            hint="Mã SHA-256 của ảnh trong kho lưu trữ (nâng cao, thường để trống)."
            icon={<Database />}
            aside={
              assetStatus === 'found' ? (
                <span className="text-[10.5px] font-bold text-[#14532D] bg-[#D9F99D] px-2 py-0.5 rounded-full">Đã liên kết</span>
              ) : assetStatus === 'checking' ? (
                <span className="text-[10.5px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">Kiểm tra…</span>
              ) : assetStatus === 'not_found' ? (
                <span className="text-[10.5px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">Chưa lưu</span>
              ) : undefined
            }
          >
            <input
              type="text"
              value={assetId}
              onChange={(e) => {
                const val = e.target.value;
                setAssetId(val);
                checkAssetHash(val);
              }}
              placeholder="SHA-256 asset hash (vd: e3b0c442...)"
              aria-label="Mã SHA-256 của ảnh"
              className={`${textInputClass} font-mono`}
            />
            {assetMeta && (
              <div className="text-[10.5px] text-zinc-500 font-mono flex items-center gap-2 px-1">
                <span>MIME: {assetMeta.mime || 'application/octet-stream'}</span>
                <span>•</span>
                <span>Dung lượng: {Math.round((assetMeta.size || 0) / 1024)} KB</span>
              </div>
            )}
          </SettingsCard>
        </div>

        <SettingsFooter
          onReset={handleReset}
          resetTitle="Khôi phục tất cả cài đặt hình về giá trị mặc định"
          resetIcon={<RotateCcw className="w-3.5 h-3.5" />}
          onCancel={onClose}
          cancelTitle="Hủy các thay đổi và đóng"
          primaryLabel="Lưu"
          primaryIcon={<Check className="w-3.5 h-3.5" />}
          primaryTitle="Lưu các thông số cài đặt này cho hình ảnh"
          onPrimary={handleSave}
        />
      </motion.div>
    </div>,
    document.body
  );
};
