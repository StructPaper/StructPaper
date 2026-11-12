// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { PlatformProvider, createFakePlatform } from '@structpaper/platform';

const { mockSavePaper, mockRouterPush } = vi.hoisted(() => ({
  mockSavePaper: vi.fn().mockResolvedValue(true),
  mockRouterPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/editor',
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ id: 'hs630' }),
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

vi.mock('@/hooks', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('@/hooks');
  return {
    ...actual,
    usePaperStorage: () => ({
      savePaper: mockSavePaper,
      loadPaper: vi.fn(),
      listPapers: vi.fn().mockResolvedValue([]),
      deletePaper: vi.fn(),
      isReady: true,
    }),
  };
});

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

import { EditorSessionProvider } from '@/context/EditorSessionContext';
import { PaperProvider } from '@/context/PaperContext';
import { DesktopTitleBar } from '@/components/titlebar';
import { UnifiedEditorView } from '@/components/editor/UnifiedEditorView';
import { sileo } from '@/components/DynamicIslandToast';
import { createEmptyPaper, CompletePaper } from '@/types/paper';
import { migrateV1toV2 } from '@structpaper/doc-model';
import { defaultDatabase, IndexedDbManuscriptRepo } from '@structpaper/storage';

function createTestPaper(overrides: Partial<CompletePaper> = {}): CompletePaper {
  const base = createEmptyPaper('VNUHCM-HS');
  return {
    ...base,
    id: 'paper-titlebar-e2e-1',
    displayName: 'Bản thảo hiển thị Y khoa 01',
    metadata: {
      ...base.metadata,
      title: 'Tiêu đề học thuật chi tiết của bài báo khoa học ban đầu',
      authors: [{ id: 'a1', name: 'Nguyễn Văn A', affiliationIds: [1] }],
      affiliations: [{ id: 1, name: 'ĐHQG TP.HCM' }],
      abstract: 'Tóm tắt thử nghiệm',
      keywords: ['structpaper'],
    },
    ...overrides,
  };
}

