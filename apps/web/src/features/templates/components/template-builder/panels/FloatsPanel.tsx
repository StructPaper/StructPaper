'use client';

import React from 'react';
import { FloatElementConfig } from '@/types/template-builder';
import { Image, Table as TableIcon } from 'lucide-react';

interface FloatsPanelProps {
  config: FloatElementConfig;
  onChange: (updated: Partial<FloatElementConfig>) => void;
  primaryColor: string;
}

export const FloatsPanel: React.FC<FloatsPanelProps> = ({ config, onChange, primaryColor }) => {
  return (
    <div className="space-y-6">
      {/* Chú thích Hình & Bảng (Captioning) */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Image className="w-4 h-4 text-emerald-600" />
          <span>Chú thích Hình ảnh & Đồ thị (Figure Captions)</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Tiền tố chú thích hình</label>
            <input
              type="text"
              value={config.captionPrefix}
              onChange={(e) => onChange({ captionPrefix: e.target.value })}
              placeholder="Hình / Fig. / Figure"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Cỡ chữ chú thích (pt)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="7.5"
                max="11"
                step="0.5"
                value={config.captionFontSize}
                onChange={(e) => onChange({ captionFontSize: parseFloat(e.target.value) || 9 })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">pt</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.captionWeight === 'bold'}
              onChange={(e) => onChange({ captionWeight: e.target.checked ? 'bold' : 'normal' })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>In đậm nhãn chú thích ({config.captionPrefix} 1:)</span>
          </label>
        </div>
      </div>

      {/* Định dạng Bảng biểu (Tables Styling) */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <TableIcon className="w-4 h-4 text-blue-600" />
          <span>Định dạng Bảng biểu (Table Styling)</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Màu nền tiêu đề bảng (Header)</label>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="color"
                value={config.tableHeaderBackground}
                onChange={(e) => onChange({ tableHeaderBackground: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-xs font-mono text-slate-700 uppercase">
                {config.tableHeaderBackground}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Khoảng cách đệm (pt)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="4"
                max="18"
                step="1"
                value={config.spaceAround}
                onChange={(e) => onChange({ spaceAround: parseFloat(e.target.value) || 10 })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">pt</span>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.zebraStripes}
              onChange={(e) => onChange({ zebraStripes: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Kẻ sọc xen kẽ hàng bảng (Zebra striping)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
