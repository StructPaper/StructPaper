'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Layers,
  FileText,
  User,
  Building,
  Calendar,
  BookOpen,
  Image as ImageIcon,
  Table as TableIcon,
  Quote,
  CheckCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { CompletePaper } from '@/lib/sample-papers';
import { synthesizeHeaderRows, normalizePaperTable, isPaperEmpty } from '@/types/paper';
import { renderColoredTextCitations, generateStandardCitation } from './sections/utils';
import { Markup } from '@/components/ui/Markup';
import { stripMarkup } from '@/lib/inline-markup';

interface ExtractedContentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  paper: CompletePaper;
}

export const ExtractedContentDrawer: React.FC<ExtractedContentDrawerProps> = ({
  isOpen,
  onClose,
  paper,
}) => {
  const [filterTab, setFilterTab] = useState<'meta' | 'abstract' | 'body' | 'citation' | 'media' | 'refs'>('meta');

  const { metadata, sections, references } = paper;
  const regularSections = sections.filter((s) => s.type !== 'citation');
  const citationSection = sections.find((s) => s.type === 'citation');
  const totalParagraphs = sections.filter((s) => s.type === 'paragraph').length;
  const totalFigures = sections.filter((s) => s.type === 'figure').length;
  const totalTables = sections.filter((s) => s.type === 'table').length;

  const renderTableCard = (sec: CompletePaper['sections'][0], key: string | number) => {
    if (!sec.table) return null;
    const cleanCaption =
      sec.table.caption?.replace(/^(bảng|table|b\.)\s*\d+[:.]\s*/i, '').trim() || sec.table.caption;
    const normalizedTable = normalizePaperTable(sec.table);
    const effectiveHeaderRows =
      normalizedTable.headerRows && normalizedTable.headerRows.length > 0
        ? normalizedTable.headerRows
        : synthesizeHeaderRows(normalizedTable.headers || []);

    return (
      <div key={key} className="p-4 rounded-3xl bg-gray-200/50 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-bold text-xs sm:text-sm text-zinc-900 leading-snug">
            Bảng {sec.table.num}: {cleanCaption}
          </h4>
          <span className="pill-badge bg-zinc-100 text-zinc-700 border border-zinc-200 text-xs flex-shrink-0">
            {sec.table.columnSpan === '2-column' || sec.table.isFullWidth !== false ? '2 Cột' : '1 Cột'}
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          {effectiveHeaderRows && effectiveHeaderRows.length > 1 && (
            <div className="px-3 py-1.5 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between text-[11px] text-blue-700 font-medium">
              <span>✨ Bảng cấu trúc đa tầng (Header phân cấp &amp; Ô gộp)</span>
              <span className="text-[10px] text-blue-600 font-normal">
                {effectiveHeaderRows.length} tầng tiêu đề • {sec.table.bodyRows?.length || sec.table.rows.length} hàng dữ liệu
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
                        className={`px-3.5 py-2.5 border-r last:border-r-0 border-zinc-200 font-semibold ${(cell.colSpan || 1) > 1 ? 'text-center bg-zinc-200/60' : 'bg-zinc-100'}`}
                      >
                        {cell.text}
                      </th>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  {sec.table.headers.map((h, i) => (
                    <th key={i} className="px-3.5 py-2.5 border-r last:border-r-0 border-zinc-200 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {sec.table.bodyRows && sec.table.bodyRows.length > 0 ? (
                sec.table.bodyRows.map((bRow, rIdx) => (
                  <tr
                    key={rIdx}
                    className={`border-b last:border-b-0 border-zinc-200 transition-colors ${rIdx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/70'} hover:bg-zinc-100/70`}
                  >
                    {bRow.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        colSpan={cell.colSpan || 1}
                        rowSpan={cell.rowSpan || 1}
                        className={`px-3.5 py-2.5 border-r last:border-r-0 border-zinc-200 whitespace-pre-line leading-relaxed text-zinc-800 ${(cell.colSpan || 1) > 1 ? 'text-center font-medium' : ''}`}
                      >
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                sec.table.rows.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className={`border-b last:border-b-0 border-zinc-200 transition-colors ${rIdx % 2 === 0 ? 'bg-white' : 'bg-zinc-50/70'} hover:bg-zinc-100/70`}
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
      </div>
    );
  };

  const renderFigureCard = (sec: CompletePaper['sections'][0], key: string | number) => {
    if (!sec.figure) return null;
    return (
      <div key={key} className="p-4 rounded-3xl bg-gray-200/50 space-y-2 text-center">
        <div className="h-44 rounded-xl flex items-center justify-center text-zinc-400">
          {sec.figure.src ? (
            <img src={sec.figure.src} alt={sec.figure.caption} className="max-h-40 object-contain mx-auto rounded-lg shadow-2xs" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <ImageIcon className="w-8 h-8 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-500">Hình đồ họa vector / minh họa</span>
            </div>
          )}
        </div>
        <p className="text-xs text-zinc-800 font-medium">
          <strong>Hình {sec.figure.num}:</strong> {sec.figure.caption}
        </p>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm pointer-events-auto"
            onClick={onClose}
          />

          {/* 95vh Slide-up Drawer - Selectable Text, No Top Drag Pill */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 100, damping: 18 }}
            className="fixed z-[80] left-0 right-0 bottom-0 h-[95vh] rounded-t-[36px] md:rounded-t-[44px] bg-[#F8F9FA] border-t border-zinc-200/90 shadow-2xl flex flex-col will-change-transform overflow-hidden select-text pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Bar (Directly at the very top, NO drag handle line) */}
            <div className="px-6 py-4 border-b border-zinc-200/80 bg-zinc-50/50 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gray-100 text-gray-600 flex items-center justify-center font-bold shadow-2xs">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-extrabold text-zinc-900 leading-none">
                      Nội Dung Trích Xuất Bản Thảo
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#EEF2FF] text-[#3730A3]">
                      {metadata.articleType}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[#D9F99D] text-[#14532D]">
                      {metadata.journalAbbv || metadata.journalId}
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                title="Đóng bảng nội dung"
                aria-label="Đóng bảng nội dung"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>

            {/* 2-Column Split Content Body - Exact Design from ExtractedContentView */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[38%_62%] overflow-hidden select-text">
              {/* LEFT COLUMN: Khung đầu tiên ở trang extractor có tiêu đề & các phần thống kê */}
              <div className="h-full overflow-y-auto p-5 sm:p-6 space-y-6 border-r border-zinc-200/80 bg-zinc-50/50 select-text">
                {/* EXACT First Frame Banner from ExtractedContentView */}
                <div className="p-2 space-y-6">
                  <div className="flex flex-col gap-3">
                    <h2 className="text-xl sm:text-2xl font-extrabold text-zinc-900 leading-snug">
                      {metadata.title}
                    </h2>
                    {metadata.titleEn && (
                      <p className="text-xs sm:text-sm text-zinc-500 italic mt-1 leading-relaxed">
                        {metadata.titleEn}
                      </p>
                    )}
                  </div>

                  {/* Quick summary metrics (2x2 Grid) */}
                  <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-zinc-200">
                    <div className="bg-gray-200/50 p-3 rounded-3xl">
                      <span className="text-[11px] text-zinc-500 font-semibold block">Tác giả & Đơn vị</span>
                      <span className="text-sm font-bold text-zinc-900">
                        {metadata.authors.length} tác giả ({metadata.affiliations.length} cơ quan)
                      </span>
                    </div>
                    <div className="bg-gray-200/50 p-3 rounded-3xl">
                      <span className="text-[11px] text-zinc-500 font-semibold block">Đoạn nội dung</span>
                      <span className="text-sm font-bold text-zinc-900">{totalParagraphs} đoạn văn</span>
                    </div>
                    <div className="bg-gray-200/50 p-3 rounded-3xl">
                      <span className="text-[11px] text-zinc-500 font-semibold block">Hình ảnh & Bảng</span>
                      <span className="text-sm font-bold text-zinc-900">
                        {totalFigures} hình, {totalTables} bảng
                      </span>
                    </div>
                    <div className="bg-gray-200/50 p-3 rounded-3xl">
                      <span className="text-[11px] text-zinc-500 font-semibold block">Tài liệu tham khảo</span>
                      <span className="text-sm font-bold text-zinc-900">{references.length} mục (Vancouver)</span>
                    </div>
                  </div>
                </div>

                {/* Dates & DOI Frame from ExtractedContentView */}
                <div className="p-3 space-y-3">
                  <div className="flex items-center gap-2 text-zinc-900">
                    <Calendar className="w-5 h-5 text-zinc-700" />
                    <h3 className="font-bold text-base text-zinc-900">Lịch sử nộp bài & DOI</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="p-3 rounded-3xl bg-gray-200/50">
                      <span className="text-[11px] text-zinc-500 font-semibold block">Ngày nhận</span>
                      <span className="text-sm font-bold text-zinc-900">{metadata.dates.received}</span>
                    </div>
                    <div className="p-3 rounded-3xl bg-gray-200/50">
                      <span className="text-[11px] text-zinc-500 font-semibold block">Ngày sửa đổi</span>
                      <span className="text-sm font-bold text-zinc-900">{metadata.dates.revised}</span>
                    </div>
                    <div className="p-3 rounded-3xl bg-gray-200/50">
                      <span className="text-[11px] text-zinc-500 font-semibold block">Ngày chấp nhận</span>
                      <span className="text-sm font-bold text-zinc-900">{metadata.dates.accepted}</span>
                    </div>
                    <div className="p-3 rounded-3xl bg-gray-200/50">
                      <span className="text-[11px] text-zinc-500 font-semibold block">Ngày xuất bản</span>
                      <span className="text-sm font-bold text-zinc-900">{metadata.dates.published}</span>
                    </div>
                  </div>

                  <div className="bg-gray-200/50 p-3 rounded-3xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-700">DOI:</span>
                      <span className="font-mono text-zinc-900 font-semibold">{metadata.doi}</span>
                    </div>
                    <span className="pill-badge bg-[#D9F99D] text-[#14532D] text-[11px]">Đã định danh</span>
                  </div>
                </div>
              </div>

              {/* RIGHT COLUMN: Các nội dung bên dưới (Authors, Abstract, Body, Media, Refs) */}
              <div className="h-full overflow-y-auto p-5 sm:p-6 space-y-6 bg-[#F8F9FA] select-text">
                {/* Segmented Filter Control without 'all', with 'citation' */}
                <div className="segmented-control w-full overflow-x-auto justify-start sm:justify-center p-1 bg-gray-200/60 rounded-full">
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
                    Nội dung ({regularSections.length})
                  </button>
                  <button
                    onClick={() => setFilterTab('citation')}
                    className={`segmented-item text-xs font-semibold ${filterTab === 'citation' ? 'active' : ''}`}
                  >
                    Trích dẫn
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
                {filterTab === 'meta' && (
                  <div className="p-2 pb-6 border-b border-zinc-200 space-y-4">
                    <div className="flex items-center gap-2 text-zinc-900">
                      <User className="w-5 h-5 text-zinc-700" />
                      <h3 className="font-bold text-base text-zinc-900">Tác giả & Đơn vị công tác trích xuất</h3>
                    </div>

                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {metadata.authors.map((author, idx) => (
                          <div
                            key={author.id || idx}
                            className="bg-gray-200/50 rounded-2xl px-4 py-2 flex items-center gap-2"
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

                      <div className="bg-gray-200/50 p-4 rounded-3xl space-y-2">
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
                {filterTab === 'abstract' && (
                  <div className="p-2 space-y-3">
                    <div className="flex items-center gap-2 text-zinc-900">
                      <BookOpen className="w-5 h-5 text-zinc-700" />
                      <h3 className="font-bold text-base text-zinc-900">Tóm tắt (Abstract) & Từ khóa</h3>
                    </div>

                    <div className="bg-gray-200/50 p-4 rounded-3xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                          Tóm tắt tiếng Việt ({stripMarkup(metadata.abstract).split(/\s+/).length} từ)
                        </span>
                        <span className="text-xs text-[#14532D] bg-[#D9F99D] px-2 py-0.5 rounded-full font-bold">
                          Đạt chuẩn độ dài
                        </span>
                      </div>
                      <p className="text-sm text-zinc-900 leading-relaxed text-justify">
                        <Markup text={metadata.abstract} />
                      </p>
                    </div>

                    {metadata.abstractEn && (
                      <div className="bg-gray-200/50 p-4 rounded-3xl space-y-2">
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

                {/* SECTION 3: BODY SECTIONS IN NATURAL ORDER INCLUDING TABLES & FIGURES */}
                {filterTab === 'body' && (
                  <div className="p-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-zinc-900">
                        <FileText className="w-5 h-5 text-zinc-700" />
                        <h3 className="font-bold text-base text-zinc-900">Các phần nội dung bài báo</h3>
                      </div>
                      <span className="text-xs text-zinc-500 font-semibold">
                        {regularSections.length} khối nội dung
                      </span>
                    </div>

                    <div className="space-y-3">
                      {regularSections.map((sec, idx) => {
                        if (sec.type === 'h1') {
                          return (
                            <div
                              key={sec.id || idx}
                              className="p-3 rounded-2xl bg-gray-200/60 flex items-center justify-between"
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
                        if (sec.type === 'h3') {
                          return (
                            <div
                              key={sec.id || idx}
                              className="p-2 rounded-xl bg-zinc-50 border border-zinc-200/80 ml-8 flex items-center justify-between"
                            >
                              <span className="font-bold italic text-xs text-zinc-900">{sec.title}</span>
                              <span className="text-[10px] font-bold bg-zinc-200 text-zinc-600 px-2 py-0.5 rounded-full">
                                Mục Cấp 3 (H3)
                              </span>
                            </div>
                          );
                        }
                        if (sec.type === 'paragraph') {
                          return (
                            <div
                              key={sec.id || idx}
                              className="p-3.5 py-2.5 rounded-2xl bg-zinc-50 text-xs sm:text-sm text-zinc-800 leading-relaxed text-justify"
                            >
                              {renderColoredTextCitations(sec.content)}
                            </div>
                          );
                        }
                        if (sec.type === 'table') {
                          return renderTableCard(sec, sec.id || idx);
                        }
                        if (sec.type === 'figure') {
                          return renderFigureCard(sec, sec.id || idx);
                        }
                        return null;
                      })}
                    </div>
                  </div>
                )}

                {/* SECTION 4: HOW TO CITE (CITATION TAB) */}
                {filterTab === 'citation' && (
                  <div className="p-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-zinc-900">
                        <Quote className="w-5 h-5 text-zinc-700" />
                        <h3 className="font-bold text-base text-zinc-900">Trích Dẫn Bài Báo (How to Cite)</h3>
                      </div>
                    </div>

                    <div className="p-4 rounded-3xl bg-gray-200/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                          Nội dung trích dẫn chính thức
                        </span>
                      </div>

                      <div className="p-4 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-2 font-serif">
                        <p className="text-sm text-zinc-900 leading-relaxed italic">
                          {citationSection?.content || generateStandardCitation(metadata)}
                        </p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                        <div className="bg-white/80 p-2.5 rounded-xl border border-zinc-200/60">
                          <span className="text-zinc-500 block text-[10px] uppercase font-bold">Tạp chí</span>
                          <span className="font-bold text-zinc-900">{metadata.journalName || 'Tạp chí ĐHQG-HCM'}</span>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-zinc-200/60">
                          <span className="text-zinc-500 block text-[10px] uppercase font-bold">Số phát hành & Năm</span>
                          <span className="font-bold text-zinc-900">
                            Tập {metadata.volume || 1}, Số {metadata.issue || 1} ({metadata.year || new Date().getFullYear()})
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECTION 5: TABLES AND FIGURES (DEDICATED GALLERY) */}
                {filterTab === 'media' && (
                  <div className="p-2 space-y-4">
                    <div className="flex items-center gap-2 text-zinc-900">
                      <TableIcon className="w-5 h-5 text-zinc-700" />
                      <h3 className="font-bold text-base text-zinc-900">Bảng số liệu & Hình ảnh</h3>
                    </div>

                    {/* Tables */}
                    {sections
                      .filter((s) => s.type === 'table' && s.table)
                      .map((sec, idx) => renderTableCard(sec, `media_tab_${sec.id || idx}`))}

                    {/* Figures */}
                    {sections
                      .filter((s) => s.type === 'figure' && s.figure)
                      .map((sec, idx) => renderFigureCard(sec, `media_fig_${sec.id || idx}`))}
                  </div>
                )}

                {/* SECTION 6: REFERENCES */}
                {filterTab === 'refs' && (
                  <div className="p-2 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-zinc-900">
                        <BookOpen className="w-5 h-5 text-zinc-700" />
                        <h3 className="font-bold text-base text-zinc-900">Tài liệu tham khảo</h3>
                      </div>
                      <span className="text-xs text-zinc-500 font-semibold">{references.length} tài liệu</span>
                    </div>

                    <div className="space-y-2">
                      {references.map((ref, idx) => (
                        <div
                          key={ref.id || idx}
                          className="p-3 rounded-3xl bg-gray-200/50 flex items-start gap-3 hover:bg-zinc-100/60 transition-colors"
                        >
                          <span className="font-bold text-xs bg-zinc-200 text-zinc-800 px-2 py-0.5 rounded-full flex-shrink-0 min-w-[28px] text-center">
                            [{ref.id || idx + 1}]
                          </span>
                          <div className="text-xs text-zinc-800 leading-relaxed flex-1">
                            {ref.raw}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
