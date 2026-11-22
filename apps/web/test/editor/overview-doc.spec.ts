import { describe, it, expect } from 'vitest';
import { createEmptyPaper, type CompletePaper } from '@/types/paper';
import { paperToDoc, docToPaper, contentToText, textToContent, keepIfSame, tableBoxPx } from '@/features/editor/overview/overview-doc';
import { blockNode, filterInsertItems, INSERT_ITEMS, newTableNode } from '@/features/editor/overview/overview-insert';

function samplePaper(): CompletePaper {
  const p: CompletePaper = createEmptyPaper();
  p.metadata.title = 'Tiêu đề <i>in nghiêng</i>';
  p.metadata.abstract = 'Tóm tắt có công thức $x_1^2$ và trích dẫn [1, 2].';
  p.metadata.keywords = ['một', 'hai'];
  p.references = [
    { id: 1, raw: 'Ref một', isCited: true, citationCount: 1 },
    { id: 2, raw: 'Ref hai', isCited: true, citationCount: 1 },
  ];
  p.sections = [
    { id: 's1', type: 'h1', title: '1. Giới thiệu', content: '' },
    { id: 's2', type: 'paragraph', content: 'Đoạn có <b>đậm</b>, <u>gạch</u> và *nghiêng* cũ, trích dẫn [6,7,8] và $a+b$.' },
    { id: 's3', type: 'h2', title: 'Mục con', content: 'Nội dung ngay dưới mục con' },
    {
      id: 's4',
      type: 'table',
      content: '',
      table: {
        id: 't4',
        num: 1,
        caption: 'Bảng thử',
        source: 'Nguồn: nhóm tác giả',
        headers: ['A', 'B', 'C'],
        rows: [['1', '2', '3'], ['4', '', '6']],
        headerRows: [[{ text: 'Nhóm', colSpan: 2 }, { text: 'C', rowSpan: 2 }], [{ text: 'a' }, { text: 'b' }]],
        bodyRows: [
          [{ text: '<b>1</b>', fill: '#FFEEAA' }, { text: '2', align: 'right' }, { text: '3' }],
          [{ text: '4', colSpan: 2 }, { text: '6' }],
        ],
      },
    },
    { id: 's5', type: 'figure', content: '', figure: { id: 'f5', num: 1, caption: 'Hình thử', src: 'data:image/png;base64,AAAA', source: 'Nguồn ảnh' } },
    { id: 's6', type: 'equation', content: '', equation: { latex: 'E=mc^2', numbered: true, num: 1 } },
    { id: 's7', type: 'quote', content: 'Trích nguyên văn' },
  ];
  return p;
}

