import { describe, it, expect } from 'vitest';
import type { PaperSection } from '@/types/paper';
import {
  buildFrontIndex,
  buildSectionIndex,
  matchLineToFrontTab,
  firstNewSectionOnPage,
  firstSectionOnPage,
  groupItemsIntoLines,
  lineAtPoint,
  matchLinesToSection,
  normalizeForMatch,
} from '@/lib/editor/pdf-section-map';

const para = (id: string, content: string, extra: Partial<PaperSection> = {}): PaperSection => ({ id, type: 'paragraph', content, ...extra });
const sections: PaperSection[] = [
  { id: 'h', type: 'h1', title: '1. Giới thiệu', content: '' },
  para('p1', 'Phát triển bền vững là mục tiêu quan trọng của các quốc gia trên thế giới hiện nay.'),
  para('p2', 'Chỉ số đổi mới sáng tạo toàn cầu được dùng để đo lường năng lực đổi mới của từng nền kinh tế.'),
  { id: 't', type: 'table', content: '', table: { id: 't', num: 1, caption: 'Bảng 1. Đo lường các biến', headers: ['Ký hiệu', 'Nội dung'], rows: [['SDG', 'Chỉ số phát triển bền vững']] } as any },
];
const defaults = { oneColumn: false, landscape: false };

describe('PDF text finds its section', () => {
  it('ignores spacing, hyphenation, case and formulas', () => {
    expect(normalizeForMatch('Phát-\ntriển  BỀN vững $x^2$')).toBe('pháttriểnbềnvững');
  });

  it('matches a line of a paragraph, including a broken-up one', () => {
    const idx = buildSectionIndex(sections);
    expect(matchLinesToSection(idx, ['mục tiêu quan trọng của các quốc'], 0)).toBe('p1');
    expect(matchLinesToSection(idx, ['Chỉ số đổi mới sáng tạo toàn cầu được dùng', 'để đo lường năng lực'], 1)).toBe('p2');
  });

  it('a short line (a table cell) is widened with the lines around it', () => {
    const idx = buildSectionIndex(sections);
    expect(matchLinesToSection(idx, ['Ký hiệu', 'Nội dung', 'SDG', 'Chỉ số phát triển bền vững'], 2)).toBe('t');
  });

  it('running headers and page numbers match nothing', () => {
    const idx = buildSectionIndex(sections);
    expect(matchLinesToSection(idx, ['VNUHCM Journal of Science 2026'], 0)).toBeNull();
    expect(firstSectionOnPage(idx, ['12', 'VNUHCM Journal', 'Open Access Full Text Article'], 5)).toBeNull();
  });

  it('the first section on a page is the first line that matches', () => {
    const idx = buildSectionIndex(sections);
    expect(firstSectionOnPage(idx, ['Trang 3', 'Tp. HCM 2026', 'mục tiêu quan trọng của các quốc gia', 'năng lực đổi mới của từng'])).toBe('p1');
  });
});

describe('lines and clicks', () => {
  const items = [
    { str: 'Phát triển ', x: 10, y: 100, width: 50, height: 10 },
    { str: 'bền vững', x: 62, y: 100.5, width: 40, height: 10 },
    { str: 'Dòng hai', x: 10, y: 86, width: 40, height: 10 },
  ];
  it('joins the items of one baseline and finds the line under a point', () => {
    const lines = groupItemsIntoLines(items);
    expect(lines.map((l) => l.text)).toEqual(['Phát triển bền vững', 'Dòng hai']);
    expect(lineAtPoint(items, lines, 70, 103)).toBe(0);
    expect(lineAtPoint(items, lines, 20, 88)).toBe(1);
  });
});

