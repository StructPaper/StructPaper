'use client';

import React from 'react';
import { CssColumnsConfig } from '@/types/template-engine/layout';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { Columns } from 'lucide-react';

interface CssColumnsEditorProps {
  config: CssColumnsConfig;
  onChange: (updated: Partial<CssColumnsConfig>) => void;
}

export const CssColumnsEditor: React.FC<CssColumnsEditorProps> = ({
  config,
  onChange,
}) => {
  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_0_10px_rgba(0,0,0,0.03)] space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
        <div className="flex items-center gap-2">
          <Columns className="w-4 h-4 text-zinc-700" />
          <h4 className="text-xs font-extrabold text-zinc-900">
            Cấu hình Đa Cột Báo Chí (Typst #columns)
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/60">
          #columns({config.columnCount})
        </span>
      </div>

      {/* Column Count */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 block">
          Số lượng cột nội dung (Column Count)
        </label>
        <div className="grid grid-cols-4 gap-2">
          {([1, 2, 3, 4] as const).map((count) => {
            const isActive = config.columnCount === count;
            return (
              <button
                key={count}
                type="button"
                onClick={() => onChange({ columnCount: count })}
                className={`py-2 px-1 rounded-2xl text-xs font-bold flex flex-col items-center gap-0.5 border transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-2 ring-[#78C841]/50'
                    : 'bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 border-zinc-200/80 shadow-2xs'
                }`}
              >
                <span>{count} Cột</span>
                <span className={`text-[9px] ${isActive ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  {count === 1 ? '1 Cột' : count === 2 ? 'Chuẩn bài báo' : count === 3 ? 'Kỷ yếu' : 'Đặc biệt'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Column Gap & Fill */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <NumberInput
            label="Khoảng cách giữa các cột (Gutter)"
            value={config.columnGapMm}
            onChange={(val) => onChange({ columnGapMm: val })}
            unit="mm"
            min={1}
            max={25}
            step={0.5}
            variant="flat-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">
            Cân đối cột trang cuối
          </label>
          <Select
            value={config.columnFill}
            onChange={(val) => onChange({ columnFill: val as any })}
            options={[
              { value: 'balance', label: 'Cân bằng đều 2 cột (Balance)' },
              { value: 'auto', label: 'Tự nhiên từ trái sang (Auto)' },
            ]}
            variant="flat-white"
            size="sm"
          />
        </div>
      </div>

      {/* Column Rule (Đường kẻ phân cách cột) */}
      <div className="pt-2 border-t border-zinc-200/60 space-y-2">
        <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
          <input
            type="checkbox"
            checked={config.columnRule.show}
            onChange={(e) =>
              onChange({
                columnRule: { ...config.columnRule, show: e.target.checked },
              })
            }
            className="w-4 h-4 rounded-md border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
          />
          <span>Kẻ đường phân cách giữa các cột (Column Rule)</span>
        </label>

        {config.columnRule.show && (
          <div className="grid grid-cols-2 gap-3 pt-1 pl-6">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-zinc-600">Màu kẻ:</span>
              <div className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-1 border border-zinc-200/80 shadow-2xs">
                <input
                  type="color"
                  value={config.columnRule.color}
                  onChange={(e) =>
                    onChange({
                      columnRule: { ...config.columnRule, color: e.target.value },
                    })
                  }
                  className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="text-xs font-mono font-bold text-zinc-800 uppercase">
                  {config.columnRule.color}
                </span>
              </div>
            </div>

            <div>
              <NumberInput
                label="Độ dày đường kẻ"
                value={config.columnRule.widthPt}
                onChange={(val) =>
                  onChange({
                    columnRule: { ...config.columnRule, widthPt: val },
                  })
                }
                unit="pt"
                min={0.2}
                max={3}
                step={0.1}
                variant="flat-white"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
