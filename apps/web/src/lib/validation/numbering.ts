import type { CompletePaper, PaperSection } from '@/types/paper';

/**
 * Numbering (STT) analysis + auto-fix for citations, tables, figures and equations.
 * Rules come from the journal template: every kind is numbered continuously in the
 * order it is first mentioned / appears; objects must be mentioned before they appear.
 */

export type ObjectKind = 'table' | 'figure' | 'equation';

const TEXT_TYPES: PaperSection['type'][] = ['paragraph', 'quote', 'box'];

/** Expand "[1]", "[1,2]", "[3–5]", "[14, 17, 20]" to the list of cited numbers. */
export function parseCitationGroup(inner: string): number[] {
  const nums: number[] = [];
  for (const part of inner.split(/[,;]/)) {
    const range = part.trim().match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (b >= a && b - a <= 200) for (let n = a; n <= b; n++) nums.push(n);
      continue;
    }
    const single = part.trim().match(/^\d+$/);
    if (single) nums.push(Number(single[0]));
  }
  return nums;
}

const CITATION_RE = /\[(\s*\d+(?:\s*[-–—]\s*\d+)?(?:\s*[,;]\s*\d+(?:\s*[-–—]\s*\d+)?)*\s*)\]/g;

export function extractCitationNumbers(text: string): number[] {
  const out: number[] = [];
  if (!text) return out;
  for (const m of text.matchAll(CITATION_RE)) out.push(...parseCitationGroup(m[1]));
  return out;
}

const MENTION_PATTERNS: Record<ObjectKind, RegExp> = {
  table: /\b(Bảng|bảng|Table|table)\s+(\d+)/g,
  figure: /\b(Hình|hình|Figure|figure|Fig\.)\s*(\d+)/g,
  equation: /\b(Phương trình|phương trình|Công thức|công thức|Equation|equation|Eq\.)\s*\((\d+)\)/g,
};

export function extractMentions(text: string, kind: ObjectKind): number[] {
  const out: number[] = [];
  if (!text) return out;
  for (const m of text.matchAll(MENTION_PATTERNS[kind])) out.push(Number(m[2]));
  return out;
}

function sectionTexts(sec: PaperSection): string[] {
  if (TEXT_TYPES.includes(sec.type)) return [sec.content || ''];
  return [];
}

export interface ObjectInfo {
  kind: ObjectKind;
  sectionIndex: number;
  /** Number currently stored on the object (undefined for unnumbered equations). */
  num?: number;
  /** Position-based number the object should have. */
  expected: number;
  /** Index of the first text section that mentions the object's current number. */
  firstMentionIndex: number | null;
}

export interface NumberingAnalysis {
  objects: ObjectInfo[];
  /** Citation numbers in order of first appearance in the body. */
  citationOrder: number[];
  /** Cited numbers that have no matching reference entry. */
  missingReferences: number[];
  /** References never cited in the text. */
  uncitedReferences: number[];
  referencesSequential: boolean;
  citationsInOrder: boolean;
}

function objectNum(sec: PaperSection): number | undefined {
  if (sec.type === 'table') return sec.table?.num;
  if (sec.type === 'figure') return sec.figure?.num;
  if (sec.type === 'equation') return sec.equation?.numbered ? sec.equation.num : undefined;
  return undefined;
}

export function analyzeNumbering(paper: CompletePaper): NumberingAnalysis {
  const sections = paper.sections || [];
  const counters: Record<ObjectKind, number> = { table: 0, figure: 0, equation: 0 };
  const objects: ObjectInfo[] = [];

  sections.forEach((sec, idx) => {
    const kind: ObjectKind | null =
      sec.type === 'table' ? 'table' : sec.type === 'figure' ? 'figure' : sec.type === 'equation' && sec.equation?.numbered ? 'equation' : null;
    if (!kind) return;
    if ((sec.type === 'table' && sec.table?.appendix) || (sec.type === 'figure' && sec.figure?.appendix)) return; // an appendix has numbers of its own
    counters[kind] += 1;
    const num = objectNum(sec);
    let firstMentionIndex: number | null = null;
    if (num !== undefined) {
      for (let i = 0; i < sections.length; i++) {
        if (sectionTexts(sections[i]).some((t) => extractMentions(t, kind).includes(num))) {
          firstMentionIndex = i;
          break;
        }
      }
    }
    objects.push({ kind, sectionIndex: idx, num, expected: counters[kind], firstMentionIndex });
  });

  const citationOrder: number[] = [];
  const seen = new Set<number>();
  sections.forEach((sec) => {
    sectionTexts(sec).forEach((t) =>
      extractCitationNumbers(t).forEach((n) => {
        if (!seen.has(n)) {
          seen.add(n);
          citationOrder.push(n);
        }
      })
    );
  });

  const refIds = new Set((paper.references || []).map((r) => r.id));
  const missingReferences = citationOrder.filter((n) => !refIds.has(n));
  const uncitedReferences = (paper.references || []).map((r) => r.id).filter((id) => !seen.has(id));
  const referencesSequential = (paper.references || []).every((r, i) => r.id === i + 1);
  const citationsInOrder = citationOrder.every((n, i) => n === i + 1);

  return { objects, citationOrder, missingReferences, uncitedReferences, referencesSequential, citationsInOrder };
}

