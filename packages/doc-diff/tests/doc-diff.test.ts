import { describe, it, expect } from 'vitest';
import { diffDocs, diffInline, contentFingerprintSource, countWords } from '../src';

const doc = (over: Record<string, any> = {}) => ({
  metadata: { title: 'Tiêu đề', abstract: 'Tóm tắt', keywords: ['a'], authors: [{ id: 'a1', name: 'An' }], affiliations: [{ id: 1, name: 'ĐH' }], dates: {} },
  sections: [
    { id: 's1', type: 'h1', title: 'Giới thiệu', content: '' },
    { id: 's2', type: 'paragraph', content: 'Đoạn một.' },
    { id: 's3', type: 'paragraph', content: 'Đoạn hai.' },
  ],
  references: [{ id: 1, raw: 'Ref 1' }],
  ...over,
});

describe('inline diff', () => {
  const rebuild = (segs: ReturnType<typeof diffInline>, side: 'before' | 'after') =>
    segs.filter((s) => s.type === 'same' || s.type === (side === 'before' ? 'del' : 'add')).map((s) => s.text).join('');

  it('marks only the words that changed', () => {
    const segs = diffInline('Hôm nay trời đẹp lắm', 'Hôm nay trời rất đẹp lắm');
    expect(segs.filter((s) => s.type === 'add').map((s) => s.text.trim())).toEqual(['rất']);
    expect(segs.some((s) => s.type === 'del')).toBe(false);
  });

  it('puts the old and the new text back together from the segments, for many random edits', () => {
    const words = ['một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy'];
    let seed = 7;
    const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n);
    const text = () => Array.from({ length: rnd(12) }, () => words[rnd(words.length)]).join(rnd(2) ? ' ' : '  ');
    for (let i = 0; i < 200; i++) {
      const a = text();
      const b = text();
      const segs = diffInline(a, b);
      expect(rebuild(segs, 'before')).toBe(a);
      expect(rebuild(segs, 'after')).toBe(b);
    }
  });

  it('handles empty sides and identical text', () => {
    expect(diffInline('', '')).toEqual([]);
    expect(diffInline('abc', 'abc')).toEqual([{ type: 'same', text: 'abc' }]);
    expect(diffInline('', 'abc')).toEqual([{ type: 'add', text: 'abc' }]);
    expect(diffInline('abc', '')).toEqual([{ type: 'del', text: 'abc' }]);
  });

  it('does not stall on very long texts', () => {
    const a = Array.from({ length: 5000 }, (_, i) => `w${i}`).join(' ');
    const b = Array.from({ length: 5000 }, (_, i) => `x${i}`).join(' ');
    const segs = diffInline(a, b);
    expect(rebuild(segs, 'before')).toBe(a);
    expect(rebuild(segs, 'after')).toBe(b);
  });
});

