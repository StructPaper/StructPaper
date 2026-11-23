'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Pipette, Plus } from 'lucide-react';
import { listJournalTemplates } from '@/lib/templates';
import { POPUP_EDGE, panelSide } from '@/lib/popup-bounds';

/** How every popup of the page appears and goes away: the fade of the table and figure settings, so they all feel alike. */
export const POPUP_MOTION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.16, ease: 'easeOut' },
} as const;

/** A button of the toolbar in the look of a design tool: a quiet square that lights up under the pointer and when it is on. */
export const ToolBtn: React.FC<{
  on?: boolean;
  title: string;
  disabled?: boolean;
  onClick?: () => void;
  testId?: string;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ on, title, disabled, onClick, testId, wide, children }) => (
  <button
    type="button"
    tabIndex={-1}
    title={title}
    aria-label={title}
    aria-pressed={on}
    data-testid={testId}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`h-9 ${wide ? 'px-2.5' : 'min-w-9 px-1.5'} rounded-xl text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default ${
      on ? 'bg-[#ECFCCB] text-[#14532D]' : 'text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200/70'
    }`}
  >
    {children}
  </button>
);

export const ToolSep: React.FC = () => <span className="w-px h-5 bg-zinc-200 mx-1.5 flex-shrink-0" />;

/** The floating pill that holds a row of tools. */
export const ToolPill: React.FC<{ children: React.ReactNode; testId?: string; className?: string }> = ({ children, testId, className = '' }) => (
  <div
    data-testid={testId}
    className={`flex items-center gap-0.5 flex-wrap bg-white rounded-2xl border border-zinc-100 px-1.5 py-1 shadow-[0_2px_14px_rgba(0,0,0,0.10),0_0_0_0.5px_rgba(0,0,0,0.04)] select-none ${className}`}
  >
    {children}
  </div>
);

/** A small label at the start of a row of tools ("Bảng", "Hình"). */
export const ToolTag: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="mx-1 px-2 py-0.5 rounded-full bg-zinc-100 text-[10.5px] font-extrabold uppercase tracking-wide text-zinc-500">{children}</span>
);

/** A panel that opens under a button and closes on a click outside or Escape. */
export const Popover: React.FC<{
  label: React.ReactNode;
  title: string;
  disabled?: boolean;
  width?: number;
  testId?: string;
  align?: 'left' | 'right';
  chevron?: boolean;
  /** Overrides the button (a swatch, a colour button): gets whether the panel is open and a toggle. */
  trigger?: (open: boolean, toggle: () => void) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
}> = ({ label, title, disabled, width = 340, testId, align = 'left', chevron = true, trigger, children }) => {
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState<{ left: number; top?: number; bottom?: number; maxHeight: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t) || (t as Element).closest?.('[data-overview-flyout]')) return;
      setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('mousedown', down);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);
  const toggle = () => {
    // the panel is drawn on the page itself (not inside a scrolling or clipping parent), under the button
    const r = ref.current?.getBoundingClientRect();
    if (r) {
      const left = Math.max(POPUP_EDGE, Math.min(align === 'right' ? r.right - width : r.left, window.innerWidth - width - POPUP_EDGE));
      // under the button, or over it when there is no room under; never taller than the room it has (it scrolls inside), never under the title bar
      const { side, maxHeight } = panelSide(r);
      setBox(side === 'below' ? { left, top: r.bottom + 8, maxHeight } : { left, bottom: window.innerHeight - r.top + 8, maxHeight });
    }
    setOpen((o) => !o);
  };
  return (
    <div ref={ref} className="relative">
      {trigger ? (
        trigger(open, toggle)
      ) : (
        <ToolBtn title={title} on={open} disabled={disabled} testId={testId} wide onClick={toggle}>
          {label}
          {chevron && <svg width="9" height="9" viewBox="0 0 10 10" className="opacity-50" aria-hidden><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
        </ToolBtn>
      )}
      {box && typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                key="panel"
                ref={panelRef}
                {...POPUP_MOTION}
                className="fixed z-[10000] overflow-y-auto rounded-3xl bg-[#F8F9FA] border border-white/70 shadow-[0_12px_44px_rgba(0,0,0,0.20),0_4px_16px_rgba(0,0,0,0.10)] p-4 text-left"
                style={{ left: box.left, top: box.top, bottom: box.bottom, width, maxHeight: box.maxHeight }}
                onMouseDown={(e) => {
                  // fields inside keep their own focus; a click on empty panel keeps the page's selection
                  if ((e.target as HTMLElement).closest('input,select,textarea,button')) return;
                  e.preventDefault();
                }}
              >
                {children(() => setOpen(false))}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};

// ───────────────────────────── colours ─────────────────────────────

export interface BrandColor {
  label: string;
  hex: string;
}

const BASIC_COLORS: BrandColor[] = [
  { label: 'Xanh đậm', hex: '#0047AB' },
  { label: 'Đỏ đậm', hex: '#A50021' },
  { label: 'Cam', hex: '#FF7A1A' },
  { label: 'Trắng', hex: '#FFFFFF' },
  { label: 'Xám', hex: '#555555' },
  { label: 'Than', hex: '#222222' },
  { label: 'Đen', hex: '#000000' },
];

const RECENT_KEY = 'structpaper_recent_colors';
const readRecent = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 8) : [];
  } catch {
    return [];
  }
};
const pushRecent = (hex: string) => {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([hex, ...readRecent().filter((x) => x.toLowerCase() !== hex.toLowerCase())].slice(0, 8)));
  } catch {
    // ignore
  }
};

