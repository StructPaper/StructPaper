'use client';

import { useState, useCallback } from 'react';
import type { ManuscriptRecord, ManuscriptInfo, WorkflowStatus } from '@structpaper/doc-model';
import { migrateV1toV2 } from '@structpaper/doc-model';
import { defaultDatabase, IndexedDbManuscriptRepo } from '@structpaper/storage';
import { manuscriptApi, ProblemDetailsError } from '@structpaper/api-client';
import { isUuid } from '@/lib/storage/converters';
import { normalizeWorkflowStatus } from '../components/types';
import { sileo } from '@/components/toast';
import type { CompletePaper } from '@/types/paper';

/**
 * Custom hook to encapsulate loading, opening, and saving quick-edit manuscript info
 * for both UnifiedEditorView and TypstPaperEditorView.
 */
export function useEditorQuickEdit(
  formData: CompletePaper,
  setFormData: React.Dispatch<React.SetStateAction<CompletePaper>>,
  onQuickEditSynced?: (updatedPaper: CompletePaper) => void
) {
  const [isQuickEditOpen, setIsQuickEditOpen] = useState(false);
  const [quickEditRecord, setQuickEditRecord] = useState<ManuscriptRecord | null>(null);

  const handleOpenQuickEdit = useCallback(async () => {
    try {
      const repo = new IndexedDbManuscriptRepo(defaultDatabase);
      const rec = await repo.getRecord(formData.id);
      if (rec) {
        setQuickEditRecord(rec);
      } else {
        const fallback: ManuscriptRecord = {
          info: {
            id: formData.id || `doc-${Date.now()}`,
            displayName: (formData as any).displayName || formData.metadata?.title || 'Bản thảo bài báo',
            submissionId: (formData as any).submissionId,
            workflowStatus: normalizeWorkflowStatus((formData as any).workflowStatus || (formData as any).status),
            note: (formData as any).note || '',
            tags: (formData as any).tags || [formData.metadata?.journalId || 'VNUHCM'],
            pinned: false,
            archived: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          doc: migrateV1toV2(formData as any),
        };
        setQuickEditRecord(fallback);
      }
    } catch (err) {
      console.warn('Failed to load record for quick edit:', err);
    }
    setIsQuickEditOpen(true);
  }, [formData]);

  const handleCloseQuickEdit = useCallback(() => {
    setIsQuickEditOpen(false);
  }, []);

  const handleSaveQuickEdit = useCallback(
    async (id: string, patch: Partial<ManuscriptInfo>) => {
      try {
        const normalizedPatchStatus = patch.workflowStatus
          ? normalizeWorkflowStatus(patch.workflowStatus)
          : undefined;
        const normalizedPatch = normalizedPatchStatus
          ? { ...patch, workflowStatus: normalizedPatchStatus }
          : patch;

        let nextVersion: number | undefined;
        if (isUuid(id)) {
          const updated = await manuscriptApi.update(id, {
            title: normalizedPatch.displayName,
            status: normalizedPatchStatus
              ? (normalizedPatchStatus.toUpperCase().replace(/-/g, '_') as any)
              : undefined,
            metadata: {
              ...(formData.metadata || {}),
              displayName: normalizedPatch.displayName,
              submissionId: normalizedPatch.submissionId,
              note: normalizedPatch.note,
              tags: normalizedPatch.tags,
            },
          });
          if (updated?.version !== undefined) {
            nextVersion = updated.version;
          }
        }

        try {
          const repo = new IndexedDbManuscriptRepo(defaultDatabase);
          const existing = await repo.getRecord(id);
          if (existing) {
            await repo.updateInfo(id, normalizedPatch);
          } else {
            const v2Doc = migrateV1toV2(formData as any);
            await repo.save(v2Doc, {
              id,
              ...normalizedPatch,
              displayName: normalizedPatch.displayName || formData.metadata?.title || 'Bản thảo bài báo',
            });
          }
        } catch (localErr) {
          if (!isUuid(id)) throw localErr;
        }

        const patchedFields = {
          displayName: normalizedPatch.displayName ?? formData.displayName,
          submissionId: normalizedPatch.submissionId ?? (formData as any).submissionId,
          status: (normalizedPatchStatus as any) ?? formData.status,
          workflowStatus: normalizedPatchStatus ?? formData.workflowStatus,
          note: normalizedPatch.note ?? (formData as any).note,
          tags: normalizedPatch.tags ?? (formData as any).tags,
          ...(nextVersion !== undefined ? { version: nextVersion, currentServerRev: nextVersion } : {}),
        };

        setFormData((prev) => ({
          ...prev,
          ...patchedFields,
        }));

        onQuickEditSynced?.({
          ...formData,
          ...patchedFields,
        });

        sileo.success({
          title: 'Cập nhật thành công',
          description: 'Thông tin quản lý bài báo đã được cập nhật thành công.',
        });
      } catch (err: any) {
        if (!(err instanceof ProblemDetailsError) && !err?.isAxiosError) {
          sileo.error({
            title: 'Lỗi cập nhật',
            description: err?.message || 'Không thể cập nhật thông tin bài báo.',
            error: err,
          });
        }
        throw err;
      }
    },
    [formData, setFormData, onQuickEditSynced]
  );

  return {
    isQuickEditOpen,
    quickEditRecord,
    handleOpenQuickEdit,
    handleCloseQuickEdit,
    handleSaveQuickEdit,
  };
}
