import { describe, it, expect } from 'vitest';
import { EditorHistory } from '@/lib/history/editor-history';
import { locateChange, contentOf, type PaperContent } from '@/lib/history/paper-content';

const base = (): PaperContent => ({
  metadata: { title: 'A', abstract: '', keywords: [], authors: [], affiliations: [], journalId: 'VNUHCM-HS', journalName: '', journalAbbv: '', articleType: '', corresponding: { name: '', email: '', affiliation: '' }, dates: {}, doi: '', volume: '', issue: '', year: '', firstPage: 1, lastPage: 2 } as any,
  sections: [
    { id: 's1', type: 'paragraph', content: 'một' },
    { id: 's2', type: 'paragraph', content: 'hai' },
  ],
  references: [],
  layoutSettings: undefined,
  displayName: undefined,
});
const withTitle = (c: PaperContent, title: string): PaperContent => ({ ...c, metadata: { ...c.metadata, title } });
const withText = (c: PaperContent, id: string, content: string): PaperContent => ({ ...c, sections: c.sections.map((s) => (s.id === id ? { ...s, content } : s)) });

describe('where a change is', () => {
  // a change keeps the parts it did not touch as the very same objects, as the editor's updates do
  it('names the field and its tab', () => {
    const a = base();
    expect(locateChange(a, withTitle(a, 'B'))).toMatchObject({ tab: 'metadata', label: 'Sửa tiêu đề', coalesceKey: 'field:title' });
    const authors = { ...a, metadata: { ...a.metadata, authors: [{ id: 'a', name: 'An' }] as any } };
    expect(locateChange(a, authors)).toMatchObject({ tab: 'authors', label: 'Nhập tác giả' });
    const abs = { ...a, metadata: { ...a.metadata, abstract: 'x' } };
    expect(locateChange(a, abs)).toMatchObject({ tab: 'abstract' });
  });

  it('names the block that was edited, added or removed', () => {
    const a = base();
    expect(locateChange(a, withText(a, 's2', 'hai!'))).toMatchObject({ tab: 'sections', sectionId: 's2', isParagraph: true, coalesceKey: 'section:s2', label: 'Sửa đoạn văn' });
    const added = { ...a, sections: [...a.sections, { id: 's3', type: 'table', content: '' } as any] };
    expect(locateChange(a, added)).toMatchObject({ sectionId: 's3', label: 'Thêm bảng', coalesceKey: null });
    const removed = { ...a, sections: a.sections.slice(0, 1) };
    expect(locateChange(a, removed)).toMatchObject({ label: 'Xóa đoạn văn' });
  });

  it('several places at once is one unmergeable step', () => {
    const a = base();
    const both = withText(withTitle(a, 'B'), 's1', 'x');
    expect(locateChange(a, both)).toMatchObject({ label: 'Nhiều thay đổi', coalesceKey: null });
  });
});

describe('the undo history', () => {
  it('typing in one place is one step; another place is another', () => {
    const h = new EditorHistory();
    let doc = base();
    let t = 1000;
    for (const text of ['m', 'mộ', 'một', 'một ']) {
      const next = withText(doc, 's1', text);
      h.record(doc, next, null, (t += 100));
      doc = next;
    }
    expect(h.size).toBe(1);
    const next = withText(doc, 's2', 'hai ba');
    h.record(doc, next, null, (t += 100));
    expect(h.size).toBe(2);
    expect(h.undoLabel).toBe('Sửa đoạn văn');
  });

  it('a pause longer than the gap, or a very long run, starts a new step', () => {
    const h = new EditorHistory({ coalesceGapMs: 1000, coalesceMaxMs: 5000 });
    let doc = base();
    const type = (text: string, at: number) => {
      const next = withText(doc, 's1', text);
      h.record(doc, next, null, at);
      doc = next;
    };
    type('a', 0);
    type('ab', 500);
    expect(h.size).toBe(1);
    type('abc', 2000); // paused
    expect(h.size).toBe(2);
    for (let i = 1; i <= 8; i++) type('abc' + 'x'.repeat(i), 2000 + i * 900); // steady typing past 5 s
    expect(h.size).toBeGreaterThan(2);
  });

  it('undo gives the content before, redo the content after, and a new edit drops the redo', () => {
    const h = new EditorHistory();
    const a = base();
    const b = withTitle(a, 'B');
    const c = withTitle(b, 'C');
    h.record(a, b, null, 0);
    h.record(b, c, null, 5000);
    expect(h.undo()!.before).toBe(b);
    expect(h.canRedo).toBe(true);
    expect(h.redo()!.after).toBe(c);
    h.undo();
    h.record(b, withTitle(b, 'D'), null, 9000);
    expect(h.canRedo).toBe(false);
  });

  it('ignores a change that changes nothing, and drops a step typed back to where it started', () => {
    const h = new EditorHistory();
    const a = base();
    expect(h.record(a, { ...a, metadata: { ...a.metadata } }, null, 0)).toBe(false);
    const b = withTitle(a, 'AB');
    h.record(a, b, null, 0);
    h.record(b, withTitle(b, 'A'), null, 100);
    expect(h.size).toBe(0);
  });

  it('keeps at most maxSteps and reports its listeners', () => {
    const h = new EditorHistory({ maxSteps: 3 });
    let seen = 0;
    h.subscribe(() => seen++);
    let doc = base();
    for (let i = 0; i < 6; i++) {
      const next = withTitle(doc, `t${i}`);
      h.record(doc, next, null, i * 10_000);
      doc = next;
    }
    expect(h.size).toBe(3);
    expect(seen).toBe(6);
  });

  it('the paper-level bookkeeping is not part of the content', () => {
    const paper: any = { id: 'p', metadata: base().metadata, sections: [], references: [], version: 4, profilePin: { base: 1 } };
    expect(Object.keys(contentOf(paper)).sort()).toEqual(['displayName', 'layoutSettings', 'metadata', 'references', 'sections']);
  });
});
