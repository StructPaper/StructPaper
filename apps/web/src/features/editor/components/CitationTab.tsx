'use client';

import React, { useState, useRef } from 'react';
import { PaperMetadata } from '@/types/paper';
import { Bookmark, Sparkles, Copy, Check, Info, FileText } from 'lucide-react';
import { generateStandardCitation } from './sections/utils';
import { sileo } from '@/components/DynamicIslandToast';
import { useTabScrollRestoration } from '../hooks';

interface CitationTabProps {
  citationText: string;
  onChange: (updatedCitation: string) => void;
  metadata?: PaperMetadata;
}

export const CitationTab: React.FC<CitationTabProps> = ({
  citationText,
  onChange,
  metadata,
}) => {
  const [copied, setCopied] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useTabScrollRestoration('citation', scrollContainerRef);

  const handleGenerate = () => {
    if (!metadata) return;
    const generated = generateStandardCitation(metadata);
    onChange(generated);
    sileo.success({
      title: 'Đã tạo trích dẫn chuẩn',
      description: 'Tổng hợp thành công định dạng trích dẫn từ Metadata bài báo.',
    });
  };

  const handleCopy = async () => {
    if (!citationText) return;
    try {
      await navigator.clipboard.writeText(citationText);
      setCopied(true);
      sileo.success({
        title: 'Đã sao chép',
        description: 'Đã sao chép chuỗi trích dẫn vào clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const wordCount = citationText
    ? citationText.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div ref={scrollContainerRef} className="h-full flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-5">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-200/80 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Bookmark className="w-4 h-4 text-zinc-700" />
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
              Trích Dẫn Bài Báo Này (How to Cite)
            </h3>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {metadata && (
            <button
              type="button"
              onClick={handleGenerate}
              className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Tự động đồng bộ và tổng hợp trích dẫn từ Tác giả, Tiêu đề, Tạp chí, Tập, Số..."
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Tạo từ Metadata</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            disabled={!citationText}
            className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 text-xs font-bold flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            title="Sao chép nội dung trích dẫn vào bộ nhớ tạm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-extrabold">Đã sao chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-zinc-500" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        </div>
      </div>


      {/* 3. Text Editor Card */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-zinc-700 flex items-center gap-1">
            <span>Nội dung trích dẫn bài báo:</span>
          </label>
          <span className="text-[11px] font-bold text-zinc-500">
            {wordCount} từ &bull; {citationText?.length || 0} ký tự
          </span>
        </div>

        <textarea
          value={citationText}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
          placeholder="Ví dụ: Nguyen HN, Tran TM, Le VK. Nghiên cứu ứng dụng AI trong nhận dạng chữ viết tay cổ. Sci. Tech. Dev. J. - Health Sci. 2026; 10(2):45-52. https://doi.org/10.32508/stdjhs.v10i2.630"
          className="w-full p-3.5 rounded-2xl border border-zinc-200 text-xs sm:text-sm leading-relaxed text-zinc-900 bg-white shadow-2xs focus:outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-400 transition-all font-serif italic"
        />
      </div>

      {/* 4. Format Breakdown Guide */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800">
          <Info className="w-4 h-4 text-zinc-500" />
          <span>Cấu trúc quy chuẩn của chuỗi trích dẫn (Vancouver / VNUHCM):</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
          <div className="p-2.5 bg-gray-200/50 rounded-2xl">
            <span className="font-bold text-zinc-800 block mb-0.5">1. Tác giả & Tiêu đề</span>
            <span className="text-zinc-500 text-[11px]">
              Tên tác giả viết dạng &quot;Họ TênViếtTắt&quot;, ngăn cách bởi dấu phẩy. Kế đến là tiêu đề bài báo đầy đủ.
            </span>
          </div>

          <div className="p-2.5 bg-gray-200/50 rounded-2xl">
            <span className="font-bold text-zinc-800 block mb-0.5">2. Tạp chí & Năm</span>
            <span className="text-zinc-500 text-[11px]">
              Tên viết tắt tạp chí chuẩn (VD: Sci. Tech. Dev. J. - Health Sci.), năm xuất bản theo sau dấu chấm.
            </span>
          </div>

          <div className="p-2.5 bg-gray-200/50 rounded-2xl">
            <span className="font-bold text-zinc-800 block mb-0.5">3. Tập, Số & Khoảng trang</span>
            <span className="text-zinc-500 text-[11px]">
              Định dạng <code>Tập(Số):TrangĐầu-TrangCuối</code> (VD: <code>10(2):45-52</code>).
            </span>
          </div>

          <div className="p-2.5 bg-gray-200/50 rounded-2xl">
            <span className="font-bold text-zinc-800 block mb-0.5">4. Mã định danh số DOI</span>
            <span className="text-zinc-500 text-[11px]">
              Đường dẫn DOI hợp lệ của bài báo (VD: <code>https://doi.org/10.32508/...</code>).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
