'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import { PaperSection, PaperFigure } from '@/types/paper';
import {
  hydrateFigureAssetById,
  revokeTrackedObjectUrl,
} from '@/lib/media/blob-image-registry';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import {
  Image as ImageIcon,
  Maximize2,
  Unlink,
  Upload,
  ClipboardPaste,
} from 'lucide-react';

export interface FigureSectionItemProps {
  sec: PaperSection;
  idx: number;
  setFileInputRef: (index: number, el: HTMLInputElement | null) => void;
  onUpdateSection: (index: number, updated: PaperSection) => void;
  onOpenLightbox: (figure: PaperFigure) => void;
  onDetachFigureSource: (index: number) => void;
  onPasteFigureImage: (index: number, e: React.ClipboardEvent) => void;
  onDropFigureImage: (index: number, e: React.DragEvent) => void;
  onFileInputChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onPasteImageFromClipboardButton: (index: number) => void;
  onTriggerFileInput: (index: number) => void;
}

const FigureSectionItemBase: React.FC<FigureSectionItemProps> = ({
  sec,
  idx,
  setFileInputRef,
  onUpdateSection,
  onOpenLightbox,
  onDetachFigureSource,
  onPasteFigureImage,
  onDropFigureImage,
  onFileInputChange,
  onPasteImageFromClipboardButton,
  onTriggerFileInput,
}) => {
  const secRef = useRef(sec);
  secRef.current = sec;
  const idxRef = useRef(idx);
  idxRef.current = idx;
  const onUpdateSectionRef = useRef(onUpdateSection);
  onUpdateSectionRef.current = onUpdateSection;
  const latestSrcRef = useRef(sec.figure?.src);
  latestSrcRef.current = sec.figure?.src;
  const latestAssetIdRef = useRef(sec.figure?.assetId);
  latestAssetIdRef.current = sec.figure?.assetId;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const attemptedHydrationsRef = useRef<Set<string>>(new Set());
  const hydratedUrlsRef = useRef<Set<string>>(new Set());

  const handleImageError = useCallback(async () => {
    const erroredSrc = latestSrcRef.current;
    const targetAssetId = latestAssetIdRef.current;
    if (!erroredSrc?.startsWith('blob:') || !targetAssetId) return;
    if (hydratedUrlsRef.current.has(erroredSrc)) return;

    const attemptKey = `${targetAssetId}:${erroredSrc}`;
    if (attemptedHydrationsRef.current.has(attemptKey)) return;
    attemptedHydrationsRef.current.add(attemptKey);

    const hydratedUrl = await hydrateFigureAssetById(targetAssetId);
    if (!hydratedUrl) return;

    const latestSec = secRef.current;
    if (
      !isMountedRef.current ||
      latestSrcRef.current !== erroredSrc ||
      latestAssetIdRef.current !== targetAssetId ||
      !latestSec.figure
    ) {
      revokeTrackedObjectUrl(hydratedUrl);
      return;
    }

    hydratedUrlsRef.current.add(hydratedUrl);
    onUpdateSectionRef.current(idxRef.current, {
      ...latestSec,
      figure: {
        ...latestSec.figure,
        src: hydratedUrl,
      },
    });
  }, []);

  const handleFileInputRef = useCallback(
    (el: HTMLInputElement | null) => {
      setFileInputRef(idx, el);
    },
    [setFileInputRef, idx]
  );

  if (!sec.figure) return null;

  return (
    <div className="space-y-2.5 p-1.5 rounded-2xl">
      {/* Figure Caption */}
      <div>
        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
          Chú thích hình ảnh (Caption):
        </label>
        <AutoResizeTextarea
          value={sec.figure.caption || ''}
          onChange={(val) =>
            onUpdateSection(idx, {
              ...sec,
              content: val,
              figure: { ...sec.figure!, caption: val },
            })
          }
          placeholder="Hình 1: Biểu đồ kết quả nghiên cứu..."
          className="w-full p-2 rounded-xl text-xs font-bold text-zinc-900 bg-zinc-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300"
        />
      </div>

      {/* Figure Source Note */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
            Nguồn / Ghi chú ảnh (Source):
          </label>
          {sec.figure.source && (
            <button
              type="button"
              onClick={() => onDetachFigureSource(idx)}
              className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-900 underline flex items-center gap-1 cursor-pointer"
              title="Tách nguồn ảnh này thành một đoạn văn riêng bên dưới hình"
            >
              <Unlink className="w-2.5 h-2.5 text-zinc-400" />
              <span>Tách thành đoạn văn riêng</span>
            </button>
          )}
        </div>
        <AutoResizeTextarea
          value={sec.figure.source || ''}
          onChange={(val) =>
            onUpdateSection(idx, {
              ...sec,
              figure: { ...sec.figure!, source: val },
            })
          }
          placeholder="vd: (Nguồn: Nhóm tác giả thực hiện, 2024) hoặc (Source: [12])..."
          className="w-full p-2 rounded-xl text-xs text-zinc-800 italic bg-zinc-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300"
        />
      </div>

      {/* Figure Image Preview with Zoom or Upload Dropzone */}
      <div className="p-1 rounded-xl flex flex-col items-center justify-center gap-2">
        {/* Hidden file input */}
        <input
          type="file"
          ref={handleFileInputRef}
          accept="image/*"
          onChange={(e) => onFileInputChange(idx, e)}
          className="hidden"
        />

        {sec.figure.src ? (
          <div className="relative group/fig max-h-48 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-2xs">
            <img
              src={sec.figure.src}
              alt={sec.figure.caption}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
              className="max-h-44 object-contain mx-auto rounded-lg cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
              onClick={() => onOpenLightbox(sec.figure!)}
            />
            <button
              type="button"
              onClick={() => onOpenLightbox(sec.figure!)}
              className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-900 text-white text-[11px] font-bold flex items-center gap-1.5 backdrop-blur-xs transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95"
              title="Phóng to toàn màn hình để xem chi tiết"
            >
              <Maximize2 className="w-3 h-3 text-zinc-300" />
              <span>Phóng to</span>
            </button>
          </div>
        ) : (
          <div
            tabIndex={0}
            onPaste={(e) => onPasteFigureImage(idx, e)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropFigureImage(idx, e)}
            className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-300 hover:border-amber-400 rounded-2xl bg-zinc-50/50 hover:bg-amber-50/30 transition-all text-center focus:outline-none focus:ring-4 focus:ring-amber-200 group cursor-pointer"
          >
            {/* Eatzy signature empty state squircle icon (compact) */}
            <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-400 mb-2.5 border-2 border-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)] mx-auto relative group-hover:scale-105 transition-transform duration-300">
              <ImageIcon className="w-6 h-6 sm:w-6.5 sm:h-6.5 text-gray-400" strokeWidth={1.8} />
            </div>
            <h4 className="font-extrabold text-xs text-zinc-800 mb-1">
              Chưa có hình ảnh minh họa
            </h4>
            <p className="text-[11px] text-zinc-500 max-w-sm mb-3 leading-relaxed">
              Nhấn{' '}
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-zinc-300 text-zinc-800 font-mono text-[10px] shadow-2xs">
                Ctrl + V
              </kbd>{' '}
              để dán ảnh trực tiếp từ Clipboard, hoặc tải lên từ máy tính.
            </p>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => onTriggerFileInput(idx)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Tải lên từ máy tính</span>
              </button>
              <button
                type="button"
                onClick={() => onPasteImageFromClipboardButton(idx)}
                className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-amber-600" />
                <span>Dán từ Clipboard (Ctrl + V)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const FigureSectionItem = React.memo(FigureSectionItemBase);
FigureSectionItem.displayName = 'FigureSectionItem';
