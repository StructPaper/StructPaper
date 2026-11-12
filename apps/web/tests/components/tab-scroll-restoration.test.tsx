// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, act, within } from '@testing-library/react';

vi.stubGlobal(
  'fetch',
  vi.fn(async () => {
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'x-compilation-time-ms': '100',
        'x-compiler-engine': 'XeLaTeX',
      },
    });
  })
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/editor',
  useParams: () => ({ id: 'paper-scroll-test' }),
}));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(actual.motion as Record<string, unknown>, {
      get: (_target, prop: string) => {
        const MotionComp = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
          ({ children, ...props }, ref) => {
            const Component = prop as unknown as React.ElementType;
            const strippedProps = { ...props } as Record<string, unknown>;
            delete strippedProps.initial;
            delete strippedProps.animate;
            delete strippedProps.exit;
            delete strippedProps.transition;
            delete strippedProps.whileHover;
            delete strippedProps.whileTap;
            delete strippedProps.layoutId;
            return (
              <Component ref={ref} {...strippedProps}>
                {children}
              </Component>
            );
          }
        );
        MotionComp.displayName = `Motion_${prop}`;
        return MotionComp;
      },
    }),
  };
});

import {
  UnifiedEditorView,
  MetadataTab,
  AuthorsTab,
  AbstractTab,
  SectionsTab,
  ReferencesTab,
  CitationTab,
  PreflightQCTab,
} from '@/components/editor';
import {
  applyScrollTopInstantly,
  createEditorTabStateStore,
  EditorTabStateProvider,
  useTabScrollRestoration,
  isElementHiddenByCss,
} from '@/components/editor/hooks';
import { useSectionVirtualizer } from '@/components/editor/sections/useSectionVirtualizer';
import { PaperProvider } from '@/context/PaperContext';
import {
  DEFAULT_LAYOUT_SETTINGS,
  type CompletePaper,
  type PaperSection,
} from '@/types/paper';

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
        content: `Đoạn văn số ${i} phục vụ kiểm thử cuộn và ảo hóa.`,
      });
    } else if (mod === 3) {
      sections.push({
        id: `sec-${i}`,
        type: 'table',
        content: `Bảng ${i}`,
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
        content: `Hình ${i}`,
        figure: {
          id: `fig-${i}`,
          num: Math.floor(i / 5) + 1,
          caption: `Hình minh họa ${i}`,
          src: '',
        },
      });
    }
  }
  return sections;
}

function createTestPaper(
  id: string,
  sectionCount = 150,
  options?: { shortTitle?: boolean }
): CompletePaper {
  return {
    id,
    metadata: {
      title: options?.shortTitle ? 'Ngắn' : `Nghiên cứu chuẩn hóa tài liệu ${id}`,
      titleEn: `Manuscript Study ${id}`,
      articleType: 'Bài báo nghiên cứu',
      journalId: 'VNUHCM-HS',
      journalName: 'Tạp chí ĐHQG-HCM Health Sciences',
      journalAbbv: 'Sci. Tech. Dev. J. - Health Sci.',
      authors: [
        { id: 'auth_1', name: 'Nguyễn Văn A', affiliationIds: [1], isCorresponding: true, email: 'a@edu.vn' },
      ],
      affiliations: [{ id: 1, name: 'ĐHQG-HCM', nameEn: 'VNUHCM' }],
      corresponding: { name: 'Nguyễn Văn A', email: 'a@edu.vn', affiliation: 'ĐHQG-HCM' },
      abstract: 'Đây là tóm tắt thử nghiệm đủ dài cho bài kiểm thử khôi phục vị trí cuộn.',
      keywords: ['nghiên cứu', 'cấu trúc'],
      dates: { received: '2026-01-01', revised: '2026-01-10', accepted: '2026-01-20', published: '2026-02-01' },
      doi: '10.32508/test.001',
      volume: '1',
      issue: '1',
      year: '2026',
      firstPage: 1,
      lastPage: 10,
    },
    sections: createMixedSections(sectionCount),
    references: Array.from({ length: 15 }, (_, idx) => ({
      id: idx + 1,
      raw: `[${idx + 1}] Author et al. Reference ${idx + 1} (2026).`,
      isCited: true,
      citationCount: 1,
    })),
    layoutSettings: DEFAULT_LAYOUT_SETTINGS,
  };
}

function findScrollContainersInEditor(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('.overflow-y-auto'));
}