/** The colours of the journals: the paper's own journal first (its blue and its accent), then every other journal's. */
export function journalPalette(journalId: string | undefined): { own: BrandColor[]; others: BrandColor[] } {
  const all = listJournalTemplates();
  const own = all.find((t) => t.id === journalId);
  const colors: BrandColor[] = own ? [{ label: `${own.shortName} — màu chính`, hex: own.color }, ...(own.accentColor ? [{ label: `${own.shortName} — màu nhấn`, hex: own.accentColor }] : [])] : [];
  const seen = new Set(colors.map((c) => c.hex.toLowerCase()));
  const others: BrandColor[] = [];
  for (const t of all) {
    if (t.id === journalId || seen.has(t.color.toLowerCase())) continue;
    seen.add(t.color.toLowerCase());
    others.push({ label: t.shortName, hex: t.color });
  }
  return { own: colors, others };
}

const Swatch: React.FC<{ color: BrandColor; selected: boolean; onPick: (hex: string) => void }> = ({ color, selected, onPick }) => (
  <button
    type="button"
    title={`${color.label} ${color.hex.toUpperCase()}`}
    aria-label={color.label}
    data-testid={`color-${color.hex.replace('#', '').toLowerCase()}`}
    onClick={() => onPick(color.hex.toUpperCase())}
    className={`relative w-8 h-8 rounded-full border border-zinc-200 cursor-pointer transition-transform hover:scale-110 flex items-center justify-center ${selected ? 'ring-2 ring-offset-2 ring-[#78C841]' : ''}`}
    style={{ background: color.hex }}
  >
    {selected && <Check className="w-3.5 h-3.5" style={{ color: isLight(color.hex) ? '#14532D' : '#fff' }} strokeWidth={3} />}
  </button>
);

const isLight = (hex: string) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 160;
};

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => <p className="text-[11px] font-bold text-slate-500 mt-3 mb-1.5">{children}</p>;

/** The panel to pick a colour from: the basic colours, the journal's own and other journals' colours, recent ones, any other. */
export const ColorPanel: React.FC<{
  title: string;
  value?: string | null;
  journalId?: string;
  /** Colours of the paper's own settings (the title colour, the table header colour…). */
  paper?: BrandColor[];
  clearLabel?: string;
  onPick: (hex: string | null) => void;
}> = ({ title, value, journalId, paper = [], clearLabel, onPick }) => {
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => setRecent(readRecent()), []);
  const pick = (hex: string) => {
    pushRecent(hex);
    setRecent(readRecent());
    onPick(hex);
  };
  const pal = journalPalette(journalId);
  const eyedropper = typeof window !== 'undefined' && 'EyeDropper' in window;
  const sel = (hex: string) => !!value && value.toLowerCase() === hex.toLowerCase();
  return (
    <div data-testid="color-panel">
      <h4 className="text-sm font-extrabold text-slate-900 mb-2.5">{title}</h4>
      <div className="flex flex-wrap items-center gap-2">
        <label title="Chọn màu bất kỳ" className="relative w-8 h-8 rounded-full cursor-pointer flex items-center justify-center" style={{ background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)' }}>
          <span className="w-[22px] h-[22px] rounded-full bg-white flex items-center justify-center">
            <Plus className="w-3.5 h-3.5 text-slate-800" strokeWidth={3} />
          </span>
          <input type="color" aria-label="Màu bất kỳ" value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={(e) => pick(e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        {eyedropper && (
          <button
            type="button"
            title="Lấy màu từ màn hình"
            onClick={async () => {
              try {
                const r = await new (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper().open();
                pick(r.sRGBHex.toUpperCase());
              } catch {
                // cancelled
              }
            }}
            className="w-8 h-8 rounded-full border border-zinc-200 bg-white flex items-center justify-center cursor-pointer hover:bg-zinc-50"
          >
            <Pipette className="w-4 h-4 text-slate-700" />
          </button>
        )}
        {BASIC_COLORS.map((c) => (
          <Swatch key={c.hex} color={c} selected={sel(c.hex)} onPick={pick} />
        ))}
      </div>
      {pal.own.length > 0 && (
        <>
          <SectionLabel>Màu của tạp chí này</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {pal.own.map((c) => (
              <Swatch key={c.hex + c.label} color={c} selected={sel(c.hex)} onPick={pick} />
            ))}
          </div>
        </>
      )}
      {paper.length > 0 && (
        <>
          <SectionLabel>Màu trong bài này</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {paper.map((c) => (
              <Swatch key={c.hex + c.label} color={c} selected={sel(c.hex)} onPick={pick} />
            ))}
          </div>
        </>
      )}
      {pal.others.length > 0 && (
        <>
          <SectionLabel>Bộ màu các tạp chí</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {pal.others.map((c) => (
              <Swatch key={c.hex + c.label} color={c} selected={sel(c.hex)} onPick={pick} />
            ))}
          </div>
        </>
      )}
      {recent.length > 0 && (
        <>
          <SectionLabel>Đã dùng gần đây</SectionLabel>
          <div className="flex flex-wrap gap-2">
            {recent.map((hex) => (
              <Swatch key={hex} color={{ label: 'Màu gần đây', hex }} selected={sel(hex)} onPick={pick} />
            ))}
          </div>
        </>
      )}
      {clearLabel && (
        <button type="button" onClick={() => onPick(null)} className="mt-3.5 w-full px-3 py-2 rounded-full text-xs font-bold text-zinc-600 bg-gray-200/70 hover:bg-gray-200 cursor-pointer">
          {clearLabel}
        </button>
      )}
    </div>
  );
};
