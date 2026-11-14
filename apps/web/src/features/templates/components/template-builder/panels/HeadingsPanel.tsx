'use client';

import React, { useState } from 'react';
import { HeadingElementConfig, HeadingNumbering } from '@/types/template-builder';
import { Heading, Sparkles, SlidersHorizontal } from 'lucide-react';

interface HeadingsPanelProps {
  heading1: HeadingElementConfig;
  heading2: HeadingElementConfig;
  heading3: HeadingElementConfig;
  onH1Change: (updated: Partial<HeadingElementConfig>) => void;
  onH2Change: (updated: Partial<HeadingElementConfig>) => void;
  onH3Change: (updated: Partial<HeadingElementConfig>) => void;
  primaryColor: string;
}

export const HeadingsPanel: React.FC<HeadingsPanelProps> = ({
  heading1,
  heading2,
  heading3,
  onH1Change,
  onH2Change,
  onH3Change,
  primaryColor,
}) => {
  const [activeTab, setActiveTab] = useState<'h1' | 'h2' | 'h3'>('h1');

  const currentConfig = activeTab === 'h1' ? heading1 : activeTab === 'h2' ? heading2 : heading3;
  const currentUpdater = activeTab === 'h1' ? onH1Change : activeTab === 'h2' ? onH2Change : onH3Change;

  return (
    <div className="space-y-6">
      {/* Tab Switcher for H1, H2, H3 */}
      <div className="flex bg-slate-200/70 p-1 rounded-2xl gap-1">
        {[
          { id: 'h1', label: 'Cấp 1 (Heading 1)', sub: 'I. GIỚI THIỆU' },
          { id: 'h2', label: 'Cấp 2 (Heading 2)', sub: '1.1. Phương pháp' },
          { id: 'h3', label: 'Cấp 3 (Heading 3)', sub: 'A. Thu thập mẫu' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'h1' | 'h2' | 'h3')}
            className={`flex-1 py-2 px-3 rounded-xl text-left transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <div className="text-xs">{tab.label}</div>
            <div className="text-[10px] text-slate-400 font-mono">{tab.sub}</div>
          </button>
        ))}
      </div>

      {/* Chi tiết cấu hình Heading được chọn */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Heading className="w-4 h-4 text-emerald-600" />
          <span>
            {activeTab === 'h1' ? 'Tiêu đề Cấp 1 (H1)' : activeTab === 'h2' ? 'Tiêu đề Cấp 2 (H2)' : 'Tiêu đề Cấp 3 (H3)'}
          </span>
        </div>

        {/* Cỡ chữ & Độ đậm */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Cỡ chữ (pt)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="9"
                max="16"
                step="0.5"
                value={currentConfig.fontSize}
                onChange={(e) => currentUpdater({ fontSize: parseFloat(e.target.value) || 11 })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">pt</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Độ đậm (Font Weight)</label>
            <select
              value={currentConfig.fontWeight}
              onChange={(e) =>
                currentUpdater({ fontWeight: e.target.value as HeadingElementConfig['fontWeight'] })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
            >
              <option value="bold">Bold (700)</option>
              <option value="extrabold">Extra Bold (800)</option>
              <option value="black">Black (900)</option>
            </select>
          </div>
        </div>

        {/* Hệ thống đánh số (Numbering) */}
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1.5">
            Hệ thống đánh số mục (Numbering Format)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'ROMAN', label: 'Số La Mã (I, II, III)', desc: 'Chuẩn IEEE & VNUHCM' },
              { id: 'ARABIC', label: 'Số Ả Rập (1, 2, 3)', desc: 'Chuẩn Elsevier & Springer' },
              { id: 'LETTER', label: 'Chữ cái (A, B, C)', desc: 'Thường dùng cho cấp mục con' },
              { id: 'NONE', label: 'Không đánh số', desc: 'Chỉ hiện tên mục' },
            ].map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => currentUpdater({ numbering: fmt.id as HeadingNumbering })}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  currentConfig.numbering === fmt.id
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                <div className="text-xs font-bold text-slate-800">{fmt.label}</div>
                <div className="text-[10px] text-slate-500">{fmt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Kiểu chữ hoa/thường (Text Transform) */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Kiểu chữ hoa/thường</label>
            <select
              value={currentConfig.textTransform}
              onChange={(e) =>
                currentUpdater({
                  textTransform: e.target.value as HeadingElementConfig['textTransform'],
                })
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
            >
              <option value="uppercase">IN HOA TOÀN BỘ (UPPERCASE)</option>
              <option value="capitalize">Viết Hoa Chữ Đầu (Capitalize)</option>
              <option value="none">Giữ nguyên bình thường</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Màu thanh nhấn / chữ</label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="color"
                value={currentConfig.accentColor}
                onChange={(e) => currentUpdater({ accentColor: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-xs font-mono text-slate-700 uppercase">
                {currentConfig.accentColor}
              </span>
            </div>
          </div>
        </div>

        {/* Thanh màu nhấn bên cạnh (Accent Bar) & Khoảng cách */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          <label className="flex items-center justify-between text-xs font-medium text-slate-700 cursor-pointer">
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Thanh màu viền dọc nhấn bên cạnh (Accent Bar)</span>
            </span>
            <input
              type="checkbox"
              checked={currentConfig.accentBar}
              onChange={(e) => currentUpdater({ accentBar: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Khoảng cách trên (Before pt)
              </label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <input
                  type="number"
                  min="2"
                  max="24"
                  value={currentConfig.spaceBefore}
                  onChange={(e) => currentUpdater({ spaceBefore: parseFloat(e.target.value) || 10 })}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
                />
                <span className="text-[11px] text-slate-400">pt</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Khoảng cách dưới (After pt)
              </label>
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <input
                  type="number"
                  min="2"
                  max="16"
                  value={currentConfig.spaceAfter}
                  onChange={(e) => currentUpdater({ spaceAfter: parseFloat(e.target.value) || 4 })}
                  className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
                />
                <span className="text-[11px] text-slate-400">pt</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
