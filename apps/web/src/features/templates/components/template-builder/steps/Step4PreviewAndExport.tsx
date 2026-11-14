'use client';

import React, { useState } from 'react';
import { UniversalTemplateSchema, SemanticElement } from '@/types/template-builder';
import { generateUniversalTypst } from '@/lib/template-builder/universal-typst-generator';
import { generateUniversalLatex } from '@/lib/template-builder/universal-latex-generator';
import {
  FileText,
  Code2,
  Terminal,
  Braces,
  Copy,
  Check,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Save,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';

interface Step4PreviewAndExportProps {
  schema: UniversalTemplateSchema;
  onSaveToLibrary: () => void;
  onNavigateToBack?: () => void;
}

export const Step4PreviewAndExport: React.FC<Step4PreviewAndExportProps> = ({
  schema,
  onSaveToLibrary,
  onNavigateToBack,
}) => {
  const [activeTab, setActiveTab] = useState<'typst' | 'latex' | 'json' | 'a4-preview'>(
    'typst'
  );
  const [zoomLevel, setZoomLevel] = useState<number>(85);
  const [copied, setCopied] = useState<boolean>(false);

  const typstCode = generateUniversalTypst(schema);
  const latexCode = generateUniversalLatex(schema);
  const jsonCode = JSON.stringify(schema, null, 2);

  const currentCode =
    activeTab === 'typst' ? typstCode : activeTab === 'latex' ? latexCode : jsonCode;

  const currentFilename =
    activeTab === 'typst'
      ? `${schema.id || 'template'}.typ`
      : activeTab === 'latex'
      ? `${schema.id || 'template'}.tex`
      : `${schema.id || 'template'}.json`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      toast.success('Sao chép mã', 'Đã lưu mã nguồn vào clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không thể sao chép');
    }
  };

  const handleDownload = () => {
    const mimeType =
      activeTab === 'json' ? 'application/json' : 'text/plain;charset=utf-8';
    const blob = new Blob([currentCode], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Tải xuống', `Đã tải xuống file ${currentFilename}`);
  };

  const { pageArchitecture, zones, elements, primaryColor } = schema;
  const { margins, headers, pageNumbering } = pageArchitecture;

  return (
    <div className="flex flex-col h-full bg-zinc-100/70 rounded-3xl border border-zinc-200/80 shadow-2xs overflow-hidden">
      {/* Top Banner Header */}
      <div className="p-3 bg-white border-b border-zinc-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
            Bước 6: Xuất mã nguồn Typst & PDF
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono font-bold text-[#14532D] bg-[#78C841]/15 px-2.5 py-1 rounded-xl border border-[#78C841]/40">
            Typst Compilation Engine (.typ)
          </span>
        </div>
      </div>

      {/* Top View Mode & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-white border-b border-zinc-200/80 shadow-2xs">
        {/* Switcher Tabs */}
        <div className="flex items-center gap-1 bg-zinc-200/70 p-1 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('typst')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'typst'
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/40'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-[#78C841]" />
            <span>Mã Typst (.typ)</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#78C841]/20 text-[#14532D] font-extrabold">
              Engine chính
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('a4-preview')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'a4-preview'
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/40'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-zinc-700" />
            <span>Giả lập In ấn A4</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('latex')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'latex'
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/40'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-zinc-600" />
            <span>LaTeX XeTeX (.tex)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'json'
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/40'
            }`}
          >
            <Braces className="w-3.5 h-3.5 text-amber-600" />
            <span>JSON Schema</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          {activeTab === 'a4-preview' ? (
            <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-2xl border border-zinc-200/60">
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.max(50, prev - 10))}
                className="p-1.5 rounded-xl hover:bg-white text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
                title="Thu nhỏ"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold text-zinc-800 w-11 text-center">
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.min(130, prev + 10))}
                className="p-1.5 rounded-xl hover:bg-white text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
                title="Phóng to"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(85)}
                className="p-1.5 rounded-xl hover:bg-white text-zinc-600 hover:text-zinc-900 transition-colors cursor-pointer"
                title="Reset zoom"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-200/70 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-[#14532D]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-zinc-200/70 hover:bg-zinc-200 text-zinc-800 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải về file</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onSaveToLibrary}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#78C841] hover:bg-[#68af38] text-white text-xs font-extrabold shadow-sm shadow-[#78C841]/25 transition-all hover:scale-102 active:scale-98 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu Template vào Kho</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {activeTab === 'a4-preview' ? (
        <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 flex justify-center items-start">
          <div
            style={{
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out',
            }}
            className="w-[794px] min-h-[1123px] bg-white shadow-2xl rounded-sm border border-slate-300 relative text-[#1A1A1A] transition-all duration-200 select-text"
          >
            {/* Header Region */}
            <div
              style={{
                paddingTop: `${Math.max(12, margins.top * 1.3)}px`,
                paddingLeft: `${Math.max(16, margins.left * 1.3)}px`,
                paddingRight: `${Math.max(16, margins.right * 1.3)}px`,
              }}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-300 mb-4 text-[9.5pt] font-sans">
                <span className="font-semibold text-slate-700">
                  {headers.firstPage.leftText}
                </span>
                <span className="text-slate-500">{headers.firstPage.rightText}</span>
              </div>
            </div>

            {/* Document Content Zones Container */}
            <div
              style={{
                paddingLeft: `${Math.max(16, margins.left * 1.3)}px`,
                paddingRight: `${Math.max(16, margins.right * 1.3)}px`,
                paddingBottom: `${Math.max(16, margins.bottom * 1.3)}px`,
              }}
              className="space-y-4"
            >
              {zones
                .sort((a, b) => a.order - b.order)
                .map((zone) => {
                  const zoneElements = elements
                    .filter((e) => e.zoneId === zone.id && e.visible)
                    .sort((a, b) => a.order - b.order);

                  if (zone.type === 'sidebar-split') {
                    const leftColWidth = zone.sidebarWidthPercentage || 28;
                    const leftElements = zoneElements.filter((el) => !el.spanColumns);
                    const rightElements = zoneElements.filter((el) => el.spanColumns);

                    return (
                      <div
                        key={zone.id}
                        className="grid grid-cols-12 gap-4 my-2 border-t border-transparent"
                      >
                        {/* Left Sidebar */}
                        <div
                          className="col-span-3 border-r border-slate-200 pr-3 space-y-2"
                          style={{
                            width: `${leftColWidth * 3.3}px`,
                          }}
                        >
                          {leftElements.map((el) => (
                            <DynamicElementRenderer
                              key={el.id}
                              element={el}
                              primaryColor={primaryColor}
                            />
                          ))}
                        </div>

                        {/* Right Content Panel */}
                        <div className="col-span-9 space-y-3">
                          {rightElements.map((el) => (
                            <DynamicElementRenderer
                              key={el.id}
                              element={el}
                              primaryColor={primaryColor}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  }

                  if (zone.type === 'multi-column') {
                    return (
                      <div
                        key={zone.id}
                        style={{
                          columnCount: zone.columns,
                          columnGap: `${zone.columnGap * 2.8}px`,
                          columnRule: zone.showColumnRule
                            ? `1px solid ${zone.columnRuleColor}`
                            : 'none',
                        }}
                        className="my-3"
                      >
                        {zoneElements.map((el) => (
                          <div key={el.id} className="break-inside-avoid-column mb-3">
                            <DynamicElementRenderer
                              element={el}
                              primaryColor={primaryColor}
                            />
                          </div>
                        ))}
                      </div>
                    );
                  }

                  // Full-width (1 column)
                  return (
                    <div key={zone.id} className="w-full space-y-2">
                      {zoneElements.map((el) => (
                        <DynamicElementRenderer
                          key={el.id}
                          element={el}
                          primaryColor={primaryColor}
                        />
                      ))}
                    </div>
                  );
                })}
            </div>

            {/* Page Numbering Footer */}
            {pageNumbering.position !== 'none' && (
              <div
                className="absolute bottom-4 left-0 right-0 px-8 flex items-center justify-between text-[8.5pt] text-slate-400 font-sans"
                style={{
                  justifyContent: pageNumbering.position.includes('center')
                    ? 'center'
                    : pageNumbering.position.includes('left')
                    ? 'flex-start'
                    : 'flex-end',
                }}
              >
                <span>
                  {pageNumbering.prefixText} 1 / 4
                </span>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Code Tabs (Typst / LaTeX / JSON) */
        <div className="flex-1 flex flex-col bg-[#1E293B] text-slate-200 overflow-hidden font-mono text-[11.5px]">
          <div className="flex-1 overflow-auto p-4 leading-relaxed selection:bg-blue-600 selection:text-white">
            <pre className="whitespace-pre-wrap">{currentCode}</pre>
          </div>
          <div className="px-4 py-2 bg-slate-900 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Template: {schema.name}</span>
            <span>Sinh tự động bằng Universal Typst Generator</span>
          </div>
        </div>
      )}

      {/* Bottom Sequential Step Navigation */}
      <div className="p-3 bg-white border-t border-zinc-200/80 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={onNavigateToBack}
          className="px-4 py-2.5 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200/80 text-zinc-700 hover:text-zinc-950 font-bold text-xs shadow-2xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Bước 5: Thành phần Nổi</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="px-4 py-2.5 rounded-2xl bg-white hover:bg-zinc-50 border border-zinc-200/80 text-zinc-800 font-bold text-xs shadow-2xs flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <Download className="w-4 h-4 text-zinc-700" />
            <span>Tải file {currentFilename}</span>
          </button>
          <button
            type="button"
            onClick={onSaveToLibrary}
            className="px-5 py-2.5 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs shadow-2xs flex items-center gap-2 ring-2 ring-[#78C841]/50 cursor-pointer transition-all active:scale-95"
          >
            <Save className="w-4 h-4 text-[#78C841]" />
            <span>Lưu vào Thư viện mẫu</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * Dynamic Element Renderer for A4 Live Preview
 */
function DynamicElementRenderer({
  element,
  primaryColor,
}: {
  element: SemanticElement;
  primaryColor: string;
}) {
  const { type, styling, specialProps } = element;

  const containerStyle: React.CSSProperties = {
    fontFamily: styling.fontFamily,
    fontSize: `${styling.fontSize}pt`,
    fontWeight:
      styling.fontWeight === 'extrabold'
        ? 800
        : styling.fontWeight === 'black'
        ? 900
        : styling.fontWeight === 'bold'
        ? 700
        : styling.fontWeight === 'semibold'
        ? 600
        : 400,
    fontStyle: styling.fontStyle,
    color: styling.textColor,
    textAlign: styling.textAlign,
    lineHeight: styling.lineHeight,
    backgroundColor:
      styling.backgroundColor === 'transparent' ? 'transparent' : styling.backgroundColor,
    borderLeft:
      styling.borderStyle === 'left-solid'
        ? `${styling.borderWidth}px solid ${styling.borderColor}`
        : styling.borderStyle === 'all-borders'
        ? `${styling.borderWidth}px solid ${styling.borderColor}`
        : 'none',
    borderTop:
      styling.borderStyle === 'all-borders' || styling.borderStyle === 'top-bottom'
        ? `${styling.borderWidth}px solid ${styling.borderColor}`
        : 'none',
    borderBottom:
      styling.borderStyle === 'all-borders' || styling.borderStyle === 'top-bottom'
        ? `${styling.borderWidth}px solid ${styling.borderColor}`
        : 'none',
    borderRight:
      styling.borderStyle === 'all-borders'
        ? `${styling.borderWidth}px solid ${styling.borderColor}`
        : 'none',
    padding: `${styling.padding.top * 1.5}px`,
    borderRadius: `${styling.borderRadius}px`,
    marginTop: `${styling.margin.top}px`,
    marginBottom: `${styling.margin.bottom}px`,
  };

  switch (type) {
    case 'article-title':
      return (
        <div style={containerStyle}>
          <h1 className="leading-tight">
            Nghiên cứu ứng dụng bóc tách cấu trúc OpenXML và tự động dàn trang báo cáo khoa học chuẩn VNUHCM
          </h1>
          {specialProps.supportBilingual && (
            <div
              className="mt-1.5 italic text-slate-500 font-serif"
              style={{ fontSize: `${specialProps.bilingualFontSize || 12}pt` }}
            >
              {specialProps.bilingualLabel ||
                'Automated Academic Typesetting and Semantic OpenXML Extraction for VNUHCM Scientific Journals'}
            </div>
          )}
        </div>
      );

    case 'author-block':
      return (
        <div style={containerStyle}>
          <div>
            <span className="font-semibold">Nguyễn Hoàng Nam</span>
            <sup className="text-emerald-700 font-bold ml-0.5">1*</sup>,{' '}
            <span className="font-semibold">Trần Minh Tuấn</span>
            <sup className="text-emerald-700 font-bold ml-0.5">2</sup>,{' '}
            <span className="font-semibold">Lê Thu Hương</span>
            <sup className="text-emerald-700 font-bold ml-0.5">1</sup>
          </div>
          {specialProps.showAffiliations && (
            <div className="mt-1 text-[8pt] text-slate-500 font-sans space-y-0.5">
              <div>
                <sup>1</sup> Khoa Khoa học & Kỹ thuật Máy tính, Trường Đại học Bách khoa, ĐHQG TP.HCM
              </div>
              <div>
                <sup>2</sup> Viện Khoa học Dữ liệu & Trí tuệ Nhân tạo, ĐHQG TP.HCM
              </div>
              {specialProps.showCorresponding && (
                <div>
                  <sup>*</sup> Tác giả liên hệ: nam.nh@vnuhcm.edu.vn
                </div>
              )}
            </div>
          )}
        </div>
      );

    case 'metadata-grid':
      const fields = (specialProps.metadataFields || []).filter((f) => f.visible);
      return (
        <div style={containerStyle} className="font-sans space-y-1.5">
          {fields.map((f) => (
            <div key={f.id} className="text-[7.5pt]">
              <span className="font-bold text-slate-700">{f.label}: </span>
              <span className="text-slate-600">{f.defaultValue}</span>
            </div>
          ))}
        </div>
      );

    case 'abstract-box':
      return (
        <div style={containerStyle}>
          <div
            className="font-bold mb-1 font-sans"
            style={{ color: primaryColor, fontSize: `${styling.fontSize}pt` }}
          >
            {specialProps.abstractLabel || 'TÓM TẮT'}
          </div>
          <p className="text-justify leading-relaxed">
            Bài báo này đề xuất giải pháp bóc tách cấu trúc tài liệu DOCX bán cấu trúc và tự động chuyển đổi sang khuôn mẫu xuất bản khoa học 2 cột. Hệ thống kết hợp phân tích cú pháp OpenXML nội bộ với mô hình ngôn ngữ lớn để bảo toàn hoàn chỉnh ảnh đồ họa vector, công thức toán học MathML và mạng lưới trích dẫn tài liệu tham khảo theo quy chuẩn VNUHCM.
          </p>
        </div>
      );

    case 'keywords-group':
      return (
        <div style={containerStyle} className="font-sans text-[8.5pt]">
          <span className="font-bold text-slate-800">
            {specialProps.keywordLabel || 'Từ khoá:'}{' '}
          </span>
          <span className="text-slate-700">
            OpenXML{specialProps.keywordSeparator || ', '}LaTeX XeTeX{specialProps.keywordSeparator || ', '}Dàn trang tự động{specialProps.keywordSeparator || ', '}Bài báo khoa học{specialProps.keywordSeparator || ', '}ĐHQG TP.HCM
          </span>
        </div>
      );

    case 'heading':
      return (
        <div
          style={{
            marginTop: `${styling.margin.top}px`,
            marginBottom: `${styling.margin.bottom}px`,
          }}
          className="flex items-center gap-1.5"
        >
          {styling.accentBar && (
            <span
              className="w-1 self-stretch rounded-full shrink-0"
              style={{ backgroundColor: styling.accentBarColor || primaryColor }}
            />
          )}
          <h2
            style={{
              fontFamily: styling.fontFamily,
              fontSize: `${styling.fontSize}pt`,
              fontWeight: 700,
              color: styling.textColor,
              textTransform: styling.textTransform,
            }}
          >
            {specialProps.numberingFormat === 'ROMAN' && 'I. '}
            {specialProps.numberingFormat === 'ARABIC' && '1. '}
            GIỚI THIỆU
          </h2>
        </div>
      );

    case 'body-text':
      return (
        <div style={containerStyle}>
          <p
            style={{
              textIndent: `${(styling.firstLineIndent ?? 4) * 2}px`,
            }}
          >
            {styling.dropCap && (
              <span
                className="float-left text-3xl font-serif font-black mr-1 leading-none"
                style={{ color: primaryColor }}
              >
                V
              </span>
            )}
            {styling.dropCap ? 'ăn bản' : 'Văn bản'} khoa học đóng vai trò trung tâm trong công tác công bố và lan toả tri thức học thuật. Các tạp chí thuộc hệ sinh thái Đại học Quốc gia TP.HCM đòi hỏi quy chuẩn dàn trang nghiêm ngặt về số cột, lề trang, font chữ và phong cách trích dẫn.
          </p>
        </div>
      );

    case 'callout-box':
      return (
        <div style={containerStyle}>
          <div className="font-bold mb-1 flex items-center gap-1 text-[9pt]" style={{ color: styling.borderColor }}>
            <span>{specialProps.calloutTitle || '⚡ Điểm nhấn nghiên cứu'}</span>
          </div>
          <div className="whitespace-pre-wrap text-[8.5pt] leading-snug">
            {specialProps.customContentSample || 'Nội dung điểm nhấn mang tính đột phá.'}
          </div>
        </div>
      );

    case 'custom-field':
      return (
        <div style={containerStyle}>
          <div className="font-bold text-[8.5pt] text-slate-800 mb-0.5">{element.name}:</div>
          <div className="text-[8.5pt] text-slate-600 leading-snug">
            {specialProps.customContentSample || 'Nội dung chi tiết được định nghĩa tùy ý.'}
          </div>
        </div>
      );

    case 'references-block':
      return (
        <div style={containerStyle}>
          <div className="font-bold uppercase text-[9pt] mb-2" style={{ color: primaryColor }}>
            {specialProps.referenceHeadingText || 'Tài liệu tham khảo'}
          </div>
          <div className="space-y-1 font-serif text-[8pt]">
            <div>
              [1] Nguyen, H. N., & Tran, M. T. (2025). Automated Academic Typesetting from DOCX Documents. Sci. Tech. Dev. J., 28(2), 112-124.
            </div>
            <div>
              [2] VNU-HCM Publishing House. (2024). Guidelines for Scientific Paper Formatting and Citation Standards.
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div style={containerStyle}>
          <div className="text-xs font-semibold">{element.name}</div>
        </div>
      );
  }
}
