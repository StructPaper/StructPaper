'use client';

import React from 'react';
import { TemplateGridConfig } from '@/types/template-builder';
import { NumberInput } from '@/components/ui/NumberInput';
import { Link2, Unlink, RotateCcw, Sparkles } from 'lucide-react';

interface GridZoneControlsProps {
  gridConfig: TemplateGridConfig;
  onUpdateGridConfig: (updated: Partial<TemplateGridConfig>) => void;
  onResetGrid: () => void;
  onOpenPresets?: () => void;
}

export const GridZoneControls: React.FC<GridZoneControlsProps> = ({
  gridConfig,
  onUpdateGridConfig,
  onResetGrid,
  onOpenPresets,
}) => {
  const isGapSynced = gridConfig.gapSync !== false;

  const handleGapChange = (val: number) => {
    if (isGapSynced) {
      onUpdateGridConfig({ rowGap: val, colGap: val });
    } else {
      onUpdateGridConfig({ colGap: val });
    }
  };

  const handleRowGapChange = (val: number) => {
    onUpdateGridConfig({ rowGap: val });
  };

  const handleColGapChange = (val: number) => {
    onUpdateGridConfig({ colGap: val });
  };

  const toggleGapSync = () => {
    onUpdateGridConfig({ gapSync: !isGapSynced });
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-1 rounded-2xl">
      {/* Grid Dimensions & Gap Settings (matching top bar in reference image) */}
      <div className="flex items-center gap-3 sm:gap-5 flex-wrap justify-center sm:justify-start">
        {/* Columns Input */}
        <div className="flex flex-col items-center">
          <label className="text-[11px] font-extrabold text-zinc-700 mb-1">
            Columns
          </label>
          <div className="w-16">
            <NumberInput
              value={gridConfig.columns}
              onChange={(val) => onUpdateGridConfig({ columns: Math.max(1, Math.min(12, val)) })}
              min={1}
              max={12}
              step={1}
              size="xs"
              variant="flat-white"
            />
          </div>
        </div>

        {/* Rows Input */}
        <div className="flex flex-col items-center">
          <label className="text-[11px] font-extrabold text-zinc-700 mb-1">
            Rows
          </label>
          <div className="w-16">
            <NumberInput
              value={gridConfig.rows}
              onChange={(val) => onUpdateGridConfig({ rows: Math.max(1, Math.min(12, val)) })}
              min={1}
              max={12}
              step={1}
              size="xs"
              variant="flat-white"
            />
          </div>
        </div>

        {/* Gaps: Synchronized or Independent */}
        {isGapSynced ? (
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-1">
              <label className="text-[11px] font-extrabold text-zinc-700">
                Gap ({gridConfig.unit || 'px'})
              </label>
              <button
                type="button"
                onClick={toggleGapSync}
                className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer transition-colors"
                title="Đang khóa Gap đồng bộ. Bấm để chỉnh riêng Row Gap & Col Gap"
              >
                <Link2 className="w-3 h-3 text-[#78C841]" />
              </button>
            </div>
            <div className="w-18">
              <NumberInput
                value={gridConfig.colGap}
                onChange={handleGapChange}
                min={0}
                max={48}
                step={1}
                size="xs"
                variant="flat-white"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1 mb-1">
                <label className="text-[10px] font-extrabold text-zinc-700">
                  Col Gap
                </label>
                <button
                  type="button"
                  onClick={toggleGapSync}
                  className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded cursor-pointer transition-colors"
                  title="Bấm để đồng bộ lại Row Gap & Col Gap"
                >
                  <Unlink className="w-3 h-3 text-amber-500" />
                </button>
              </div>
              <div className="w-16">
                <NumberInput
                  value={gridConfig.colGap}
                  onChange={handleColGapChange}
                  min={0}
                  max={48}
                  step={1}
                  size="xs"
                  variant="flat-white"
                />
              </div>
            </div>

            <div className="flex flex-col items-center">
              <label className="text-[10px] font-extrabold text-zinc-700 mb-1">
                Row Gap
              </label>
              <div className="w-16">
                <NumberInput
                  value={gridConfig.rowGap}
                  onChange={handleRowGapChange}
                  min={0}
                  max={48}
                  step={1}
                  size="xs"
                  variant="flat-white"
                />
              </div>
            </div>
          </div>
        )}

        {/* Unit switch: px or mm */}
        <div className="flex flex-col items-center">
          <label className="text-[11px] font-extrabold text-zinc-700 mb-1">
            Đơn vị
          </label>
          <div className="flex bg-zinc-200/80 p-0.5 rounded-xl select-none">
            <button
              type="button"
              onClick={() => onUpdateGridConfig({ unit: 'px' })}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${gridConfig.unit !== 'mm'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
                }`}
            >
              px
            </button>
            <button
              type="button"
              onClick={() => onUpdateGridConfig({ unit: 'mm' })}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${gridConfig.unit === 'mm'
                ? 'bg-white text-zinc-900 shadow-2xs'
                : 'text-zinc-600 hover:text-zinc-900'
                }`}
            >
              mm
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons right */}
      <div className="flex items-center gap-2">
        {onOpenPresets && (
          <button
            type="button"
            onClick={onOpenPresets}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200/80 text-zinc-700 hover:text-zinc-900 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-102 active:scale-98"
            title="Chọn mẫu lưới định dạng sẵn"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Mẫu bố cục</span>
          </button>
        )}

        <button
          type="button"
          onClick={onResetGrid}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-300 text-zinc-700 hover:text-zinc-950 text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-102 active:scale-98"
          title="Đặt lại lưới về mặc định"
        >
          <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
          <span>Reset</span>
        </button>
      </div>
    </div>
  );
};
