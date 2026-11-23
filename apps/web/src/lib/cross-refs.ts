import type { CompletePaper, PaperSection } from '@/types/paper';

/**
 * Cross-references to a table or a figure. In the text one is written `[[tbl:ID]]` or `[[fig:ID]]` (ID is the id of the table or the
 * figure, which does not change when blocks are moved), and every output prints it as "Bảng 3" / "Table 3" with the number the block
 * has at that point in the paper. The editors show it as a small label (see the xref chips), never as the marker.
 */
export const CROSS_REF = /\[\[(tbl|fig|app):([^\]\s]+)\]\]/g;

export type RefKind = 'table' | 'figure' | 'appendix';

export interface RefTarget {
  kind: RefKind;
  id: string;
  /** Its number: the order it stands in among the tables (or the figures) of the paper. */
  order: number;
  caption: string;
  /** The label as the paper prints it when it is not "kind + order" (an appendix numbered with letters: "Phụ lục B"). */
  label?: Record<'vi' | 'en', string>;
}

export const kindOfMarker = (m: 'tbl' | 'fig' | 'app'): RefKind => (m === 'tbl' ? 'table' : m === 'app' ? 'appendix' : 'figure');
export const markerOf = (kind: RefKind, id: string): string => `[[${kind === 'table' ? 'tbl' : kind === 'appendix' ? 'app' : 'fig'}:${id}]]`;

export function refLabel(kind: RefKind, order: number, lang: 'vi' | 'en' = 'vi'): string {
  const word = kind === 'table' ? (lang === 'en' ? 'Table' : 'Bảng') : kind === 'appendix' ? (lang === 'en' ? 'Appendix' : 'Phụ lục') : lang === 'en' ? 'Figure' : 'Hình';
  return `${word} ${order}`;
}

/** The label of a target as it is printed (an appendix may be lettered). */
export const labelOfTarget = (t: Pick<RefTarget, 'kind' | 'order' | 'label'>, lang: 'vi' | 'en'): string => t.label?.[lang] ?? refLabel(t.kind, t.order, lang);

/** The tables, figures and appendices a text can point at, in the order of the paper (the appendices last, numbered on their own). */
export function crossRefTargets(paper: Pick<CompletePaper, 'sections'> & Partial<Pick<CompletePaper, 'metadata'>>): RefTarget[] {
  const out: RefTarget[] = [];
  const numbering = paper.metadata?.appendix?.numbering ?? 'number';
  let tables = 0;
  let figures = 0;
  let appendices = 0;
  for (const s of paper.sections) {
    const app = (s.type === 'table' && s.table?.appendix) || (s.type === 'figure' && s.figure?.appendix);
    if (app) {
      appendices += 1;
      const mark = numbering === 'letter' ? String.fromCharCode(64 + ((appendices - 1) % 26) + 1) : String(appendices);
      out.push({
        kind: 'appendix',
        id: (s.table ?? s.figure)!.id,
        order: appendices,
        caption: (s.table ?? s.figure)!.caption,
        label: { vi: `Phụ lục ${mark}`, en: `Appendix ${mark}` },
      });
    } else if (s.type === 'table' && s.table) out.push({ kind: 'table', id: s.table.id, order: ++tables, caption: s.table.caption });
    else if (s.type === 'figure' && s.figure) out.push({ kind: 'figure', id: s.figure.id, order: ++figures, caption: s.figure.caption });
  }
  return out;
}

/** The text with its markers written as labels ("Bảng 3"); a marker whose block is gone stays as the label without a number. */
export function resolveRefsInText(text: string | undefined, targets: RefTarget[], lang: 'vi' | 'en'): string | undefined {
  if (!text || !text.includes('[[')) return text;
  return text.replace(CROSS_REF, (_m, k: 'tbl' | 'fig' | 'app', id: string) => {
    const kind = kindOfMarker(k);
    const t = targets.find((x) => x.kind === kind && x.id === id);
    return t ? labelOfTarget(t, lang) : refLabel(kind, 0, lang).replace(/ 0$/, ' ?');
  });
}

/** The paper with every cross-reference of its text printed as a label: what the exporters are given. */
export function resolveCrossRefs(paper: CompletePaper, lang: 'vi' | 'en' = 'vi'): CompletePaper {
  const mentions = (s: PaperSection) => { const t = JSON.stringify([s.content, s.title, s.table?.caption, s.table?.source, s.figure?.caption, s.figure?.source]); return t.includes("[[tbl:") || t.includes("[[fig:") || t.includes("[[app:"); };
  const has = paper.sections.some(mentions);
  if (!has) return paper;
  const targets = crossRefTargets(paper);
  const r = (t: string | undefined) => resolveRefsInText(t, targets, lang);
  return {
    ...paper,
    sections: paper.sections.map((s) => ({
      ...s,
      content: r(s.content) ?? s.content,
      title: r(s.title),
      ...(s.table ? { table: { ...s.table, caption: r(s.table.caption) ?? '', source: r(s.table.source) } } : {}),
      ...(s.figure ? { figure: { ...s.figure, caption: r(s.figure.caption) ?? '', source: r(s.figure.source) } } : {}),
    })),
  };
}
