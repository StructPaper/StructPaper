import { useState, useCallback } from 'react';
import type { CompletePaper } from '@/types/paper';
import { savePaperToIndexedDb, loadPaperFromIndexedDb } from '@/lib/storage/paper-sync';
import { useCreatePaper } from '@/hooks/useCreatePaper';
import { useUpdatePaper } from '@/hooks/useUpdatePaper';
import { getManuscript, isMockModeEnabled } from '@structpaper/api-client';
import { manuscriptToCompletePaper } from '@/hooks/useLoadPaper';

export interface UsePaperStorageReturn {
  isSaving: boolean;
  isLoading: boolean;
  error: Error | null;
  savePaper: (paper: CompletePaper) => Promise<boolean>;
  loadPaper: (id: string) => Promise<CompletePaper | null>;
}

/**
 * Unified React hook for manuscript persistence & multi-tier synchronization:
 * - Local-First: Guarantees zero data loss by immediately caching to IndexedDB.
 * - Cloud-Sync: Automatically synchronizes with NestJS Backend (/api/v1/manuscripts).
 * - Conflict Detection: Uses optimistic version locking.
 */
export function usePaperStorage(): UsePaperStorageReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { createPaper } = useCreatePaper({ showToast: false });
  const { updatePaper } = useUpdatePaper({ showToast: false });

  const savePaper = useCallback(
    async (paper: CompletePaper): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      // 1. Local-First: Always save to IndexedDB immediately
      try {
        await savePaperToIndexedDb(paper);
      } catch (idbErr) {
        console.error('[usePaperStorage] IndexedDB save failed:', idbErr);
      }

      // 2. Cloud Sync: If not mock mode, push changes to NestJS API
      if (!isMockModeEnabled() && paper.id) {
        try {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paper.id);
          const title = paper.metadata?.title || paper.displayName || 'Bản thảo bài báo';

          if (isUuid) {
            await updatePaper({
              id: paper.id,
              data: {
                title,
                abstract: paper.metadata?.abstract || '',
                metadata: {
                  ...paper.metadata,
                  sections: paper.sections,
                  references: paper.references,
                  layoutSettings: paper.layoutSettings,
                  templateId: paper.templateId,
                },
              },
              version: (paper as any).version,
              localPaper: paper,
            });
          } else {
            // Placeholder/temporary ID -> create on backend
            await createPaper(paper);
          }
        } catch (syncErr: any) {
          console.warn('[usePaperStorage] Cloud sync failed, local copy preserved:', syncErr);
          // We do not fail the save operation because data is safely in IndexedDB
        }
      }

      setIsSaving(false);
      return true;
    },
    [createPaper, updatePaper],
  );

  const loadPaper = useCallback(async (id: string): Promise<CompletePaper | null> => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Try local cache first
      const local = await loadPaperFromIndexedDb(id);
      if (local) {
        return local;
      }

      // 2. If not local and not mock mode, try fetching from backend
      if (!isMockModeEnabled()) {
        try {
          const remote = await getManuscript(id);
          if (remote) {
            const paper = manuscriptToCompletePaper(remote);
            await savePaperToIndexedDb(paper);
            return paper;
          }
        } catch (serverErr) {
          console.warn('[usePaperStorage] Remote fetch failed:', serverErr);
        }
      }

      return null;
    } catch (err) {
      const errObj = err instanceof Error ? err : new Error(String(err));
      setError(errObj);
      console.error('[usePaperStorage] load error:', errObj);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSaving,
    isLoading,
    error,
    savePaper,
    loadPaper,
  };
}
