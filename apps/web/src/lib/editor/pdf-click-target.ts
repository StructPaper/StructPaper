import type { PaperSection } from '@/types/paper';
import { matchLinesToSection, type PdfLine, type PdfTextItem, type SectionKey } from './pdf-section-map';

/** Numbered equations by their number: the PDF prints "(3)" next to the formula, which has no matchable words. */
export function equationIndex(sections: PaperSection[]): { id: string; num: number }[] {
  return sections
    .filter((s) => s.type === 'equation' && s.equation?.numbered && s.equation.num)
    .map((s) => ({ id: s.id, num: s.equation!.num as number }));
}

const EQ_LABEL = /^\(?(\d{1,3})\)$/;
const CAPTION = /^\s*(hình|bảng|figure|table)\s*\d+/i;

/** Section a click resolves to: an equation label near a formula-like line first, else the text of the line. */
export function resolveClick(index: SectionKey[], equations: { id: string; num: number }[], lines: string[], center: number): string | null {
  const own = (lines[center] || '').replace(/[^\p{L}\p{N}]+/gu, '');
  if (own.length < 20 && equations.length) {
    for (const off of [0, 1, -1, 2, -2]) {
      const m = (lines[center + off] || '').trim().match(EQ_LABEL);
      const eq = m && equations.find((e) => e.num === Number(m[1]));
      if (eq) return eq.id;
    }
  }
  return matchLinesToSection(index, lines, center);
}

/** Closest line to a point and how far (PDF units) the point is from its text. */
export function nearestLine(items: PdfTextItem[], lines: PdfLine[], px: number, py: number): { index: number; dist: number } {
  let index = -1;
  let dist = Infinity;
  lines.forEach((ln, li) => {
    for (let i = ln.from; i <= ln.to; i++) {
      const it = items[i];
      if (!it.str) continue;
      const dx = px < it.x ? it.x - px : px > it.x + it.width ? px - (it.x + it.width) : 0;
      const dy = py < it.y - it.height * 0.25 ? it.y - it.height * 0.25 - py : py > it.y + it.height ? py - (it.y + it.height) : 0;
      const d = Math.hypot(dx, dy * 1.5);
      if (d < dist) {
        dist = d;
        index = li;
      }
    }
  });
  return { index, dist };
}

/**
 * The line a click stands for. On text it is the line under the pointer. On a picture or table body (no text near
 * the pointer) the caption of the figure or table is used when one is close: below a figure, above a table.
 */
export function lineForClick(items: PdfTextItem[], lines: PdfLine[], px: number, py: number, reach = 350): number {
  const near = nearestLine(items, lines, px, py);
  if (near.index < 0 || near.dist <= 14) return near.index;
  let best = -1;
  let gap = Infinity;
  lines.forEach((ln, li) => {
    if (!CAPTION.test(ln.text)) return;
    const g = Math.abs(ln.y - py);
    if (g <= reach && g < gap) {
      gap = g;
      best = li;
    }
  });
  return best >= 0 ? best : near.index;
}

/**
 * How much of the page's height the body text uses (0..1), ignoring the running header at the edge and the page
 * number. A page that a change of paper orientation cut short has a low value.
 */
export function pageFill(items: PdfTextItem[], w: number, h: number): number {
  const body = items.filter((it) => it.str.trim() && it.x > 0.05 * w && it.x < 0.93 * w && it.y > 0.09 * h);
  if (!body.length) return 0;
  const lowest = Math.min(...body.map((it) => it.y));
  return Math.max(0, Math.min(1, (0.94 * h - lowest) / (0.85 * h)));
}

/**
 * Pulls one more section into the turned range: the marker that starts the next page moves to the section after
 * it, so the page that was cut short is filled with more content before the layout changes back.
 */
export function extendRotatedRange(sections: PaperSection[], nextId: string): PaperSection[] {
  const ni = sections.findIndex((s) => s.id === nextId);
  if (ni < 0 || !sections[ni].pageLayout) return sections;
  const fi = sections.findIndex((s, i) => i > ni && s.type !== 'citation');
  if (fi < 0) return sections;
  const marker = sections[ni].pageLayout;
  return sections.map((s, i) => {
    if (i === ni) {
      const { pageLayout: _drop, ...rest } = s;
      return rest as PaperSection;
    }
    if (i === fi && !s.pageLayout) return { ...s, pageLayout: marker };
    return s;
  });
}
