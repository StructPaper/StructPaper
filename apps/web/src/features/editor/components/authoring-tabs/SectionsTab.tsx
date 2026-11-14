'use client';

import React from 'react';
import { PaperSection } from '@/types/paper';
import {
  FileText,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
} from 'lucide-react';

interface SectionsTabProps {
  sections: PaperSection[];
  onChange: (updated: PaperSection[]) => void;
}

export const SectionsTab: React.FC<SectionsTabProps> = ({ sections, onChange }) => {
  const handleUpdateSection = (index: number, updated: Partial<PaperSection>) => {
    const next = [...sections];
    next[index] = { ...next[index], ...updated };
    onChange(next);
  };

  const handleAddSection = (type: 'h1' | 'h2' | 'h3' | 'paragraph') => {
    const newSec: PaperSection = {
      id: `sec_${Date.now()}`,
      type,
      title:
        type === 'h1'
          ? 'TIÊU ĐỀ CHÍNH MỚI'
          : type === 'h2'
          ? 'Tiêu đề phụ cấp 2'
          : type === 'h3'
          ? 'Tiêu đề phụ cấp 3'
          : undefined,
      content:
        type === 'paragraph'
          ? 'Nhập nội dung đoạn văn khoa học tại đây...'
          : '',
    };
    onChange([...sections, newSec]);
  };

  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= sections.length) return;
    const next = [...sections];
    const temp = next[index];
    next[index] = next[target];
    next[target] = temp;
    onChange(next);
  };

  const handleDeleteSection = (index: number) => {
    const next = [...sections];
    next.splice(index, 1);
    onChange(next);
  };

  const hCount = sections.filter((s) => s.type === 'h1' || s.type === 'h2' || s.type === 'h3').length;
  const pCount = sections.filter((s) => s.type === 'paragraph').length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top action bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#78C841]" />
          <h3 className="font-extrabold text-sm text-slate-900">
            Nội dung bài báo ({sections.length} khối)
          </h3>
          <span className="text-xs text-slate-500 hidden sm:inline">
            ({hCount} tiêu đề, {pCount} đoạn văn)
          </span>
        </div>
      </div>

      {/* Sections List */}
      <div className="space-y-4">
        {sections.map((sec, idx) => {
          const isH1 = sec.type === 'h1';
          const isH2 = sec.type === 'h2';
          const isH3 = sec.type === 'h3';
          const isHeading = isH1 || isH2 || isH3;

          return (
            <div
              key={sec.id || idx}
              className={`rounded-2xl border transition-all p-4 ${
                isH1
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : isH2
                  ? 'bg-emerald-50/20 border-emerald-100'
                  : isH3
                  ? 'bg-slate-50 border-slate-200'
                  : 'bg-white border-slate-200 shadow-xs'
              }`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      isH1
                        ? 'bg-emerald-700 text-white'
                        : isH2
                        ? 'bg-emerald-600 text-white'
                        : isH3
                        ? 'bg-emerald-100 text-[#14532D]'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {sec.type}
                  </span>
                  <span className="text-xs font-bold text-slate-400">#{idx + 1}</span>
                </div>

                {/* Move & Delete controls */}
                <div className="flex items-center gap-1">
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMoveSection(idx, 'up')}
                    className="p-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    disabled={idx === sections.length - 1}
                    onClick={() => handleMoveSection(idx, 'down')}
                    className="p-1 rounded-lg bg-white border border-slate-200 text-slate-500 hover:text-slate-800 disabled:opacity-30 cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteSection(idx)}
                    className="p-1 rounded-lg bg-white border border-slate-200 text-red-500 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Input for Heading */}
              {isHeading ? (
                <div>
                  <input
                    type="text"
                    value={sec.title || ''}
                    onChange={(e) => handleUpdateSection(idx, { title: e.target.value })}
                    className={`w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 ${
                      isH1 ? 'text-base font-black' : isH2 ? 'text-sm font-bold' : 'text-xs font-bold'
                    }`}
                    placeholder="Tiêu đề mục..."
                  />
                </div>
              ) : (
                /* Input for Paragraph */
                <div>
                  <textarea
                    value={sec.content || ''}
                    onChange={(e) => handleUpdateSection(idx, { content: e.target.value })}
                    rows={4}
                    className="w-full text-xs font-normal leading-relaxed rounded-xl border border-slate-200 bg-white p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 transition-all resize-y"
                    placeholder="Nhập nội dung đoạn văn..."
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
