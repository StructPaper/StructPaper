import type { CompletePaper } from '@/types/paper';

/**
 * Cross-references to a table or a figure. In the text one is written `[[tbl:ID]]` or `[[fig:ID]]` (ID is the id of the table or the
 * figure, which does not change when blocks are moved), and every output prints it as "Bảng 3" / "Table 3" with the number the block
 * has at that point in the paper. The editors show it as a small label (see the xref chips), never as the marker.
 */
export const CROSS_REF = /\[\[(tbl|fig):([^\]\s]+)\]\]/g;

export type RefKind = 'table' | 'figure';

export interface RefTarget {
  kind: RefKind;
  id: string;
  /** Its number: the order it stands in among the tables (or the figures) of the paper. */
  order: number;
  caption: string;
}

export const kindOfMarker = (m: 'tbl' | 'fig'): RefKind => (m === 'tbl' ? 'table' : 'figure');
export const markerOf = (kind: RefKind, id: string): string => `[[${kind === 'table' ? 'tbl' : 'fig'}:${id}]]`;

export function refLabel(kind: RefKind, order: number, lang: 'vi' | 'en' = 'vi'): string {
  return `${kind === 'table' ? (lang === 'en' ? 'Table' : 'Bảng') : lang === 'en' ? 'Figure' : 'Hình'} ${order}`;
}

/** The tables and figures a text can point at, in the order of the paper. */
export function crossRefTargets(paper: Pick<CompletePaper, 'sections'>): RefTarget[] {
  const out: RefTarget[] = [];
  let tables = 0;
  let figures = 0;
  for (const s of paper.sections) {
    if (s.type === 'table' && s.table?.appendix) continue;
    if (s.type === 'figure' && s.figure?.appendix) continue;
    if (s.type === 'table' && s.table) out.push({ kind: 'table', id: s.table.id, order: ++tables, caption: s.table.caption });
    else if (s.type === 'figure' && s.figure) out.push({ kind: 'figure', id: s.figure.id, order: ++figures, caption: s.figure.caption });
  }
  return out;
}

/** The text with its markers written as labels ("Bảng 3"); a marker whose block is gone stays as the label without a number. */
export function resolveRefsInText(text: string | undefined, targets: RefTarget[], lang: 'vi' | 'en'): string | undefined {
  if (!text || !text.includes('[[')) return text;
  return text.replace(CROSS_REF, (_m, k: 'tbl' | 'fig', id: string) => {
    const kind = kindOfMarker(k);
    const t = targets.find((x) => x.kind === kind && x.id === id);
    return t ? refLabel(kind, t.order, lang) : refLabel(kind, 0, lang).replace(/ 0$/, ' ?');
  });
}

/** The paper with every cross-reference of its text printed as a label: what the exporters are given. */
export function resolveCrossRefs(paper: CompletePaper, lang: 'vi' | 'en' = 'vi'): CompletePaper {
  const has = paper.sections.some((s) => JSON.stringify([s.content, s.title, s.table?.caption, s.table?.source, s.figure?.caption, s.figure?.source]).includes('[[tbl:') || JSON.stringify([s.content, s.title, s.table?.caption, s.table?.source, s.figure?.caption, s.figure?.source]).includes('[[fig:'));
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
