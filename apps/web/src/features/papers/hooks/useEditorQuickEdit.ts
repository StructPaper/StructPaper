'use client';

import { useState, useCallback } from 'react';
import type { ManuscriptRecord, ManuscriptInfo, WorkflowStatus } from '@structpaper/doc-model';
import { migrateV1toV2 } from '@structpaper/doc-model';
import { defaultDatabase, IndexedDbManuscriptRepo } from '@structpaper/storage';
import { sileo } from '@/components/DynamicIslandToast';
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
            workflowStatus: ((formData as any).status as WorkflowStatus) || 'draft',
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
        const repo = new IndexedDbManuscriptRepo(defaultDatabase);
        const existing = await repo.getRecord(id);
        if (existing) {
          await repo.updateInfo(id, patch);
        } else {
          const v2Doc = migrateV1toV2(formData as any);
          await repo.save(v2Doc, {
            id,
            ...patch,
            displayName: patch.displayName || formData.metadata?.title || 'Bản thảo bài báo',
          });
        }

        const patchedFields = {
          displayName: patch.displayName ?? formData.displayName,
          submissionId: patch.submissionId ?? (formData as any).submissionId,
          status: (patch.workflowStatus as any) ?? formData.status,
          workflowStatus: patch.workflowStatus ?? formData.workflowStatus,
          note: patch.note ?? (formData as any).note,
          tags: patch.tags ?? (formData as any).tags,
        };

        setFormData((prev) => ({
          ...prev,
          displayName: patch.displayName ?? prev.displayName,
          submissionId: patch.submissionId ?? (prev as any).submissionId,
          status: (patch.workflowStatus as any) ?? prev.status,
          workflowStatus: patch.workflowStatus ?? prev.workflowStatus,
          note: patch.note ?? (prev as any).note,
          tags: patch.tags ?? (prev as any).tags,
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
        sileo.error({
          title: 'Lỗi cập nhật',
          description: err?.message || 'Không thể cập nhật thông tin bài báo.',
        });
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
