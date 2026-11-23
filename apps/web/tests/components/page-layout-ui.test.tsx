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
        const C = React.forwardRef<HTMLElement, Record<string, unknown>>(({ children, ...props }, ref) => {
          const El = prop as unknown as React.ElementType;
          const p = { ...props };
          ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layoutId'].forEach((k) => delete p[k]);
          return (
            <El ref={ref} {...p}>
              {children as React.ReactNode}
            </El>
          );
        });
        C.displayName = `Motion_${prop}`;
        return C;
      },
    }),
  };
});

import { EquationSectionItem } from '@/features/editor/components/sections/EquationSectionItem';
import { PageLayoutControl } from '@/features/editor/components/sections/PageLayoutControl';
import { SectionCardHeader } from '@/features/editor/components/sections/SectionCardHeader';
import { LayoutSettingsDrawer } from '@/features/editor';
import { DEFAULT_LAYOUT_SETTINGS } from '@/types/paper';
import type { PaperSection } from '@/types/paper';

afterEach(cleanup);

const eqSection = (extra: Partial<PaperSection> = {}): PaperSection => ({
  id: 's1',
  type: 'equation',
  content: 'a=b',
  equation: { latex: 'a=b', numbered: true, num: 1 },
  ...extra,
});

describe('EquationSectionItem', () => {
  it('has no column setting: a formula follows the layout of the paper', () => {
    render(<EquationSectionItem sec={eqSection()} idx={3} onUpdateSection={vi.fn()} />);
    expect(screen.queryByTestId('equation-span')).toBeNull();
    expect(screen.queryByTestId('equation-span-1')).toBeNull();
    expect(screen.queryByTestId('equation-span-2')).toBeNull();
  });
});

describe('PageLayoutControl', () => {
  it('sets and clears section.pageLayout', () => {
    const onUpdate = vi.fn();
    const sec: PaperSection = { id: 'p1', type: 'paragraph', content: 'x' };
    const { rerender } = render(<PageLayoutControl sec={sec} idx={2} onUpdateSection={onUpdate} />);
    fireEvent.click(screen.getByTestId('page-layout-button'));
    fireEvent.click(screen.getByTestId('page-layout-toggle'));
    expect(onUpdate).toHaveBeenLastCalledWith(2, { ...sec, pageLayout: {} });

    const withMarker: PaperSection = { ...sec, pageLayout: {} };
    rerender(<PageLayoutControl sec={withMarker} idx={2} onUpdateSection={onUpdate} />);
    fireEvent.click(screen.getByTestId('page-layout-cols-2'));
    expect(onUpdate.mock.calls.at(-1)![1].pageLayout).toEqual({ columns: '2-column' });

    const both: PaperSection = { ...sec, pageLayout: { columns: '2-column' } };
    rerender(<PageLayoutControl sec={both} idx={2} onUpdateSection={onUpdate} />);
    fireEvent.click(screen.getByTestId('page-layout-orient-landscape'));
    expect(onUpdate.mock.calls.at(-1)![1].pageLayout).toEqual({ columns: '2-column', orientation: 'landscape' });

    // back to "Mặc định tài liệu" on columns keeps the other field
    const full: PaperSection = { ...sec, pageLayout: { columns: '2-column', orientation: 'landscape' } };
    rerender(<PageLayoutControl sec={full} idx={2} onUpdateSection={onUpdate} />);
    fireEvent.click(screen.getByTestId('page-layout-cols-default'));
    expect(onUpdate.mock.calls.at(-1)![1].pageLayout).toEqual({ orientation: 'landscape' });

    // toggle off removes the key entirely
    fireEvent.click(screen.getByTestId('page-layout-toggle'));
    const cleared = onUpdate.mock.calls.at(-1)![1];
    expect('pageLayout' in cleared).toBe(false);
  });

  it('does not show options when no marker is set', () => {
    const sec: PaperSection = { id: 'p1', type: 'paragraph', content: 'x' };
    render(<PageLayoutControl sec={sec} idx={0} onUpdateSection={vi.fn()} />);
    fireEvent.click(screen.getByTestId('page-layout-button'));
    expect(screen.queryByTestId('page-layout-cols-1')).toBeNull();
  });
});

describe('SectionCardHeader page layout badge', () => {
  const baseProps = {
    idx: 0,
    totalSections: 1,
    isDeleting: false,
    onUpdateSection: vi.fn(),
    onRemoveSection: vi.fn(),
    onMoveUp: vi.fn(),
    onMoveDown: vi.fn(),
    onConvertToHeading: vi.fn(),
    onConvertToParagraph: vi.fn(),
    onOpenTableZoom: vi.fn(),
    activeSettings: null,
    onOpenFigureSettings: vi.fn(),
    onOpenTableSettings: vi.fn(),
    onCloseSettings: vi.fn(),
    onSaveFigureSettings: vi.fn(),
    onSaveTableSettings: vi.fn(),
  };

  it('shows no badge without a marker', () => {
    render(<SectionCardHeader {...baseProps} sec={{ id: 'a', type: 'paragraph', content: '' }} />);
    expect(screen.queryByTestId('page-layout-badge')).toBeNull();
    // the page layout is not set from a block's card any more (no button on any kind of block)
    expect(screen.queryByTestId('page-layout-button')).toBeNull();
  });

  it('shows the badge summary when a marker is set', () => {
    const sec: PaperSection = {
      id: 'a',
      type: 'h1',
      content: 'T',
      pageLayout: { columns: '1-column', orientation: 'landscape' },
    };
    render(<SectionCardHeader {...baseProps} sec={sec} />);
    expect(screen.getByTestId('page-layout-badge').textContent).toBe('Trang mới · 1 cột · Ngang');
  });
});

describe('LayoutSettingsDrawer orientation', () => {
  it('applies the chosen orientation with the other settings', () => {
    const onApply = vi.fn();
    render(
      <LayoutSettingsDrawer
        isOpen
        onClose={vi.fn()}
        settings={DEFAULT_LAYOUT_SETTINGS}
        onApplySettings={onApply}
      />
    );
    expect(screen.getByTestId('orientation-portrait').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByTestId('orientation-landscape'));
    expect(screen.getByTestId('orientation-landscape').getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByText('Áp dụng & Biên dịch PDF'));
    expect(onApply).toHaveBeenCalledTimes(1);
    const applied = onApply.mock.calls[0][0];
    expect(applied.orientation).toBe('landscape');
    expect(applied.columnLayout).toBe('2-column');
  });

  it('keeps the choice when the editor re-renders and hands over an equal copy of the settings', () => {
    const el = (s: typeof DEFAULT_LAYOUT_SETTINGS) => <LayoutSettingsDrawer isOpen onClose={vi.fn()} settings={s} onApplySettings={vi.fn()} />;
    const { rerender } = render(el({ ...DEFAULT_LAYOUT_SETTINGS }));
    fireEvent.click(screen.getByTestId('orientation-landscape'));
    rerender(el({ ...DEFAULT_LAYOUT_SETTINGS }));
    expect(screen.getByTestId('orientation-landscape').getAttribute('aria-checked')).toBe('true');
  });
});
