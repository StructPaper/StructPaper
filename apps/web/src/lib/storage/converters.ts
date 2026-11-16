import type { ManuscriptRecord, WorkflowStatus } from '@structpaper/doc-model';
import type { CompletePaper } from '@/types/paper';
import type { Manuscript } from '@structpaper/api-client';

export const isUuid = (id?: string | null): boolean =>
  typeof id === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * Transforms a remote Manuscript API response into a client ManuscriptRecord.
 * Automatically retains backend-joined journal metadata (code, shortName, color).
 */
export function remoteManuscriptToRecord(item: any): ManuscriptRecord {
  const rawStatus = (item.status || 'draft').toLowerCase().replace('_', '-');
  const validStatuses: WorkflowStatus[] = ['draft', 'in-review', 'proofing', 'ready', 'published'];
  const workflowStatus: WorkflowStatus = validStatuses.includes(rawStatus as WorkflowStatus)
    ? (rawStatus as WorkflowStatus)
    : rawStatus === 'under-review' || rawStatus === 'submitted'
    ? 'in-review'
    : 'draft';

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
      displayName: item.title || 'Bản thảo máy chủ',
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

  return {
    id: ms.id,
    displayName: ms.title,
    metadata: {
      title: ms.title,
      titleEn: meta.titleEn,
      articleType: meta.articleType || 'Bài báo nghiên cứu',
      journalId: ms.journalId || meta.journalId || 'vnu-jst',
      journalName: meta.journalName || 'Tạp chí Khoa học ĐHQGHN',
      journalAbbv: meta.journalAbbv || 'VNU J. Sci.',
      authors: meta.authors || [],
      affiliations: meta.affiliations || [],
      corresponding: meta.corresponding || { name: '', email: '', affiliation: '' },
      abstract: ms.abstract || meta.abstract || '',
      abstractEn: meta.abstractEn,
      keywords: meta.keywords || [],
      keywordsEn: meta.keywordsEn,
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
      ...meta,
    },
    sections: doc?.sections || rawMeta?.sections || [],
    references: doc?.references || rawMeta?.references || [],
    layoutSettings: doc?.layoutSettings || rawMeta?.layoutSettings,
    templateId: doc?.templateId || rawMeta?.templateId || 'vnu-jst',
    templateName: doc?.templateName || rawMeta?.templateName,
    status: (ms.status?.toLowerCase() as any) || 'draft',
    createdAt: ms.createdAt,
    updatedAt: ms.updatedAt,
  };
}
