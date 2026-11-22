import type { PaperFigure, PaperSection, PaperTable } from '@/types/paper';
import { FIGURE_LOOK_KEYS, TABLE_LOOK_KEYS, pickKeys } from './overview-actions';
import { tableRowsOf } from './overview-doc';

type Sections = PaperSection[];

/** The object without these fields. */
function stripKeys<T extends object>(obj: T, keys: readonly (keyof T)[]): T {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

/** Changes one section; the same array comes back when nothing changed (so nothing is saved for nothing). */
function mapSection(sections: Sections, sid: string, f: (s: PaperSection) => PaperSection): Sections {
  let changed = false;
  const out = sections.map((s) => {
    if (s.id !== sid) return s;
    const n = f(s);
    if (n !== s) changed = true;
    return n;
  });
  return changed ? out : sections;
}

export const updateSectionIn = (sections: Sections, sid: string, patch: Partial<PaperSection>): Sections => mapSection(sections, sid, (s) => ({ ...s, ...patch }));

export const replaceTableIn = (sections: Sections, sid: string, table: PaperTable): Sections => mapSection(sections, sid, (s) => (s.table ? { ...s, table } : s));

export const updateTableIn = (sections: Sections, sid: string, patch: Partial<PaperTable>): Sections => mapSection(sections, sid, (s) => (s.table ? { ...s, table: { ...s.table, ...patch } } : s));

export const updateFigureIn = (sections: Sections, sid: string, patch: Partial<PaperFigure>): Sections => mapSection(sections, sid, (s) => (s.figure ? { ...s, figure: { ...s.figure, ...patch } } : s));

/** The table's look (lines, colours, type size, fill) on every other table. */
export function applyTableLookIn(sections: Sections, fromSid: string): Sections {
  const from = sections.find((s) => s.id === fromSid)?.table;
  if (!from) return sections;
  const look = pickKeys(from, TABLE_LOOK_KEYS);
  return sections.map((s) => (s.table && s.id !== fromSid ? { ...s, table: { ...stripKeys(s.table, TABLE_LOOK_KEYS), ...look } } : s));
}

/** The figure's layout on every other figure. */
export function applyFigureLookIn(sections: Sections, fromSid: string): Sections {
  const from = sections.find((s) => s.id === fromSid)?.figure;
  if (!from) return sections;
  const look = pickKeys(from, FIGURE_LOOK_KEYS);
  return sections.map((s) => (s.figure && s.id !== fromSid ? { ...s, figure: { ...stripKeys(s.figure, FIGURE_LOOK_KEYS), ...look } } : s));
}

/** A row's least height (a header row's height is the one of all header rows). Null clears it. */
export function setRowHeightIn(sections: Sections, sid: string, kind: 'head' | 'body', index: number, pt: number | null): Sections {
  return mapSection(sections, sid, (s) => {
    if (!s.table) return s;
    const value = pt && pt > 0 ? pt : undefined;
    if (kind === 'head') return (s.table.headerHeight ?? undefined) === value ? s : { ...s, table: { ...s.table, headerHeight: value } };
    const rows = tableRowsOf(s.table).body.length;
    const heights = Array.from({ length: rows }, (_, i) => s.table!.rowHeights?.[i] ?? null);
    if (heights[index] === (value ?? null)) return s;
    heights[index] = value ?? null;
    return { ...s, table: { ...s.table, rowHeights: heights.some((h) => h) ? heights : undefined } };
  });
}

export const setColWeightsIn = (sections: Sections, sid: string, weights: number[] | undefined): Sections => mapSection(sections, sid, (s) => (s.table ? { ...s, table: { ...s.table, colWeights: weights } } : s));