describe('document diff', () => {
  it('is empty for the same content', () => {
    expect(diffDocs(doc(), doc()).isEmpty).toBe(true);
  });

  it('tells an edited block from a removed and an added one by id', () => {
    const after = doc({
      sections: [
        { id: 's1', type: 'h1', title: 'Giới thiệu', content: '' },
        { id: 's2', type: 'paragraph', content: 'Đoạn một đã sửa.' },
        { id: 's9', type: 'paragraph', content: 'Đoạn mới.' },
      ],
    });
    const d = diffDocs(doc(), after);
    expect(d.blocks.map((b) => [b.id, b.kind])).toEqual(expect.arrayContaining([['s2', 'modified'], ['s9', 'added'], ['s3', 'removed']]));
    expect(d.blocks.find((b) => b.id === 's2')!.inline!.some((s) => s.type === 'add')).toBe(true);
    expect(d.stats).toMatchObject({ blocksAdded: 1, blocksRemoved: 1, blocksModified: 1, blocksMoved: 0 });
  });

  it('a block that only changed place is a move, and unmoved neighbours are not', () => {
    const after = doc({
      sections: [
        { id: 's2', type: 'paragraph', content: 'Đoạn một.' },
        { id: 's3', type: 'paragraph', content: 'Đoạn hai.' },
        { id: 's1', type: 'h1', title: 'Giới thiệu', content: '' },
      ],
    });
    const d = diffDocs(doc(), after);
    expect(d.blocks.map((b) => [b.id, b.kind])).toEqual([['s1', 'moved']]);
    expect(d.stats.blocksMoved).toBe(1);
  });

  it('reports metadata fields with labels and word-level marks', () => {
    const after = doc();
    after.metadata.title = 'Tiêu đề mới';
    after.metadata.keywords = ['a', 'b'];
    const d = diffDocs(doc(), after);
    const title = d.fields.find((f) => f.path === 'metadata.title')!;
    expect(title).toMatchObject({ label: 'Tiêu đề', kind: 'modified' });
    expect(title.inline.some((s) => s.type === 'add' && s.text.includes('mới'))).toBe(true);
    expect(d.fields.find((f) => f.path === 'metadata.keywords')).toMatchObject({ before: 'a', after: 'a, b' });
  });

  it('follows authors and references by id', () => {
    const after = doc();
    after.metadata.authors = [{ id: 'a1', name: 'An Nguyễn' }, { id: 'a2', name: 'Bình' }];
    after.references = [];
    const d = diffDocs(doc(), after);
    expect(d.items.map((i) => [i.scope, i.id, i.kind])).toEqual(
      expect.arrayContaining([['author', 'a1', 'modified'], ['author', 'a2', 'added'], ['reference', '1', 'removed']]),
    );
    expect(d.stats.refsDelta).toBe(-1);
  });

  it('names the changes of the paper\'s layout settings one by one', () => {
    const before = doc({ layoutSettings: { columnLayout: '2-column', pageNumbering: { format: 'arabic' } } });
    const after = doc({ layoutSettings: { columnLayout: '1-column', fontSize: '10pt', pageNumbering: { format: 'arabic' } } });
    const d = diffDocs(before, after);
    expect(d.layoutChanged).toBe(true);
    expect(d.layout.map((f) => [f.label, f.kind, f.before, f.after])).toEqual([
      ['Số cột', 'modified', '2-column', '1-column'],
      ['Cỡ chữ', 'added', '', '10pt'],
    ]);
    expect(diffDocs(before, before).layoutChanged).toBe(false);
  });

  it('follows the publication data, the article type in English and the citation block', () => {
    const before = doc();
    const after = doc({ sections: [...doc().sections, { id: 'c', type: 'citation', title: 'Trích dẫn', content: 'Nguyen A (2026)' }] });
    after.metadata.publication = { volume: '12', doi: '10.1/x' };
    after.metadata.articleTypeEn = 'Research Article';
    const d = diffDocs(before, after);
    const byPath = Object.fromEntries(d.fields.map((f) => [f.path, f]));
    expect(byPath['metadata.publication.volume']).toMatchObject({ label: 'Tập (do tòa soạn cấp)', kind: 'added', after: '12' });
    expect(byPath['metadata.publication.doi']).toBeTruthy();
    expect(byPath['metadata.articleTypeEn']).toBeTruthy();
    expect(byPath['citation']).toMatchObject({ kind: 'added', after: 'Nguyen A (2026)' });
    // the citation block is a field of the paper, not a body block
    expect(d.blocks.some((b) => b.id === 'c')).toBe(false);
  });

  it('notices a changed table, a changed layout and counts words', () => {
    const before = doc({ sections: [{ id: 't', type: 'table', content: '', table: { id: 't', rows: [['1']] } }] });
    const after = doc({ sections: [{ id: 't', type: 'table', content: '', table: { id: 't', rows: [['2']] } }], layoutSettings: { columns: 1 } });
    const d = diffDocs(before, after);
    expect(d.blocks[0]).toMatchObject({ id: 't', kind: 'modified', fields: ['table'] });
    expect(d.layoutChanged).toBe(true);
    expect(countWords(' một  hai ba ')).toBe(3);
    expect(diffDocs(doc(), doc({ sections: [...doc().sections, { id: 's4', type: 'paragraph', content: 'ba từ mới' }] })).stats.wordsDelta).toBe(3);
  });

  it('ignores key order and bookkeeping when fingerprinting content', () => {
    const a = { ...doc(), version: 3, updatedAt: 'x' };
    const b = { version: 9, references: doc().references, sections: doc().sections, metadata: { ...doc().metadata } };
    expect(contentFingerprintSource(a)).toBe(contentFingerprintSource(b));
    expect(contentFingerprintSource(doc())).not.toBe(contentFingerprintSource(doc({ references: [] })));
  });
});

import { docFromStored, storedFromDoc, isWrapped } from '../src';

describe('the two shapes a paper is stored in', () => {
  const flat = {
    title: 'Tiêu đề',
    journalId: 'VNUHCM-HS',
    authors: [{ id: 'a1', name: 'An' }],
    displayName: 'Bản thảo',
    sections: [{ id: 's1', type: 'paragraph', content: 'x' }],
    references: [{ id: 1, raw: 'r' }],
    layoutSettings: { columns: 1 },
    templateId: 'hs',
    templateName: 'HS',
  };

  it('reads a flat save as a paper: metadata fields apart from the body, references, layout and name', () => {
    const doc = docFromStored(flat);
    expect(doc.metadata).toEqual({ title: 'Tiêu đề', journalId: 'VNUHCM-HS', authors: [{ id: 'a1', name: 'An' }] });
    expect(doc.sections).toHaveLength(1);
    expect(doc.references).toHaveLength(1);
    expect(doc.layoutSettings).toEqual({ columns: 1 });
    expect(doc.displayName).toBe('Bản thảo');
    expect(isWrapped(flat)).toBe(false);
  });

  it('reads a wrapped save as it is, and an empty one as an empty paper', () => {
    const wrapped = { doc: { metadata: { title: 'W' }, sections: [], references: [] } };
    expect(isWrapped(wrapped)).toBe(true);
    expect(docFromStored(wrapped)).toBe(wrapped.doc);
    expect(docFromStored(null)).toEqual({ metadata: {}, sections: [], references: [] });
    expect(docFromStored({}).sections).toEqual([]);
  });

  it('writes a paper back in the shape it was stored in, keeping what is not part of the paper', () => {
    const doc = { ...docFromStored(flat), sections: [{ id: 's9', type: 'paragraph', content: 'mới' }] };
    const back = storedFromDoc(doc, flat);
    expect(back).toMatchObject({ title: 'Tiêu đề', sections: [{ id: 's9' }], templateId: 'hs', templateName: 'HS', displayName: 'Bản thảo', layoutSettings: { columns: 1 } });
    expect((back as any).doc).toBeUndefined();
    expect(docFromStored(back).sections[0].id).toBe('s9');

    const wrappedBack = storedFromDoc(doc, { doc: { metadata: {} }, other: 1 });
    expect(wrappedBack).toMatchObject({ other: 1, doc });
  });
});
