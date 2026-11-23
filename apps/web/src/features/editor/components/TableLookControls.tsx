'use client';

import React from 'react';
import { Check } from 'lucide-react';
import type { PaperTable, TableBorderStyle } from '@/types/paper';
import { NumberInput } from '@/components/ui/NumberInput';
import { BORDER_STYLES, DEFAULT_BORDER_WIDTH, tableRulesOf } from '@/lib/table-style';
import { Field } from './settings-ui';
import { ColorPanel, Popover } from '../overview/overview-ui';

/** The look of a table's lines drawn small (3 columns × 3 rows) so the author can pick by sight. */
export const BorderPreview: React.FC<{ style: TableBorderStyle; color?: string; width?: number; active?: boolean }> = ({ style, color = '#52525b', width = 1, active }) => {
  const r = tableRulesOf({ borderStyle: style });
  const W = 44;
  const H = 30;
  const cols = [0, W / 3, (2 * W) / 3, W];
  const rows = [0, H / 3, (2 * H) / 3, H];
  const stroke = active ? '#14532D' : color;
  const line = (x1: number, y1: number, x2: number, y2: number, k: string) => <line key={k} x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={width} strokeLinecap="square" />;
  const lines: React.ReactNode[] = [];
  if (r.top) lines.push(line(0, 0, W, 0, 't'));
  if (r.bottom) lines.push(line(0, H, W, H, 'b'));
  if (r.hInner) [1, 2].forEach((i) => lines.push(line(0, rows[i], W, rows[i], `h${i}`)));
  if (r.vInner) [1, 2].forEach((i) => lines.push(line(cols[i], 0, cols[i], H, `v${i}`)));
  if (r.vOuter) [0, 3].forEach((i) => lines.push(line(cols[i], 0, cols[i], H, `o${i}`)));
  return (
    <svg viewBox={`-2 -2 ${W + 4} ${H + 4}`} className="w-full h-9" aria-hidden>
      {style === 'journal' && <rect x={0} y={0} width={W} height={rows[1]} fill="#e5e7eb" />}
      {/* a little text in each cell so the lines read as a table */}
      {[0, 1, 2].flatMap((ri) => [0, 1, 2].map((ci) => <rect key={`${ri}${ci}`} x={cols[ci] + 4} y={rows[ri] + 4.5} width={W / 3 - 9} height={1.6} rx={0.8} fill="#a1a1aa" opacity={ri === 0 ? 0.9 : 0.55} />))}
      {lines}
    </svg>
  );
};

interface PickerProps {
  value: TableBorderStyle;
  onChange: (v: TableBorderStyle) => void;
}

