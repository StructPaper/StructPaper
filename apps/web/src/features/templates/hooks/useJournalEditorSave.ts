'use client';

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BASE_PROFILE } from '@structpaper/journal-profiles';
import { ManagedJournalProfile } from '@/lib/templates/journal-storage';
import { validateJournalProfileUniqueness } from '@/lib/templates/template-naming';
import {
  useJournalPublisher,
  useJournalTemplates,
  usePublishedProfiles,
  ProfileValidationError,
} from '@/features/journals';
import { toast } from '@/components/toast';

export interface UseJournalEditorSaveOptions {
  /** What the editor loaded from the server: the baseline the edits are compared with. */
  initialManaged: ManagedJournalProfile;
  /** The journal's server version (its ETag), so a stale editor is refused instead of overwriting. */
  serverVersion?: number;
  managed: ManagedJournalProfile;
  setManaged: React.Dispatch<React.SetStateAction<ManagedJournalProfile>>;
  setIsDirty: (dirty: boolean) => void;
  isNew?: boolean;
  onAfterReset?: (resetManaged: ManagedJournalProfile) => void;
}

const KEY_PATTERN = /^[a-z][a-z0-9-]{1,30}$/;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9-]{1,30}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ISSN_PATTERN = /^\d{4}-\d{3}[\dXx]$/;

/**
 * The save flow of the journal editor:
 * - checks the required fields and that no other journal uses the same name or code,
 * - asks for confirmation (ActionConfirmModal),
 * - saves who the journal is (name, code, colour, status) and publishes its rules as a new profile
 *   version through the API (see useJournalPublisher),
 * - "reset" drops the unsaved edits and goes back to the published rules.
 */
export function useJournalEditorSave({
  initialManaged,
  serverVersion,
  managed,
  setManaged,
  setIsDirty,
  isNew = false,
  onAfterReset,
}: UseJournalEditorSaveOptions) {
  const router = useRouter();
  const publisher = useJournalPublisher();
  const { templates } = useJournalTemplates();
  const { data: published } = usePublishedProfiles();

  // the baseline moves forward after every successful save, so the next diff starts from what was just published
  const baseline = useRef({ managed: initialManaged, version: serverVersion });

  const [isSaveWarningOpen, setIsSaveWarningOpen] = useState(false);
  const [isResetWarningOpen, setIsResetWarningOpen] = useState(false);
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

    if (!CODE_PATTERN.test(short)) {
      toast.error('Mã viết tắt không hợp lệ', 'Mã gồm 2-31 chữ, số hoặc dấu gạch ngang (ví dụ: VNUHCM-HS).');
      return false;
    }

    if (!COLOR_PATTERN.test(managed.profile.color || '')) {
      toast.error('Màu thương hiệu không hợp lệ', 'Màu phải có dạng #RRGGBB (ví dụ: #2B74B7).');
      return false;
    }

    const issn = managed.profile.publication?.issn?.trim();
    if (issn && !ISSN_PATTERN.test(issn)) {
      toast.error('ISSN không hợp lệ', 'ISSN có dạng 1859-0128 (4 số, gạch ngang, 3 số và 1 số hoặc chữ X).');
      return false;
    }

    if (isNew && !KEY_PATTERN.test(managed.profile.id)) {
      toast.error(
        'Mã định danh không hợp lệ',
        'Mã định danh gồm 2-31 ký tự thường, số hoặc dấu gạch ngang, bắt đầu bằng chữ cái (ví dụ: agr).'
      );
      return false;
    }

    const uniqueness = validateJournalProfileUniqueness(managed.id, managed.profile, templates);
    if (uniqueness.isDuplicate) {
      toast.error('Trùng lặp tên tạp chí', uniqueness.message);
      return false;
    }

    setIsSaveWarningOpen(true);
    return true;
  }, [managed, isNew, templates]);

  // 2. Thực thi lưu sau khi xác nhận trong ActionConfirmModal
  const confirmSave = useCallback(() => {
    setIsSaveWarningOpen(false);
    const key = isNew ? managed.profile.id : managed.id;
    publisher.mutate(
      {
        isNew,
        key,
        original: isNew ? undefined : baseline.current.managed,
        edited: managed,
        base: (published?.base.version ? published.base.config : (BASE_PROFILE as unknown as Record<string, unknown>)),
        serverVersion: baseline.current.version,
      },
      {
        onSuccess: (result) => {
          baseline.current = { managed, version: result.journal?.version ?? baseline.current.version };
          setIsDirty(false);
          setSaveSuccess(true);
          toast.success(
            'Đã lưu thành công',
            result.published
              ? `Đã xuất bản phiên bản ${result.published.version} của "${managed.profile.names?.short || key}"`
              : `Đã lưu hồ sơ tạp chí "${managed.profile.names?.short || key}"`
          );
          setTimeout(() => setSaveSuccess(false), 2500);
          if (isNew) router.push(`/templates/journal/${key}`);
        },
        onError: (err) => {
          if (err instanceof ProfileValidationError) {
            toast.error('Quy định chưa hợp lệ, chưa xuất bản', err.message);
            return;
          }
          toast.error('Lưu thất bại', err.message || 'Lỗi khi lưu dữ liệu');
        },
      }
    );
  }, [managed, isNew, published, publisher, router, setIsDirty]);

  const cancelSave = useCallback(() => {
    setIsSaveWarningOpen(false);
  }, []);

  // 3. Bỏ chỉnh sửa chưa lưu, quay về quy định đang xuất bản
  const requestReset = useCallback(() => {
    setIsResetWarningOpen(true);
  }, []);

  const confirmReset = useCallback(() => {
    setIsResetWarningOpen(false);
    const reset = baseline.current.managed;
    setManaged(reset);
    setIsDirty(false);
    onAfterReset?.(reset);
    toast.info('Đã khôi phục', 'Đã bỏ các chỉnh sửa chưa lưu và quay về quy định đang xuất bản.');
  }, [setManaged, setIsDirty, onAfterReset]);

  const cancelReset = useCallback(() => {
    setIsResetWarningOpen(false);
  }, []);

  /** What the editor loaded, or what was last saved: the "before" of the changes shown when saving. */
  const getBaseline = useCallback(() => baseline.current.managed, []);

  return {
    getBaseline,
    isSaveWarningOpen,
    isResetWarningOpen,
    isSaving: publisher.isPending,
    saveSuccess,
    requestSave,
    confirmSave,
    cancelSave,
    requestReset,
    confirmReset,
    cancelReset,
  };
}
