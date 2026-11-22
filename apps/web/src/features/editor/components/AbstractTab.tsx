'use client';

import React from 'react';
import { AbstractTabProps } from './types';
import { BookOpen, Tag, Info } from 'lucide-react';
import { useTabScrollRestoration } from '../hooks';
import { KeywordsInput } from './KeywordsInput';
import { RichLineInput } from './sections/RichLineInput';
import { stripMarkup } from '@/lib/inline-markup';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const resize = React.useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  React.useEffect(() => {
    resize();
  }, [value, resize]);

  React.useEffect(() => {
    const handleWindowResize = () => resize();
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [resize]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        resize();
      }}
      rows={3}
      placeholder={placeholder}
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      style={{ resize: 'none', overflow: 'hidden' }}
      className={`[field-sizing:content] ${className}`}
    />
  );
};

export const AbstractTab: React.FC<AbstractTabProps> = ({ metadata, onChange }) => {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  useTabScrollRestoration('abstract', scrollContainerRef);

  const vnWordCount = metadata.abstract
    ? stripMarkup(metadata.abstract).trim().split(/\s+/).filter(Boolean).length
    : 0;

  const enWordCount = metadata.abstractEn
    ? stripMarkup(metadata.abstractEn).trim().split(/\s+/).filter(Boolean).length
    : 0;

  const handleKeywordsChange = (list: string[]) => onChange({ ...metadata, keywords: list });
  const handleKeywordsEnChange = (list: string[]) => onChange({ ...metadata, keywordsEn: list });

  return (
    <div ref={scrollContainerRef} className="h-full flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
      {/* Header Title */}
      <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/60">
        <BookOpen className="w-4 h-4 text-zinc-700" />
        <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
          Tóm tắt & Từ khóa (Abstract & Keywords)
        </h3>
      </div>

      {/* Vietnamese Abstract */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-zinc-700">
            Tóm tắt tiếng Việt (Abstract):
          </label>
          <span
            className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              vnWordCount >= 150 && vnWordCount <= 300
                ? 'bg-[#D9F99D] text-[#14532D]'
                : vnWordCount > 0
                ? 'bg-zinc-100 text-zinc-600'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {vnWordCount} từ {vnWordCount > 0 && '(Khuyến nghị 150 - 250 từ)'}
          </span>
        </div>
        {/* the abstract shows its bold and italic as they print (the paper keeps them as tags in the text) */}
        <RichLineInput
          value={metadata.abstract || ''}
          onChange={(val) => onChange({ ...metadata, abstract: val })}
          ariaLabel="Tóm tắt tiếng Việt"
          className="w-full min-h-[8rem] p-3.5 rounded-2xl border border-zinc-200 text-sm leading-relaxed text-zinc-900 bg-white shadow-2xs focus-within:ring-4 focus-within:ring-blue-200 focus-within:border-blue-300 transition-all cursor-text"
          placeholder="Nội dung tóm tắt tiếng Việt nêu rõ mục tiêu, phương pháp, kết quả và ý nghĩa..."
        />
      </div>

      {/* English Abstract */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-bold text-zinc-700">
            Abstract (English - nếu có):
          </label>
          {enWordCount > 0 && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">
              {enWordCount} words
            </span>
          )}
        </div>
        <RichLineInput
          value={metadata.abstractEn || ''}
          onChange={(val) => onChange({ ...metadata, abstractEn: val })}
          ariaLabel="English abstract"
          className="w-full min-h-[8rem] p-3.5 rounded-2xl border border-zinc-200 text-sm leading-relaxed text-zinc-800 bg-white shadow-2xs focus-within:ring-4 focus-within:ring-blue-200 focus-within:border-blue-300 transition-all cursor-text"
          placeholder="English abstract including objectives, methods, results and conclusion..."
        />
      </div>

        {/* Keywords Vietnamese */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
            <Tag className="w-3.5 h-3.5 text-zinc-500" />
            <span>Từ khóa tiếng Việt (phân cách bằng dấu phẩy):</span>
          </div>
          <KeywordsInput
            value={metadata.keywords || []}
            onChange={handleKeywordsChange}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className="w-full p-2.5 rounded-2xl border border-zinc-200 text-xs text-zinc-900 bg-white shadow-2xs focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300"
            placeholder="vd: Tế bào quang điện, màng mỏng, hiệu suất, TCO..."
          />
          {metadata.keywords && metadata.keywords.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {metadata.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200/60"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Keywords English */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700">
            <Tag className="w-3.5 h-3.5 text-zinc-500" />
            <span>Keywords (English - comma separated):</span>
          </div>
          <KeywordsInput
            value={metadata.keywordsEn || []}
            onChange={handleKeywordsEnChange}
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            className="w-full p-2.5 rounded-2xl border border-zinc-200 text-xs text-zinc-900 bg-zinc-50/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300"
            placeholder="e.g. Photovoltaic cells, thin films, efficiency, TCO..."
          />
          {metadata.keywordsEn && metadata.keywordsEn.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              {metadata.keywordsEn.map((kw, i) => (
                <span
                  key={i}
                  className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200/60 italic"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
  );
};
