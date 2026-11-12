// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';

// Stub global.fetch immediately
vi.stubGlobal(
  'fetch',
  vi.fn(async () => {
    return new Response(new Uint8Array([1, 2, 3]), {
      status: 200,
      headers: {
        'content-type': 'application/pdf',
        'x-compilation-time-ms': '150',
        'x-compiler-engine': 'XeLaTeX',
      },
    });
  })
);

const { mockRouterPush } = vi.hoisted(() => ({
  mockRouterPush: vi.fn(),
}));

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/editor',
  useParams: () => ({ id: 'hs630' }),
}));

// Mock framer-motion to prevent unhandled animation aborts in happy-dom
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

import { UnifiedEditorView } from '@/components/editor/UnifiedEditorView';
import { TableSpreadsheetModal } from '@/components/editor/TableSpreadsheetModal';
import { FigureSettingsModal } from '@/components/editor/FigureSettingsModal';
import {
  useEditorCompilation,
  useEditorExport,
  useEditorShortcuts,
} from '@/components/editor/hooks';
import { PaperProvider } from '@/context/PaperContext';
import {
  CompletePaper,
  DEFAULT_LAYOUT_SETTINGS,
  PaperFigure,
} from '@/types/paper';
import type { Cell } from '@structpaper/doc-model';
import { defaultDatabase, IndexedDbAssetRepo } from '@structpaper/storage';

