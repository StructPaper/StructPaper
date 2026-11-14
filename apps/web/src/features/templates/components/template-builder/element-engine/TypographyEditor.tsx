'use client';

import React from 'react';
import { TypographyAttributes } from '@/types/template-engine/elements';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { Type } from 'lucide-react';

interface TypographyEditorProps {
  attributes: TypographyAttributes;
  primaryColor?: string;
  onChange: (updated: Partial<TypographyAttributes>) => void;
}

const ACADEMIC_FONTS = [
  'Minion Pro, Times New Roman, serif',
  'Times New Roman, serif',
  'Arial, Helvetica, sans-serif',
  'Georgia, serif',
  'Inter, sans-serif',
  'Calibri, sans-serif',
  'Cambria, Georgia, serif',
  'DejaVu Sans, sans-serif',
];

export const TypographyEditor: React.FC<TypographyEditorProps> = ({
  attributes,
  primaryColor = '#2B74B7',
  onChange,
}) => {
  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_0_10px_rgba(0,0,0,0.03)] space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
        <div className="flex items-center gap-2">
          <Type className="w-4 h-4 text-zinc-700" />
          <h4 className="text-xs font-extrabold text-zinc-900">
            Kiểu Chữ & Nghệ Thuật Chữ (Typst #set text)
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#78C841]/15 text-[#14532D] border border-[#78C841]/40">
          #set text(...)
        </span>
      </div>

      {/* Font Family */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-zinc-700 block">
          Phông chữ học thuật (Font Family)
        </label>
        <Select
          value={attributes.fontFamily}
          onChange={(val) => onChange({ fontFamily: val })}
          options={ACADEMIC_FONTS.map((f) => ({
            value: f,
            label: f.split(',')[0],
          }))}
          variant="flat-white"
          size="sm"
        />
      </div>

      {/* Font Size & Line Height */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <NumberInput
          label="Cỡ chữ (Font Size)"
          value={attributes.fontSizePt}
          onChange={(val) => onChange({ fontSizePt: val })}
          unit="pt"
          min={5}
          max={48}
          step={0.5}
          variant="flat-white"
        />

        <NumberInput
          label="Dãn dòng (Line Height / Leading)"
          value={attributes.lineHeight}
          onChange={(val) => onChange({ lineHeight: val })}
          unit="em"
          min={0.9}
          max={2.5}
          step={0.05}
          variant="flat-white"
        />
      </div>

      {/* Font Weight */}
      <div className="space-y-1.5 pt-1">
        <label className="text-xs font-bold text-zinc-700 block">
          Độ đậm (Font Weight)
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: '400', label: 'Regular' },
            { value: '500', label: 'Medium' },
            { value: '600', label: 'Semibold' },
            { value: '700', label: 'Bold' },
          ].map((w) => {
            const isActive = attributes.fontWeight === w.value;
            return (
              <button
                key={w.value}
                type="button"
                onClick={() => onChange({ fontWeight: w.value as any })}
                className={`py-2 px-1 rounded-2xl text-xs font-bold border transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-2 ring-[#78C841]/50'
                    : 'bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 border-zinc-200/80 shadow-2xs'
                }`}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Font Style & Text Transform */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200/60">
        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">Kiểu in</label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onChange({ fontStyle: 'normal' })}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer select-none ${
                attributes.fontStyle === 'normal'
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-2 ring-[#78C841]/50'
                  : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200/80'
              }`}
            >
              Thẳng
            </button>
            <button
              type="button"
              onClick={() => onChange({ fontStyle: 'italic' })}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold italic border transition-all cursor-pointer select-none ${
                attributes.fontStyle === 'italic'
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-2 ring-[#78C841]/50'
                  : 'bg-white hover:bg-zinc-50 text-zinc-700 border-zinc-200/80'
              }`}
            >
              Nghiêng
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">Biến đổi chữ</label>
          <Select
            value={attributes.textTransform}
            onChange={(val) => onChange({ textTransform: val as any })}
            options={[
              { value: 'none', label: 'Bình thường (None)' },
              { value: 'uppercase', label: 'IN HOA (UPPERCASE)' },
              { value: 'capitalize', label: 'Viết Hoa Đầu Từ' },
              { value: 'lowercase', label: 'viết thường (lowercase)' },
            ]}
            variant="flat-white"
            size="sm"
          />
        </div>
      </div>

      {/* Text Color & Letter Spacing */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200/60 items-end">
        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">Màu chữ</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-1 border border-zinc-200/80 shadow-2xs">
              <input
                type="color"
                value={attributes.color === 'PRIMARY' ? primaryColor : attributes.color || '#0F172A'}
                onChange={(e) => onChange({ color: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-xs font-mono font-bold text-zinc-800 uppercase">
                {attributes.color === 'PRIMARY' ? primaryColor : attributes.color || '#0F172A'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onChange({ color: primaryColor })}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold border border-zinc-200 shadow-2xs transition-all cursor-pointer"
            >
              Màu Tạp chí
            </button>
          </div>
        </div>

        <NumberInput
          label="Khoảng cách chữ (Letter Spacing)"
          value={attributes.letterSpacingEm || 0}
          onChange={(val) => onChange({ letterSpacingEm: val })}
          unit="em"
          min={-0.05}
          max={0.2}
          step={0.01}
          variant="flat-white"
        />
      </div>
    </div>
  );
};
