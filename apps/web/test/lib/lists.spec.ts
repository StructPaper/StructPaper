import { describe, it, expect } from 'vitest';
import { isBullet, listMarkOf, splitListItem } from '@/lib/list-marks';
import { extractListItems } from '@/lib/docx-headings';
import { nextMark } from '@/features/editor/overview/overview-lists';

describe('list items', () => {
  it('are paragraphs that start with their mark', () => {
    expect(listMarkOf('• Độ nhạy cao')).toBe('• ');
    expect(listMarkOf('- một mục')).toBe('- ');
    expect(listMarkOf('2. Mục hai')).toBe('2. ');
    expect(listMarkOf('b) Mục b')).toBe('b) ');
    expect(listMarkOf('Đoạn văn thường, có dấu - ở giữa')).toBeNull();
    expect(listMarkOf('2024 là năm')).toBeNull();
    expect(splitListItem('• Độ nhạy cao')).toEqual({ mark: '•', rest: 'Độ nhạy cao' });
    expect(isBullet('•')).toBe(true);
    expect(isBullet('2.')).toBe(false);
  });

  it('continue with the next mark', () => {
    expect(nextMark('•')).toBe('• ');
    expect(nextMark('2.')).toBe('3. ');
    expect(nextMark('b)')).toBe('c) ');
  });
});

describe('lists in a Word file', () => {
  const p = (num: string | null, text: string) => `<w:p>${num ? `<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="${num}"/></w:numPr></w:pPr>` : ''}<w:r><w:t>${text}</w:t></w:r></w:p>`;
  const numbering =
    '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/></w:lvl></w:abstractNum>' +
    '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/></w:lvl></w:abstractNum>' +
    '<w:num w:numId="5"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="6"><w:abstractNumId w:val="1"/></w:num>';

  it('gets the bullets and numbers Word draws written in front of their paragraphs', () => {
    const doc = p('5', 'Độ nhạy cao') + p(null, 'Một đoạn thường') + p('6', 'Bước một, rồi bước hai.') + p('6', 'Bước ba nữa nhé.');
    const items = extractListItems(doc, numbering, new Map());
    expect(items.get('Độ nhạy cao')).toEqual(['• ']);
    expect(items.get('Bước một, rồi bước hai.')).toEqual(['1. ']);
    expect(items.get('Bước ba nữa nhé.')).toEqual(['2. ']);
    expect(items.has('Một đoạn thường')).toBe(false);
  });

  it('leaves a heading numbered by Word, and a short numbered title, alone', () => {
    const doc = p('6', 'Giới thiệu') + p('6', 'Phương pháp nghiên cứu');
    expect(extractListItems(doc, numbering, new Map([['Giới thiệu', 0]])).has('Giới thiệu')).toBe(false);
    expect(extractListItems(doc, numbering, new Map()).has('Phương pháp nghiên cứu')).toBe(false);
  });
});

describe('list items in the PDF', () => {
  it('are set with the mark hanging to the left of the text', async () => {
    const { paragraphOrItemLatex } = await import('@/lib/latex-template');
    const out = paragraphOrItemLatex('• Độ nhạy cao');
    expect(out).toContain('\hangindent=1.6em');
    expect(out).toContain('\\makebox[1.1em][l]{$\\bullet$}');
    expect(out).toContain("nhạy cao");
    expect(out.endsWith('\par}')).toBe(true);
    expect(paragraphOrItemLatex('2. Mục hai')).toContain('{2.}');
    expect(paragraphOrItemLatex('Đoạn thường.')).not.toContain('hangindent');
  }, 60_000);
});