/** Six line styles, as little pictures. */
export const BorderStylePicker: React.FC<PickerProps> = ({ value, onChange }) => (
  <div role="radiogroup" aria-label="Kiểu đường kẻ" className="grid grid-cols-3 gap-2">
    {BORDER_STYLES.map((s) => {
      const on = value === s.value;
      return (
        <button
          key={s.value}
          type="button"
          role="radio"
          aria-checked={on}
          title={s.hint}
          data-testid={`border-style-${s.value}`}
          onClick={() => onChange(s.value)}
          className={`relative p-2 rounded-2xl border text-center transition-all cursor-pointer ${on ? 'bg-[#F7FEE7] border-[#78C841] ring-2 ring-[#78C841]/25' : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300'}`}
        >
          {on && (
            <span className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[#78C841] text-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          )}
          <BorderPreview style={s.value} active={on} />
          <span className="block mt-1 text-[10.5px] font-bold text-slate-800 leading-tight">{s.label}</span>
        </button>
      );
    })}
  </div>
);

/** A colour swatch with its code: it opens the same panel of colours as the page's toolbar (basic, the journal's, recent, any). */
export const ColorSwatchField: React.FC<{ label: string; value: string | undefined; fallback: string; onChange: (v: string | undefined) => void; testId?: string; journalId?: string }> = ({ label, value, fallback, onChange, testId, journalId }) => (
  <div className="flex items-center justify-between gap-2" data-testid={testId}>
    <span className="text-xs font-bold text-slate-600">{label}</span>
    <span className="flex items-center gap-1.5">
      {value && (
        <button type="button" onClick={() => onChange(undefined)} className="text-[10px] font-bold text-zinc-500 hover:text-zinc-900 underline underline-offset-2 cursor-pointer" title="Về màu mặc định">
          Mặc định
        </button>
      )}
      <code className="text-[10.5px] text-zinc-500 uppercase">{value || fallback}</code>
      <Popover
        label={null}
        title={label || 'Chọn màu'}
        width={300}
        align="right"
        chevron={false}
        trigger={(open, toggle) => (
          <button type="button" aria-label={label || 'Chọn màu'} title={label || 'Chọn màu'} onClick={toggle} className={`w-8 h-8 rounded-xl border border-zinc-200 cursor-pointer ${open ? 'ring-2 ring-[#78C841]' : ''}`} style={{ background: value || fallback }} />
        )}
      >
        {(close) => (
          <ColorPanel
            title={label || 'Chọn màu'}
            value={value ?? null}
            journalId={journalId}
            clearLabel={value ? 'Về màu mặc định' : undefined}
            onPick={(hex) => {
              onChange(hex ?? undefined);
              close();
            }}
          />
        )}
      </Popover>
    </span>
  </div>
);

export interface TableLookValue {
  borderStyle: TableBorderStyle;
  borderColor?: string;
  borderWidth?: number;
  headerFill?: string;
  bodyTint?: string;
  /** One least height for every body row, in points; 0 = as the text needs. */
  rowHeight: number;
  headerHeight: number;
}

/** Everything about how a table's lines, colours and row heights look (the settings dialog and the overview toolbar share it). */
export const TableLookControls: React.FC<{ value: TableLookValue; onChange: (patch: Partial<TableLookValue>) => void; themeHeader: string; themeTint: string }> = ({ value, onChange, themeHeader, themeTint }) => {
  const noLines = value.borderStyle === 'none';
  return (
    <div className="space-y-3.5">
      <Field label="Kiểu đường kẻ" title="Đường kẻ ngang, dọc, lưới, khung ngoài hoặc không kẻ">
        <BorderStylePicker value={value.borderStyle} onChange={(borderStyle) => onChange({ borderStyle })} />
      </Field>

      {!noLines && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Độ dày" hint={`Mặc định ${DEFAULT_BORDER_WIDTH}pt`}>
            <NumberInput
              value={value.borderWidth ?? DEFAULT_BORDER_WIDTH}
              onChange={(v) => onChange({ borderWidth: Math.round(v * 10) / 10 })}
              min={0.1}
              max={3}
              step={0.1}
              unit="pt"
              variant="flat-white"
              ariaLabel="Độ dày đường kẻ (pt)"
            />
          </Field>
          <Field label="Màu đường kẻ">
            <ColorSwatchField label="" value={value.borderColor} fallback="#000000" onChange={(borderColor) => onChange({ borderColor })} testId="border-color" />
          </Field>
        </div>
      )}

      <div className="space-y-2.5">
        <ColorSwatchField label="Màu dải tiêu đề" value={value.headerFill} fallback={themeHeader} onChange={(headerFill) => onChange({ headerFill })} testId="header-fill" />
        <ColorSwatchField label="Màu hàng được tô" value={value.bodyTint} fallback={themeTint} onChange={(bodyTint) => onChange({ bodyTint })} testId="body-tint" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Cao hàng tiêu đề" hint="0 = theo nội dung">
          <NumberInput value={value.headerHeight} onChange={(v) => onChange({ headerHeight: Math.max(0, Math.round(v)) })} min={0} max={120} step={1} unit="pt" variant="flat-white" ariaLabel="Chiều cao hàng tiêu đề (pt)" />
        </Field>
        <Field label="Cao mỗi hàng" hint="0 = theo nội dung">
          <NumberInput value={value.rowHeight} onChange={(v) => onChange({ rowHeight: Math.max(0, Math.round(v)) })} min={0} max={120} step={1} unit="pt" variant="flat-white" ariaLabel="Chiều cao mỗi hàng (pt)" />
        </Field>
      </div>
    </div>
  );
};

/** The table's look as the controls hold it. */
export function lookOf(table: PaperTable): TableLookValue {
  const heights = (table.rowHeights ?? []).filter((h): h is number => typeof h === 'number' && h > 0);
  const uniform = heights.length > 0 && heights.every((h) => h === heights[0]) ? heights[0] : 0;
  return {
    borderStyle: table.borderStyle ?? 'journal',
    borderColor: table.borderColor,
    borderWidth: table.borderWidth,
    headerFill: table.headerFill,
    bodyTint: table.bodyTint,
    rowHeight: uniform,
    headerHeight: table.headerHeight ?? 0,
  };
}

/** The table fields a look stands for (`rowHeights` is only rewritten when the author touched the row height). */
export function applyLook(table: PaperTable, look: TableLookValue, rowCount: number, rowHeightTouched: boolean): PaperTable {
  const next: PaperTable = { ...table };
  const set = <K extends keyof PaperTable>(k: K, v: PaperTable[K] | undefined) => {
    if (v === undefined) delete next[k];
    else next[k] = v;
  };
  set('borderStyle', look.borderStyle === 'journal' ? undefined : look.borderStyle);
  set('borderColor', look.borderColor);
  set('borderWidth', look.borderWidth === DEFAULT_BORDER_WIDTH ? undefined : look.borderWidth);
  set('headerFill', look.headerFill);
  set('bodyTint', look.bodyTint);
  set('headerHeight', look.headerHeight > 0 ? look.headerHeight : undefined);
  if (rowHeightTouched) set('rowHeights', look.rowHeight > 0 ? Array(rowCount).fill(look.rowHeight) : undefined);
  return next;
}
