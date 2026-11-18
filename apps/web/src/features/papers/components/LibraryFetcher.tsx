'use client';

import { useEffect } from 'react';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import { useLibraryPapers, type LibraryMode } from '../hooks/useLibraryPapers';

export interface LibraryState {
  records: ManuscriptRecord[] | null;
  isLoading: boolean;
}

export const NO_LIBRARY: LibraryState = { records: null, isLoading: false };

/**
 * Loads one of the server lists (public library / shared with me) and hands it to the page.
 * It only exists while such a list is switched on, so the normal page never needs the query layer.
 */
export const LibraryFetcher: React.FC<{ mode: Exclude<LibraryMode, 'mine'>; onState: (s: LibraryState) => void }> = ({ mode, onState }) => {
  const { records, isLoading } = useLibraryPapers(mode);
  useEffect(() => {
    onState({ records, isLoading });
  }, [records, isLoading, onState]);
  useEffect(() => () => onState(NO_LIBRARY), [onState]);
  return null;
};
