import type { PaperSection, SectionPageLayout } from '@/types/paper';
import { derivePageGroups, type GroupColumns, type GroupOrientation, type PageDefaults } from './page-groups';

interface Layout {
  o: GroupOrientation;
  c: GroupColumns;
}

/**
 * Drops the markers that turning a page wrote (`turned`) once they no longer change anything: a marker whose
 * layout equals the layout in force before it. Markers the editor placed by hand are never touched, so turning a
 * page and turning it back leaves the sections exactly as they were.
 */
export function normalizeTurnedMarkers(sections: PaperSection[], defaults: PageDefaults): PaperSection[] {
  let eff: Layout = { o: defaults.landscape ? 'landscape' : 'portrait', c: defaults.oneColumn ? '1-column' : '2-column' };
  const def = { ...eff };
  let changed = false;
  const out = sections.map((s) => {
    const m = s.pageLayout;
    if (!m || s.type === 'citation') return s;
    const r: Layout = { o: m.orientation ?? def.o, c: m.columns ?? def.c };
    if (m.turned && r.o === eff.o && r.c === eff.c) {
      changed = true;
      const { pageLayout: _drop, ...rest } = s;
      return rest as PaperSection;
    }
    eff = r;
    return s;
  });
  return changed ? out : sections;
}

/**
 * Pairs the turned markers: an opening marker (index -> index of the marker that closes it, or -1 when the range runs
 * to the end). A turned marker that brings back the layout that was in force before the open range closes it.
 */
function turnedPairs(sections: PaperSection[], defaults: PageDefaults): Map<number, { close: number }> {
  const def: Layout = { o: defaults.landscape ? 'landscape' : 'portrait', c: defaults.oneColumn ? '1-column' : '2-column' };
  let eff = def;
  const open: { at: number; before: Layout }[] = [];
  const out = new Map<number, { close: number }>();
  sections.forEach((s, i) => {
    const m = s.pageLayout;
    if (!m || s.type === 'citation') return;
    const r: Layout = { o: m.orientation ?? def.o, c: m.columns ?? def.c };
    if (m.turned) {
      const top = open[open.length - 1];
      if (top && top.before.o === r.o && top.before.c === r.c) {
        out.set(top.at, { close: i });
        open.pop();
      } else {
        open.push({ at: i, before: eff });
        out.set(i, { close: -1 });
      }
    }
    eff = r;
  });
  return out;
}

/**
 * Turns the page that starts at `anchorId`. That section opens a new page with the chosen orientation (keeping the
 * columns its group had); the section that opens the following page (`nextId`) gets a marker that brings the old
 * layout back, so exactly one page changes. A marker the next page already has is left alone. Markers written here
 * are tagged `turned` so that turning the page back removes them again.
 */
export function rotatePageAt(
  sections: PaperSection[],
  anchorId: string,
  nextId: string | null,
  orientation: GroupOrientation,
  defaults: PageDefaults
): PaperSection[] {
  const ai = sections.findIndex((s) => s.id === anchorId);
  if (ai < 0) return sections;
  const groups = derivePageGroups(sections, defaults);
  const g = groups.find((x) => x.startIdx <= ai && ai <= x.endIdx);
  if (!g || g.orientation === orientation) return sections;

  // Turning back the page that opens a turned range gives back the whole range, however far the turned text
  // spilled: the marker that closes it is found among the markers, not re-derived from where the pages now break.
  const pair = turnedPairs(sections, defaults).get(ai);
  const before: Layout = groups[g.index - 1]
    ? { o: groups[g.index - 1].orientation, c: groups[g.index - 1].columns }
    : { o: defaults.landscape ? 'landscape' : 'portrait', c: defaults.oneColumn ? '1-column' : '2-column' };
  if (pair && g.startIdx === ai && before.o === orientation) {
    const dropped = sections.map((s, i) => {
      if (i !== ai && i !== pair.close) return s;
      const { pageLayout: _drop, ...rest } = s;
      return rest as PaperSection;
    });
    return normalizeTurnedMarkers(dropped, defaults);
  }

  const columns: SectionPageLayout = g.inherits.columns ? {} : { columns: g.columns };
  const own = sections[ai].pageLayout;
  const ni = nextId && nextId !== anchorId ? sections.findIndex((s) => s.id === nextId) : -1;
  const turned = sections.map((s, i) => {
    if (i === ai) return { ...s, pageLayout: { ...(own || columns), orientation, ...(own && !own.turned ? {} : { turned: true }) } };
    if (i === ni && ni > ai && !s.pageLayout && g.endIdx >= ni) {
      return { ...s, pageLayout: { ...(g.inherits.orientation ? {} : { orientation: g.orientation }), ...columns, turned: true } };
    }
    return s;
  });
  return normalizeTurnedMarkers(turned, defaults);
}
