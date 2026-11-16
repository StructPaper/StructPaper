import type { CompletePaper } from '@/types/paper';
import type { ManuscriptRecord, ManuscriptInfo, Manuscript } from '@structpaper/doc-model';
import type { ManuscriptStorage, SavePaperResult } from './types';

/**
 * Composite Repository coordinating Local and Remote storage tiers.
 * Completely decouples Application/UI hooks from persistence details and configuration flags.
 */
export class UnifiedManuscriptRepository implements ManuscriptStorage {
  constructor(
    private readonly local: ManuscriptStorage,
    private readonly remote: ManuscriptStorage
  ) {}

  get isLocalAvailable(): boolean {
    return this.local.isLocalAvailable;
  }

  async saveRecord(doc: Manuscript, info?: Partial<ManuscriptInfo>): Promise<void> {
    await this.local.saveRecord(doc, info);
  }

  async savePaper(paper: CompletePaper): Promise<SavePaperResult> {
    const originalLocalId = paper.id;

    // 1. Write to local storage (No-op if local storage is disabled)
    await this.local.savePaper(paper);

    // 2. Write to remote server
    const remoteResult = await this.remote.savePaper(paper);

    // If server assigned a new UUID or version, update paper and sync cache if local is active
    if (remoteResult?.id && remoteResult.id !== originalLocalId) {
      paper.id = remoteResult.id;
      if (remoteResult.version !== undefined) {
        (paper as any).version = remoteResult.version;
      }
      if (this.local.isLocalAvailable) {
        await this.local.savePaper(paper);
        // Clean up temporary local ID to prevent duplicate orphan cards
        if (originalLocalId) {
          try {
            await this.local.delete(originalLocalId);
          } catch {
            // Ignore if local deletion fails
          }
        }
      }
    }

    return remoteResult || { id: paper.id };
  }

  async loadPaper(id: string): Promise<CompletePaper | null> {
    // 1. Try local storage first (returns null immediately if local storage is No-op)
    const local = await this.local.loadPaper(id);
    if (local) {
      return local;
    }

    // 2. Fallback to server
    const remote = await this.remote.loadPaper(id);
    if (remote) {
      // If local storage is enabled, warm up the local cache
      if (this.local.isLocalAvailable) {
        await this.local.savePaper(remote);
      }
      return remote;
    }

    return null;
  }

  async listRecords(): Promise<ManuscriptRecord[]> {
    // If local storage is active, read local records and merge with remote
    // If local storage is No-op (Server-Only mode), falls through directly to remote!
    if (this.local.isLocalAvailable) {
      const localRecords = await this.local.listRecords();
      try {
        const remoteRecords = await this.remote.listRecords();
        const localIdSet = new Set(localRecords.map((r) => r.info.id));
        const merged = [...localRecords];
        for (const r of remoteRecords) {
          if (!localIdSet.has(r.info.id)) {
            merged.push(r);
          }
        }
        return merged;
      } catch {
        return localRecords;
      }
    }

    return this.remote.listRecords();
  }

  async getRecord(id: string): Promise<ManuscriptRecord | null> {
    if (this.local.isLocalAvailable) {
      const local = await this.local.getRecord(id);
      if (local) {
        return local;
      }
    }

    return this.remote.getRecord(id);
  }

  async delete(id: string): Promise<void> {
    await this.local.delete(id);
    await this.remote.delete(id);
  }

  async updateInfo(id: string, patch: Partial<ManuscriptInfo>): Promise<void> {
    await this.local.updateInfo(id, patch);
    await this.remote.updateInfo(id, patch);
  }

  async duplicate(paper: ManuscriptRecord): Promise<{ id: string }> {
    if (this.local.isLocalAvailable) {
      const localDup = await this.local.duplicate(paper);
      // Also sync copy to remote
      const remoteDup = await this.remote.duplicate(paper);
      return remoteDup?.id ? remoteDup : localDup;
    }

    return this.remote.duplicate(paper);
  }
}
