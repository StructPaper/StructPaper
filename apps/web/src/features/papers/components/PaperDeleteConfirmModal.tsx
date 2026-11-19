'use client';

import { JournalCodeBadge } from '@/features/journals';
import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import { ActionConfirmModal } from '@/components/modals/ActionConfirmModal';
import {
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
  // the button spins from the click until the paper is really in the trash; only then the modal closes (and the caller's toast shows)
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (paper) {
      setCachedPaper(paper);
    }
  }, [paper]);

  const activePaper = paper || cachedPaper;
  if (!activePaper) return null;

  const { info, doc } = activePaper;
  const title = getManuscriptTitle(activePaper);

  const previewCard = (
    <div className="w-full bg-slate-50 border border-slate-200/70 rounded-3xl p-3.5 flex items-center gap-3 shadow-inner">
      <JournalCodeBadge variant="tile" journalId={doc.journalId} record={activePaper} />
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
      onClose={() => {
        if (!busy) onClose();
      }}
      onConfirm={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await onConfirm(info.id);
        } finally {
          setBusy(false);
        }
        onClose();
      }}
      variant="danger"
      title="Xóa bài báo này?"
      previewCard={previewCard}
      description="Bài báo sẽ được chuyển vào Thùng rác. Bạn (hoặc quản lý tạp chí) có thể khôi phục nó trong thời gian lưu giữ (mặc định 30 ngày); sau đó nó bị xóa vĩnh viễn cùng toàn bộ lịch sử phiên bản. Bản thảo chỉ nằm trên máy của bạn thì bị xóa luôn."
      cancelLabel="Hủy"
      confirmLabel="Xóa bài báo"
      confirmIcon={<Trash2 className="w-4 h-4" />}
      isLoading={isDeleting || busy}
      testId="paper-delete-modal"
      confirmTestId="confirm-delete-btn"
    />
  );
};
