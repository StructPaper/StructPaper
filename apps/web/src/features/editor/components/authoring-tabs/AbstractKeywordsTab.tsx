'use client';

import React, { useState } from 'react';
import { PaperMetadata } from '@/types/paper';
import { AlignLeft, Tag, Plus, X, Sparkles } from 'lucide-react';

interface AbstractKeywordsTabProps {
  metadata: PaperMetadata;
  onChange: (updated: PaperMetadata) => void;
}

export const AbstractKeywordsTab: React.FC<AbstractKeywordsTabProps> = ({
  metadata,
  onChange,
}) => {
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const keywords = metadata.keywords || [];

  const handleAbstractChange = (text: string) => {
    onChange({
      ...metadata,
      abstract: text,
    });
  };

  const handleAbstractEnChange = (text: string) => {
    onChange({
      ...metadata,
      abstractEn: text,
    });
  };

  const handleAddKeyword = () => {
    const trimmed = newKeywordInput.trim();
    if (!trimmed || keywords.includes(trimmed)) return;
    onChange({
      ...metadata,
      keywords: [...keywords, trimmed],
    });
    setNewKeywordInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddKeyword();
    }
  };

  const handleRemoveKeyword = (index: number) => {
    const next = [...keywords];
    next.splice(index, 1);
    onChange({
      ...metadata,
      keywords: next,
    });
  };

  const wordCountVi = (metadata.abstract || '').trim().split(/\s+/).filter(Boolean).length;
  const wordCountEn = (metadata.abstractEn || '').trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Vietnamese Abstract */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlignLeft className="w-4 h-4 text-[#78C841]" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Tóm tắt tiếng Việt
            </h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {wordCountVi} từ
          </span>
        </div>

        <p className="text-xs text-slate-500">
          Tóm tắt nên nêu rõ: Đặt vấn đề, Phương pháp nghiên cứu, Kết quả định lượng và Đóng góp khoa học (khoảng 150 - 250 từ).
        </p>

        <textarea
          value={metadata.abstract || ''}
          onChange={(e) => handleAbstractChange(e.target.value)}
          rows={6}
          className="w-full text-sm font-normal leading-relaxed rounded-xl border border-slate-200 p-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 focus:border-[#78C841] transition-all resize-y"
          placeholder="Nhập phần tóm tắt tiếng Việt của bài báo..."
        />
      </div>

      {/* English Abstract */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlignLeft className="w-4 h-4 text-[#78C841]" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Tóm tắt tiếng Anh (Abstract in English)
            </h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {wordCountEn} words
          </span>
        </div>

        <textarea
          value={metadata.abstractEn || ''}
          onChange={(e) => handleAbstractEnChange(e.target.value)}
          rows={6}
          className="w-full text-sm font-normal leading-relaxed rounded-xl border border-slate-200 p-3.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 focus:border-[#78C841] transition-all resize-y italic"
          placeholder="Enter the English abstract of the research paper..."
        />
      </div>

      {/* Keywords Management */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#78C841]" />
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Từ khóa nghiên cứu (Keywords)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {keywords.length} từ khóa (khuyến nghị 3-6 từ khóa)
          </span>
        </div>

        {/* Add keyword input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={newKeywordInput}
              onChange={(e) => setNewKeywordInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              placeholder="Nhập từ khóa và nhấn Enter..."
            />
          </div>
          <button
            onClick={handleAddKeyword}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Thêm
          </button>
        </div>

        {/* Existing keywords chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {keywords.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Chưa có từ khóa nào. Hãy thêm từ khóa ở trên.</p>
          ) : (
            keywords.map((kw, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-800 text-xs font-bold border border-slate-200 transition-colors"
              >
                {kw}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(idx)}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-white cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
