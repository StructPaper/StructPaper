import { DEFAULT_LAYOUT_SETTINGS, type LayoutSettings } from '@/types/paper';

/**
 * A paper's page layout is its journal's rules (columns, paper, type size...) plus what the author changed on
 * the paper itself. The paper stores only what it changed; everything else follows the journal's rules of the
 * version the paper is pinned to. These helpers turn a profile into layout settings and back.
 */

/** The part of a resolved profile that decides the page layout. */
export interface LayoutProfile {
  layout?: { paperSize?: string; columns?: number; columnGap?: number };
  typography?: { fontSizes?: { body?: number }; leading?: { body?: number } };
}

const PAPER_SIZES = ['a4', 'letter', 'b5'] as const;
const FONT_SIZES = [9, 10, 11] as const;
/** 1pc, 1.5pc, 2pc in millimetres */
const COLUMN_SEPARATIONS: Array<[number, NonNullable<LayoutSettings['columnSep']>]> = [
  [4.2333, '1pc'],
  [6.35, '1.5pc'],
  [8.4667, '2pc'],
];
const LINE_SPACINGS = [1.13, 1.2, 1.3] as const;

const nearest = <T extends number>(value: number, options: readonly T[]): T =>
  options.reduce((best, o) => (Math.abs(o - value) < Math.abs(best - value) ? o : best), options[0]);

/** The layout a journal's rules ask for; anything the rules do not say falls back to the app's defaults. */
export function layoutFromProfile(profile?: LayoutProfile | null): LayoutSettings {
  const base = DEFAULT_LAYOUT_SETTINGS;
  if (!profile) return base;

  const paper = String(profile.layout?.paperSize ?? '').trim().toLowerCase();
  const paperSize = (PAPER_SIZES as readonly string[]).includes(paper) ? (paper as LayoutSettings['paperSize']) : base.paperSize;

  const columns = profile.layout?.columns;
  const gap = profile.layout?.columnGap;
  const body = profile.typography?.fontSizes?.body;
  const leading = profile.typography?.leading?.body;

  return {
    ...base,
    paperSize,
    columnLayout: columns === 1 ? '1-column' : '2-column',
    fontSize: typeof body === 'number' ? (`${nearest(body, FONT_SIZES)}pt` as LayoutSettings['fontSize']) : base.fontSize,
    columnSep: typeof gap === 'number' ? COLUMN_SEPARATIONS.reduce((b, c) => (Math.abs(c[0] - gap) < Math.abs(b[0] - gap) ? c : b))[1] : base.columnSep,
    lineSpacing: typeof leading === 'number' ? (String(nearest(leading, LINE_SPACINGS)) as LayoutSettings['lineSpacing']) : base.lineSpacing,
  };
}

/** What a paper must store: only the settings that differ from the journal's. */
export function layoutOverrides(fromJournal: LayoutSettings, chosen: LayoutSettings): Partial<LayoutSettings> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(chosen) as (keyof LayoutSettings)[]) {
    if (chosen[key] === undefined) continue;
    if (JSON.stringify(chosen[key]) !== JSON.stringify(fromJournal[key])) out[key] = chosen[key];
  }
  return out as Partial<LayoutSettings>;
}

/** The layout a paper is typeset with: the journal's, with the paper's own changes laid over it. */
export function effectiveLayout(fromJournal: LayoutSettings, overrides?: Partial<LayoutSettings> | null): LayoutSettings {
  return { ...fromJournal, ...(overrides ?? {}) } as LayoutSettings;
}
