'use client';

import React from 'react';
import { PaperSection, PaperMetadata } from '@/types/paper';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { generateStandardCitation } from './utils';
import { Sparkles, Check, Copy } from 'lucide-react';

export interface CitationSectionItemProps {
  sec: PaperSection;
  idx: number;
  metadata?: PaperMetadata;
  copiedCitationId: string | null;
  onUpdateSection: (index: number, updated: PaperSection) => void;
  onCopyCitation: (id: string, text: string) => void;
}

const CitationSectionItemBase: React.FC<CitationSectionItemProps> = ({
  sec,
  idx,
  metadata,
  copiedCitationId,
  onUpdateSection,
  onCopyCitation,
}) => {
  const secId = sec.id || `sec_${idx}`;

  return (
    <div className="space-y-2 p-3 rounded-2xl bg-white border border-blue-200 shadow-2xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
          Định dạng Trích dẫn bài báo (How to Cite):
        </span>
        <div className="flex items-center gap-1.5">
          {metadata && (
            <button
              type="button"
              onClick={() => {
                const gen = generateStandardCitation(metadata);
                onUpdateSection(idx, { ...sec, content: gen });
              }}
              className="px-2 py-0.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              title="Tự động tạo trích dẫn chuẩn từ thông tin tác giả, tiêu đề, tạp chí..."
            >
              <Sparkles className="w-2.5 h-2.5 text-blue-600" />
              <span>Tạo từ Metadata</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onCopyCitation(secId, sec.content)}
            className="px-2 py-0.5 rounded-lg bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
            title="Sao chép chuỗi trích dẫn này"
          >
            {copiedCitationId === secId ? (
              <>
                <Check className="w-2.5 h-2.5 text-emerald-600" />
                <span className="text-emerald-700 font-extrabold">Đã chép!</span>
              </>
            ) : (
              <>
                <Copy className="w-2.5 h-2.5 text-zinc-500" />
                <span>Sao chép</span>
              </>
            )}
          </button>
        </div>
      </div>

      <AutoResizeTextarea
        value={sec.content || ''}
        onChange={(val) => onUpdateSection(idx, { ...sec, content: val })}
        placeholder="Nhập thông tin trích dẫn bài báo: Tác giả. Tiêu đề. Tạp chí..."
        className="w-full p-2.5 rounded-xl text-xs sm:text-sm text-zinc-900 bg-blue-50/30 leading-relaxed focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs font-serif italic"
      />
    </div>
  );
};

export const CitationSectionItem = React.memo(CitationSectionItemBase);
CitationSectionItem.displayName = 'CitationSectionItem';
