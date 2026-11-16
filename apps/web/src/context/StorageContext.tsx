'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { ManuscriptStorage } from '@/lib/storage/types';
import { createManuscriptStorage, getUnifiedStorage } from '@/lib/storage/storage-factory';

const StorageContext = createContext<ManuscriptStorage | null>(null);

export interface StorageProviderProps {
  children: React.ReactNode;
  /**
   * Optional override for local storage persistence.
   * Defaults to reading from STORAGE_CONFIG.ENABLE_LOCAL_STORAGE.
   */
  enableLocal?: boolean;
}

/**
 * StorageProvider mounts the unified storage layer into the React tree.
 * The Composite + Null Object pattern handles local vs remote persistence invisibly.
 */
export const StorageProvider: React.FC<StorageProviderProps> = ({ children, enableLocal }) => {
  const storage = useMemo(() => {
    return createManuscriptStorage(enableLocal);
  }, [enableLocal]);

  return <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>;
};

/**
 * React hook to access the unified manuscript storage repository.
 * Completely free of if-else configuration checks.
 */
export function useStorage(): ManuscriptStorage {
  const context = useContext(StorageContext);
  if (!context) {
    // Safe fallback for isolated components or tests executed outside StorageProvider
    return getUnifiedStorage();
  }
  return context;
}
