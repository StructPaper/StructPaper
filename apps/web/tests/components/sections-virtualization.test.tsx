// @vitest-environment happy-dom

import 'fake-indexeddb/auto';
import React, { useState, useCallback } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup } from '@testing-library/react';
import { createEmptyPaper, type CompletePaper, type PaperSection } from '@/types/paper';
import * as docxExtractor from '@/lib/docx-extractor';

const { headerRenderCounts } = vi.hoisted(() => ({
  headerRenderCounts: new Map<string, number>(),
}));

vi.mock('framer-motion', () => {
  const stripMotionProps = (props: Record<string, unknown>) => {
    const clean: Record<string, unknown> = {};
    const motionKeys = new Set([
      'initial',
      'animate',
      'exit',
      'transition',
      'variants',
      'layout',
      'layoutId',
      'whileHover',
      'whileTap',
      'whileFocus',
      'whileInView',
      'viewport',
    ]);
    for (const [k, v] of Object.entries(props)) {
      if (!motionKeys.has(k)) clean[k] = v;
    }
    return clean;
  };

  const MotionDiv = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ children, ...props }, ref) => (
      <div ref={ref} {...(stripMotionProps(props) as React.HTMLAttributes<HTMLDivElement>)}>
        {children}
      </div>
    )
  );
  MotionDiv.displayName = 'MotionDiv';

  const MotionSpan = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
    ({ children, ...props }, ref) => (
      <span ref={ref} {...(stripMotionProps(props) as React.HTMLAttributes<HTMLSpanElement>)}>
        {children}
      </span>
    )
  );
  MotionSpan.displayName = 'MotionSpan';

  return {
    motion: new Proxy(
      { div: MotionDiv, span: MotionSpan },
      {
        get(target, prop) {
          if (prop in target) return target[prop as keyof typeof target];
          return MotionDiv;
        },
      }
    ),
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/editor',
}));

vi.mock('@/components/editor/sections/SectionHeaderCard', async () => {
  const actual = await vi.importActual<
    typeof import('@/components/editor/sections/SectionHeaderCard')
  >('@/components/editor/sections/SectionHeaderCard');
  const ActualSectionHeaderCard = actual.SectionHeaderCard;

  const TrackedSectionHeaderCard: React.FC<
    React.ComponentProps<typeof ActualSectionHeaderCard>
  > = (props) => {
    const id = props.sec.id || `sec_${props.idx}`;
    headerRenderCounts.set(id, (headerRenderCounts.get(id) ?? 0) + 1);
    return <ActualSectionHeaderCard {...props} />;
  };

  return {
    ...actual,
    SectionHeaderCard: TrackedSectionHeaderCard,
  };
});

import { SectionsTab, UnifiedEditorView } from '@/components/editor';
import { ParagraphSectionItem } from '@/components/editor/sections/ParagraphSectionItem';
import { estimateSectionHeight } from '@/components/editor/sections/useSectionVirtualizer';
import { PaperProvider } from '@/context/PaperContext';

function createMixedSections(count: number): PaperSection[] {
  const sections: PaperSection[] = [];
  for (let i = 0; i < count; i++) {
    const mod = i % 5;
    if (mod === 0) {
      sections.push({
        id: `sec-${i}`,
        type: i % 10 === 0 ? 'h1' : 'h2',
        title: `Tiêu đề mục ${i}`,
        content: '',
      });
    } else if (mod === 1 || mod === 2) {
      sections.push({
        id: `sec-${i}`,
        type: 'paragraph',
        content: `Nội dung đoạn văn bản số ${i} phục vụ kiểm thử ảo hóa.`,
      });
    } else if (mod === 3) {
      sections.push({
        id: `sec-${i}`,
        type: 'table',
        content: '',
        table: {
          id: `tbl-${i}`,
          num: Math.floor(i / 5) + 1,
          caption: `Bảng số liệu ${i}`,
          headers: ['Cột A', 'Cột B'],
          rows: [['1', '2']],
        },
      });
    } else {
      sections.push({
        id: `sec-${i}`,
        type: 'figure',
        content: '',
        figure: {
          id: `fig-${i}`,
          num: Math.floor(i / 5) + 1,
          caption: `Biểu đồ minh họa ${i}`,
          src: '',
        },
      });
    }
  }
  return sections;
}

