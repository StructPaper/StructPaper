'use client';

import React from 'react';
import { PaperSection } from '@/types/paper';
import { AutoResizeTextarea } from './AutoResizeTextarea';

export interface HeadingSectionItemProps {
  sec: PaperSection;
  idx: number;
  onUpdateSection: (index: number, updated: PaperSection) => void;
}

const HeadingSectionItemBase: React.FC<HeadingSectionItemProps> = ({
  sec,
  idx,
  onUpdateSection,
}) => {
  return (
    <div className="space-y-1.5">
      <AutoResizeTextarea
        value={sec.title || ''}
        onChange={(val) => onUpdateSection(idx, { ...sec, title: val })}
        placeholder="Nhập tiêu đề đề mục (ví dụ: GIỚI THIỆU, PHƯƠNG PHÁP, KẾT QUẢ...)"
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
        className="w-full p-2.5 rounded-2xl text-xs sm:text-sm font-bold text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs"
      />
      {sec.content && (
        <AutoResizeTextarea
          value={sec.content}
          onChange={(val) => onUpdateSection(idx, { ...sec, content: val })}
          placeholder="Nội dung phụ / mô tả dưới tiêu đề..."
          className="w-full p-2.5 rounded-2xl text-xs text-zinc-900 bg-white leading-relaxed focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs"
        />
      )}
    </div>
  );
};

export const HeadingSectionItem = React.memo(HeadingSectionItemBase);
HeadingSectionItem.displayName = 'HeadingSectionItem';
