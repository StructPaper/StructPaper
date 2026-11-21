'use client';

import React from 'react';
import { Check, X } from 'lucide-react';

/**
 * Building blocks shared by the three editor settings dialogs (page layout drawer, table, figure), drawn like the other
 * dialogs of the app: soft #F8F9FA sheet, round close button, white rounded cards, lime accents, pill buttons.
 */

/** Classes of the scrolling list that holds the sections: a thin line between them, no box around any. */
export const sectionListClass = 'divide-y divide-zinc-200/70 [&>*]:py-4 [&>*:first-child]:pt-1 [&>*:last-child]:pb-1';

/** Header: title (and a line under it) on the left, the round close button on the right. */
export const SettingsHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  compact?: boolean;
  closeTitle?: string;
}> = ({ title, subtitle, icon, onClose, compact, closeTitle = 'Đóng (Esc)' }) => (
  <div className={`flex-shrink-0 flex items-center justify-between gap-3 ${compact ? 'px-5 pt-4 pb-1' : 'px-6 pt-5 pb-2'}`}>
    <div className="flex items-center gap-3 min-w-0">
      {icon && (
        <div className="w-10 h-10 rounded-2xl bg-[#D9F99D]/60 border border-[#B4E50D]/40 flex items-center justify-center text-[#14532D] flex-shrink-0">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <h3 className={`${compact ? 'text-base' : 'text-lg'} font-black text-slate-900 tracking-tight truncate`}>{title}</h3>
        {subtitle && <p className="text-[11px] text-slate-500 font-medium truncate">{subtitle}</p>}
      </div>
    </div>
    <button
      type="button"
      onClick={onClose}
      title={closeTitle}
      aria-label="Đóng"
      className={`${compact ? 'w-9 h-9' : 'w-10 h-10'} rounded-full bg-gray-200/70 hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-all cursor-pointer flex-shrink-0`}
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

/** One topic of the settings: a flat section (no box of its own); the list around it separates the sections with a thin line. */
export const SettingsCard: React.FC<{
  title: string;
  hint?: string;
  icon?: React.ReactNode;
  aside?: React.ReactNode;
  testId?: string;
  children: React.ReactNode;
}> = ({ title, hint, icon, aside, testId, children }) => (
  <section data-testid={testId} className="space-y-3.5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <span className="mt-0.5 text-zinc-400 flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4">{icon}</span>}
        <div className="min-w-0">
          <h4 className="text-sm font-extrabold text-slate-900 leading-tight">{title}</h4>
          {hint && <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{hint}</p>}
        </div>
      </div>
      {aside && <div className="flex-shrink-0">{aside}</div>}
    </div>
    {children}
  </section>
);

/** A label (and a note) over one control. */
export const Field: React.FC<{ label: string; hint?: string; aside?: React.ReactNode; title?: string; testId?: string; children: React.ReactNode }> = ({
  label,
  hint,
  aside,
  title,
  testId,
  children,
}) => (
  <div className="space-y-1.5" data-testid={testId}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-bold text-slate-600" title={title}>
        {label}
      </span>
      {aside}
    </div>
    {children}
    {hint && <p className="text-[10.5px] text-slate-400 leading-snug">{hint}</p>}
  </div>
);

/** A small value badge to put in a Field's `aside`. */
export const ValueBadge: React.FC<{ children: React.ReactNode; title?: string }> = ({ children, title }) => (
  <span title={title} className="text-[10.5px] font-extrabold text-[#14532D] bg-[#D9F99D] px-2 py-0.5 rounded-full">
    {children}
  </span>
);

/** A switch with its label and a note; the whole row is the click target. */
export const ToggleRow: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  testId?: string;
}> = ({ checked, onChange, label, hint, testId }) => (
  <label className="flex items-start justify-between gap-4 cursor-pointer select-none" data-testid={testId}>
    <span className="min-w-0">
      <span className="block text-xs font-bold text-slate-800 leading-snug">{label}</span>
      {hint && <span className="block text-[10.5px] text-slate-500 leading-snug mt-0.5">{hint}</span>}
    </span>
    <span className="relative inline-flex items-center flex-shrink-0 mt-0.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" aria-label={label} />
      <span className="w-9 h-5 rounded-full bg-zinc-200 peer-checked:bg-[#78C841] transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-xs after:transition-all peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-lime-300" />
    </span>
  </label>
);

/** A choice drawn as a card (a small picture, a title, one line), for options that are easier to pick by sight. */
export const ChoiceCard: React.FC<{
  selected: boolean;
  onClick: () => void;
  title: string;
  sub?: string;
  tag?: React.ReactNode;
  tooltip?: string;
  testId?: string;
  children?: React.ReactNode;
}> = ({ selected, onClick, title, sub, tag, tooltip, testId, children }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    title={tooltip}
    data-testid={testId}
    onClick={onClick}
    className={`relative p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
      selected ? 'bg-[#F7FEE7] border-[#78C841] ring-2 ring-[#78C841]/25' : 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300'
    }`}
  >
    {selected && (
      <span className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#78C841] text-white flex items-center justify-center">
        <Check className="w-2.5 h-2.5 stroke-[3]" />
      </span>
    )}
    {children}
    <span className="text-xs font-extrabold text-slate-900 leading-tight pr-4">{title}</span>
    {sub && <span className="text-[10.5px] text-slate-500 leading-snug">{sub}</span>}
    {tag && <span className="mt-0.5">{tag}</span>}
  </button>
);

/** The little page drawing used inside choice cards. */
export const MiniPage: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`flex w-full h-11 bg-zinc-50 rounded-xl border border-zinc-200/70 p-1.5 gap-1 ${className}`}>{children}</span>
);

