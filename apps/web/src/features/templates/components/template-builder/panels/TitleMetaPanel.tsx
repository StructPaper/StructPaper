'use client';

import React from 'react';
import { TitleElementConfig, AuthorElementConfig, TextAlignment } from '@/types/template-builder';
import { Type, AlignLeft, AlignCenter, AlignRight, Users, Sparkles } from 'lucide-react';

interface TitleMetaPanelProps {
  titleConfig: TitleElementConfig;
  authorsConfig: AuthorElementConfig;
  onTitleChange: (updated: Partial<TitleElementConfig>) => void;
  onAuthorsChange: (updated: Partial<AuthorElementConfig>) => void;
  primaryColor: string;
}

const FONT_FAMILIES = [
  'Times New Roman',
  'Arial',
  'Georgia',
  'Inter',
  'Minion Pro',
  'Myriad Pro',
  'Calibri',
];

export const TitleMetaPanel: React.FC<TitleMetaPanelProps> = ({
  titleConfig,
  authorsConfig,
  onTitleChange,
  onAuthorsChange,
  primaryColor,
}) => {
  return (
    <div className="space-y-6">
      {/* Tiêu đề bài báo (Article Title) */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Type className="w-4 h-4 text-emerald-600" />
          <span>Tiêu đề bài báo (Article Title)</span>
        </div>

        {/* Font Family & Cỡ chữ */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Font chữ tiêu đề</label>
            <select
              value={titleConfig.fontFamily}
              onChange={(e) => onTitleChange({ fontFamily: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            >
              {FONT_FAMILIES.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Cỡ chữ (pt)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-emerald-500">
              <input
                type="number"
                min="14"
                max="26"
                step="0.5"
                value={titleConfig.fontSize}
                onChange={(e) => onTitleChange({ fontSize: parseFloat(e.target.value) || 16 })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">pt</span>
            </div>
          </div>
        </div>

        {/* Độ đậm & Căn lề */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Độ đậm (Weight)</label>
            <select
              value={titleConfig.fontWeight}
              onChange={(e) =>
                onTitleChange({ fontWeight: e.target.value as TitleElementConfig['fontWeight'] })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            >
              <option value="bold">Bold (700)</option>
              <option value="extrabold">Extra Bold (800)</option>
              <option value="black">Black (900)</option>
              <option value="normal">Normal (400)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Căn lề (Alignment)</label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
              {(['left', 'center', 'right'] as TextAlignment[]).map((align) => (
                <button
                  key={align}
                  onClick={() => onTitleChange({ align })}
                  className={`py-1 rounded-lg text-xs flex items-center justify-center transition-all ${
                    titleConfig.align === align
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                  {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                  {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Màu sắc tiêu đề & Khoảng cách dưới */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Màu tiêu đề</label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="color"
                value={titleConfig.color}
                onChange={(e) => onTitleChange({ color: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-xs font-mono text-slate-700 uppercase">{titleConfig.color}</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Khoảng cách dưới (pt)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="4"
                max="24"
                value={titleConfig.spaceAfter}
                onChange={(e) => onTitleChange({ spaceAfter: parseFloat(e.target.value) || 12 })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">pt</span>
            </div>
          </div>
        </div>

        {/* Tiêu đề phụ tiếng Anh (Bilingual Title) */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <label className="flex items-center justify-between text-xs font-medium text-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Hỗ trợ tiêu đề song ngữ Anh - Việt</span>
            </span>
            <input
              type="checkbox"
              checked={titleConfig.supportBilingual}
              onChange={(e) => onTitleChange({ supportBilingual: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
          </label>

          {titleConfig.supportBilingual && (
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Cỡ chữ tiêu đề tiếng Anh phụ (pt)
              </label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <input
                  type="number"
                  min="11"
                  max="18"
                  step="0.5"
                  value={titleConfig.enTitleFontSize}
                  onChange={(e) =>
                    onTitleChange({ enTitleFontSize: parseFloat(e.target.value) || 13 })
                  }
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
                />
                <span className="text-[11px] text-slate-400">pt</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Khối Tác giả & Đơn vị công tác (Author Block) */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Users className="w-4 h-4 text-blue-600" />
          <span>Tác giả & Đơn vị công tác (Authors & Affiliations)</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Cỡ chữ tên tác giả</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="9"
                max="14"
                step="0.5"
                value={authorsConfig.fontSize}
                onChange={(e) =>
                  onAuthorsChange({ fontSize: parseFloat(e.target.value) || 10.5 })
                }
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">pt</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Căn lề tác giả</label>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
              {(['left', 'center', 'right'] as TextAlignment[]).map((align) => (
                <button
                  key={align}
                  onClick={() => onAuthorsChange({ align })}
                  className={`py-1 rounded-lg text-xs flex items-center justify-center transition-all ${
                    authorsConfig.align === align
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                  {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                  {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={authorsConfig.showAffiliations}
              onChange={(e) => onAuthorsChange({ showAffiliations: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Hiển thị đơn vị công tác (Affiliations)</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={authorsConfig.showCorresponding}
              onChange={(e) => onAuthorsChange({ showCorresponding: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Đánh dấu tác giả liên hệ (Corresponding Author)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
