'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCreateManuscript,
  isMockModeEnabled,
  type CreateManuscriptRequest,
  type Manuscript,
} from '@structpaper/api-client';
import { useStorage } from '@/context/StorageContext';
import { sileo } from '@/components/toast';
import { type CompletePaper, createEmptyPaper } from '@/types/paper';

export interface UseCreatePaperOptions {
  onSuccess?: (manuscript: Manuscript) => void;
  onError?: (error: any) => void;
  showToast?: boolean;
}

export function useCreatePaper(options: UseCreatePaperOptions = {}) {
  const queryClient = useQueryClient();
  const mutation = useCreateManuscript();
  const storage = useStorage();

  const createPaper = useCallback(
    async (
      paper: CompletePaper | { title: string; journalId?: string; metadata?: Record<string, any> },
    ): Promise<Manuscript | null> => {
      const title =
        'metadata' in paper && paper.metadata?.title
          ? paper.metadata.title
          : 'title' in paper
          ? paper.title
          : 'Bản thảo bài báo';

      const journalId =
        'metadata' in paper && (paper.metadata as any)?.journalId
          ? (paper.metadata as any).journalId
          : 'journalId' in paper
          ? paper.journalId
          : undefined;

      const payload: CreateManuscriptRequest = {
        title: title.trim(),
        journalId,
        metadata: {
          ...('metadata' in paper ? paper.metadata : {}),
          sectionsCount: 'sections' in paper ? paper.sections?.length : 0,
          authors: 'authors' in paper ? paper.authors : [],
        },
      };

      // 1. If Mock Mode is enabled, save via storage
      if (isMockModeEnabled()) {
        try {
          if ('id' in paper && 'sections' in paper) {
            await storage.savePaper(paper as CompletePaper);
          }
          if (options.showToast !== false) {
            sileo.success({
              title: 'Tạo bài báo thành công (Offline Mode)',
              description: `Đã lưu bản nháp "${title}" vào trình duyệt.`,
            });
          }
          queryClient.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] });
          return {
            id: 'id' in paper ? (paper as any).id : crypto.randomUUID(),
            title,
            journalId: journalId || '00000000-0000-0000-0000-000000000000',
            status: 'DRAFT',
            version: 1,
            currentServerRev: 0,
            createdBy: 'offline-user',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          } as Manuscript;
        } catch (err: any) {
          if (options.showToast !== false) {
            sileo.error({
              title: 'Lỗi lưu bài báo',
              description: err?.message || 'Không thể lưu bản thảo cục bộ.',
            });
          }
          throw err;
        }
      }

      // 2. Online Mode: Submit to Backend NestJS API
      try {
        const result = await mutation.mutateAsync({ data: payload });

        // Dual-write: Cache newly created manuscript via unified storage
        try {
          const emptyBase = createEmptyPaper(result.journalId);
          const completePaperToCache: CompletePaper = 'sections' in paper ? {
            ...(paper as CompletePaper),
            id: result.id,
          } : {
            ...emptyBase,
            id: result.id,
            metadata: {
              ...emptyBase.metadata,
              title: result.title,
              journalId: result.journalId,
              ...(('metadata' in paper ? paper.metadata : {}) as any),
            },
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
          };
          await storage.savePaper(completePaperToCache);
        } catch (e) {
          console.warn('[useCreatePaper] Cache save failed:', e);
        }

        // Invalidate manuscripts list cache so UI updates immediately
        queryClient.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] });

        if (options.showToast !== false) {
          sileo.success({
            title: 'Tạo bài báo thành công',
            description: `Bản thảo "${result.title}" đã được lưu trên máy chủ đám mây.`,
          });
        }

        options.onSuccess?.(result);
        return result;
      } catch (err: any) {
        // Fallback gracefully to IndexedDB if network error
        const offlineId = 'id' in paper ? (paper as any).id : `offline-${Date.now()}`;
        const emptyOffline = createEmptyPaper(journalId);
        const offlinePaper: CompletePaper = 'sections' in paper ? (paper as CompletePaper) : {
          ...emptyOffline,
          id: offlineId,
          metadata: {
            ...emptyOffline.metadata,
            title,
            journalId,
            ...(('metadata' in paper ? paper.metadata : {}) as any),
          },
        };

        try {
          console.warn('[useCreatePaper] Network failed, falling back to offline storage:', err);
          await storage.savePaper(offlinePaper);
          if (options.showToast !== false) {
            sileo.info({
              title: 'Đã lưu ngoại tuyến (Offline)',
              description: 'Máy chủ tạm thời chưa kết nối được. Bản nháp đã lưu trên máy bạn.',
            });
          }
          return {
            id: offlineId,
            title,
            journalId: journalId || '00000000-0000-0000-0000-000000000000',
            status: 'DRAFT',
            version: 1,
            currentServerRev: 0,
            createdBy: 'offline-user',
            createdAt: offlinePaper.createdAt || new Date().toISOString(),
            updatedAt: offlinePaper.updatedAt || new Date().toISOString(),
          } as Manuscript;
        } catch (storageErr) {
          console.error('[useCreatePaper] IndexedDB fallback also failed:', storageErr);
        }

        const msg =
          err?.detail ||
          err?.response?.data?.detail ||
          err?.message ||
          'Không thể khởi tạo bài báo trên máy chủ.';
        if (options.showToast !== false) {
          sileo.error({
            title: 'Lỗi khởi tạo bài báo',
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
    createPaper,
    isCreating: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
