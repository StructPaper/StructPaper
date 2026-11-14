'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CompletePaper } from '@/lib/sample-papers';
import { exportToLatex, generateLatexPackageZip } from '@/lib/exporters';
import { exportPaperToDocx } from '@/lib/docx-export';
import { extractPaperImagesAsync } from '@/lib/media/figure-image-utils';
import {
  Download,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  FileText,
  Archive,
  Maximize2,
  Terminal,
  Check,
} from 'lucide-react';
import { CompileErrorModal } from './CompileErrorModal';

export interface PublicationPreviewProps {
  paper: CompletePaper;
  engineKind?: 'browser-wasm' | 'server-native' | string;
  compilerEngine?: string;
  compileStats?: {
    durationMs: number;
    sizeKb: number;
    timestamp: string;
    engineKind?: string;
    producedBy?: { kind: string; environmentId?: string };
  } | null;
}

export const PublicationPreview: React.FC<PublicationPreviewProps> = ({
  paper,
  engineKind: propEngineKind,
  compileStats: propCompileStats,
}) => {
  const { metadata } = paper;

  // Initialize with official pre-compiled sample PDF only if on default HS630 paper
  const isDefaultHs630 = paper.id === 'hs630' || metadata.doi?.includes('630');
  const defaultPdf = isDefaultHs630
    ? '/demo-files/ID630_HS-2026-10-02-07-07.pdf'
    : null;

  const [compiledPdfUrl, setCompiledPdfUrl] = useState<string | null>(defaultPdf);
  const [isCompilingPdf, setIsCompilingPdf] = useState<boolean>(false);
  const [isOverlayActive, setIsOverlayActive] = useState<boolean>(false);
  const [justFinished, setJustFinished] = useState<boolean>(false);
  const [engineKindState, setEngineKindState] = useState<string>(
    propEngineKind || propCompileStats?.engineKind || 'server-native'
  );

  const effectiveEngineKind =
    propEngineKind ||
    propCompileStats?.producedBy?.kind ||
    propCompileStats?.engineKind ||
    engineKindState;

  useEffect(() => {
    if (isCompilingPdf) {
      setIsOverlayActive(true);
      setJustFinished(false);
    } else if (isOverlayActive) {
      setJustFinished(true);
      const timer = setTimeout(() => {
        setIsOverlayActive(false);
        setJustFinished(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isCompilingPdf, isOverlayActive]);
  const [compilerEngine, setCompilerEngine] = useState<string>('Java Spring Boot (Tectonic)');
  const [compileStats, setCompileStats] = useState<{
    durationMs: number;
    sizeKb: number;
    timestamp: string;
  } | null>(
    defaultPdf
      ? {
        durationMs: 1845,
        sizeKb: 1447,
        timestamp: 'Sẵn sàng',
      }
      : null
  );
  const [compileErrorInfo, setCompileErrorInfo] = useState<any>(null);
  const [isExportingDocx, setIsExportingDocx] = useState<boolean>(false);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const isCompilingRef = useRef<boolean>(false);

  // Automatically compile LaTeX immediately on entering Step 4 or when paper updates
  useEffect(() => {
    compileLatexToPdf();
  }, [paper.id]);

  const compileLatexToPdf = async () => {
    if (isCompilingRef.current) return;
    isCompilingRef.current = true;

    try {
      setIsCompilingPdf(true);
      setCompileErrorInfo(null);
      const startTime = Date.now();
      const texContent = exportToLatex(paper, paper.layoutSettings);
      const images = await extractPaperImagesAsync(paper);

      const response = await fetch('/api/compile-latex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tex: texContent,
          paperId: paper.id,
          images,
        }),
      });

      const clientDuration = Date.now() - startTime;

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        setCompileErrorInfo({
          error: errData.error || `Biên dịch thất bại (${response.status})`,
          details: errData.details,
          engine: errData.engine || 'Tectonic',
          rawLog: errData.rawLog,
        });
        return;
      }

      const engine = response.headers.get('x-compiler-engine') || 'Java Spring Boot (Tectonic)';
      const serverDuration = response.headers.get('x-compilation-time-ms');
      setCompilerEngine(engine);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setCompiledPdfUrl(url);

      setCompileStats({
        durationMs: serverDuration ? parseInt(serverDuration) : clientDuration,
        sizeKb: Math.round(blob.size / 1024),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });

      setExportNotice('Đã biên dịch PDF XeLaTeX thành công!');
      setTimeout(() => setExportNotice(null), 3500);
    } catch (e: any) {
      setCompileErrorInfo({
        error: 'Lỗi kết nối tới máy chủ biên dịch',
        details: e.message || 'Không thể gửi yêu cầu biên dịch tới backend.',
      });
    } finally {
      setIsCompilingPdf(false);
      isCompilingRef.current = false;
    }
  };

  // Download PDF
  const handleDownloadPdf = () => {
    if (!compiledPdfUrl) return;
    const a = document.createElement('a');
    a.href = compiledPdfUrl;
    a.download = `${metadata.journalId || 'Article'}_${metadata.year || '2026'}_XeLaTeX.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Export DOCX
  const handleDownloadDocx = async () => {
    try {
      setIsExportingDocx(true);
      const blob = await exportPaperToDocx(paper);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${metadata.journalId || 'Paper'}_${metadata.doi?.split('/').pop() || 'Manuscript'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportNotice('Đã xuất file Word (.docx) thành công!');
      setTimeout(() => setExportNotice(null), 3000);
    } catch (e: any) {
      alert('Lỗi xuất DOCX: ' + e.message);
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Export LaTeX ZIP
  const handleDownloadZip = async () => {
    try {
      setIsExportingZip(true);
      const blob = await generateLatexPackageZip(paper);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${metadata.journalId || 'Article'}_LaTeX_Package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setExportNotice('Đã tải gói nén ZIP LaTeX (.tex + .bib + ảnh)!');
      setTimeout(() => setExportNotice(null), 3500);
    } catch (e: any) {
      alert('Lỗi tạo gói ZIP: ' + e.message);
    } finally {
      setIsExportingZip(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-16">
      {/* ================= CONTROLS HEADER BAR ================= */}
      <div className="soft-card p-4 bg-white border border-[#E8E8EE] rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Engine Status */}
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-extrabold text-base text-zinc-900 tracking-tight">
                Dàn Trang & Xuất Bản
              </span>
              {/* Engine Provenance Badge (Section 9.4 Spec) */}
              {effectiveEngineKind === 'browser-wasm' ? (
                <span
                  data-testid="engine-provenance-badge"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-2xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  Bản nháp · Trình duyệt
                </span>
              ) : (
                <span
                  data-testid="engine-provenance-badge"
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Chính thức · Máy chủ
                </span>
              )}
            </div>
          </div>

          {/* Action Buttons: Re-compile & Download Published PDF */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* 1. BUTTON: BIÊN DỊCH LẠI */}
            <button
              onClick={compileLatexToPdf}
              disabled={isCompilingPdf}
              className="btn-pill-subtle text-xs py-2 px-3.5 bg-white border border-zinc-200 hover:bg-zinc-50 text-zinc-900 font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              title="Biên dịch lại từ nội dung bài báo mới nhất"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-zinc-700 ${isCompilingPdf ? 'animate-spin' : ''}`} />
              <span>{isCompilingPdf ? 'Đang biên dịch...' : 'Biên dịch lại'}</span>
            </button>

            {/* 2. BUTTON: TẢI PDF XUẤT BẢN */}
            <button
              onClick={handleDownloadPdf}
              disabled={!compiledPdfUrl || isCompilingPdf}
              className="btn-pill-subtle text-xs py-2 px-4 bg-zinc-900 hover:bg-black text-white font-bold flex items-center gap-1.5 border-none shadow-sm hover:shadow-md cursor-pointer transition-all disabled:opacity-50"
              title="Tải file PDF vector xuất bản chuẩn tòa soạn ĐHQG-HCM"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải PDF Xuất Bản</span>
            </button>

            {/* Secondary actions */}
            <button
              onClick={handleDownloadDocx}
              disabled={isExportingDocx}
              className="btn-pill-subtle text-xs py-2 px-3 text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:bg-zinc-50 hidden sm:flex items-center gap-1.5"
              title="Xuất bản ra Word (.docx)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isExportingDocx ? 'Đang xuất...' : 'Word'}</span>
            </button>

            <button
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              className="btn-pill-subtle text-xs py-2 px-3 text-zinc-700 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200 font-bold hidden md:flex items-center gap-1.5"
              title="Tải trọn gói ZIP LaTeX (.tex + .bib + ảnh)"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{isExportingZip ? 'Đang nén...' : 'Gói ZIP'}</span>
            </button>

            {compiledPdfUrl && (
              <a
                href={compiledPdfUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
                title="Mở toàn màn hình trong tab mới"
              >
                <Maximize2 className="w-4 h-4" />
              </a>
            )}
          </div>
        </div>

        {/* Notice alert */}
        {exportNotice && (
          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{exportNotice}</span>
          </div>
        )}
      </div>

      {/* ================= COMPILATION ERROR CARD ================= */}
      {compileErrorInfo && !isCompilingPdf && (
        <div className="soft-card bg-white border border-red-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold flex-shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-xs text-red-900">
                Lỗi Biên Dịch: {compileErrorInfo.error}
              </h3>
              <p className="text-[11px] text-red-700">
                Trình biên dịch: {compileErrorInfo.engine || 'Tectonic'}
              </p>
            </div>
          </div>

          {compileErrorInfo.details && (
            <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-200 overflow-x-auto max-h-48">
              {compileErrorInfo.details}
            </pre>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={compileLatexToPdf}
              className="btn-pill-subtle text-xs py-1.5 px-3 bg-zinc-100 text-zinc-800 hover:bg-zinc-200 font-bold flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Thử biên dịch lại</span>
            </button>
          </div>
        </div>
      )}

      {/* ================= MAIN EMBEDDED PDF VIEWER ================= */}
      <div className="soft-card bg-white border border-[#E8E8EE] rounded-2xl overflow-hidden shadow-sm p-3 relative">
        {/* Subtle Blur Loading Overlay with Liquid Glass Badge */}
        <div
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center transition-all duration-500 ease-out ${
            isOverlayActive
              ? 'opacity-100 backdrop-blur-[2px] bg-white/20 pointer-events-auto'
              : 'opacity-0 backdrop-blur-none bg-transparent pointer-events-none'
          }`}
        >
          <div className="liquid-glass-pill px-5 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-lg transition-all duration-300">
            {justFinished ? (
              <>
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span className="font-extrabold text-xs text-zinc-900 tracking-tight">
                  Đã hoàn tất biên dịch PDF
                </span>
              </>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#78C841] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#78C841]"></span>
                </span>
                <span className="font-extrabold text-xs text-zinc-900 tracking-tight">
                  Đang biên dịch PDF XeLaTeX...
                </span>
              </>
            )}
          </div>
        </div>

        {/* The PDF Iframe */}
        <div className="w-full h-[900px] border border-gray-200 rounded-xl overflow-hidden bg-gray-100 shadow-inner">
          {compiledPdfUrl ? (
            <iframe
              src={`${compiledPdfUrl}#toolbar=1`}
              className="w-full h-full border-none"
              title="XeLaTeX Compiled PDF"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-2xl bg-zinc-200/80 flex items-center justify-center animate-pulse">
                <span className="w-3 h-3 rounded-full bg-zinc-400 animate-ping" />
              </div>
              <p className="text-sm font-semibold text-gray-600">Đang chuẩn bị bản xem trước PDF...</p>
            </div>
          )}
        </div>
      </div>

      {/* Compile Error Modal (if triggered) */}
      {compileErrorInfo && (
        <CompileErrorModal
          errorInfo={compileErrorInfo}
          onClose={() => setCompileErrorInfo(null)}
          latexCode={exportToLatex(paper)}
        />
      )}
    </div>
  );
};
