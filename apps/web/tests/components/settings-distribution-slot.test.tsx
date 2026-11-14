// @vitest-environment happy-dom

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import {
  PlatformProvider,
  Slot,
  createFakePlatform,
  type UpdateState,
  type UpdateInfo,
} from '@/platform';
import { createPlatform, resetPlatform, isTauriEnvironment } from '@/platform/bootstrap';
import { DownloadDesktopCard } from '@/components/platform/DownloadDesktopCard';
import { CheckForUpdateCard } from '@/components/platform/CheckForUpdateCard';
import { UpdateNotificationBanner } from '@/components/platform/UpdateNotificationBanner';
import { UpdateToastNotifier } from '@/components/platform/UpdateToastNotifier';
import { toast } from '@/components/toast';

describe('Settings Distribution Slot & Auto-Update Banner (Task 6)', () => {
  afterEach(() => {
    cleanup();
    resetPlatform();
    delete (window as any).__TAURI_INTERNALS__;
    delete (window as any).__TAURI__;
  });

  describe('Polymorphic Slot: app-distribution', () => {
    it('renders DownloadDesktopCard when running on Web platform', () => {
      const webPlatform = createFakePlatform({ kind: 'web' });

      render(
        <PlatformProvider value={webPlatform}>
          <Slot id="app-distribution" />
        </PlatformProvider>
      );

      // Verify Web Card is rendered
      const card = screen.getByTestId('download-desktop-card');
      expect(card).toBeTruthy();
      expect(
        screen.getByText('Cài Đặt Ứng Dụng StructPaper Cho Máy Tính (Desktop App)')
      ).toBeTruthy();
      expect(screen.queryByTestId('check-for-update-card')).toBeNull();
    });

    it('renders CheckForUpdateCard when running on Desktop platform', () => {
      const desktopPlatform = createFakePlatform({
        kind: 'desktop',
        overrides: {
          config: {
            apiBaseUrl: 'http://localhost:3000/api',
            appVersion: '1.2.0',
            buildId: 'desktop-test',
            channel: 'stable',
          },
        },
      });

      render(
        <PlatformProvider value={desktopPlatform}>
          <Slot id="app-distribution" />
        </PlatformProvider>
      );

      // Verify Desktop Card is rendered
      const card = screen.getByTestId('check-for-update-card');
      expect(card).toBeTruthy();
      expect(
        screen.getByText('Cập Nhật Ứng Dụng StructPaper (Desktop)')
      ).toBeTruthy();
      expect(screen.queryByTestId('download-desktop-card')).toBeNull();
    });
  });

  describe('DownloadDesktopCard (Web Distribution Card)', () => {
    it('displays required headings and valid OS download buttons', () => {
      render(<DownloadDesktopCard />);

      // Heading check
      const heading = screen.getByRole('heading', {
        name: /Cài Đặt Ứng Dụng StructPaper Cho Máy Tính \(Desktop App\)/i,
      });
      expect(heading).toBeTruthy();

      // Windows button check
      const winBtn = screen.getByTestId('download-windows-btn');
      expect(winBtn).toBeTruthy();
      expect(winBtn.textContent).toContain('Tải bản Windows (.exe Setup)');
      expect(winBtn.getAttribute('href')).toMatch(/StructPaper_.*_x64-setup\.exe/);

      // macOS button check
      const macBtn = screen.getByTestId('download-macos-btn');
      expect(macBtn).toBeTruthy();
      expect(macBtn.textContent).toContain('Tải bản macOS (.dmg Apple Silicon)');
      expect(macBtn.getAttribute('href')).toMatch(/StructPaper_.*_aarch64\.dmg/);
    });
  });

  describe('CheckForUpdateCard (Desktop Auto-Updater Card)', () => {
    it('displays current app version and handles manual update check button click', async () => {
      let stateListener: ((s: UpdateState) => void) | null = null;
      let currentState: UpdateState = { s: 'idle' };

      const checkMock = vi.fn().mockImplementation(async () => {
        currentState = { s: 'checking' };
        stateListener?.(currentState);
        return null;
      });

      const desktopPlatform = createFakePlatform({
        kind: 'desktop',
        overrides: {
          config: {
            apiBaseUrl: 'http://localhost:3000/api',
            appVersion: '2.1.0',
            buildId: 'desktop-210',
            channel: 'stable',
          },
          updates: {
            channel: 'stable',
            getState: () => currentState,
            subscribe: (listener) => {
              stateListener = listener;
              return () => {
                stateListener = null;
              };
            },
            check: checkMock,
            install: vi.fn(),
            restart: vi.fn(),
            skipVersion: vi.fn(),
            remindLater: vi.fn(),
          },
        },
      });

      render(
        <PlatformProvider value={desktopPlatform}>
          <CheckForUpdateCard />
        </PlatformProvider>
      );

      // Check current version badge
      const versionEl = screen.getByTestId('current-version');
      expect(versionEl.textContent).toContain('v2.1.0');

      // Click check button
      const checkBtn = screen.getByTestId('check-update-btn');
      expect(checkBtn.textContent).toContain('Kiểm tra phiên bản mới');

      await act(async () => {
        fireEvent.click(checkBtn);
      });

      expect(checkMock).toHaveBeenCalledWith({ manual: true });
      expect(screen.getByText('Đang kiểm tra...')).toBeTruthy();
    });

    it('renders new version details, changelog, and start update button when update is available', async () => {
      const installMock = vi.fn().mockResolvedValue(undefined);
      const updateInfo: UpdateInfo = {
        version: '2.5.0',
        notes: '- Sửa lỗi căn lề bảng XeTeX\n- Bổ sung cập nhật tự động Minisign',
        publishedAt: '2026-11-09T00:00:00Z',
        mandatory: false,
        kind: 'app-binary',
      };

      const desktopPlatform = createFakePlatform({
        kind: 'desktop',
        overrides: {
          config: {
            apiBaseUrl: 'http://localhost:3000/api',
            appVersion: '2.1.0',
            buildId: 'desktop-210',
            channel: 'stable',
          },
          updates: {
            channel: 'stable',
            getState: () => ({ s: 'available', info: updateInfo }),
            subscribe: () => () => {},
            check: vi.fn(),
            install: installMock,
            restart: vi.fn(),
            skipVersion: vi.fn(),
            remindLater: vi.fn(),
          },
        },
      });

      render(
        <PlatformProvider value={desktopPlatform}>
          <CheckForUpdateCard />
        </PlatformProvider>
      );

      // Verify version badge and changelog
      expect(screen.getByTestId('new-version-badge').textContent).toContain('v2.5.0');
      expect(screen.getByTestId('changelog-notes').textContent).toContain(
        'Sửa lỗi căn lề bảng XeTeX'
      );

      // Verify update action button
      const updateBtn = screen.getByTestId('start-update-btn');
      expect(updateBtn.textContent).toContain('Cập nhật ngay');

      await act(async () => {
        fireEvent.click(updateBtn);
      });

      expect(installMock).toHaveBeenCalledWith(updateInfo);
    });

    it('renders progress bar and byte count when state is downloading', () => {
      const updateInfo: UpdateInfo = {
        version: '2.5.0',
        mandatory: false,
        kind: 'app-binary',
      };

      const desktopPlatform = createFakePlatform({
        kind: 'desktop',
        overrides: {
          updates: {
            channel: 'stable',
            getState: () => ({
              s: 'downloading',
              info: updateInfo,
              received: 15 * 1024 * 1024,
              total: 25 * 1024 * 1024,
            }),
            subscribe: () => () => {},
            check: vi.fn(),
            install: vi.fn(),
            restart: vi.fn(),
            skipVersion: vi.fn(),
            remindLater: vi.fn(),
          },
        },
      });

      render(
        <PlatformProvider value={desktopPlatform}>
          <CheckForUpdateCard />
        </PlatformProvider>
      );

      expect(screen.getByTestId('downloading-section')).toBeTruthy();
      expect(screen.getByText('60%')).toBeTruthy();
      expect(screen.getByText(/15 MB/i)).toBeTruthy();
      expect(screen.getByText(/25 MB/i)).toBeTruthy();
    });

    it('renders restart button when state is ready', async () => {
      const restartMock = vi.fn().mockResolvedValue(undefined);
      const updateInfo: UpdateInfo = {
        version: '2.5.0',
        mandatory: false,
        kind: 'app-binary',
      };

      const desktopPlatform = createFakePlatform({
        kind: 'desktop',
        overrides: {
          updates: {
            channel: 'stable',
            getState: () => ({ s: 'ready', info: updateInfo }),
            subscribe: () => () => {},
            check: vi.fn(),
            install: vi.fn(),
            restart: restartMock,
            skipVersion: vi.fn(),
            remindLater: vi.fn(),
          },
        },
      });

      render(
        <PlatformProvider value={desktopPlatform}>
          <CheckForUpdateCard />
        </PlatformProvider>
      );

      const restartBtn = screen.getByTestId('restart-update-btn');
      expect(restartBtn.textContent).toContain('Khởi động lại để hoàn tất cập nhật');

      await act(async () => {
        fireEvent.click(restartBtn);
      });

      expect(restartMock).toHaveBeenCalled();
    });
  });

  describe('UpdateNotificationBanner', () => {
    it('does not render when hasUpdate is false', () => {
      const platform = createFakePlatform({
        overrides: {
          updates: {
            channel: 'stable',
            getState: () => ({ s: 'idle' }),
            subscribe: () => () => {},
            check: vi.fn(),
            install: vi.fn(),
            restart: vi.fn(),
            skipVersion: vi.fn(),
            remindLater: vi.fn(),
          },
        },
      });

      render(
        <PlatformProvider value={platform}>
          <UpdateNotificationBanner />
        </PlatformProvider>
      );

      expect(screen.queryByTestId('update-notification-banner')).toBeNull();
    });

    it('renders non-intrusive floating banner when update is available and handles actions', async () => {
      const installMock = vi.fn().mockResolvedValue(undefined);
      const remindMock = vi.fn();
      const skipMock = vi.fn();

      const updateInfo: UpdateInfo = {
        version: '3.0.0',
        notes: 'Changelog: Thêm công cụ quản lý trích dẫn đa tạp chí',
        mandatory: false,
        kind: 'app-binary',
      };

      const platform = createFakePlatform({
        overrides: {
          updates: {
            channel: 'stable',
            getState: () => ({ s: 'available', info: updateInfo }),
            subscribe: () => () => {},
            check: vi.fn(),
            install: installMock,
            restart: vi.fn(),
            skipVersion: skipMock,
            remindLater: remindMock,
          },
        },
      });

      render(
        <PlatformProvider value={platform}>
          <UpdateNotificationBanner />
        </PlatformProvider>
      );

      // Banner should be visible
      expect(screen.getByTestId('update-notification-banner')).toBeTruthy();
      expect(screen.getByText('Bản Cập Nhật Mới')).toBeTruthy();
      expect(screen.getByText('v3.0.0')).toBeTruthy();

      // Buttons check
      const detailsBtn = screen.getByTestId('banner-details-btn');
      const updateBtn = screen.getByTestId('banner-update-btn');
      const remindBtn = screen.getByTestId('banner-remind-btn');
      const skipBtn = screen.getByTestId('banner-skip-btn');

      expect(detailsBtn.textContent).toContain('Xem chi tiết');
      expect(updateBtn.textContent).toContain('Cập nhật ngay');
      expect(remindBtn.textContent).toContain('Nhắc sau');
      expect(skipBtn.textContent).toContain('Bỏ qua bản này');

      // Expand details
      expect(screen.queryByTestId('banner-details-container')).toBeNull();
      await act(async () => {
        fireEvent.click(detailsBtn);
      });
      expect(screen.getByTestId('banner-details-container')).toBeTruthy();
      expect(
        screen.getByText(/Thêm công cụ quản lý trích dẫn đa tạp chí/i)
      ).toBeTruthy();

      // Trigger update
      await act(async () => {
        fireEvent.click(updateBtn);
      });
      expect(installMock).toHaveBeenCalledWith(updateInfo);

      // Trigger Remind Later
      await act(async () => {
        fireEvent.click(remindBtn);
      });
      expect(remindMock).toHaveBeenCalledWith(24);
      // Banner dismisses on remind
      expect(screen.queryByTestId('update-notification-banner')).toBeNull();
    });

    it('dismisses banner and calls skipVersion when "Bỏ qua bản này" is clicked', async () => {
      const skipMock = vi.fn();
      const updateInfo: UpdateInfo = {
        version: '3.1.0',
        mandatory: false,
        kind: 'app-binary',
      };

      const platform = createFakePlatform({
        overrides: {
          updates: {
            channel: 'stable',
            getState: () => ({ s: 'available', info: updateInfo }),
            subscribe: () => () => {},
            check: vi.fn(),
            install: vi.fn(),
            restart: vi.fn(),
            skipVersion: skipMock,
            remindLater: vi.fn(),
          },
        },
      });

      render(
        <PlatformProvider value={platform}>
          <UpdateNotificationBanner />
        </PlatformProvider>
      );

      const skipBtn = screen.getByTestId('banner-skip-btn');
      await act(async () => {
        fireEvent.click(skipBtn);
      });

      expect(skipMock).toHaveBeenCalledWith('3.1.0');
      expect(screen.queryByTestId('update-notification-banner')).toBeNull();
    });
  });

  describe('Bootstrap: createPlatform()', () => {
    it('returns web platform when not in Tauri environment', async () => {
      delete (window as any).__TAURI_INTERNALS__;
      delete (window as any).__TAURI__;

      expect(isTauriEnvironment()).toBe(false);

      const p = await createPlatform();
      expect(p.capabilities.kind).toBe('web');
      expect(p.capabilities.canInstallApp).toBe(true);
      expect(p.capabilities.hasAppUpdater).toBe(false);
    });

    it('returns desktop platform when in Tauri environment', async () => {
      (window as any).__TAURI_INTERNALS__ = {};

      expect(isTauriEnvironment()).toBe(true);

      const p = await createPlatform();
      expect(p.capabilities.kind).toBe('desktop');
      expect(p.capabilities.canInstallApp).toBe(false);
      expect(p.capabilities.hasAppUpdater).toBe(true);
    });
  });

  describe('UpdateToastNotifier', () => {
    it('triggers persistent toast.info when a new update is available', () => {
      const toastSpy = vi.spyOn(toast, 'info');
      const startUpdateMock = vi.fn();

      const updateInfo: UpdateInfo = {
        version: '2.5.0',
        notes: 'Sửa lỗi biên dịch',
        mandatory: false,
        kind: 'app-binary',
      };

      const platform = createFakePlatform({
        overrides: {
          updates: {
            channel: 'stable',
            getState: () => ({ s: 'available', info: updateInfo }),
            subscribe: () => () => {},
            check: vi.fn(),
            install: startUpdateMock,
            restart: vi.fn(),
            skipVersion: vi.fn(),
            remindLater: vi.fn(),
          },
        },
      });

      render(
        <PlatformProvider value={platform}>
          <UpdateToastNotifier />
        </PlatformProvider>
      );

      expect(toastSpy).toHaveBeenCalledWith(
        'Đã có bản cập nhật mới v2.5.0',
        expect.any(String),
        expect.objectContaining({
          id: 'app-update-available',
          duration: Infinity,
          dismissible: true,
          action: expect.objectContaining({
            label: 'Cập nhật ngay',
          }),
        })
      );
    });

    it('triggers toast.loading during downloading and persistent toast.success when ready', () => {
      const loadingSpy = vi.spyOn(toast, 'loading');
      const successSpy = vi.spyOn(toast, 'success');
      const restartMock = vi.fn();

      const updateInfo: UpdateInfo = {
        version: '2.6.0',
        mandatory: false,
        kind: 'app-binary',
      };

      // 1. Downloading
      let currentState: UpdateState = {
        s: 'downloading',
        info: updateInfo,
        received: 50,
        total: 100,
      };

      let listenerCb: ((s: UpdateState) => void) | null = null;

      const platform = createFakePlatform({
        overrides: {
          updates: {
            channel: 'stable',
            getState: () => currentState,
            subscribe: (fn) => {
              listenerCb = fn;
              return () => {};
            },
            check: vi.fn(),
            install: vi.fn(),
            restart: restartMock,
            skipVersion: vi.fn(),
            remindLater: vi.fn(),
          },
        },
      });

      const { rerender } = render(
        <PlatformProvider value={platform}>
          <UpdateToastNotifier />
        </PlatformProvider>
      );

      expect(loadingSpy).toHaveBeenCalledWith(
        'Đang tải bản cập nhật v2.6.0...',
        expect.stringContaining('50% hoàn tất'),
        expect.objectContaining({ id: 'app-update-downloading', duration: Infinity })
      );

      // 2. Transition to ready
      currentState = { s: 'ready', info: updateInfo };
      act(() => {
        listenerCb?.(currentState);
      });

      rerender(
        <PlatformProvider value={platform}>
          <UpdateToastNotifier />
        </PlatformProvider>
      );

      expect(successSpy).toHaveBeenCalledWith(
        'Đã tải xong bản cập nhật v2.6.0!',
        expect.any(String),
        expect.objectContaining({
          id: 'app-update-ready',
          duration: Infinity,
          dismissible: true,
          action: expect.objectContaining({
            label: 'Khởi động lại ngay',
          }),
        })
      );
    });

    it('triggers persistent toast.error when updater encounters an error', () => {
      const errorSpy = vi.spyOn(toast, 'error');

      const platform = createFakePlatform({
        overrides: {
          updates: {
            channel: 'stable',
            getState: () => ({
              s: 'error',
              code: 'U3_DOWNLOAD',
              message: 'Không thể kết nối đến máy chủ cập nhật',
            }),
            subscribe: () => () => {},
            check: vi.fn(),
            install: vi.fn(),
            restart: vi.fn(),
            skipVersion: vi.fn(),
            remindLater: vi.fn(),
          },
        },
      });

      render(
        <PlatformProvider value={platform}>
          <UpdateToastNotifier />
        </PlatformProvider>
      );

      expect(errorSpy).toHaveBeenCalledWith(
        'Lỗi cập nhật',
        'Không thể kết nối đến máy chủ cập nhật',
        expect.objectContaining({
          id: 'app-update-error',
          duration: Infinity,
          dismissible: true,
        })
      );
    });

    it('triggers simulateUpdate when dev testing button is clicked', () => {
      const simulateUpdateMock = vi.fn();
      const platform = createFakePlatform({
        kind: 'desktop',
        overrides: {
          updates: {
            channel: 'stable',
            getState: () => ({ s: 'idle' }),
            subscribe: () => () => {},
            check: vi.fn(),
            install: vi.fn(),
            restart: vi.fn(),
            skipVersion: vi.fn(),
            remindLater: vi.fn(),
            simulateUpdate: simulateUpdateMock,
          },
        },
      });

      render(
        <PlatformProvider value={platform}>
          <CheckForUpdateCard />
        </PlatformProvider>
      );

      const simBtn = screen.getByTestId('simulate-update-btn');
      expect(simBtn).toBeTruthy();
      fireEvent.click(simBtn);
      expect(simulateUpdateMock).toHaveBeenCalledTimes(1);
    });
  });
});

