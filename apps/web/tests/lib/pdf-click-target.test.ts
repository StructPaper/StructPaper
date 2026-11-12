import { describe, it, expect } from 'vitest';
import type { PaperSection } from '@/types/paper';
import { buildSectionIndex, groupItemsIntoLines } from '@/lib/editor/pdf-section-map';
import { equationIndex, extendRotatedRange, lineForClick, pageFill, resolveClick } from '@/lib/editor/pdf-click-target';

const para = (id: string, content: string, extra: Partial<PaperSection> = {}): PaperSection => ({ id, type: 'paragraph', content, ...extra });
const eq = (id: string, num: number): PaperSection => ({ id, type: 'equation', content: '', equation: { latex: 'a=b', numbered: true, num } as any });

describe('any element of the page opens its card', () => {
  const sections: PaperSection[] = [
    para('p1', 'Mô hình hồi quy được ước lượng bằng phương pháp bình phương nhỏ nhất tổng quát khả thi.'),
    eq('e3', 3),
    eq('e4', 4),
    para('p2', 'Kết quả cho thấy phát triển con người là động lực chính thúc đẩy các mục tiêu.'),
  ];
  const index = buildSectionIndex(sections);
  const equations = equationIndex(sections);

  it('a formula line resolves to its equation through the number printed beside it', () => {
    const lines = ['Mô hình hồi quy được ước lượng bằng phương pháp bình', 'y = β0 + β1x', '(3)', 'trong đó y là biến phụ thuộc'];
    expect(resolveClick(index, equations, lines, 1)).toBe('e3');
    expect(resolveClick(index, equations, lines, 2)).toBe('e3');
  });

  it('a long text line is never taken for a formula, even when it ends with a number in brackets', () => {
    const lines = ['Kết quả cho thấy phát triển con người là động lực chính thúc đẩy (4)'];
    expect(resolveClick(index, equations, lines, 0)).toBe('p2');
  });

  it('an unnumbered or unknown equation label does not resolve to an equation', () => {
    expect(resolveClick(index, equations, ['y = x', '(9)'], 0)).toBeNull();
  });
});

describe('a click that is not on text', () => {
  const item = (str: string, x: number, y: number, width = 60) => ({ str, x, y, width, height: 10 });
  const items = [
    item('Đoạn văn phía trên hình', 50, 700, 150),
    item('Hình 1. Biểu đồ so sánh các nhóm', 50, 400, 180),
    item('Bảng 2. Đo lường các biến', 50, 250, 150),
  ];
  const lines = groupItemsIntoLines(items);

  it('on text it is the line under the pointer', () => {
    expect(lineForClick(items, lines, 80, 702)).toBe(0);
  });

  it('on a picture it is the caption just below it', () => {
    expect(lineForClick(items, lines, 100, 520)).toBe(1);
  });

  it('far from every caption it falls back to the nearest line', () => {
    expect(lineForClick(items, lines, 100, 680, 20)).toBe(0);
  });
});

describe('a page cut short by an orientation change', () => {
  const body = (ys: number[], w = 842, h = 595) => ys.map((y) => ({ str: 'x', x: 100, y, width: 40, height: 10 })).concat([{ str: '3', x: 80, y: 20, width: 5, height: 8 }]);

  it('is mostly empty when the text stops high, full when it reaches the bottom', () => {
    expect(pageFill(body([540, 530, 520]), 842, 595)).toBeLessThan(0.15);
    expect(pageFill(body([540, 300, 80]), 842, 595)).toBeGreaterThan(0.85);
  });

  it('ignores the running header at the page edge and the page number', () => {
    const items = [...body([540, 530]), { str: 'VNUHCM', x: 800, y: 60, width: 10, height: 8 }];
    expect(pageFill(items, 842, 595)).toBeLessThan(0.15);
  });

  it('an empty page counts as empty', () => {
    expect(pageFill([], 842, 595)).toBe(0);
  });
});

describe('filling a cut short page', () => {
  const marker = { orientation: 'portrait' as const };
  const src = [para('a', 'A'), para('b', 'B', { pageLayout: marker }), para('c', 'C'), para('d', 'D')];

  it('moves the marker that starts the next page one section on', () => {
    const out = extendRotatedRange(src, 'b');
    expect('pageLayout' in out.find((s) => s.id === 'b')!).toBe(false);
    expect(out.find((s) => s.id === 'c')!.pageLayout).toEqual(marker);
    expect(out.find((s) => s.id === 'd')!.pageLayout).toBeUndefined();
  });

  it('does nothing without a marker or a following section', () => {
    expect(extendRotatedRange(src, 'a')).toBe(src);
    expect(extendRotatedRange([para('z', 'Z', { pageLayout: marker })], 'z')).toEqual([para('z', 'Z', { pageLayout: marker })]);
  });

  it('keeps a marker the following section already has', () => {
    const own = { orientation: 'landscape' as const };
    const out = extendRotatedRange([para('b', 'B', { pageLayout: marker }), para('c', 'C', { pageLayout: own })], 'b');
    expect(out[1].pageLayout).toEqual(own);
    expect('pageLayout' in out[0]).toBe(false);
  });
});
