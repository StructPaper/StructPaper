// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { PlatformProvider, createFakePlatform } from '@structpaper/platform';

// Mock router
const { mockRouterPush } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams('id=test_paper_shell_1'),
  usePathname: () => '/editor',
  useParams: () => ({ id: 'test_paper_shell_1' }),
}));

// Mock framer-motion
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

// Stub global.fetch
vi.stubGlobal(
  'fetch',
  vi.fn(async () => {
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'x-compilation-time-ms': '120',
        'x-compiler-engine': 'XeLaTeX',
      },
    });
  })
);

import { EditorLeftDock } from '@/features/editor';
import { PaperProvider } from '@/context/PaperContext';
import { CompletePaper, DEFAULT_LAYOUT_SETTINGS } from '@/types/paper';
import PreviewPage from '@/app/(authenticate)/(main)/preview/page';

const mockPaper: CompletePaper = {
  id: 'test_paper_shell_1',
  metadata: {
    title: 'Bài báo nghiên cứu thử nghiệm',
    articleType: 'Bài báo nghiên cứu',
    journalId: 'VNUHCM-HS',
    journalName: 'Tạp chí ĐHQG-HCM',
    journalAbbv: 'Sci. Tech. Dev. J.',
    authors: [{ id: 'auth_1', name: 'Nguyễn Văn A', affiliationIds: [1] }],
    affiliations: [{ id: 1, name: 'ĐHQG' }],
    corresponding: { name: 'A', email: 'a@vnu.edu.vn', affiliation: 'VNU' },
    abstract: 'Tóm tắt bài báo',
    keywords: ['test'],
    dates: {
      received: '2026-01-01',
      revised: '2026-02-01',
      accepted: '2026-03-01',
      published: '2026-04-01',
    },
    doi: '10.32508/test.paper.001',
    volume: '1',
    issue: '1',
    year: '2026',
    firstPage: 1,
    lastPage: 10,
  },
  sections: [],
  references: [],
  layoutSettings: DEFAULT_LAYOUT_SETTINGS,
  status: 'draft',
};

describe('EditorLeftDock: Spring Shared Element Transition Popups & Status Management', () => {
  afterEach(() => {
    cleanup();
    mockRouterPush.mockClear();
  });

  it('renders Download dock button and expands spring popup with Word, PDF, ZIP options', () => {
    const onDownloadDocx = vi.fn();
    const onDownloadZip = vi.fn();
    const onDownloadPdf = vi.fn();

    render(
      <EditorLeftDock
        onOpenExtractedDrawer={vi.fn()}
        onOpenLayoutSettings={vi.fn()}
        onSave={vi.fn()}
        saveSuccess={false}
        onRecompile={vi.fn()}
        isCompiling={false}
        onDownloadDocx={onDownloadDocx}
        isExportingDocx={false}
        onDownloadZip={onDownloadZip}
        isExportingZip={false}
        onDownloadPdf={onDownloadPdf}
        compiledPdfUrl="blob:mock-pdf"
        qcScore={95}
      />
    );

    // Initial state: trigger button exists, popup does not
    const downloadBtn = screen.getByTestId('download-dock-btn');
    expect(downloadBtn).toBeDefined();
    expect(screen.queryByTestId('download-popup-menu')).toBeNull();

    // Click trigger to open shared element popup
    fireEvent.click(downloadBtn);
    expect(screen.getByTestId('download-popup-menu')).toBeDefined();
    expect(screen.getByText('Tùy chọn tải xuống')).toBeDefined();
    expect(screen.getByText('Tài liệu Word')).toBeDefined();
    expect(screen.getByText('Bản in PDF')).toBeDefined();
    expect(screen.getByText('Gói nén ZIP')).toBeDefined();

    // Click Word option
    const docxBtn = screen.getByRole('button', { name: /Tài liệu Word/i });
    fireEvent.click(docxBtn);
    expect(onDownloadDocx).toHaveBeenCalledTimes(1);

    // Popup closed after selection
    expect(screen.queryByTestId('download-popup-menu')).toBeNull();
  });

  it('renders Status dock button, opens spring popup, and allows selecting workflow status', () => {
    const onUpdateWorkflowStatus = vi.fn();

    render(
      <EditorLeftDock
        onOpenExtractedDrawer={vi.fn()}
        onOpenLayoutSettings={vi.fn()}
        onSave={vi.fn()}
        saveSuccess={false}
        onRecompile={vi.fn()}
        isCompiling={false}
        onDownloadDocx={vi.fn()}
        isExportingDocx={false}
        onDownloadZip={vi.fn()}
        isExportingZip={false}
        compiledPdfUrl="blob:mock-pdf"
        qcScore={95}
        workflowStatus="draft"
        onUpdateWorkflowStatus={onUpdateWorkflowStatus}
      />
    );

    // Initial: trigger button shows draft
    const statusBtn = screen.getByTestId('status-dock-btn');
    expect(statusBtn).toBeDefined();
    expect(statusBtn.getAttribute('aria-label')).toContain('Bản nháp');

    // Click to open popup
    fireEvent.click(statusBtn);
    expect(screen.getByTestId('status-popup-menu')).toBeDefined();
    expect(screen.getByText('Trạng thái bài báo')).toBeDefined();
    expect(screen.getByText('Sẵn sàng')).toBeDefined();
    expect(screen.getByText('Đang duyệt')).toBeDefined();

    // Select 'ready' status
    const readyOption = screen.getByTestId('status-option-ready');
    fireEvent.click(readyOption);

    expect(onUpdateWorkflowStatus).toHaveBeenCalledWith('ready');
    expect(screen.queryByTestId('status-popup-menu')).toBeNull();
  });
});