describe('the section that starts a page', () => {
  it('skips a section that only runs over from the previous page', () => {
    const idx = buildSectionIndex(sections);
    const prev = ['Phát triển bền vững là mục tiêu quan trọng của các quốc gia'];
    const page = ['Phát triển bền vững là mục tiêu quan trọng của các quốc gia', 'Chỉ số đổi mới sáng tạo toàn cầu được dùng'];
    expect(firstNewSectionOnPage(idx, page, prev)).toBe('p2');
    expect(firstNewSectionOnPage(idx, page, null)).toBe('p1');
  });

  it('falls back to the first match when everything on the page is a continuation', () => {
    const idx = buildSectionIndex(sections);
    const same = ['Phát triển bền vững là mục tiêu quan trọng của các quốc gia'];
    expect(firstNewSectionOnPage(idx, same, same)).toBe('p1');
  });
});

describe('a sentence that appears in two sections', () => {
  it('the text that follows picks the right one', () => {
    const twin: PaperSection[] = [
      para('summary', 'Dựa trên lý thuyết bộ ba cốt lõi bền vững, nghiên cứu tóm tắt kết quả chính.'),
      para('body', 'Dựa trên lý thuyết bộ ba cốt lõi bền vững, của Elkington, các yếu tố kinh tế xã hội môi trường được xem xét.'),
    ];
    const idx = buildSectionIndex(twin);
    expect(matchLinesToSection(idx, ['Dựa trên lý thuyết bộ ba cốt lõi bền vững', 'của Elkington, các yếu tố kinh tế'], 0)).toBe('body');
    expect(matchLinesToSection(idx, ['Dựa trên lý thuyết bộ ba cốt lõi bền vững,', 'nghiên cứu tóm tắt kết quả chính.'], 0)).toBe('summary');
  });
});

describe('a page that starts with a running header', () => {
  it('the header is not widened into the next line and matched to some other section', () => {
    const twin: PaperSection[] = [
      para('early', 'Khung lý thuyết bộ ba cốt lõi bền vững do Elkington đề xuất được dùng rộng rãi trong nghiên cứu.'),
      para('later', 'Dựa trên lý thuyết bộ ba cốt lõi bền vững của Elkington, nghiên cứu phân tích ba trụ cột.'),
    ];
    const idx = buildSectionIndex(twin);
    const page = ['VNUHCM Journal of Science and Technology Development 2026, ?(?):?-?', 'Dựa trên lý thuyết bộ ba cốt lõi bền vững', 'của Elkington, nghiên cứu phân tích'];
    expect(firstSectionOnPage(idx, page)).toBe('later');
    expect(matchLinesToSection(idx, page, 0)).toBeNull();
  });
});

describe('title, abstract, authors and references have tabs of their own', () => {
  const md: any = {
    title: 'Các yếu tố tác động đến thực hiện mục tiêu phát triển bền vững',
    abstract: 'Bài viết nhằm xác định và so sánh các yếu tố ảnh hưởng đến thực hiện Mục tiêu Phát triển Bền vững.',
    keywords: ['Phát triển bền vững', 'tăng trưởng kinh tế'],
    authors: [{ name: 'Phạm Mỹ Duyên' }],
    affiliations: [{ name: 'Trường Đại học Kinh tế - Luật, Đại học Quốc gia TP.HCM' }],
  };
  const refs: any[] = [{ id: 1, raw: 'Brundtland G.H. Our common future. Oxford University Press; 1987.' }];
  const idx = buildFrontIndex(md, refs);

  it('finds the tab of a line', () => {
    expect(matchLineToFrontTab(idx, 'Bài viết nhằm xác định và so sánh các yếu tố')).toBe('abstract');
    expect(matchLineToFrontTab(idx, 'Các yếu tố tác động đến thực hiện mục tiêu')).toBe('metadata');
    expect(matchLineToFrontTab(idx, 'Phạm Mỹ Duyên')).toBe('authors');
    expect(matchLineToFrontTab(idx, 'Brundtland G.H. Our common future.')).toBe('refs');
    expect(matchLineToFrontTab(idx, 'Ngày nhận: 08-09-2025')).toBeNull();
  });
});
