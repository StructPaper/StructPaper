'use client';

import { useState, useCallback } from 'react';
import { UniversalTemplateSchema } from '@/types/template-builder';
import { templateRegistry } from '@/lib/template-engine/storage/template-registry';
import { validateCustomTemplateUniqueness } from '@/lib/templates/template-naming';
import { toast } from '@/components/DynamicIslandToast';

export interface UseCustomTemplateSaveOptions {
  schema: UniversalTemplateSchema;
  setIsDirty: (dirty: boolean) => void;
}

/**
 * Custom hook quản lý quy trình lưu Universal Custom Template:
 * - Kiểm tra tính duy nhất tên template trước khi lưu.
 * - Mở ActionConfirmModal xác nhận cảnh báo.
 * - Ghi nhận vào registry lưu trữ cục bộ & đồng bộ API.
 */
export function useCustomTemplateSave({
  schema,
  setIsDirty,
}: UseCustomTemplateSaveOptions) {
  const [isSaveConfirmOpen, setIsSaveConfirmOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 1. Kiểm tra tính duy nhất tên template trước khi mở warning modal
  const requestSave = useCallback(() => {
    const uniqueness = validateCustomTemplateUniqueness(
      schema.id,
      schema.name,
      templateRegistry.getLocalCustomTemplates()
    );
    if (uniqueness.isDuplicate) {
      toast.error('Trùng lặp tên template', uniqueness.message);
      return false;
    }
    setIsSaveConfirmOpen(true);
    return true;
  }, [schema.id, schema.name]);

  // 2. Thực thi lưu sau khi xác nhận trong ActionConfirmModal
  const confirmSave = useCallback(async () => {
    setIsSaveConfirmOpen(false);
    setIsSaving(true);
    try {
      const updatedSchema: UniversalTemplateSchema = {
        ...schema,
        updatedAt: new Date().toISOString().split('T')[0],
      };

      // 1. Lưu vào registry lưu trữ cục bộ
      templateRegistry.saveCustomTemplate(updatedSchema);

      // 2. Đồng bộ lên server storage API (nếu có)
      try {
        await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedSchema),
        });
      } catch {
        // Bỏ qua lỗi kết nối máy chủ khi chạy offline hoặc test
      }

      setSaveSuccess(true);
      setIsDirty(false);
      setTimeout(() => setSaveSuccess(false), 2500);
      toast.success('Lưu thành công', `Đã lưu "${schema.name}" vào Thư viện mẫu!`);
    } catch {
      toast.error('Lỗi khi lưu template');
    } finally {
      setIsSaving(false);
    }
  }, [schema, setIsDirty]);

  const cancelSave = useCallback(() => {
    setIsSaveConfirmOpen(false);
  }, []);

  return {
    isSaveConfirmOpen,
    isSaving,
    saveSuccess,
    requestSave,
    confirmSave,
    cancelSave,
  };
}
