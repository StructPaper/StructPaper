import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CompletePaper } from '@/types/paper';
import { useStorage } from '@/context/StorageContext';

export interface UsePaperStorageReturn {
  isSaving: boolean;
  isLoading: boolean;
  error: Error | null;
  savePaper: (paper: CompletePaper) => Promise<boolean>;
  loadPaper: (id: string) => Promise<CompletePaper | null>;
}

/**
 * Unified React hook for manuscript persistence:
 * Uses the Composite ManuscriptStorage layer via useStorage().
 * Clean, decoupled, and completely free of if-else storage configuration checks.
 */
export function usePaperStorage(): UsePaperStorageReturn {
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const storage = useStorage();

  let queryClient: any;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    queryClient = useQueryClient();
  } catch {
    // Safe fallback when executed outside QueryClientProvider
  }

  const savePaper = useCallback(
    async (paper: CompletePaper): Promise<boolean> => {
      setIsSaving(true);
      setError(null);

      try {
        const result = await storage.savePaper(paper);
        if (result?.id) {
          paper.id = result.id;
          if (result.version !== undefined) {
            (paper as any).version = result.version;
          }
        }

        if (queryClient) {
          try {
            queryClient.invalidateQueries({ queryKey: ['/api/v1/manuscripts'] });
            queryClient.invalidateQueries({ queryKey: ['manuscripts'] });
          } catch {
            // ignore
          }
        }

        return true;
      } catch (err: any) {
        console.warn('[usePaperStorage] save error:', err);
        setError(err instanceof Error ? err : new Error(String(err)));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [storage, queryClient]
  );

  const loadPaper = useCallback(
    async (id: string): Promise<CompletePaper | null> => {
      setIsLoading(true);
      setError(null);
      try {
        return await storage.loadPaper(id);
      } catch (err: any) {
        const errObj = err instanceof Error ? err : new Error(String(err));
        setError(errObj);
        console.error('[usePaperStorage] load error:', errObj);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [storage]
  );

  return {
    isSaving,
    isLoading,
    error,
    savePaper,
    loadPaper,
  };
}
