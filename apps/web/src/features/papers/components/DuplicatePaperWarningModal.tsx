'use client';

import React from 'react';
import { UploadCloud } from 'lucide-react';
import { ActionConfirmModal } from '@/components/modals';
import { getJournalColor, getJournalShortName } from './types';

export interface DuplicatePaperWarningModalProps {
  isOpen: boolean;
  paperTitle: string;
  matchCount: number;
  suggestedTitle: string;
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
  journalId,
  zIndex = 110,
  onClose,
  onConfirmUpload,
}) => {
  const journalColor = getJournalColor(journalId);
  const journalShort = getJournalShortName(journalId);

  const previewCard = (
    <div className="w-full bg-slate-50 border border-slate-200/70 rounded-3xl p-3.5 flex items-center gap-3 shadow-inner">
      <span
        className="shrink-0 px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold text-white shadow-2xs"
        style={{ backgroundColor: journalColor }}
      >
        {journalShort}
      </span>
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
