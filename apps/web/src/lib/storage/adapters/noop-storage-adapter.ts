import type { CompletePaper } from '@/types/paper';
import type { ManuscriptRecord, ManuscriptInfo, Manuscript } from '@structpaper/doc-model';
import type { ManuscriptStorage, SavePaperResult } from '../types';

/**
 * Null Object Pattern Implementation of ManuscriptStorage.
 * Used when local IndexedDB storage is toggled OFF (Server-Only Mode).
 * Completely eliminates if-else checks across hooks and components.
 */
export class NoopManuscriptStorageAdapter implements ManuscriptStorage {
  readonly isLocalAvailable = false;

  async savePaper(paper: CompletePaper): Promise<SavePaperResult> {
    return { id: paper.id, version: (paper as any).version };
  }

  async saveRecord(_doc: Manuscript, _info?: Partial<ManuscriptInfo>): Promise<void> {
    // No-op
  }

  async loadPaper(_id: string): Promise<CompletePaper | null> {
    return null;
  }

  async listRecords(): Promise<ManuscriptRecord[]> {
    return [];
  }

  async getRecord(_id: string): Promise<ManuscriptRecord | null> {
    return null;
  }

  async delete(_id: string): Promise<void> {
    // No-op
  }

  async updateInfo(_id: string, _patch: Partial<ManuscriptInfo>): Promise<void> {
    // No-op
  }

  async duplicate(_paper: ManuscriptRecord): Promise<{ id: string }> {
    return { id: '' };
  }
}
