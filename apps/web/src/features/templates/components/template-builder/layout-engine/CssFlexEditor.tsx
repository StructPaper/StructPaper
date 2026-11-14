'use client';

import React from 'react';
import { CssFlexConfig } from '@/types/template-engine/layout';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { AlignVerticalSpaceAround, ArrowRight, ArrowDown } from 'lucide-react';

interface CssFlexEditorProps {
  config: CssFlexConfig;
  onChange: (updated: Partial<CssFlexConfig>) => void;
}

export const CssFlexEditor: React.FC<CssFlexEditorProps> = ({
  config,
  onChange,
}) => {
  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_0_10px_rgba(0,0,0,0.03)] space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
        <div className="flex items-center gap-2">
          <AlignVerticalSpaceAround className="w-4 h-4 text-zinc-700" />
          <h4 className="text-xs font-extrabold text-zinc-900">
            Cấu hình Luồng Phần tử (Typst #stack / Flexbox)
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60">
          #stack(dir: {config.direction === 'row' ? 'ltr' : 'ttb'})
        </span>
      </div>

      {/* Flex Direction */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 block">
          Hướng dòng chảy (Direction)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { id: 'row', label: 'Hàng ngang (ltr)', icon: <ArrowRight className="w-3.5 h-3.5" /> },
            { id: 'column', label: 'Cột dọc (ttb)', icon: <ArrowDown className="w-3.5 h-3.5" /> },
            { id: 'row-reverse', label: 'Hàng ngược (rtl)', icon: <ArrowRight className="w-3.5 h-3.5 rotate-180" /> },
            { id: 'column-reverse', label: 'Cột ngược (btt)', icon: <ArrowDown className="w-3.5 h-3.5 rotate-180" /> },
          ].map((dir) => {
            const isActive = config.direction === dir.id;
            return (
              <button
                key={dir.id}
                type="button"
                onClick={() => onChange({ direction: dir.id as any })}
                className={`py-2 px-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-2 ring-[#78C841]/50'
                    : 'bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 border-zinc-200/80 shadow-2xs'
                }`}
              >
                <span className={isActive ? 'text-[#78C841]' : 'text-zinc-500'}>
                  {dir.icon}
                </span>
                <span className="truncate">{dir.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Justify Content & Align Items */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">
            Căn trục chính (Justify)
          </label>
          <Select
            value={config.justifyContent}
            onChange={(val) => onChange({ justifyContent: val as any })}
            options={[
              { value: 'flex-start', label: 'Đầu dòng (start)' },
              { value: 'center', label: 'Căn giữa (center)' },
              { value: 'flex-end', label: 'Cuối dòng (end)' },
              { value: 'space-between', label: 'Dãn đều 2 biên (space-between)' },
              { value: 'space-around', label: 'Dãn đều quanh (space-around)' },
            ]}
            variant="flat-white"
            size="sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">
            Căn trục phụ (Align)
          </label>
          <Select
            value={config.alignItems}
            onChange={(val) => onChange({ alignItems: val as any })}
            options={[
              { value: 'stretch', label: 'Kéo căng (stretch)' },
              { value: 'center', label: 'Căn giữa (center)' },
              { value: 'flex-start', label: 'Đầu (start)' },
              { value: 'flex-end', label: 'Cuối (end)' },
            ]}
            variant="flat-white"
            size="sm"
          />
        </div>
      </div>

      {/* Gap */}
      <div className="pt-1">
        <NumberInput
          label="Khoảng cách giữa các phần tử (Spacing / Gap)"
          value={config.gapMm}
          onChange={(val) => onChange({ gapMm: val })}
          unit="mm"
          min={0}
          max={30}
          step={0.5}
          variant="flat-white"
        />
      </div>
    </div>
  );
};
