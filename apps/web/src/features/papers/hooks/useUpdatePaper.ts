'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useUpdateManuscript,
  isMockModeEnabled,
  type UpdateManuscriptRequest,
  type Manuscript,
} from '@structpaper/api-client';
import { savePaperToIndexedDb, loadPaperFromIndexedDb } from '@/lib/storage/paper-sync';
import { isLocalStorageEnabled } from '@/config/storage.config';
import { sileo } from '@/components/toast';
import type { CompletePaper } from '@/types/paper';

export interface UseUpdatePaperOptions {
  onSuccess?: (manuscript: Manuscript) => void;
  onError?: (error: any) => void;
  showToast?: boolean;
}

export function useUpdatePaper(options: UseUpdatePaperOptions = {}) {
  const queryClient = useQueryClient();
  const mutation = useUpdateManuscript();

  const updatePaper = useCallback(
    async (params: {
      id: string;
      data: UpdateManuscriptRequest;
      version?: number;
      localPaper?: CompletePaper;
    }): Promise<Manuscript | null> => {
      const { id, data, version, localPaper } = params;

      // 1. Mock Mode: Update in IndexedDB only
      if (isMockModeEnabled()) {
        if (localPaper) {
          await savePaperToIndexedDb(localPaper);
        }
        queryClient.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/manuscripts/${id}`] });
        if (options.showToast) {
          sileo.success({
            title: 'Đã cập nhật bài báo (Offline)',
            description: 'Thông tin bản thảo đã được lưu cục bộ.',
          });
        }
        return null;
      }

      // 2. Cloud Mode: PATCH to Backend NestJS API with optimistic lock header
      try {
        const result = await (mutation.mutateAsync as any)({
          id,
          data,
          ...(version !== undefined ? { params: { ifMatch: `"${version}"` } } : {}),
        });

        // Cache update only if local storage is enabled
        if (isLocalStorageEnabled()) {
          if (localPaper) {
            await savePaperToIndexedDb(localPaper);
          } else {
            try {
              const existing = await loadPaperFromIndexedDb(id);
              if (existing) {
                existing.metadata = {
                  ...existing.metadata,
                  title: result.title || existing.metadata?.title || '',
                };
                existing.version = result.version || existing.version;
                existing.updatedAt = result.updatedAt || new Date().toISOString();
                await savePaperToIndexedDb(existing);
              }
            } catch {
              // ignore cache sync error
            }
          }
        }

        queryClient.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/manuscripts/${id}`] });

        if (options.showToast) {
          sileo.success({
            title: 'Cập nhật thành công',
            description: 'Bản thảo đã được lưu trên máy chủ đám mây.',
          });
        }

        options.onSuccess?.(result);
        return result;
      } catch (err: any) {
        // Fallback to local if network down
        if (localPaper) {
          console.warn('[useUpdatePaper] Network failed, saving to IndexedDB:', err);
          await savePaperToIndexedDb(localPaper);
          if (options.showToast) {
            sileo.info({
              title: 'Đã lưu cục bộ',
              description: 'Chưa kết nối được máy chủ, bài đã được bảo vệ trên máy bạn.',
            });
          }
          return null;
        }

        const msg =
          err?.status === 412 || err?.status === 409
            ? 'Xung đột phiên bản: Bài báo đã được chỉnh sửa bởi người khác. Vui lòng tải lại trang.'
            : err?.detail || err?.message || 'Không thể cập nhật bài báo trên máy chủ.';

        if (options.showToast !== false) {
          sileo.error({
            title: 'Lỗi cập nhật bài báo',
            description: msg,
          });
        }

        options.onError?.(err);
        throw err;
      }
    },
    [mutation, queryClient, options],
  );

  return {
    updatePaper,
    isUpdating: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