const mockPaper: CompletePaper = {
  id: 'test_paper_shell_1',
  metadata: {
    title: 'Nghiên cứu cấu trúc tự động hóa bản thảo',
    titleEn: 'Automated Manuscript Structuring Study',
    articleType: 'Bài báo nghiên cứu',
    journalId: 'VNUHCM-HS',
    journalName: 'Tạp chí ĐHQG-HCM Health Sciences',
    journalAbbv: 'Sci. Tech. Dev. J. - Health Sci.',
    authors: [
      { id: 'auth_1', name: 'Nguyễn Văn A', affiliationIds: [1] },
      { id: 'auth_2', name: 'Trần Thị B', affiliationIds: [1] },
    ],
    affiliations: [
      { id: 1, name: 'Đại học Quốc gia TP.HCM', nameEn: 'VNUHCM' },
    ],
    corresponding: {
      name: 'Nguyễn Văn A',
      email: 'a@vnuhcm.edu.vn',
      affiliation: 'Đại học Quốc gia TP.HCM',
    },
    abstract: 'Đây là tóm tắt thử nghiệm cho bài báo nghiên cứu.',
    keywords: ['nghiên cứu', 'tự động', 'latex'],
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
  sections: [
    {
      id: 'sec_1',
      type: 'h1',
      title: '1. ĐẶT VẤN ĐỀ',
      content: '',
    },
    {
      id: 'sec_2',
      type: 'paragraph',
      content: 'Nội dung chi tiết của phần đặt vấn đề nghiên cứu.',
    },
    {
      id: 'sec_tbl_1',
      type: 'table',
      content: 'Bảng 1: Dữ liệu mẫu',
      table: {
        id: 'tbl_sample_1',
        num: 1,
        caption: 'Bảng 1: Dữ liệu mẫu',
        headers: ['Thông số', 'Giá trị'],
        rows: [['A', '10'], ['B', '20']],
      },
    },
  ],
  references: [
    {
      id: 1,
      raw: '1. Author et al. StructPaper Architecture (2026).',
      isCited: true,
      citationCount: 1,
    },
  ],
  layoutSettings: DEFAULT_LAYOUT_SETTINGS,
};

describe('Task 4.2: UnifiedEditorView & Editor Shell', () => {
  afterEach(() => {
    cleanup();
    mockRouterPush.mockClear();
  });

  it('renders layout shell: dock, split pane, tabs, and preview', async () => {
    const onUpdatePaper = vi.fn();

    render(
      <PaperProvider>
        <UnifiedEditorView paper={mockPaper} onUpdatePaper={onUpdatePaper} />
      </PaperProvider>
    );

    // Dock buttons via aria-label
    expect(screen.getByRole('button', { name: /Lưu thay đổi bản thảo/i })).toBeDefined();
    expect(screen.getAllByRole('button', { name: /Biên dịch/i }).length).toBeGreaterThanOrEqual(1);

    // Default tab is 'metadata'
    expect(screen.getAllByText(/Thông tin cơ bản bài báo/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByDisplayValue('Nghiên cứu cấu trúc tự động hóa bản thảo').length).toBeGreaterThanOrEqual(1);

    // Split layout & Preview
    expect(screen.getAllByText(/PDF/i).length).toBeGreaterThanOrEqual(1);
  });

  it('switches tabs smoothly: authors, abstract, sections, refs, citation', async () => {
    const onUpdatePaper = vi.fn();

    render(
      <PaperProvider>
        <UnifiedEditorView paper={mockPaper} onUpdatePaper={onUpdatePaper} />
      </PaperProvider>
    );

    // Switch to 'authors' tab via title
    const authorsTabBtn = screen.getAllByTitle('Tác giả')[0];
    fireEvent.click(authorsTabBtn);
    expect(screen.getAllByDisplayValue('Nguyễn Văn A').length).toBeGreaterThanOrEqual(1);

    // Switch to 'abstract' tab via title
    const abstractTabBtn = screen.getAllByTitle('Tóm tắt')[0];
    fireEvent.click(abstractTabBtn);
    expect(screen.getAllByText(/Tóm tắt & Từ khóa/i).length).toBeGreaterThanOrEqual(1);

    // Switch to 'sections' tab via title
    const sectionsTabBtn = screen.getAllByTitle('Nội dung')[0];
    fireEvent.click(sectionsTabBtn);
    expect(screen.getAllByDisplayValue('1. ĐẶT VẤN ĐỀ').length).toBeGreaterThanOrEqual(1);

    // Switch to 'refs' tab via title
    const refsTabBtn = screen.getAllByTitle('Tài liệu tham khảo')[0];
    fireEvent.click(refsTabBtn);
    expect(screen.getAllByText(/Author et al\. StructPaper Architecture/i).length).toBeGreaterThanOrEqual(1);

    // Switch to 'citation' tab via title
    const citationTabBtn = screen.getAllByTitle('Trích dẫn')[0];
    fireEvent.click(citationTabBtn);
    expect(screen.getAllByText(/Trích Dẫn Bài Báo Này/i).length).toBeGreaterThanOrEqual(1);
  });

  it('opens and closes ExtractedContentDrawer and LayoutSettingsDrawer', async () => {
    const onUpdatePaper = vi.fn();

    render(
      <PaperProvider>
        <UnifiedEditorView paper={mockPaper} onUpdatePaper={onUpdatePaper} />
      </PaperProvider>
    );

    // Open Layout Settings Drawer from Left Dock
    const layoutBtn = screen.getByRole('button', { name: /Cài đặt dàn trang PDF/i });
    fireEvent.click(layoutBtn);
    expect(screen.getAllByText(/Cài đặt dàn trang PDF/i).length).toBeGreaterThanOrEqual(1);

    // Close Layout Settings Drawer
    const closeButtons = screen.getAllByTitle(/Đóng/i);
    if (closeButtons[0]) {
      fireEvent.click(closeButtons[0]);
    }

    // Open Extracted Content Drawer from Left Dock
    const extractedBtn = screen.getByRole('button', { name: /Nội dung trích xuất bản thảo/i });
    fireEvent.click(extractedBtn);
    expect(screen.getAllByText(/Nội Dung Trích Xuất Bản Thảo/i).length).toBeGreaterThanOrEqual(1);
  });

  it('navigates directly to /papers when back button is clicked without dirty changes', async () => {
    const onUpdatePaper = vi.fn();

    render(
      <PaperProvider>
        <UnifiedEditorView paper={mockPaper} onUpdatePaper={onUpdatePaper} />
      </PaperProvider>
    );

    const backBtn = screen.getAllByRole('button', { name: /Quay lại danh sách bài báo/i })[0];
    fireEvent.click(backBtn);

    expect(mockRouterPush).toHaveBeenCalledWith('/papers');
    expect(screen.queryByTestId('editor-exit-confirm-modal')).toBeNull();
  });

  it('intercepts back button when dirty, shows confirm modal, cancels or discards without saving', async () => {
    const onUpdatePaper = vi.fn();

    render(
      <PaperProvider>
        <UnifiedEditorView paper={mockPaper} onUpdatePaper={onUpdatePaper} />
      </PaperProvider>
    );

    // Make dirty by editing title
    // the metadata field (the menu bar also shows the name, but renames there only commit on Enter/blur)
    const titleInput = screen.getAllByDisplayValue('Nghiên cứu cấu trúc tự động hóa bản thảo').find((e) => e.tagName === 'TEXTAREA') as HTMLElement;
    fireEvent.change(titleInput, { target: { value: 'Tiêu đề đã chỉnh sửa' } });

    // Click back button
    const backBtn = screen.getAllByRole('button', { name: /Quay lại danh sách bài báo/i })[0];
    fireEvent.click(backBtn);

    // Modal should be open, router.push not called yet
    expect(screen.getByTestId('editor-exit-confirm-modal')).toBeDefined();
    expect(mockRouterPush).not.toHaveBeenCalled();

    // Click Cancel ("Ở lại")
    const cancelBtn = screen.getByRole('button', { name: 'Ở lại' });
    fireEvent.click(cancelBtn);
    expect(mockRouterPush).not.toHaveBeenCalled();

    // Click back button again
    fireEvent.click(backBtn);

    // Click "Rời đi không lưu" (secondaryAction)
    const discardBtn = screen.getByTestId('editor-discard-and-exit-btn');
    fireEvent.click(discardBtn);

    expect(mockRouterPush).toHaveBeenCalledWith('/papers');
  });

  it('saves changes and navigates when "Lưu & Thoát" is clicked in confirm modal', async () => {
    const onUpdatePaper = vi.fn();

    render(
      <PaperProvider>
        <UnifiedEditorView paper={mockPaper} onUpdatePaper={onUpdatePaper} />
      </PaperProvider>
    );

    // Make dirty by editing title
    // the metadata field (the menu bar also shows the name, but renames there only commit on Enter/blur)
    const titleInput = screen.getAllByDisplayValue('Nghiên cứu cấu trúc tự động hóa bản thảo').find((e) => e.tagName === 'TEXTAREA') as HTMLElement;
    fireEvent.change(titleInput, { target: { value: 'Tiêu đề lưu và thoát' } });

    // Click back button
    const backBtn = screen.getAllByRole('button', { name: /Quay lại danh sách bài báo/i })[0];
    fireEvent.click(backBtn);

    expect(screen.getByTestId('editor-exit-confirm-modal')).toBeDefined();

    // Click "Lưu & Thoát"
    const saveAndExitBtn = screen.getByTestId('editor-save-and-exit-btn');
    await act(async () => {
      fireEvent.click(saveAndExitBtn);
    });

    expect(onUpdatePaper).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/papers');
    });
  });
});

