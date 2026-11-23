import { describe, it, expect } from 'vitest';
import { alignTokens, computeBreaks, normWord, pdfTokens, readPdf, splitKnown, splitWords, type AlignLine, type DocToken } from '@/features/editor/overview/overview-align';

const words = (s: string) => s.split(' ');

describe('lining up the PDF with the paper', () => {
  it('compares words by their letters and digits only', () => {
    expect(normWord('Hóa-học,')).toBe('hóahọc');
    expect(normWord('ﬁnal')).toBe('final');
    expect(splitWords('well-known (2020)').map((w) => w.norm)).toEqual(['well', 'known', '2020']);
  });

  it('joins a word the PDF cut at the end of a line when the paper has it whole, and keeps a hyphenated compound apart', () => {
    const lines: AlignLine[] = [
      { page: 1, col: 0, text: 'the environ-' },
      { page: 1, col: 0, text: 'ment is well-' },
      { page: 1, col: 0, text: 'known here' },
    ];
    const out = pdfTokens(lines, new Set(['the', 'environment', 'is', 'well', 'known', 'here'])).map((t) => t.norm);
    expect(out).toEqual(['the', 'environment', 'is', 'well', 'known', 'here']);
  });

  it('joins a word that is cut between two columns, and tells that a column begins in the middle of it', () => {
    const lines: AlignLine[] = [
      { page: 1, col: 0, text: 'the interplay between so-' },
      { page: 1, col: 1, text: 'cial responsibility and' },
    ];
    const read = readPdf(lines, new Set(['the', 'interplay', 'between', 'social', 'responsibility', 'and']));
    expect(read.tokens.map((t) => t.norm)).toEqual(['the', 'interplay', 'between', 'social', 'responsibility', 'and']);
    expect(read.lineStarts[1]).toMatchObject({ cont: true, cutAt: 2, page: 1, col: 1 });
  });

  it('cuts a word the PDF ran together into the words of the paper', () => {
    const vocabulary = new Set(['kỹ', 'thuật', 'số', 'diễn', 'ra', 'từ', '315', 'bảng']);
    expect(splitKnown(normWord('kỹthuật'), vocabulary)).toEqual(['kỹ', 'thuật']);
    expect(splitKnown(normWord('từ315'), vocabulary)).toEqual(['từ', '315']);
    expect(splitKnown(normWord('sốdiễnra'), vocabulary)).toEqual(['số', 'diễn', 'ra']);
    expect(splitKnown(normWord('xyzabc'), vocabulary)).toBeNull();
    const read = readPdf([{ page: 1, col: 0, text: 'kỹthuật sốdiễn bảng' }], vocabulary);
    expect(read.tokens.map((x) => x.norm)).toEqual(['kỹ', 'thuật', 'số', 'diễn', 'bảng']);
  });

  it('crosses words that only one side has and goes on in step', () => {
    const doc = words('a b c d e f g h i j k l m n');
    const pdf = words('a b c d x1 x2 e f g h i j k l m n');
    const map = alignTokens(pdf, doc);
    expect(Array.from(map)).toEqual([0, 1, 2, 3, -1, -1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('does not trust a pair of words that agree by chance', () => {
    const map = alignTokens(words('a b c the end q r s t'), words('a b c w x the end y z'));
    // "the end" is a run of two: not enough
    expect(map[3]).toBe(-1);
    expect(map[4]).toBe(-1);
    expect(map[0]).toBe(0);
  });

  const tok = (norm: string, pos: number, extra: Partial<DocToken> = {}): DocToken => ({ norm, raw: norm, pos, direct: true, blockPos: 0, topPos: 0, topEnd: 1000, frac: 0, atStart: false, ...extra });

  it('finds where each page and each right-hand column starts in the paper', () => {
    const doc = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'].map((w, i) => tok(w, 10 + i * 10, i === 4 ? { atStart: true, blockPos: 48 } : {}));
    const lines: AlignLine[] = [
      { page: 1, col: 0, text: 'one two' },
      { page: 1, col: 1, text: 'three four' },
      { page: 2, col: 0, text: 'five six' },
      { page: 2, col: 1, text: 'seven eight' },
    ];
    const plan = computeBreaks(doc, pdfTokens(lines, new Set(doc.map((d) => d.norm))));
    expect(plan.pageCount).toBe(2);
    expect(plan.breaks).toEqual([
      { kind: 'col', page: 1, pos: 30 }, // "three" starts the right column of page 1, in the middle of a paragraph
      { kind: 'page', page: 2, pos: 48 }, // "five" starts a paragraph: the break goes before it
      { kind: 'col', page: 2, pos: 70 },
    ]);
    expect(plan.oneColumnPages).toEqual([]);
  });

  it('puts a break that falls inside a table before it or after it, by how far in it is', () => {
    const t = (norm: string, frac: number) => tok(norm, 100, { direct: false, topPos: 90, topEnd: 200, frac });
    const doc = [tok('a', 1), tok('b', 2), tok('c', 3), t('x', 0.1), t('y', 0.8), tok('d', 210), tok('e', 211), tok('f', 212)];
    const early = computeBreaks(doc, pdfTokens([{ page: 1, col: 0, text: 'a b c' }, { page: 2, col: 0, text: 'x y d e f' }], new Set()));
    expect(early.breaks.find((b) => b.kind === 'page')!.pos).toBe(90);
    const late = computeBreaks(doc, pdfTokens([{ page: 1, col: 0, text: 'a b c x' }, { page: 2, col: 0, text: 'y d e f' }], new Set()));
    expect(late.breaks.find((b) => b.kind === 'page')!.pos).toBe(200);
  });

  it('finds no break for a page whose words the paper does not have, and reports pages of one column', () => {
    const doc = ['one', 'two', 'three'].map((w, i) => tok(w, i * 10));
    const plan = computeBreaks(doc, pdfTokens([{ page: 1, col: 0, text: 'one two three' }, { page: 2, col: 0, text: 'zzz yyy' }], new Set()));
    expect(plan.breaks).toEqual([]);
    expect(plan.oneColumnPages).toEqual([1, 2]);
  });
});