describe('Integration: DesktopTitleBar AutoSave toggle <-> UnifiedEditorView', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    mockSavePaper.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('displays paper displayName (not academic title), preserves it across title edits, and controls autosave cleanly', async () => {
    const desktopPlatform = createFakePlatform({ kind: 'desktop' });
    const paper = createTestPaper();
    const onUpdatePaper = vi.fn();

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <PaperProvider>
            <DesktopTitleBar />
            <UnifiedEditorView paper={paper} onUpdatePaper={onUpdatePaper} />
          </PaperProvider>
        </EditorSessionProvider>
      </PlatformProvider>
    );

    expect(screen.getByTestId('titlebar-paper-title').textContent).toBe('Bản thảo hiển thị Y khoa 01');
    expect(screen.getByTestId('titlebar-save-state').getAttribute('data-save-state')).toBe('saved');

    // 1. Toggle AutoSave OFF in DesktopTitleBar
    const autoSaveToggle = screen.getByTestId('titlebar-autosave-toggle');
    expect(autoSaveToggle.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(autoSaveToggle);
    expect(autoSaveToggle.getAttribute('aria-checked')).toBe('false');

    // Clear any initial mount compile/save calls if any before editing
    mockSavePaper.mockClear();

    // 2. Edit academic title inside UnifiedEditorView -> save state turns Unsaved, but displayName stays unchanged
    const titleInput = screen.getAllByPlaceholderText('Nhập tựa đề bài báo tiếng Việt...')[0];
    fireEvent.change(titleInput, { target: { value: 'Tiêu đề học thuật đã chỉnh sửa rất dài' } });

    expect(screen.getByTestId('titlebar-paper-title').textContent).toBe(
      'Bản thảo hiển thị Y khoa 01'
    );
    expect(screen.getByTestId('titlebar-save-state').getAttribute('data-save-state')).toBe('unsaved');
    expect(screen.getByTestId('titlebar-save-state').textContent).toContain('Unsaved');

    // 3. Advance past debounce interval (1500ms) -> must NOT save automatically
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockSavePaper).not.toHaveBeenCalled();
    expect(screen.getByTestId('titlebar-save-state').getAttribute('data-save-state')).toBe('unsaved');

    // 4. Click Unsaved pill in TitleBar -> triggers manual save -> Saved
    await act(async () => {
      fireEvent.click(screen.getByTestId('titlebar-save-state'));
    });
    expect(mockSavePaper).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('titlebar-save-state').getAttribute('data-save-state')).toBe('saved');

    // 5. Edit academic title again while AutoSave is OFF -> turns Unsaved -> turn AutoSave back ON -> automatically saves
    fireEvent.change(titleInput, { target: { value: 'Tiêu đề học thuật tự lưu sau khi bật lại' } });
    expect(screen.getByTestId('titlebar-save-state').getAttribute('data-save-state')).toBe('unsaved');

    fireEvent.click(autoSaveToggle);
    expect(autoSaveToggle.getAttribute('aria-checked')).toBe('true');

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(mockSavePaper).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('titlebar-save-state').getAttribute('data-save-state')).toBe('saved');
    expect(screen.getByTestId('titlebar-paper-title').textContent).toBe(
      'Bản thảo hiển thị Y khoa 01'
    );
  });

  it('hydrates displayName from IndexedDB when cached paper prop lacks displayName instead of falling back to academic title', async () => {
    vi.useRealTimers();
    const repo = new IndexedDbManuscriptRepo(defaultDatabase);
    const cachedPaper = createTestPaper({
      id: 'paper-hydrate-displayname-1',
      displayName: undefined,
    });
    const v2Doc = migrateV1toV2(cachedPaper as any);
    await repo.save(v2Doc, {
      id: cachedPaper.id,
      displayName: 'Tên hiển thị riêng từ IndexedDB',
    });

    const desktopPlatform = createFakePlatform({ kind: 'desktop' });

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <PaperProvider>
            <DesktopTitleBar />
            <UnifiedEditorView paper={cachedPaper} onUpdatePaper={vi.fn()} />
          </PaperProvider>
        </EditorSessionProvider>
      </PlatformProvider>
    );

    await vi.waitFor(() => {
      expect(screen.getByTestId('titlebar-paper-title').textContent).toBe(
        'Tên hiển thị riêng từ IndexedDB'
      );
    });
  });

  it('updates DesktopTitleBar immediately when displayName is edited via Quick Edit modal without altering academic title', async () => {
    vi.useRealTimers();
    const repo = new IndexedDbManuscriptRepo(defaultDatabase);
    const paper = createTestPaper({
      id: 'paper-quickedit-sync-1',
      displayName: 'Tên hiển thị cũ',
    });
    await repo.save(migrateV1toV2(paper as any), {
      id: paper.id,
      displayName: 'Tên hiển thị cũ',
    });

    const onUpdatePaper = vi.fn();
    const desktopPlatform = createFakePlatform({ kind: 'desktop' });

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <PaperProvider>
            <DesktopTitleBar />
            <UnifiedEditorView paper={paper} onUpdatePaper={onUpdatePaper} />
          </PaperProvider>
        </EditorSessionProvider>
      </PlatformProvider>
    );

    expect(screen.getByTestId('titlebar-paper-title').textContent).toBe('Tên hiển thị cũ');

    // Open Quick Edit modal from dock
    await act(async () => {
      fireEvent.click(screen.getAllByRole('button', { name: 'Sửa thông tin bài báo' })[0]);
    });

    const displayNameInput = await screen.findByTestId('quick-edit-displayname');
    fireEvent.change(displayNameInput, { target: { value: 'Tên hiển thị mới sau Quick Edit' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('quick-edit-submit'));
    });

    await vi.waitFor(() => {
      expect(screen.getByTestId('titlebar-paper-title').textContent).toBe(
        'Tên hiển thị mới sau Quick Edit'
      );
    });

    expect(onUpdatePaper).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'paper-quickedit-sync-1',
        displayName: 'Tên hiển thị mới sau Quick Edit',
      })
    );
  });

  it('hides DocumentMenuBar on Desktop via platform slot, exposes File menu & inline rename in TitleBar, and shows CloudOff on local-only save', async () => {
    const desktopPlatform = createFakePlatform({ kind: 'desktop' });
    const paper = createTestPaper({ id: 'paper-desktop-slot-1', displayName: 'Tên ban đầu' });

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <PaperProvider>
            <DesktopTitleBar />
            <UnifiedEditorView paper={paper} onUpdatePaper={vi.fn()} />
          </PaperProvider>
        </EditorSessionProvider>
      </PlatformProvider>
    );

    // DocumentMenuBar must be suppressed on Desktop (handled via DesktopTitleBar)
    expect(screen.queryByTestId('save-status')).toBeNull();
    expect(screen.getByTestId('titlebar-file-menu-trigger')).toBeTruthy();

    // Open "Tệp" -> "Mở…" opens OpenDocumentDialog
    fireEvent.click(screen.getByTestId('titlebar-file-menu-trigger'));
    fireEvent.click(screen.getByTestId('titlebar-file-open'));
    expect(screen.getByText(/Mở tài liệu/i)).toBeTruthy();

    // Inline rename from TitleBar updates displayName, marks Unsaved, then saves with CloudOff icon (local-only offline mode in test)
    fireEvent.click(screen.getByTestId('titlebar-paper-title'));
    const renameInput = screen.getByTestId('titlebar-paper-title-input') as HTMLInputElement;
    fireEvent.change(renameInput, { target: { value: 'Tên mới trên Desktop' } });
    fireEvent.keyDown(renameInput, { key: 'Enter' });

    expect(screen.getByTestId('titlebar-paper-title').textContent).toBe('Tên mới trên Desktop');
    expect(screen.getByTestId('titlebar-save-state').getAttribute('data-save-state')).toBe('unsaved');

    await act(async () => {
      fireEvent.click(screen.getByTestId('titlebar-save-state'));
    });

    expect(mockSavePaper).toHaveBeenCalledWith(
      expect.objectContaining({ displayName: 'Tên mới trên Desktop' })
    );
    expect(screen.getByTestId('titlebar-save-state').getAttribute('data-save-state')).toBe('saved');
    expect(screen.getByTestId('titlebar-local-only-icon')).toBeTruthy();
  });

  it('shows error toast and refuses Saved state when local save returns false on manual Save', async () => {
    const errSpy = vi.spyOn(sileo, 'error');
    const okSpy = vi.spyOn(sileo, 'success');
    mockSavePaper.mockResolvedValueOnce(false);

    const desktopPlatform = createFakePlatform({ kind: 'desktop' });
    const paper = createTestPaper({ id: 'paper-save-fail-1', displayName: 'Bản lỗi lưu' });

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <PaperProvider>
            <DesktopTitleBar />
            <UnifiedEditorView paper={paper} onUpdatePaper={vi.fn()} />
          </PaperProvider>
        </EditorSessionProvider>
      </PlatformProvider>
    );

    const titleInput = screen.getAllByPlaceholderText('Nhập tựa đề bài báo tiếng Việt...')[0];
    fireEvent.change(titleInput, { target: { value: 'Thay đổi chưa lưu' } });

    await act(async () => {
      fireEvent.click(screen.getByTestId('titlebar-save-state'));
    });

    expect(errSpy).toHaveBeenCalled();
    expect(okSpy).not.toHaveBeenCalled();
    expect(screen.getByTestId('titlebar-save-state').getAttribute('data-save-state')).toBe('error');

    errSpy.mockRestore();
    okSpy.mockRestore();
  });
});
