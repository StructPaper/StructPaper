'use client';

import React from 'react';
import { BodyElementConfig } from '@/types/template-builder';
import { AlignJustify, AlignLeft, Baseline, Indent, Sliders } from 'lucide-react';

interface BodyTextPanelProps {
  config: BodyElementConfig;
  onChange: (updated: Partial<BodyElementConfig>) => void;
  primaryColor: string;
}

const BODY_FONTS = [
  'Times New Roman',
  'Arial',
  'Georgia',
  'Inter',
  'Minion Pro',
  'Calibri',
  'Cambria',
];

export const BodyTextPanel: React.FC<BodyTextPanelProps> = ({ config, onChange, primaryColor }) => {
  return (
    <div className="space-y-6">
      {/* Thân bài & Kiểu chữ (Body Typography) */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Baseline className="w-4 h-4 text-emerald-600" />
          <span>Kiểu chữ thân bài (Body Typography)</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Font chữ nội dung</label>
            <select
              value={config.fontFamily}
              onChange={(e) => onChange({ fontFamily: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500"
            >
              {BODY_FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Cỡ chữ nội dung (pt)</label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus-within:border-emerald-500">
              <input
                type="number"
                min="8.5"
                max="12"
                step="0.5"
                value={config.fontSize}
                onChange={(e) => onChange({ fontSize: parseFloat(e.target.value) || 10 })}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">pt</span>
            </div>
          </div>
        </div>

        {/* Khoảng cách dòng (Line Height) & Căn lề */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Khoảng cách dòng (Line height)
            </label>
            <select
              value={config.lineHeight}
              onChange={(e) => onChange({ lineHeight: parseFloat(e.target.value) || 1.2 })}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 outline-none"
            >
              <option value="1.15">1.15x (Chuẩn IEEE chặt chẽ)</option>
              <option value="1.2">1.2x (Chuẩn VNUHCM cân đối)</option>
              <option value="1.25">1.25x (Chuẩn Elsevier)</option>
              <option value="1.3">1.3x (Thoáng mắt)</option>
              <option value="1.5">1.5x (Bản thảo sơ khảo)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Căn lề đoạn văn</label>
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => onChange({ align: 'justify' })}
                className={`py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all ${
                  config.align === 'justify'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <AlignJustify className="w-3.5 h-3.5" />
                <span>Đều 2 bên</span>
              </button>
              <button
                onClick={() => onChange({ align: 'left' })}
                className={`py-1.5 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-all ${
                  config.align === 'left'
                    ? 'bg-white text-slate-900 shadow-xs font-bold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
                <span>Căn trái</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Thụt lề & Khoảng cách đoạn văn */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-black/5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          <Indent className="w-4 h-4 text-purple-600" />
          <span>Thụt lề & Khoảng cách đoạn văn</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Thụt lề dòng đầu (Indent mm)
            </label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={config.firstLineIndent}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  onChange({ firstLineIndent: isNaN(val) ? 0 : val });
                }}
                className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
              />
              <span className="text-[11px] text-slate-400">mm</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Khoảng cách giữa các đoạn (pt)
            </label>
            <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
              <input
                type="number"
                min="0"
                max="12"
                step="1"
                value={config.paragraphSpacing}
                onChange={(e) => onChange({ paragraphSpacing: parseFloat(e.target.value) || 4 })}
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
              checked={config.hyphenation}
              onChange={(e) => onChange({ hyphenation: e.target.checked })}
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Bật tự động gạch nối ngắt từ (Hyphenation)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
