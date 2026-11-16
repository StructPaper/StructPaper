import { isLocalStorageEnabled } from '@/config/storage.config';
import { LocalManuscriptStorageAdapter } from './adapters/local-storage-adapter';
import { NoopManuscriptStorageAdapter } from './adapters/noop-storage-adapter';
import { ServerManuscriptStorageAdapter } from './adapters/server-storage-adapter';
import { UnifiedManuscriptRepository } from './unified-manuscript-repository';
import type { ManuscriptStorage } from './types';

/**
 * Factory function creating a configured ManuscriptStorage instance.
 * Checks the storage configuration flag in this single isolated location.
 */
export function createManuscriptStorage(enableLocal?: boolean): ManuscriptStorage {
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const shouldEnableLocal = enableLocal !== undefined ? enableLocal : (isTest || isLocalStorageEnabled());

  const localAdapter = shouldEnableLocal
    ? new LocalManuscriptStorageAdapter()
    : new NoopManuscriptStorageAdapter();

  const remoteAdapter = new ServerManuscriptStorageAdapter();

  return new UnifiedManuscriptRepository(localAdapter, remoteAdapter);
}

let defaultStorageInstance: ManuscriptStorage | null = null;

/**
 * Returns a shared singleton ManuscriptStorage instance for non-React contexts or utility functions.
 */
export function getUnifiedStorage(enableLocal?: boolean): ManuscriptStorage {
  if (!defaultStorageInstance || enableLocal !== undefined) {
    defaultStorageInstance = createManuscriptStorage(enableLocal);
  }
  return defaultStorageInstance;
}
