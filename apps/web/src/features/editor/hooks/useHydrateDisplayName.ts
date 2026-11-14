'use client';

import { useEffect, useRef } from 'react';
import { defaultDatabase, IndexedDbManuscriptRepo } from '@structpaper/storage';

/**
 * Hydrates missing in-memory `displayName` ("Tên hiển thị bài báo") from IndexedDB
 * when an editor session opens from sessionStorage/in-memory cache without marking dirty.
 */
export function useHydrateDisplayName(
  paperId: string | undefined,
  currentDisplayName: string | undefined,
  onHydrated: (paperId: string, displayName: string) => void
): void {
  const onHydratedRef = useRef(onHydrated);
  onHydratedRef.current = onHydrated;

  useEffect(() => {
    if (!paperId || currentDisplayName?.trim()) return;
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return;

    let active = true;
    try {
      const repo = new IndexedDbManuscriptRepo(defaultDatabase);
      repo
        .getRecord(paperId)
        .then((record) => {
          const persistedName = record?.info?.displayName?.trim();
          if (active && persistedName) {
            onHydratedRef.current(paperId, persistedName);
          }
        })
        .catch(() => {
          // Best-effort hydration from local IndexedDB
        });
    } catch {
      // Ignore storage initialization errors outside browser/indexeddb contexts
    }

    return () => {
      active = false;
    };
  }, [paperId, currentDisplayName]);
}
