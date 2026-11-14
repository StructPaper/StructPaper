'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Archive, Code2, Download, FileCheck, FileText, RefreshCw, X } from 'lucide-react';

export interface DockDownloadMenuProps {
  isDownloadOpen: boolean;
  setIsDownloadOpen: (open: boolean) => void;
  setIsStatusOpen: (open: boolean) => void;
  downloadMenuRef: React.RefObject<HTMLDivElement>;
  isTest: boolean;
  springTransition: Record<string, unknown>;
  isExportingDocx: boolean;
  isExportingPdf: boolean;
  isExportingZip: boolean;
  isExportingTypst: boolean;
  isAnyExporting: boolean;
  onDownloadDocx: () => void;
  onDownloadPdf?: () => void;
  onDownloadZip: () => void;
  onDownloadXml?: () => void;
  onDownloadXmlPackage?: () => void;
  isExportingXml?: boolean;
  onDownloadTypst?: () => void;
  compiledPdfUrl: string | null;
}

/** Download pop-up of the left dock (Word / PDF / ZIP / Typst); shares its morph animation id with the trigger. */
export const DockDownloadMenu: React.FC<DockDownloadMenuProps> = ({
  isDownloadOpen,
  setIsDownloadOpen,
  setIsStatusOpen,
  downloadMenuRef,
  isTest,
  springTransition,
  isExportingDocx,
  isExportingPdf,
  isExportingZip,
  isExportingTypst,
  isAnyExporting,
  onDownloadDocx,
  onDownloadPdf,
  onDownloadZip,
  onDownloadXml,
  onDownloadXmlPackage,
  isExportingXml,
  onDownloadTypst,
  compiledPdfUrl,
}) => (
  <div className="w-[52px] h-[52px] relative flex items-center justify-center">
    <AnimatePresence>
      {!isDownloadOpen ? (
        <motion.button
          key="download-trigger-btn"
          layoutId="dock-download-menu"
          id="download-dock-btn"
          data-testid="download-dock-btn"
          type="button"
          onClick={() => {
            setIsStatusOpen(false);
            setIsDownloadOpen(true);
          }}
          initial={isTest ? false : undefined}
          transition={springTransition}
          aria-label={
            isExportingDocx
              ? 'Đang xuất Word...'
              : isExportingPdf
                ? 'Đang xuất PDF...'
                : isExportingZip
                  ? 'Đang nén ZIP...'
                  : 'Tải xuống bản thảo (Word, PDF, ZIP)'
          }
          title={
            isExportingDocx
              ? 'Đang xuất Word...'
              : isExportingPdf
                ? 'Đang xuất PDF...'
                : isExportingZip
                  ? 'Đang nén ZIP...'
                  : 'Tải xuống bản thảo (Word, PDF, ZIP)'
          }
          className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-colors duration-150 select-none cursor-pointer relative bg-white/60 hover:bg-white/90 backdrop-blur-md shadow-[inset_0_0_14px_6px_rgba(255,255,255,0.85),0_0_12px_rgba(0,0,0,0.04),0_0_4px_rgba(0,0,0,0.03)] hover:shadow-[inset_0_0_16px_8px_rgba(255,255,255,0.95),0_0_18px_rgba(0,0,0,0.10),0_0_6px_rgba(0,0,0,0.05)] text-zinc-700 hover:text-zinc-950"
        >
          {isAnyExporting ? (
            <RefreshCw className="w-4 h-4 animate-spin text-zinc-700" strokeWidth={2.8} />
          ) : (
            <Download className="w-4 h-4 text-zinc-700" strokeWidth={2.8} />
          )}
        </motion.button>
      ) : (
        <motion.div
          key="download-popup-menu"
          layoutId="dock-download-menu"
          ref={downloadMenuRef}
          id="download-popup-menu"
          data-testid="download-popup-menu"
          initial={isTest ? false : undefined}
          transition={springTransition}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-[64px] top-0 z-[100] w-64 bg-white/98 backdrop-blur-xl border border-zinc-200/90 rounded-3xl shadow-2xl p-1.5 text-xs text-zinc-800 space-y-0.5 select-none overflow-hidden"
          style={{ transformOrigin: 'top left' }}
        >
          <div className="flex items-center justify-between px-2 py-1 select-none">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Tùy chọn tải xuống
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsDownloadOpen(false);
              }}
              className="w-5 h-5 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-700 cursor-pointer"
              title="Đóng menu"
              aria-label="Đóng menu"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="border-t border-zinc-200/80 my-0.5" />

          {/* 1. Tải Word (.docx) */}
          <button
            id="download-docx-btn"
            type="button"
            onClick={() => {
              setIsDownloadOpen(false);
              onDownloadDocx();
            }}
            disabled={isExportingDocx}
            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-blue-50/70 hover:text-blue-900 flex items-center gap-2 font-medium text-left cursor-pointer transition-colors group"
          >
            <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-800 group-hover:text-blue-950">
                  Tài liệu Word
                </span>
                <span className="text-[10px] px-1.5 py-0.2 bg-blue-50 text-blue-700 font-bold rounded">
                  .docx
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-normal truncate">
                Bản thảo chỉnh sửa Microsoft Word
              </p>
            </div>
            {isExportingDocx && <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0" />}
          </button>

          {/* 2. Tải bản in PDF (.pdf) */}
          <button
            id="download-pdf-btn"
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
            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-50/70 hover:text-rose-900 flex items-center gap-2 font-medium text-left cursor-pointer transition-colors group"
          >
            <FileCheck className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-800 group-hover:text-rose-950">
                  Bản in PDF
                </span>
                <span className="text-[10px] px-1.5 py-0.2 bg-rose-50 text-rose-700 font-bold rounded">
                  .pdf
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-normal truncate">
                PDF XeLaTeX xuất bản chất lượng cao
              </p>
            </div>
            {isExportingPdf && <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600 flex-shrink-0" />}
          </button>

          <div className="border-t border-zinc-200/80 my-0.5" />

          {/* 3. Tải gói nén ZIP (.tex + .bib + ảnh) */}
          <button
            id="download-zip-btn"
            type="button"
            onClick={() => {
              setIsDownloadOpen(false);
              onDownloadZip();
            }}
            disabled={isExportingZip}
            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-indigo-50/70 hover:text-indigo-900 flex items-center gap-2 font-medium text-left cursor-pointer transition-colors group"
          >
            <Archive className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-zinc-800 group-hover:text-indigo-950">
                  Gói nén ZIP
                </span>
                <span className="text-[10px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 font-bold rounded">
                  .zip
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 font-normal truncate">
                Mã nguồn LaTeX (.tex, .bib, hình ảnh)
              </p>
            </div>
            {isExportingZip && <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600 flex-shrink-0" />}
          </button>

          {/* 3b. XML (JATS) và gói XML + hình theo quy ước của hệ thống tạp chí */}
          {onDownloadXml && (
            <button
              id="download-xml-btn"
              data-testid="download-xml"
              type="button"
              onClick={() => {
                setIsDownloadOpen(false);
                onDownloadXml();
              }}
              disabled={isExportingXml}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-amber-50/70 hover:text-amber-900 flex items-center gap-2 font-medium text-left cursor-pointer transition-colors group"
            >
              <Code2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-zinc-800">XML (JATS)</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-700 font-bold rounded">.xml</span>
                </div>
                <p className="text-[10px] text-zinc-500 font-normal truncate">Tên file theo Mã bài, kiểm tra bằng JATS4R</p>
              </div>
              {isExportingXml && <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-600 flex-shrink-0" />}
            </button>
          )}
          {onDownloadXmlPackage && (
            <button
              id="download-xml-package-btn"
              data-testid="download-xml-package"
              type="button"
              onClick={() => {
                setIsDownloadOpen(false);
                onDownloadXmlPackage();
              }}
              disabled={isExportingXml}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-amber-50/70 hover:text-amber-900 flex items-center gap-2 font-medium text-left cursor-pointer transition-colors group"
            >
              <Archive className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-zinc-800">XML + hình</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-700 font-bold rounded">.zip</span>
                </div>
                <p className="text-[10px] text-zinc-500 font-normal truncate">Hình đặt theo v-tập/i-số/a-mã bài</p>
              </div>
            </button>
          )}

          {/* 4. Tải file Typst (.typ) */}
          {onDownloadTypst && (
            <button
              id="download-typst-btn"
              type="button"
              onClick={() => {
                setIsDownloadOpen(false);
                onDownloadTypst();
              }}
              disabled={isExportingTypst}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-emerald-50/70 hover:text-emerald-900 flex items-center gap-2 font-medium text-left cursor-pointer transition-colors group"
            >
              <div className="w-4 h-4 rounded bg-[#78C841] text-white flex items-center justify-center font-bold text-[9px] flex-shrink-0">
                T
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-zinc-800 group-hover:text-emerald-950">
                    Bản thảo Typst
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-700 font-bold rounded">
                    .typ
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 font-normal truncate">
                  Mã nguồn Typst dàn trang hiện đại
                </p>
              </div>
              {isExportingTypst && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#78C841] flex-shrink-0" />}
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
