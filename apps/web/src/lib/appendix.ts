import type { CompletePaper, PaperSection } from '@/types/paper';

/**
 * Appendices ("Phụ lục 1", "Phụ lục 2" …): tables and figures flagged `appendix`. They are numbered on their own, from 1, and printed
 * as a group apart from the text. Where the group goes is the paper's choice (`metadata.appendix.placement`):
 *   afterReferences  after the list of references (default: how most journals set them)
 *   beforeReferences at the end of the text, before the references
 *   inContent        in the text, under a heading "Phụ lục"
 *   original         where the Word file had them (after the references, or each after the block it followed)
 * Every output (PDF, Word, JATS, the previews and the editor's lists) takes the order from `arrangeForOutput`, so none can disagree.
 */
export type AppendixPlacement = 'afterReferences' | 'beforeReferences' | 'inContent' | 'original';

export interface AppendixSettings {
  placement: AppendixPlacement;
  /** The sheets of the appendices are turned on their side (as the standard PDF does), whatever each table or figure says. Off by default: only a table or figure is turned, the sheet stays upright. */
  rotatePage: boolean;
  /** "Phụ lục 1, 2, 3" or "Phụ lục A, B, C". */
  numbering: 'number' | 'letter';
}

export const DEFAULT_APPENDIX: AppendixSettings = { placement: 'afterReferences', rotatePage: false, numbering: 'number' };

export const APPENDIX_PLACEMENTS: Array<{ value: AppendixPlacement; label: string; hint: string }> = [
  { value: 'afterReferences', label: 'Sau tài liệu tham khảo', hint: 'Phụ lục in sau danh mục tài liệu tham khảo (mặc định)' },
  { value: 'beforeReferences', label: 'Trước tài liệu tham khảo', hint: 'Phụ lục in ở cuối nội dung, trước danh mục tài liệu tham khảo' },
  { value: 'inContent', label: 'Trong nội dung', hint: 'Phụ lục nằm trong phần nội dung, dưới một đề mục "Phụ lục"; vẫn thấy ở thẻ Phụ lục' },
  { value: 'original', label: 'Như trong file Word', hint: 'Giữ đúng vị trí của từng phụ lục trong file Word đã nhập' },
];

export const appendixSettingsOf = (paper: Pick<CompletePaper, 'metadata'>): AppendixSettings => ({ ...DEFAULT_APPENDIX, ...(paper.metadata?.appendix ?? {}) });

export const isAppendix = (s: PaperSection): boolean => (s.type === 'table' && !!s.table?.appendix) || (s.type === 'figure' && !!s.figure?.appendix);

/** "1" or "A": the mark an appendix carries. */
export const appendixMark = (n: number, numbering: AppendixSettings['numbering']): string => (numbering === 'letter' ? String.fromCharCode(64 + ((n - 1) % 26) + 1) : String(n));

/** The label printed in front of an appendix caption: "Phụ lục 2" / "Appendix 2". */
export const appendixLabel = (n: number, numbering: AppendixSettings['numbering'] = 'number', lang: 'vi' | 'en' = 'vi'): string => `${lang === 'en' ? 'Appendix' : 'Phụ lục'} ${appendixMark(n, numbering)}`;

/** The sections with their appendices numbered 1, 2, 3 … in the order they stand (a copy; the other sections are the same objects). */
export function renumberAppendices(sections: PaperSection[]): PaperSection[] {
  let n = 0;
  return sections.map((s) => {
    if (!isAppendix(s)) return s;
    n += 1;
    if (s.type === 'table' && s.table) return s.table.num === n ? s : { ...s, table: { ...s.table, num: n } };
    if (s.type === 'figure' && s.figure) return s.figure.num === n ? s : { ...s, figure: { ...s.figure, num: n } };
    return s;
  });
}

export interface Arranged {
  /** Sections printed in the text, in order (with the appendices too when the placement puts them there). */
  body: PaperSection[];
  /** The part of `body` that is not the appendix group (all of it unless the appendices stand together in the text). */
  bodyText: PaperSection[];
  /** The appendices that stand together at the end of `body` (with their heading, when the placement has one). */
  bodyGroup: PaperSection[];
  /** The appendices printed after the references, when the placement says so (otherwise empty). */
  afterReferences: PaperSection[];
  /** Every appendix, numbered, in order. */
  appendices: PaperSection[];
  /** The appendices stand together as one group (a landscape region), not each where its block was. */
  grouped: boolean;
}

const HEADING_ID = 'appendix-heading';

