// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(actual.motion as Record<string, unknown>, {
      get: (_t, prop: string) => {
        const C = React.forwardRef<HTMLElement, any>(({ children, ...props }, ref) => {
          const El = prop as unknown as React.ElementType;
          for (const k of ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layoutId']) delete props[k];
          return <El ref={ref} {...props}>{children}</El>;
        });
        C.displayName = `Motion_${prop}`;
        return C;
      },
    }),
  };
});

import { SectionsTab } from '@/features/editor';
import { matchesSectionFilter } from '@/lib/editor/section-filter';
import type { PaperSection } from '@/types/paper';

afterEach(cleanup);

const sections: PaperSection[] = [
  { id: 'h', type: 'h1', title: 'Phương pháp', content: '' },
  { id: 'p', type: 'paragraph', content: 'Đoạn văn mẫu về mô hình' },
  { id: 'e1', type: 'equation', content: '', equation: { latex: 'a=b+c', numbered: true, num: 1 } },
  { id: 'e2', type: 'equation', content: '', equation: { latex: 'x=y', numbered: true, num: 2 } },
  { id: 'c', type: 'citation', title: 'Trích dẫn', content: 'Trích dẫn bài báo này' },
];

const meta: any = { title: 'T', authors: [], affiliations: [], keywords: [], dates: {} };

describe('equation filter chip', () => {
  it('counts formulas, and the chips add up to "Tất cả" (citations are not listed)', () => {
    render(<SectionsTab sections={sections} onChange={vi.fn()} metadata={meta} references={[]} />);
    expect(screen.getByText(/Tất cả \(4\)/)).toBeDefined();
    expect(screen.getByText(/Tiêu đề \(1\)/)).toBeDefined();
    expect(screen.getByText(/Đoạn văn \(1\)/)).toBeDefined();
    expect(screen.getByText(/Bảng \(0\)/)).toBeDefined();
    expect(screen.getByText(/Hình \(0\)/)).toBeDefined();
    expect(screen.getByTestId('filter-equation').textContent).toContain('(2)'); // 1 + 1 + 0 + 0 + 2 = 4
  });

  it('shows only the formulas when the chip is selected, and everything again on "Tất cả"', () => {
    render(<SectionsTab sections={sections} onChange={vi.fn()} metadata={meta} references={[]} />);
    fireEvent.click(screen.getByTestId('filter-equation'));
    expect(screen.getAllByTestId('equation-item')).toHaveLength(2);
    expect(screen.queryByDisplayValue('Phương pháp')).toBeNull();
    expect(screen.queryByText(/Đoạn văn mẫu/)).toBeNull();
    fireEvent.click(screen.getByText(/Tất cả \(4\)/));
    expect(screen.getAllByTestId('equation-item')).toHaveLength(2);
    expect(screen.getByDisplayValue('Phương pháp')).toBeDefined();
  });

  it('the count follows an added formula', () => {
    const { rerender } = render(<SectionsTab sections={sections} onChange={vi.fn()} metadata={meta} references={[]} />);
    rerender(
      <SectionsTab
        sections={[...sections, { id: 'e3', type: 'equation', content: '', equation: { latex: 'z=1', numbered: true } }]}
        onChange={vi.fn()}
        metadata={meta}
        references={[]}
      />
    );
    expect(screen.getByTestId('filter-equation').textContent).toContain('(3)');
    expect(screen.getByText(/Tất cả \(5\)/)).toBeDefined();
  });
});

describe('matchesSectionFilter', () => {
  it.each([
    ['all', ['h', 'p', 'e1', 'e2']],
    ['heading', ['h']],
    ['paragraph', ['p']],
    ['equation', ['e1', 'e2']],
    ['table', []],
    ['figure', []],
  ] as const)('%s', (filter, ids) => {
    expect(sections.filter((s) => matchesSectionFilter(s, filter)).map((s) => s.id)).toEqual(ids);
  });
});
