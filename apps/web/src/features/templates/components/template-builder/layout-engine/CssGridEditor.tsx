'use client';

import React from 'react';
import { CssGridConfig } from '@/types/template-engine/layout';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { LayoutGrid, Code2 } from 'lucide-react';

interface CssGridEditorProps {
  config: CssGridConfig;
  onChange: (updated: Partial<CssGridConfig>) => void;
}

const PRESET_COLUMNS = [
  { label: '2 Cột đều nhau (1fr 1fr) -> Typst: (1fr, 1fr)', value: '1fr 1fr' },
  { label: 'Sidebar SciSpace 28% + 72% -> Typst: (28%, 72%)', value: '28% 72%' },
  { label: 'Sidebar 240px + Nội dung (240px 1fr)', value: '240px 1fr' },
  { label: '3 Cột đều (repeat(3, 1fr)) -> Typst: (1fr, 1fr, 1fr)', value: 'repeat(3, 1fr)' },
  { label: 'Bất đối xứng (1fr 2fr)', value: '1fr 2fr' },
  { label: '1 Cột tràn (1fr)', value: '1fr' },
];

export const CssGridEditor: React.FC<CssGridEditorProps> = ({
  config,
  onChange,
}) => {
  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_0_10px_rgba(0,0,0,0.03)] space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-zinc-700" />
          <h4 className="text-xs font-extrabold text-zinc-900">
            Cấu hình Lưới Typst Grid (#grid tracks & gutter)
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60">
          #grid(columns: (...))
        </span>
      </div>

      {/* Preset Columns */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-zinc-700 block">
          Mẫu phân bổ cột (Grid Columns)
        </label>
        <Select
          value={config.templateColumns}
          onChange={(val) => onChange({ templateColumns: val })}
          options={PRESET_COLUMNS.map((p) => ({ value: p.value, label: p.label }))}
          variant="flat-white"
          size="sm"
        />
      </div>

      {/* Custom Template Columns Input */}
      <div className="space-y-1">
        <label className="text-[11px] font-bold text-zinc-600 block">
          Tùy biến cột (fr, mm, %, pt):
        </label>
        <div className="relative">
          <input
            type="text"
            value={config.templateColumns}
            onChange={(e) => onChange({ templateColumns: e.target.value })}
            placeholder="e.g. 28% 1fr hoặc 1fr 1fr"
            className="w-full px-3 py-2 text-xs font-mono font-bold text-zinc-900 bg-white border border-zinc-200/90 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#78C841]/20 focus:border-[#78C841] shadow-2xs"
          />
        </div>
      </div>

      {/* Column Gap & Row Gap */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <NumberInput
            label="Khoảng cách cột (Gutter)"
            value={config.columnGapMm}
            onChange={(val) => onChange({ columnGapMm: val })}
            unit="mm"
            min={0}
            max={30}
            step={0.5}
            variant="flat-white"
          />
        </div>

        <div>
          <NumberInput
            label="Khoảng cách dòng (Row Gap)"
            value={config.rowGapMm}
            onChange={(val) => onChange({ rowGapMm: val })}
            unit="mm"
            min={0}
            max={30}
            step={0.5}
            variant="flat-white"
          />
        </div>
      </div>
    </div>
  );
};
