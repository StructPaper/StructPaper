import { describe, it, expect } from 'vitest';
import { tableSettingChips, figureSettingChips } from '@/features/editor/components/sections/BlockSettingChips';

const labels = (chips: { label: string }[]) => chips.map((c) => c.label);

describe('the settings shown on a table block', () => {
  it('says columns, orientation, type size and fill even for the defaults', () => {
    expect(labels(tableSettingChips({} as any))).toEqual(['2 cột', 'Hướng dọc', 'Chữ 8pt', 'Nền trơn']);
  });

  it('shows what the author changed: one column, rotated, size, fill, placement, page breaks', () => {
    const chips = tableSettingChips({ columnSpan: '1-column', isRotated: true, fontSize: '10pt', bodyFill: 'zebra', placement: 'top', breakAcrossPages: 'never' } as any);
    expect(labels(chips)).toEqual(['1 cột', 'Hướng ngang (xoay 90°)', 'Chữ 10pt', 'Nền sọc', 'Đầu trang', 'Không ngắt trang']);
    expect(chips.find((c) => c.key === 'orientation')?.accent).toBe(true);
  });

  it('an old table that was not full width is one column', () => {
    expect(labels(tableSettingChips({ isFullWidth: false } as any))[0]).toBe('1 cột');
  });
});

describe('the settings shown on a figure block', () => {
  it('says columns, size and border; extra chips only for what was changed', () => {
    expect(labels(figureSettingChips({} as any))).toEqual(['2 cột', 'Kích thước 100%', 'Có viền']);
    expect(labels(figureSettingChips({ columnSpan: '1-column', scalePercent: 60, alignment: 'left', hasBorder: false, placement: 'bottom' } as any))).toEqual([
      '1 cột',
      'Kích thước 60%',
      'Căn trái',
      'Không viền',
      'Cuối trang',
    ]);
  });
});
