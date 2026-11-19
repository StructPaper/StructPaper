'use client';

import { useState, useCallback } from 'react';
import { checkPaperTitleDuplicate, getUniquePaperTitle } from '@/lib/storage/paper-naming';
import { fetchTitleDuplicates, type TitleDuplicate } from '@/lib/storage/title-duplicates';

export interface DuplicatePromptState {
  isOpen: boolean;
  paperTitle: string;
  suggestedTitle: string;
  matchCount: number;
  /** Who uploaded a paper with this title before (every user, server side). */
  uploaders: TitleDuplicate[];
  journalId?: string;
  onProceed: (resolvedTitle: string) => void | Promise<void>;
}

/**
 * Custom hook to encapsulate paper duplicate detection, warning modal state,
 * and auto-incremented unique naming.
 */
export function usePaperDuplicateWarning() {
  const [duplicatePrompt, setDuplicatePrompt] = useState<DuplicatePromptState | null>(null);

  /**
   * Checks whether targetTitle already exists in the database.
   * If a duplicate exists (matchCount > 0), opens the warning modal and defers onProceed.
   * If no duplicate exists, immediately calls onProceed with the original title.
   */
  const checkAndPromptDuplicate = useCallback(
    async (
      targetTitle: string,
      options: {
        journalId?: string;
        excludeId?: string;
        onProceed: (resolvedTitle: string) => void | Promise<void>;
      }
    ) => {
      const normalizedTitle = targetTitle.trim() || 'Bản thảo bài báo';
      const { count: localCount, uniqueTitle: localUnique } = await checkPaperTitleDuplicate(normalizedTitle, options.excludeId);
      const uploaders = await fetchTitleDuplicates(normalizedTitle);
      // numbered after the copies other people already have too: "Title (1)" may be taken by someone else
      const uniqueTitle = getUniquePaperTitle(localUnique, uploaders.map((u) => u.title));
      const count = Math.max(localCount, uploaders.length);

      if (count > 0) {
        setDuplicatePrompt({
          isOpen: true,
          paperTitle: normalizedTitle,
          suggestedTitle: uniqueTitle,
          matchCount: count,
          uploaders,
          journalId: options.journalId,
          onProceed: options.onProceed,
        });
      } else {
        await options.onProceed(normalizedTitle);
      }
    },
    []
  );

  /**
   * Helper for blank papers to get the next auto-incremented title without showing a modal.
   */
  const getAutoUniqueTitle = useCallback(
    async (baseTitle = 'Bản thảo bài báo', excludeId?: string): Promise<string> => {
      const { uniqueTitle } = await checkPaperTitleDuplicate(baseTitle, excludeId);
      return uniqueTitle;
    },
    []
  );

  /**
   * Called when user clicks "Vẫn tải lên" in the warning modal.
   */
  const handleConfirmDuplicate = useCallback(async () => {
    if (!duplicatePrompt) return;
    const { suggestedTitle, onProceed } = duplicatePrompt;
    setDuplicatePrompt(null);
    await onProceed(suggestedTitle);
  }, [duplicatePrompt]);

  /**
   * Called when user cancels / closes the warning modal.
   */
  const handleCloseDuplicate = useCallback(() => {
    setDuplicatePrompt(null);
  }, []);

  return {
    duplicatePrompt,
    checkAndPromptDuplicate,
    getAutoUniqueTitle,
    handleConfirmDuplicate,
    handleCloseDuplicate,
  };
}
