'use client';

import React from 'react';
import { RotateCw } from 'lucide-react';
import { SegmentedOptions } from './sections/SegmentedOptions';

interface PageOrientationSettingProps {
  value?: 'portrait' | 'landscape';
  onChange: (value: 'portrait' | 'landscape') => void;
}

/** Document-wide page orientation (drawer). The first page (title block) always stays portrait. */
export const PageOrientationSetting: React.FC<PageOrientationSettingProps> = ({ value, onChange }) => (
  <div className="space-y-2" data-testid="orientation-setting">
    <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
      <RotateCw className="w-3.5 h-3.5 text-zinc-500" />
      Hướng trang (toàn bộ nội dung)
    </label>
    <SegmentedOptions
      ariaLabel="Hướng trang toàn bộ nội dung"
      value={value ?? 'portrait'}
      onChange={onChange}
      options={[
        { value: 'portrait', label: 'Dọc', testId: 'orientation-portrait' },
        { value: 'landscape', label: 'Ngang', testId: 'orientation-landscape' },
      ]}
    />
    <p className="text-[10px] text-zinc-500 leading-snug">Trang đầu (khối tiêu đề) luôn để dọc.</p>
  </div>
);
