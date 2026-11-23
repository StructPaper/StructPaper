import { describe, it, expect, vi } from 'vitest';
import type { CompletePaper, PaperSection } from '@/types/paper';
import { createEmptyPaper } from '@/types/paper';
import { extraChecks } from '@/lib/validation/extra-checks';
import { generateFullJournalLatex } from '@/lib/latex-template';
import { APPENDIX_BLOCK_DEFAULTS, nextAppendixNumber, arrangeForOutput, mergeScopedSections, renumberAppendices, scopedSections, appendixLabel } from '@/lib/appendix';

vi.setConfig({ testTimeout: 20000 });

const para = (id: string): PaperSection => ({ id, type: 'paragraph', content: id });
const tab = (id: string, num: number, appendix = false, origin?: PaperSection['appendixOrigin']): PaperSection => ({
  id,
  type: 'table',
  content: '',
  ...(origin ? { appendixOrigin: origin } : {}),
  table: { id, num, caption: id, headers: ['a'], rows: [], ...(appendix ? { appendix: true } : {}) },
});
const paper = (sections: PaperSection[], placement?: 'afterReferences' | 'beforeReferences' | 'inContent' | 'original'): Pick<CompletePaper, 'sections' | 'metadata'> =>
  ({ sections, metadata: placement ? { appendix: { placement } } : {} }) as any;

const S = [para('p1'), tab('a1', 7, true, { after: 'p1', afterReferences: false }), para('p2'), tab('a2', 9, true, { after: 'p2', afterReferences: true }), tab('t1', 1)];

describe('where the appendices are printed', () => {
  it('after the references by default, numbered 1, 2 whatever numbers they came with', () => {
    const a = arrangeForOutput(paper(S));
    expect(a.body.map((s) => s.id)).toEqual(['p1', 'p2', 't1']);
    expect(a.afterReferences.map((s) => [s.id, s.table!.num])).toEqual([['a1', 1], ['a2', 2]]);
  });
  it('before the references: at the end of the text', () => {
    const a = arrangeForOutput(paper(S, 'beforeReferences'));
    expect(a.body.map((s) => s.id)).toEqual(['p1', 'p2', 't1', 'a1', 'a2']);
    expect(a.afterReferences).toEqual([]);
    expect(a.bodyGroup.map((s) => s.id)).toEqual(['a1', 'a2']);
  });
  it('in the content: under a heading "Phụ lục"', () => {
    const a = arrangeForOutput(paper(S, 'inContent'));
    expect(a.body.map((s) => s.type)).toEqual(['paragraph', 'paragraph', 'table', 'h1', 'table', 'table']);
    expect(a.body[3].title).toBe('Phụ lục');
    expect(arrangeForOutput(paper(S, 'inContent'), 'en').body[3].title).toBe('Appendices');
  });
  it('as in the Word file: each after the block it followed, those after the references stay after them', () => {
    const a = arrangeForOutput(paper(S, 'original'));
    expect(a.body.map((s) => s.id)).toEqual(['p1', 'a1', 'p2', 't1']);
    expect(a.afterReferences.map((s) => s.id)).toEqual(['a2']);
  });
  it('a paper with no appendix is printed as it is', () => {
    const a = arrangeForOutput(paper([para('p1'), tab('t1', 1)]));
    expect(a.body).toHaveLength(2);
    expect(a.afterReferences).toEqual([]);
  });
  it('labels: Phụ lục 2, Appendix B', () => {
    expect(appendixLabel(2)).toBe('Phụ lục 2');
    expect(appendixLabel(2, 'letter', 'en')).toBe('Appendix B');
  });
});

