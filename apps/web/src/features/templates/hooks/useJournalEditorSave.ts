'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ManagedJournalProfile } from '@/lib/templates/journal-storage';
import { useManagedJournals } from './useManagedJournals';
import { validateJournalProfileUniqueness } from '@/lib/templates/template-naming';
import { toast } from '@/components/DynamicIslandToast';

export interface UseJournalEditorSaveOptions {
  managed: ManagedJournalProfile;
  setManaged: React.Dispatch<React.SetStateAction<ManagedJournalProfile>>;
  setIsDirty: (dirty: boolean) => void;
  isNew?: boolean;
  onAfterReset?: (resetManaged: ManagedJournalProfile) => void;
}

/**
 * Custom hook quản lý quy trình lưu & khôi phục hồ sơ tạp chí:
 * - Kiểm tra các trường bắt buộc (Tên tiếng Việt, tiếng Anh, mã viết tắt).
 * - Kiểm tra tính duy nhất (cấm trùng tên/mã với tạp chí khác).
 * - Điều khiển ActionConfirmModal cảnh báo xác nhận trước khi lưu hoặc khôi phục.
 * - Tương tác với IndexedDB / LocalStorage qua useManagedJournals.
 */
export function useJournalEditorSave({
  managed,
  setManaged,
  setIsDirty,
  isNew = false,
  onAfterReset,
}: UseJournalEditorSaveOptions) {
  const router = useRouter();
  const { saveProfile, resetProfile } = useManagedJournals();

  const [isSaveWarningOpen, setIsSaveWarningOpen] = useState(false);
  const [isResetWarningOpen, setIsResetWarningOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 1. Kiểm tra tính hợp lệ và tính duy nhất trước khi mở modal cảnh báo
  const requestSave = useCallback(() => {
    const vi = managed.profile.names?.vi?.trim();
    const en = managed.profile.names?.en?.trim();
    const short = managed.profile.names?.short?.trim();

    if (!vi || !en || !short) {
      toast.error(
        'Thiếu thông tin bắt buộc',
        'Vui lòng nhập đầy đủ Tên tiếng Việt, Tên tiếng Anh và Mã viết tắt của tạp chí.'
      );
      return false;
    }

    const uniqueness = validateJournalProfileUniqueness(managed.id, managed.profile);
    if (uniqueness.isDuplicate) {
      toast.error('Trùng lặp tên tạp chí', uniqueness.message);
      return false;
    }

    setIsSaveWarningOpen(true);
    return true;
  }, [managed]);

  // 2. Thực thi lưu sau khi xác nhận trong ActionConfirmModal
  const confirmSave = useCallback(() => {
    setIsSaving(true);
    setIsSaveWarningOpen(false);
    try {
      saveProfile(managed);
      setIsDirty(false);
      setSaveSuccess(true);
      toast.success(
        'Đã lưu thành công',
        `Đã lưu cấu hình hồ sơ tạp chí "${managed.profile.names?.short || managed.id}"`
      );
      setTimeout(() => setSaveSuccess(false), 2500);
      if (isNew) {
        router.push(`/templates/journal/${managed.id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi lưu dữ liệu';
      toast.error('Lưu thất bại', msg);
    } finally {
      setIsSaving(false);
    }
  }, [managed, isNew, router, saveProfile, setIsDirty]);

  const cancelSave = useCallback(() => {
    setIsSaveWarningOpen(false);
  }, []);

  // 3. Khôi phục về thông số gốc
  const requestReset = useCallback(() => {
    setIsResetWarningOpen(true);
  }, []);

  const confirmReset = useCallback(() => {
    setIsResetWarningOpen(false);
    try {
      const reset = resetProfile(managed.id);
      setManaged(reset);
      setIsDirty(false);
      onAfterReset?.(reset);
      toast.info('Đã khôi phục', 'Đã đặt lại thông số theo chuẩn gốc của hệ thống.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể khôi phục';
      toast.error('Lỗi', msg);
    }
  }, [managed.id, resetProfile, setManaged, setIsDirty, onAfterReset]);

  const cancelReset = useCallback(() => {
    setIsResetWarningOpen(false);
  }, []);

  return {
    isSaveWarningOpen,
    isResetWarningOpen,
    isSaving,
    saveSuccess,
    requestSave,
    confirmSave,
    cancelSave,
    requestReset,
    confirmReset,
    cancelReset,
  };
}
