'use client';

import React from 'react';
import { DecorationAttributes } from '@/types/template-engine/elements';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { Sparkles } from 'lucide-react';

interface DecorationEditorProps {
  attributes: DecorationAttributes;
  primaryColor?: string;
  onChange: (updated: Partial<DecorationAttributes>) => void;
}

export const DecorationEditor: React.FC<DecorationEditorProps> = ({
  attributes,
  primaryColor = '#2B74B7',
  onChange,
}) => {
  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_0_10px_rgba(0,0,0,0.03)] space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-zinc-700" />
          <h4 className="text-xs font-extrabold text-zinc-900">
            Trang Trí, Viền & Màu Nền (Typst #block stroke & fill)
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#78C841]/15 text-[#14532D] border border-[#78C841]/40">
          #block(stroke: ..., fill: ...)
        </span>
      </div>

      {/* Border Sides Toggle */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 block">
          Các cạnh viền hiển thị (Borders)
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'borderTop', label: 'Viền trên' },
            { id: 'borderBottom', label: 'Viền dưới' },
            { id: 'borderLeft', label: 'Viền trái (Bar)' },
            { id: 'borderRight', label: 'Viền phải' },
          ].map((side) => {
            const isActive = (attributes as any)[side.id];
            return (
              <button
                key={side.id}
                type="button"
                onClick={() => onChange({ [side.id]: !isActive })}
                className={`py-2 px-1 rounded-2xl text-xs font-bold border transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-2 ring-[#78C841]/50'
                    : 'bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 border-zinc-200/80 shadow-2xs'
                }`}
              >
                {side.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Border Style, Width, Color */}
      <div className="grid grid-cols-3 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">Kiểu viền</label>
          <Select
            value={attributes.borderStyle}
            onChange={(val) => onChange({ borderStyle: val as any })}
            options={[
              { value: 'solid', label: 'Solid (Liền)' },
              { value: 'dashed', label: 'Dashed (Đứt)' },
              { value: 'dotted', label: 'Dotted (Chấm bi)' },
            ]}
            variant="flat-white"
            size="sm"
          />
        </div>

        <div>
          <NumberInput
            label="Độ dày viền (Width)"
            value={attributes.borderWidthPt}
            onChange={(val) => onChange({ borderWidthPt: val })}
            unit="pt"
            min={0.25}
            max={8}
            step={0.25}
            variant="flat-white"
          />
        </div>

        <div>
          <NumberInput
            label="Bo góc (Radius)"
            value={attributes.borderRadiusPx}
            onChange={(val) => onChange({ borderRadiusPx: val })}
            unit="pt"
            min={0}
            max={24}
            step={1}
            variant="flat-white"
          />
        </div>
      </div>

      {/* Border Color & Background Color */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200/60">
        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">Màu viền</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-1 border border-zinc-200/80 shadow-2xs">
              <input
                type="color"
                value={attributes.borderColor === 'PRIMARY' ? primaryColor : attributes.borderColor || '#CBD5E1'}
                onChange={(e) => onChange({ borderColor: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-xs font-mono font-bold text-zinc-800 uppercase">
                {attributes.borderColor === 'PRIMARY' ? primaryColor : attributes.borderColor || '#CBD5E1'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onChange({ borderColor: primaryColor })}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold border border-zinc-200 shadow-2xs transition-all cursor-pointer"
            >
              Màu Tạp chí
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">Màu nền khối</label>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-1 border border-zinc-200/80 shadow-2xs">
              <input
                type="color"
                value={attributes.backgroundColor && attributes.backgroundColor !== 'transparent' ? attributes.backgroundColor : '#FFFFFF'}
                onChange={(e) => onChange({ backgroundColor: e.target.value })}
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-xs font-mono font-bold text-zinc-800 uppercase">
                {attributes.backgroundColor || 'transparent'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onChange({ backgroundColor: 'transparent' })}
              className="px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-xs font-bold border border-zinc-200 shadow-2xs transition-all cursor-pointer"
            >
              Trong suốt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