const ControlledSectionsTab: React.FC<{
  initialSections: PaperSection[];
  onSectionsUpdated?: (next: PaperSection[]) => void;
}> = ({ initialSections, onSectionsUpdated }) => {
  const [sections, setSections] = useState<PaperSection[]>(initialSections);
  const handleChange = useCallback(
    (updated: PaperSection[]) => {
      setSections(updated);
      onSectionsUpdated?.(updated);
    },
    [onSectionsUpdated]
  );

  return <SectionsTab sections={sections} onChange={handleChange} />;
};

describe('SectionsTab virtualization, memoization & performance (Task 3)', () => {
  beforeEach(() => {
    headerRenderCounts.clear();
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
        text: async () => '',
      })
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('virtualizes 150 mixed sections, preserves counts, and estimates heights accurately', () => {
    expect(estimateSectionHeight({ id: 'h1', type: 'h1', content: '' })).toBe(120);
    expect(estimateSectionHeight({ id: 'h2', type: 'h2', content: '' })).toBe(120);
    expect(estimateSectionHeight({ id: 'p', type: 'paragraph', content: '' })).toBe(180);
    expect(estimateSectionHeight({ id: 't', type: 'table', content: '' })).toBe(260);
    expect(estimateSectionHeight({ id: 'f', type: 'figure', content: '' })).toBe(300);

    // 150 sections with pattern 5 -> 30 headings, 60 paragraphs, 30 tables, 30 figures
    const sections = createMixedSections(150);
    const { container } = render(
      <ControlledSectionsTab initialSections={sections} />
    );

    expect(screen.getByText(/Nội dung bài báo \(150\)/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tất cả (150)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tiêu đề (30)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đoạn văn (60)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bảng (30)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hình (30)' })).toBeTruthy();

    const mountedCards = container.querySelectorAll('[id^="section-card-"]');
    expect(mountedCards.length).toBeGreaterThan(0);
    expect(mountedCards.length).toBeLessThan(30);
    expect(container.querySelector('#section-card-sec-0')).toBeTruthy();
    expect(container.querySelector('#section-card-sec-149')).toBeNull();

    // Verify Fix #1/#2: virtualized scroll container omits scroll-smooth & space-y-2, non-last row uses pb-2 (8px parity)
    const virtualRow0 = container.querySelector('[data-index="0"]') as HTMLElement;
    const scrollContainer = virtualRow0?.parentElement?.parentElement as HTMLElement;
    expect(virtualRow0.className).toContain('pb-2');
    expect(scrollContainer.className).not.toContain('scroll-smooth');
    expect(scrollContainer.className).not.toContain('space-y-2');
  });

  it('scrolls to and mounts newly added end section cleanly and handles filter switching', async () => {
    const sections = createMixedSections(150);
    let latestSections = sections;
    const { container } = render(
      <ControlledSectionsTab
        initialSections={sections}
        onSectionsUpdated={(next) => {
          latestSections = next;
        }}
      />
    );

    expect(container.querySelector('#section-card-sec-149')).toBeNull();

    const quickAddParagraphBtn = screen.getByTitle('Thêm đoạn văn bản mới');
    fireEvent.click(quickAddParagraphBtn);

    await waitFor(() => {
      expect(latestSections.length).toBe(151);
      const addedId = latestSections[150].id;
      expect(container.querySelector(`#section-card-${addedId}`)).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'Tất cả (151)' })).toBeTruthy();

    // Switch filter to Bảng (30) and back to Tất cả (151)
    fireEvent.click(screen.getByRole('button', { name: 'Bảng (30)' }));
    await waitFor(() => {
      const tableCards = container.querySelectorAll('[id^="section-card-"]');
      expect(tableCards.length).toBeGreaterThan(0);
      expect(tableCards.length).toBeLessThan(30);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Tất cả (151)' }));
    await waitFor(() => {
      expect(container.querySelectorAll('[id^="section-card-"]').length).toBeGreaterThan(0);
    });
  });

  it('isolates sibling card re-renders via React.memo when toggling edit mode or editing card #0', async () => {
    const sections: PaperSection[] = [
      { id: 'sec-0', type: 'paragraph', content: 'Đoạn mở đầu kiểm thử memo' },
      { id: 'sec-1', type: 'h1', title: 'Mục một', content: '' },
      { id: 'sec-2', type: 'paragraph', content: 'Đoạn thứ hai' },
      { id: 'sec-3', type: 'paragraph', content: 'Đoạn thứ ba' },
      { id: 'sec-4', type: 'paragraph', content: 'Đoạn thứ tư' },
    ];

    const { container } = render(<ControlledSectionsTab initialSections={sections} />);

    await waitFor(() => {
      expect(headerRenderCounts.get('sec-0')).toBeGreaterThanOrEqual(1);
      expect(headerRenderCounts.get('sec-1')).toBeGreaterThanOrEqual(1);
      expect(headerRenderCounts.get('sec-2')).toBeGreaterThanOrEqual(1);
      expect(headerRenderCounts.get('sec-3')).toBeGreaterThanOrEqual(1);
      expect(headerRenderCounts.get('sec-4')).toBeGreaterThanOrEqual(1);
    });

    const baseline = new Map(headerRenderCounts);

    // Toggle edit mode on paragraph #0 (activeEditingParaId -> 'sec-0')
    const card0 = container.querySelector('#section-card-sec-0') as HTMLElement;
    expect(card0).toBeTruthy();
    const previewBox = within(card0).getByRole('textbox');
    fireEvent.click(previewBox);

    await waitFor(() => {
      expect(card0.querySelector('.z-50')).toBeTruthy();
    });

    // Virtual row containing editing card #0 must also elevate stacking context
    const virtualRow0 = container.querySelector('[data-index="0"]') as HTMLElement;
    expect(virtualRow0).toBeTruthy();
    expect(virtualRow0.style.zIndex).toBe('40');

    // Sibling cards #1..#4 must NOT have re-rendered on #0 edit-mode toggle
    expect(headerRenderCounts.get('sec-0')).toBeGreaterThan(baseline.get('sec-0')!);
    expect(headerRenderCounts.get('sec-1')).toBe(baseline.get('sec-1'));
    expect(headerRenderCounts.get('sec-2')).toBe(baseline.get('sec-2'));
    expect(headerRenderCounts.get('sec-3')).toBe(baseline.get('sec-3'));
    expect(headerRenderCounts.get('sec-4')).toBe(baseline.get('sec-4'));

    const afterToggle = new Map(headerRenderCounts);

    // Update heading #1 text via controlled update -> only card #1 should re-render, siblings #0, #2..#4 remain untouched
    const card1 = container.querySelector('#section-card-sec-1') as HTMLElement;
    const headingInput = within(card1).getByDisplayValue('Mục một');
    fireEvent.change(headingInput, { target: { value: 'Mục một đã chỉnh sửa' } });

    await waitFor(() => {
      expect(within(card1).getByDisplayValue('Mục một đã chỉnh sửa')).toBeTruthy();
    });

    expect(headerRenderCounts.get('sec-1')).toBeGreaterThan(afterToggle.get('sec-1')!);
    expect(headerRenderCounts.get('sec-0')).toBe(afterToggle.get('sec-0'));
    expect(headerRenderCounts.get('sec-2')).toBe(afterToggle.get('sec-2'));
    expect(headerRenderCounts.get('sec-3')).toBe(afterToggle.get('sec-3'));
    expect(headerRenderCounts.get('sec-4')).toBe(afterToggle.get('sec-4'));
  });

  it('renders ParagraphSectionItem figure-source smart assist without needing sections array prop', () => {
    const onUpdateSection = vi.fn();
    const onMergeParagraphIntoPrevFigure = vi.fn();
    const paragraph: PaperSection = {
      id: 'para-after-fig',
      type: 'paragraph',
      content: 'Nguồn: Khảo sát thực địa năm 2025.',
    };

    const { rerender } = render(
      <ParagraphSectionItem
        sec={paragraph}
        idx={2}
        isPrevFigure={true}
        prevFigureCaption="Biểu đồ tăng trưởng mẫu nghiên cứu"
        onUpdateSection={onUpdateSection}
        onMergeParagraphIntoPrevFigure={onMergeParagraphIntoPrevFigure}
      />
    );

    expect(
      screen.getByText(/Ghi chú nguồn cho "Biểu đồ tăng trưởng mẫu nghiên/)
    ).toBeTruthy();

    const mergeButton = screen.getByRole('button', { name: /Gộp vào Hình phía trên/i });
    fireEvent.click(mergeButton);
    expect(onMergeParagraphIntoPrevFigure).toHaveBeenCalledTimes(1);
    expect(onMergeParagraphIntoPrevFigure).toHaveBeenCalledWith(2);

    rerender(
      <ParagraphSectionItem
        sec={paragraph}
        idx={2}
        isPrevFigure={false}
        onUpdateSection={onUpdateSection}
        onMergeParagraphIntoPrevFigure={onMergeParagraphIntoPrevFigure}
      />
    );

    expect(screen.queryByRole('button', { name: /Gộp vào Hình phía trên/i })).toBeNull();
  });

  it('updates deferred preflight QC check cleanly in UnifiedEditorView when sections change', async () => {
    const preflightSpy = vi.spyOn(docxExtractor, 'computePreflightCheck');

    const basePaper = createEmptyPaper('VNUHCM-HS');
    basePaper.metadata.title = 'Nghiên cứu thử nghiệm kiểm định cấu trúc bản thảo';
    basePaper.sections = [
      {
        id: 'sec-h1-init',
        type: 'h1',
        title: 'Mục ban đầu',
        content: '',
      },
      {
        id: 'sec-p-init',
        type: 'paragraph',
        content: 'Nội dung đoạn văn bản ban đầu.',
      },
    ];

    const EditorHarness: React.FC = () => {
      const [paper, setPaper] = useState<CompletePaper>(basePaper);
      return (
        <PaperProvider>
          <UnifiedEditorView paper={paper} onUpdatePaper={setPaper} />
        </PaperProvider>
      );
    };

    render(<EditorHarness />);

    const initialScoreCallCount = preflightSpy.mock.calls.length;
    expect(initialScoreCallCount).toBeGreaterThanOrEqual(1);
    const initialScoreText = `${preflightSpy.mock.results[initialScoreCallCount - 1].value.score}%`;
    expect(screen.getAllByText(initialScoreText).length).toBeGreaterThanOrEqual(1);

    // Switch to Nội dung tab and change heading title to an IMRaD section ("1. Giới thiệu")
    const contentTabButton = screen.getAllByTitle('Nội dung')[0];
    fireEvent.click(contentTabButton);

    const headingInputs = await screen.findAllByDisplayValue('Mục ban đầu');
    fireEvent.change(headingInputs[0], { target: { value: '1. Giới thiệu' } });

    await waitFor(() => {
      const matchingCall = preflightSpy.mock.calls.find(([paperArg]) =>
        paperArg.sections?.some((s) => s.title === '1. Giới thiệu')
      );
      expect(matchingCall).toBeDefined();
    });

    const latestResult =
      preflightSpy.mock.results[preflightSpy.mock.results.length - 1].value;
    await waitFor(() => {
      expect(screen.getAllByText(`${latestResult.score}%`).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('clears activeEditingParaId when scrolling an active paragraph out of overscan without losing content', async () => {
    const paragraphs: PaperSection[] = Array.from({ length: 40 }, (_, i) => ({
      id: `para-${i}`,
      type: 'paragraph',
      content: `Đoạn văn số ${i} phục vụ kiểm thử cuộn ra khỏi vùng overscan.`,
    }));

    let latestSections = paragraphs;
    const { container } = render(
      <ControlledSectionsTab
        initialSections={paragraphs}
        onSectionsUpdated={(next) => {
          latestSections = next;
        }}
      />
    );

    const card0 = container.querySelector('#section-card-para-0') as HTMLElement;
    expect(card0).toBeTruthy();

    // Activate edit mode on paragraph #0
    fireEvent.click(within(card0).getByRole('textbox'));
    await waitFor(() => {
      expect(card0.querySelector('.z-50')).toBeTruthy();
      expect((container.querySelector('[data-index="0"]') as HTMLElement).style.zIndex).toBe('40');
    });

    // Scroll container far below overscan: 5 so para-0 unmounts cleanly
    const virtualRow0 = container.querySelector('[data-index="0"]') as HTMLElement;
    const scrollContainer = virtualRow0.parentElement!.parentElement as HTMLElement;
    scrollContainer.scrollTop = 5000;
    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(container.querySelector('#section-card-para-0')).toBeNull();
    });

    // Scroll back to top -> para-0 remounts in non-editing preview mode (activeEditingParaId cleared) and content intact
    scrollContainer.scrollTop = 0;
    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      const remountedCard0 = container.querySelector('#section-card-para-0') as HTMLElement;
      expect(remountedCard0).toBeTruthy();
      expect(remountedCard0.querySelector('.z-50')).toBeNull();
    });

    const remountedRow0 = container.querySelector('[data-index="0"]') as HTMLElement;
    expect(remountedRow0.style.zIndex).toBe('');
    expect(latestSections[0].content).toBe(paragraphs[0].content);
    expect(
      within(container.querySelector('#section-card-para-0') as HTMLElement).getByText(
        paragraphs[0].content
      )
    ).toBeTruthy();
  });

  it('provides explicit virtual height estimate for equation sections', () => {
    expect(
      estimateSectionHeight({
        id: 'eq-1',
        type: 'equation',
        content: 'E = mc^2',
      })
    ).toBe(220);
  });
});