describe('the two lists of the editor', () => {
  it('the content list shows the text, the appendix list the appendices; in the content only when the placement says so', () => {
    expect(scopedSections(S, 'content', 'afterReferences').map((s) => s.id)).toEqual(['p1', 'p2', 't1']);
    expect(scopedSections(S, 'appendix', 'afterReferences').map((s) => s.id)).toEqual(['a1', 'a2']);
    expect(scopedSections(S, 'content', 'inContent').map((s) => s.id)).toEqual(['p1', 'a1', 'p2', 'a2', 't1']);
  });
  it('a change in one list leaves the other as it is; the appendices stand last and are numbered', () => {
    // a text block deleted in the content list
    const afterDelete = mergeScopedSections(S, scopedSections(S, 'content', 'afterReferences').filter((s) => s.id !== 'p2'), 'content', 'afterReferences');
    expect(afterDelete.map((s) => s.id)).toEqual(['p1', 't1', 'a1', 'a2']);
    // an appendix deleted: the other is numbered 1
    const afterApp = mergeScopedSections(S, scopedSections(S, 'appendix', 'afterReferences').filter((s) => s.id !== 'a1'), 'appendix', 'afterReferences');
    expect(afterApp.filter((s) => s.table?.appendix).map((s) => [s.id, s.table!.num])).toEqual([['a2', 1]]);
  });
  it('a table made an appendix in the content list goes to the appendices; one made a table again goes back to the text', () => {
    const content = scopedSections(S, 'content', 'afterReferences').map((s) => (s.id === 't1' ? { ...s, table: { ...s.table!, appendix: true } } : s));
    const merged = mergeScopedSections(S, content, 'content', 'afterReferences');
    expect(merged.filter((s) => s.table?.appendix).map((s) => [s.id, s.table!.num])).toEqual([['a1', 1], ['a2', 2], ['t1', 3]]);
    const back = mergeScopedSections(merged, scopedSections(merged, 'appendix', 'afterReferences').map((s) => (s.id === 'a1' ? { ...s, table: { ...s.table!, appendix: undefined } } : s)), 'appendix', 'afterReferences');
    expect(back.map((s) => s.id)).toEqual(['p1', 'p2', 'a1', 'a2', 't1']);
    expect(back.filter((s) => s.table?.appendix).map((s) => [s.id, s.table!.num])).toEqual([['a2', 1], ['t1', 2]]);
  });
  it('renumbering leaves the sections that need no change as they are', () => {
    const list = renumberAppendices([tab('a', 1, true), tab('b', 2, true)]);
    expect(list.map((s) => s.table!.num)).toEqual([1, 2]);
  });
});

describe('what the author sets on an appendix is in the PDF (so the recompile button sees it)', () => {
  const latexOf = (table: Partial<NonNullable<PaperSection['table']>>, metadata: Record<string, unknown> = {}, sheetTurned = true) => {
    const p: any = createEmptyPaper();
    if (!sheetTurned) p.layoutSettings = { theme: { turnSheets: false } };
    p.metadata = { ...p.metadata, ...metadata };
    p.references = [{ id: 1, raw: 'Tác giả. Bài báo. 2020.', isCited: true, citationCount: 1 }];
    p.sections = [
      { id: 'h', type: 'h1', title: 'KQ', content: '' },
      { id: 'a1', type: 'table', content: '', table: { id: 'a1', num: 1, caption: 'Phụ lục 1. Bảng', headers: ['A'], rows: [['x']], appendix: true, ...APPENDIX_BLOCK_DEFAULTS, ...table } },
    ];
    return generateFullJournalLatex(p);
  };
  it('an appendix table is turned and across the whole page by default, the sheet upright', () => {
    const tex = latexOf({}, {}, false);
    expect(tex).toContain('\\begin{landscape}');
    expect(tex).toContain('\\spwidegeometry');
    expect(tex).not.toContain('pdflscape');
  });
  it('turning it off, or keeping it in the text, changes the LaTeX', () => {
    const base = latexOf({}, {}, false);
    expect(latexOf({ isRotated: false }, {}, false)).not.toBe(base);
    expect(latexOf({ sideColumn: 'text' }, {}, false)).not.toBe(base);
    expect(latexOf({ sideColumn: 'text', isRotated: false }, {}, false)).not.toContain('\\begin{landscape}');
  });
  it('the sheet turns with the table (the layout setting), each table keeping its own turn', () => {
    expect(latexOf({})).toContain('pdflscape');
    const upright = latexOf({}, {}, false);
    expect(upright).not.toContain('pdflscape');
    expect(upright).toContain('\\begin{landscape}');
  });
  it('the paper settings show too: placement, letters, turned sheet', () => {
    const base = latexOf({});
    expect(latexOf({}, { appendix: { placement: 'beforeReferences' } })).not.toBe(base);
    expect(latexOf({}, { appendix: { numbering: 'letter' } })).toContain('Phụ lục A.');
  });
});

