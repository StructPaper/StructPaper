'use client';

import React from 'react';
import {
  AbstractElementConfig,
  KeywordsElementConfig,
  BorderStyle,
} from '@/types/template-builder';
import { FileCode, Tag, Sparkles, BoxSelect } from 'lucide-react';

interface AbstractKeywordsPanelProps {
  abstractConfig: AbstractElementConfig;
  keywordsConfig: KeywordsElementConfig;
  onAbstractChange: (updated: Partial<AbstractElementConfig>) => void;
  onKeywordsChange: (updated: Partial<KeywordsElementConfig>) => void;
  primaryColor: string;
}

export const AbstractKeywordsPanel: React.FC<AbstractKeywordsPanelProps> = ({
  abstractConfig,
  keywordsConfig,
  onAbstractChange,
  onKeywordsChange,
  primaryColor,
}) => {
  return (
    <div className="space-y-6">
      {/* Khối Tóm tắt (Abstract Box) */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <BoxSelect className="w-4 h-4 text-emerald-600" />
          <span>Khối Tóm tắt (Abstract Box Styling)</span>
        </div>

        {/* Kiểu khung viền (Border Style) */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-2">
            Kiểu khung viền bao quanh
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { id: 'left-solid', label: 'Thanh viền trái (Left accent)', desc: 'Chuẩn VNUHCM STDJ' },
              { id: 'all-borders', label: 'Khung bo góc tròn (All borders)', desc: 'Chuẩn Elsevier' },
              { id: 'none', label: 'Trơn không viền (Minimal)', desc: 'Chuẩn IEEE' },
              { id: 'top-bottom', label: 'Kẻ trên dưới (Top-bottom rules)', desc: 'Phong cách cổ điển' },
            ].map((style) => (
              <button
                key={style.id}
                onClick={() => onAbstractChange({ borderStyle: style.id as BorderStyle })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  abstractConfig.borderStyle === style.id
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-bold text-slate-800">{style.label}</div>
                <div className="text-[10px] text-slate-500">{style.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Màu viền & Màu nền */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Màu đường viền</label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="color"
                value={abstractConfig.borderColor}
                onChange={(e) => onAbstractChange({ borderColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-xs font-mono text-slate-700 uppercase">
                {abstractConfig.borderColor}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Màu nền khối (Tint)</label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="color"
                value={abstractConfig.backgroundColor === 'transparent' ? '#FFFFFF' : abstractConfig.backgroundColor}
                onChange={(e) => onAbstractChange({ backgroundColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-xs font-mono text-slate-700 uppercase">
                {abstractConfig.backgroundColor}
              </span>
            </div>
          </div>
        </div>

        {/* Nhãn Tóm tắt & Cỡ chữ */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Nhãn tiêu đề tóm tắt</label>
            <input
              type="text"
              value={abstractConfig.label}
              onChange={(e) => onAbstractChange({ label: e.target.value })}
              placeholder="TÓM TẮT"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Cỡ chữ (pt)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="8"
                max="12"
                step="0.5"
                value={abstractConfig.fontSize}
                onChange={(e) => onAbstractChange({ fontSize: parseFloat(e.target.value) || 9.5 })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">pt</span>
            </div>
          </div>
        </div>

        {/* Kiểu chữ & Padding */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Kiểu chữ nội dung</label>
            <select
              value={abstractConfig.fontStyle}
              onChange={(e) =>
                onAbstractChange({ fontStyle: e.target.value as 'normal' | 'italic' })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
            >
              <option value="italic">In nghiêng (Italic)</option>
              <option value="normal">Bình thường (Normal)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Đệm trong khối (Padding mm)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={abstractConfig.padding}
                onChange={(e) => onAbstractChange({ padding: parseFloat(e.target.value) || 3 })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">mm</span>
            </div>
          </div>
        </div>

        {/* Song ngữ Tóm tắt (Bilingual Abstract) */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <label className="flex items-center justify-between text-xs font-medium text-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-500" />
              <span>Hỗ trợ Tóm tắt tiếng Anh phụ (Bilingual Abstract)</span>
            </span>
            <input
              type="checkbox"
              checked={abstractConfig.supportBilingual}
              onChange={(e) => onAbstractChange({ supportBilingual: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
          </label>

          {abstractConfig.supportBilingual && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Nhãn Tóm tắt tiếng Anh
              </label>
              <input
                type="text"
                value={abstractConfig.enLabel}
                onChange={(e) => onAbstractChange({ enLabel: e.target.value })}
                placeholder="ABSTRACT"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Khối Từ khoá (Keywords) */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Tag className="w-4 h-4 text-amber-600" />
          <span>Từ khoá bài báo (Keywords Setting)</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Nhãn tiêu đề từ khoá</label>
            <input
              type="text"
              value={keywordsConfig.label}
              onChange={(e) => onKeywordsChange({ label: e.target.value })}
              placeholder="Từ khoá: / Keywords:"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Ký tự phân cách (Separator)</label>
            <select
              value={keywordsConfig.separator}
              onChange={(e) =>
                onKeywordsChange({ separator: e.target.value as KeywordsElementConfig['separator'] })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
            >
              <option value=", ">Dấu phẩy (A, B, C)</option>
              <option value="; ">Dấu chấm phẩy (A; B; C)</option>
              <option value=" • ">Dấu chấm tròn (A • B • C)</option>
            </select>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={keywordsConfig.labelBold}
              onChange={(e) => onKeywordsChange({ labelBold: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>In đậm nhãn từ khoá</span>
          </label>
        </div>
      </div>
    </div>
  );
};
