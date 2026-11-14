'use client';

import React from 'react';
import {
  Printer,
  FileText,
  Code,
  Globe,
  ZoomIn,
  ZoomOut,
  Layers,
  FileCheck,
  Download,
  Archive,
  Eye,
  Zap,
  RefreshCw,
} from 'lucide-react';

export type PreviewTab = 'latex-pdf' | 'latex-source' | 'pdf-compare' | 'typeset';

interface PreviewToolbarProps {
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
  zoom: number;
  onZoomChange: (zoom: number | ((prev: number) => number)) => void;
  isTwoColumn: boolean;
  onToggleTwoColumn: () => void;
  hasSamplePdf: boolean;
  onPrint: () => void;
  onCompilePdf: () => void;
  isCompilingPdf: boolean;
  onDownloadDocx: () => void;
  onDownloadTex: () => void;
  onDownloadZip: () => void;
  onDownloadHtml: () => void;
  isExportingDocx: boolean;
  isExportingZip: boolean;
}

export const PreviewToolbar: React.FC<PreviewToolbarProps> = ({
  activeTab,
  onTabChange,
  zoom,
  onZoomChange,
  isTwoColumn,
  onToggleTwoColumn,
  hasSamplePdf,
  onPrint,
  onCompilePdf,
  isCompilingPdf,
  onDownloadDocx,
  onDownloadTex,
  onDownloadZip,
  onDownloadHtml,
  isExportingDocx,
  isExportingZip,
}) => {
  return (
    <div className="no-print soft-card p-3.5 bg-white space-y-3 shadow-xs sticky top-[68px] z-30 border border-zinc-200/80">
      {/* Top Row: Primary Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-2.5">
        <div className="segmented-control bg-zinc-100 p-1 rounded-full border border-zinc-200/80 flex flex-wrap gap-1">
          {/* TAB 1: REAL COMPILED LATEX PDF (DEFAULT) */}
          <button
            onClick={() => onTabChange('latex-pdf')}
            className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
              activeTab === 'latex-pdf'
                ? 'bg-white font-bold text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-lime-500 fill-lime-500" />
            <span>1. PDF Biên Dịch Tectonic / XeLaTeX</span>
          </button>

          {/* TAB 2: LATEX SOURCE CODE */}
          <button
            onClick={() => onTabChange('latex-source')}
            className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
              activeTab === 'latex-source'
                ? 'bg-white font-bold text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            }`}
          >
            <Code className="w-3.5 h-3.5 text-zinc-700" />
            <span>2. Mã Nguồn LaTeX (.tex)</span>
          </button>

          {/* TAB 3: REFERENCE ORIGINAL PDF */}
          {hasSamplePdf && (
            <button
              onClick={() => onTabChange('pdf-compare')}
              className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
                activeTab === 'pdf-compare'
                  ? 'bg-white font-bold text-zinc-900 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-zinc-700" />
              <span>3. PDF Mẫu Gốc (13 Trang)</span>
            </button>
          )}

          {/* TAB 4: WEB HTML DRAFT */}
          <button
            onClick={() => onTabChange('typeset')}
            className={`segmented-item text-xs py-1.5 px-3 rounded-full flex items-center gap-1.5 transition-all ${
              activeTab === 'typeset'
                ? 'bg-white font-bold text-zinc-900 shadow-xs'
                : 'text-zinc-400 hover:text-zinc-700'
            }`}
            title="Bản dựng giao diện web HTML để xem nhanh (không qua TeX)"
          >
            <Eye className="w-3.5 h-3.5 text-zinc-400" />
            <span>4. Bản Thảo Web (HTML)</span>
          </button>
        </div>

        {/* Quick Help / Info Pill */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Backend Compiler: Tectonic Engine &amp; Cloud Service</span>
        </div>
      </div>

      {/* Bottom Row: View controls & Export actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left: Zoom & Column Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === 'typeset' && (
            <>
              {/* Zoom controls */}
              <div className="flex items-center bg-zinc-100 p-0.5 rounded-full border border-zinc-200/80">
                <button
                  onClick={() => onZoomChange((z) => Math.max(75, z - 10))}
                  className="p-1 rounded-full hover:bg-white text-zinc-500"
                  title="Thu nhỏ"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-bold px-2 text-zinc-900 min-w-[42px] text-center">
                  {zoom}%
                </span>
                <button
                  onClick={() => onZoomChange((z) => Math.min(130, z + 10))}
                  className="p-1 rounded-full hover:bg-white text-zinc-500"
                  title="Phóng to"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 2-Column / 1-Column switcher */}
              <button
                onClick={onToggleTwoColumn}
                className={`btn-pill-subtle text-xs py-1.5 px-3 ${
                  isTwoColumn ? 'bg-zinc-900 text-white font-bold border-zinc-900' : 'text-zinc-500'
                }`}
                title="Chuyển đổi bố cục 2 cột xuất bản hoặc 1 cột đọc"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{isTwoColumn ? 'Bố cục 2 Cột' : 'Bố cục 1 Cột'}</span>
              </button>
            </>
          )}
        </div>

        {/* Right: Export & Download Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* PRIMARY BUTTON: BACKEND COMPILE */}
          <button
            onClick={onCompilePdf}
            disabled={isCompilingPdf}
            className="btn-pill-lime text-xs py-2 px-4 font-extrabold hover:shadow-md transition-all flex items-center gap-1.5 shadow-xs"
            title="Biên dịch mã LaTeX qua Backend Engine để tải file PDF chuẩn vector 100%"
          >
            {isCompilingPdf ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang biên dịch PDF...</span>
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Tải PDF Tectonic (Vector 100%)</span>
              </>
            )}
          </button>

          {activeTab === 'typeset' && (
            <button
              onClick={onPrint}
              className="btn-pill-subtle text-xs py-1.5 px-3 bg-zinc-50 border-zinc-200 text-zinc-800 hover:bg-zinc-100 font-bold hidden sm:inline-flex"
              title="In trực tiếp trang web xem thử ra A4"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>In Web</span>
            </button>
          )}

          <button
            onClick={onDownloadDocx}
            disabled={isExportingDocx}
            className="btn-pill-subtle text-xs py-1.5 px-3 hover:bg-zinc-50"
            title="Xuất bản bài báo ra Microsoft Word (.docx)"
          >
            <FileText className="w-3.5 h-3.5 text-zinc-600" />
            <span>{isExportingDocx ? 'Đang xuất Word...' : 'Word (.docx)'}</span>
          </button>

          <button
            onClick={onDownloadZip}
            disabled={isExportingZip}
            className="btn-pill-subtle text-xs py-1.5 px-3 bg-[#EEF2FF] border-[#C7D2FE] text-[#3730A3] font-bold hover:bg-[#E0E7FF]"
            title="Tải gói nén ZIP gồm file .tex, .bib và các ảnh bài báo sẵn sàng biên dịch"
          >
            <Archive className="w-3.5 h-3.5 text-[#3730A3]" />
            <span>{isExportingZip ? 'Đang nén...' : 'Gói ZIP (.tex + ảnh)'}</span>
          </button>

          <button
            onClick={onDownloadTex}
            className="btn-pill-subtle text-xs py-1.5 px-3 hover:bg-zinc-50 hidden sm:inline-flex"
            title="Tải mã nguồn LaTeX (.tex)"
          >
            <Code className="w-3.5 h-3.5 text-zinc-600" />
            <span>Tải .tex</span>
          </button>

          <button
            onClick={onDownloadHtml}
            className="btn-pill-subtle text-xs py-1.5 px-3 hover:bg-zinc-50 hidden md:inline-flex"
            title="Tải bản mã HTML tĩnh (.html)"
          >
            <Globe className="w-3.5 h-3.5 text-zinc-600" />
            <span>HTML</span>
          </button>

          {hasSamplePdf && (
            <a
              href="/demo-files/ID630_HS-2026-10-02-07-07.pdf"
              download="ID630_HealthSciences_2026_Sample.pdf"
              className="btn-pill-subtle text-xs py-1.5 px-2.5 text-zinc-600 hover:text-black"
              title="Tải trực tiếp file PDF mẫu gốc (13 trang)"
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