describe('Task 4.2: Hooks (useEditorCompilation, useEditorExport, useEditorShortcuts)', () => {
  afterEach(() => {
    cleanup();
  });

  it('useEditorCompilation integrates with @structpaper/compiler-client scheduler and adapter', async () => {
    const onUpdatePaper = vi.fn();

    function TestComp() {
      const compilation = useEditorCompilation({
        paper: mockPaper,
        formData: mockPaper,
        onUpdatePaper,
      });

      return (
        <div>
          <button
            onClick={() => compilation.compileLatexToPdf()}
            data-testid="btn-compile"
          >
            Compile
          </button>
          <span data-testid="comp-status">
            {compilation.isCompilingPdf ? 'compiling' : 'idle'}
          </span>
          <span data-testid="pdf-url">{compilation.compiledPdfUrl || 'none'}</span>
        </div>
      );
    }

    render(<TestComp />);

    // Wait for initial mount compilation to settle
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60));
    });

    const compileBtn = screen.getByTestId('btn-compile');
    await act(async () => {
      fireEvent.click(compileBtn);
      await new Promise((r) => setTimeout(r, 60));
    });

    expect(screen.getByTestId('pdf-url').textContent).toMatch(/^blob:/);
  });

  it('useEditorShortcuts listens to Ctrl+S and triggers onSave', () => {
    const onSave = vi.fn();

    function TestComp() {
      useEditorShortcuts({ onSave });
      return <div>Shortcuts active</div>;
    }

    render(<TestComp />);

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    expect(onSave).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 's', metaKey: true });
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it('useEditorExport exposes download methods without crash', async () => {
    function TestComp() {
      const {
        handleDownloadDocx,
        handleDownloadZip,
        handleDownloadPdf,
        isExportingDocx,
      } = useEditorExport({
        formData: mockPaper,
        compiledPdfUrl: 'blob:mock-url',
        compileLatexToPdf: async () => 'blob:mock-url',
      });

      return (
        <div>
          <button data-testid="btn-docx" onClick={() => handleDownloadDocx()}>
            DOCX
          </button>
          <button data-testid="btn-zip" onClick={() => handleDownloadZip()}>
            ZIP
          </button>
          <button data-testid="btn-pdf" onClick={() => handleDownloadPdf()}>
            PDF
          </button>
          <span data-testid="export-status">{isExportingDocx ? 'exporting' : 'ready'}</span>
        </div>
      );
    }

    render(<TestComp />);
    expect(screen.getByTestId('export-status').textContent).toBe('ready');
  });
});