describe('Platform-Aware Fullscreen PDF Behavior', () => {
  afterEach(() => {
    cleanup();
    mockRouterPush.mockClear();
    vi.restoreAllMocks();
  });

  it('opens PDF in new browser tab when running on Web platform', () => {
    const windowOpenSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const webPlatform = createFakePlatform({ kind: 'web' });

    render(
      <PlatformProvider value={webPlatform}>
        <EditorLeftDock
          onOpenExtractedDrawer={vi.fn()}
          onOpenLayoutSettings={vi.fn()}
          onSave={vi.fn()}
          saveSuccess={false}
          onRecompile={vi.fn()}
          isCompiling={false}
          onDownloadDocx={vi.fn()}
          isExportingDocx={false}
          onDownloadZip={vi.fn()}
          isExportingZip={false}
          compiledPdfUrl="blob:mock-pdf-url"
          qcScore={95}
          paperId="test_paper_shell_1"
        />
      </PlatformProvider>
    );

    const maxBtn = screen.getByRole('button', { name: /Mở PDF toàn màn hình trong tab mới/i });
    fireEvent.click(maxBtn);

    expect(windowOpenSpy).toHaveBeenCalledWith('blob:mock-pdf-url', '_blank', 'noreferrer');
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('navigates to /preview route when running on Desktop platform', () => {
    const desktopPlatform = createFakePlatform({ kind: 'desktop' });

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorLeftDock
          onOpenExtractedDrawer={vi.fn()}
          onOpenLayoutSettings={vi.fn()}
          onSave={vi.fn()}
          saveSuccess={false}
          onRecompile={vi.fn()}
          isCompiling={false}
          onDownloadDocx={vi.fn()}
          isExportingDocx={false}
          onDownloadZip={vi.fn()}
          isExportingZip={false}
          compiledPdfUrl="blob:mock-pdf-url"
          qcScore={95}
          paperId="test_paper_shell_1"
        />
      </PlatformProvider>
    );

    const maxBtn = screen.getByRole('button', { name: /Mở PDF toàn màn hình/i });
    fireEvent.click(maxBtn);

    expect(mockRouterPush).toHaveBeenCalledWith('/preview?id=test_paper_shell_1');
  });
});

describe('PreviewPage (/preview): Dedicated Desktop Fullscreen Page', () => {
  afterEach(() => {
    cleanup();
    mockRouterPush.mockClear();
  });

  it('renders minimalist Left Dock with only the Back button and navigates to /editor on click', async () => {
    render(
      <PaperProvider>
        <PreviewPage />
      </PaperProvider>
    );

    // Dock has ONLY 1 button (Back button) - wait for paper to load
    const backBtn = await screen.findByTestId('preview-back-dock-btn');
    expect(backBtn).toBeDefined();

    // Verify there is no Save, Recompile, or QC buttons on this preview-only dock
    expect(screen.queryByTestId('download-dock-btn')).toBeNull();
    expect(screen.queryByTestId('status-dock-btn')).toBeNull();

    // Click back button
    fireEvent.click(backBtn);
    expect(mockRouterPush).toHaveBeenCalledWith('/editor?id=test_paper_shell_1');
  });
});
