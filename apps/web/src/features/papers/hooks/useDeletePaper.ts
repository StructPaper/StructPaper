'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useDeleteManuscript, isMockModeEnabled } from '@structpaper/api-client';
import { IndexedDbManuscriptRepo } from '@structpaper/storage';
import { sileo } from '@/components/toast';

export interface UseDeletePaperOptions {
  onSuccess?: (id: string) => void;
  onError?: (error: any) => void;
  showToast?: boolean;
}

export function useDeletePaper(options: UseDeletePaperOptions = {}) {
  const queryClient = useQueryClient();
  const mutation = useDeleteManuscript();

  const deletePaper = useCallback(
    async (id: string): Promise<boolean> => {
      // 1. Delete from local IndexedDB repository if present
      try {
        const repo = new IndexedDbManuscriptRepo();
        await repo.delete(id);
      } catch (localErr) {
        console.warn('[useDeletePaper] Local delete error:', localErr);
      }

      // 2. If in Mock Mode, finish after local deletion
      if (isMockModeEnabled()) {
        queryClient.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] });
        if (options.showToast !== false) {
          sileo.info({
            title: 'Đã xóa bài báo (Offline)',
            description: 'Bản thảo đã được gỡ bỏ khỏi bộ nhớ trình duyệt.',
          });
        }
        options.onSuccess?.(id);
        return true;
      }

      // 3. Online Mode: Send DELETE request to Backend NestJS API
      try {
        await mutation.mutateAsync({ id });
        queryClient.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] });

        if (options.showToast !== false) {
          sileo.info({
            title: 'Đã xóa bài báo',
            description: 'Bản thảo đã được gỡ bỏ khỏi máy chủ đám mây.',
          });
        }

        options.onSuccess?.(id);
        return true;
      } catch (err: any) {
        const msg =
          err?.detail ||
          err?.response?.data?.detail ||
          err?.message ||
          'Không thể xóa bài báo trên máy chủ.';

        if (options.showToast !== false) {
          sileo.error({
            title: 'Lỗi xóa bài báo',
            description: msg,
          });
        }

        options.onError?.(err);
        return false;
      }
    },
    [mutation, queryClient, options],
  );

  return {
    deletePaper,
    isDeleting: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
}