describe('Task 4.2: Modals Refactoring & Enhancements', () => {
  afterEach(() => {
    cleanup();
  });

  it('TableSpreadsheetModal supports new doc-model Cell[][] matrix and backwards compatible PaperTable', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const sampleDocModelGrid: Cell[][] = [
      [
        {
          content: [{ t: 'text', v: 'Tiêu đề 1', marks: ['b'] }],
          rowSpan: 1,
          colSpan: 1,
          align: 'l',
          header: true,
        },
        {
          content: [{ t: 'text', v: 'Tiêu đề 2', marks: ['b'] }],
          rowSpan: 1,
          colSpan: 1,
          align: 'r',
          header: true,
        },
      ],
      [
        {
          content: [{ t: 'text', v: 'Dữ liệu A' }],
          rowSpan: 1,
          colSpan: 1,
          align: 'l',
          header: false,
        },
        {
          content: [{ t: 'text', v: '100' }],
          rowSpan: 1,
          colSpan: 1,
          align: 'r',
          header: false,
        },
      ],
    ];

    render(
      <TableSpreadsheetModal
        isOpen={true}
        table={mockPaper.sections[2].table!}
        grid={sampleDocModelGrid}
        onSave={onSave}
        onClose={onClose}
      />
    );

    // Modal renders cell inputs (both in formula bar and cell grid)
    expect(screen.getAllByDisplayValue('Tiêu đề 1').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByDisplayValue('Dữ liệu A')).toBeDefined();

    // Click Save & Apply
    const saveBtn = screen.getByTitle(/Lưu thay đổi vào bài báo/i);
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalled();
    const [savedTable, savedGrid] = onSave.mock.calls[0];

    // Check backwards compatibility
    expect(savedTable.headers[0]).toBe('Tiêu đề 1');
    expect(savedTable.rows[0][0]).toBe('Dữ liệu A');

    // Check doc-model Cell[][] matrix
    expect(savedGrid).toBeDefined();
    expect(savedGrid[0][0].content[0].v).toBe('Tiêu đề 1');
    expect(savedGrid[0][0].header).toBe(true);
    expect(savedTable.grid).toBeDefined();
  });

  it('FigureSettingsModal supports SHA-256 asset linking with IndexedDbAssetRepo', async () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    const mockFigure: PaperFigure = {
      id: 'fig_1',
      num: 1,
      caption: 'Hình 1: Sơ đồ kiến trúc',
      src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      assetId: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };

    // Pre-populate IndexedDB asset for test
    const repo = new IndexedDbAssetRepo(defaultDatabase);
    await repo.save(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      new Blob(['pixel'], { type: 'image/png' })
    );

    render(
      <FigureSettingsModal
        isOpen={true}
        figure={mockFigure}
        onSave={onSave}
        onClose={onClose}
      />
    );

    // Section 5 exists with asset SHA-256 input
    const input = screen.getByPlaceholderText(/SHA-256 asset hash/i) as HTMLInputElement;
    expect(input.value).toBe(mockFigure.assetId);

    // Click Save
    const saveBtn = screen.getByTitle(/Lưu các thông số cài đặt này cho hình ảnh/i);
    fireEvent.click(saveBtn);

    expect(onSave).toHaveBeenCalled();
    const savedFig = onSave.mock.calls[0][0] as PaperFigure;
    expect(savedFig.assetId).toBe(mockFigure.assetId);
  });

  it('marks manuscript dirty when renamed from DocumentMenuBar so back navigation asks for confirmation', () => {
    const onUpdatePaper = vi.fn();

    render(
      <PaperProvider>
        <UnifiedEditorView paper={mockPaper} onUpdatePaper={onUpdatePaper} />
      </PaperProvider>
    );

    const docNameInput = screen.getByLabelText('Tên tài liệu') as HTMLInputElement;
    expect(docNameInput).toBeTruthy();

    fireEvent.change(docNameInput, { target: { value: 'Tên hiển thị mới' } });
    fireEvent.blur(docNameInput);

    expect(screen.getByTestId('save-status').getAttribute('data-state')).toBe('dirty');

    const backBtn = screen.getAllByRole('button', { name: /Quay lại danh sách bài báo/i })[0];
    fireEvent.click(backBtn);

    expect(screen.getByTestId('editor-exit-confirm-modal')).toBeDefined();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
