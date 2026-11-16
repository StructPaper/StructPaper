import { manuscriptApi } from '@structpaper/api-client';
import type { CompletePaper } from '@/types/paper';
import type { ManuscriptRecord, ManuscriptInfo, Manuscript } from '@structpaper/doc-model';
import { isUuid, remoteManuscriptToRecord, manuscriptToCompletePaper } from '../converters';
import type { ManuscriptStorage, SavePaperResult } from '../types';

export class ServerManuscriptStorageAdapter implements ManuscriptStorage {
  readonly isLocalAvailable = false;

  async savePaper(paper: CompletePaper): Promise<SavePaperResult> {
    const title = paper.metadata?.title?.trim() || paper.displayName || 'Bản thảo bài báo';
    const abstract = paper.metadata?.abstract || '';
    const metadata = {
      ...paper.metadata,
      displayName: paper.displayName,
      sections: paper.sections || [],
      references: paper.references || [],
      layoutSettings: paper.layoutSettings,
      templateId: paper.templateId,
      templateName: paper.templateName,
    };

    if (paper.id && isUuid(paper.id)) {
      const version = (paper as any).version;
      const forceSave = Boolean((paper as any).forceSave);
      const headers = !forceSave && version !== undefined ? { 'If-Match': `"${version}"` } : undefined;
      const rawStatus = (paper as any).workflowStatus || paper.status;
      const apiStatus = rawStatus
        ? (String(rawStatus).trim().toUpperCase().replace(/-/g, '_') as any)
        : undefined;
      const updated = await manuscriptApi.update(
        paper.id,
        {
          title,
          abstract,
          ...(apiStatus ? { status: apiStatus } : {}),
          metadata,
        },
        headers
      );

      const newVersion = updated?.version ?? (version !== undefined ? version + 1 : 1);
      paper.version = newVersion;
      if (updated?.id) {
        paper.id = updated.id;
      }

      return {
        id: updated?.id || paper.id,
        version: newVersion,
      };
    }

    const journalId = (paper.metadata as any)?.journalId || 'VNUHCM-STD';
    const created = await manuscriptApi.create({
      title,
      journalId,
      metadata,
      abstract: abstract || null,
    });

    const newVersion = created.version ?? 1;
    paper.id = created.id;
    paper.version = newVersion;

    return {
      id: created.id,
      version: newVersion,
    };
  }

  async saveRecord(_doc: Manuscript, _info?: Partial<ManuscriptInfo>): Promise<void> {
    // Handled via savePaper / API
  }

  async loadPaper(id: string): Promise<CompletePaper | null> {
    try {
      const remote = await manuscriptApi.get(id);
      if (remote) {
        return manuscriptToCompletePaper(remote as any);
      }
      return null;
    } catch (err) {
      console.warn('[ServerStorageAdapter] loadPaper error:', err);
      return null;
    }
  }

  async listRecords(): Promise<ManuscriptRecord[]> {
    try {
      const response: any = await manuscriptApi.list({ limit: 100 });
      const items: any[] = Array.isArray(response)
        ? response
        : response?.items || response?.data || [];
      return items.map(remoteManuscriptToRecord);
    } catch (err) {
      console.warn('[ServerStorageAdapter] listRecords error:', err);
      return [];
    }
  }

  async getRecord(id: string): Promise<ManuscriptRecord | null> {
    try {
      const remote = await manuscriptApi.get(id);
      if (remote) {
        return remoteManuscriptToRecord(remote);
      }
      return null;
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<void> {
    if (isUuid(id)) {
      try {
        await manuscriptApi.delete(id);
      } catch (err) {
        console.warn('[ServerStorageAdapter] delete error:', err);
      }
    }
  }

  async updateInfo(id: string, patch: Partial<ManuscriptInfo>): Promise<void> {
    if (isUuid(id)) {
      try {
        await manuscriptApi.update(id, {
          title: patch.displayName,
          status: patch.workflowStatus ? (patch.workflowStatus.toUpperCase().replace(/-/g, '_') as any) : undefined,
          metadata: {
            displayName: patch.displayName,
            submissionId: patch.submissionId,
            note: patch.note,
            tags: patch.tags,
            pinned: patch.pinned,
          },
        });
      } catch (err) {
        console.warn('[ServerStorageAdapter] updateInfo error:', err);
      }
    }
  }

  async duplicate(paper: ManuscriptRecord): Promise<{ id: string }> {
    const rawTitle = paper.info.displayName || 'Bản sao bài báo';
    const title = `${rawTitle} (Bản sao)`;
    const journalId = paper.doc?.journalId || 'VNUHCM-STD';

    const created = await manuscriptApi.create({
      title,
      journalId,
      metadata: {
        displayName: title,
        authors: (paper.doc?.meta as any)?.authors || [],
        sections: (paper.doc as any)?.sections || [],
        abstract: (paper.doc?.meta as any)?.abstract || '',
      },
    });

    return { id: created.id };
  }
}
