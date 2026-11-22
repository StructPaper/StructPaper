import { describe, it, expect } from 'vitest';
import { choosePlacement } from '@/lib/table-placement';
import { superscriptToCitation } from '@/lib/docx-richtext';
import { bracketCitation, generateFullJournalLatex } from '@/lib/latex-template';
import { createEmptyPaper } from '@/types/paper';

const rows = (n: number, cell: (r: number, c: number) => string, cols: number) => Array.from({ length: n }, (_, r) => Array.from({ length: cols }, (_x, c) => cell(r, c)));

describe('where a table goes is worked out from its size', () => {
  it('a small table of numbers stays in one column', () => {
    const t = { headers: ['Mẫu', 'pH', 'COD'], rows: rows(5, (r, c) => (c === 0 ? `M${r}` : '7,2'), 3) };
    expect(choosePlacement(t).columnSpan).toBe('1-column');
  });
  it('a table with sentences, or many columns, spans both columns', () => {
    const text = { headers: ['Nghiên cứu', 'Phạm vi áp dụng'], rows: rows(4, (_r, c) => (c === 0 ? 'Yoon et al. (2008)' : 'BE dài 3-5 mm, đất nạo vét và đất sét mềm, độ sâu khảo sát 30 m, khoảng cách mũi đầu dò 50 mm, thí nghiệm hiện trường'), 2) };
    expect(choosePlacement(text).columnSpan).toBe('2-column');
    const wide = { headers: Array.from({ length: 9 }, (_, i) => `HI${i}`), rows: rows(6, () => '0,22', 9) };
    expect(choosePlacement(wide)).toMatchObject({ columnSpan: '2-column', rotated: false });
  });
  it('a table too wide for the page is turned only when it is short', () => {
    const word = 'Quản_lý_chất_lượng_nước_thải_công_nghiệp'; // one 40-character word per cell
    const wide = { headers: Array.from({ length: 12 }, (_, i) => word + i), rows: rows(5, () => word, 12) };
    expect(choosePlacement(wide).rotated).toBe(true);
  });
  it('a table wider than the page is turned however long it is; the type size is not reduced', () => {
    const wide = { headers: Array.from({ length: 9 }, (_, i) => `Cột${i}`), rows: rows(200, () => 'Hiểm_họa1', 9) };
    const p = choosePlacement(wide);
    expect(p.rotated).toBe(true);
    expect(p.fontSize).toBeUndefined();
  });
});

describe('citations in a row', () => {
  it('a superscript of reference numbers becomes a citation; "m²" stays an exponent', () => {
    expect(superscriptToCitation('16–18', 30, 'đã chứng minh')).toBe('[16,17,18]');
    expect(superscriptToCitation('10,11', 30, 'kết quả')).toBe('[10,11]');
    expect(superscriptToCitation('2', 30, 'diện tích 5 m')).toBeNull();
    expect(superscriptToCitation('45', 30, 'kết quả')).toBeNull();
  });
  it('a bracket list becomes one citation of all the references', () => {
    expect(bracketCitation('16–18')).toBe('\\unskip~\\cite{ref16,ref17,ref18}');
    expect(bracketCitation('15; 19-20')).toBe('\\unskip~\\cite{ref15,ref19,ref20}');
    expect(bracketCitation('10,11')).toBe('\\unskip~\\cite{ref10,ref11}');
  });
});

describe('the page number', () => {
  it('is drawn at the same distance from the bottom on every page', () => {
    const tex = generateFullJournalLatex(createEmptyPaper());
    expect(tex).toContain('\\AddToShipoutPictureFG');
    expect(tex).toMatch(/\\put\([^)]*,29\.4\)/);
  });

  it('is low on the right on the closing summary page too, set like the first page, so it does not run into the "how to cite" strip', () => {
    const p = createEmptyPaper();
    p.metadata.titleEn = 'An English title';
    p.metadata.abstractEn = 'An English abstract of the paper.';
    const tex = generateFullJournalLatex(p);
    // the page marks itself, and the number is placed by that mark as it is on page 1
    expect(tex).toContain('\\csname ovlowpage\\thepage\\endcsname{}');
    expect(tex).toMatch(/\\ifcsname ovlowpage\\thepage\\endcsname\\put\([^)]*,29\.4\)/);
  });
});

import { bracketCitation as bc } from '@/lib/latex-template';
describe('citations separated by a comma', () => {
  it('are one citation', () => {
    expect(bc('15,16–18,19,20')).toBe('\\unskip~\\cite{ref15,ref16,ref17,ref18,ref19,ref20}');
  });
});

import { citesInParentheses } from '@/lib/latex-template';
describe('a paper that cites with parentheses and has a stray bracket', () => {
  it('still cites with parentheses (ARNS: "(6-8)", "(8, 9)" and one "[49]")', () => {
    const texts = ['silica gel (6–8) hay sắt từ oxide (8, 9) hay polymer (6, 7, 9, 10). Xem [49].'];
    expect(citesInParentheses(texts, 56)).toBe(true);
    expect(citesInParentheses(['như [1], [2] và (3)'], 56)).toBe(false);
    expect(citesInParentheses(texts, 0)).toBe(false);
  });
});

describe('citations written with nothing between them', () => {
  it('"[6][7][8]" and "[6]–[8]" print as one citation like "6–8"', async () => {
    const { generateFullJournalLatex } = await import('@/lib/latex-template');
    const { createEmptyPaper } = await import('@/types/paper');
    const p: any = createEmptyPaper();
    p.references = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => ({ id, raw: `Ref ${id}`, isCited: true }));
    p.sections = [{ id: 'a', type: 'paragraph', content: 'Research [6][7][8] has grown, and [6] [7] too, and [6]–[8] again, and [2], [5].' }];
    const tex = generateFullJournalLatex(p);
    expect(tex).toContain('\\cite{ref6,ref7,ref8}');
    expect(tex).toContain('\\cite{ref6,ref7}');
    expect(tex).toContain('\\cite{ref2,ref5}');
    expect(tex).not.toContain('\\cite{ref6}\\');
  });
  it('a superscript "6 7 8" is a list too', async () => {
    const { superscriptToCitation } = await import('@/lib/docx-richtext');
    expect(superscriptToCitation('6 7 8', 30, 'research')).toBe('[6,7,8]');
  });
});
