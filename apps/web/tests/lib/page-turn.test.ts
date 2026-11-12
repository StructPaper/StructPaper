import { describe, it, expect } from 'vitest';
import type { PaperSection } from '@/types/paper';
import { createEmptyPaper, normalizeCompletePaper } from '@/types/paper';
import { derivePageGroups } from '@/lib/editor/page-groups';
import { normalizeTurnedMarkers, rotatePageAt } from '@/lib/editor/page-turn';
import { extendRotatedRange } from '@/lib/editor/pdf-click-target';
import { exportToLatex } from '@/lib/latex-template';

const para = (id: string, extra: Partial<PaperSection> = {}): PaperSection => ({ id, type: 'paragraph', content: `Nội dung ${id}.`, ...extra });
const ids = (n: number) => Array.from({ length: n }, (_, i) => String.fromCharCode(97 + i));
const body = (n = 6, marks: Record<string, PaperSection['pageLayout']> = {}) =>
  ids(n).map((id) => para(id, marks[id] ? { pageLayout: marks[id] } : {}));
const portrait2 = { oneColumn: false, landscape: false };
const get = (list: PaperSection[], id: string) => list.find((s) => s.id === id)!;
const tex = (sections: PaperSection[]) => {
  const p = createEmptyPaper('VNUHCM-HS');
  p.metadata.title = 'Thử';
  p.sections = sections;
  return exportToLatex(normalizeCompletePaper(p));
};
const shape = (list: PaperSection[]) => derivePageGroups(list, portrait2).map((g) => [g.startId, g.orientation]);

describe('turning a page', () => {
  it('turns the page that starts at the anchor and brings the layout back on the next page', () => {
    const out = rotatePageAt(body(), 'b', 'c', 'landscape', portrait2);
    expect(get(out, 'b').pageLayout).toEqual({ orientation: 'landscape', turned: true });
    expect(get(out, 'c').pageLayout).toEqual({ turned: true });
    expect(shape(out)).toEqual([['a', 'portrait'], ['b', 'landscape'], ['c', 'portrait']]);
  });

  it('keeps the columns of the group it is in (a page inside a one-column landscape group)', () => {
    const src = body(6, { a: { orientation: 'landscape', columns: '1-column' } });
    const out = rotatePageAt(src, 'c', 'd', 'portrait', portrait2);
    expect(get(out, 'c').pageLayout).toEqual({ columns: '1-column', orientation: 'portrait', turned: true });
    expect(get(out, 'd').pageLayout).toEqual({ orientation: 'landscape', columns: '1-column', turned: true });
    expect(derivePageGroups(out, portrait2).map((g) => [g.orientation, g.columns])).toEqual([
      ['landscape', '1-column'],
      ['portrait', '1-column'],
      ['landscape', '1-column'],
    ]);
  });

  it('is a no-op when the page already has that orientation, or the anchor is unknown', () => {
    const src = body();
    expect(rotatePageAt(src, 'b', 'c', 'portrait', portrait2)).toBe(src);
    expect(rotatePageAt(src, 'zz', null, 'landscape', portrait2)).toBe(src);
  });

  it('works on the last page, with no next section', () => {
    const out = rotatePageAt(body(), 'f', null, 'landscape', portrait2);
    expect(get(out, 'f').pageLayout).toEqual({ orientation: 'landscape', turned: true });
  });
});

