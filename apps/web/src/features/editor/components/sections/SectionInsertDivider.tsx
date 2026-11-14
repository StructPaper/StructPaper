'use client';

import React from 'react';
import {
  Heading,
  AlignLeft,
  Table as TableIcon,
  Image as ImageIcon,
  Sigma,
} from 'lucide-react';

export interface SectionInsertDividerProps {
  idx: number;
  onAddHeading: (level: 'h1' | 'h2' | 'h3', afterIndex: number) => void;
  onAddParagraph: (afterIndex: number) => void;
  onAddTable: (afterIndex: number) => void;
  onAddFigure: (afterIndex: number) => void;
  onAddCitation?: (afterIndex: number) => void;
  onAddEquation?: (afterIndex?: number) => void;
}

const SectionInsertDividerBase: React.FC<SectionInsertDividerProps> = ({
  idx,
  onAddHeading,
  onAddParagraph,
  onAddTable,
  onAddFigure,
  onAddEquation,
}) => {
  return (
    <div className="grid grid-rows-[0fr] group-hover:grid-rows-[1fr] opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out pointer-events-none group-hover:pointer-events-auto">
      <div className="overflow-hidden">
        <div className="pt-2.5 mt-1 border-t border-zinc-300/40 flex items-center justify-between gap-2 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-250 ease-out">
          <span className="text-[10px] font-semibold text-zinc-400 pl-1 select-none">
            Thêm bên dưới:
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => onAddHeading('h1', idx)}
              className="px-2 py-0.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 border border-zinc-200 text-[10px] font-bold flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Thêm tiêu đề đề mục ngay bên dưới"
            >
              <Heading className="w-2.5 h-2.5 text-zinc-500" />
              <span>+ Tiêu đề</span>
            </button>
            <button
              type="button"
              onClick={() => onAddParagraph(idx)}
              className="px-2 py-0.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900 border border-zinc-200 text-[10px] font-bold flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Thêm đoạn văn bản ngay bên dưới"
            >
              <AlignLeft className="w-2.5 h-2.5 text-zinc-500" />
              <span>+ Đoạn văn</span>
            </button>
            <button
              type="button"
              onClick={() => onAddTable(idx)}
              className="px-2 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Thêm bảng số liệu ngay bên dưới"
            >
              <TableIcon className="w-2.5 h-2.5 text-indigo-500" />
              <span>+ Bảng</span>
            </button>
            <button
              type="button"
              onClick={() => onAddFigure(idx)}
              className="px-2 py-0.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-[10px] font-bold flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Thêm hình ảnh minh họa ngay bên dưới"
            >
              <ImageIcon className="w-2.5 h-2.5 text-amber-500" />
              <span>+ Hình</span>
            </button>
            {onAddEquation && (
              <button
                type="button"
                onClick={() => onAddEquation(idx)}
                className="px-2 py-0.5 rounded-lg bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 text-[10px] font-bold flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
                title="Thêm công thức toán học ngay bên dưới"
              >
                <Sigma className="w-2.5 h-2.5 text-violet-500" />
                <span>+ Công thức</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SectionInsertDivider = React.memo(SectionInsertDividerBase);
SectionInsertDivider.displayName = 'SectionInsertDivider';
