'use client';

import React from 'react';
import { PageSetupConfig, PageSize, FirstPageLayout } from '@/types/template-builder';
import { Columns, Layout, AlignJustify, Bookmark, Palette, FileText } from 'lucide-react';

interface PageSetupPanelProps {
  config: PageSetupConfig;
  onChange: (updated: Partial<PageSetupConfig>) => void;
  primaryColor: string;
}

export const PageSetupPanel: React.FC<PageSetupPanelProps> = ({ config, onChange, primaryColor }) => {
  return (
    <div className="space-y-6">
      {/* Khổ giấy & Định dạng trang */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <FileText className="w-4 h-4 text-emerald-600" />
          <span>Khổ giấy & Định dạng chung</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(['A4', 'Letter', 'B5'] as PageSize[]).map((size) => (
            <button
              key={size}
              onClick={() => onChange({ size })}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                config.size === size
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {size} ({size === 'A4' ? '210×297mm' : size === 'Letter' ? '8.5×11in' : '176×250mm'})
            </button>
          ))}
        </div>
      </div>

      {/* Cấu hình lề trang (Margins mm) */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Layout className="w-4 h-4 text-blue-600" />
            <span>Khoảng cách lề trang (mm)</span>
          </div>
          {/* Quick margin presets */}
          <div className="flex gap-1.5">
            <button
              onClick={() => onChange({ margins: { top: 20, bottom: 20, left: 18, right: 18 } })}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium"
            >
              Chuẩn VNUHCM
            </button>
            <button
              onClick={() => onChange({ margins: { top: 15, bottom: 20, left: 14, right: 14 } })}
              className="text-[11px] px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium"
            >
              IEEE (Hẹp)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Lề trên (Top)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-emerald-500">
              <input
                type="number"
                min="10"
                max="40"
                step="1"
                value={config.margins.top}
                onChange={(e) =>
                  onChange({ margins: { ...config.margins, top: parseFloat(e.target.value) || 20 } })
                }
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">mm</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Lề dưới (Bottom)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-emerald-500">
              <input
                type="number"
                min="10"
                max="40"
                step="1"
                value={config.margins.bottom}
                onChange={(e) =>
                  onChange({ margins: { ...config.margins, bottom: parseFloat(e.target.value) || 20 } })
                }
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">mm</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Lề trái (Left)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-emerald-500">
              <input
                type="number"
                min="10"
                max="40"
                step="1"
                value={config.margins.left}
                onChange={(e) =>
                  onChange({ margins: { ...config.margins, left: parseFloat(e.target.value) || 18 } })
                }
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">mm</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Lề phải (Right)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-emerald-500">
              <input
                type="number"
                min="10"
                max="40"
                step="1"
                value={config.margins.right}
                onChange={(e) =>
                  onChange({ margins: { ...config.margins, right: parseFloat(e.target.value) || 18 } })
                }
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">mm</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bố cục trang bìa & Cột thân bài (Columns) */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Columns className="w-4 h-4 text-purple-600" />
          <span>Bố cục chia cột & Kiểu dàn trang</span>
        </div>

        {/* First page layout: Standard Span vs Sidebar Split */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">
            Kiểu bố cục trang đầu (First-Page Front Matter)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onChange({ firstPageLayout: 'sidebar-split' })}
              className={`p-3 rounded-xl border text-left transition-all ${
                config.firstPageLayout === 'sidebar-split'
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-bold text-slate-800 mb-1">Sidebar Split (28% / 72%)</div>
              <div className="text-[11px] text-slate-500 leading-snug">
                Cột thông tin nộp bài & DOI bên trái, Tóm tắt bên phải (Chuẩn Y Dược VNUHCM ID630).
              </div>
            </button>

            <button
              onClick={() => onChange({ firstPageLayout: 'standard-span' })}
              className={`p-3 rounded-xl border text-left transition-all ${
                config.firstPageLayout === 'standard-span'
                  ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
              }`}
            >
              <div className="text-xs font-bold text-slate-800 mb-1">Standard Full Span (100%)</div>
              <div className="text-[11px] text-slate-500 leading-snug">
                Tiêu đề và khối Tóm tắt trải dài toàn bộ chiều rộng (Chuẩn IEEE & Elsevier).
              </div>
            </button>
          </div>
        </div>

        {/* Số cột thân bài (Body Columns) */}
        <div className="pt-2 border-t border-slate-100">
          <label className="block text-xs font-medium text-slate-600 mb-2">Số cột phần Thân bài (Body text)</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onChange({ columns: 2 })}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                config.columns === 2
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Columns className="w-4 h-4" />
              <span>2 cột (Chuẩn bài báo quốc tế)</span>
            </button>

            <button
              onClick={() => onChange({ columns: 1 })}
              className={`py-2.5 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2 transition-all ${
                config.columns === 1
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <AlignJustify className="w-4 h-4" />
              <span>1 cột (Toàn văn tài liệu)</span>
            </button>
          </div>
        </div>

        {config.columns === 2 && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Khoảng cách giữa 2 cột (Column Gap)
              </label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <input
                  type="number"
                  min="4"
                  max="12"
                  step="0.5"
                  value={config.columnGap}
                  onChange={(e) => onChange({ columnGap: parseFloat(e.target.value) || 6 })}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
                />
                <span className="text-[11px] text-slate-400">mm</span>
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer pb-2">
                <input
                  type="checkbox"
                  checked={config.showColumnRule}
                  onChange={(e) => onChange({ showColumnRule: e.target.checked })}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>Kẻ đường phân cách cột</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Tên tạp chí & Header / Footer */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Bookmark className="w-4 h-4 text-amber-600" />
          <span>Tên ấn phẩm & Header / Footer</span>
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Tên Tạp chí / Ấn phẩm</label>
          <input
            type="text"
            value={config.journalName}
            onChange={(e) => onChange({ journalName: e.target.value })}
            placeholder="Sci. Tech. Dev. J. (STDJ)"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">
            Loại hình bài báo (Article Type Badge)
          </label>
          <input
            type="text"
            value={config.articleType}
            onChange={(e) => onChange({ articleType: e.target.value })}
            placeholder="BÀI BÁO NGHIÊN CỨU / RESEARCH ARTICLE"
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-emerald-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showRunningHeader}
              onChange={(e) => onChange({ showRunningHeader: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Hiện Running Header</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.showPageNumbers}
              onChange={(e) => onChange({ showPageNumbers: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Đánh số trang</span>
          </label>
        </div>
      </div>
    </div>
  );
};