describe('turning and turning back leaves the document as it was', () => {
  const roundTrip = (src: PaperSection[], anchor: string, next: string | null, to: 'landscape' | 'portrait', defaults = portrait2) => {
    const back = to === 'landscape' ? 'portrait' : 'landscape';
    const turned = rotatePageAt(src, anchor, next, to, defaults);
    expect(turned).not.toEqual(src);
    return rotatePageAt(turned, anchor, next, back, defaults);
  };

  it('in the middle of the document', () => {
    const src = body();
    const out = roundTrip(src, 'b', 'c', 'landscape');
    expect(out).toEqual(src);
    expect(tex(out)).toBe(tex(src));
  });

  it('at the start of the body, and on the last page', () => {
    for (const [anchor, next] of [['a', 'b'], ['f', null]] as const) {
      const src = body();
      const out = roundTrip(src, anchor, next, 'landscape');
      expect(out).toEqual(src);
      expect(tex(out)).toBe(tex(src));
    }
  });

  it('inside a group that is not the document default', () => {
    const src = body(6, { a: { orientation: 'landscape', columns: '1-column' } });
    const out = roundTrip(src, 'c', 'd', 'portrait');
    expect(out).toEqual(src);
    expect(tex(out)).toBe(tex(src));
  });

  it('when the next page already starts with a marker the editor placed', () => {
    const src = body(6, { c: { orientation: 'landscape', columns: '1-column' } });
    expect(roundTrip(src, 'b', 'c', 'landscape')).toEqual(src);
  });

  it('in a landscape document (the default is landscape)', () => {
    const defaults = { oneColumn: false, landscape: true };
    const src = body();
    expect(roundTrip(src, 'b', 'c', 'portrait', defaults)).toEqual(src);
  });

  it('turning back the first page of a turned range gives back the whole range, however long it became', () => {
    const first = rotatePageAt(body(), 'b', 'd', 'landscape', portrait2);
    // the turned text spilled onto a second landscape page: the next page now starts inside the range
    const back = rotatePageAt(first, 'b', 'c', 'portrait', portrait2);
    expect(back).toEqual(body());
  });

  it('a page inside a turned range can still be turned on its own', () => {
    const first = rotatePageAt(body(), 'b', 'e', 'landscape', portrait2);
    const middle = rotatePageAt(first, 'c', 'd', 'portrait', portrait2);
    expect(shape(middle)).toEqual([['a', 'portrait'], ['b', 'landscape'], ['c', 'portrait'], ['d', 'landscape'], ['e', 'portrait']]);
  });

  it('two neighbouring pages turned one after the other, then both turned back', () => {
    const src = body(7);
    const one = rotatePageAt(src, 'b', 'c', 'landscape', portrait2);
    const two = rotatePageAt(one, 'c', 'd', 'landscape', portrait2);
    expect(shape(two)).toEqual([['a', 'portrait'], ['b', 'landscape'], ['d', 'portrait']]);
    const undoC = rotatePageAt(two, 'c', 'd', 'portrait', portrait2);
    const undoB = rotatePageAt(undoC, 'b', 'c', 'portrait', portrait2);
    expect(undoB).toEqual(src);
  });
});

describe('markers written by the editor are never removed', () => {
  it('keeps an empty "new page" marker and an equal-looking untagged marker', () => {
    const src = body(4, { b: {}, c: { orientation: 'portrait' } });
    expect(normalizeTurnedMarkers(src, portrait2)).toBe(src);
  });

  it('removes only the tagged marker that changes nothing', () => {
    const src = body(4, { b: { turned: true }, c: { orientation: 'landscape', turned: true }, d: { orientation: 'landscape', turned: true } });
    const out = normalizeTurnedMarkers(src, portrait2);
    expect(get(out, 'b').pageLayout).toBeUndefined();
    expect(get(out, 'c').pageLayout).toEqual({ orientation: 'landscape', turned: true });
    expect(get(out, 'd').pageLayout).toBeUndefined();
  });
});

describe('filling a cut short page keeps the tag', () => {
  it('moves a turned marker on', () => {
    const turned = rotatePageAt(body(), 'b', 'c', 'landscape', portrait2);
    const filled = extendRotatedRange(turned, 'c');
    expect(get(filled, 'd').pageLayout).toEqual({ turned: true });
    expect(shape(filled)).toEqual([['a', 'portrait'], ['b', 'landscape'], ['d', 'portrait']]);
  });
});