describe('overview document', () => {
  it('opening and closing the overview changes nothing, byte for byte', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    const back = docToPaper(doc, paper, { lang: 'vi' });
    expect(back).toBe(paper); // the very same object: nothing was touched
  });

  it('gives every block its section id and keeps the order', () => {
    const doc = paperToDoc(samplePaper(), { lang: 'vi' });
    const types = doc.content!.map((n) => n.type);
    expect(types.slice(0, 4)).toEqual(['frontTitle', 'frontAuthors', 'frontAbstract', 'frontKeywords']);
    const sids = doc.content!.filter((n) => n.attrs?.sid).map((n) => n.attrs!.sid);
    expect(sids).toEqual(['s1', 's2', 's3', 's3:body', 's4', 's5', 's6', 's7']);
    expect(types.slice(-3)).toEqual(['refsTitle', 'refItem', 'refItem']);
  });

  it('changes only the block the author edited', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    const para = doc.content!.find((n) => n.attrs?.sid === 's2')!;
    para.content = textToContent('Đoạn đã sửa hoàn toàn.');
    const back = docToPaper(doc, paper, { lang: 'vi' });
    expect(back).not.toBe(paper);
    expect(back.sections[1].content).toBe('Đoạn đã sửa hoàn toàn.');
    expect(back.sections[0]).toBe(paper.sections[0]);
    expect(back.sections[3]).toBe(paper.sections[3]);
    expect(back.references).toBe(paper.references);
    expect(back.metadata).toBe(paper.metadata);
  });

  it('writes emphasis back as tags', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    const para = doc.content!.find((n) => n.attrs?.sid === 's2')!;
    para.content = [{ type: 'text', text: 'chữ ' }, { type: 'text', text: 'đậm', marks: [{ type: 'bold' }] }];
    expect(docToPaper(doc, paper, { lang: 'vi' }).sections[1].content).toBe('chữ <b>đậm</b>');
  });

  it('edits the title, abstract and keywords in the metadata, for the language shown', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    doc.content!.find((n) => n.type === 'frontTitle')!.content = textToContent('Tiêu đề mới');
    doc.content!.find((n) => n.type === 'frontKeywords')!.content = [{ type: 'text', text: 'một, ba, bốn' }];
    const back = docToPaper(doc, paper, { lang: 'vi' });
    expect(back.metadata.title).toBe('Tiêu đề mới');
    expect(back.metadata.keywords).toEqual(['một', 'ba', 'bốn']);
    expect(back.metadata.abstract).toBe(paper.metadata.abstract);
    // in English the same edit goes to the English fields
    const en = paperToDoc(paper, { lang: 'en' });
    en.content!.find((n) => n.type === 'frontTitle')!.content = textToContent('English title');
    expect(docToPaper(en, paper, { lang: 'en' }).metadata.titleEn).toBe('English title');
  });

  it('adds a block the author typed, and drops one the author deleted', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    doc.content!.splice(5, 0, { type: 'paragraph', attrs: { sid: null }, content: textToContent('Đoạn mới') });
    const without = doc.content!.filter((n) => n.attrs?.sid !== 's7');
    const back = docToPaper({ ...doc, content: without }, paper, { lang: 'vi' });
    // five front blocks come first, so index 6 is right after the first section; s7 is gone and the rest keep their order
    expect(back.sections.map((s) => s.id.replace(/^sec_.*/, 'NEW'))).toEqual(['s1', 'NEW', 's2', 's3', 's4', 's5', 's6']);
    expect(back.sections.some((s) => s.content === 'Đoạn mới')).toBe(true);
    expect(back.sections.some((s) => s.id === 's7')).toBe(false);
    expect(back.sections.find((s) => s.content === 'Đoạn mới')!.id).toMatch(/^sec_/);
  });

  it('keeps a heading and the paragraph written under it together', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    doc.content!.find((n) => n.attrs?.sid === 's3:body')!.content = textToContent('Nội dung đổi');
    const back = docToPaper(doc, paper, { lang: 'vi' });
    const h = back.sections.find((s) => s.id === 's3')!;
    expect(h.content).toBe('Nội dung đổi');
    expect(h.title).toBe('Mục con');
  });

  it('edits table cells, keeping spans, fills, alignment and the flat rows in step', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    const tableBlock = doc.content!.find((n) => n.attrs?.sid === 's4')!;
    const table = tableBlock.content!.find((n) => n.type === 'table')!;
    const firstBody = table.content![2]; // two header rows, then the body
    firstBody.content![1].content = [{ type: 'paragraph', content: [{ type: 'text', text: '99' }] }];
    const back = docToPaper(doc, paper, { lang: 'vi' });
    const t = back.sections.find((s) => s.id === 's4')!.table!;
    expect(t.bodyRows![0][1]).toMatchObject({ text: '99', align: 'right' });
    expect(t.bodyRows![0][0]).toMatchObject({ fill: '#FFEEAA', text: '<b>1</b>' });
    expect(t.bodyRows![1][0]).toMatchObject({ text: '4', colSpan: 2 });
    expect(t.rows[0]).toEqual(['<b>1</b>', '99', '3']);
    expect(t.rows[1]).toEqual(['4', '', '6']);
    expect(t.headerRows).toHaveLength(2);
    expect(t.caption).toBe('Bảng thử');
  });

  it('edits a caption, a source line and a reference', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    doc.content!.find((n) => n.attrs?.sid === 's5')!.content![0].content = textToContent('Chú thích mới');
    doc.content!.find((n) => n.type === 'refItem' && n.attrs?.rid === 2)!.content = textToContent('Ref hai đã sửa');
    const back = docToPaper(doc, paper, { lang: 'vi' });
    expect(back.sections.find((s) => s.id === 's5')!.figure!.caption).toBe('Chú thích mới');
    expect(back.sections.find((s) => s.id === 's5')!.figure!.src).toBe('data:image/png;base64,AAAA');
    expect(back.references[1].raw).toBe('Ref hai đã sửa');
    expect(back.references[0]).toBe(paper.references[0]);
  });
});

