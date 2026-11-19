'use client';

import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useStorage } from '@/context/StorageContext';
import { sileo } from '@/components/toast';

export interface UseDeletePaperOptions {
  onSuccess?: (id: string) => void;
  onError?: (error: any) => void;
  showToast?: boolean;
}

/**
 * Hook to delete a paper across active storage tiers via Unified ManuscriptStorage.
 * Clean, decoupled, and free of if-else storage configuration checks.
 */
export function useDeletePaper(options: UseDeletePaperOptions = {}) {
  const queryClient = useQueryClient();
  const storage = useStorage();
  const [isDeleting, setIsDeleting] = useState(false);

  const deletePaper = useCallback(
    async (id: string): Promise<boolean> => {
      setIsDeleting(true);
      try {
        await storage.delete(id);
        queryClient.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] });

        if (options.showToast !== false) {
          sileo.info({
            title: 'Đã chuyển vào thùng rác',
            description: 'Bạn có thể khôi phục bài báo này trong Thùng rác trong thời gian lưu giữ.',
          });
        }

        options.onSuccess?.(id);
        return true;
      } catch (err: any) {
        const msg = err?.detail || err?.message || 'Không thể xóa bài báo';
        if (options.showToast !== false) {
          sileo.error({
            title: 'Lỗi xóa bài báo',
            description: msg,
          });
        }
        options.onError?.(err);
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [storage, queryClient, options]
  );

  return { deletePaper, isDeleting };
}
