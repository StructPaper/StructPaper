import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePaper } from '@/context/PaperContext';
import { usePaperStorage } from '@/features/editor';
import type { CompletePaper } from '@/types/paper';

export function usePaperUpload() {
  const router = useRouter();
  const { paper, setPaper } = usePaper();
  const { savePaper } = usePaperStorage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handlePaperLoaded = useCallback(
    (newPaper: CompletePaper) => {
      setIsProcessing(true);
      setError(null);
      try {
        setPaper(newPaper);
        savePaper(newPaper).catch((err) => {
          console.warn('[usePaperUpload] Background save warning:', err);
        });
        router.push('/editor');
      } catch (err: any) {
        const errObj = err instanceof Error ? err : new Error(String(err));
        setError(errObj);
        console.error('[usePaperUpload] Upload processing error:', errObj);
      } finally {
        setIsProcessing(false);
      }
    },
    [setPaper, savePaper, router]
  );

  return {
    currentPaper: paper,
    isProcessing,
    error,
    handlePaperLoaded,
  };
}