describe('text conversion', () => {
  it('reads and writes the same string for plain text, citations, formulas and tags', () => {
    for (const s of ['plain', 'a [1, 2] b', 'f $x^2$ g', 'x <b>y</b> z', 'm <i><u>n</u></i>']) {
      expect(contentToText(textToContent(s))).toBe(s);
    }
  });
  it('keeps the stored string when the text only reads the same', () => {
    expect(keepIfSame('a [1,2] b', 'a [1, 2] b')).toBe('a [1,2] b');
    expect(keepIfSame('a *b*', 'a <i>b</i>')).toBe('a *b*');
    expect(keepIfSame('abc', 'abd')).toBe('abd');
  });
});

describe('colour in text', () => {
  it('is a mark on the page and a tag in the paper', () => {
    const s = 'a <color=#CC0000>rouge <b>fort</b></color> z';
    const content = textToContent(s);
    const colored = content.filter((n) => n.marks?.some((m) => m.type === 'textColor'));
    expect(colored.map((n) => n.text).join('')).toBe('rouge fort');
    expect(contentToText(content)).toBe(s);
  });
});

describe('column widths and row heights of a table', () => {
  const firstRowOf = (doc: ReturnType<typeof paperToDoc>, sid: string) => doc.content!.find((n) => n.attrs?.sid === sid)!.content!.find((n) => n.type === 'table')!.content![0].content!;

  it('draws saved column shares as widths of the first row and reads dragged widths back', () => {
    const paper = samplePaper();
    const t = paper.sections.find((s) => s.id === 's4')!.table!;
    t.colWeights = [0.5, 0.25, 0.25];
    const box = tableBoxPx(t, false);
    const doc = paperToDoc(paper, { lang: 'vi' });
    const firstRow = firstRowOf(doc, 's4');
    // the widths are px of the table's own box, so that they add up to it and the table never runs wider than its column
    expect(firstRow[0].attrs!.colwidth).toEqual([Math.round(0.5 * box), Math.round(0.25 * box)]); // "Nhóm" covers two columns: 0.5 + 0.25
    expect(firstRow[1].attrs!.colwidth).toEqual([Math.round(0.25 * box)]);
    // nothing dragged: the paper comes back untouched
    expect(docToPaper(doc, paper, { lang: 'vi' })).toBe(paper);
    // the author drags: the shares change
    firstRow[0].attrs!.colwidth = [0.25 * box, 0.25 * box];
    firstRow[1].attrs!.colwidth = [0.5 * box];
    const back = docToPaper(doc, paper, { lang: 'vi' });
    expect(back.sections.find((s) => s.id === 's4')!.table!.colWeights).toEqual([0.25, 0.25, 0.5]);
  });

  it('does not invent shares for a table that never had them', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    expect(docToPaper(doc, paper, { lang: 'vi' }).sections.find((s) => s.id === 's4')!.table!.colWeights).toBeUndefined();
  });

  it('a click on a column border, which writes the column its own width as it is, changes nothing', () => {
    // the editor writes a width for the column under the pointer even when it was not moved: the others still share what is left of the box
    const paper = samplePaper();
    const box = tableBoxPx(paper.sections.find((s) => s.id === 's4')!.table!, false);
    const doc = paperToDoc(paper, { lang: 'vi' });
    const firstRow = firstRowOf(doc, 's4');
    firstRow[1].attrs!.colwidth = [box / 3]; // column "C", which is a third of the box as it stands
    const back = docToPaper(doc, paper, { lang: 'vi' });
    expect(back.sections.find((s) => s.id === 's4')!.table!.colWeights).toBeUndefined();
  });

  it('dragging one column leaves the others to share the rest of the box, not of some other width', () => {
    const paper = samplePaper();
    const box = tableBoxPx(paper.sections.find((s) => s.id === 's4')!.table!, false);
    const doc = paperToDoc(paper, { lang: 'vi' });
    const firstRow = firstRowOf(doc, 's4');
    firstRow[1].attrs!.colwidth = [box / 2]; // "C" made half the box
    const w = docToPaper(doc, paper, { lang: 'vi' }).sections.find((s) => s.id === 's4')!.table!.colWeights!;
    expect(w[2]).toBeCloseTo(0.5, 2);
    expect(w[0]).toBeCloseTo(0.25, 2);
    expect(w[1]).toBeCloseTo(0.25, 2);
  });

  it('a width of 0, which the editor writes for the columns of a merged cell that were not dragged, is no width', () => {
    const paper = samplePaper();
    const box = tableBoxPx(paper.sections.find((s) => s.id === 's4')!.table!, false);
    const doc = paperToDoc(paper, { lang: 'vi' });
    const firstRow = firstRowOf(doc, 's4');
    firstRow[0].attrs!.colwidth = [0, box / 2]; // "Nhóm" covers two columns, only the second was dragged
    const w = docToPaper(doc, paper, { lang: 'vi' }).sections.find((s) => s.id === 's4')!.table!.colWeights!;
    expect(w.every((x) => x > 0.05)).toBe(true);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 2);
  });

  it('shares with a column of no width are not drawn as widths at all', () => {
    const paper = samplePaper();
    paper.sections.find((s) => s.id === 's4')!.table!.colWeights = [0.7, 0, 0.3];
    const firstRow = firstRowOf(paperToDoc(paper, { lang: 'vi' }), 's4');
    expect(firstRow.every((c) => c.attrs!.colwidth === null)).toBe(true);
  });

  it('the box is one column wide, or the whole text width for a table over both columns and in a one-column paper', () => {
    const t = samplePaper().sections.find((s) => s.id === 's4')!.table!;
    expect(tableBoxPx({ ...t, columnSpan: '1-column', isFullWidth: false }, false)).toBe(253);
    expect(tableBoxPx({ ...t, columnSpan: '2-column', isFullWidth: true }, false)).toBe(523);
    expect(tableBoxPx({ ...t, columnSpan: '1-column', isFullWidth: false }, true)).toBe(523);
  });
});

