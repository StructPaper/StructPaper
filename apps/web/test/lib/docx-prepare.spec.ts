import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { assertWordDocx, prepareDocx } from '@/lib/docx-prepare';
import { splitFootnotes, inlineFootnotes, footnotesOf, withoutFootnotes, hasFootnotes } from '@/lib/footnotes';
import { inlineToJats } from '@/lib/jats-export';

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const run = (t: string) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;

async function docx(body: string, extra: Record<string, string> = {}): Promise<ArrayBuffer> {
  const zip = new JSZip();
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
  for (const [name, content] of Object.entries(extra)) zip.file(name, content);
  return zip.generateAsync({ type: 'arraybuffer' });
}

const textOf = async (buffer: ArrayBuffer) => {
  const xml = await (await JSZip.loadAsync(buffer)).file('word/document.xml')!.async('text');
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('');
};

describe('what is not a Word .docx', () => {
  it('an old binary .doc gets a clear message', () => {
    const bytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0]);
    expect(() => assertWordDocx(bytes.buffer)).toThrow(/\.doc/);
    expect(() => assertWordDocx(bytes.buffer)).toThrow(/Lưu thành \.docx/);
  });

  it('an RTF file does too', () => {
    const rtf = new TextEncoder().encode('{\\rtf1\\ansi hello}');
    expect(() => assertWordDocx(rtf.buffer)).toThrow(/RTF/);
  });

  it('a file that is not a zip at all is called what it is', () => {
    expect(() => assertWordDocx(new TextEncoder().encode('hello world').buffer)).toThrow(/không phải/);
  });

  it('a real .docx passes', async () => {
    await expect(prepareDocx(await docx(`<w:p>${run('Xin chào')}</w:p>`))).resolves.toMatchObject({ notes: [] });
  });
});

describe('Track Changes', () => {
  it('keeps what was inserted and drops what was deleted', async () => {
    const body =
      `<w:p>${run('Giữ ')}<w:ins w:id="1" w:author="A">${run('thêm vào ')}</w:ins>` +
      `<w:del w:id="2" w:author="A"><w:r><w:delText xml:space="preserve">đã xóa </w:delText></w:r></w:del>${run('cuối.')}</w:p>`;
    const result = await prepareDocx(await docx(body));
    expect(await textOf(result.buffer)).toBe('Giữ thêm vào cuối.');
    expect(result.stats).toMatchObject({ inserted: 1, deleted: 1 });
    expect(result.notes[0]).toContain('thay đổi đang theo dõi');
  });

  it('text moved elsewhere is kept once, at its new place', async () => {
    const body =
      `<w:p><w:moveFrom w:id="1"><w:r><w:t>đoạn chuyển</w:t></w:r></w:moveFrom>${run('A. ')}</w:p>` +
      `<w:p><w:moveTo w:id="2">${run('đoạn chuyển')}</w:moveTo></w:p>`;
    const result = await prepareDocx(await docx(body));
    expect((await textOf(result.buffer)).match(/đoạn chuyển/g)).toHaveLength(1);
  });

  it('a paragraph mark flagged as inserted or deleted does not swallow the text after it', async () => {
    const body = `<w:p><w:pPr><w:rPr><w:del w:id="9" w:author="A"/></w:rPr></w:pPr>${run('Còn lại')}</w:p>`;
    const result = await prepareDocx(await docx(body));
    expect(await textOf(result.buffer)).toBe('Còn lại');
  });

  it('a file without tracked changes is returned untouched', async () => {
    const original = await docx(`<w:p>${run('Bình thường')}</w:p>`);
    const result = await prepareDocx(original);
    expect(result.buffer).toBe(original);
    expect(result.notes).toEqual([]);
  });
});

describe('footnotes and endnotes', () => {
  const footnotes = `<w:footnotes ${W}>
    <w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
    <w:footnote w:id="1"><w:p><w:r><w:t>Nguồn: Tổng cục Thống kê</w:t></w:r><w:r><w:t xml:space="preserve"> (2023).</w:t></w:r></w:p></w:footnote>
  </w:footnotes>`;
  const endnotes = `<w:endnotes ${W}><w:endnote w:id="1"><w:p><w:r><w:t>Chú thích cuối bài</w:t></w:r></w:p></w:endnote></w:endnotes>`;

  it('puts a footnote at the sentence that cites it', async () => {
    const body = `<w:p>${run('Dân số tăng.')}<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="1"/></w:r>${run(' Tiếp theo.')}</w:p>`;
    const result = await prepareDocx(await docx(body, { 'word/footnotes.xml': footnotes }));
    expect(await textOf(result.buffer)).toBe('Dân số tăng.[[fn: Nguồn: Tổng cục Thống kê (2023).]] Tiếp theo.');
    expect(result.stats.footnotes).toBe(1);
    expect(result.notes.join(' ')).toContain('1 chú thích');
  });

  it('endnotes are handled the same way', async () => {
    const body = `<w:p>${run('Câu.')}<w:r><w:endnoteReference w:id="1"/></w:r></w:p>`;
    const result = await prepareDocx(await docx(body, { 'word/endnotes.xml': endnotes }));
    expect(await textOf(result.buffer)).toBe('Câu.[[fn: Chú thích cuối bài]]');
  });

  it('a reference with no note text is left alone', async () => {
    const body = `<w:p>${run('Câu.')}<w:r><w:footnoteReference w:id="7"/></w:r></w:p>`;
    const result = await prepareDocx(await docx(body, { 'word/footnotes.xml': footnotes }));
    expect(result.stats.footnotes).toBe(0);
  });
});

describe('what cannot be carried over is said', () => {
  it('counts comments, EMF/WMF pictures and embedded MathType equations', async () => {
    const result = await prepareDocx(
      await docx(`<w:p>${run('x')}<w:r><w:object><o:OLEObject ProgID="Equation.DSMT4"/></w:object></w:r></w:p>`, {
        'word/comments.xml': `<w:comments ${W}><w:comment w:id="0"/><w:comment w:id="1"/></w:comments>`,
        'word/media/image1.emf': 'x',
        'word/media/image2.wmf': 'x',
        'word/media/image3.png': 'x',
      }),
    );
    expect(result.stats).toMatchObject({ comments: 2, vectorImages: 2, embeddedEquations: 1 });
    expect(result.notes.join(' ')).toMatch(/2 bình luận/);
    expect(result.notes.join(' ')).toMatch(/2 hình dạng EMF\/WMF/);
    expect(result.notes.join(' ')).toMatch(/MathType/);
  });
});

describe('footnotes inside a paragraph', () => {
  const text = 'Dân số tăng.[[fn: Nguồn A]] Giá giảm.[[fn: Nguồn B]]';

  it('are found, in order, with the text around them', () => {
    expect(hasFootnotes(text)).toBe(true);
    expect(footnotesOf(text)).toEqual(['Nguồn A', 'Nguồn B']);
    expect(splitFootnotes(text).map((p) => p.kind)).toEqual(['text', 'note', 'text', 'note']);
    expect(withoutFootnotes(text)).toBe('Dân số tăng. Giá giảm.');
  });

  it('turn into a parenthesis where there is no footnote to print', () => {
    expect(inlineFootnotes(text)).toBe('Dân số tăng. (Chú thích: Nguồn A) Giá giảm. (Chú thích: Nguồn B)');
    expect(inlineFootnotes('Không có')).toBe('Không có');
  });

  it('become inline <fn> elements in JATS', () => {
    expect(inlineToJats('Câu.[[fn: Ghi chú]]')).toBe('Câu.<fn><p>Ghi chú</p></fn>');
  });
});
