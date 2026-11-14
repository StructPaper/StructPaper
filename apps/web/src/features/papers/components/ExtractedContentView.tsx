'use client';

import React, { useState } from 'react';
import { CompletePaper } from '@/lib/sample-papers';
import { synthesizeHeaderRows, normalizePaperTable, isPaperEmpty } from '@/types/paper';
import {
  FileText,
  User,
  Building,
  Calendar,
  BookOpen,
  Image as ImageIcon,
  Table as TableIcon,
  Quote,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface ExtractedContentViewProps {
  paper: CompletePaper;
  onEditSection?: (sectionId: string) => void;
  onGoToEditor: () => void;
  onGoToPreview?: () => void;
}

export const ExtractedContentView: React.FC<ExtractedContentViewProps> = ({
  paper,
  onGoToEditor,
  onGoToPreview,
}) => {
  const [filterTab, setFilterTab] = useState<'all' | 'meta' | 'abstract' | 'body' | 'media' | 'refs'>('all');

  if (isPaperEmpty(paper)) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center">
        <div className="soft-card p-10 sm:p-14 bg-white border border-zinc-200/80 rounded-[48px] shadow-sm space-y-5">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-zinc-100 flex items-center justify-center text-zinc-400">
            <FileText className="w-10 h-10 text-zinc-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900">
              Chưa có nội dung bản thảo
            </h2>
            <p className="text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
              Bạn chưa tải lên bài báo nào hoặc chưa tạo nội dung. Hãy bắt đầu bằng cách tải lên file tài liệu Word (.docx) hoặc khởi tạo một bản thảo mới.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <a
              href="/upload"
              className="btn-pill-lime text-xs px-5 py-2.5 flex items-center gap-2 shadow-2xs hover:scale-105 active:scale-95 transition-all"
            >
              <FileText className="w-4 h-4" />
              <span>Tải file Word lên</span>
            </a>
            <button
              onClick={onGoToEditor}
              className="btn-pill-subtle text-xs px-5 py-2.5 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Soạn thảo với template trống</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { metadata, sections, references } = paper;

  const totalParagraphs = sections.filter((s) => s.type === 'paragraph').length;
  const totalFigures = sections.filter((s) => s.type === 'figure').length;
  const totalTables = sections.filter((s) => s.type === 'table').length;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-8">
      {/* Overview Stat Header Banner matching Reference Photo */}
      <div className="soft-card p-6 bg-white border border-zinc-200/80 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#EEF2FF] text-[#3730A3]">
                {metadata.articleType}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#D9F99D] text-[#14532D]">
                {metadata.journalAbbv || metadata.journalId}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 leading-snug">
              {metadata.title}
            </h2>
            {metadata.titleEn && (
              <p className="text-xs sm:text-sm text-zinc-500 italic mt-1">{metadata.titleEn}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 self-start sm:self-center">
            <button onClick={onGoToEditor} className="btn-pill-lime text-xs">
              <Sparkles className="w-3.5 h-3.5" /> Biên tập & Dàn trang PDF
            </button>
          </div>
        </div>

        {/* Quick summary metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-100">
          <div className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-2xl">
            <span className="text-[11px] text-zinc-500 font-semibold block">Tác giả & Đơn vị</span>
            <span className="text-sm font-bold text-zinc-900">
              {metadata.authors.length} tác giả ({metadata.affiliations.length} cơ quan)
            </span>
          </div>
          <div className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-2xl">
            <span className="text-[11px] text-zinc-500 font-semibold block">Đoạn nội dung</span>
            <span className="text-sm font-bold text-zinc-900">{totalParagraphs} đoạn văn</span>
          </div>
          <div className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-2xl">
            <span className="text-[11px] text-zinc-500 font-semibold block">Hình ảnh & Bảng</span>
            <span className="text-sm font-bold text-zinc-900">
              {totalFigures} hình, {totalTables} bảng
            </span>
          </div>
          <div className="bg-zinc-50 border border-zinc-200/80 p-3 rounded-2xl">
            <span className="text-[11px] text-zinc-500 font-semibold block">Tài liệu tham khảo</span>
            <span className="text-sm font-bold text-zinc-900">{references.length} mục (Vancouver)</span>
          </div>
        </div>
      </div>

      {/* Segmented Filter Control matching Reference Photo's "Data | Records" switcher */}
      <div className="segmented-control w-full overflow-x-auto justify-start sm:justify-center p-1 bg-zinc-200/60 rounded-full border border-zinc-200">
        <button
          onClick={() => setFilterTab('all')}
          className={`segmented-item text-xs font-semibold ${filterTab === 'all' ? 'active' : ''}`}
        >
          Tất cả các mục
        </button>
        <button
          onClick={() => setFilterTab('meta')}
          className={`segmented-item text-xs font-semibold ${filterTab === 'meta' ? 'active' : ''}`}
        >
          Tác giả & Cơ quan ({metadata.authors.length})
        </button>
        <button
          onClick={() => setFilterTab('abstract')}
          className={`segmented-item text-xs font-semibold ${filterTab === 'abstract' ? 'active' : ''}`}
        >
          Tóm tắt & Từ khóa
        </button>
        <button
          onClick={() => setFilterTab('body')}
          className={`segmented-item text-xs font-semibold ${filterTab === 'body' ? 'active' : ''}`}
        >
          Các phần nội dung ({sections.length})
        </button>
        <button
          onClick={() => setFilterTab('media')}
          className={`segmented-item text-xs font-semibold ${filterTab === 'media' ? 'active' : ''}`}
        >
          Bảng & Hình ({totalFigures + totalTables})
        </button>
        <button
          onClick={() => setFilterTab('refs')}
          className={`segmented-item text-xs font-semibold ${filterTab === 'refs' ? 'active' : ''}`}
        >
          Tài liệu tham khảo ({references.length})
        </button>
      </div>

      {/* SECTION 1: AUTHORS & AFFILIATIONS */}
      {(filterTab === 'all' || filterTab === 'meta') && (
        <div className="soft-card p-6 bg-white space-y-4">
          <div className="flex items-center gap-2 text-zinc-900">
            <User className="w-5 h-5 text-zinc-700" />
            <h3 className="font-bold text-base text-zinc-900">Tác giả & Đơn vị công tác trích xuất</h3>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {metadata.authors.map((author, idx) => (
                <div
                  key={author.id || idx}
                  className="bg-zinc-50 border border-zinc-200/80 rounded-2xl px-4 py-2 flex items-center gap-2"
                >
                  <span className="font-bold text-sm text-zinc-900">{author.name}</span>
                  <span className="text-xs bg-[#EEF2FF] text-[#3730A3] font-bold px-1.5 py-0.5 rounded-full">
                    {author.affiliationIds.join(', ')}
                  </span>
                  {author.isCorresponding && (
                    <span className="text-xs bg-zinc-100 text-zinc-800 font-bold px-2 py-0.5 rounded-full border border-zinc-200">
                      Tác giả liên hệ*
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="bg-zinc-50 p-4 rounded-2xl space-y-2 border border-zinc-200/80">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-zinc-600" /> Cơ quan / Viện nghiên cứu
              </h4>
              {metadata.affiliations.map((aff) => (
                <p key={aff.id} className="text-xs text-zinc-800 flex items-start gap-2">
                  <span className="font-bold text-zinc-900 min-w-[16px]">{aff.id}.</span>
                  <span>{aff.name}</span>
                </p>
              ))}
            </div>

            {metadata.corresponding && (
              <div className="bg-lime-50/70 p-3 rounded-2xl border border-lime-200/80 text-xs text-lime-900 flex items-center justify-between">
                <span>
                  <strong>Liên hệ:</strong> {metadata.corresponding.name} &bull; Email:{' '}
                  <span className="underline font-semibold">{metadata.corresponding.email}</span>
                </span>
                <span className="pill-badge bg-[#D9F99D] text-[#14532D] text-[11px]">Đã xác thực</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 2: ABSTRACT & KEYWORDS */}
      {(filterTab === 'all' || filterTab === 'abstract') && (
        <div className="soft-card p-6 bg-white space-y-4">
          <div className="flex items-center gap-2 text-zinc-900">
            <BookOpen className="w-5 h-5 text-zinc-700" />
            <h3 className="font-bold text-base text-zinc-900">Tóm tắt (Abstract) & Từ khóa</h3>
          </div>

          <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Tóm tắt tiếng Việt ({metadata.abstract.split(/\s+/).length} từ)
              </span>
              <span className="text-xs text-[#14532D] bg-[#D9F99D] px-2 py-0.5 rounded-full font-bold">
                Đạt chuẩn độ dài
              </span>
            </div>
            <p className="text-sm text-zinc-900 leading-relaxed text-justify">{metadata.abstract}</p>
          </div>

          {metadata.abstractEn && (
            <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200/80 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                Abstract (English)
              </span>
              <p className="text-sm text-zinc-900 leading-relaxed text-justify italic">
                {metadata.abstractEn}
              </p>
            </div>
          )}

          {/* Keywords Chips */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-zinc-500 block">Từ khóa (Keywords):</span>
            <div className="flex flex-wrap gap-2">
              {metadata.keywords.map((kw, idx) => {
                const colors = [
                  'bg-[#EEF2FF] text-[#3730A3]',
                  'bg-[#D9F99D] text-[#14532D]',
                  'bg-zinc-100 text-zinc-700 border border-zinc-200',
                  'bg-indigo-50 text-indigo-700',
                  'bg-rose-50 text-rose-700',
                ];
                const color = colors[idx % colors.length];
                return (
                  <span key={idx} className={`pill-badge text-xs ${color}`}>
                    {kw}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DATES & DOI */}
      {(filterTab === 'all' || filterTab === 'meta') && (
        <div className="soft-card p-6 bg-white space-y-3">
          <div className="flex items-center gap-2 text-zinc-900">
            <Calendar className="w-5 h-5 text-zinc-700" />
            <h3 className="font-bold text-base text-zinc-900">Lịch sử nộp bài & DOI</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80">
              <span className="text-[11px] text-zinc-500 font-semibold block">Ngày nhận</span>
              <span className="text-sm font-bold text-zinc-900">{metadata.dates.received}</span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80">
              <span className="text-[11px] text-zinc-500 font-semibold block">Ngày sửa đổi</span>
              <span className="text-sm font-bold text-zinc-900">{metadata.dates.revised}</span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80">
              <span className="text-[11px] text-zinc-500 font-semibold block">Ngày chấp nhận</span>
              <span className="text-sm font-bold text-zinc-900">{metadata.dates.accepted}</span>
            </div>
            <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80">
              <span className="text-[11px] text-zinc-500 font-semibold block">Ngày xuất bản</span>
              <span className="text-sm font-bold text-zinc-900">{metadata.dates.published}</span>
            </div>
          </div>

          <div className="bg-zinc-50 p-3 rounded-2xl border border-zinc-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-zinc-700">DOI:</span>
              <span className="font-mono text-zinc-900 font-semibold">{metadata.doi}</span>
            </div>
            <span className="pill-badge bg-[#D9F99D] text-[#14532D] text-[11px]">Đã định danh</span>
          </div>
        </div>
      )}

      {/* SECTION 4: BODY SECTIONS & HEADINGS */}
      {(filterTab === 'all' || filterTab === 'body') && (
        <div className="soft-card p-6 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-900">
              <FileText className="w-5 h-5 text-zinc-700" />
              <h3 className="font-bold text-base text-zinc-900">Các phần nội dung bài báo</h3>
            </div>
            <span className="text-xs text-zinc-500 font-semibold">
              {sections.length} khối nội dung
            </span>
          </div>

          <div className="space-y-3">
            {sections.map((sec, idx) => {
              if (sec.type === 'h1') {
                return (
                  <div
                    key={sec.id || idx}
                    className="p-3 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-between"
                  >
                    <span className="font-bold text-sm text-zinc-900 uppercase tracking-wide">
                      {sec.title}
                    </span>
                    <span className="text-[11px] font-bold bg-zinc-900 text-white px-2.5 py-0.5 rounded-full shadow-2xs">
                      Mục Cấp 1 (H1)
                    </span>
                  </div>
                );
              }
              if (sec.type === 'h2') {
                return (
                  <div
                    key={sec.id || idx}
                    className="p-2.5 rounded-xl bg-zinc-50 border border-zinc-200/80 ml-4 flex items-center justify-between"
                  >
                    <span className="font-bold text-xs text-zinc-900">{sec.title}</span>
                    <span className="text-[10px] font-bold bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">
                      Mục Cấp 2 (H2)
                    </span>
                  </div>
                );
              }
              if (sec.type === 'paragraph') {
                return (
                  <div
                    key={sec.id || idx}
                    className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs sm:text-sm text-zinc-800 leading-relaxed text-justify"
                  >
                    {sec.content}
                  </div>
                );
              }
              if (sec.type === 'citation') {
                return (
                  <div
                    key={sec.id || idx}
                    className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80 text-xs sm:text-sm text-blue-900 leading-relaxed space-y-1 shadow-2xs font-serif italic"
                  >
                    <div className="flex items-center gap-1.5 not-italic font-sans text-xs font-bold text-blue-800">
                      <Quote className="w-3.5 h-3.5 text-blue-600" />
                      <span>Trích dẫn bài báo này (Citation):</span>
                    </div>
                    <p>{sec.content}</p>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}

      {/* SECTION 5: TABLES AND FIGURES */}
      {(filterTab === 'all' || filterTab === 'media') && (
        <div className="soft-card p-6 bg-white space-y-4">
          <div className="flex items-center gap-2 text-zinc-900">
            <TableIcon className="w-5 h-5 text-zinc-700" />
            <h3 className="font-bold text-base text-zinc-900">Bảng số liệu & Hình ảnh</h3>
          </div>

          {/* Tables */}
          {sections
            .filter((s) => s.type === 'table' && s.table)
            .map((sec, idx) => {
              const cleanCaption =
                sec.table?.caption?.replace(/^(bảng|table|b\.)\s*\d+[:.]\s*/i, '').trim() || sec.table?.caption;
              return (
                <div key={idx} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-bold text-xs sm:text-sm text-zinc-900 leading-snug">
                      Bảng {sec.table?.num}: {cleanCaption}
                    </h4>
                    <span className="pill-badge bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs flex-shrink-0">Full-width</span>
                  </div>
                  {(() => {
                    const normalizedTable = sec.table ? normalizePaperTable(sec.table) : null;
                    const effectiveHeaderRows =
                      normalizedTable?.headerRows && normalizedTable.headerRows.length > 0
                        ? normalizedTable.headerRows
                        : synthesizeHeaderRows(normalizedTable?.headers || []);
                    return (
                      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
                        {effectiveHeaderRows && effectiveHeaderRows.length > 1 && (
                          <div className="px-3 py-1.5 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between text-[11px] text-blue-700 font-medium">
                            <span>✨ Bảng cấu trúc đa tầng (Header phân cấp &amp; Ô gộp)</span>
                            <span className="text-[10px] text-blue-600 font-normal">
                              {effectiveHeaderRows.length} tầng tiêu đề • {sec.table?.bodyRows?.length || sec.table?.rows.length} hàng dữ liệu
                            </span>
                          </div>
                        )}
                        <table className="w-full text-xs text-left">
                          <thead className="bg-zinc-100 text-zinc-800 font-bold border-b border-zinc-200">
                            {effectiveHeaderRows && effectiveHeaderRows.length > 0 ? (
                              effectiveHeaderRows.map((hRow, hrIdx) => (
                                <tr key={hrIdx} className="border-b last:border-b-0 border-zinc-200">
                                  {hRow.map((cell, cIdx) => (
                                    <th
                                      key={cIdx}
                                      colSpan={cell.colSpan || 1}
                                      rowSpan={cell.rowSpan || 1}
                                      className={`px-3.5 py-2.5 border-r last:border-r-0 border-zinc-200 font-semibold ${
                                        (cell.colSpan || 1) > 1 ? 'text-center bg-zinc-200/60' : 'bg-zinc-100'
                                      }`}
                                    >
                                      {cell.text}
                                    </th>
                                  ))}
                                </tr>
                              ))
                            ) : (
                              <tr>
                                {sec.table?.headers.map((h, i) => (
                                  <th key={i} className="px-3.5 py-2.5 border-r last:border-r-0 border-zinc-200 font-semibold">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            )}
                          </thead>
                          <tbody>
                            {sec.table?.bodyRows && sec.table.bodyRows.length > 0 ? (
                              sec.table.bodyRows.map((bRow, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className={`border-b last:border-b-0 border-zinc-200 transition-colors ${
                                    rIdx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/70'
                                  } hover:bg-zinc-100/70`}
                                >
                                  {bRow.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      colSpan={cell.colSpan || 1}
                                      rowSpan={cell.rowSpan || 1}
                                      className={`px-3.5 py-2.5 border-r last:border-r-0 border-zinc-200 whitespace-pre-line leading-relaxed text-zinc-800 ${
                                        (cell.colSpan || 1) > 1 ? 'text-center font-medium' : ''
                                      }`}
                                    >
                                      {cell.text}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            ) : (
                              sec.table?.rows.map((row, rIdx) => (
                                <tr
                                  key={rIdx}
                                  className={`border-b last:border-b-0 border-zinc-200 transition-colors ${
                                    rIdx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/70'
                                  } hover:bg-zinc-100/70`}
                                >
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className="px-3.5 py-2.5 border-r last:border-r-0 border-zinc-200 whitespace-pre-line leading-relaxed text-zinc-800"
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              );
            })}

          {/* Figures */}
          {sections
            .filter((s) => s.type === 'figure' && s.figure)
            .map((sec, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80 space-y-2 text-center">
                <div className="h-44 bg-zinc-100 rounded-xl flex items-center justify-center text-zinc-400 border border-dashed border-zinc-300">
                  {sec.figure?.src ? (
                    <img src={sec.figure.src} alt={sec.figure.caption} className="max-h-40 object-contain mx-auto" />
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <ImageIcon className="w-8 h-8 text-zinc-400" />
                      <span className="text-xs font-semibold text-zinc-500">Hình đồ họa vector / minh họa</span>
                    </div>
                  )}
                </div>
                <p className="font-bold text-xs text-zinc-900 text-center">
                  Hình {sec.figure?.num}: {sec.figure?.caption}
                </p>
                {sec.figure?.source && (
                  <p className="text-[11px] text-zinc-500 italic text-center">
                    {sec.figure.source}
                  </p>
                )}
              </div>
            ))}

          {totalFigures === 0 && totalTables === 0 && (
            <p className="text-xs text-zinc-400 italic">Không phát hiện bảng hoặc hình ảnh bổ sung trong bài này.</p>
          )}
        </div>
      )}

      {/* SECTION 6: REFERENCES (VANCOUVER) */}
      {(filterTab === 'all' || filterTab === 'refs') && (
        <div className="soft-card p-6 bg-white space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-zinc-900">
              <Quote className="w-5 h-5 text-zinc-700" />
              <h3 className="font-bold text-base text-zinc-900">Tài liệu tham khảo (Chuẩn Vancouver)</h3>
            </div>
            <span className="pill-badge bg-[#D9F99D] text-[#14532D] text-xs">
              {references.length} mục tham khảo
            </span>
          </div>

          <div className="space-y-2">
            {references.map((ref) => (
              <div
                key={ref.id}
                className="p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 flex items-start gap-3 hover:bg-zinc-100/70 transition-all"
              >
                <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {ref.id}
                </div>
                <div className="flex-1 text-xs text-zinc-800 leading-relaxed">
                  <p>{ref.raw}</p>
                  {ref.doi && (
                    <a
                      href={`https://doi.org/${ref.doi}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold mt-1 hover:underline"
                    >
                      DOI: {ref.doi} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {ref.isCited ? (
                    <span className="text-[10px] font-bold bg-[#D9F99D] text-[#14532D] px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Đã cite
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-600" /> Chưa cite
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