describe('Editor Tab Scroll & Sections View-State Restoration', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('tab-view-state-store handles per-tab scroll, paperId isolation, and pending reset consumption', () => {
    const store = createEditorTabStateStore('paper-1');

    expect(store.getPaperId()).toBe('paper-1');
    expect(store.getScrollTop('metadata')).toBe(0);
    expect(store.getSectionsState()).toEqual({
      filterType: 'all',
      scrollOffset: 0,
      measurementsCache: [],
    });

    store.setScrollTop('metadata', 320);
    store.setScrollTop('refs', -40);
    expect(store.getScrollTop('metadata')).toBe(320);
    expect(store.getScrollTop('refs')).toBe(0);

    store.setSectionsState({
      filterType: 'table',
      scrollOffset: 640,
      measurementsCache: [
        { index: 0, key: 'sec-3', start: 0, size: 280, end: 280, lane: 0 },
      ],
    });
    expect(store.getSectionsState().filterType).toBe('table');
    expect(store.getSectionsState().scrollOffset).toBe(640);
    expect(store.getSectionsState().measurementsCache).toHaveLength(1);

    // Pending reset on sections clears scrollTop + sectionsState on consume
    store.markTabPendingReset('sections');
    expect(store.hasPendingReset('sections')).toBe(true);
    expect(store.consumeTabPendingReset('sections')).toBe(true);
    expect(store.hasPendingReset('sections')).toBe(false);
    expect(store.consumeTabPendingReset('sections')).toBe(false);
    expect(store.getSectionsState()).toEqual({
      filterType: 'all',
      scrollOffset: 0,
      measurementsCache: [],
    });
    // Unrelated tab remains preserved
    expect(store.getScrollTop('metadata')).toBe(320);

    // Switching paperId isolates and clears all previous state
    store.markTabPendingReset('refs');
    store.syncPaperId('paper-2');
    expect(store.getPaperId()).toBe('paper-2');
    expect(store.getScrollTop('metadata')).toBe(0);
    expect(store.hasPendingReset('refs')).toBe(false);
  });

  it('preserves scrollTop across MetadataTab <-> ReferencesTab switches inside UnifiedEditorView', async () => {
    const paper = createTestPaper('paper-tabs-1', 20);
    const { container } = render(
      <PaperProvider>
        <UnifiedEditorView paper={paper} onUpdatePaper={vi.fn()} />
      </PaperProvider>
    );

    // MetadataTab is active by default; desktop + mobile render two tab containers
    const metadataTitleInputs = screen.getAllByPlaceholderText('Nhập tựa đề bài báo tiếng Việt...');
    const desktopMetaScroll = metadataTitleInputs[0].closest('.overflow-y-auto') as HTMLElement;
    expect(desktopMetaScroll).toBeTruthy();

    desktopMetaScroll.scrollTop = 420;
    fireEvent.scroll(desktopMetaScroll);

    // Switch to ReferencesTab
    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const refItems = await screen.findAllByText(/Reference 1 \(2026\)/i);
    const desktopRefsScroll = refItems[0].closest('.overflow-y-auto') as HTMLElement;
    expect(desktopRefsScroll).toBeTruthy();

    desktopRefsScroll.scrollTop = 580;
    fireEvent.scroll(desktopRefsScroll);

    // Switch back to MetadataTab -> scrollTop restored to 420
    fireEvent.click(screen.getAllByTitle('Tựa đề')[0]);
    const restoredMetaTitleInputs = await screen.findAllByPlaceholderText(
      'Nhập tựa đề bài báo tiếng Việt...'
    );
    const restoredDesktopMetaScroll = restoredMetaTitleInputs[0].closest(
      '.overflow-y-auto'
    ) as HTMLElement;
    expect(restoredDesktopMetaScroll.scrollTop).toBe(420);

    // User scrolls MetadataTab back to 0 -> untouched mobile duplicate must NOT re-clobber to 420
    restoredDesktopMetaScroll.scrollTop = 0;
    fireEvent.scroll(restoredDesktopMetaScroll);

    // Switch back to ReferencesTab -> scrollTop restored to 580
    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const restoredRefItems = await screen.findAllByText(/Reference 1 \(2026\)/i);
    const restoredDesktopRefsScroll = restoredRefItems[0].closest(
      '.overflow-y-auto'
    ) as HTMLElement;
    expect(restoredDesktopRefsScroll.scrollTop).toBe(580);

    // Switch back to MetadataTab -> stays at 0 as explicitly scrolled
    fireEvent.click(screen.getAllByTitle('Tựa đề')[0]);
    const zeroMetaInputs = await screen.findAllByPlaceholderText(
      'Nhập tựa đề bài báo tiếng Việt...'
    );
    const zeroDesktopMetaScroll = zeroMetaInputs[0].closest('.overflow-y-auto') as HTMLElement;
    expect(zeroDesktopMetaScroll.scrollTop).toBe(0);
    expect(findScrollContainersInEditor(container).length).toBeGreaterThan(0);
  }, 30000);

  it('preserves SectionsTab filterType ("Bảng") + scrollOffset=640 + measurementsCache across tab switches', async () => {
    const paper = createTestPaper('paper-sections-150', 150);

    // Give measured section rows non-estimate heights so virtualizer.takeSnapshot() captures real measurements
    const offsetHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        if (this.hasAttribute('data-index')) return 285;
        return 0;
      });

    const { container } = render(
      <PaperProvider>
        <UnifiedEditorView paper={paper} onUpdatePaper={vi.fn()} />
      </PaperProvider>
    );

    // Navigate to SectionsTab ("Nội dung")
    fireEvent.click(screen.getAllByTitle('Nội dung')[0]);

    // Select "Bảng (30)" filter pill on desktop pane
    const tableFilterBtn = await screen.findAllByRole('button', { name: 'Bảng (30)' });
    fireEvent.click(tableFilterBtn[0]);

    await waitFor(() => {
      expect(tableFilterBtn[0].className).toContain('bg-[#1A1A1A]');
    });

    // Scroll SectionsTab down to 640
    const row0 = container.querySelector('[data-index="0"]') as HTMLElement;
    expect(row0).toBeTruthy();
    const sectionsScrollEl = row0.parentElement!.parentElement as HTMLElement;
    sectionsScrollEl.scrollTop = 640;
    fireEvent.scroll(sectionsScrollEl);

    // Switch to ReferencesTab
    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    await screen.findAllByText(/Reference 1 \(2026\)/i);

    // Switch back to SectionsTab -> filter "Bảng (30)" & scrollTop=640 must both be restored
    fireEvent.click(screen.getAllByTitle('Nội dung')[0]);
    const restoredTableFilterBtns = await screen.findAllByRole('button', { name: 'Bảng (30)' });
    expect(restoredTableFilterBtns[0].className).toContain('bg-[#1A1A1A]');

    const restoredRow = container.querySelector('[data-index]') as HTMLElement;
    expect(restoredRow).toBeTruthy();
    const restoredSectionsScrollEl = restoredRow.parentElement!.parentElement as HTMLElement;
    expect(restoredSectionsScrollEl.scrollTop).toBe(640);

    // Actively switching filter inside SectionsTab resets scrollTop back to 0
    const allFilterBtns = screen.getAllByRole('button', { name: 'Tất cả (150)' });
    fireEvent.click(allFilterBtns[0]);
    await waitFor(() => {
      expect(restoredSectionsScrollEl.scrollTop).toBe(0);
      expect(allFilterBtns[0].className).toContain('bg-[#1A1A1A]');
    });

    offsetHeightSpy.mockRestore();
  }, 30000);

  it('PreflightQCTab "Sửa ngay" resets target tab scrollTop and SectionsTab filter while keeping other tabs', async () => {
    const paper = createTestPaper('paper-preflight-reset', 60, { shortTitle: true });
    const { container } = render(
      <PaperProvider>
        <UnifiedEditorView paper={paper} onUpdatePaper={vi.fn()} />
      </PaperProvider>
    );

    // 1. Scroll MetadataTab to 360
    const metaInput = screen.getAllByPlaceholderText('Nhập tựa đề bài báo tiếng Việt...')[0];
    const metaScroll = metaInput.closest('.overflow-y-auto') as HTMLElement;
    metaScroll.scrollTop = 360;
    fireEvent.scroll(metaScroll);

    // 2. Scroll ReferencesTab to 500 (should remain intact)
    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const refItem = (await screen.findAllByText(/Reference 1 \(2026\)/i))[0];
    const refsScroll = refItem.closest('.overflow-y-auto') as HTMLElement;
    refsScroll.scrollTop = 500;
    fireEvent.scroll(refsScroll);

    // 3. Switch to SectionsTab, pick "Bảng", scroll to 640
    fireEvent.click(screen.getAllByTitle('Nội dung')[0]);
    const tableFilter = (await screen.findAllByRole('button', { name: 'Bảng (12)' }))[0];
    fireEvent.click(tableFilter);
    const secRow0 = container.querySelector('[data-index="0"]') as HTMLElement;
    const secScroll = secRow0.parentElement!.parentElement as HTMLElement;
    secScroll.scrollTop = 640;
    fireEvent.scroll(secScroll);

    // 4. Open Preflight QC tab via LeftDock button
    const qcDockBtn = screen.getByRole('button', { name: /Chất lượng bản thảo:/i });
    fireEvent.click(qcDockBtn);

    // Click "Sửa ngay" for short title -> targets 'metadata'
    const fixButtons = await screen.findAllByRole('button', { name: /Sửa ngay/i });
    fireEvent.click(fixButtons[0]);

    const resetMetaInput = await screen.findAllByPlaceholderText(
      'Nhập tựa đề bài báo tiếng Việt...'
    );
    const resetMetaScroll = resetMetaInput[0].closest('.overflow-y-auto') as HTMLElement;
    expect(resetMetaScroll.scrollTop).toBe(0);

    // 5. Open Preflight again and click IMRaD pillar ("Sửa →") targeting 'sections'
    fireEvent.click(screen.getByRole('button', { name: /Chất lượng bản thảo:/i }));
    const imradCard = (await screen.findAllByTitle('Nhấp để chuyển tới tab Nội dung'))[0];
    fireEvent.click(imradCard);

    const allFilterAfterReset = (
      await screen.findAllByRole('button', { name: 'Tất cả (60)' })
    )[0];
    expect(allFilterAfterReset.className).toContain('bg-[#1A1A1A]');
    const secRowAfterReset = container.querySelector('[data-index="0"]') as HTMLElement;
    const secScrollAfterReset = secRowAfterReset.parentElement!.parentElement as HTMLElement;
    expect(secScrollAfterReset.scrollTop).toBe(0);

    // 6. ReferencesTab scroll position was untouched and still restores 500
    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const refAfter = (await screen.findAllByText(/Reference 1 \(2026\)/i))[0];
    expect((refAfter.closest('.overflow-y-auto') as HTMLElement).scrollTop).toBe(500);
  }, 30000);

  it('prevents untouched 0-scroll or CSS-hidden duplicate container from overwriting scrolled sibling', () => {
    function DualContainerHarness() {
      const visibleRef = React.useRef<HTMLDivElement>(null);
      const untouchedShadowRef = React.useRef<HTMLDivElement>(null);
      const hiddenRef = React.useRef<HTMLDivElement>(null);
      useTabScrollRestoration('metadata', visibleRef);
      useTabScrollRestoration('metadata', untouchedShadowRef);
      useTabScrollRestoration('metadata', hiddenRef);
      return (
        <div>
          <div ref={visibleRef} data-testid="visible-pane" style={{ overflowY: 'auto' }} />
          <div ref={untouchedShadowRef} data-testid="untouched-shadow-pane" style={{ overflowY: 'auto' }} />
          <div style={{ display: 'none' }}>
            <div ref={hiddenRef} data-testid="hidden-pane" style={{ overflowY: 'auto' }} />
          </div>
        </div>
      );
    }

    const store = createEditorTabStateStore('paper-dual');
    const { rerender } = render(
      <EditorTabStateProvider paperId="paper-dual" store={store}>
        <DualContainerHarness />
      </EditorTabStateProvider>
    );

    const visiblePane = screen.getByTestId('visible-pane');
    const untouchedShadowPane = screen.getByTestId('untouched-shadow-pane');
    const hiddenPane = screen.getByTestId('hidden-pane');
    expect(isElementHiddenByCss(visiblePane)).toBe(false);
    expect(isElementHiddenByCss(hiddenPane)).toBe(true);

    visiblePane.scrollTop = 777;
    fireEvent.scroll(visiblePane);

    // Even if hidden sibling receives a programmatic scroll/value, it never overwrites;
    // untouchedShadowPane remains at 0 and must not overwrite 777 on unmount either.
    hiddenPane.scrollTop = 0;
    fireEvent.scroll(hiddenPane);
    expect(untouchedShadowPane.scrollTop).toBe(0);

    rerender(<EditorTabStateProvider paperId="paper-dual" store={store}>{null}</EditorTabStateProvider>);

    expect(store.getScrollTop('metadata')).toBe(777);

    rerender(
      <EditorTabStateProvider paperId="paper-dual" store={store}>
        <DualContainerHarness />
      </EditorTabStateProvider>
    );
    expect(screen.getByTestId('visible-pane').scrollTop).toBe(777);
    expect(screen.getByTestId('hidden-pane').scrollTop).toBe(0);
  });

  it('works idempotently under React.StrictMode and schedules rAF retry only when clamped on restore', async () => {
    const store = createEditorTabStateStore('paper-strict');
    store.setScrollTop('metadata', 480);
    store.setSectionsState({ filterType: 'table', scrollOffset: 640, measurementsCache: [] });

    let nextRafId = 1;
    const rafQueue = new Map<number, FrameRequestCallback>();
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      const id = nextRafId++;
      rafQueue.set(id, cb);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      rafQueue.delete(id);
    });

    // 1. Clamped on initial mount (simulates child AutoResizeTextarea expanding asynchronously) -> schedules rAF retry
    let maxScroll = 120;
    let internalTop = 0;
    function StrictClampedHarness() {
      const ref = React.useRef<HTMLDivElement>(null);
      const setRef = React.useCallback((node: HTMLDivElement | null) => {
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (node && !Object.getOwnPropertyDescriptor(node, 'scrollTop')) {
          Object.defineProperty(node, 'scrollTop', {
            configurable: true,
            get: () => internalTop,
            set: (value: number) => {
              internalTop = Math.min(value, maxScroll);
            },
          });
        }
      }, []);
      useTabScrollRestoration('metadata', ref);
      return <div ref={setRef} data-testid="strict-meta" />;
    }

    const paper = createTestPaper('paper-strict', 50);
    render(
      <React.StrictMode>
        <EditorTabStateProvider paperId="paper-strict" store={store}>
          <StrictClampedHarness />
          <SectionsTab sections={paper.sections} onChange={vi.fn()} />
        </EditorTabStateProvider>
      </React.StrictMode>
    );

    const strictMeta = screen.getByTestId('strict-meta');
    expect(strictMeta.scrollTop).toBe(120);
    expect(rafQueue.size).toBeGreaterThan(0);

    // Child expands allowing target 480 -> rAF completes restore
    maxScroll = 1000;
    act(() => {
      const entries = Array.from(rafQueue.entries());
      rafQueue.clear();
      entries.forEach(([, cb]) => cb(16));
    });
    expect(strictMeta.scrollTop).toBe(480);

    // SectionsTab preserved 'table' filter under StrictMode
    const tableBtn = screen.getByRole('button', { name: 'Bảng (10)' });
    expect(tableBtn.className).toContain('bg-[#1A1A1A]');

    // 2. Unclamped restore must NOT schedule rAF (avoids stomping virtualizer applyScrollAdjustment)
    rafQueue.clear();
    function UnclampedHarness() {
      const ref = React.useRef<HTMLDivElement>(null);
      useTabScrollRestoration('metadata', ref);
      return <div ref={ref} data-testid="unclamped-meta" />;
    }
    render(
      <EditorTabStateProvider paperId="paper-strict" store={store}>
        <UnclampedHarness />
      </EditorTabStateProvider>
    );
    expect(screen.getByTestId('unclamped-meta').scrollTop).toBe(480);
    expect(rafQueue.size).toBe(0);
  });

  it('isolates scroll and filter state when switching paperId in UnifiedEditorView', async () => {
    const paper1 = createTestPaper('paper-iso-1', 40);
    const paper2 = createTestPaper('paper-iso-2', 40);

    const { rerender } = render(
      <PaperProvider>
        <UnifiedEditorView paper={paper1} onUpdatePaper={vi.fn()} />
      </PaperProvider>
    );

    const metaInput1 = screen.getAllByPlaceholderText('Nhập tựa đề bài báo tiếng Việt...')[0];
    const metaScroll1 = metaInput1.closest('.overflow-y-auto') as HTMLElement;
    metaScroll1.scrollTop = 310;
    fireEvent.scroll(metaScroll1);

    fireEvent.click(screen.getAllByTitle('Nội dung')[0]);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Bảng (8)' }))[0]);

    // Switch active paper to paper2
    rerender(
      <PaperProvider>
        <UnifiedEditorView paper={paper2} onUpdatePaper={vi.fn()} />
      </PaperProvider>
    );

    await waitFor(() => {
      const allBtn = screen.getAllByRole('button', { name: 'Tất cả (40)' })[0];
      expect(allBtn.className).toContain('bg-[#1A1A1A]');
    });

    fireEvent.click(screen.getAllByTitle('Tựa đề')[0]);
    const metaInput2 = (
      await screen.findAllByPlaceholderText('Nhập tựa đề bài báo tiếng Việt...')
    )[0];
    expect((metaInput2.closest('.overflow-y-auto') as HTMLElement).scrollTop).toBe(0);
  }, 30000);

  it('renders all 7 editor tabs safely standalone outside EditorTabStateProvider', () => {
    const paper = createTestPaper('paper-standalone', 10);
    expect(() => {
      render(
        <div>
          <MetadataTab metadata={paper.metadata} onChange={vi.fn()} />
          <AuthorsTab metadata={paper.metadata} onChange={vi.fn()} />
          <AbstractTab metadata={paper.metadata} onChange={vi.fn()} />
          <SectionsTab sections={paper.sections} onChange={vi.fn()} />
          <ReferencesTab references={paper.references} onChange={vi.fn()} />
          <CitationTab citationText="Citation sample" onChange={vi.fn()} metadata={paper.metadata} />
          <PreflightQCTab paper={paper} onNavigateTab={vi.fn()} />
        </div>
      );
    }).not.toThrow();
  });

  it('captures virtualizer.takeSnapshot() measurementsCache on SectionsTab unmount and restores initialMeasurementsCache on remount', () => {
    const paper = createTestPaper('paper-snapshot-rt', 30);
    const store = createEditorTabStateStore(paper.id);

    const offsetHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'offsetHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        if (this.hasAttribute('data-index')) return 295;
        return 0;
      });

    const { container, rerender } = render(
      <EditorTabStateProvider paperId={paper.id} store={store}>
        <SectionsTab sections={paper.sections} onChange={vi.fn()} />
      </EditorTabStateProvider>
    );

    const row0 = container.querySelector('[data-index="0"]') as HTMLElement;
    const row1 = container.querySelector('[data-index="1"]') as HTMLElement;
    const row2 = container.querySelector('[data-index="2"]') as HTMLElement;
    const listWrapper = row0.parentElement as HTMLElement;
    const scrollEl = listWrapper.parentElement as HTMLElement;

    expect(row1.style.transform).toBe('translateY(295px)');
    expect(row2.style.transform).toBe('translateY(590px)');
    const measuredTotalHeight = listWrapper.style.height;
    // Default unmeasured estimates sum to 6240px (6 * (120+180+180+260+300)), so measured 295px differs
    expect(measuredTotalHeight).not.toBe('6240px');

    scrollEl.scrollTop = 640;
    fireEvent.scroll(scrollEl);

    // Unmount SectionsTab -> triggers snapshot save while takeSnapshot() & scrollEl are active
    rerender(<EditorTabStateProvider paperId={paper.id} store={store}>{null}</EditorTabStateProvider>);

    const saved = store.getSectionsState();
    expect(saved.scrollOffset).toBe(640);
    expect(saved.measurementsCache.length).toBeGreaterThan(0);
    expect(saved.measurementsCache.every((item) => item.size === 295)).toBe(true);

    // Remount without offsetHeight mock -> initialMeasurementsCache still preserves measured heights & offsets
    offsetHeightSpy.mockRestore();

    const remount = render(
      <EditorTabStateProvider paperId={paper.id} store={store}>
        <SectionsTab sections={paper.sections} onChange={vi.fn()} />
      </EditorTabStateProvider>
    );
    const remountedRow1 = remount.container.querySelector('[data-index="1"]') as HTMLElement;
    const remountedRow2 = remount.container.querySelector('[data-index="2"]') as HTMLElement;
    const remountedListWrapper = remountedRow1.parentElement as HTMLElement;
    const remountedScroll = remountedListWrapper.parentElement as HTMLElement;
    expect(remountedScroll.scrollTop).toBe(640);
    expect(remountedListWrapper.style.height).toBe(measuredTotalHeight);
    expect(remountedRow1.style.transform).toBe('translateY(295px)');
    expect(remountedRow2.style.transform).toBe('translateY(590px)');
  });

  it('preserves scrollTop across all remaining tabs (AuthorsTab, AbstractTab, CitationTab, PreflightQCTab)', async () => {
    const paper = createTestPaper('paper-all-7-tabs', 15);
    render(
      <PaperProvider>
        <UnifiedEditorView paper={paper} onUpdatePaper={vi.fn()} />
      </PaperProvider>
    );

    // AuthorsTab
    fireEvent.click(screen.getAllByTitle('Tác giả')[0]);
    const authorInput = (await screen.findAllByDisplayValue('Nguyễn Văn A'))[0];
    const authorsScroll = authorInput.closest('.overflow-y-auto') as HTMLElement;
    authorsScroll.scrollTop = 210;
    fireEvent.scroll(authorsScroll);

    // AbstractTab
    fireEvent.click(screen.getAllByTitle('Tóm tắt')[0]);
    const abstractHeader = (await screen.findAllByText(/Tóm tắt & Từ khóa/i))[0];
    const abstractScroll = abstractHeader.closest('.overflow-y-auto') as HTMLElement;
    abstractScroll.scrollTop = 195;
    fireEvent.scroll(abstractScroll);

    // CitationTab
    fireEvent.click(screen.getAllByTitle('Trích dẫn')[0]);
    const citationHeader = (await screen.findAllByText(/Trích Dẫn Bài Báo Này/i))[0];
    const citationScroll = citationHeader.closest('.overflow-y-auto') as HTMLElement;
    citationScroll.scrollTop = 160;
    fireEvent.scroll(citationScroll);

    // PreflightQCTab
    fireEvent.click(screen.getByRole('button', { name: /Chất lượng bản thảo:/i }));
    const qcReportHeader = (await screen.findAllByText(/Báo cáo các mục cần bổ sung/i))[0];
    const qcScroll = qcReportHeader.closest('.overflow-y-auto') as HTMLElement;
    qcScroll.scrollTop = 275;
    fireEvent.scroll(qcScroll);

    // Verify all 4 restored cleanly on revisit
    fireEvent.click(screen.getAllByTitle('Tác giả')[0]);
    expect(
      ((await screen.findAllByDisplayValue('Nguyễn Văn A'))[0].closest(
        '.overflow-y-auto'
      ) as HTMLElement).scrollTop
    ).toBe(210);

    fireEvent.click(screen.getAllByTitle('Tóm tắt')[0]);
    expect(
      ((await screen.findAllByText(/Tóm tắt & Từ khóa/i))[0].closest(
        '.overflow-y-auto'
      ) as HTMLElement).scrollTop
    ).toBe(195);

    fireEvent.click(screen.getAllByTitle('Trích dẫn')[0]);
    expect(
      ((await screen.findAllByText(/Trích Dẫn Bài Báo Này/i))[0].closest(
        '.overflow-y-auto'
      ) as HTMLElement).scrollTop
    ).toBe(160);

    fireEvent.click(screen.getByRole('button', { name: /Chất lượng bản thảo:/i }));
    expect(
      ((await screen.findAllByText(/Báo cáo các mục cần bổ sung/i))[0].closest(
        '.overflow-y-auto'
      ) as HTMLElement).scrollTop
    ).toBe(275);
  }, 30000);

  it('commits scrollTop=0 when clicking "Cuộn lên đầu trang" in ReferencesTab and SectionsTab without scroll events', async () => {
    const paper = createTestPaper('paper-scroll-top-btn', 20);
    const { container } = render(
      <PaperProvider>
        <UnifiedEditorView paper={paper} onUpdatePaper={vi.fn()} />
      </PaperProvider>
    );

    // 1. ReferencesTab: scroll to 580 -> leave -> return (hasScrolledRef=false) -> click "Cuộn lên đầu trang"
    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const refItem = (await screen.findAllByText(/Reference 1 \(2026\)/i))[0];
    const refsScroll = refItem.closest('.overflow-y-auto') as HTMLElement;
    refsScroll.scrollTop = 580;
    fireEvent.scroll(refsScroll);

    fireEvent.click(screen.getAllByTitle('Tựa đề')[0]);
    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const returnedRefItem = (await screen.findAllByText(/Reference 1 \(2026\)/i))[0];
    expect((returnedRefItem.closest('.overflow-y-auto') as HTMLElement).scrollTop).toBe(580);

    fireEvent.click(screen.getAllByRole('button', { name: /Cuộn lên đầu trang/i })[0]);
    // Immediately switch away WITHOUT dispatching fireEvent.scroll, then return
    fireEvent.click(screen.getAllByTitle('Tựa đề')[0]);
    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const resetRefItem = (await screen.findAllByText(/Reference 1 \(2026\)/i))[0];
    expect((resetRefItem.closest('.overflow-y-auto') as HTMLElement).scrollTop).toBe(0);

    // 2. SectionsTab: scroll to 640 -> leave -> return (hasScrolledRef=false) -> click "Cuộn lên đầu trang"
    fireEvent.click(screen.getAllByTitle('Nội dung')[0]);
    const row0 = await waitFor(() => {
      const el = container.querySelector('[data-index="0"]') as HTMLElement | null;
      expect(el).toBeTruthy();
      return el!;
    });
    const secScroll = row0.parentElement!.parentElement as HTMLElement;
    secScroll.scrollTop = 640;
    fireEvent.scroll(secScroll);

    fireEvent.click(screen.getAllByTitle('Tựa đề')[0]);
    fireEvent.click(screen.getAllByTitle('Nội dung')[0]);
    const returnedRow = await waitFor(() => {
      const el = container.querySelector('[data-index]') as HTMLElement | null;
      expect(el).toBeTruthy();
      return el!;
    });
    expect((returnedRow.parentElement!.parentElement as HTMLElement).scrollTop).toBe(640);

    fireEvent.click(screen.getAllByRole('button', { name: /Cuộn lên đầu trang/i })[0]);
    // Immediately switch away WITHOUT dispatching fireEvent.scroll, then return
    fireEvent.click(screen.getAllByTitle('Tựa đề')[0]);
    fireEvent.click(screen.getAllByTitle('Nội dung')[0]);
    const resetRow = await waitFor(() => {
      const el = container.querySelector('[data-index]') as HTMLElement | null;
      expect(el).toBeTruthy();
      return el!;
    });
    expect((resetRow.parentElement!.parentElement as HTMLElement).scrollTop).toBe(0);
  }, 30000);

  it('keeps ReferencesTab scrolled position after "Thêm tài liệu" scrollIntoView and tab switching', async () => {
    const paper = createTestPaper('paper-refs-add', 10);
    render(
      <PaperProvider>
        <UnifiedEditorView paper={paper} onUpdatePaper={vi.fn()} />
      </PaperProvider>
    );

    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const refItem = (await screen.findAllByText(/Reference 1 \(2026\)/i))[0];
    const refsScroll = refItem.closest('.overflow-y-auto') as HTMLElement;

    const scrollIntoViewSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollIntoView')
      .mockImplementation(function (this: HTMLElement) {
        const scroller = this.closest('.overflow-y-auto') as HTMLElement | null;
        if (scroller) {
          scroller.scrollTop = 920;
        }
      });

    fireEvent.click(screen.getAllByRole('button', { name: /Thêm tài liệu/i })[0]);

    await waitFor(() => {
      expect(scrollIntoViewSpy).toHaveBeenCalled();
    });
    expect(refsScroll.scrollTop).toBe(920);

    // Switch away immediately while newlyAddedId !== null and return
    fireEvent.click(screen.getAllByTitle('Tựa đề')[0]);
    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const returnedRefItem = (await screen.findAllByText(/Reference 1 \(2026\)/i))[0];
    expect((returnedRefItem.closest('.overflow-y-auto') as HTMLElement).scrollTop).toBe(920);
  }, 30000);

  it('PreflightQCTab "Sửa ngay" (markTabPendingReset) resets target tab cleanly inside React.StrictMode', async () => {
    const paper = createTestPaper('paper-strict-preflight', 60, { shortTitle: true });
    const { container } = render(
      <React.StrictMode>
        <PaperProvider>
          <UnifiedEditorView paper={paper} onUpdatePaper={vi.fn()} />
        </PaperProvider>
      </React.StrictMode>
    );

    const metaInput = screen.getAllByPlaceholderText('Nhập tựa đề bài báo tiếng Việt...')[0];
    const metaScroll = metaInput.closest('.overflow-y-auto') as HTMLElement;
    metaScroll.scrollTop = 360;
    fireEvent.scroll(metaScroll);

    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const refItem = (await screen.findAllByText(/Reference 1 \(2026\)/i))[0];
    const refsScroll = refItem.closest('.overflow-y-auto') as HTMLElement;
    refsScroll.scrollTop = 500;
    fireEvent.scroll(refsScroll);

    fireEvent.click(screen.getAllByTitle('Nội dung')[0]);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Bảng (12)' }))[0]);
    const secRow0 = container.querySelector('[data-index="0"]') as HTMLElement;
    const secScroll = secRow0.parentElement!.parentElement as HTMLElement;
    secScroll.scrollTop = 640;
    fireEvent.scroll(secScroll);

    fireEvent.click(screen.getByRole('button', { name: /Chất lượng bản thảo:/i }));
    const fixButtons = await screen.findAllByRole('button', { name: /Sửa ngay/i });
    fireEvent.click(fixButtons[0]);

    const resetMeta = await screen.findAllByPlaceholderText('Nhập tựa đề bài báo tiếng Việt...');
    expect((resetMeta[0].closest('.overflow-y-auto') as HTMLElement).scrollTop).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: /Chất lượng bản thảo:/i }));
    const imradCard = (await screen.findAllByTitle('Nhấp để chuyển tới tab Nội dung'))[0];
    fireEvent.click(imradCard);

    const allFilterAfterReset = (
      await screen.findAllByRole('button', { name: 'Tất cả (60)' })
    )[0];
    expect(allFilterAfterReset.className).toContain('bg-[#1A1A1A]');
    const secRowAfterReset = container.querySelector('[data-index="0"]') as HTMLElement;
    expect((secRowAfterReset.parentElement!.parentElement as HTMLElement).scrollTop).toBe(0);

    // Untouched ReferencesTab stays at 500
    fireEvent.click(screen.getAllByTitle('Tài liệu tham khảo')[0]);
    const refAfter = (await screen.findAllByText(/Reference 1 \(2026\)/i))[0];
    expect((refAfter.closest('.overflow-y-auto') as HTMLElement).scrollTop).toBe(500);
  }, 30000);

  it('syncs scrollTop and SectionsTab filterType across concurrent breakpoint panes on ResizeObserver hidden -> visible', async () => {
    const observers: Array<{
      instance: ResizeObserver;
      callback: ResizeObserverCallback;
      targets: Set<Element>;
    }> = [];

    class MockResizeObserver implements ResizeObserver {
      private entry: {
        instance: ResizeObserver;
        callback: ResizeObserverCallback;
        targets: Set<Element>;
      };
      constructor(callback: ResizeObserverCallback) {
        this.entry = { instance: this, callback, targets: new Set() };
        observers.push(this.entry);
      }
      observe(target: Element) {
        this.entry.targets.add(target);
      }
      unobserve(target: Element) {
        this.entry.targets.delete(target);
      }
      disconnect() {
        this.entry.targets.clear();
      }
    }

    const OriginalResizeObserver = globalThis.ResizeObserver;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);

    const triggerResize = (target: Element) => {
      observers.forEach((entry) => {
        if (entry.targets.has(target)) {
          entry.callback([], entry.instance);
        }
      });
    };

    const clientHeightSpy = vi
      .spyOn(HTMLElement.prototype, 'clientHeight', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return isElementHiddenByCss(this) ? 0 : 600;
      });

    try {
      const store = createEditorTabStateStore('paper-resize-sync');
      const paper = createTestPaper('paper-resize-sync', 30);

      function BreakpointPanes({
        desktopVisible,
        mobileVisible,
      }: {
        desktopVisible: boolean;
        mobileVisible: boolean;
      }) {
        const desktopMetaRef = React.useRef<HTMLDivElement>(null);
        const mobileMetaRef = React.useRef<HTMLDivElement>(null);
        useTabScrollRestoration('metadata', desktopMetaRef);
        useTabScrollRestoration('metadata', mobileMetaRef);

        return (
          <>
            <div data-testid="desktop-pane" style={{ display: desktopVisible ? 'block' : 'none' }}>
              <div ref={desktopMetaRef} data-testid="desktop-meta" style={{ overflowY: 'auto' }} />
              <SectionsTab sections={paper.sections} onChange={vi.fn()} />
            </div>
            <div data-testid="mobile-pane" style={{ display: mobileVisible ? 'block' : 'none' }}>
              <div ref={mobileMetaRef} data-testid="mobile-meta" style={{ overflowY: 'auto' }} />
              <SectionsTab sections={paper.sections} onChange={vi.fn()} />
            </div>
          </>
        );
      }

      function BreakpointHarness({
        desktopVisible,
        mobileVisible,
      }: {
        desktopVisible: boolean;
        mobileVisible: boolean;
      }) {
        return (
          <EditorTabStateProvider paperId={paper.id} store={store}>
            <BreakpointPanes desktopVisible={desktopVisible} mobileVisible={mobileVisible} />
          </EditorTabStateProvider>
        );
      }

      const { rerender } = render(<BreakpointHarness desktopVisible={true} mobileVisible={false} />);

      const desktopMeta = screen.getByTestId('desktop-meta');
      const mobileMeta = screen.getByTestId('mobile-meta');
      const desktopPane = screen.getByTestId('desktop-pane');
      const mobilePane = screen.getByTestId('mobile-pane');

      const desktopTableBtn = within(desktopPane).getByRole('button', { name: 'Bảng (6)' });
      const desktopSecRow = desktopPane.querySelector('[data-index="0"]') as HTMLElement;
      const desktopSecScroll = desktopSecRow.parentElement!.parentElement as HTMLElement;
      const mobileSecRow = mobilePane.querySelector('[data-index="0"]') as HTMLElement;
      const mobileSecScroll = mobileSecRow.parentElement!.parentElement as HTMLElement;

      // Scroll desktop metadata & change SectionsTab filter + scroll on desktop
      desktopMeta.scrollTop = 520;
      fireEvent.scroll(desktopMeta);

      fireEvent.click(desktopTableBtn);
      await waitFor(() => {
        expect(
          within(mobilePane).getByRole('button', { name: 'Bảng (6)', hidden: true }).className
        ).toContain('bg-[#1A1A1A]');
      });

      desktopSecScroll.scrollTop = 640;
      fireEvent.scroll(desktopSecScroll);

      // Resize narrower: desktop -> hidden, mobile -> visible
      rerender(<BreakpointHarness desktopVisible={false} mobileVisible={true} />);
      act(() => {
        triggerResize(desktopMeta);
        triggerResize(desktopSecScroll);
        triggerResize(mobileMeta);
        triggerResize(mobileSecScroll);
      });

      expect(mobileMeta.scrollTop).toBe(520);
      expect(mobileSecScroll.scrollTop).toBe(640);
      expect(within(mobilePane).getByRole('button', { name: 'Bảng (6)' }).className).toContain(
        'bg-[#1A1A1A]'
      );

      // Scroll mobile metadata back to 210, then resize wider back to desktop
      mobileMeta.scrollTop = 210;
      fireEvent.scroll(mobileMeta);

      rerender(<BreakpointHarness desktopVisible={true} mobileVisible={false} />);
      act(() => {
        triggerResize(mobileMeta);
        triggerResize(desktopMeta);
      });
      expect(desktopMeta.scrollTop).toBe(210);
    } finally {
      clientHeightSpy.mockRestore();
      vi.stubGlobal('ResizeObserver', OriginalResizeObserver);
    }
  });

  it('applyScrollTopInstantly handles scroll-behavior: smooth, store reads are render-pure, and hidden virtualizer skips headless writes', () => {
    // 1. applyScrollTopInstantly temporarily overrides smooth scrollBehavior & restores it
    const smoothEl = document.createElement('div');
    smoothEl.style.scrollBehavior = 'smooth';
    let rawTop = 0;
    Object.defineProperty(smoothEl, 'scrollTop', {
      configurable: true,
      get: () => rawTop,
      set: (value: number) => {
        // Simulate CSSOM smooth interception ignoring direct scrollTop assignment when smooth is active
        if (smoothEl.style.scrollBehavior !== 'auto') return;
        rawTop = value;
      },
    });
    const applied = applyScrollTopInstantly(smoothEl, 450);
    expect(applied).toBe(450);
    expect(smoothEl.scrollTop).toBe(450);
    expect(smoothEl.style.scrollBehavior).toBe('smooth');

    // Fallback to scrollTo({ behavior: 'instant' }) if direct assignment still lags
    const fallbackEl = document.createElement('div');
    let fallbackTop = 0;
    Object.defineProperty(fallbackEl, 'scrollTop', {
      configurable: true,
      get: () => fallbackTop,
      set: () => {},
    });
    const scrollToSpy = vi.fn((opts?: ScrollToOptions) => {
      if (opts?.behavior === ('instant' as ScrollBehavior) && typeof opts.top === 'number') {
        fallbackTop = opts.top;
      }
    });
    fallbackEl.scrollTo = scrollToSpy as unknown as typeof fallbackEl.scrollTo;
    expect(applyScrollTopInstantly(fallbackEl, 310)).toBe(310);
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 310, behavior: 'instant' });

    // 2. Render-time store reads with mismatched paperId stay pure and do not mutate store
    const store = createEditorTabStateStore('paper-1');
    store.setScrollTop('metadata', 420);
    store.setSectionsState({ filterType: 'table', scrollOffset: 640 });
    store.markTabPendingReset('refs');

    expect(store.getScrollTop('metadata', 'paper-2')).toBe(0);
    expect(store.getSectionsState('paper-2')).toEqual({
      filterType: 'all',
      scrollOffset: 0,
      measurementsCache: [],
    });
    expect(store.hasPendingReset('refs', 'paper-2')).toBe(false);

    const sectionsPaper2 = createTestPaper('paper-2', 10);
    const html = renderToStaticMarkup(
      <EditorTabStateProvider paperId="paper-2" store={store}>
        <SectionsTab sections={sectionsPaper2.sections} onChange={vi.fn()} />
      </EditorTabStateProvider>
    );
    expect(html).toContain('Tất cả (10)');
    expect(store.getPaperId()).toBe('paper-1');
    expect(store.getScrollTop('metadata')).toBe(420);
    expect(store.getSectionsState().filterType).toBe('table');

    // 3. CSS-hidden breakpoint clone skips synthetic headless scroll writes
    const hiddenItems = createMixedSections(10).map((sec, idx) => ({
      sec,
      secId: sec.id || `sec-${idx}`,
    }));
    let hiddenScrollRef: React.RefObject<HTMLDivElement> | null = null;
    let triggerScrollToSection: ((id: string) => boolean) | null = null;
    function HiddenVirtualizerHarness() {
      const result = useSectionVirtualizer({ items: hiddenItems, paperId: 'paper-hidden' });
      hiddenScrollRef = result.scrollContainerRef;
      triggerScrollToSection = result.scrollToSectionId;
      return (
        <div style={{ display: 'none' }}>
          <div ref={result.scrollContainerRef} data-testid="hidden-virt-scroll" />
        </div>
      );
    }
    render(<HiddenVirtualizerHarness />);
    expect(triggerScrollToSection!('sec-5')).toBe(true);
    expect(hiddenScrollRef!.current!.scrollTop).toBe(0);
  });

  it('jumpToSection from PageGroupOverview resets both local filter and persisted EditorTabState filterType to all', async () => {
    const store = createEditorTabStateStore('paper-jump');
    const sections = createMixedSections(8);
    sections[5] = {
      ...sections[5],
      pageLayout: { columns: '1-column', orientation: 'landscape' },
    };

    render(
      <EditorTabStateProvider paperId="paper-jump" store={store}>
        <SectionsTab sections={sections} onChange={vi.fn()} />
      </EditorTabStateProvider>
    );

    const tableChip = screen.getByRole('button', { name: /Bảng \(/i });
    fireEvent.click(tableChip);
    expect(store.getSectionsState().filterType).toBe('table');

    const pills = screen.getAllByTestId('page-group-pill');
    expect(pills.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(pills[1]);

    expect(store.getSectionsState().filterType).toBe('all');
  });
});
