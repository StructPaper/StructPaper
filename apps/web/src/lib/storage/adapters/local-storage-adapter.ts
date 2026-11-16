import { defaultDatabase, IndexedDbManuscriptRepo } from '@structpaper/storage';
import type { CompletePaper } from '@/types/paper';
import type { ManuscriptRecord, ManuscriptInfo, Manuscript } from '@structpaper/doc-model';
import { savePaperToIndexedDb, loadPaperFromIndexedDb } from '../paper-sync';
import type { ManuscriptStorage, SavePaperResult } from '../types';

export class LocalManuscriptStorageAdapter implements ManuscriptStorage {
  readonly isLocalAvailable = true;
  private readonly repo: IndexedDbManuscriptRepo;

  constructor() {
    this.repo = new IndexedDbManuscriptRepo(defaultDatabase);
  }

  async savePaper(paper: CompletePaper): Promise<SavePaperResult> {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      return { id: paper.id, version: (paper as any).version };
    }
    await savePaperToIndexedDb(paper);
    return { id: paper.id, version: (paper as any).version };
  }

  async saveRecord(doc: Manuscript, info?: Partial<ManuscriptInfo>): Promise<void> {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      return;
    }
    await this.repo.save(doc, info);
  }

  async loadPaper(id: string): Promise<CompletePaper | null> {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      return null;
    }
    return loadPaperFromIndexedDb(id);
  }

  async listRecords(): Promise<ManuscriptRecord[]> {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      return [];
    }
    return this.repo.listRecords();
  }

  async getRecord(id: string): Promise<ManuscriptRecord | null> {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      return null;
    }
    return this.repo.getRecord(id);
  }

  async delete(id: string): Promise<void> {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      return;
    }
    await this.repo.delete(id);
  }

  async updateInfo(id: string, patch: Partial<ManuscriptInfo>): Promise<void> {
    if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
      return;
    }
    await this.repo.updateInfo(id, patch);
  }

  async duplicate(paper: ManuscriptRecord): Promise<{ id: string }> {
    const rawTitle = paper.info.displayName || 'Bản sao bài báo';
    const newId = `paper_${Date.now()}`;
    const newDoc = {
      ...paper.doc,
      id: newId,
      meta: {
        ...paper.doc.meta,
        title: [{ t: 'text', v: `${rawTitle} (Bản sao)` }],
      },
    };

    const newInfo: Partial<ManuscriptInfo> = {
      ...paper.info,
      id: newId,
      displayName: `${rawTitle} (Bản sao)`,
      submissionId: paper.info.submissionId ? `${paper.info.submissionId}_copy` : undefined,
      pinned: false,
      updatedAt: new Date().toISOString(),
    };

    await this.repo.save(newDoc as any, newInfo);
    return { id: newId };
  }
}
