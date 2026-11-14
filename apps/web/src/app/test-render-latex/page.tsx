'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  FileCode,
  FileCheck,
  Columns,
  Eye,
  ArrowLeft,
  Download,
  Upload,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Zap,
  Copy,
  ClipboardPaste,
  Trash2,
  Play,
  FileText,
  Sparkles,
  Clock,
  Maximize2,
  Code2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { parseLatexDocument } from '@/lib/latex-parser';
import { CompletePaper } from '@/types/paper';
import { JournalHeader, JournalFirstPageMeta, JournalSectionRenderer, JournalReferences, JournalCitationFooter, CompileErrorModal } from '@/features/preview';

// Sample presets
const PRESET_MINIMAL = `% !TeX program = xelatex
\\documentclass[9pt,twocolumn]{article}
\\usepackage{amsmath,amsfonts,amssymb,graphicx,xcolor,geometry}
\\geometry{left=2cm,right=2cm,top=2cm,bottom=2cm}
\\definecolor{titlecolor}{RGB}{43, 116, 183}

\\title{\\textbf{\\color{titlecolor} Báo Cáo Nghiên Cứu Mẫu Thử Nghiệm}}
\\author{Nguyễn Văn A\\textsuperscript{1,*}, Trần Thị B\\textsuperscript{2}}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
Đây là tài liệu LaTeX mẫu thử nghiệm nhanh với trình biên dịch Tectonic / XeLaTeX. Bạn có thể tự do chỉnh sửa văn bản này, sao chép dán mã mới, hoặc tải file .tex từ máy tính lên để biên dịch ra file PDF hoàn chỉnh.
\\end{abstract}

\\section{Giới thiệu}
Văn bản hỗ trợ đầy đủ tiếng Việt chuẩn Unicode UTF-8. Hệ thống tự động phát hiện font chữ và kích hoạt cơ chế fallback học thuật (Times New Roman, Arial).

\\subsection{Công thức toán học}
Công thức Einstein nổi tiếng:
\\begin{equation}
E = m c^2
\\end{equation}

Tích phân Gauss chuẩn hóa:
\\begin{equation}
\\int_{-\\infty}^{+\\infty} e^{-x^2} dx = \\sqrt{\\pi}
\\end{equation}

\\section{Bảng dữ liệu thực nghiệm}
\\begin{center}
\\begin{tabular}{|c|l|r|}
\\hline
\\textbf{STT} & \\textbf{Tiêu chí} & \\textbf{Kết quả} \\\\
\\hline
1 & Tốc độ biên dịch & $\\sim 1.5$ giây \\\\
2 & Động cơ biên dịch & XeLaTeX / Tectonic \\\\
3 & Định dạng đầu ra & PDF Vector A4 \\\\
\\hline
\\end{tabular}
\\end{center}

\\section{Kết luận}
Hệ thống biên dịch hoạt động ổn định và sẵn sàng cho các bài báo khoa học phức tạp.

\\end{document}
`;