describe('the lines under a table', () => {
  const tableBlockOf = (doc: ReturnType<typeof paperToDoc>, sid: string) => doc.content!.find((n) => n.attrs?.sid === sid)!;
  const sourcesOf = (doc: ReturnType<typeof paperToDoc>, sid: string) => tableBlockOf(doc, sid).content!.filter((n) => n.type === 'tableSource');

  it('is one block for every line, and an empty one for a table with none', () => {
    const paper = samplePaper();
    paper.sections.find((s) => s.id === 's4')!.table!.source = 'Chú thích: *, ** là mức ý nghĩa\nNguồn: Tác giả';
    const doc = paperToDoc(paper, { lang: 'vi' });
    expect(sourcesOf(doc, 's4').map((n) => contentToText(n.content))).toEqual(['Chú thích: *, ** là mức ý nghĩa', 'Nguồn: Tác giả']);
    delete paper.sections.find((s) => s.id === 's4')!.table!.source;
    expect(sourcesOf(paperToDoc(paper, { lang: 'vi' }), 's4')).toHaveLength(1);
  });

  it('opening and closing the overview changes nothing, however many lines there are', () => {
    const paper = samplePaper();
    paper.sections.find((s) => s.id === 's4')!.table!.source = 'Dòng một\nDòng hai\n\nDòng bốn';
    const doc = paperToDoc(paper, { lang: 'vi' });
    expect(docToPaper(doc, paper, { lang: 'vi' })).toBe(paper);
  });

  it('writes the lines back one under the other when the author adds or edits one', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    const block = tableBlockOf(doc, 's4');
    const at = block.content!.findIndex((n) => n.type === 'tableSource');
    block.content!.splice(at + 1, 0, { type: 'tableSource', content: textToContent('Chú thích: ghi thêm') });
    const back = docToPaper(doc, paper, { lang: 'vi' });
    expect(back.sections.find((s) => s.id === 's4')!.table!.source).toBe('Nguồn: nhóm tác giả\nChú thích: ghi thêm');
    // the other blocks are left as they were
    expect(back.sections.find((s) => s.id === 's5')).toBe(paper.sections.find((s) => s.id === 's5'));
  });

  it('keeps the author’s choice of bold, italic and alignment out of the text', () => {
    const paper = samplePaper();
    paper.sections.find((s) => s.id === 's4')!.table!.sourceStyle = { bold: true, align: 'center' };
    const doc = paperToDoc(paper, { lang: 'vi' });
    expect(docToPaper(doc, paper, { lang: 'vi' })).toBe(paper);
    expect(contentToText(sourcesOf(doc, 's4')[0].content)).toBe('Nguồn: nhóm tác giả');
  });
});

