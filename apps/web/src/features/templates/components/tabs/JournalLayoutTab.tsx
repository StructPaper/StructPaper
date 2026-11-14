'use client';

import React from 'react';
import { JournalProfile } from '@structpaper/journal-profiles';
import { Columns } from 'lucide-react';
import { Select, SelectOption } from '@/components/ui/Select';

interface JournalLayoutTabProps {
  profile: JournalProfile;
  onChange: (updated: Partial<JournalProfile>) => void;
}

const PAPER_SIZE_OPTIONS: SelectOption<string>[] = [
  { value: 'A4', label: 'A4 (210 x 297 mm) - Chuẩn Quốc tế ĐHQG-HCM' },
  { value: 'Letter', label: 'US Letter (8.5 x 11 inch)' },
];

const COLUMNS_OPTIONS: SelectOption<number>[] = [
  { value: 1, label: '1 Cột (Single column - Dạng đơn)' },
  { value: 2, label: '2 Cột (Double column - Chuẩn VNUHCM)' },
];

export const JournalLayoutTab: React.FC<JournalLayoutTabProps> = ({
  profile,
  onChange,
}) => {
  const layout = profile.layout || {
    paperSize: 'A4',
    columns: 2,
    columnGap: 6.0,
    margins: { top: 20, bottom: 20, left: 20, right: 20, unit: 'mm' },
  };

  const updateLayout = (patch: Record<string, unknown>) => {
    onChange({ layout: { ...layout, ...patch } });
  };

  return (
    <div className="space-y-5 w-full">
      {/* 1. Page & Columns Grid */}
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <Columns className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-sm text-zinc-900">
            Dàn Trang &amp; Bố Cục Bản In
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">Khổ giấy</label>
            <Select<string>
              options={PAPER_SIZE_OPTIONS}
              value={layout.paperSize || 'A4'}
              onChange={(val) => updateLayout({ paperSize: val })}
              size="sm"
              variant="default"
              fullWidth
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">Số cột nội dung</label>
            <Select<number>
              options={COLUMNS_OPTIONS}
              value={layout.columns || 2}
              onChange={(val) => updateLayout({ columns: val })}
              size="sm"
              variant="default"
              fullWidth
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Khoảng cách cột nội dung (mm)
            </label>
            <input
              type="number"
              step={0.5}
              value={layout.columnGap ?? 6.0}
              onChange={(e) => updateLayout({ columnGap: parseFloat(e.target.value) || 0 })}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-800 focus:bg-white focus:border-[#78C841] outline-none"
            />
          </div>
        </div>

        {/* Margins */}
        <div className="pt-2">
          <label className="block text-xs font-bold text-zinc-700 mb-2">
            Lề trang in ấn (Margins - mm):
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
              <div key={side}>
                <span className="text-[10.5px] text-zinc-500 font-semibold uppercase">{side}:</span>
                <input
                  type="number"
                  value={layout.margins?.[side] ?? 20}
                  onChange={(e) =>
                    updateLayout({
                      margins: {
                        ...layout.margins,
                        [side]: parseFloat(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-full mt-1 bg-white border border-zinc-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-zinc-800 focus:bg-white focus:border-[#78C841] outline-none"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
