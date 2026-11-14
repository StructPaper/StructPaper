'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Save,
  CheckCircle2,
  RefreshCw,
  FileText,
  FileCheck,
  Archive,
  Maximize2,
  Sliders,
  ChevronLeft,
  Download,
} from 'lucide-react';
import { CompileStats } from './types';
import { LayoutSettings } from '@/types/paper';

interface EditorTopBarProps {
  onSave: () => void;
  saveSuccess: boolean;
  isDirty?: boolean;
  onOpenSettings?: () => void;
  layoutSettings?: LayoutSettings;
  onRecompile: () => void;
  isCompiling: boolean;
  onDownloadDocx: () => void;
  isExportingDocx: boolean;
  onDownloadZip: () => void;
  isExportingZip: boolean;
  onDownloadPdf?: () => void;
  isExportingPdf?: boolean;
  compiledPdfUrl: string | null;
  compileStats: CompileStats | null;
  journalAbbv?: string;
}

export const EditorTopBar: React.FC<EditorTopBarProps> = ({
  onSave,
  saveSuccess,
  isDirty,
  onOpenSettings,
  layoutSettings,
  onRecompile,
  isCompiling,
  onDownloadDocx,
  isExportingDocx,
  onDownloadZip,
  isExportingZip,
  onDownloadPdf,
  isExportingPdf = false,
  compiledPdfUrl,
  compileStats,
  journalAbbv,
}) => {
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const downloadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDownloadOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (downloadRef.current && !downloadRef.current.contains(e.target as Node)) {
        setIsDownloadOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDownloadOpen(false);
    };
    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDownloadOpen]);

  const isAnyExporting = isExportingDocx || isExportingZip || isExportingPdf;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
      {/* Left: Liquid Glass Back to Home Button with strong 4-sided shadow & text */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/papers"
          className="h-10 px-3.5 rounded-3xl flex items-center gap-2 bg-white/65 hover:bg-white/90 backdrop-blur-md border border-white/80 shadow-[inset_0_0_14px_6px_rgba(255,255,255,0.85),0_4px_20px_rgba(0,0,0,0.05),0_1px_6px_rgba(0,0,0,0.04)] text-zinc-800 hover:text-zinc-950 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer group flex-shrink-0"
          title="Quay lại danh sách bài báo"
          aria-label="Quay lại danh sách bài báo"
        >
          <ChevronLeft className="w-4 h-4 text-zinc-700 group-hover:text-zinc-950 transition-transform duration-200 group-hover:-translate-x-0.5" strokeWidth={3.5} />
          <span className="font-extrabold text-xs text-zinc-800 group-hover:text-zinc-950 tracking-tight">
            Quay lại danh sách bài báo
          </span>
        </Link>
      </div>

      {/* Right: Flat row of action buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* 1. Lưu thay đổi */}
        {saveSuccess && (
          <span className="text-xs text-[#14532D] font-bold bg-[#D9F99D] px-2.5 py-1.5 rounded-full flex items-center gap-1 shadow-2xs animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu!
          </span>
        )}
        <button
          type="button"
          onClick={onSave}
          className={`btn-pill-subtle text-xs py-2 px-3.5 font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs ${isDirty ? 'border-amber-300 bg-amber-50/50 text-amber-900' : ''
            }`}
          title="Lưu các thông tin chỉnh sửa vào bộ nhớ (Ctrl + S)"
        >
          <Save className="w-3.5 h-3.5 text-zinc-700" />
          <span>Lưu thay đổi</span>
        </button>

        {/* Cài đặt bố cục & khổ giấy (Mở Drawer) - Cạnh nút Lưu thay đổi */}
        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            className="btn-pill-subtle text-xs py-2 px-3.5 bg-white border border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300 text-zinc-800 font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all hover:scale-105 active:scale-95"
            title="Cài đặt khổ giấy, số cột (1 cột / 2 cột) và thông số dàn trang"
          >
            <Sliders className="w-3.5 h-3.5 text-zinc-700" />
            <span>Cài đặt</span>
          </button>
        )}

        {/* 2. Biên dịch lại */}
        <button
          type="button"
          onClick={onRecompile}
          disabled={isCompiling}
          className="btn-pill-subtle text-xs py-2 px-3.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-800 font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all disabled:opacity-50"
          title="Biên dịch lại từ mã LaTeX mới nhất"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-zinc-600 ${isCompiling ? 'animate-spin' : ''}`} />
          <span>{isCompiling ? 'Đang dịch...' : 'Biên dịch lại'}</span>
        </button>

        {/* 3. Tải xuống (Popup Word, PDF, ZIP) */}
        <div className="relative" ref={downloadRef}>
          <button
            type="button"
            onClick={() => setIsDownloadOpen((prev) => !prev)}
            className={`btn-pill-subtle text-xs py-2 px-3 border border-zinc-200 hover:bg-zinc-50 font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all ${
              isDownloadOpen ? 'bg-zinc-100 text-zinc-950 border-zinc-300' : 'text-zinc-700 bg-white'
            }`}
            title="Tải xuống bản thảo (Word, PDF, ZIP)"
          >
            {isAnyExporting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-700" />
            ) : (
              <Download className="w-3.5 h-3.5 text-zinc-700" />
            )}
            <span>Tải xuống</span>
          </button>

          {/* Context menu popup */}
          {isDownloadOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white/98 backdrop-blur-xl border border-zinc-200/90 rounded-2xl shadow-2xl p-1.5 text-xs text-zinc-800 space-y-0.5 animate-fadeIn select-none z-50">
              <div className="px-2.5 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider select-none">
                Tùy chọn tải xuống
              </div>

              {/* Word */}
              <button
                type="button"
                onClick={() => {
                  setIsDownloadOpen(false);
                  onDownloadDocx();
                }}
                disabled={isExportingDocx}
                className="w-full px-2.5 py-2 rounded-xl hover:bg-lime-50 hover:text-lime-900 flex items-center gap-2.5 font-semibold text-left cursor-pointer transition-colors group"
              >
                <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-zinc-800 group-hover:text-lime-950">
                      Tài liệu Word
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 font-bold rounded">
                      .docx
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-normal truncate">
                    Bản thảo chỉnh sửa Microsoft Word
                  </p>
                </div>
                {isExportingDocx && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0" />}
              </button>

              {/* PDF */}
              <button
                type="button"
                onClick={() => {
                  setIsDownloadOpen(false);
                  if (onDownloadPdf) {
                    onDownloadPdf();
                  } else if (compiledPdfUrl) {
                    const a = document.createElement('a');
                    a.href = compiledPdfUrl;
                    a.download = 'article.pdf';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                }}
                disabled={isExportingPdf}
                className="w-full px-2.5 py-2 rounded-xl hover:bg-lime-50 hover:text-lime-900 flex items-center gap-2.5 font-semibold text-left cursor-pointer transition-colors group"
              >
                <FileCheck className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-zinc-800 group-hover:text-lime-950">
                      Bản in PDF
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 text-rose-700 font-bold rounded">
                      .pdf
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-normal truncate">
                    PDF XeLaTeX xuất bản chất lượng cao
                  </p>
                </div>
                {isExportingPdf && <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600 flex-shrink-0" />}
              </button>

              <div className="border-t border-zinc-200/80 my-1" />

              {/* ZIP */}
              <button
                type="button"
                onClick={() => {
                  setIsDownloadOpen(false);
                  onDownloadZip();
                }}
                disabled={isExportingZip}
                className="w-full px-2.5 py-2 rounded-xl hover:bg-lime-50 hover:text-lime-900 flex items-center gap-2.5 font-semibold text-left cursor-pointer transition-colors group"
              >
                <Archive className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-zinc-800 group-hover:text-lime-950">
                      Gói nén ZIP
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">
                      .zip
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-normal truncate">
                    Mã nguồn LaTeX (.tex, .bib, hình ảnh)
                  </p>
                </div>
                {isExportingZip && <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 flex-shrink-0" />}
              </button>
            </div>
          )}
        </div>

        {/* 5. Nút phóng to / Mở tab mới */}
        {compiledPdfUrl && (
          <a
            href={compiledPdfUrl}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors flex items-center justify-center border border-zinc-200/60 bg-white"
            title="Mở toàn màn hình trong tab mới"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
};
