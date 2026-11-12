// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import {
  PlatformProvider,
  createFakePlatform,
  type WindowService,
  type MaximizedChangeListener,
} from '@structpaper/platform';

const { mockPathname, mockRouterPush } = vi.hoisted(() => ({
  mockPathname: vi.fn<() => string>(() => '/papers'),
  mockRouterPush: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname(),
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

import { EditorSessionProvider, useEditorSession } from '@/context/EditorSessionContext';
import { DesktopChromeShell, DesktopTitleBar } from '@/components/titlebar';
import { StickyHubToolbar } from '@/components/layout/StickyHubToolbar';
import { Sidebar } from '@/components/Sidebar';
import { STRUCTPAPER_AUTOSAVE_PREF_KEY } from '@/lib/editor/autosave-preferences';

function createSpyWindowService(initialMaximized = false): {
  service: WindowService;
  emitMaximized: (next: boolean) => void;
} {
  let listeners: MaximizedChangeListener[] = [];
  let maximized = initialMaximized;

  const service: WindowService = {
    isSupported: () => true,
    minimize: vi.fn().mockResolvedValue(undefined),
    toggleMaximize: vi.fn().mockImplementation(async () => {
      maximized = !maximized;
    }),
    close: vi.fn().mockResolvedValue(undefined),
    startDragging: vi.fn().mockResolvedValue(undefined),
    isMaximized: vi.fn().mockImplementation(async () => maximized),
    onMaximizedChange: vi.fn().mockImplementation((listener: MaximizedChangeListener) => {
      listeners.push(listener);
      listener(maximized);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    }),
  };

  return {
    service,
    emitMaximized: (next: boolean) => {
      maximized = next;
      listeners.forEach((l) => l(next));
    },
  };
}

const NOOP_MANUAL_SAVE = () => {};

function EditorSessionBridgeMock({
  title = 'Phân tích dữ liệu lâm sàng VNUHCM',
  saveState = 'saved',
  rawSaveState,
  savedAt,
  exporting,
  onManualSave = NOOP_MANUAL_SAVE,
  onRename,
  onNew,
  onOpen,
  onExport,
  onKeepMine,
}: {
  title?: string;
  saveState?: 'saved' | 'saving' | 'unsaved' | 'error';
  rawSaveState?: 'idle' | 'dirty' | 'saving' | 'saved' | 'saved-local' | 'conflict' | 'error';
  savedAt?: number | null;
  exporting?: { docx?: boolean; pdf?: boolean; xml?: boolean };
  onManualSave?: () => void;
  onRename?: (name: string) => void;
  onNew?: () => void;
  onOpen?: () => void;
  onExport?: (format: 'docx' | 'pdf' | 'xml') => void;
  onKeepMine?: () => void;
}) {
  const { setDocumentSession } = useEditorSession();

  React.useEffect(() => {
    setDocumentSession({
      paperId: 'paper-123',
      title,
      saveState,
      rawSaveState,
      savedAt,
      exporting,
      onManualSave,
      onRename,
      onNew,
      onOpen,
      onExport,
      onKeepMine,
    });
    return () => setDocumentSession(null);
  }, [
    title,
    saveState,
    rawSaveState,
    savedAt,
    exporting,
    onManualSave,
    onRename,
    onNew,
    onOpen,
    onExport,
    onKeepMine,
    setDocumentSession,
  ]);

  return null;
}

describe('DesktopTitleBar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockPathname.mockReturnValue('/papers');
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('does not render on Web platform', () => {
    const webPlatform = createFakePlatform({ kind: 'web' });
    render(
      <PlatformProvider value={webPlatform}>
        <EditorSessionProvider>
          <DesktopTitleBar />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    expect(screen.queryByTestId('desktop-titlebar')).toBeNull();
  });

  it.each(['/', '/papers', '/upload', '/templates', '/settings', '/preview'])(
    'renders only App Logo and 3 window controls on non-editor route "%s"',
    (route) => {
      mockPathname.mockReturnValue(route);
      const { service } = createSpyWindowService(false);
      const desktopPlatform = createFakePlatform({
        kind: 'desktop',
        overrides: { window: service },
      });

      render(
        <PlatformProvider value={desktopPlatform}>
          <EditorSessionProvider>
            <DesktopTitleBar />
          </EditorSessionProvider>
        </PlatformProvider>
      );

      expect(screen.getByTestId('desktop-titlebar')).toBeTruthy();
      expect(screen.getByTestId('titlebar-logo')).toBeTruthy();
      expect(screen.getByTestId('titlebar-minimize-btn')).toBeTruthy();
      expect(screen.getByTestId('titlebar-maximize-btn')).toBeTruthy();
      expect(screen.getByTestId('titlebar-close-btn')).toBeTruthy();

      expect(screen.queryByTestId('titlebar-autosave-toggle')).toBeNull();
      expect(screen.queryByTestId('titlebar-document-status')).toBeNull();
    }
  );

  it('renders App Icon, AutoSave toggle, Paper display title, save state, and 3 controls on /editor', () => {
    mockPathname.mockReturnValue('/editor');
    const { service } = createSpyWindowService(false);
    const desktopPlatform = createFakePlatform({
      kind: 'desktop',
      overrides: { window: service },
    });

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <EditorSessionBridgeMock title="Bản thảo mẫu tiếng Anh" saveState="saved" />
          <DesktopTitleBar />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    expect(screen.getByTestId('titlebar-logo')).toBeTruthy();
    const toggle = screen.getByTestId('titlebar-autosave-toggle');
    expect(toggle.getAttribute('role')).toBe('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    expect(screen.getByTestId('titlebar-paper-title').textContent).toBe('Bản thảo mẫu tiếng Anh');
    const stateBadge = screen.getByTestId('titlebar-save-state');
    expect(stateBadge.getAttribute('data-save-state')).toBe('saved');
    expect(stateBadge.textContent).toContain('Saved');
  });

  it('toggles AutoSave On/Off, persists preference, and displays all save states cleanly', () => {
    mockPathname.mockReturnValue('/editor');
    const onManualSave = vi.fn();
    const { service } = createSpyWindowService(false);
    const desktopPlatform = createFakePlatform({
      kind: 'desktop',
      overrides: { window: service },
    });

    const { rerender } = render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <EditorSessionBridgeMock
            title="Bài báo Y học ĐHQG"
            saveState="unsaved"
            onManualSave={onManualSave}
          />
          <DesktopTitleBar />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    const toggle = screen.getByTestId('titlebar-autosave-toggle');
    expect(toggle.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(window.localStorage.getItem(STRUCTPAPER_AUTOSAVE_PREF_KEY)).toBe('false');

    const statusBadge = screen.getByTestId('titlebar-save-state');
    expect(statusBadge.getAttribute('data-save-state')).toBe('unsaved');
    expect(statusBadge.textContent).toContain('Unsaved');

    // Clicking Unsaved status badge triggers manual save action
    fireEvent.click(statusBadge);
    expect(onManualSave).toHaveBeenCalledTimes(1);

    rerender(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <EditorSessionBridgeMock title="Bài báo Y học ĐHQG" saveState="saving" />
          <DesktopTitleBar />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    expect(screen.getByTestId('titlebar-save-state').textContent).toContain('Saving...');
    expect(screen.getByTestId('titlebar-save-state').getAttribute('data-save-state')).toBe('saving');
  });

  it('invokes minimize, toggleMaximize, close, startDragging, and tracks maximize state', async () => {
    mockPathname.mockReturnValue('/editor');
    const { service, emitMaximized } = createSpyWindowService(false);
    const desktopPlatform = createFakePlatform({
      kind: 'desktop',
      overrides: { window: service },
    });

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <EditorSessionBridgeMock />
          <DesktopTitleBar />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    fireEvent.click(screen.getByTestId('titlebar-minimize-btn'));
    fireEvent.click(screen.getByTestId('titlebar-maximize-btn'));
    fireEvent.click(screen.getByTestId('titlebar-close-btn'));

    expect(service.minimize).toHaveBeenCalledTimes(1);
    expect(service.toggleMaximize).toHaveBeenCalledTimes(1);
    expect(service.close).toHaveBeenCalledTimes(1);

    // Sync maximized indicator state
    expect(screen.getByTestId('titlebar-maximize-btn').getAttribute('data-maximized')).toBe('false');
    act(() => {
      emitMaximized(true);
    });
    expect(screen.getByTestId('titlebar-maximize-btn').getAttribute('data-maximized')).toBe('true');

    // Drag region triggers window dragging ONLY on non-interactive pointer down
    const dragRegion = screen.getByTestId('titlebar-drag-region');
    fireEvent.mouseDown(dragRegion, { buttons: 1, detail: 1 });
    expect(service.startDragging).toHaveBeenCalledTimes(1);

    // Clicking AutoSave switch must NOT trigger startDragging
    const switchBtn = screen.getByTestId('titlebar-autosave-toggle');
    fireEvent.mouseDown(switchBtn, { buttons: 1, detail: 1 });
    expect(service.startDragging).toHaveBeenCalledTimes(1);

    // Double clicking drag region toggles maximize
    fireEvent.doubleClick(dragRegion);
    expect(service.toggleMaximize).toHaveBeenCalledTimes(2);
  });

  it('configures --titlebar-height for Desktop vs Web in DesktopChromeShell and clears titlebar in sticky toolbars & mobile nav', () => {
    mockPathname.mockReturnValue('/papers');
    const webPlatform = createFakePlatform({ kind: 'web' });
    const { container: webContainer, unmount: unmountWeb } = render(
      <PlatformProvider value={webPlatform}>
        <EditorSessionProvider>
          <DesktopChromeShell>
            <StickyHubToolbar data-testid="hub-toolbar">
              <span>Toolbar</span>
            </StickyHubToolbar>
          </DesktopChromeShell>
        </EditorSessionProvider>
      </PlatformProvider>
    );

    const webShell = webContainer.firstElementChild as HTMLElement;
    expect(webShell.style.getPropertyValue('--titlebar-height')).toBe('0px');
    expect(webShell.className).not.toContain('pt-[var(--titlebar-height)]');
    const toolbar = screen.getByTestId('hub-toolbar');
    expect(toolbar.className).toContain('sticky');
    expect(toolbar.className).toContain('top-[var(--titlebar-height,0px)]');
    unmountWeb();

    const { service } = createSpyWindowService(false);
    const desktopPlatform = createFakePlatform({
      kind: 'desktop',
      overrides: { window: service },
    });
    const { container: desktopContainer } = render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <DesktopChromeShell>
            <Sidebar />
            <StickyHubToolbar data-testid="hub-toolbar">
              <span>Toolbar</span>
            </StickyHubToolbar>
          </DesktopChromeShell>
        </EditorSessionProvider>
      </PlatformProvider>
    );

    const desktopShell = desktopContainer.firstElementChild as HTMLElement;
    expect(desktopShell.style.getPropertyValue('--titlebar-height')).toBe('38px');
    expect(desktopShell.className).toContain('pt-[var(--titlebar-height)]');

    const desktopToolbar = screen.getByTestId('hub-toolbar');
    expect(desktopToolbar.className).toContain('sticky');
    expect(desktopToolbar.className).toContain('top-[var(--titlebar-height,0px)]');

    const mobileTopBar = desktopContainer.querySelector('.sm\\:hidden.sticky') as HTMLElement;
    expect(mobileTopBar).toBeTruthy();
    expect(mobileTopBar.className).toContain('top-[var(--titlebar-height,0px)]');
  });

  it('renders TitleBar File menu on /editor when document actions are available and blocks window drag', () => {
    mockPathname.mockReturnValue('/editor');
    const { service } = createSpyWindowService(false);
    const desktopPlatform = createFakePlatform({
      kind: 'desktop',
      overrides: { window: service },
    });
    const onNew = vi.fn();
    const onOpen = vi.fn();
    const onManualSave = vi.fn();
    const onExport = vi.fn();

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <EditorSessionBridgeMock
            onNew={onNew}
            onOpen={onOpen}
            onManualSave={onManualSave}
            onExport={onExport}
            exporting={{ pdf: true }}
          />
          <DesktopTitleBar />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    expect(screen.getByTestId('titlebar-exporting-badge').textContent).toContain('PDF');

    const trigger = screen.getByTestId('titlebar-file-menu-trigger');
    fireEvent.mouseDown(trigger, { buttons: 1, detail: 1 });
    expect(service.startDragging).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    const header = screen.getByTestId('desktop-titlebar');
    const popover = screen.getByTestId('titlebar-file-menu-popover');
    expect(header.contains(popover)).toBe(false);
    expect(popover.getAttribute('data-no-drag')).toBe('true');
    expect(popover.className).toContain('backdrop-blur-xl');

    fireEvent.click(screen.getByTestId('titlebar-file-new'));
    expect(onNew).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId('titlebar-file-open'));
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    fireEvent.click(screen.getByTestId('titlebar-file-save'));
    expect(onManualSave).toHaveBeenCalledTimes(1);

    fireEvent.click(trigger);
    expect((screen.getByTestId('titlebar-export-pdf') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('titlebar-export-docx'));
    expect(onExport).toHaveBeenCalledWith('docx');
  });

  it('supports inline click-to-rename on titlebar-paper-title when onRename is provided', () => {
    mockPathname.mockReturnValue('/editor');
    const { service } = createSpyWindowService(false);
    const desktopPlatform = createFakePlatform({
      kind: 'desktop',
      overrides: { window: service },
    });
    const onRename = vi.fn();

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <EditorSessionBridgeMock title="Tên cũ" onRename={onRename} />
          <DesktopTitleBar />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    const titleBtn = screen.getByTestId('titlebar-paper-title') as HTMLButtonElement;
    const pencilWrap = screen.getByTestId('titlebar-paper-title-pencil');
    expect(pencilWrap.className).toContain('max-w-0');
    expect(pencilWrap.className).toContain('group-hover:max-w-[14px]');

    vi.spyOn(titleBtn, 'getBoundingClientRect').mockReturnValue({
      width: 260,
      height: 24,
      top: 0,
      left: 0,
      right: 260,
      bottom: 24,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.click(titleBtn);

    const editorWrap = screen.getByTestId('titlebar-paper-title-editor-wrap');
    expect(editorWrap.style.minWidth).toBe('260px');

    const input = screen.getByTestId('titlebar-paper-title-input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Tên bị hủy' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(onRename).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('titlebar-paper-title'));
    const input2 = screen.getByTestId('titlebar-paper-title-input') as HTMLInputElement;
    fireEvent.change(input2, { target: { value: '  Tên mới từ TitleBar  ' } });
    fireEvent.keyDown(input2, { key: 'Enter' });
    expect(onRename).toHaveBeenCalledWith('Tên mới từ TitleBar');
  });

  it('shows plain gray CloudOff icon on right corner of TitleBar outside Saved pill when rawSaveState is saved-local', () => {
    mockPathname.mockReturnValue('/editor');
    const desktopPlatform = createFakePlatform({ kind: 'desktop' });
    const savedAt = new Date(2026, 10, 12, 9, 15, 30).getTime();

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <EditorSessionBridgeMock
            saveState="saved"
            rawSaveState="saved-local"
            savedAt={savedAt}
          />
          <DesktopTitleBar />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    const header = screen.getByTestId('desktop-titlebar');
    const pill = screen.getByTestId('titlebar-save-state');
    const dragRegion = screen.getByTestId('titlebar-drag-region');
    const localIcon = screen.getByTestId('titlebar-local-only-icon');

    expect(pill.getAttribute('data-save-state')).toBe('saved');
    expect(pill.textContent).toContain('Saved');
    expect(pill.contains(localIcon)).toBe(false);
    expect(header.contains(localIcon)).toBe(true);
    expect(
      Boolean(dragRegion.compareDocumentPosition(localIcon) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true);
    expect(localIcon.getAttribute('title')).toContain('chưa đồng bộ máy chủ');
    expect(localIcon.className).toContain('text-zinc-500');
  });

  it('renders conflict override action in TitleBar when rawSaveState is conflict', () => {
    mockPathname.mockReturnValue('/editor');
    const desktopPlatform = createFakePlatform({ kind: 'desktop' });
    const onKeepMine = vi.fn();

    render(
      <PlatformProvider value={desktopPlatform}>
        <EditorSessionProvider>
          <EditorSessionBridgeMock
            saveState="error"
            rawSaveState="conflict"
            onKeepMine={onKeepMine}
          />
          <DesktopTitleBar />
        </EditorSessionProvider>
      </PlatformProvider>
    );

    const pill = screen.getByTestId('titlebar-save-state');
    expect(pill.getAttribute('data-save-state')).toBe('error');
    const resolveBtn = screen.getByTestId('titlebar-conflict-resolve');
    fireEvent.click(resolveBtn);
    expect(onKeepMine).toHaveBeenCalledTimes(1);
  });
});
