// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, renderHook, cleanup } from '@testing-library/react';
import {
  PlatformProvider,
  usePlatform,
  useOptionalPlatform,
  useCapabilities,
  useUpdateService,
  useWindowService,
  useAppUpdater,
  createFakePlatform,
  defineSlots,
  registerSlot,
  clearSlotRegistry,
  Slot,
  type UpdateService,
  type UpdateState,
  type UpdateInfo,
} from '../src';

describe('packages/platform: Context & Hooks', () => {
  it('throws an error if usePlatform is called outside of PlatformProvider', () => {
    // Suppress console.error in React for expected error boundary test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      renderHook(() => usePlatform());
    }).toThrow('usePlatform must be used within a PlatformProvider');

    consoleError.mockRestore();
  });

  it('provides PlatformServices, capabilities, and update service via context', () => {
    const fakePlatform = createFakePlatform({
      kind: 'desktop',
      overrides: {
        config: {
          apiBaseUrl: 'https://api.structpaper.org',
          appVersion: '2.5.0',
          buildId: 'build-789',
          channel: 'beta',
        },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlatformProvider value={fakePlatform}>{children}</PlatformProvider>
    );

    const { result } = renderHook(
      () => ({
        platform: usePlatform(),
        caps: useCapabilities(),
        updates: useUpdateService(),
        win: useWindowService(),
      }),
      { wrapper }
    );

    expect(result.current.platform.capabilities.kind).toBe('desktop');
    expect(result.current.caps.hasAppUpdater).toBe(true);
    expect(result.current.platform.config.appVersion).toBe('2.5.0');
    expect(result.current.updates.channel).toBe('stable');
    expect(result.current.win.isSupported()).toBe(true);
  });

  it('useOptionalPlatform returns null outside PlatformProvider and services inside it', () => {
    const { result: outside } = renderHook(() => useOptionalPlatform());
    expect(outside.current).toBeNull();

    const fakePlatform = createFakePlatform({ kind: 'web' });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlatformProvider value={fakePlatform}>{children}</PlatformProvider>
    );
    const { result: inside } = renderHook(() => useOptionalPlatform(), { wrapper });
    expect(inside.current).toBe(fakePlatform);
  });
});

describe('packages/platform: Declarative Slot Registry', () => {
  beforeEach(() => {
    clearSlotRegistry();
  });

  afterEach(() => {
    cleanup();
  });

  const WebButton = ({ label }: { label?: string }) => (
    <button data-testid="web-button">{label || 'Web Download'}</button>
  );
  const DesktopButton = ({ label }: { label?: string }) => (
    <button data-testid="desktop-button">{label || 'Check Updates'}</button>
  );

  it('resolves and renders Web component when platform is web', () => {
    defineSlots({
      'distribution-action': {
        web: WebButton,
        desktop: DesktopButton,
      },
    });

    const webPlatform = createFakePlatform({ kind: 'web' });

    render(
      <PlatformProvider value={webPlatform}>
        <Slot id="distribution-action" label="Custom Web Label" />
      </PlatformProvider>
    );

    expect(screen.getByTestId('web-button')).not.toBeNull();
    expect(screen.getByTestId('web-button').textContent).toBe('Custom Web Label');
    expect(screen.queryByTestId('desktop-button')).toBeNull();
  });

  it('resolves and renders Desktop component when platform is desktop', () => {
    defineSlots({
      'distribution-action': {
        web: WebButton,
        desktop: DesktopButton,
      },
    });

    const desktopPlatform = createFakePlatform({ kind: 'desktop' });

    render(
      <PlatformProvider value={desktopPlatform}>
        <Slot id="distribution-action" label="Custom Desktop Label" />
      </PlatformProvider>
    );

    expect(screen.getByTestId('desktop-button')).not.toBeNull();
    expect(screen.getByTestId('desktop-button').textContent).toBe('Custom Desktop Label');
    expect(screen.queryByTestId('web-button')).toBeNull();
  });

  it('renders null or fallback when component is explicitly null for that platform', () => {
    defineSlots({
      'native-only-feature': {
        web: null,
        desktop: DesktopButton,
      },
    });

    const webPlatform = createFakePlatform({ kind: 'web' });

    const { rerender } = render(
      <PlatformProvider value={webPlatform}>
        <Slot id="native-only-feature" />
      </PlatformProvider>
    );

    expect(screen.queryByTestId('desktop-button')).toBeNull();

    // With fallback
    rerender(
      <PlatformProvider value={webPlatform}>
        <Slot id="native-only-feature" fallback={<span data-testid="fallback">N/A</span>} />
      </PlatformProvider>
    );

    expect(screen.getByTestId('fallback')).not.toBeNull();
  });

  it('allows registering slots dynamically and passing scoped slots prop', () => {
    const ScopedWeb = () => <div data-testid="scoped-web">Scoped</div>;
    const ScopedDesktop = () => <div data-testid="scoped-desktop">Scoped</div>;

    const scopedRegistry = {
      'scoped-slot': {
        web: ScopedWeb,
        desktop: ScopedDesktop,
      },
    };

    const webPlatform = createFakePlatform({ kind: 'web' });

    render(
      <PlatformProvider value={webPlatform}>
        <Slot id="scoped-slot" slots={scopedRegistry} />
      </PlatformProvider>
    );

    expect(screen.getByTestId('scoped-web')).not.toBeNull();
  });
});