export default function TestRenderLatexPage() {
  const [rawTex, setRawTex] = useState<string>('');
  const [loadedFileName, setLoadedFileName] = useState<string>('ID630_HS-2026-10-02-06-42.tex');
  const [parsedPaper, setParsedPaper] = useState<CompletePaper | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'editor' | 'pdf' | 'split' | 'rendered' | 'logs'>('split');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Compilation state
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [compiledPdfUrl, setCompiledPdfUrl] = useState<string | null>(null);
  const [compileStats, setCompileStats] = useState<{
    engine: string;
    durationMs: number;
    pdfSizeKb: number;
    timestamp: string;
  } | null>(null);
  const [compileErrorInfo, setCompileErrorInfo] = useState<any>(null);
  const [lastRawLog, setLastRawLog] = useState<string>('');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load sample LaTeX file on mount
  useEffect(() => {
    loadSampleLatex();
  }, []);

  const loadSampleLatex = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/demo-files/ID630_HS-2026-10-02-06-42.tex');
      if (!res.ok) throw new Error('Không thể tải file .tex mẫu');
      const text = await res.text();
      setRawTex(text);
      setLoadedFileName('ID630_HS-2026-10-02-06-42.tex');
      try {
        const paper = parseLatexDocument(text);
        setParsedPaper(paper);
      } catch (e) {
        console.warn('Lỗi parse sang cấu trúc DOM:', e);
      }
    } catch (e: any) {
      console.error(e);
      alert('Lỗi tải file LaTeX: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMinimalPreset = () => {
    setRawTex(PRESET_MINIMAL);
    setLoadedFileName('Mau_Ngan_Kiem_Tra_Nhanh.tex');
    try {
      const paper = parseLatexDocument(PRESET_MINIMAL);
      setParsedPaper(paper);
    } catch {}
  };

  const handleClear = () => {
    if (rawTex.trim() && !window.confirm('Bạn có chắc chắn muốn xoá trắng vùng soạn thảo?')) {
      return;
    }
    setRawTex('');
    setLoadedFileName('tep_tin_moi.tex');
    setParsedPaper(null);
    setCompiledPdfUrl(null);
    setCompileStats(null);
    if (textareaRef.current) textareaRef.current.focus();
  };

  // Compile LaTeX through backend
  const handleCompileBackend = async () => {
    if (!rawTex.trim()) {
      alert('Vui lòng dán hoặc nhập mã nguồn LaTeX trước khi biên dịch.');
      return;
    }

    try {
      setIsCompiling(true);
      setCompileErrorInfo(null);
      const startTime = Date.now();

      const res = await fetch('/api/compile-latex', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tex: rawTex }),
      });

      const durationMs = Date.now() - startTime;

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setCompileErrorInfo({
          error: err.error || `Biên dịch thất bại (${res.status})`,
          details: err.details,
          engine: err.engine,
          rawLog: err.rawLog,
        });
        if (err.rawLog) setLastRawLog(err.rawLog);
        return;
      }

      const engine = res.headers.get('x-compiler-engine') || 'XeLaTeX Engine';
      const serverDuration = res.headers.get('x-compilation-time-ms');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setCompiledPdfUrl(url);

      setCompileStats({
        engine,
        durationMs: serverDuration ? parseInt(serverDuration) : durationMs,
        pdfSizeKb: Math.round(blob.size / 1024),
        timestamp: new Date().toLocaleTimeString('vi-VN'),
      });

      // Update parsed structure for web layout if possible
      try {
        const paper = parseLatexDocument(rawTex);
        setParsedPaper(paper);
      } catch {}

      // If user is on editor tab, stay or notify
      if (activeView === 'editor') {
        // keep on editor or switch to split if user wants
      }
    } catch (e: any) {
      console.error(e);
      setCompileErrorInfo({
        error: 'Lỗi kết nối tới máy chủ biên dịch',
        details: e.message || 'Không thể gửi yêu cầu biên dịch tới backend.',
      });
    } finally {
      setIsCompiling(false);
    }
  };

  // Handle file upload
  const processUploadedFile = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (typeof text === 'string') {
        setRawTex(text);
        setLoadedFileName(file.name);
        try {
          const paper = parseLatexDocument(text);
          setParsedPaper(paper);
        } catch {}
      }
    };
    reader.readAsText(file, 'utf-8');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processUploadedFile(file);
    e.target.value = '';
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  // Paste from clipboard
  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawTex(text);
        setLoadedFileName('dan_tu_clipboard.tex');
        try {
          const paper = parseLatexDocument(text);
          setParsedPaper(paper);
        } catch {}
      }
    } catch (err) {
      alert('Vui lòng cấp quyền truy cập Clipboard hoặc dùng phím Ctrl + V để dán.');
    }
  };

  // Copy code to clipboard
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(rawTex);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

  // Download .tex
  const handleDownloadTex = () => {
    const blob = new Blob([rawTex], { type: 'text/x-tex;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = loadedFileName.endsWith('.tex') ? loadedFileName : `${loadedFileName}.tex`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Download compiled PDF
  const handleDownloadPdf = () => {
    if (!compiledPdfUrl) return;
    const a = document.createElement('a');
    a.href = compiledPdfUrl;
    const baseName = loadedFileName.replace(/\.[^/.]+$/, '');
    a.download = `${baseName}_Compiled.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Keyboard shortcut Ctrl+Enter to compile
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleCompileBackend();
    }
  };

  const lineCount = rawTex ? rawTex.split('\n').length : 0;
  const charCount = rawTex.length;

  return (
    <div
      className="min-h-screen bg-[#F3F3F6] text-zinc-900 flex flex-col pb-20"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay indicator */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-[#2B74B7]/20 backdrop-blur-xs border-4 border-dashed border-[#2B74B7] flex flex-col items-center justify-center p-6 pointer-events-none">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-md animate-bounce">
            <Upload className="w-16 h-16 text-[#2B74B7] mb-4" />
            <h3 className="text-xl font-bold text-zinc-900">Thả file .tex vào đây</h3>
            <p className="text-sm text-zinc-500 mt-1">
              Hệ thống sẽ nạp trực tiếp toàn bộ mã nguồn để bạn kiểm tra biên dịch!
            </p>
          </div>
        </div>
      )}

      {/* Header bar */}
      <header className="bg-white/85 backdrop-blur-md border-b border-gray-100/80 sticky top-0 z-40 px-4 sm:px-6 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-1.5 rounded-full hover:bg-gray-100 text-zinc-500 transition-colors"
              title="Quay lại trang chủ"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-[#1A1A1A]">
                  LaTeX Testing & Compilation Studio
                </span>
                <span className="pill-badge bg-[#D9F99D] text-[#14532D] text-[10px] py-0.5 px-2 font-mono flex items-center gap-1">
                  <Zap className="w-3 h-3 text-[#14532D] fill-[#14532D]" />
                  XeLaTeX / Spring Boot
                </span>
              </div>
              <p className="text-xs text-zinc-500 flex items-center gap-2">
                <span>File hiện tại:</span>
                <code className="text-[#78C841] font-bold font-mono bg-[#78C841]/10 px-1.5 py-0.5 rounded-md">
                  {loadedFileName}
                </code>
                <span>•</span>
                <span>{lineCount.toLocaleString()} dòng</span>
                <span>•</span>
                <span>{(charCount / 1024).toFixed(1)} KB</span>
              </p>
            </div>
          </div>

          {/* Quick links & Upload actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/test-render-html"
              className="btn-pill-subtle text-xs py-1.5 px-3 bg-white text-zinc-700 border-gray-200 font-bold hover:bg-gray-50 flex items-center gap-1.5 shadow-2xs"
              title="Chuyển sang trang kiểm tra render mã HTML mẫu"
            >
              <FileCode className="w-3.5 h-3.5 text-zinc-700" />
              <span>Xem Test HTML</span>
            </Link>

            <label className="btn-pill-subtle text-xs py-1.5 px-3 cursor-pointer hover:bg-zinc-50 flex items-center gap-1.5 border border-zinc-200">
              <Upload className="w-3.5 h-3.5 text-[#2B74B7]" />
              <span className="font-semibold">Tải file .tex lên</span>
              <input
                type="file"
                accept=".tex,.txt,.latex"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={handlePasteClipboard}
              className="btn-pill-subtle text-xs py-1.5 px-3 hover:bg-zinc-50 flex items-center gap-1.5 border border-zinc-200"
              title="Dán nhanh văn bản từ clipboard"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-purple-600" />
              <span>Dán Clipboard</span>
            </button>

            <button
              onClick={handleClear}
              className="btn-pill-subtle text-xs py-1.5 px-3 hover:bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5"
              title="Xoá trắng để dán mã mới"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xoá trắng</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Control Toolbar */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-4 pb-2">
        <div className="bg-white soft-card p-3 border border-zinc-200 flex flex-wrap items-center justify-between gap-3 shadow-xs rounded-2xl">
          {/* Preset Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Mẫu thử:</span>
            <button
              onClick={loadSampleLatex}
              className={`text-xs py-1 px-3 rounded-full border transition-all ${
                loadedFileName.includes('ID630')
                  ? 'bg-blue-50 border-[#2B74B7] text-[#2B74B7] font-bold'
                  : 'bg-white border-zinc-200 text-zinc-500 hover:bg-gray-50'
              }`}
            >
              📄 Mẫu ID630 ĐHQG (782 dòng)
            </button>
            <button
              onClick={loadMinimalPreset}
              className={`text-xs py-1 px-3 rounded-full border transition-all ${
                loadedFileName.includes('Ngan')
                  ? 'bg-blue-50 border-[#2B74B7] text-[#2B74B7] font-bold'
                  : 'bg-white border-zinc-200 text-zinc-500 hover:bg-gray-50'
              }`}
            >
              ⚡ Mẫu Nhanh (Minimal Paper)
            </button>
          </div>

          {/* Primary Action Button: Compile */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCompileBackend}
              disabled={isCompiling}
              className="btn-pill-subtle text-xs py-2 px-5 bg-gradient-to-r from-[#2B74B7] to-[#1E5A94] text-white font-bold flex items-center gap-2 border-none shadow-md hover:shadow-lg transition-all cursor-pointer transform active:scale-98"
              title="Nhấn để biên dịch mã LaTeX sang PDF (Phím tắt: Ctrl + Enter)"
            >
              {isCompiling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  <span>Đang biên dịch PDF...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                  <span className="text-sm">⚡ Biên Dịch PDF Ngay</span>
                  <kbd className="hidden sm:inline-block bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-sm font-mono">
                    Ctrl+Enter
                  </kbd>
                </>
              )}
            </button>

            <form
              action="https://www.overleaf.com/docs"
              method="POST"
              target="_blank"
              className="inline-block"
            >
              <input
                type="hidden"
                name="snip"
                value={
                  rawTex.startsWith('% !TeX program')
                    ? rawTex
                    : `% !TeX program = xelatex\n% !TEX TS-program = xelatex\n` + rawTex
                }
              />
              <button
                type="submit"
                className="btn-pill-green text-xs py-2 px-3 font-bold flex items-center gap-1 cursor-pointer border-none shadow-xs hover:shadow-sm"
                title="Mở toàn bộ file .tex này trên Overleaf"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mở Overleaf</span>
              </button>
            </form>
          </div>
        </div>

        {/* View Selection Tabs */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="segmented-control bg-zinc-100 p-1 rounded-full border border-zinc-200 flex flex-wrap gap-1 shadow-2xs">
            <button
              onClick={() => setActiveView('split')}
              className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
                activeView === 'split'
                  ? 'bg-white font-bold text-[#2B74B7] shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              <Columns className="w-3.5 h-3.5 text-[#2B74B7]" />
              <span>1. So Sánh Song Song 1:1 (Split)</span>
            </button>

            <button
              onClick={() => setActiveView('editor')}
              className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
                activeView === 'editor'
                  ? 'bg-white font-bold text-[#2B74B7] shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              <Code2 className="w-3.5 h-3.5 text-[#2B74B7]" />
              <span>2. Trình Soạn Thảo / Dán Mã .tex</span>
            </button>

            <button
              onClick={() => setActiveView('pdf')}
              className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
                activeView === 'pdf'
                  ? 'bg-white font-bold text-[#2B74B7] shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              <FileCheck className="w-3.5 h-3.5 text-[#2B74B7]" />
              <span>3. Bản Xem Trước PDF {compiledPdfUrl ? '(Đã biên dịch)' : ''}</span>
            </button>

            <button
              onClick={() => setActiveView('rendered')}
              className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
                activeView === 'rendered'
                  ? 'bg-white font-bold text-[#2B74B7] shadow-xs'
                  : 'text-zinc-500 hover:text-black'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#2B74B7]" />
              <span>4. Web Dàn Trang (HTML Render)</span>
            </button>

            {lastRawLog && (
              <button
                onClick={() => setActiveView('logs')}
                className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
                  activeView === 'logs'
                    ? 'bg-white font-bold text-[#2B74B7] shadow-xs'
                    : 'text-zinc-500 hover:text-black'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#2B74B7]" />
                <span>5. Log Biên Dịch XeTeX</span>
              </button>
            )}
          </div>

          {/* Compilation Status Banner */}
          {compileStats && (
            <div className="flex items-center gap-2 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-full shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>
                Biên dịch thành công qua <strong>{compileStats.engine}</strong> trong{' '}
                <strong>{compileStats.durationMs}ms</strong> ({compileStats.pdfSizeKb} KB)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex-1 mt-3">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-[#2B74B7]" />
            <p className="text-sm font-semibold">Đang nạp file LaTeX...</p>
          </div>
        ) : (
          <>
            {/* VIEW 1: SPLIT SCREEN (EDITOR LEFT, PDF RIGHT) */}
            {activeView === 'split' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {/* Left: Interactive Code Editor */}
                <div className="soft-card bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex flex-col h-[850px]">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-2">
                    <div className="flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-[#2B74B7]" />
                      <span className="font-bold text-xs text-zinc-900">
                        Mã Nguồn LaTeX (.tex) - Sửa hoặc Dán Trực Tiếp
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyCode}
                        className="text-xs text-zinc-500 hover:text-[#2B74B7] flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                        title="Sao chép toàn bộ mã"
                      >
                        {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{isCopied ? 'Đã chép' : 'Sao chép'}</span>
                      </button>
                      <button
                        onClick={handleDownloadTex}
                        className="text-xs text-zinc-500 hover:text-[#2B74B7] flex items-center gap-1 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
                        title="Tải file .tex về máy"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải .tex</span>
                      </button>
                    </div>
                  </div>

                  {/* Dropzone hint */}
                  <div className="mb-2 bg-[#F8F9FA] border border-dashed border-gray-300 rounded-xl px-3 py-1.5 text-[11px] text-zinc-500 flex items-center justify-between">
                    <span>💡 Bạn có thể dán mã bất kỳ hoặc kéo thả file .tex vào đây</span>
                    <span className="font-mono text-gray-400">Ctrl+Enter để biên dịch</span>
                  </div>

                  {/* Textarea Code Editor */}
                  <div className="flex-1 relative border border-gray-200 rounded-xl overflow-hidden focus-within:border-[#2B74B7] focus-within:ring-2 focus-within:ring-[#2B74B7]/20 transition-all">
                    <textarea
                      ref={textareaRef}
                      value={rawTex}
                      onChange={(e) => setRawTex(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Dán hoặc nhập mã LaTeX (.tex) vào đây..."
                      className="w-full h-full p-3 font-mono text-xs leading-relaxed bg-[#1E1E2E] text-[#CDD6F4] resize-none focus:outline-none selection:bg-[#45475A]"
                      spellCheck={false}
                    />
                  </div>

                  {/* Editor footer */}
                  <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{lineCount.toLocaleString()} dòng • {charCount.toLocaleString()} ký tự</span>
                    <button
                      onClick={handleCompileBackend}
                      disabled={isCompiling}
                      className="font-bold text-[#2B74B7] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Zap className="w-3.5 h-3.5 fill-[#2B74B7]" />
                      <span>{isCompiling ? 'Đang biên dịch...' : 'Biên dịch sang PDF'}</span>
                    </button>
                  </div>
                </div>

                {/* Right: PDF Viewer or Static Fallback */}
                <div className="soft-card bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm flex flex-col h-[850px]">
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-2">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-[#2B74B7]" />
                      <span className="font-bold text-xs text-zinc-900">
                        {compiledPdfUrl
                          ? 'Bản Xem Trước PDF XeLaTeX (Vừa biên dịch)'
                          : 'Bản PDF Gốc (ID630_HS-2026-10-02-07-07.pdf)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {compiledPdfUrl ? (
                        <>
                          <button
                            onClick={handleDownloadPdf}
                            className="btn-pill-subtle text-xs py-1 px-2.5 bg-blue-50 text-[#2B74B7] font-bold flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Tải PDF này</span>
                          </button>
                          <a
                            href={compiledPdfUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1 rounded-md text-gray-500 hover:text-black hover:bg-gray-100"
                            title="Mở toàn màn hình trong tab mới"
                          >
                            <Maximize2 className="w-4 h-4" />
                          </a>
                        </>
                      ) : (
                        <a
                          href="/demo-files/ID630_HS-2026-10-02-07-07.pdf"
                          download="ID630_HS-2026-10-02-07-07.pdf"
                          className="btn-pill-subtle text-xs py-1 px-2.5 bg-gray-50 text-zinc-500 font-bold flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Tải PDF mẫu</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* PDF Viewer Frame */}
                  <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden bg-gray-100 relative">
                    {compiledPdfUrl ? (
                      <iframe
                        src={`${compiledPdfUrl}#toolbar=1`}
                        className="w-full h-full border-none"
                        title="Compiled PDF Preview"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col">
                        <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-center justify-between">
                          <span>Đang hiển thị bản PDF mẫu 13 trang. Bấm &quot;Biên Dịch PDF Ngay&quot; để tạo PDF từ mã bạn chỉnh sửa!</span>
                          <button
                            onClick={handleCompileBackend}
                            disabled={isCompiling}
                            className="text-amber-900 font-bold underline hover:no-underline ml-2"
                          >
                            Biên dịch ngay
                          </button>
                        </div>
                        <iframe
                          src="/demo-files/ID630_HS-2026-10-02-07-07.pdf#toolbar=1"
                          className="w-full flex-1 border-none"
                          title="Reference PDF"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: FULL-SIZE CODE EDITOR */}
            {activeView === 'editor' && (
              <div className="soft-card bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-[#2B74B7]" />
                      <span>Trình Soạn Thảo & Dán Mã Nguồn LaTeX</span>
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Hỗ trợ dán toàn bộ tài liệu LaTeX từ Overleaf hoặc tệp cá nhân. Nhấn Ctrl+Enter để biên dịch.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePasteClipboard}
                      className="btn-pill-subtle text-xs py-1.5 px-3 bg-purple-50 text-purple-700 border-purple-200 font-bold flex items-center gap-1.5"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      <span>Dán từ Clipboard</span>
                    </button>
                    <button
                      onClick={handleCopyCode}
                      className="btn-pill-subtle text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Đã sao chép' : 'Sao chép mã'}</span>
                    </button>
                    <button
                      onClick={handleCompileBackend}
                      disabled={isCompiling}
                      className="btn-pill-subtle text-xs py-1.5 px-4 bg-[#2B74B7] text-white font-bold flex items-center gap-1.5 border-none shadow-xs hover:bg-[#1E5A94]"
                    >
                      <Zap className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300" />
                      <span>Biên dịch PDF</span>
                    </button>
                  </div>
                </div>

                {/* Editor Container */}
                <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:border-[#2B74B7] focus-within:ring-2 focus-within:ring-[#2B74B7]/20 transition-all">
                  <div className="bg-[#181825] px-4 py-2 border-b border-[#313244] flex items-center justify-between text-xs text-gray-400">
                    <span className="font-mono">{loadedFileName}</span>
                    <span>{lineCount.toLocaleString()} dòng • {(charCount / 1024).toFixed(1)} KB</span>
                  </div>
                  <textarea
                    ref={textareaRef}
                    value={rawTex}
                    onChange={(e) => setRawTex(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Dán hoặc gõ mã nguồn LaTeX vào đây..."
                    className="w-full h-[650px] p-4 font-mono text-xs leading-relaxed bg-[#1E1E2E] text-[#CDD6F4] resize-none focus:outline-none selection:bg-[#45475A]"
                    spellCheck={false}
                  />
                </div>
              </div>
            )}

            {/* VIEW 3: FULL-SIZE PDF VIEW */}
            {activeView === 'pdf' && (
              <div className="soft-card bg-white border border-[#E7DFD0] rounded-2xl p-4 shadow-md space-y-3">
                <div className="flex flex-wrap items-center justify-between pb-3 border-b border-gray-200 gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-[#2D2A26] flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-[#2B74B7]" />
                      <span>
                        {compiledPdfUrl
                          ? 'Bản PDF Vector Được Biên Dịch Từ Mã Của Bạn'
                          : 'Bản PDF Biên Dịch Gốc XeLaTeX (13 Trang Mẫu)'}
                      </span>
                    </h3>
                    <p className="text-xs text-[#6B655B]">
                      {compiledPdfUrl
                        ? `Biên dịch bởi ${compileStats?.engine || 'Tectonic'} • Kích thước: ${compileStats?.pdfSizeKb} KB`
                        : 'ID630_HS-2026-10-02-07-07.pdf • Được biên dịch trực tiếp từ chính mẫu tạp chí ĐHQG'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {compiledPdfUrl ? (
                      <button
                        onClick={handleDownloadPdf}
                        className="btn-pill-subtle text-xs py-1.5 px-3 bg-[#EBF1FA] text-[#2B74B7] font-bold flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải File PDF Vừa Tạo ({compileStats?.pdfSizeKb} KB)</span>
                      </button>
                    ) : (
                      <a
                        href="/demo-files/ID630_HS-2026-10-02-07-07.pdf"
                        download="ID630_HS-2026-10-02-07-07.pdf"
                        className="btn-pill-subtle text-xs py-1.5 px-3 bg-[#EBF1FA] text-[#2B74B7] font-bold flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải File PDF Mẫu Gốc (1.5 MB)</span>
                      </a>
                    )}
                    <button
                      onClick={handleCompileBackend}
                      disabled={isCompiling}
                      className="btn-pill-subtle text-xs py-1.5 px-3 bg-[#2B74B7] text-white font-bold flex items-center gap-1.5 border-none shadow-xs"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCompiling ? 'animate-spin' : ''}`} />
                      <span>Biên dịch lại</span>
                    </button>
                  </div>
                </div>

                <div className="w-full h-[850px] border border-gray-300 rounded-xl overflow-hidden bg-gray-100">
                  <iframe
                    src={compiledPdfUrl ? `${compiledPdfUrl}#toolbar=1` : '/demo-files/ID630_HS-2026-10-02-07-07.pdf#toolbar=1'}
                    className="w-full h-full border-none"
                    title="PDF Viewer"
                  />
                </div>
              </div>
            )}

            {/* VIEW 4: WEB DOM LAYOUT (RENDERED FROM PARSED LATEX) */}
            {activeView === 'rendered' && parsedPaper && (
              <div className="flex flex-col items-center">
                <div className="mb-3 text-xs text-[#6B655B] bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-full flex items-center gap-2 shadow-2xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>
                    Nội dung dưới đây được <strong>phân tích và render dạng Web DOM Layout</strong> trực tiếp từ mã LaTeX của{' '}
                    <code>{loadedFileName}</code>
                  </span>
                </div>

                <div
                  className="journal-sheet bg-white text-black shadow-2xl relative overflow-hidden border border-gray-300 print:shadow-none print:border-none print:m-0 print:p-0 my-4 rounded-xs"
                  style={{
                    width: '216.15mm', // 8.51 in (612.72 pt) matching official VNUHCM journal PDF
                    minHeight: '279.4mm', // 11.00 in (792 pt) matching official VNUHCM journal PDF
                    padding: '1.8cm 1.3cm 1.5cm 1.7cm',
                    fontFamily: "'Times New Roman', Times, serif",
                    boxSizing: 'border-box',
                  }}
                >
                  <JournalHeader paper={parsedPaper} />
                  <JournalFirstPageMeta paper={parsedPaper} />
                  <JournalSectionRenderer paper={parsedPaper} isTwoColumn={true} />
                  <JournalReferences references={parsedPaper.references} />
                  <JournalCitationFooter metadata={parsedPaper.metadata} />
                </div>
              </div>
            )}

            {/* VIEW 5: XETEX LOGS */}
            {activeView === 'logs' && lastRawLog && (
              <div className="soft-card bg-white border border-[#E7DFD0] rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-[#FAF7F0] px-4 py-3 border-b border-[#E7DFD0] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#2B74B7]" />
                    <span className="font-bold text-xs text-gray-800">
                      Nhật Ký Biên Dịch Trực Tiếp (XeTeX / Tectonic Engine Transcript)
                    </span>
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(lastRawLog)}
                    className="btn-pill-subtle text-xs py-1 px-3"
                  >
                    Sao chép log
                  </button>
                </div>
                <div className="bg-[#1E1E2E] text-[#CDD6F4] text-xs font-mono p-4 max-h-[800px] overflow-auto leading-relaxed">
                  <pre className="overflow-x-auto whitespace-pre-wrap">{lastRawLog}</pre>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Compile Error Modal */}
      {compileErrorInfo && (
        <CompileErrorModal
          errorInfo={compileErrorInfo}
          onClose={() => setCompileErrorInfo(null)}
          latexCode={rawTex}
        />
      )}
    </div>
  );
}
