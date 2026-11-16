import type { ManuscriptRecord, WorkflowStatus } from '@structpaper/doc-model';
import type { CompletePaper } from '@/types/paper';
import type { Manuscript } from '@structpaper/api-client';
import { normalizeWorkflowStatus } from '@/features/papers/components/types';

export const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * Transforms a remote Manuscript API response into a client ManuscriptRecord.
 * Automatically retains backend-joined journal metadata (code, shortName, color).
 */
export function remoteManuscriptToRecord(item: any): ManuscriptRecord {
  const workflowStatus = normalizeWorkflowStatus(
    item.status || item.workflowStatus || item.metadata?.workflowStatus
  );

  const authors = Array.isArray(item.metadata?.authors)
    ? item.metadata.authors
    : typeof item.metadata?.authors === 'string'
    ? [{ name: item.metadata.authors }]
    : [];

  const rawMeta = item.metadata || {};
  const docMeta = rawMeta.doc?.metadata || rawMeta;
  const journalCode =
    item.journal?.code ||
    item.metadata?.journalAbbv ||
    rawMeta.journalId ||
    docMeta.journalId ||
    'VNUHCM-STD';

  return {
    info: {
      id: item.id,
      displayName: item.metadata?.displayName || (item.metadata?.doc?.metadata as any)?.displayName || item.title || 'Bản thảo máy chủ',
      workflowStatus,
      pinned: Boolean(item.metadata?.pinned),
      archived: item.status === 'ARCHIVED',
      tags: item.metadata?.tags || [journalCode],
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || item.createdAt || new Date().toISOString(),
      submissionId: item.metadata?.submissionId,
      note: item.metadata?.note,
    },
    doc: {
      id: item.id,
      journalId: journalCode,
      journal: item.journal,
      meta: {
        title: [{ t: 'text', v: item.title || 'Bản thảo máy chủ' }],
        authors,
        abstract: item.abstract || item.metadata?.abstract || '',
        journalAbbv: item.journal?.shortName || item.journal?.code || 'STD',
      },
      sections: item.metadata?.sections || [],
      schemaVersion: 2,
    } as any,
    revision: item.version || item.currentServerRev || 1,
    syncState: 'synced',
    remoteData: item,
  } as any;
}

/**
 * Transforms a remote Manuscript API model into a CompletePaper for the editor.
 */
export function manuscriptToCompletePaper(ms: Manuscript): CompletePaper {
  const rawMeta = (ms.metadata || {}) as any;
  const doc = rawMeta?.doc || rawMeta;
  const meta = doc?.metadata || rawMeta;
  const journal = (ms as any).journal;

  const journalCode =
    journal?.code ||
    (ms as any).journalCode ||
    ms.journalId ||
    meta.journalId ||
    'VNUHCM-STD';

  const journalName =
    journal?.name ||
    meta.journalName ||
    'Tạp chí Phát triển Khoa học và Công nghệ ĐHQG-HCM';

  const journalAbbv =
    journal?.shortName ||
    journal?.code ||
    meta.journalAbbv ||
    'STD';

  const journalColor = journal?.color || meta.journalColor || '#000099';

  return {
    id: ms.id,
    displayName: meta.displayName || (ms.metadata as any)?.displayName || ms.title || meta.title || 'Bản thảo bài báo',
    version: ms.version ?? 1,
    currentServerRev: (ms as any).currentServerRev ?? ms.version ?? 1,
    metadata: {
      articleType: 'Bài báo nghiên cứu',
      ...meta,
      title: ms.title || meta.title || 'Bản thảo bài báo',
      titleEn: meta.titleEn || '',
      journalId: journalCode,
      journalName,
      journalAbbv,
      journalColor,
      authors: Array.isArray(meta.authors) ? meta.authors : [],
      affiliations: Array.isArray(meta.affiliations) ? meta.affiliations : [],
      corresponding: meta.corresponding || { name: '', email: '', affiliation: '' },
      abstract: ms.abstract ?? meta.abstract ?? '',
      abstractEn: meta.abstractEn || '',
      keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
      keywordsEn: Array.isArray(meta.keywordsEn) ? meta.keywordsEn : [],
      dates: meta.dates || {
        received: '',
        revised: '',
        accepted: '',
        published: '',
      },
      doi: meta.doi || '',
      volume: meta.volume || '',
      issue: meta.issue || '',
      year: meta.year || String(new Date().getFullYear()),
      firstPage: meta.firstPage || 1,
      lastPage: meta.lastPage || 10,
    },
    sections: doc?.sections || rawMeta?.sections || [],
    references: doc?.references || rawMeta?.references || [],
    layoutSettings: doc?.layoutSettings || rawMeta?.layoutSettings,
    templateId: doc?.templateId || rawMeta?.templateId || journalCode.toLowerCase(),
    templateName: doc?.templateName || rawMeta?.templateName || journalName,
    status: normalizeWorkflowStatus(ms.status || (ms as any).workflowStatus),
    workflowStatus: normalizeWorkflowStatus(ms.status || (ms as any).workflowStatus),
    createdAt: ms.createdAt,
    updatedAt: ms.updatedAt,
  };
}