describe('blocks the author adds', () => {
  const opts = { lang: 'vi' as const };

  it('a new table becomes a table section with its cells and the next number', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, opts);
    const created: Array<{ index: number; id: string }> = [];
    const node = newTableNode(2, 2);
    const table = node.content!.find((n) => n.type === 'table')!;
    table.content![0].content![0].content = [{ type: 'paragraph', content: [{ type: 'text', text: 'Cột A' }] }];
    table.content![1].content![1].content = [{ type: 'paragraph', content: [{ type: 'text', text: '42' }] }];
    node.content![0].content = [{ type: 'text', text: 'Bảng mới' }];
    doc.content!.push(node);
    const back = docToPaper(doc, paper, { ...opts, created });
    const added = back.sections[back.sections.length - 1];
    expect(added.type).toBe('table');
    expect(added.table!.caption).toBe('Bảng mới');
    expect(added.table!.num).toBe(2);
    expect(added.table!.headers).toEqual(['Cột A', '']);
    expect(added.table!.rows).toEqual([['', '42']]);
    expect(created).toEqual([{ index: doc.content!.length - 1, id: added.id }]);
    // the page carries the id from now on: reading it again adds nothing
    node.attrs!.sid = added.id;
    expect(docToPaper(doc, back, opts)).toBe(back);
  });

  it('a new figure carries its picture, and a new equation its formula', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, opts);
    const fig = blockNode('figure', 'data:image/png;base64,BBBB');
    fig.content![0].content = [{ type: 'text', text: 'Chú thích' }];
    const eq = blockNode('equation');
    eq.attrs!.latex = 'a^2+b^2=c^2';
    doc.content!.push(fig, eq);
    const back = docToPaper(doc, paper, opts);
    const [f, e] = back.sections.slice(-2);
    expect(f.figure).toMatchObject({ src: 'data:image/png;base64,BBBB', caption: 'Chú thích', num: 2 });
    expect(e.equation).toMatchObject({ latex: 'a^2+b^2=c^2', numbered: true });
  });

  it('an empty line is not a section until something is typed in it', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, opts);
    doc.content!.push({ type: 'paragraph', attrs: { sid: null }, content: [] });
    expect(docToPaper(doc, paper, opts)).toBe(paper);
    doc.content!.push({ type: 'paragraph', attrs: { sid: null }, content: textToContent('Gõ vào') });
    expect(docToPaper(doc, paper, opts).sections.at(-1)!.content).toBe('Gõ vào');
  });
});

describe('the "/" menu', () => {
  it('finds items by their name or keywords, ignoring accents', () => {
    expect(filterInsertItems('bang').map((i) => i.kind)).toEqual(['table']);
    expect(filterInsertItems('Công').map((i) => i.kind)).toEqual(['equation']);
    expect(filterInsertItems('muc').map((i) => i.kind)).toEqual(['h1', 'h2', 'h3']);
    expect(filterInsertItems('').length).toBe(INSERT_ITEMS.length);
    expect(filterInsertItems('zzz')).toEqual([]);
  });
});

