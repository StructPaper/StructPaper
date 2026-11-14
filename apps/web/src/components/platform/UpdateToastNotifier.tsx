'use client';

import React, { useEffect, useRef } from 'react';
import { useAppUpdater } from '@structpaper/platform';
import { toast } from '@/components/toast';

export interface UpdateToastNotifierProps {
  /**
   * Optional custom test id for container
   */
  'data-testid'?: string;
}

/**
 * Headless notification bridge that synchronizes the application's
 * UpdateService state with the unified Dynamic Island / Liquid Glass Toast system.
 *
 * Ensures 100% design consistency with existing system alerts while keeping
 * the UI non-intrusive.
 */
export function UpdateToastNotifier(props: UpdateToastNotifierProps): React.ReactElement | null {
  const {
    hasUpdate,
    updateInfo,
    isDownloading,
    downloadProgress,
    isReady,
    error,
    startUpdate,
    restart,
    checkForUpdates,
  } = useAppUpdater();

  const notifiedVersionRef = useRef<string | null>(null);
  const readyNotifiedRef = useRef<string | null>(null);

  // Auto-check for updates on initial mount after gentle delay
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates().catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, [checkForUpdates]);

  // 1. Alert user when a new version is available (persistent until user acts or dismisses)
  useEffect(() => {
    if (hasUpdate && updateInfo && notifiedVersionRef.current !== updateInfo.version) {
      notifiedVersionRef.current = updateInfo.version;

      const versionText = updateInfo.version.startsWith('v')
        ? updateInfo.version
        : `v${updateInfo.version}`;

      toast.info(
        `Đã có bản cập nhật mới ${versionText}`,
        'Phiên bản mới của StructPaper đã sẵn sàng. Bấm để nâng cấp tự động.',
        {
          id: 'app-update-available',
          duration: Infinity,
          dismissible: true,
          action: {
            label: 'Cập nhật ngay',
            onClick: () => {
              toast.dismiss('app-update-available');
              startUpdate();
            },
          },
        }
      );
    }
  }, [hasUpdate, updateInfo, startUpdate]);

  // 2. Track download progress
  useEffect(() => {
    if (isDownloading && updateInfo) {
      const versionText = updateInfo.version.startsWith('v')
        ? updateInfo.version
        : `v${updateInfo.version}`;

      const pct = downloadProgress?.percent ?? 0;

      toast.loading(
        `Đang tải bản cập nhật ${versionText}...`,
        `${pct}% hoàn tất. Vui lòng chờ trong giây lát...`,
        {
          id: 'app-update-downloading',
          duration: Infinity,
        }
      );
    } else {
      toast.dismiss('app-update-downloading');
    }
  }, [isDownloading, downloadProgress, updateInfo]);

  // 3. Prompt user to restart when update is downloaded & verified (persistent until user acts or dismisses)
  useEffect(() => {
    if (isReady && updateInfo && readyNotifiedRef.current !== updateInfo.version) {
      readyNotifiedRef.current = updateInfo.version;

      const versionText = updateInfo.version.startsWith('v')
        ? updateInfo.version
        : `v${updateInfo.version}`;

      toast.dismiss('app-update-available');
      toast.dismiss('app-update-downloading');

      toast.success(
        `Đã tải xong bản cập nhật ${versionText}!`,
        'Bản cập nhật đã được xác thực an toàn. Bấm để khởi động lại ngay.',
        {
          id: 'app-update-ready',
          duration: Infinity,
          dismissible: true,
          action: {
            label: 'Khởi động lại ngay',
            onClick: () => {
              toast.dismiss('app-update-ready');
              restart();
            },
          },
        }
      );
    }
  }, [isReady, updateInfo, restart]);

  // 4. Alert on error (persistent so user can see what happened)
  useEffect(() => {
    if (error) {
      toast.dismiss('app-update-downloading');
      toast.error(
        'Lỗi cập nhật',
        error.message || 'Không thể tải bản cập nhật. Vui lòng thử lại sau.',
        {
          id: 'app-update-error',
          duration: Infinity,
          dismissible: true,
        }
      );
    }
  }, [error]);

  return <div data-testid={props['data-testid'] || 'update-toast-notifier'} className="hidden" aria-hidden="true" />;
}
