'use client';

import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import { ActionConfirmModal } from '@/components/modals/ActionConfirmModal';
import {
  getJournalColor,
  getJournalShortName,
  getManuscriptTitle,
} from './types';

export interface PaperDeleteConfirmModalProps {
  paper: ManuscriptRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (id: string) => Promise<void> | void;
  isDeleting?: boolean;
}

export const PaperDeleteConfirmModal: React.FC<PaperDeleteConfirmModalProps> = ({
  paper,
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  const [cachedPaper, setCachedPaper] = useState<ManuscriptRecord | null>(paper);

  useEffect(() => {
    if (paper) {
      setCachedPaper(paper);
    }
  }, [paper]);

  const activePaper = paper || cachedPaper;
  if (!activePaper) return null;

  const { info, doc } = activePaper;
  const title = getManuscriptTitle(activePaper);
  const journalColor = getJournalColor(doc.journalId);
  const journalShort = getJournalShortName(doc.journalId);

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
          {title}
        </h4>
        <p className="text-[10.5px] text-slate-400 font-mono mt-0.5 truncate">
          ID: {info.submissionId || info.id.slice(0, 12)}
        </p>
      </div>
    </div>
  );

  return (
    <ActionConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={async () => {
        await onConfirm(info.id);
        onClose();
      }}
      variant="danger"
      title="Xóa bài báo này?"
      previewCard={previewCard}
      description="Bài báo và toàn bộ dữ liệu cấu trúc bản thảo liên quan sẽ bị xóa khỏi máy của bạn. Bạn không thể hoàn tác hành động này."
      cancelLabel="Hủy"
      confirmLabel="Xóa bài báo"
      confirmIcon={<Trash2 className="w-4 h-4" />}
      isLoading={isDeleting}
      testId="paper-delete-modal"
      confirmTestId="confirm-delete-btn"
    />
  );
};
