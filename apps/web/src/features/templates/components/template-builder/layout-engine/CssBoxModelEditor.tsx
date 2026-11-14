'use client';

import React, { useState } from 'react';
import { CssBoxModelConfig } from '@/types/template-engine/layout';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { BoxSelect, Square, Layers, Sparkles } from 'lucide-react';

interface CssBoxModelEditorProps {
  boxModel: CssBoxModelConfig;
  onChange: (updated: Partial<CssBoxModelConfig>) => void;
}

export const CssBoxModelEditor: React.FC<CssBoxModelEditorProps> = ({
  boxModel,
  onChange,
}) => {
  const [activeTab, setActiveTab] = useState<'spacing' | 'border' | 'dimensions'>('spacing');

  const updateMargin = (side: keyof CssBoxModelConfig['margin'], value: number) => {
    onChange({
      margin: {
        ...boxModel.margin,
        [side]: value,
      },
    });
  };

  const updatePadding = (side: keyof CssBoxModelConfig['padding'], value: number) => {
    onChange({
      padding: {
        ...boxModel.padding,
        [side]: value,
      },
    });
  };

  const updateBorder = (updated: Partial<CssBoxModelConfig['border']>) => {
    onChange({
      border: {
        ...boxModel.border,
        ...updated,
      },
    });
  };

  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_0_10px_rgba(0,0,0,0.03)] space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
        <div className="flex items-center gap-2">
          <BoxSelect className="w-4 h-4 text-zinc-700" />
          <h4 className="text-xs font-extrabold text-zinc-900">
            Hộp Phần Tử & Khung Bao (Typst #block)
          </h4>
        </div>

        {/* Mini Tab Switcher */}
        <div className="flex bg-zinc-200/70 p-1 rounded-2xl text-xs font-bold text-zinc-600">
          <button
            type="button"
            onClick={() => setActiveTab('spacing')}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'spacing'
                ? 'bg-white text-zinc-900 shadow-2xs font-extrabold border border-zinc-200/60'
                : 'hover:text-zinc-900 hover:bg-white/40'
            }`}
          >
            Lề & Đệm
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('border')}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'border'
                ? 'bg-white text-zinc-900 shadow-2xs font-extrabold border border-zinc-200/60'
                : 'hover:text-zinc-900 hover:bg-white/40'
            }`}
          >
            Viền & Nền
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('dimensions')}
            className={`px-3 py-1 rounded-xl transition-all cursor-pointer ${
              activeTab === 'dimensions'
                ? 'bg-white text-zinc-900 shadow-2xs font-extrabold border border-zinc-200/60'
                : 'hover:text-zinc-900 hover:bg-white/40'
            }`}
          >
            Kích thước
          </button>
        </div>
      </div>

      {/* 1. SPACING: Visual DevTools Box Model Diagram */}
      {activeTab === 'spacing' && (
        <div className="space-y-3">
          <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200/60 relative">
            <span className="absolute top-1 left-2 text-[9px] font-extrabold uppercase text-amber-700 tracking-wider">
              MARGIN (Lề ngoài - mm)
            </span>

            <div className="flex justify-center mb-1">
              <input
                type="number"
                value={boxModel.margin.topMm}
                onChange={(e) => updateMargin('topMm', parseFloat(e.target.value) || 0)}
                className="w-14 text-center text-xs font-mono font-bold py-0.5 bg-white border border-amber-300 rounded shadow-xs"
                placeholder="Top"
                step={0.5}
              />
            </div>

            <div className="flex items-center justify-between gap-1">
              <input
                type="number"
                value={boxModel.margin.leftMm}
                onChange={(e) => updateMargin('leftMm', parseFloat(e.target.value) || 0)}
                className="w-14 text-center text-xs font-mono font-bold py-0.5 bg-white border border-amber-300 rounded shadow-xs"
                placeholder="Left"
                step={0.5}
              />

              {/* Inner Padding Box */}
              <div className="flex-1 p-2 bg-emerald-50/70 rounded-lg border border-emerald-300/70 relative mx-1">
                <span className="block text-center text-[9px] font-extrabold uppercase text-emerald-700 tracking-wider mb-1">
                  PADDING (Đệm trong - mm)
                </span>

                <div className="flex justify-center mb-1">
                  <input
                    type="number"
                    value={boxModel.padding.topMm}
                    onChange={(e) => updatePadding('topMm', parseFloat(e.target.value) || 0)}
                    className="w-14 text-center text-xs font-mono font-bold py-0.5 bg-white border border-emerald-400 rounded shadow-xs"
                    placeholder="Top"
                    step={0.5}
                  />
                </div>

                <div className="flex items-center justify-between gap-1">
                  <input
                    type="number"
                    value={boxModel.padding.leftMm}
                    onChange={(e) => updatePadding('paddingLeftMm' as any, parseFloat(e.target.value) || 0)}
                    className="w-14 text-center text-xs font-mono font-bold py-0.5 bg-white border border-emerald-400 rounded shadow-xs"
                    placeholder="Left"
                    step={0.5}
                  />
                  <div className="px-3 py-1 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-200">
                    Nội dung
                  </div>
                  <input
                    type="number"
                    value={boxModel.padding.rightMm}
                    onChange={(e) => updatePadding('rightMm', parseFloat(e.target.value) || 0)}
                    className="w-14 text-center text-xs font-mono font-bold py-0.5 bg-white border border-emerald-400 rounded shadow-xs"
                    placeholder="Right"
                    step={0.5}
                  />
                </div>

                <div className="flex justify-center mt-1">
                  <input
                    type="number"
                    value={boxModel.padding.bottomMm}
                    onChange={(e) => updatePadding('bottomMm', parseFloat(e.target.value) || 0)}
                    className="w-14 text-center text-xs font-mono font-bold py-0.5 bg-white border border-emerald-400 rounded shadow-xs"
                    placeholder="Bottom"
                    step={0.5}
                  />
                </div>
              </div>

              <input
                type="number"
                value={boxModel.margin.rightMm}
                onChange={(e) => updateMargin('rightMm', parseFloat(e.target.value) || 0)}
                className="w-14 text-center text-xs font-mono font-bold py-0.5 bg-white border border-amber-300 rounded shadow-xs"
                placeholder="Right"
                step={0.5}
              />
            </div>

            <div className="flex justify-center mt-1">
              <input
                type="number"
                value={boxModel.margin.bottomMm}
                onChange={(e) => updateMargin('bottomMm', parseFloat(e.target.value) || 0)}
                className="w-14 text-center text-xs font-mono font-bold py-0.5 bg-white border border-amber-300 rounded shadow-xs"
                placeholder="Bottom"
                step={0.5}
              />
            </div>
          </div>
        </div>
      )}

      {/* 2. BORDER & BACKGROUND */}
      {activeTab === 'border' && (
        <div className="space-y-3">
          {/* Border Sides Toggle */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-zinc-600 block">
              Các cạnh viền hiển thị
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'top', label: 'Trên (Top)' },
                { id: 'right', label: 'Phải (Right)' },
                { id: 'bottom', label: 'Dưới (Bottom)' },
                { id: 'left', label: 'Trái (Left)' },
              ].map((side) => {
                const isActive = (boxModel.border as any)[side.id];
                return (
                  <button
                    key={side.id}
                    type="button"
                    onClick={() => updateBorder({ [side.id]: !isActive, show: true })}
                    className={`py-1.5 px-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                        : 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200'
                    }`}
                  >
                    {side.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Border Style, Width, Color */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-zinc-600">Kiểu viền</label>
              <Select
                value={boxModel.border.style}
                onChange={(val) => updateBorder({ style: val as any, show: val !== 'none' })}
                options={[
                  { value: 'none', label: 'Không viền' },
                  { value: 'solid', label: 'Solid (Liền)' },
                  { value: 'dashed', label: 'Dashed (Đứt)' },
                  { value: 'dotted', label: 'Dotted (Chấm)' },
                  { value: 'double', label: 'Double (Đôi)' },
                ]}
                variant="white-shadow-4"
                size="sm"
              />
            </div>

            <NumberInput
              label="Độ dày viền"
              value={boxModel.border.widthPt}
              onChange={(val) => updateBorder({ widthPt: val })}
              unit="pt"
              min={0.5}
              max={5}
              step={0.5}
            />

            <NumberInput
              label="Bo góc viền"
              value={boxModel.border.radiusPx}
              onChange={(val) => updateBorder({ radiusPx: val })}
              unit="px"
              min={0}
              max={24}
              step={1}
            />
          </div>

          {/* Colors */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-zinc-100">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-zinc-600">Màu viền</label>
              <div className="flex items-center gap-1.5 h-8">
                <input
                  type="color"
                  value={boxModel.border.color || '#CBD5E1'}
                  onChange={(e) => updateBorder({ color: e.target.value })}
                  className="w-7 h-7 rounded-lg border border-zinc-300 cursor-pointer p-0"
                />
                <span className="text-[10px] font-mono text-zinc-600">
                  {boxModel.border.color || '#CBD5E1'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-zinc-600">Màu nền khung</label>
              <div className="flex items-center gap-1.5 h-8">
                <input
                  type="color"
                  value={
                    boxModel.backgroundColor && boxModel.backgroundColor !== 'transparent'
                      ? boxModel.backgroundColor
                      : '#FFFFFF'
                  }
                  onChange={(e) => onChange({ backgroundColor: e.target.value })}
                  className="w-7 h-7 rounded-lg border border-zinc-300 cursor-pointer p-0"
                />
                <button
                  type="button"
                  onClick={() => onChange({ backgroundColor: 'transparent' })}
                  className="text-[10px] px-2 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700"
                >
                  Trong suốt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. DIMENSIONS & OVERFLOW */}
      {activeTab === 'dimensions' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-zinc-600">Chiều rộng (Width)</label>
              <input
                type="text"
                value={boxModel.width || '100%'}
                onChange={(e) => onChange({ width: e.target.value })}
                placeholder="100% hoặc 280px"
                className="w-full px-2.5 py-1.5 text-xs font-mono bg-zinc-50 border border-zinc-200 rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-zinc-600">
                Tràn nội dung (Overflow)
              </label>
              <Select
                value={boxModel.overflow}
                onChange={(val) => onChange({ overflow: val as any })}
                options={[
                  { value: 'visible', label: 'Visible (Tràn tự nhiên)' },
                  { value: 'hidden', label: 'Hidden (Ẩn phần tràn)' },
                  { value: 'clip', label: 'Clip (Cắt tỉa gọn)' },
                ]}
                variant="white-shadow-4"
                size="sm"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
