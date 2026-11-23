'use client';

import React from 'react';
import { Palette, Type, Ruler, Table as TableIcon, RotateCcw } from 'lucide-react';
import type { ThemeSettings } from '@/types/paper';
import { DEFAULT_THEME, resolveTheme, sanitizeHex } from '@/lib/theme-config';
import { NumberInput } from '@/components/ui/NumberInput';
import { Select } from '@/components/ui/Select';
import { Field, SettingsCard, ToggleRow } from './settings-ui';

interface Props {
  theme: ThemeSettings | undefined;
  /** Journal brand colour used when no explicit title colour is set. */
  journalColor?: string;
  onChange: (theme: ThemeSettings) => void;
}

const FONT_CHOICES = ['Times New Roman', 'Georgia', 'Cambria', 'Palatino Linotype', 'Calibri', 'Arial', 'Source Serif 4', 'Source Sans 3'];
const FONT_OPTIONS = FONT_CHOICES.map((f) => ({ value: f, label: f }));

const ColorField: React.FC<{ label: string; value: string; onChange: (hex: string) => void }> = ({ label, value, onChange }) => (
  <label className="flex items-center justify-between gap-3 cursor-pointer">
    <span className="text-xs font-bold text-slate-700">{label}</span>
    <span className="flex items-center gap-2">
      <code className="text-[10.5px] text-zinc-500 uppercase">{value}</code>
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(sanitizeHex(e.target.value, value))}
        aria-label={label}
        className="w-8 h-8 rounded-xl border border-zinc-200 bg-white cursor-pointer p-0.5"
      />
    </span>
  </label>
);

const useTheme = ({ theme, journalColor, onChange }: Props) => {
  const r = resolveTheme({ theme }, journalColor);
  const set = (patch: Partial<ThemeSettings>) => onChange({ ...(theme || {}), ...patch });
  return { r, set };
};

/** Colours of the headings, the table header row and the alternate rows. */
export const ThemeColorsCard: React.FC<Props> = (props) => {
  const { r, set } = useTheme(props);
  return (
    <SettingsCard title="Màu sắc" hint="Màu tiêu đề, chú thích và nền bảng." icon={<Palette />} testId="theme-colors">
      <div className="space-y-2.5">
        <ColorField label="Tiêu đề và chú thích" value={r.titleColor} onChange={(v) => set({ titleColor: v })} />
        <ColorField label="Nền hàng tiêu đề bảng" value={r.tableHeaderColor} onChange={(v) => set({ tableHeaderColor: v })} />
        <ColorField label="Nền hàng xen kẽ" value={r.tableZebraColor} onChange={(v) => set({ tableZebraColor: v })} />
      </div>
    </SettingsCard>
  );
};

/** Body and heading fonts. */
export const ThemeFontsFields: React.FC<Props> = (props) => {
  const { r, set } = useTheme(props);
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Phông chữ nội dung">
        <Select options={FONT_OPTIONS} value={r.bodyFont} onChange={(v) => set({ bodyFont: v })} size="sm" variant="clean" fullWidth />
      </Field>
      <Field label="Phông chữ tiêu đề">
        <Select options={FONT_OPTIONS} value={r.headingFont} onChange={(v) => set({ headingFont: v })} size="sm" variant="clean" fullWidth />
      </Field>
    </div>
  );
};

/** The four page margins in centimetres. */
export const ThemeMarginsCard: React.FC<Props> = (props) => {
  const { r, set } = useTheme(props);
  const setMargin = (side: 'top' | 'bottom' | 'left' | 'right', v: number) => set({ margins: { ...(props.theme?.margins || {}), [side]: v } });
  const sides = [
    ['top', 'Trên'],
    ['bottom', 'Dưới'],
    ['left', 'Trái'],
    ['right', 'Phải'],
  ] as const;
  return (
    <SettingsCard title="Lề trang" hint="Khoảng cách từ mép giấy đến nội dung, tính bằng cm." icon={<Ruler />} testId="theme-margins">
      <div className="grid grid-cols-2 gap-3">
        {sides.map(([side, label]) => (
          <Field key={side} label={label}>
            <NumberInput
              value={r.margins[side]}
              onChange={(v) => setMargin(side, v)}
              min={0.5}
              max={6}
              step={0.1}
              unit="cm"
              variant="flat-white"
              ariaLabel={`Lề ${label.toLowerCase()} (cm)`}
            />
          </Field>
        ))}
      </div>
    </SettingsCard>
  );
};

/** How long and rotated tables, and numbered headings, are typeset. */
export const ThemeTablesCard: React.FC<Props> = (props) => {
  const { r, set } = useTheme(props);
  return (
    <SettingsCard title="Bảng và đề mục" hint="Cách bảng dài, bảng xoay và số thứ tự mục được in." icon={<TableIcon />} testId="theme-tables">
      <div className="space-y-3.5">
        <ToggleRow
          checked={r.repeatTableHeader}
          onChange={(v) => set({ repeatTableHeader: v })}
          label="Lặp lại hàng tiêu đề"
          hint="Khi bảng dài sang trang mới."
        />
        <ToggleRow
          checked={r.keepSectionNumbers}
          onChange={(v) => set({ keepSectionNumbers: v })}
          label="Giữ số thứ tự mục"
          hint={'Giữ "4. Kết quả" như trong bản Word khi in.'}
        />
        <ToggleRow
          checked={r.turnSheets}
          onChange={(v) => set({ turnSheets: v })}
          label="Xoay cả tờ giấy khi bảng xoay ngang"
          hint="Bật (mặc định): trang có bảng, hình xoay (kể cả phụ lục) thành tờ ngang, dễ đọc trên màn hình. Tắt: mọi tờ giấy thẳng đứng (dễ in), chỉ bảng và hình xoay trong trang."
        />
        <Field label="Cho phép ngắt trang khi bảng dài hơn" hint="Tính theo số hàng của bảng.">
          <NumberInput
            value={r.longTableRowThreshold}
            onChange={(v) => set({ longTableRowThreshold: Math.round(v) })}
            min={1}
            max={200}
            step={1}
            unit="hàng"
            variant="flat-white"
            ariaLabel="Bảng dài hơn (số hàng) thì cho phép ngắt trang"
          />
        </Field>
      </div>
    </SettingsCard>
  );
};

/** Back to the default look. */
export const ThemeResetButton: React.FC<Pick<Props, 'onChange'>> = ({ onChange }) => (
  <button
    type="button"
    onClick={() => onChange({})}
    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
  >
    <RotateCcw className="w-3.5 h-3.5" />
    Khôi phục màu, phông và lề mặc định ({DEFAULT_THEME.titleColor})
  </button>
);

/** Everything about colours, fonts, margins and table looks, one card after another (kept for callers that want it whole). */
export const ThemeSettingsSection: React.FC<Props> = (props) => (
  <div className="space-y-3" data-testid="theme-settings">
    <ThemeColorsCard {...props} />
    <SettingsCard title="Phông chữ" icon={<Type />}>
      <ThemeFontsFields {...props} />
    </SettingsCard>
    <ThemeMarginsCard {...props} />
    <ThemeTablesCard {...props} />
    <ThemeResetButton onChange={props.onChange} />
  </div>
);