function remapCitations(text: string, map: Map<number, number>): string {
  return text.replace(CITATION_RE, (_all, inner: string) => {
    const nums = parseCitationGroup(inner).map((n) => map.get(n) ?? n);
    const uniq = Array.from(new Set(nums)).sort((a, b) => a - b);
    return `[${uniq.join(',')}]`;
  });
}

function remapMentions(text: string, kind: ObjectKind, map: Map<number, number>): string {
  return text.replace(MENTION_PATTERNS[kind], (all, label: string, n: string) => {
    const to = map.get(Number(n));
    if (to === undefined) return all;
    return kind === 'equation' ? `${label} (${to})` : all.replace(/\d+$/, String(to));
  });
}

/**
 * Auto-fix: renumber tables/figures/equations by position, renumber references by
 * first citation, and rewrite in-text mentions/citations so the document stays consistent.
 * Unreferenced (uncited) references are kept and appended after the cited ones.
 */
export function renumberPaper(paper: CompletePaper): CompletePaper {
  const analysis = analyzeNumbering(paper);
  const sections = (paper.sections || []).map((s) => ({ ...s }));

  // 1. Citation map: old id -> new id by first appearance, uncited appended in old order.
  const refs = paper.references || [];
  const known = new Set(refs.map((r) => r.id));
  const citeMap = new Map<number, number>();
  let next = 1;
  analysis.citationOrder.forEach((old) => {
    if (known.has(old) && !citeMap.has(old)) citeMap.set(old, next++);
  });
  refs.forEach((r) => {
    if (!citeMap.has(r.id)) citeMap.set(r.id, next++);
  });

  // 2. Object maps (old displayed number -> new position number).
  const objMaps: Record<ObjectKind, Map<number, number>> = { table: new Map(), figure: new Map(), equation: new Map() };
  analysis.objects.forEach((o) => {
    if (o.num !== undefined && !objMaps[o.kind].has(o.num)) objMaps[o.kind].set(o.num, o.expected);
  });

  // 3. Apply to objects.
  analysis.objects.forEach((o) => {
    const sec = sections[o.sectionIndex];
    if (o.kind === 'table' && sec.table) sections[o.sectionIndex] = { ...sec, table: { ...sec.table, num: o.expected } };
    else if (o.kind === 'figure' && sec.figure) sections[o.sectionIndex] = { ...sec, figure: { ...sec.figure, num: o.expected } };
    else if (o.kind === 'equation' && sec.equation) sections[o.sectionIndex] = { ...sec, equation: { ...sec.equation, num: o.expected } };
  });

  // 4. Rewrite text mentions + citations.
  const fixedSections = sections.map((sec) => {
    if (!TEXT_TYPES.includes(sec.type) || !sec.content) return sec;
    let text = remapCitations(sec.content, citeMap);
    (Object.keys(objMaps) as ObjectKind[]).forEach((k) => {
      text = remapMentions(text, k, objMaps[k]);
    });
    return { ...sec, content: text };
  });

  const newRefs = refs
    .map((r) => ({ ...r, id: citeMap.get(r.id) ?? r.id }))
    .sort((a, b) => a.id - b.id);

  return { ...paper, sections: fixedSections, references: newRefs };
}

/**
 * Cheap, always-safe normaliser: give numbered equations their position-based number.
 * Returns the same array instance when nothing changes (keeps React state stable).
 */
export function assignEquationNumbers(sections: PaperSection[]): PaperSection[] {
  let counter = 0;
  let changed = false;
  const out = sections.map((sec) => {
    if (sec.type !== 'equation' || !sec.equation) return sec;
    if (!sec.equation.numbered) {
      if (sec.equation.num === undefined) return sec;
      changed = true;
      return { ...sec, equation: { ...sec.equation, num: undefined } };
    }
    counter += 1;
    if (sec.equation.num === counter) return sec;
    changed = true;
    return { ...sec, equation: { ...sec.equation, num: counter } };
  });
  return changed ? out : sections;
}
