import { describe, it, expect } from 'vitest';
import { affiliationToEnglish, affiliationEnglish } from '@/lib/affiliation-en';
import { linkFigureTableMentions } from '@/lib/latex-template';
import { escapeWithLinks, referenceLatex } from '@/lib/reference-format';
import { escapeLatex } from '@/lib/latex-escape';

describe('affiliation on the English page', () => {
  it('translates a Vietnamese line into English words', () => {
    expect(affiliationToEnglish('Khoa Kỹ thuật Xây dựng, Trường Đại học Bách khoa, ĐHQG-HCM')).toBe(
      'Faculty of Civil Engineering, Ho Chi Minh City University of Technology (HCMUT), Vietnam National University Ho Chi Minh City'
    );
    expect(affiliationToEnglish('Viện Môi trường, Việt Nam')).toBe('Institute of Environment, Vietnam');
  });
  it('keeps the author’s English name, translates only when it is missing or still Vietnamese', () => {
    expect(affiliationEnglish({ name: 'Khoa Hóa học', nameEn: 'Faculty of Chemistry, HCMUS' })).toBe('Faculty of Chemistry, HCMUS');
    expect(affiliationEnglish({ name: 'Khoa Hóa học' })).toBe('Faculty of Chemistry');
    expect(affiliationEnglish({ name: 'Khoa Hóa học', nameEn: 'Khoa Hóa học' })).toBe('Faculty of Chemistry');
  });
});

describe('Hình / Bảng mentions', () => {
  const f = new Set([1, 2]);
  const t = new Set([1]);
  it('link to the figure or table', () => {
    expect(linkFigureTableMentions('xem Hình 1 và Bảng 1.', f, t)).toBe('xem Hình \\hyperref[figure-1]{1} và Bảng \\hyperref[tab:1]{1}.');
  });
  it('link every number of a list that exists and leave others plain', () => {
    expect(linkFigureTableMentions('Hình 1, 2 và 5', f, t)).toBe('Hình \\hyperref[figure-1]{1}, \\hyperref[figure-2]{2} và 5');
  });
  it('leave a mention with no target alone', () => {
    expect(linkFigureTableMentions('Bảng 3', f, t)).toBe('Bảng 3');
  });
});

describe('references with long links', () => {
  it('sets a web address as a breakable link', () => {
    const out = escapeWithLinks('Google Scholar. Available from: https://scholar.google.com/scholar?hl=vi&as_sdt=0%2C5&q=a_b.', escapeLatex);
    expect(out).toContain('\\url{https://scholar.google.com/scholar?hl=vi&as_sdt=0%2C5&q=a_b}.');
  });
  it('keeps the DOI link as before', () => {
    expect(referenceLatex({ raw: 'Smith J. Title. 2020', doi: '10.1234/x' }, escapeLatex)).toContain('\\url{https://doi.org/10.1234/x}');
  });
});