describe('packages/platform: useAppUpdater Hook', () => {
  it('subscribes to UpdateService state transitions and exposes reactive state and actions', async () => {
    let currentState: UpdateState = { s: 'idle' };
    const listeners = new Set<(state: UpdateState) => void>();

    const sampleUpdate: UpdateInfo = {
      version: '2.0.0',
      notes: 'New feature',
      publishedAt: '2026-11-09T00:00:00Z',
      mandatory: false,
      kind: 'app-binary',
    };

    const mockInstall = vi.fn().mockResolvedValue(undefined);
    const mockRestart = vi.fn().mockResolvedValue(undefined);
    const mockSkipVersion = vi.fn();
    const mockRemindLater = vi.fn();
    const mockCheck = vi.fn().mockResolvedValue(sampleUpdate);

    const mockUpdateService: UpdateService = {
      channel: 'stable',
      getState: () => currentState,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      check: mockCheck,
      install: mockInstall,
      restart: mockRestart,
      skipVersion: mockSkipVersion,
      remindLater: mockRemindLater,
    };

    function emitState(newState: UpdateState) {
      currentState = newState;
      listeners.forEach((l) => l(newState));
    }

    const platform = createFakePlatform({
      kind: 'desktop',
      overrides: { updates: mockUpdateService },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PlatformProvider value={platform}>{children}</PlatformProvider>
    );

    const { result, unmount } = renderHook(() => useAppUpdater(), { wrapper });

    // Initial state: idle
    expect(result.current.state.s).toBe('idle');
    expect(result.current.hasUpdate).toBe(false);
    expect(result.current.isChecking).toBe(false);
    expect(result.current.isDownloading).toBe(false);
    expect(result.current.updateInfo).toBeNull();

    // Transition to checking
    act(() => {
      emitState({ s: 'checking' });
    });
    expect(result.current.state.s).toBe('checking');
    expect(result.current.isChecking).toBe(true);

    // Transition to available
    act(() => {
      emitState({ s: 'available', info: sampleUpdate });
    });
    expect(result.current.state.s).toBe('available');
    expect(result.current.hasUpdate).toBe(true);
    expect(result.current.updateInfo?.version).toBe('2.0.0');

    // Transition to downloading with progress
    act(() => {
      emitState({
        s: 'downloading',
        info: sampleUpdate,
        received: 50,
        total: 100,
      });
    });
    expect(result.current.isDownloading).toBe(true);
    expect(result.current.downloadProgress).toEqual({
      received: 50,
      total: 100,
      percent: 50,
    });

    // Transition to ready
    act(() => {
      emitState({ s: 'ready', info: sampleUpdate });
    });
    expect(result.current.isReady).toBe(true);
    expect(result.current.hasUpdate).toBe(true);

    // Trigger actions
    await act(async () => {
      await result.current.startUpdate();
    });
    expect(mockInstall).toHaveBeenCalledWith(sampleUpdate);

    await act(async () => {
      await result.current.restart();
    });
    expect(mockRestart).toHaveBeenCalled();

    act(() => {
      result.current.dismissUpdate(12);
    });
    expect(mockRemindLater).toHaveBeenCalledWith(12);

    act(() => {
      result.current.skipVersion();
    });
    expect(mockSkipVersion).toHaveBeenCalledWith('2.0.0');

    // Transition to error
    act(() => {
      emitState({
        s: 'error',
        code: 'U3_DOWNLOAD',
        message: 'Network timeout',
        retryAt: 123456,
      });
    });
    expect(result.current.error).toEqual({
      code: 'U3_DOWNLOAD',
      message: 'Network timeout',
      retryAt: 123456,
    });

    // Unmount cleans up listener
    expect(listeners.size).toBe(1);
    unmount();
    expect(listeners.size).toBe(0);
  });
});
