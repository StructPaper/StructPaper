'use client';

import React, { useRef, useEffect } from 'react';
import { MetadataTabProps } from './types';
import { Select, SelectOption, DatePicker } from '../ui';
import { FileText, Calendar, BookOpen, Tag } from 'lucide-react';
import { PublicationInfoFields } from './PublicationInfoFields';
import { ArticleTypeField } from './ArticleTypeField';
import { useTabScrollRestoration } from './hooks';
import {
  useEditorCommandBus,
  dispatchTitleChange,
  dispatchTitleEnChange,
  dispatchAbstractChange,
  dispatchAbstractEnChange,
  dispatchKeywordsChange,
  dispatchKeywordsEnChange,
  dispatchDatesChange,
  dispatchMetadataField,
} from './command-bus-adapter';

// Health Sciences (VNUHCM-HS) has 8 distinct article types per requirements
export const HS_ARTICLE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'Bài báo nghiên cứu', label: 'Bài báo nghiên cứu', badge: 'Research Articles', description: 'Nghiên cứu nguyên bản thực nghiệm/lâm sàng' },
  { value: 'Bài tổng quan', label: 'Bài tổng quan', badge: 'Reviews', description: 'Tổng quan hệ thống, tài liệu y khoa' },
  { value: 'Báo cáo ca lâm sàng', label: 'Báo cáo ca lâm sàng', badge: 'Case Reports', description: 'Báo cáo ca bệnh điển hình lâm sàng' },
  { value: 'Phương pháp luận', label: 'Phương pháp luận', badge: 'Methodologies', description: 'Phương pháp & kỹ thuật nghiên cứu y sinh' },
  { value: 'Bình luận & Ý kiến', label: 'Bình luận & Ý kiến', badge: 'Commentaries', description: 'Bình luận, trao đổi học thuật chuyên môn' },
  { value: 'Đính chính', label: 'Đính chính', badge: 'Corrections', description: 'Đính chính thông tin công bố khoa học' },
  { value: 'Bài xã luận', label: 'Bài xã luận', badge: 'Editorials', description: 'Xã luận từ Ban biên tập tạp chí' },
  { value: 'Thư gửi tòa soạn', label: 'Thư gửi tòa soạn', badge: 'Letters', description: 'Thư góp ý & thảo luận học thuật gửi tòa soạn' },
];

// All other journals only have 1 single article type: Research Article
export const STANDARD_ARTICLE_TYPE_OPTIONS: SelectOption[] = [
  { value: 'Bài báo nghiên cứu', label: 'Bài báo nghiên cứu', badge: 'Research Article', description: 'Công trình nghiên cứu khoa học nguyên bản' },
  { value: 'Bài nghiên cứu', label: 'Bài nghiên cứu', badge: 'Research Article', description: 'Tên gọi in trên bài mẫu của tạp chí (VNUHCM-EBL)' },
];