import { rowsFromClipboard, tableNodeFromRows } from '@/features/editor/overview/overview-insert';
describe('pasting cells from a spreadsheet', () => {
  it('reads tab-separated lines and an HTML table as rows, and nothing else', () => {
    expect(rowsFromClipboard('', 'A\tB\n1\t2\n3\t4\n')).toEqual([['A', 'B'], ['1', '2'], ['3', '4']]);
    expect(rowsFromClipboard('<table><tr><td>A</td><td>B</td></tr><tr><td>1</td><td> 2 </td></tr></table>', '')).toEqual([['A', 'B'], ['1', '2']]);
    expect(rowsFromClipboard('', 'một đoạn văn bình thường\nvà dòng nữa')).toBeNull();
    expect(rowsFromClipboard('<p>văn bản</p>', 'văn bản')).toBeNull();
  });
  it('becomes a table section with the first row as header', () => {
    const paper = samplePaper();
    const doc = paperToDoc(paper, { lang: 'vi' });
    doc.content!.push(tableNodeFromRows([['Mẫu', 'pH'], ['M1', '7,2'], ['M2']]));
    const t = docToPaper(doc, paper, { lang: 'vi' }).sections.at(-1)!.table!;
    expect(t.headers).toEqual(['Mẫu', 'pH']);
    expect(t.rows).toEqual([['M1', '7,2'], ['M2', '']]);
  });
});

describe('captions on the page', () => {
  it('are drawn without their "Table 1:" label (the page numbers them), and the stored caption keeps it', () => {
    const paper = samplePaper();
    const tb = paper.sections.find((s) => s.id === 's4')!.table!;
    tb.caption = 'Table 1: Variables measurement';
    paper.sections.find((s) => s.id === 's5')!.figure!.caption = 'Figure 2. Research model';
    const doc = paperToDoc(paper, { lang: 'en' });
    const tcap = doc.content!.find((n) => n.attrs?.sid === 's4')!.content!.find((n) => n.type === 'tableCaption')!;
    const fcap = doc.content!.find((n) => n.attrs?.sid === 's5')!.content!.find((n) => n.type === 'figureCaption')!;
    expect(contentToText(tcap.content)).toBe('Variables measurement');
    expect(contentToText(fcap.content)).toBe('Research model');
    expect(docToPaper(doc, paper, { lang: 'en' })).toBe(paper);
    tcap.content = textToContent('Another caption');
    expect(docToPaper(doc, paper, { lang: 'en' }).sections.find((s) => s.id === 's4')!.table!.caption).toBe('Another caption');
  });
});

describe('footnotes on the page', () => {
  it('are one mark in the text, and come back exactly as they were written', () => {
    const paper = samplePaper();
    const text = 'Anh là phản chiếu của Animus[[fn:  Animus (tiếng Latin: "tâm trí", *linh hồn*) là một khái niệm.]] trong tâm lý học.';
    paper.sections.find((s) => s.id === 's2')!.content = text;
    const doc = paperToDoc(paper, { lang: 'vi' });
    const para = doc.content!.find((n) => n.attrs?.sid === 's2')!;
    const kinds = para.content!.map((n) => n.type);
    expect(kinds).toEqual(['text', 'footnote', 'text']);
    expect(para.content![1].attrs!.raw).toBe('  Animus (tiếng Latin: "tâm trí", *linh hồn*) là một khái niệm.');
    expect(docToPaper(doc, paper, { lang: 'vi' })).toBe(paper);
    // the author writes the note of a new footnote: it goes back into the text as [[fn: …]]
    para.content!.push({ type: 'footnote', attrs: { raw: ' ghi thêm' } });
    expect(docToPaper(doc, paper, { lang: 'vi' }).sections.find((s) => s.id === 's2')!.content).toBe(`${text}[[fn: ghi thêm]]`);
  });
});