describe('the checks for appendices', () => {
  const paperWith = (text: string, caption = 'Phụ lục 1. Bảng khảo sát') => {
    const p: any = createEmptyPaper();
    p.sections = [
      { id: 'h', type: 'h1', title: 'KQ', content: '' },
      { id: 'p', type: 'paragraph', content: text },
      { id: 'a1', type: 'table', content: '', table: { id: 'a1', num: 1, caption, headers: ['A'], rows: [['x']], appendix: true } },
    ];
    return p;
  };
  const codes = (p: any) => extraChecks(p, 'export').map((i) => i.code);
  it('warns when an appendix is not named in the text, and when it has no title', () => {
    expect(codes(paperWith('Không nhắc phụ lục nào.'))).toContain('appendix.unmentioned');
    expect(codes(paperWith('Chi tiết ở Phụ lục 1.'))).not.toContain('appendix.unmentioned');
    expect(codes(paperWith('Xem phụ lục 1 để biết thêm.'))).not.toContain('appendix.unmentioned');
    expect(codes(paperWith('Xem Phụ lục 1.', 'Phụ lục 1.'))).toContain('appendix.untitled');
    expect(codes(paperWith('Xem Phụ lục 1.'))).not.toContain('appendix.untitled');
  });
  it('knows the letter when the paper numbers with letters', () => {
    const p = paperWith('Xem Phụ lục A.');
    p.metadata.appendix = { numbering: 'letter' };
    expect(codes(p)).not.toContain('appendix.unmentioned');
  });
});

describe('appendices made of text', () => {
  const text = (id: string, type: PaperSection['type'] = 'paragraph'): PaperSection => ({ id, type, content: id, title: id, appendix: true });
  const S2 = [para('p1'), tab('t1', 1), text('ah', 'h1'), text('ap'), tab('a1', 5, true)];
  it('a heading and a paragraph of the appendices go with the appendices, in order, and are not numbered', () => {
    const a = arrangeForOutput(paper(S2));
    expect(a.body.map((s) => s.id)).toEqual(['p1', 't1']);
    expect(a.afterReferences.map((s) => s.id)).toEqual(['ah', 'ap', 'a1']);
    // only the table is numbered
    expect(a.afterReferences.find((s) => s.id === 'a1')!.table!.num).toBe(1);
    expect(nextAppendixNumber(S2)).toBe(2);
  });
  it('the appendix list shows them, the content list does not (unless they stand in the content)', () => {
    expect(scopedSections(S2, 'appendix', 'afterReferences').map((s) => s.id)).toEqual(['ah', 'ap', 'a1']);
    expect(scopedSections(S2, 'content', 'afterReferences').map((s) => s.id)).toEqual(['p1', 't1']);
    expect(scopedSections(S2, 'content', 'inContent').map((s) => s.id)).toEqual(['p1', 't1', 'ah', 'ap', 'a1']);
  });
  it('a block added in the appendix list, with its flag, stays there', () => {
    const next = [...scopedSections(S2, 'appendix', 'afterReferences'), text('ap2')];
    const merged = mergeScopedSections(S2, next, 'appendix', 'afterReferences');
    expect(merged.map((s) => s.id)).toEqual(['p1', 't1', 'ah', 'ap', 'a1', 'ap2']);
  });
  it('they come back through saving and loading', async () => {
    const { migrateV1toV2, adaptV2toV1 } = await import('@structpaper/doc-model');
    const p: any = { ...createEmptyPaper(), sections: S2 };
    const out: any = adaptV2toV1(migrateV1toV2(p) as any);
    expect(out.sections.find((s: any) => s.id === 'ah').appendix).toBe(true);
    expect(out.sections.find((s: any) => s.id === 'p1').appendix).toBeUndefined();
  });
});