/** The order the paper is printed in. */
export function arrangeForOutput(paper: Pick<CompletePaper, 'sections' | 'metadata'>, lang: 'vi' | 'en' = 'vi'): Arranged {
  const settings = appendixSettingsOf(paper);
  const numbered = renumberAppendices(paper.sections || []);
  const text = numbered.filter((s) => !isAppendix(s));
  const appendices = numbered.filter(isAppendix);
  if (appendices.length === 0) return { body: numbered, bodyText: numbered, bodyGroup: [], afterReferences: [], appendices: [], grouped: false };

  switch (settings.placement) {
    case 'beforeReferences':
      return { body: [...text, ...appendices], bodyText: text, bodyGroup: appendices, afterReferences: [], appendices, grouped: true };
    case 'inContent': {
      const heading: PaperSection = { id: HEADING_ID, type: 'h1', title: lang === 'en' ? 'Appendices' : 'Phụ lục', content: '' };
      return { body: [...text, heading, ...appendices], bodyText: text, bodyGroup: [heading, ...appendices], afterReferences: [], appendices, grouped: true };
    }
    case 'original': {
      // each appendix goes after the block it followed in the Word file; those that came after the references stay after them
      const after = appendices.filter((s) => s.appendixOrigin?.afterReferences !== false && (s.appendixOrigin?.afterReferences || !s.appendixOrigin?.after));
      const inline = appendices.filter((s) => !after.includes(s));
      const body: PaperSection[] = [];
      const pending = new Map<string, PaperSection[]>();
      inline.forEach((s) => {
        const key = s.appendixOrigin?.after ?? '';
        pending.set(key, [...(pending.get(key) ?? []), s]);
      });
      text.forEach((s) => {
        body.push(s);
        (pending.get(s.id) ?? []).forEach((a) => body.push(a));
        pending.delete(s.id);
      });
      // an anchor that is gone: the appendix goes to the end of the text
      pending.forEach((list) => list.forEach((a) => body.push(a)));
      return { body, bodyText: body, bodyGroup: [], afterReferences: after, appendices, grouped: false };
    }
    case 'afterReferences':
    default:
      return { body: text, bodyText: text, bodyGroup: [], afterReferences: appendices, appendices, grouped: true };
  }
}

export type SectionScope = 'content' | 'appendix';

/** Whether the editor's list of this scope shows the block: the appendix list shows the appendices; the content list shows the rest (and the appendices too when they stand in the text). */
export const shownInScope = (s: PaperSection, scope: SectionScope, placement: AppendixPlacement): boolean =>
  scope === 'appendix' ? isAppendix(s) : !isAppendix(s) || placement === 'inContent';

/** The blocks one list of the editor shows. */
export const scopedSections = (all: PaperSection[], scope: SectionScope, placement: AppendixPlacement): PaperSection[] => all.filter((s) => shownInScope(s, scope, placement));

/**
 * The whole list of blocks after the author changed what one list shows (added, deleted, moved, changed a block). Blocks the list does not
 * show stay as they are. A block that became an appendix (or stopped being one) goes to its other list; the text comes first and the
 * appendices last, and the appendices are numbered 1, 2, 3 in the order they stand.
 */
export function mergeScopedSections(all: PaperSection[], next: PaperSection[], scope: SectionScope, placement: AppendixPlacement): PaperSection[] {
  const hidden = all.filter((s) => !shownInScope(s, scope, placement));
  const text = scope === 'content' ? next.filter((s) => !isAppendix(s)) : [...hidden.filter((s) => !isAppendix(s)), ...next.filter((s) => !isAppendix(s))];
  const apps = scope === 'content' ? [...hidden.filter(isAppendix), ...next.filter(isAppendix)] : next.filter(isAppendix);
  return renumberAppendices([...text, ...apps]);
}

/** A new appendix table or figure for the appendix list: flagged and numbered after the appendices there are. */
export function nextAppendixNumber(all: PaperSection[]): number {
  return all.filter(isAppendix).length + 1;
}

/**
 * What a table or a figure gets when it becomes an appendix: turned on its side and set across the whole page (over the side column), as
 * the standard PDF prints them. They are the same settings every table and figure has; the author changes them one by one. (The sheet
 * itself stays upright unless the paper asks to turn it: `rotatePage`.)
 */
export const APPENDIX_BLOCK_DEFAULTS = { columnSpan: '2-column' as const, isFullWidth: true, isRotated: true, sideColumn: 'full' as const };
