'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Printer,
  Sparkles,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Sliders,
  ListTree,
  Image as ImageIcon,
  Table as TableIcon,
  Search,
  Copy,
  Check,
  Layers,
  AlertTriangle,
} from 'lucide-react';

export default function TestRenderHtmlPage() {
  const [rawHtml, setRawHtml] = useState<string>('');
  const [fileName, setFileName] = useState<string>('ID630_HS-2026-10-02-06-42.html');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'rendered' | 'split' | 'code' | 'structure'>('rendered');
  
  // Customization controls
  const [paperWidthMode, setPaperWidthMode] = useState<'a4' | 'default' | 'fluid'>('a4');
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [applyJournalEnhancements, setApplyJournalEnhancements] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const splitIframeRef = useRef<HTMLIFrameElement>(null);

  // Load sample HTML template on mount
  useEffect(() => {
    loadSampleHtml();
  }, []);

  const loadSampleHtml = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await fetch('/demo-files/ID630_HS-2026-10-02-06-42.html');
      if (!res.ok) {
        throw new Error(`Máy chủ trả về mã lỗi HTTP ${res.status} (${res.statusText})`);
      }
      const text = await res.text();
      setRawHtml(text);
      setFileName('ID630_HS-2026-10-02-06-42.html');
    } catch (e: any) {
      console.error(e);
      setErrorMessage(`Không thể tải file HTML demo: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setRawHtml(text);
        setFileName(file.name);
      }
      setIsLoading(false);
    };
    reader.onerror = () => {
      setErrorMessage('Lỗi khi đọc file đã chọn từ máy tính.');
      setIsLoading(false);
    };
    reader.readAsText(file, 'utf-8');
  };

  const handlePrint = () => {
    const targetIframe = iframeRef.current || splitIframeRef.current;
    if (targetIframe && targetIframe.contentWindow) {
      targetIframe.contentWindow.focus();
      targetIframe.contentWindow.print();
    } else {
      window.print();
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(rawHtml);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleDownloadHtml = () => {
    const blob = new Blob([rawHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Prepare iframe HTML content with base URL and optional journal enhancements
  const preparedHtml = useMemo(() => {
    if (!rawHtml) return '';

    let processed = rawHtml;

    // Ensure base tag is injected so relative paths like "media/image1.png" resolve to "/demo-files/media/"
    const baseTag = '<base href="/demo-files/" />';
    if (processed.includes('<head>')) {
      processed = processed.replace('<head>', `<head>\n  ${baseTag}`);
    } else if (processed.includes('<head ')) {
      processed = processed.replace(/(<head[^>]*>)/i, `$1\n  ${baseTag}`);
    } else {
      processed = `${baseTag}\n${processed}`;
    }

    // Optional journal typography enhancement CSS
    if (applyJournalEnhancements) {
      const enhancementCss = `
        <style id="journal-enhancements">
          @import url('https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,300..800;1,8..60,300..800&display=swap');
          body {
            font-family: 'Source Serif 4', 'Times New Roman', Georgia, serif !important;
            font-size: 10.5pt !important;
            line-height: 1.6 !important;
            color: #111827 !important;
          }
          h1, h2, h3, h4 {
            font-family: 'Source Serif 4', 'Times New Roman', Georgia, serif !important;
            color: #1E3A8A !important;
            font-weight: 700 !important;
          }
          h1 { border-bottom: 2px solid #DBEAFE; padding-bottom: 4px; }
          table {
            border-top: 2px solid #1E3A8A !important;
            border-bottom: 2px solid #1E3A8A !important;
            font-size: 9.5pt !important;
          }
          th {
            background-color: #F8FAFC !important;
            border-bottom: 1px solid #94A3B8 !important;
            color: #0F172A !important;
            font-weight: 700 !important;
          }
          blockquote {
            background-color: #F8FAFC !important;
            border-left: 3px solid #2563EB !important;
            padding: 12px 18px !important;
            border-radius: 4px !important;
          }
          img {
            display: block;
            margin: 12px auto;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          }
        </style>
      `;
      processed = processed.replace('</head>', `${enhancementCss}\n</head>`);
    }

    return processed;
  }, [rawHtml, applyJournalEnhancements]);

  // Document statistics and outline extracted from HTML
  const parsedStats = useMemo(() => {
    if (!rawHtml) return null;

    const headings: { level: number; text: string; id: string }[] = [];
    const headingRegex = /<h([1-6])(?:\s+id=["']([^"']*)["'])?[^>]*>(.*?)<\/h\1>/gis;
    let match;
    while ((match = headingRegex.exec(rawHtml)) !== null) {
      const cleanText = match[3].replace(/<[^>]+>/g, '').trim();
      if (cleanText) {
        headings.push({
          level: parseInt(match[1], 10),
          id: match[2] || '',
          text: cleanText,
        });
      }
    }

    const images: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    while ((match = imgRegex.exec(rawHtml)) !== null) {
      images.push(match[1]);
    }

    const tablesCount = (rawHtml.match(/<table\b/gi) || []).length;
    const blockquotesCount = (rawHtml.match(/<blockquote\b/gi) || []).length;
    const paragraphsCount = (rawHtml.match(/<p\b/gi) || []).length;
    const totalLines = rawHtml.split('\n').length;
    const sizeKb = (rawHtml.length / 1024).toFixed(1);

    // Extract title if available
    const titleMatch = rawHtml.match(/<title>(.*?)<\/title>/i);
    const documentTitle = titleMatch ? titleMatch[1] : fileName;

    return {
      title: documentTitle,
      headings,
      images,
      tablesCount,
      blockquotesCount,
      paragraphsCount,
      totalLines,
      sizeKb,
    };
  }, [rawHtml, fileName]);

  // Code search filtering
  const codeLines = useMemo(() => {
    if (!rawHtml) return [];
    return rawHtml.split('\n');
  }, [rawHtml]);

  const filteredCodeLines = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return codeLines
      .map((line, idx) => ({ line, idx }))
      .filter((item) => item.line.toLowerCase().includes(q));
  }, [codeLines, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] flex flex-col pb-20">
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
                  Kiểm Tra Render File HTML Mẫu
                </span>
                <span className="pill-badge bg-[#D9F99D] text-[#14532D] text-[10px] py-0.5 px-2 font-mono">
                  /test-render-html
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Đang nạp file:{' '}
                <code className="text-[#78C841] font-bold font-mono bg-[#78C841]/10 px-1.5 py-0.5 rounded-md">
                  {fileName}
                </code>{' '}
                {parsedStats && (
                  <span>
                    ({parsedStats.totalLines} dòng • {parsedStats.sizeKb} KB •{' '}
                    {parsedStats.images.length} hình ảnh)
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action buttons & Cross-link */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Link to LaTeX test */}
            <Link
              href="/test-render-latex"
              className="btn-pill-subtle text-xs py-1.5 px-3 bg-[#EBF1FA] text-[#2B74B7] border-[#C5D7F0] font-bold hover:bg-[#DCE7F7] flex items-center gap-1.5 shadow-xs"
              title="Chuyển sang trang kiểm tra render mã LaTeX"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Xem Test LaTeX (.tex)</span>
            </Link>

            <label className="btn-pill-subtle text-xs py-1.5 px-3 cursor-pointer hover:bg-[#FAF7F0]">
              <Upload className="w-3.5 h-3.5 text-gray-600" />
              <span>Nạp file .html khác</span>
              <input
                type="file"
                accept=".html,.htm"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            <button
              onClick={loadSampleHtml}
              className="btn-pill-subtle text-xs py-1.5 px-3 hover:bg-[#FAF7F0]"
              title="Nạp lại file HTML demo gốc"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-600" />
              <span>Nạp lại mẫu gốc</span>
            </button>

            <button
              onClick={handleDownloadHtml}
              className="btn-pill-subtle text-xs py-1.5 px-3 hover:bg-[#FAF7F0]"
              title="Tải nội dung HTML về máy tính"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Tải file .html</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main control navigation tabs & Toolbars */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 pt-5 pb-3">
        <div className="bg-white soft-card p-2 border border-[#E7DFD0] flex flex-wrap items-center justify-between gap-3 shadow-xs">
          {/* Main Tabs */}
          <div className="segmented-control bg-[#FAF7F0] p-1 rounded-full border border-[#E7DFD0] flex flex-wrap gap-1">
            <button
              onClick={() => setActiveView('rendered')}
              className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
                activeView === 'rendered'
                  ? 'bg-white font-bold text-[#D97706] shadow-xs'
                  : 'text-[#6B655B]'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#D97706]" />
              <span>1. Bản Render HTML Trực Tiếp</span>
            </button>

            <button
              onClick={() => setActiveView('split')}
              className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
                activeView === 'split'
                  ? 'bg-white font-bold text-[#D97706] shadow-xs'
                  : 'text-[#6B655B]'
              }`}
            >
              <Columns className="w-3.5 h-3.5 text-[#D97706]" />
              <span>2. So Sánh Song Song (HTML vs PDF Gốc)</span>
            </button>

            <button
              onClick={() => setActiveView('structure')}
              className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
                activeView === 'structure'
                  ? 'bg-white font-bold text-[#D97706] shadow-xs'
                  : 'text-[#6B655B]'
              }`}
            >
              <ListTree className="w-3.5 h-3.5 text-[#D97706]" />
              <span>3. Cấu Trúc DOM & Thống Kê ({parsedStats?.headings.length || 0} mục)</span>
            </button>

            <button
              onClick={() => setActiveView('code')}
              className={`segmented-item text-xs py-1.5 px-3.5 rounded-full flex items-center gap-1.5 transition-all ${
                activeView === 'code'
                  ? 'bg-white font-bold text-[#D97706] shadow-xs'
                  : 'text-[#6B655B]'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-[#D97706]" />
              <span>4. Mã Nguồn HTML Thô ({parsedStats?.totalLines || 0} dòng)</span>
            </button>
          </div>

          {/* Quick Tools: Print & Open External */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="btn-pill-subtle text-xs py-1.5 px-3 bg-[#FAF7F0] text-[#2D2A26] font-semibold flex items-center gap-1.5 hover:bg-white shadow-xs"
              title="In bản HTML hoặc lưu dưới dạng PDF qua lệnh in của trình duyệt"
            >
              <Printer className="w-3.5 h-3.5 text-[#D97706]" />
              <span>In / Lưu PDF Trình Duyệt</span>
            </button>

            <a
              href="/demo-files/ID630_HS-2026-10-02-06-42.html"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-pill-subtle text-xs py-1.5 px-3 bg-[#FAF7F0] text-[#2D2A26] font-semibold flex items-center gap-1.5 hover:bg-white shadow-xs"
              title="Mở file HTML độc lập trên tab trình duyệt mới"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#2B74B7]" />
              <span>Mở Toàn Màn Hình</span>
            </a>
          </div>
        </div>

        {/* Viewport Sub-Controls (Available on Rendered & Split View) */}
        {(activeView === 'rendered' || activeView === 'split') && (
          <div className="mt-2.5 bg-[#FAF7F0] px-4 py-2 rounded-xl border border-[#E7DFD0] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-[#6B655B] flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" /> Khổ hiển thị:
              </span>
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-[#E7DFD0]">
                <button
                  onClick={() => setPaperWidthMode('a4')}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    paperWidthMode === 'a4'
                      ? 'bg-[#D97706] text-white shadow-xs font-bold'
                      : 'text-[#6B655B] hover:text-black'
                  }`}
                  title="Khổ chuẩn trang in A4 (210mm)"
                >
                  Khổ Giấy A4 (210mm)
                </button>
                <button
                  onClick={() => setPaperWidthMode('default')}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    paperWidthMode === 'default'
                      ? 'bg-[#D97706] text-white shadow-xs font-bold'
                      : 'text-[#6B655B] hover:text-black'
                  }`}
                  title="Khổ mặc định của Pandoc (36em - tương đương ~600px)"
                >
                  Mặc Định Pandoc (36em)
                </button>
                <button
                  onClick={() => setPaperWidthMode('fluid')}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    paperWidthMode === 'fluid'
                      ? 'bg-[#D97706] text-white shadow-xs font-bold'
                      : 'text-[#6B655B] hover:text-black'
                  }`}
                  title="Toàn bộ chiều rộng màn hình"
                >
                  Toàn Chiều Rộng (100%)
                </button>
              </div>

              {/* Journal Enhancement Toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer ml-2 text-[#2D2A26] select-none">
                <input
                  type="checkbox"
                  checked={applyJournalEnhancements}
                  onChange={(e) => setApplyJournalEnhancements(e.target.checked)}
                  className="rounded text-[#D97706] focus:ring-[#D97706]"
                />
                <span className="font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                  Nâng cấp Font & Kiểu dáng Tạp chí
                </span>
              </label>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <span className="text-[#6B655B] font-medium">Thu phóng:</span>
              <button
                onClick={() => setZoomLevel((z) => Math.max(70, z - 10))}
                className="p-1 rounded bg-white border border-[#E7DFD0] hover:bg-gray-100 text-gray-700"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono font-bold text-gray-800 w-12 text-center">
                {zoomLevel}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(150, z + 10))}
                className="p-1 rounded bg-white border border-[#E7DFD0] hover:bg-gray-100 text-gray-700"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {zoomLevel !== 100 && (
                <button
                  onClick={() => setZoomLevel(100)}
                  className="text-[11px] text-[#2B74B7] underline ml-1"
                >
                  Đặt lại
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 flex-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-28 text-gray-500">
            <RefreshCw className="w-8 h-8 animate-spin mb-3 text-[#D97706]" />
            <p className="text-sm font-semibold">Đang nạp và phân tích file HTML demo...</p>
          </div>
        ) : errorMessage ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 my-6 text-red-800 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-2 font-bold text-base">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <span>Đã xảy ra lỗi khi tải file</span>
            </div>
            <p className="text-sm text-red-700 mb-4">{errorMessage}</p>
            <button
              onClick={loadSampleHtml}
              className="btn-pill-subtle text-xs py-1.5 px-4 bg-white border-red-300 text-red-700 hover:bg-red-100 font-bold"
            >
              Thử lại ngay
            </button>
          </div>
        ) : (
          <>
            {/* VIEW 1: DIRECT ISOLATED RENDER */}
            {activeView === 'rendered' && (
              <div className="flex flex-col items-center">
                <div className="w-full mb-3 text-xs bg-amber-50 border border-amber-200 text-amber-900 px-3.5 py-2 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      Đang render trực tiếp mã HTML gốc từ file{' '}
                      <strong className="font-mono text-[#D97706]">{fileName}</strong> trong môi trường iframe độc lập (tự động nạp 9 hình ảnh chuẩn).
                    </span>
                  </div>
                  {applyJournalEnhancements && (
                    <span className="bg-amber-200 text-amber-950 px-2 py-0.5 rounded font-bold text-[10px]">
                      Đang áp dụng CSS Nâng Cấp
                    </span>
                  )}
                </div>

                <div
                  className={`w-full flex justify-center transition-all ${
                    paperWidthMode === 'fluid' ? 'px-0' : 'px-2'
                  }`}
                >
                  <div
                    className={`bg-white rounded-xl shadow-xl border border-gray-300 overflow-hidden transition-all duration-300 ${
                      paperWidthMode === 'a4'
                        ? 'w-full max-w-[210mm]'
                        : paperWidthMode === 'default'
                        ? 'w-full max-w-[720px]'
                        : 'w-full'
                    }`}
                    style={{
                      transform: zoomLevel !== 100 ? `scale(${zoomLevel / 100})` : 'none',
                      transformOrigin: 'top center',
                      minHeight: '880px',
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      srcDoc={preparedHtml}
                      title="HTML Preview Render"
                      className="w-full h-[950px] border-none bg-white"
                      sandbox="allow-same-origin allow-scripts allow-popups"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 2: SPLIT COMPARISON 1:1 (HTML RENDER vs OFFICIAL PDF) */}
            {activeView === 'split' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Column: Rendered HTML */}
                <div className="soft-card bg-white border border-[#E7DFD0] p-3 shadow-md flex flex-col">
                  <div className="bg-[#FAF7F0] border border-[#E7DFD0] px-3 py-2 rounded-xl mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#D97706]">
                        Bản Render HTML Trực Tiếp
                      </span>
                      <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">
                        HTML Demo
                      </span>
                    </div>
                    <span className="text-[11px] text-[#6B655B] font-mono">
                      {fileName}
                    </span>
                  </div>
                  <div className="h-[840px] border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <iframe
                      ref={splitIframeRef}
                      srcDoc={preparedHtml}
                      title="HTML Preview Render (Split)"
                      className="w-full h-full border-none"
                      sandbox="allow-same-origin allow-scripts allow-popups"
                    />
                  </div>
                </div>

                {/* Right Column: Reference Official PDF */}
                <div className="soft-card bg-white border border-[#E7DFD0] p-3 shadow-md flex flex-col">
                  <div className="bg-[#FAF7F0] border border-[#E7DFD0] px-3 py-2 rounded-xl mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-[#2B74B7]">
                        Bản PDF Gốc XeLaTeX (13 Trang Đối Chiếu)
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        XeLaTeX 100%
                      </span>
                    </div>
                    <a
                      href="/demo-files/ID630_HS-2026-10-02-07-07.pdf"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-[#2B74B7] hover:underline flex items-center gap-0.5"
                    >
                      <span>Mở PDF</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="h-[840px] border border-gray-200 rounded-xl overflow-hidden bg-gray-100">
                    <iframe
                      src="/demo-files/ID630_HS-2026-10-02-07-07.pdf#toolbar=1"
                      className="w-full h-full border-none"
                      title="Reference Official PDF"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: DOM STRUCTURE & OUTLINE */}
            {activeView === 'structure' && parsedStats && (
              <div className="space-y-5">
                {/* Stat Metric Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-white p-3.5 rounded-xl border border-[#E7DFD0] shadow-2xs">
                    <div className="text-[11px] text-[#6B655B] font-semibold">Tổng Dòng Mã</div>
                    <div className="text-xl font-black text-[#2D2A26] mt-0.5">{parsedStats.totalLines}</div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-[#E7DFD0] shadow-2xs">
                    <div className="text-[11px] text-[#6B655B] font-semibold">Dung Lượng File</div>
                    <div className="text-xl font-black text-[#D97706] mt-0.5">{parsedStats.sizeKb} KB</div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-[#E7DFD0] shadow-2xs">
                    <div className="text-[11px] text-[#6B655B] font-semibold">Tiêu Đề / Heading</div>
                    <div className="text-xl font-black text-[#2B74B7] mt-0.5">{parsedStats.headings.length}</div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-[#E7DFD0] shadow-2xs">
                    <div className="text-[11px] text-[#6B655B] font-semibold">Hình Ảnh (Media)</div>
                    <div className="text-xl font-black text-emerald-600 mt-0.5">{parsedStats.images.length}</div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-[#E7DFD0] shadow-2xs">
                    <div className="text-[11px] text-[#6B655B] font-semibold">Bảng Biểu (Tables)</div>
                    <div className="text-xl font-black text-purple-600 mt-0.5">{parsedStats.tablesCount}</div>
                  </div>
                  <div className="bg-white p-3.5 rounded-xl border border-[#E7DFD0] shadow-2xs">
                    <div className="text-[11px] text-[#6B655B] font-semibold">Đoạn Văn (Paragraphs)</div>
                    <div className="text-xl font-black text-rose-600 mt-0.5">{parsedStats.paragraphsCount}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Headings Outline (Table of Contents) */}
                  <div className="lg:col-span-2 bg-white rounded-2xl border border-[#E7DFD0] p-5 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD0] mb-4">
                      <div className="flex items-center gap-2">
                        <ListTree className="w-5 h-5 text-[#D97706]" />
                        <h3 className="font-bold text-sm text-[#2D2A26]">
                          Cây Mục Lục & Cấu Trúc Tiêu Đề Bài Báo
                        </h3>
                      </div>
                      <span className="text-xs bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full">
                        {parsedStats.headings.length} tiêu đề
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[550px] overflow-y-auto pr-2">
                      {parsedStats.headings.map((h, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-[#FAF7F0] transition-colors border border-transparent hover:border-[#E7DFD0]"
                          style={{ marginLeft: `${(h.level - 1) * 18}px` }}
                        >
                          <span className="text-[10px] font-mono font-bold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">
                            H{h.level}
                          </span>
                          <span className="text-xs font-semibold text-[#2D2A26] leading-relaxed">
                            {h.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Images & Media Gallery */}
                  <div className="bg-white rounded-2xl border border-[#E7DFD0] p-5 shadow-xs flex flex-col">
                    <div className="flex items-center justify-between pb-3 border-b border-[#E7DFD0] mb-4">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-emerald-600" />
                        <h3 className="font-bold text-sm text-[#2D2A26]">
                          Hình Ảnh Trích Xuất ({parsedStats.images.length})
                        </h3>
                      </div>
                    </div>

                    <div className="space-y-3 overflow-y-auto max-h-[550px] pr-2">
                      {parsedStats.images.map((imgSrc, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-xl border border-gray-200 bg-[#FAF7F0] flex items-center gap-3"
                        >
                          <div className="w-14 h-14 rounded-lg bg-white border border-gray-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/demo-files/${imgSrc}`}
                              alt={`Image ${idx + 1}`}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#2D2A26] truncate">
                              Hình {idx + 1}: {imgSrc.replace(/^media\//, '')}
                            </p>
                            <p className="text-[11px] text-[#6B655B] font-mono truncate">
                              /demo-files/{imgSrc}
                            </p>
                            <a
                              href={`/demo-files/${imgSrc}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-[#2B74B7] font-semibold hover:underline mt-0.5 inline-block"
                            >
                              Xem kích thước gốc →
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 4: RAW HTML SOURCE CODE */}
            {activeView === 'code' && (
              <div className="soft-card bg-white border border-[#E7DFD0] overflow-hidden shadow-md">
                <div className="bg-[#FAF7F0] px-4 py-3 border-b border-[#E7DFD0] flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-xs text-gray-800 font-mono">
                      {fileName} ({codeLines.length} dòng mã • {(rawHtml.length / 1024).toFixed(1)} KB)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Search inside code */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Tìm kiếm trong mã HTML..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 pr-3 py-1 bg-white border border-[#E7DFD0] rounded-full text-xs text-[#2D2A26] focus:outline-none focus:ring-1 focus:ring-[#D97706] w-48 sm:w-64"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="absolute right-2.5 top-1.5 text-gray-400 hover:text-gray-600 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    <button
                      onClick={handleCopyCode}
                      className="btn-pill-subtle text-xs py-1 px-3 bg-white flex items-center gap-1.5"
                    >
                      {copiedCode ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-bold">Đã chép!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-gray-600" />
                          <span>Sao chép mã</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-[#1E1E2E] text-[#CDD6F4] text-xs font-mono p-4 max-h-[800px] overflow-auto leading-relaxed">
                  {filteredCodeLines ? (
                    <div>
                      <div className="text-amber-300 text-[11px] mb-3 pb-2 border-b border-gray-700">
                        Tìm thấy {filteredCodeLines.length} dòng khớp với từ khóa &ldquo;{searchQuery}&rdquo;:
                      </div>
                      <pre className="overflow-x-auto whitespace-pre">
                        <code>
                          {filteredCodeLines.map(({ line, idx }) => (
                            <div key={idx} className="table-row hover:bg-white/5 py-0.5">
                              <span className="table-cell select-none text-right pr-4 text-[#585B70] w-14">
                                {idx + 1}
                              </span>
                              <span className="table-cell">{line}</span>
                            </div>
                          ))}
                        </code>
                      </pre>
                    </div>
                  ) : (
                    <pre className="overflow-x-auto whitespace-pre">
                      <code>
                        {codeLines.map((line, idx) => (
                          <div key={idx} className="table-row hover:bg-white/5 py-0.5">
                            <span className="table-cell select-none text-right pr-4 text-[#585B70] w-14">
                              {idx + 1}
                            </span>
                            <span className="table-cell">{line}</span>
                          </div>
                        ))}
                      </code>
                    </pre>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
