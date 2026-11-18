'use client';

import { JournalCodeBadge } from '@/features/journals';
import React from 'react';
import { UploadCloud } from 'lucide-react';
import { ActionConfirmModal } from '@/components/modals';
import { formatUploadDate, type TitleDuplicate } from '@/lib/storage/title-duplicates';

export interface DuplicatePaperWarningModalProps {
  isOpen: boolean;
  paperTitle: string;
  matchCount: number;
  suggestedTitle: string;
  /** Everybody who uploaded a paper with this title before. */
  uploaders?: TitleDuplicate[];
  journalId?: string;
  zIndex?: number;
  onClose: () => void;
  onConfirmUpload: () => void;
}

export const DuplicatePaperWarningModal: React.FC<DuplicatePaperWarningModalProps> = ({
  isOpen,
  paperTitle,
  matchCount,
  suggestedTitle,
  uploaders = [],
  journalId,
  zIndex = 110,
  onClose,
  onConfirmUpload,
}) => {

  const previewCard = (
    <div className="w-full bg-slate-50 border border-slate-200/70 rounded-3xl p-3.5 flex items-center gap-3 shadow-inner">
      <JournalCodeBadge variant="tile" journalId={journalId} />
      <div className="min-w-0 flex-1">
        <h4 className="text-xs font-bold text-slate-900 truncate">
          {paperTitle}
        </h4>
        <p className="text-[10.5px] text-amber-700 font-semibold mt-0.5 truncate">
          Đổi thành: <span className="font-bold underline">{suggestedTitle}</span>
        </p>
      </div>
    </div>
  );

  const description = (
    <>
      {matchCount > 1
        ? `Đã tìm thấy ${matchCount} bài báo có tiêu đề này trong cơ sở dữ liệu của bạn.`
        : `Bài báo với tiêu đề này đã có trong cơ sở dữ liệu của bạn.`}{' '}
      Hệ thống quy định tiêu đề bài báo không được trùng lặp. Nếu vẫn tải lên, bản thảo mới sẽ được tự động đổi tên thành{' '}
      <strong className="text-slate-900 font-bold">"{suggestedTitle}"</strong>.
      {uploaders.length > 0 && (
        <span className="block mt-3 text-left">
          <span className="block text-[11px] font-extrabold uppercase tracking-wider text-slate-500 mb-1.5">
            Đã được tải lên bởi
          </span>
          <span data-testid="duplicate-uploaders" className="flex flex-wrap gap-1.5">
            {uploaders.map((u, i) => (
              <span
                key={`${u.uploaderName}-${u.uploadedAt}-${i}`}
                data-testid="duplicate-uploader"
                className="inline-flex items-center gap-1.5 rounded-full bg-gray-200/60 px-3 py-1 text-xs font-bold text-slate-800"
              >
                {u.mine ? 'Bạn' : u.uploaderName}
                {formatUploadDate(u.uploadedAt) && <span className="font-medium text-slate-500">{formatUploadDate(u.uploadedAt)}</span>}
              </span>
            ))}
          </span>
        </span>
      )}
    </>
  );

  return (
    <ActionConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirmUpload}
      variant="warning"
      title="Bài báo đã tồn tại?"
      description={description}
      previewCard={previewCard}
      cancelLabel="Hủy bỏ"
      confirmLabel="Vẫn tải lên"
      confirmIcon={<UploadCloud className="w-4 h-4" />}
      zIndex={zIndex}
      testId="duplicate-paper-warning-modal"
      confirmTestId="confirm-upload-anyway-btn"
    />
  );
};
