'use client';

import React, { useState } from 'react';
import {
  DocumentTemplateSchema,
  TemplateBuilderCategory,
} from '@/types/template-builder';
import { SAMPLE_CONTENTS, PreviewSampleContent } from '@/lib/template-builder/sample-contents';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  FileText,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface TemplateLivePreviewProps {
  schema: DocumentTemplateSchema;
  onSelectCategory?: (category: TemplateBuilderCategory) => void;
}

export const TemplateLivePreview: React.FC<TemplateLivePreviewProps> = ({
  schema,
  onSelectCategory,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(85); // percentage
  const [selectedSampleId, setSelectedSampleId] = useState<string>('cs_ai');

  const currentSample: PreviewSampleContent =
    SAMPLE_CONTENTS.find((s) => s.id === selectedSampleId) || SAMPLE_CONTENTS[0];

  const {
    pageSetup,
    title,
    authors,
    abstract,
    keywords,
    heading1,
    heading2,
    heading3,
    body,
    floats,
    references,
    primaryColor,
  } = schema;

  const isSplitLayout = pageSetup.firstPageLayout === 'sidebar-split';

  // Helper for numbering headings
  const getH1Number = (index: number) => {
    if (heading1.numbering === 'ROMAN') {
      const romans = ['I.', 'II.', 'III.', 'IV.', 'V.'];
      return romans[index] || `${index + 1}.`;
    }
    if (heading1.numbering === 'ARABIC') return `${index + 1}.`;
    if (heading1.numbering === 'LETTER') {
      const letters = ['A.', 'B.', 'C.', 'D.'];
      return letters[index] || `${index + 1}.`;
    }
    return '';
  };

  return (
    <div className="flex flex-col h-full bg-slate-200/60 rounded-3xl border border-black/5 overflow-hidden">
      {/* Top Preview Control Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white/80 backdrop-blur-md border-b border-black/5">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold">
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
            <span>Mô phỏng in ấn A4 (Live Preview)</span>
          </div>

          {/* Sample Discipline Switcher */}
          <select
            value={selectedSampleId}
            onChange={(e) => setSelectedSampleId(e.target.value)}
            className="text-xs bg-slate-100 hover:bg-slate-200/70 border-0 rounded-xl px-2.5 py-1 text-slate-700 font-medium outline-none cursor-pointer"
          >
            {SAMPLE_CONTENTS.map((sample) => (
              <option key={sample.id} value={sample.id}>
                Nội dung: {sample.discipline}
              </option>
            ))}
          </select>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setZoomLevel((prev) => Math.max(50, prev - 10))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs font-mono text-slate-600 w-10 text-center font-medium">
            {zoomLevel}%
          </span>
          <button
            onClick={() => setZoomLevel((prev) => Math.min(130, prev + 10))}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors"
            title="Phóng to"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setZoomLevel(85)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors text-xs font-medium"
            title="Tỷ lệ chuẩn"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Viewport for A4 Paper */}
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
            onClick={() => onSelectCategory?.('page')}
            className="cursor-pointer hover:outline-2 hover:outline-dashed hover:outline-emerald-500 hover:outline-offset-2 transition-all"
            style={{
              paddingTop: `${Math.max(12, pageSetup.margins.top * 1.3)}px`,
              paddingLeft: `${Math.max(16, pageSetup.margins.left * 1.3)}px`,
              paddingRight: `${Math.max(16, pageSetup.margins.right * 1.3)}px`,
            }}
          >
            {pageSetup.showRunningHeader && (
              <div className="flex items-center justify-between pb-2 border-b border-slate-300 mb-4 text-[10px] text-slate-500 font-sans">
                <span className="font-semibold uppercase tracking-wider text-slate-600">
                  {pageSetup.journalName}
                </span>
                <span>{pageSetup.headerText}</span>
              </div>
            )}

            {pageSetup.articleType && (
              <div
                className="text-[10px] font-bold uppercase tracking-wider mb-2 font-sans"
                style={{ color: pageSetup.articleTypeColor || primaryColor }}
              >
                {pageSetup.articleType}
              </div>
            )}
          </div>

          {/* Main Paper Content Container */}
          <div
            style={{
              paddingLeft: `${Math.max(16, pageSetup.margins.left * 1.3)}px`,
              paddingRight: `${Math.max(16, pageSetup.margins.right * 1.3)}px`,
              paddingBottom: `${Math.max(16, pageSetup.margins.bottom * 1.3)}px`,
            }}
          >
            {/* Title Block */}
            <div
              onClick={() => onSelectCategory?.('title')}
              className="cursor-pointer hover:outline-2 hover:outline-dashed hover:outline-blue-500 hover:outline-offset-2 transition-all"
              style={{
                textAlign: title.align,
                marginBottom: `${title.spaceAfter}px`,
              }}
            >
              <h1
                style={{
                  fontFamily: title.fontFamily,
                  fontSize: `${title.fontSize}pt`,
                  fontWeight:
                    title.fontWeight === 'extrabold'
                      ? 800
                      : title.fontWeight === 'black'
                      ? 900
                      : title.fontWeight === 'bold'
                      ? 700
                      : 400,
                  color: title.color,
                  lineHeight: title.lineHeight,
                }}
              >
                {currentSample.title}
              </h1>

              {title.supportBilingual && (
                <div
                  className="mt-1.5 italic text-slate-600 font-serif"
                  style={{ fontSize: `${title.enTitleFontSize}pt` }}
                >
                  Automated Academic Typesetting and OpenXML Structural Extraction for VNUHCM Scientific Journals
                </div>
              )}
            </div>

            {/* Authors Block */}
            <div
              onClick={() => onSelectCategory?.('title')}
              className="cursor-pointer hover:outline-2 hover:outline-dashed hover:outline-blue-500 hover:outline-offset-2 transition-all"
              style={{
                textAlign: authors.align,
                marginBottom: `${authors.spaceAfter}px`,
              }}
            >
              <div
                style={{
                  fontSize: `${authors.fontSize}pt`,
                  fontWeight: authors.fontWeight === 'bold' ? 700 : 400,
                  fontStyle: authors.fontStyle,
                }}
                className="text-slate-800"
              >
                {currentSample.authors.map((a, i) => (
                  <span key={i}>
                    <span className="font-medium">{a.name}</span>
                    <sup className="text-emerald-700 font-bold ml-0.5">
                      {a.affilId}
                      {a.isCorr && '*'}
                    </sup>
                    {i < currentSample.authors.length - 1 && ', '}
                  </span>
                ))}
              </div>

              {authors.showAffiliations && (
                <div className="mt-1 text-[9pt] text-slate-500 leading-relaxed font-sans">
                  {currentSample.affiliations.map((affil, i) => (
                    <div key={i}>
                      <sup>{i + 1}</sup> {affil}
                    </div>
                  ))}
                  {authors.showCorresponding && (
                    <div className="text-[8.5pt] text-slate-400 mt-0.5">
                      <sup>*</sup> Tác giả liên hệ: {currentSample.corrEmail}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Front Matter: Split Sidebar 28/72 vs Standard Span 100% */}
            {isSplitLayout ? (
              <div
                onClick={() => onSelectCategory?.('abstract')}
                className="grid grid-cols-12 gap-4 mb-4 cursor-pointer hover:outline-2 hover:outline-dashed hover:outline-emerald-500 hover:outline-offset-2 transition-all"
              >
                {/* Left 28% Sidebar (History / DOI / Licensing) */}
                <div className="col-span-3 border-r border-slate-200 pr-3 text-[8.5pt] text-slate-600 font-sans space-y-2">
                  <div>
                    <div className="font-bold text-slate-800 uppercase tracking-tight text-[8pt]">
                      Lịch sử bài báo
                    </div>
                    <div className="text-slate-500 mt-0.5 text-[7.5pt] space-y-0.5">
                      <div>Ngày nhận: 12/08/2026</div>
                      <div>Ngày duyệt: 28/09/2026</div>
                      <div>Ngày đăng: 15/10/2026</div>
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-slate-800 uppercase tracking-tight text-[8pt]">
                      Định danh DOI
                    </div>
                    <div className="text-blue-600 text-[7.5pt] font-mono break-all mt-0.5">
                      10.32508/stdj.v28i2.630
                    </div>
                  </div>

                  <div>
                    <div className="font-bold text-slate-800 uppercase tracking-tight text-[8pt]">
                      Bản quyền
                    </div>
                    <div className="text-slate-400 text-[7pt] leading-tight mt-0.5">
                      © 2026 ĐHQG TP.HCM. Bài báo mở theo giấy phép CC-BY 4.0.
                    </div>
                  </div>
                </div>

                {/* Right 72% Abstract & Keywords Panel */}
                <div className="col-span-9">
                  <div
                    style={{
                      borderLeft:
                        abstract.borderStyle === 'left-solid'
                          ? `3.5px solid ${abstract.borderColor}`
                          : abstract.borderStyle === 'all-borders'
                          ? `1px solid ${abstract.borderColor}`
                          : 'none',
                      borderTop:
                        abstract.borderStyle === 'all-borders' || abstract.borderStyle === 'top-bottom'
                          ? `1px solid ${abstract.borderColor}`
                          : 'none',
                      borderBottom:
                        abstract.borderStyle === 'all-borders' || abstract.borderStyle === 'top-bottom'
                          ? `1px solid ${abstract.borderColor}`
                          : 'none',
                      borderRight:
                        abstract.borderStyle === 'all-borders'
                          ? `1px solid ${abstract.borderColor}`
                          : 'none',
                      backgroundColor:
                        abstract.backgroundColor === 'transparent' ? 'transparent' : abstract.backgroundColor,
                      padding: `${abstract.padding * 1.5}px`,
                      borderRadius: abstract.borderStyle === 'all-borders' ? '6px' : '2px',
                    }}
                  >
                    <div
                      className="mb-1"
                      style={{
                        fontWeight: abstract.labelWeight === 'extrabold' ? 800 : 700,
                        fontSize: `${abstract.fontSize}pt`,
                        color: primaryColor,
                      }}
                    >
                      {abstract.label}
                    </div>

                    <p
                      style={{
                        fontSize: `${abstract.fontSize}pt`,
                        fontStyle: abstract.fontStyle,
                        lineHeight: abstract.lineHeight,
                      }}
                      className="text-slate-800 text-justify"
                    >
                      {currentSample.abstract}
                    </p>

                    {/* Keywords inside panel */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectCategory?.('abstract');
                      }}
                      className="mt-2 text-[9pt] font-sans"
                    >
                      <span
                        className={keywords.labelBold ? 'font-bold text-slate-900' : 'text-slate-700'}
                      >
                        {keywords.label}{' '}
                      </span>
                      <span className="text-slate-700">
                        {currentSample.keywords.join(keywords.separator)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Standard Full Span 100% Abstract Box */
              <div
                onClick={() => onSelectCategory?.('abstract')}
                className="mb-4 cursor-pointer hover:outline-2 hover:outline-dashed hover:outline-emerald-500 hover:outline-offset-2 transition-all"
                style={{
                  borderLeft:
                    abstract.borderStyle === 'left-solid'
                      ? `3.5px solid ${abstract.borderColor}`
                      : abstract.borderStyle === 'all-borders'
                      ? `1px solid ${abstract.borderColor}`
                      : 'none',
                  borderTop:
                    abstract.borderStyle === 'all-borders' || abstract.borderStyle === 'top-bottom'
                      ? `1px solid ${abstract.borderColor}`
                      : 'none',
                  borderBottom:
                    abstract.borderStyle === 'all-borders' || abstract.borderStyle === 'top-bottom'
                      ? `1px solid ${abstract.borderColor}`
                      : 'none',
                  borderRight:
                    abstract.borderStyle === 'all-borders'
                      ? `1px solid ${abstract.borderColor}`
                      : 'none',
                  backgroundColor:
                    abstract.backgroundColor === 'transparent' ? 'transparent' : abstract.backgroundColor,
                  padding: `${abstract.padding * 1.5}px`,
                  borderRadius: abstract.borderStyle === 'all-borders' ? '6px' : '2px',
                }}
              >
                <div
                  className="mb-1"
                  style={{
                    fontWeight: abstract.labelWeight === 'extrabold' ? 800 : 700,
                    fontSize: `${abstract.fontSize}pt`,
                    color: primaryColor,
                  }}
                >
                  {abstract.label}:
                </div>

                <p
                  style={{
                    fontSize: `${abstract.fontSize}pt`,
                    fontStyle: abstract.fontStyle,
                    lineHeight: abstract.lineHeight,
                  }}
                  className="text-slate-800 text-justify"
                >
                  {currentSample.abstract}
                </p>

                {/* Keywords */}
                <div className="mt-2 text-[9pt] font-sans">
                  <span
                    className={keywords.labelBold ? 'font-bold text-slate-900' : 'text-slate-700'}
                  >
                    {keywords.label}{' '}
                  </span>
                  <span className="text-slate-700">
                    {currentSample.keywords.join(keywords.separator)}
                  </span>
                </div>
              </div>
            )}

            {/* Main Body Flow with Multi-Columns */}
            <div
              style={{
                columnCount: pageSetup.columns,
                columnGap: `${pageSetup.columnGap * 2.8}px`,
                columnRule: pageSetup.showColumnRule ? `1px solid ${pageSetup.columnRuleColor}` : 'none',
              }}
            >
              {/* Sections from sample paper */}
              {currentSample.sections.map((sec, secIdx) => {
                const isH1 = sec.level === 1;
                const hConfig = isH1 ? heading1 : heading2;
                const numberingText = isH1 ? getH1Number(secIdx) : '1.1.';

                return (
                  <div key={secIdx} className="break-inside-avoid-column mb-3">
                    {/* Heading Element */}
                    <div
                      onClick={() => onSelectCategory?.('headings')}
                      className="cursor-pointer hover:outline-1 hover:outline-dashed hover:outline-purple-500 transition-all flex items-center gap-1.5"
                      style={{
                        marginTop: `${hConfig.spaceBefore}px`,
                        marginBottom: `${hConfig.spaceAfter}px`,
                      }}
                    >
                      {hConfig.accentBar && (
                        <span
                          className="w-1 self-stretch rounded-full shrink-0"
                          style={{ backgroundColor: hConfig.accentColor }}
                        />
                      )}
                      <h2
                        style={{
                          fontFamily: hConfig.fontFamily,
                          fontSize: `${hConfig.fontSize}pt`,
                          fontWeight:
                            hConfig.fontWeight === 'extrabold'
                              ? 800
                              : hConfig.fontWeight === 'black'
                              ? 900
                              : 700,
                          color: hConfig.accentColor,
                          textTransform: hConfig.textTransform,
                        }}
                      >
                        {numberingText && <span className="mr-1">{numberingText}</span>}
                        {sec.title}
                      </h2>
                    </div>

                    {/* Paragraphs with body styling */}
                    <div
                      onClick={() => onSelectCategory?.('body')}
                      className="cursor-pointer hover:outline-1 hover:outline-dashed hover:outline-emerald-500 transition-all"
                    >
                      {sec.paragraphs.map((p, pIdx) => (
                        <p
                          key={pIdx}
                          style={{
                            fontFamily: body.fontFamily,
                            fontSize: `${body.fontSize}pt`,
                            lineHeight: body.lineHeight,
                            textIndent: `${body.firstLineIndent * 2}px`,
                            textAlign: body.align,
                            marginBottom: `${body.paragraphSpacing}px`,
                          }}
                          className="text-slate-800"
                        >
                          {p}
                        </p>
                      ))}
                    </div>

                    {/* Inject a sample table or figure in section 2 */}
                    {secIdx === 1 && (
                      <div
                        onClick={() => onSelectCategory?.('floats')}
                        className="my-3 p-2 bg-slate-50 rounded border border-slate-200 cursor-pointer hover:outline-1 hover:outline-dashed hover:outline-blue-500 transition-all"
                        style={{ margin: `${floats.spaceAround}px 0` }}
                      >
                        <div
                          className="text-center font-sans mb-1"
                          style={{
                            fontSize: `${floats.captionFontSize}pt`,
                            fontWeight: floats.captionWeight === 'bold' ? 700 : 400,
                          }}
                        >
                          <span style={{ color: primaryColor }}>{floats.captionPrefix} 1: </span>
                          Bảng so sánh thời gian bóc tách và độ chính xác
                        </div>

                        <table className="w-full text-[8pt] border-collapse font-sans">
                          <thead>
                            <tr style={{ backgroundColor: floats.tableHeaderBackground }}>
                              <th className="p-1 border border-slate-300 text-left">Phương pháp</th>
                              <th className="p-1 border border-slate-300 text-right">Thời gian (s)</th>
                              <th className="p-1 border border-slate-300 text-right">Độ chính xác (%)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className={floats.zebraStripes ? 'bg-white' : ''}>
                              <td className="p-1 border border-slate-200">OpenXML Parser</td>
                              <td className="p-1 border border-slate-200 text-right font-mono">1.25</td>
                              <td className="p-1 border border-slate-200 text-right font-mono">98.4%</td>
                            </tr>
                            <tr className={floats.zebraStripes ? 'bg-slate-100/70' : 'bg-white'}>
                              <td className="p-1 border border-slate-200">Rule-based NLP</td>
                              <td className="p-1 border border-slate-200 text-right font-mono">3.40</td>
                              <td className="p-1 border border-slate-200 text-right font-mono">92.1%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* References Section */}
              <div
                onClick={() => onSelectCategory?.('references')}
                className="break-inside-avoid-column mt-4 pt-2 border-t border-slate-200 cursor-pointer hover:outline-1 hover:outline-dashed hover:outline-amber-500 transition-all"
              >
                <div
                  className="font-bold text-slate-800 mb-2 uppercase"
                  style={{
                    fontFamily: heading1.fontFamily,
                    fontSize: `${heading1.fontSize * 0.95}pt`,
                    color: primaryColor,
                  }}
                >
                  {references.headingText}
                </div>

                <div className="space-y-1.5 font-serif">
                  {currentSample.references.map((refText, rIdx) => (
                    <div
                      key={rIdx}
                      style={{
                        fontSize: `${references.fontSize}pt`,
                        paddingLeft: `${references.hangingIndent * 2}px`,
                        textIndent: `-${references.hangingIndent * 2}px`,
                        lineHeight: references.lineHeight,
                      }}
                      className="text-slate-700 leading-snug"
                    >
                      {references.style === 'Vancouver' && (
                        <span className="font-bold font-mono mr-1">[{rIdx + 1}]</span>
                      )}
                      {references.style === 'IEEE' && (
                        <span className="font-bold font-mono mr-1">[{rIdx + 1}]</span>
                      )}
                      {refText}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Running Footer & Page Number */}
          {pageSetup.showPageNumbers && (
            <div
              className="absolute bottom-4 left-0 right-0 px-8 flex items-center justify-between text-[8.5pt] text-slate-400 font-sans"
              style={{
                justifyContent:
                  pageSetup.pageNumberPosition === 'bottom-center'
                    ? 'center'
                    : pageSetup.pageNumberPosition === 'bottom-right'
                    ? 'flex-end'
                    : 'flex-end',
              }}
            >
              <span>Trang 1 / 4</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