export const MiniLines: React.FC<{ tone?: 'text' | 'object'; widths?: string[] }> = ({ tone = 'text', widths = ['w-full', 'w-3/4', 'w-5/6'] }) => (
  <span
    className={`flex-1 h-full rounded-md flex flex-col justify-center gap-1 px-1.5 ${
      tone === 'object' ? 'bg-[#D9F99D]/80 border border-[#B4E50D]/60' : 'bg-zinc-200/70'
    }`}
  >
    {widths.map((w, i) => (
      <span key={i} className={`block h-[3px] rounded-full ${w} ${tone === 'object' ? 'bg-[#14532D]/70' : 'bg-zinc-400/80'}`} />
    ))}
  </span>
);

/** Small coloured tag ("Mặc định", "ISO 216"). */
export const Tag: React.FC<{ children: React.ReactNode; tone?: 'green' | 'blue' | 'grey' }> = ({ children, tone = 'grey' }) => (
  <span
    className={`inline-block text-[9.5px] font-bold px-1.5 py-0.5 rounded-md ${
      tone === 'green' ? 'bg-emerald-50 text-emerald-700' : tone === 'blue' ? 'bg-blue-50 text-blue-700' : 'bg-zinc-100 text-zinc-600'
    }`}
  >
    {children}
  </span>
);

/** Footer: a quiet "reset" on the left; cancel and the lime primary button on the right. */
export const SettingsFooter: React.FC<{
  onReset?: () => void;
  resetTitle?: string;
  onCancel?: () => void;
  cancelTitle?: string;
  primaryLabel: string;
  primaryTitle?: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryIcon?: React.ReactNode;
  resetIcon?: React.ReactNode;
}> = ({ onReset, resetTitle, onCancel, cancelTitle, primaryLabel, primaryTitle, onPrimary, primaryDisabled, primaryIcon, resetIcon }) => (
  <div className="flex-shrink-0 px-5 py-3.5 bg-white border-t border-zinc-200/70 flex items-center justify-between gap-3">
    {onReset ? (
      <button
        type="button"
        onClick={onReset}
        title={resetTitle}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer"
      >
        {resetIcon}
        <span>Mặc định</span>
      </button>
    ) : (
      <span />
    )}
    <div className="flex items-center gap-2">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          title={cancelTitle}
          className="px-4 py-2 rounded-full text-xs font-bold text-zinc-600 bg-gray-200/70 hover:bg-gray-200 transition-colors cursor-pointer"
        >
          Hủy
        </button>
      )}
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled}
        title={primaryTitle}
        className="btn-pill-lime inline-flex items-center gap-1.5 text-xs py-2.5 px-5 font-bold shadow-sm cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
      >
        {primaryIcon}
        <span>{primaryLabel}</span>
      </button>
    </div>
  </div>
);

/** Text input in the same shape as the other dialogs' fields. */
export const textInputClass =
  'w-full rounded-2xl bg-white border border-zinc-200 px-3.5 py-2.5 text-xs font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-lime-300 focus:border-[#78C841] transition-all placeholder:text-zinc-400';
