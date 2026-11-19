'use client';

import React from 'react';
import type { PaperFigure, PaperTable } from '@/types/paper';
import { resolveBodyFill } from '@/lib/table-fill';

/** One small fact about how a table or figure is set (columns, orientation, type size...). */
export interface SettingChip {
  key: string;
  label: string;
  /** Marks a setting the author changed from the default, so it stands out. */
  accent?: boolean;
}

const PLACEMENT: Record<string, string> = { top: 'Đầu trang', here: 'Tại chỗ', bottom: 'Cuối trang' };
const FILL: Record<string, string> = { plain: 'Nền trơn', zebra: 'Nền sọc', shaded: 'Nền tô đều' };
const BREAK: Record<string, string> = { always: 'Cho ngắt trang', never: 'Không ngắt trang' };
const ALIGN: Record<string, string> = { left: 'Căn trái', right: 'Căn phải' };

const spansTwo = (b: { columnSpan?: string; isFullWidth?: boolean }) => b.columnSpan === '2-column' || (b.columnSpan === undefined && b.isFullWidth !== false);

/** The settings of a table that matter when reading it: columns, orientation, type size, fill, where it floats, page breaks. */
export function tableSettingChips(table: PaperTable): SettingChip[] {
  const chips: SettingChip[] = [
    { key: 'columns', label: spansTwo(table) ? '2 cột' : '1 cột' },
    { key: 'orientation', label: table.isRotated ? 'Hướng ngang (xoay 90°)' : 'Hướng dọc', accent: !!table.isRotated },
    { key: 'font', label: `Chữ ${table.fontSize || '8pt'}` },
    { key: 'fill', label: FILL[resolveBodyFill(table)] },
  ];
  if (table.placement && PLACEMENT[table.placement]) chips.push({ key: 'placement', label: PLACEMENT[table.placement], accent: true });
  if (table.breakAcrossPages && BREAK[table.breakAcrossPages]) chips.push({ key: 'break', label: BREAK[table.breakAcrossPages], accent: true });
  return chips;
}

/** The settings of a figure that matter when reading it: columns, scale, alignment, border, where it floats. */
export function figureSettingChips(figure: PaperFigure): SettingChip[] {
  const chips: SettingChip[] = [
    { key: 'columns', label: spansTwo(figure) ? '2 cột' : '1 cột' },
    { key: 'scale', label: `Kích thước ${figure.scalePercent || 100}%`, accent: !!figure.scalePercent && figure.scalePercent !== 100 },
  ];
  if (figure.alignment && ALIGN[figure.alignment]) chips.push({ key: 'align', label: ALIGN[figure.alignment], accent: true });
  chips.push({ key: 'border', label: figure.hasBorder === false ? 'Không viền' : 'Có viền', accent: figure.hasBorder === false });
  if (figure.placement && PLACEMENT[figure.placement]) chips.push({ key: 'placement', label: PLACEMENT[figure.placement], accent: true });
  return chips;
}

/** The chips as small pills; read-only information, shown whether or not the paper can be edited. */
export const BlockSettingChips: React.FC<{ chips: SettingChip[]; testId?: string }> = ({ chips, testId }) => (
  <div className="flex flex-wrap items-center gap-1.5" data-testid={testId}>
    {chips.map((c) => (
      <span
        key={c.key}
        data-testid={`setting-${c.key}`}
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${c.accent ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-600'}`}
      >
        {c.label}
      </span>
    ))}
  </div>
);
