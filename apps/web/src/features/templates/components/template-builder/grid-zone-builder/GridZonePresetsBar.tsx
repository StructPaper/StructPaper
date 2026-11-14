'use client';

import React from 'react';
import { GRID_ZONE_PRESETS, GridPresetOption } from '@/types/grid-zones';
import { LayoutGrid, Sparkles } from 'lucide-react';

interface GridZonePresetsBarProps {
  onApplyPreset: (preset: GridPresetOption) => void;
}

export const GridZonePresetsBar: React.FC<GridZonePresetsBarProps> = ({
  onApplyPreset,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 select-none no-scrollbar">
      <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1 shrink-0 mr-1">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        <span>Gợi ý bố cục:</span>
      </span>

      {GRID_ZONE_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          onClick={() => onApplyPreset(preset)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 border border-zinc-200/90 text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shadow-2xs hover:border-[#78C841] hover:scale-102 active:scale-98 shrink-0"
          title={preset.description}
        >
          <LayoutGrid className="w-3 h-3 text-[#78C841]" />
          <span>{preset.name}</span>
          <span className="text-[9px] font-mono text-zinc-400">
            ({preset.columns}×{preset.rows})
          </span>
        </button>
      ))}
    </div>
  );
};