export const MetadataTab: React.FC<MetadataTabProps> = ({
  metadata,
  onChange,
  commandBus: propCommandBus,
  showAbstractAndKeywords = false,
}) => {
  const contextCommandBus = useEditorCommandBus().commandBus;
  const activeBus = propCommandBus || contextCommandBus;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useTabScrollRestoration('metadata', scrollContainerRef);

  const titleViRef = useRef<HTMLTextAreaElement>(null);
  const titleEnRef = useRef<HTMLTextAreaElement>(null);
  const abstractViRef = useRef<HTMLTextAreaElement>(null);
  const abstractEnRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content without any maximum height limit
  const autoResize = (element: HTMLTextAreaElement | null) => {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    autoResize(titleViRef.current);
  }, [metadata.title]);

  useEffect(() => {
    autoResize(titleEnRef.current);
  }, [metadata.titleEn]);

  useEffect(() => {
    autoResize(abstractViRef.current);
  }, [metadata.abstract]);

  useEffect(() => {
    autoResize(abstractEnRef.current);
  }, [metadata.abstractEn]);

  const handleKeywordsChange = (val: string) => {
    const list = val.split(',').map((k) => k.trim()).filter(Boolean);
    dispatchKeywordsChange(activeBus, list, onChange, metadata);
  };

  const handleKeywordsEnChange = (val: string) => {
    const list = val.split(',').map((k) => k.trim()).filter(Boolean);
    dispatchKeywordsEnChange(activeBus, list, onChange, metadata);
  };

  return (
    <div ref={scrollContainerRef} className="h-full flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 pb-12 space-y-4">
      {/* Header Title */}
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/60">
        <FileText className="w-4 h-4 text-zinc-700" />
        <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
          Thông tin cơ bản bài báo & Xuất bản
        </h3>
      </div>

      {/* Vietnamese Title */}
      <div>
        <label className="text-xs font-bold text-zinc-700 block mb-1.5">
          Tựa đề bài báo (Tiếng Việt):
        </label>
        <textarea
          ref={titleViRef}
          value={metadata.title}
          onChange={(e) => {
            dispatchTitleChange(activeBus, e.target.value, onChange, metadata);
            autoResize(e.target);
          }}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          style={{ resize: 'none', overflow: 'hidden' }}
          className="w-full min-h-[56px] p-3 rounded-2xl border border-zinc-200 text-sm font-semibold text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 transition-all leading-snug shadow-2xs"
          placeholder="Nhập tựa đề bài báo tiếng Việt..."
        />
        {metadata.titleOriginal && metadata.titleOriginal !== metadata.title && (
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-600" data-testid="title-normalized">
            <span>Tựa đề trong Word viết HOA toàn bộ nên đã đổi sang kiểu câu như bản in.</span>
            <button
              type="button"
              onClick={() => onChange({ ...metadata, title: metadata.titleOriginal as string, titleOriginal: undefined })}
              className="px-2 py-0.5 rounded-full bg-white border border-zinc-200 font-bold text-zinc-700 hover:bg-zinc-50"
            >
              Hoàn tác
            </button>
          </div>
        )}
      </div>

      {/* English Title */}
      <div>
        <label className="text-xs font-bold text-zinc-700 block mb-1.5">
          Tựa đề bài báo (Tiếng Anh - nếu có):
        </label>
        <textarea
          ref={titleEnRef}
          value={metadata.titleEn || ''}
          onChange={(e) => {
            dispatchTitleEnChange(activeBus, e.target.value, onChange, metadata);
            autoResize(e.target);
          }}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          style={{ resize: 'none', overflow: 'hidden' }}
          className="w-full min-h-[56px] p-3 rounded-2xl border border-zinc-200 text-sm italic text-zinc-800 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 transition-all leading-snug shadow-2xs"
          placeholder="Article Title in English..."
        />
      </div>

      {/* Article Type & DOI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <ArticleTypeField metadata={metadata} onChange={onChange} commandBus={activeBus} />

      </div>

      {/* Publication Dates */}
      <div className="pt-2">
        <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5 mb-2">
          <Calendar className="w-3.5 h-3.5 text-zinc-500" />
          Các mốc thời gian xuất bản (Tòa soạn):
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <DatePicker
            label="Ngày nhận:"
            value={metadata.dates?.received || ''}
            onChange={(val) => dispatchDatesChange(activeBus, { received: val }, onChange, metadata)}
            placeholder="02-10-2026"
          />

          <DatePicker
            label="Ngày sửa đổi:"
            value={metadata.dates?.revised || ''}
            onChange={(val) => dispatchDatesChange(activeBus, { revised: val }, onChange, metadata)}
            placeholder="05-10-2026"
          />

          <DatePicker
            label="Ngày chấp nhận:"
            value={metadata.dates?.accepted || ''}
            onChange={(val) => dispatchDatesChange(activeBus, { accepted: val }, onChange, metadata)}
            placeholder="08-10-2026"
          />
        </div>
      </div>

      <PublicationInfoFields metadata={metadata} onChange={onChange} />

      {/* Tóm tắt & Từ khóa (Abstract & Keywords) */}
      {showAbstractAndKeywords && (
        <div className="pt-4 border-t border-zinc-200/60 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/60">
            <BookOpen className="w-4 h-4 text-zinc-700" />
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
              Tóm tắt & Từ khóa (Abstract & Keywords)
            </h3>
          </div>

          {/* Vietnamese Abstract */}
          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1.5">
              Tóm tắt bài báo (Tiếng Việt):
            </label>
            <textarea
              ref={abstractViRef}
              value={metadata.abstract || ''}
              onChange={(e) => {
                dispatchAbstractChange(activeBus, e.target.value, onChange, metadata);
                autoResize(e.target);
              }}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              style={{ resize: 'none', overflow: 'hidden' }}
              className="w-full min-h-[72px] p-3 rounded-2xl border border-zinc-200 text-xs text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 leading-relaxed shadow-2xs"
              placeholder="Nhập phần tóm tắt tiếng Việt..."
            />
          </div>

          {/* English Abstract */}
          <div>
            <label className="text-xs font-bold text-zinc-700 block mb-1.5">
              Tóm tắt tiếng Anh (Abstract in English):
            </label>
            <textarea
              ref={abstractEnRef}
              value={metadata.abstractEn || ''}
              onChange={(e) => {
                dispatchAbstractEnChange(activeBus, e.target.value, onChange, metadata);
                autoResize(e.target);
              }}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              style={{ resize: 'none', overflow: 'hidden' }}
              className="w-full min-h-[72px] p-3 rounded-2xl border border-zinc-200 text-xs italic text-zinc-800 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 leading-relaxed shadow-2xs"
              placeholder="Enter English abstract..."
            />
          </div>

          {/* Keywords Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5 mb-1.5">
                <Tag className="w-3.5 h-3.5 text-zinc-500" />
                Từ khóa bài báo (Tiếng Việt, cách nhau bằng dấu phẩy):
              </label>
              <input
                type="text"
                value={(metadata.keywords || []).join(', ')}
                onChange={(e) => handleKeywordsChange(e.target.value)}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                className="w-full p-2.5 rounded-2xl border border-zinc-200 text-xs text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs"
                placeholder="nghiên cứu y sinh, tế bào, thử nghiệm lâm sàng"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5 mb-1.5">
                <Tag className="w-3.5 h-3.5 text-zinc-500" />
                Keywords in English (comma-separated):
              </label>
              <input
                type="text"
                value={(metadata.keywordsEn || []).join(', ')}
                onChange={(e) => handleKeywordsEnChange(e.target.value)}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                className="w-full p-2.5 rounded-2xl border border-zinc-200 text-xs italic text-zinc-800 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs"
                placeholder="biomedical research, cell culture, clinical trial"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
