'use client';

import React from 'react';
import { Palette } from 'lucide-react';
import type { ThemeSettings } from '@/types/paper';
import { DEFAULT_THEME, resolveTheme, sanitizeHex } from '@/lib/theme-config';

interface Props {
  theme: ThemeSettings | undefined;
  /** Journal brand colour used when no explicit title colour is set. */
  journalColor?: string;
  onChange: (theme: ThemeSettings) => void;
}

const FONT_CHOICES = ['Times New Roman', 'Georgia', 'Cambria', 'Palatino Linotype', 'Calibri', 'Arial', 'Source Serif 4', 'Source Sans 3'];

const ColorField: React.FC<{ label: string; value: string; onChange: (hex: string) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-2 text-[11px] font-bold text-zinc-700">
    <span>{label}</span>
    <span className="flex items-center gap-1.5">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(sanitizeHex(e.target.value, value))}
        aria-label={label}
        className="w-7 h-7 rounded-lg border border-zinc-200 bg-white cursor-pointer p-0.5"
      />
      <code className="text-[10px] text-zinc-500 w-[56px]">{value}</code>
    </span>
  </label>
);

const NumberField: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void }> = ({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
}) => (
  <label className="flex items-center justify-between gap-2 text-[11px] font-bold text-zinc-700">
    <span>{label}</span>
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      aria-label={label}
      onChange={(e) => {
        const n = parseFloat(e.target.value);
        if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
      className="w-20 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold text-zinc-800 outline-none focus:ring-2 focus:ring-lime-300"
    />
  </label>
);

export const ThemeSettingsSection: React.FC<Props> = ({ theme, journalColor, onChange }) => {
  const r = resolveTheme({ theme }, journalColor);
  const set = (patch: Partial<ThemeSettings>) => onChange({ ...(theme || {}), ...patch });
  const setMargin = (side: 'top' | 'bottom' | 'left' | 'right', v: number) =>
    set({ margins: { ...(theme?.margins || {}), [side]: v } });

  return (
    <div className="p-4 rounded-3xl bg-white border border-[#EAECEF] space-y-4 shadow-2xs" data-testid="theme-settings">
      <label className="text-xs font-extrabold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
        <Palette className="w-3.5 h-3.5 text-zinc-500" />
        Màu sắc, phông chữ & lề
      </label>

      <div className="space-y-2">
        <ColorField label="Màu tiêu đề / chú thích" value={r.titleColor} onChange={(v) => set({ titleColor: v })} />
        <ColorField label="Màu nền hàng tiêu đề bảng" value={r.tableHeaderColor} onChange={(v) => set({ tableHeaderColor: v })} />
        <ColorField label="Màu nền hàng xen kẽ" value={r.tableZebraColor} onChange={(v) => set({ tableZebraColor: v })} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-[11px] font-bold text-zinc-700">
          <span>Phông chữ nội dung</span>
          <select
            value={r.bodyFont}
            onChange={(e) => set({ bodyFont: e.target.value })}
            aria-label="Phông chữ nội dung"
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-semibold"
          >
            {FONT_CHOICES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-[11px] font-bold text-zinc-700">
          <span>Phông chữ tiêu đề</span>
          <select
            value={r.headingFont}
            onChange={(e) => set({ headingFont: e.target.value })}
            aria-label="Phông chữ tiêu đề"
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs font-semibold"
          >
            {FONT_CHOICES.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>

      <div>
        <p className="text-[11px] font-bold text-zinc-700 mb-1.5">Lề trang (cm)</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <NumberField label="Trên" value={r.margins.top} min={0.5} max={6} onChange={(v) => setMargin('top', v)} />
          <NumberField label="Dưới" value={r.margins.bottom} min={0.5} max={6} onChange={(v) => setMargin('bottom', v)} />
          <NumberField label="Trái" value={r.margins.left} min={0.5} max={6} onChange={(v) => setMargin('left', v)} />
          <NumberField label="Phải" value={r.margins.right} min={0.5} max={6} onChange={(v) => setMargin('right', v)} />
        </div>
      </div>

      <div className="space-y-2 pt-1 border-t border-zinc-100">
        <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-700 cursor-pointer">
          <input
            type="checkbox"
            checked={r.repeatTableHeader}
            onChange={(e) => set({ repeatTableHeader: e.target.checked })}
            className="accent-lime-500"
          />
          Lặp lại hàng tiêu đề khi bảng dài sang trang mới
        </label>
        <label className="flex items-center gap-2 text-[11px] font-bold text-zinc-700 cursor-pointer">
          <input
            type="checkbox"
            checked={r.keepSectionNumbers}
            onChange={(e) => set({ keepSectionNumbers: e.target.checked })}
            className="accent-lime-500"
          />
          Giữ số thứ tự mục ("4. Kết quả") khi in
        </label>
        <NumberField
          label="Bảng dài hơn (số hàng) thì cho phép ngắt trang"
          value={r.longTableRowThreshold}
          min={1}
          max={200}
          step={1}
          onChange={(v) => set({ longTableRowThreshold: Math.round(v) })}
        />
      </div>

      <button
        type="button"
        onClick={() => onChange({})}
        className="text-[11px] font-bold text-zinc-500 hover:text-zinc-800 underline underline-offset-2"
      >
        Khôi phục giao diện mặc định ({DEFAULT_THEME.titleColor})
      </button>
    </div>
  );
};
