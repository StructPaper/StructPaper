import { defaultDatabase, IndexedDbManuscriptRepo, IndexedDbAssetRepo } from '@structpaper/storage';
import { migrateV1toV2, adaptV2toV1, computeSha256 } from '@structpaper/doc-model';
import { normalizeWorkflowStatus } from '@/features/papers/components/types';
import type { CompletePaper } from '@/types/paper';

/**
 * Persists a CompletePaper (v1 structure) into IndexedDB (v2 structure).
 * Also extracts any base64/dataURI/blob images and persists them as binary Blobs in the assets table.
 */
export async function savePaperToIndexedDb(paper: CompletePaper): Promise<boolean> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return false;

  try {
    const repo = new IndexedDbManuscriptRepo(defaultDatabase);
    const assetRepo = new IndexedDbAssetRepo(defaultDatabase);

    // 1. Save all figure images as binary Blobs in IndexedDbAssetRepo
    if (Array.isArray(paper.sections)) {
      for (const sec of paper.sections) {
        const fig = sec.figure;
        if (
          fig &&
          fig.src &&
          typeof fig.src === 'string' &&
          (fig.src.startsWith('data:') || fig.src.startsWith('blob:'))
        ) {
          try {
            const sha256 = computeSha256(fig.src);
            const res = await fetch(fig.src);
            const blob = await res.blob();
            await assetRepo.save(sha256, blob, { mimeType: blob.type });
          } catch (imgErr) {
            console.warn('[paper-sync] Failed to save figure asset to IndexedDB:', imgErr);
          }
        }
      }
    }

    // 2. Convert v1 document to v2 Manuscript and save to IndexedDbManuscriptRepo
    const v2Doc = migrateV1toV2(paper as any);
    const paperId = v2Doc.id || paper.id || `doc-${Date.now()}`;
    const existingRecord = await repo.getRecord(paperId);

    await repo.save(v2Doc, {
      id: paperId,
      displayName:
        (paper as any).displayName ||
        existingRecord?.info?.displayName ||
        paper.metadata?.title ||
        paper.metadata?.titleEn ||
        'Bản thảo bài báo',
      workflowStatus: normalizeWorkflowStatus(
        (paper as any).workflowStatus ||
          paper.status ||
          existingRecord?.info?.workflowStatus
      ),
      submissionId:
        (paper as any).submissionId || existingRecord?.info?.submissionId,
      note: (paper as any).note || existingRecord?.info?.note,
      tags:
        (paper as any).tags ||
        existingRecord?.info?.tags ||
        [paper.metadata?.journalId || 'VNUHCM'],
      pinned: existingRecord?.info?.pinned ?? false,
      archived: existingRecord?.info?.archived ?? false,
    });
    return true;
  } catch (err) {
    console.error('[paper-sync] Error saving paper to IndexedDB:', err);
    return false;
  }
}

/**
 * Loads a paper by ID from IndexedDB and adapts to v1 CompletePaper.
 */
export async function loadPaperFromIndexedDb(id: string): Promise<CompletePaper | null> {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return null;

  try {
    const repo = new IndexedDbManuscriptRepo(defaultDatabase);
    const assetRepo = new IndexedDbAssetRepo(defaultDatabase);
    const record = await repo.getRecord(id);
    if (!record || !record.doc) return null;

    const v1 = adaptV2toV1(record.doc as any) as CompletePaper;
    if (!v1.id) v1.id = record.info.id;
    (v1 as any).displayName = record.info.displayName;
    (v1 as any).submissionId = record.info.submissionId;
    const normalizedStatus = normalizeWorkflowStatus(record.info.workflowStatus || (v1 as any).status);
    (v1 as any).workflowStatus = normalizedStatus;
    v1.status = normalizedStatus as any;
    (v1 as any).tags = record.info.tags;
    (v1 as any).note = record.info.note;
    if (record.info.displayName && v1.metadata && !v1.metadata.title) {
      v1.metadata.title = record.info.displayName;
    }

    // Hydrate figures if they reference stored asset hashes
    if (Array.isArray(v1.sections)) {
      for (const sec of v1.sections) {
        const fig = sec.figure;
        if (
          fig &&
          fig.src &&
          !fig.src.startsWith('data:') &&
          !fig.src.startsWith('http') &&
          !fig.src.startsWith('blob:')
        ) {
          const blob = await assetRepo.get(fig.src);
          if (blob) {
            fig.src = URL.createObjectURL(blob);
          }
        }
      }
    }

    return v1;
  } catch (err) {
    console.error('[paper-sync] Error loading paper from IndexedDB:', err);
    return null;
  }
}
