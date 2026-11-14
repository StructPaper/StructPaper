'use client';

import React from 'react';
import { ReferencesElementConfig, CitationStyle } from '@/types/template-builder';
import { BookOpen, ListOrdered, Quote } from 'lucide-react';

interface ReferencesPanelProps {
  config: ReferencesElementConfig;
  onChange: (updated: Partial<ReferencesElementConfig>) => void;
  primaryColor: string;
}

export const ReferencesPanel: React.FC<ReferencesPanelProps> = ({ config, onChange, primaryColor }) => {
  return (
    <div className="space-y-6">
      {/* Phong cách trích dẫn (Citation Style) */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Quote className="w-4 h-4 text-emerald-600" />
          <span>Chuẩn trích dẫn (Citation & Bibliography Style)</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            {
              id: 'Vancouver',
              label: 'Vancouver',
              desc: 'Số trong ngoặc vuông [1], theo thứ tự xuất hiện (Chuẩn VNUHCM HS & STDJ)',
            },
            {
              id: 'IEEE',
              label: 'IEEE',
              desc: 'Số ngoặc vuông [1] viết tắt tên tác giả (Chuẩn Kỷ yếu Kỹ thuật)',
            },
            {
              id: 'APA',
              label: 'APA 7th',
              desc: 'Tác giả, Năm (Author, 2024), sắp xếp ABC (Chuẩn KHXH & Kinh tế)',
            },
          ].map((style) => (
            <button
              key={style.id}
              onClick={() => onChange({ style: style.id as CitationStyle })}
              className={`p-3 rounded-xl border text-left transition-all ${
                config.style === style.id
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-bold text-slate-800 mb-1">{style.label}</div>
              <div className="text-[10px] text-slate-500 leading-snug">{style.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Chi tiết định dạng danh mục tham khảo */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>Chi tiết hiển thị Danh mục tham khảo</span>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Tiêu đề mục tài liệu tham khảo
          </label>
          <input
            type="text"
            value={config.headingText}
            onChange={(e) => onChange({ headingText: e.target.value })}
            placeholder="Tài liệu tham khảo / References"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Cỡ chữ mục tham khảo (pt)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="7.5"
                max="10"
                step="0.5"
                value={config.fontSize}
                onChange={(e) => onChange({ fontSize: parseFloat(e.target.value) || 8.5 })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">pt</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Thụt lề treo (Hanging Indent mm)
            </label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={config.hangingIndent}
                onChange={(e) => onChange({ hangingIndent: parseFloat(e.target.value) || 5 })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">mm</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
