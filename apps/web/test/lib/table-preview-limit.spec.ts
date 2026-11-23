import { describe, it, expect } from 'vitest';
import { previewRowLimit } from '@/features/editor/components/sections/TablePreviewGrid';

const short = (n: number) => Array.from({ length: n }, (_, i) => [`a${i}`, `b${i}`]);

describe('how many rows of a table the card previews', () => {
  it('shows ten short rows at most', () => {
    expect(previewRowLimit(short(30), 2)).toBe(10);
    expect(previewRowLimit(short(4), 2)).toBe(4);
  });

  it('shows fewer when the rows are tall (a few long cells fill the height as ten short rows do)', () => {
    const tall = Array.from({ length: 10 }, () => ['x'.repeat(900), 'y']);
    const n = previewRowLimit(tall, 2);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThan(10);
  });

  it('always shows the first row, however tall, and nothing for an empty table', () => {
    expect(previewRowLimit([['z'.repeat(20000)]], 1)).toBe(1);
    expect(previewRowLimit([], 3)).toBe(0);
  });
});
