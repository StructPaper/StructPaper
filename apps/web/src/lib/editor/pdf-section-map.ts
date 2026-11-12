import type { PaperMetadata, PaperReference, PaperSection } from '@/types/paper';

/**
 * Maps text read from the compiled PDF back to the section of the editor that produced it, so a click in the
 * preview can open the right card. Matching is on letters and digits only (spaces, hyphenation, punctuation and
 * formulas are ignored), because the PDF breaks lines and hyphenates differently from the source text.
 */
export function normalizeForMatch(s: string): string {
  return (s || '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

export interface SectionKey {
  id: string;
  key: string;
  index: number;
}

function sectionText(s: PaperSection): string {
  switch (s.type) {
    case 'h1':
    case 'h2':
    case 'h3':
      return s.title || s.content || '';
    case 'figure':
      return `${s.figure?.caption || ''} ${s.figure?.source || ''}`;
    case 'table': {
      const t = s.table;
      if (!t) return '';
      const cells = (rows?: { text?: string }[][]) => (rows || []).flat().map((c) => c?.text || '');
      const head = t.headerRows?.length ? cells(t.headerRows as any) : t.headers || [];
      const body = t.bodyRows?.length ? cells(t.bodyRows as any) : (t.rows || []).flat();
      return [t.caption, ...head, ...body, t.source || ''].join(' ');
    }
    case 'equation':
      return '';
    case 'citation':
      return '';
    default:
      return s.content || '';
  }
}

export function buildSectionIndex(sections: PaperSection[]): SectionKey[] {
  const out: SectionKey[] = [];
  sections.forEach((s, index) => {
    const key = normalizeForMatch(sectionText(s));
    if (key.length >= 3) out.push({ id: s.id, key, index });
  });
  return out;
}

/** Longest-first windows of the query that are searched in the sections (whole line, then its parts). */
function windows(q: string): string[] {
  const out = [q];
  for (const n of [40, 24, 14]) {
    if (q.length > n) {
      out.push(q.slice(0, n), q.slice(q.length - n), q.slice(Math.floor((q.length - n) / 2), Math.floor((q.length - n) / 2) + n));
    }
  }
  return out;
}

/**
 * Section that contains the text of `lines[center]`. A short line (a table cell, a heading number) is widened
 * with the lines around it. Returns the id, or null when nothing matches (running headers, page numbers...).
 */
export function matchLinesToSection(index: SectionKey[], lines: string[], center: number): string | null {
  if (!lines.length) return null;
  /** Sections holding `w`; when several do (a sentence repeated in the summary and the body), the text that follows decides. */
  const find = (w: string, following: string): string | null => {
    if (w.length < 6) return null;
    let cands = index.filter((s) => s.key.includes(w));
    if (!cands.length) return null;
    const from = following.indexOf(w);
    const q = from >= 0 ? following.slice(from) : w;
    for (let len = Math.max(w.length + 8, 16); cands.length > 1 && len <= q.length + 8; len += 8) {
      const next = cands.filter((s) => s.key.includes(q.slice(0, len)));
      if (!next.length) break;
      cands = next;
    }
    return cands[0].id;
  };
  const search = (q: string, following: string): string | null => {
    for (const w of windows(q)) {
      const hit = find(w, following);
      if (hit) return hit;
    }
    return null;
  };
  const own = normalizeForMatch(lines[center] ?? '');
  const ahead = normalizeForMatch(lines.slice(center, center + 5).join(' '));
  const direct = search(own, ahead);
  if (direct) return direct;
  // a short line (a table cell, a number) is widened with the lines around it; a long one that matched nothing is
  // a header, a formula or a page number, and widening it would only match unrelated text
  if (own.length >= 14) return null;
  for (let span = 1; span <= 3; span++) {
    const from = Math.max(0, center - span);
    const to = Math.min(lines.length - 1, center + span);
    const q = normalizeForMatch(lines.slice(from, to + 1).join(' '));
    const hit = search(q, q);
    if (hit) return hit;
  }
  return null;
}

export type FrontTab = 'metadata' | 'authors' | 'abstract' | 'refs';

/** Text that is not a body section but has its own tab: title, abstract, authors, references. */
export function buildFrontIndex(md: PaperMetadata, refs: PaperReference[] = []): { tab: FrontTab; key: string }[] {
  const add = (tab: FrontTab, texts: (string | undefined)[]) =>
    texts.map((t) => ({ tab, key: normalizeForMatch(t || '') })).filter((e) => e.key.length >= 6);
  return [
    ...add('abstract', [md.abstract, md.abstractEn, (md.keywords || []).join(' '), (md.keywordsEn || []).join(' ')]),
    ...add('metadata', [md.title, md.titleEn]),
    ...add('authors', [
      ...(md.authors || []).map((a) => a.name),
      ...(md.affiliations || []).flatMap((a) => [a.name, a.nameEn]),
    ]),
    ...refs.flatMap((r) => add('refs', [r.raw])),
  ];
}

/** The tab (not a body section) a line of the PDF belongs to, or null. */
export function matchLineToFrontTab(index: { tab: FrontTab; key: string }[], line: string): FrontTab | null {
  const q = normalizeForMatch(line);
  if (q.length < 8) return null;
  for (const w of windows(q)) {
    if (w.length < 8) continue;
    const hit = index.find((e) => e.key.includes(w));
    if (hit) return hit.tab;
  }
  return null;
}

/** First section whose text appears on a page, reading the page's lines from the top. */
export function firstSectionOnPage(index: SectionKey[], lines: string[], maxLines = 40): string | null {
  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    const hit = matchLinesToSection(index, lines, i);
    if (hit) return hit;
  }
  return null;
}

/**
 * First section that starts on a page: the first one on it that was not already on the page before (a section that
 * runs over from the previous page is a continuation, not the start of this page).
 */
export function firstNewSectionOnPage(index: SectionKey[], lines: string[], prevLines: string[] | null, maxLines = 60): string | null {
  const before = new Set<string>();
  (prevLines || []).forEach((_, i) => {
    const id = matchLinesToSection(index, prevLines!, i);
    if (id) before.add(id);
  });
  let first: string | null = null;
  for (let i = 0; i < Math.min(lines.length, maxLines); i++) {
    const id = matchLinesToSection(index, lines, i);
    if (!id) continue;
    first = first ?? id;
    if (!before.has(id)) return id;
  }
  return first;
}

export interface PdfTextItem {
  str: string;
  /** Baseline position in PDF units. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfLine {
  text: string;
  y: number;
  /** Index range of the items that make up the line. */
  from: number;
  to: number;
}

/** Joins consecutive items on one baseline into lines, in content-stream order (which LaTeX emits column by column). */
export function groupItemsIntoLines(items: PdfTextItem[]): PdfLine[] {
  const lines: PdfLine[] = [];
  items.forEach((it, i) => {
    if (!it.str) return;
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) < Math.max(2, it.height * 0.3)) {
      last.text += it.str;
      last.to = i;
    } else {
      lines.push({ text: it.str, y: it.y, from: i, to: i });
    }
  });
  return lines;
}

/** Index of the line closest to a point (PDF units), preferring a line whose box holds the point. */
export function lineAtPoint(items: PdfTextItem[], lines: PdfLine[], px: number, py: number): number {
  let best = -1;
  let bestD = Infinity;
  lines.forEach((ln, li) => {
    for (let i = ln.from; i <= ln.to; i++) {
      const it = items[i];
      if (!it.str) continue;
      const dx = px < it.x ? it.x - px : px > it.x + it.width ? px - (it.x + it.width) : 0;
      const dy = py < it.y - it.height * 0.25 ? it.y - it.height * 0.25 - py : py > it.y + it.height ? py - (it.y + it.height) : 0;
      const d = Math.hypot(dx, dy * 1.5);
      if (d < bestD) {
        bestD = d;
        best = li;
      }
    }
  });
  return best;
}
