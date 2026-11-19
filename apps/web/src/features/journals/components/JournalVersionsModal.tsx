'use client';

import React, { useState } from 'react';
import { History, RotateCcw, CheckCircle2, Eye, Layers } from 'lucide-react';
import type { ProfileVersion } from '@structpaper/api-client';
import { ActionConfirmModal, ModalCard } from '@/components/modals';
import { Shimmer } from '@/components/ui/Shimmer';
import { toast } from '@/components/toast';
import { useProfileVersions, useRollbackProfile } from '../hooks/useProfileVersions';
import { ApplyToAllPapersFlow } from './ApplyToAllPapersFlow';

interface JournalVersionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "hs": the key the profile endpoints address the journal by. */
  journalKey: string;
  /** May this user restore a version or move the papers (decided by the API, see useJournalAccess). */
  canEdit: boolean;
  /** The version on screen in the editor, if it is not the one in force. */
  viewingVersion?: number | null;
  /** Shows the rules of a past version in the editor (read only). The version in force clears the view. */
  onView: (version: ProfileVersion | null) => void;
}

const STATE: Record<ProfileVersion['state'], { label: string; chip: string }> = {
  published: { label: 'Đang áp dụng', chip: 'bg-[#D9F99D] text-[#14532D]' },
  archived: { label: 'Đã thay thế', chip: 'bg-white text-zinc-600' },
  validated: { label: 'Đã kiểm tra', chip: 'bg-sky-100 text-sky-800' },
  draft: { label: 'Bản nháp', chip: 'bg-amber-100 text-amber-800' },
};

const formatWhen = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' });
};

const RowShimmer: React.FC = () => (
  <div className="flex items-center gap-3 p-3.5 rounded-3xl bg-gray-200/50">
    <Shimmer className="h-7 w-11 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Shimmer className="h-3 w-1/3 rounded-md" />
      <Shimmer className="h-2.5 w-1/2 rounded-md" />
    </div>
    <Shimmer className="h-6 w-24 rounded-full" />
  </div>
);

const ROW_BTN =
  'shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50';

/**
 * Every published version of a journal's rules, in a dialog. A paper pinned to a version keeps resolving to it,
 * so older versions are never edited. From here the author can look at an older version, publish a copy of it as a
 * new one, or (for the version in force) move all the journal's papers to it.
 */
export const JournalVersionsModal: React.FC<JournalVersionsModalProps> = ({ isOpen, onClose, journalKey, canEdit, viewingVersion, onView }) => {
  const { data: versions, isLoading, isError } = useProfileVersions(journalKey, 'journal');
  const rollback = useRollbackProfile(journalKey, 'journal');
  const [restoreTarget, setRestoreTarget] = useState<ProfileVersion | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const visible = (versions ?? []).filter((v) => v.state === 'published' || v.state === 'archived');
  const current = visible.find((v) => v.state === 'published');

  const confirmRestore = () => {
    if (!restoreTarget) return;
    const version = restoreTarget.version;
    setRestoreTarget(null);
    rollback.mutate(version, {
      onSuccess: (created) => {
        onView(null);
        toast.success('Đã khôi phục', `Đã xuất bản bản sao của phiên bản ${version} thành phiên bản ${created.version}.`);
      },
      onError: (err) => toast.error('Không thể khôi phục', err.message),
    });
  };

  return (
    <>
      <ModalCard
        isOpen={isOpen}
        onClose={onClose}
        icon={<History className="w-5 h-5" />}
        title="Lịch sử phiên bản quy định"
        subtitle="Mỗi lần lưu thay đổi quy định sẽ xuất bản một phiên bản mới. Bài đã ghim vào một phiên bản vẫn giữ nguyên quy định cũ."
        maxWidthClass="max-w-[680px]"
        testId="journal-versions-modal"
      >
        <div className="space-y-2 pb-1" data-testid="journal-versions-list">
          {isLoading && (
            <div className="space-y-2" aria-busy="true">
              <RowShimmer />
              <RowShimmer />
              <RowShimmer />
            </div>
          )}
          {isError && <p className="text-xs font-bold text-rose-600">Không tải được lịch sử phiên bản. Bạn có thể cần đăng nhập lại.</p>}
          {!isLoading && !isError && visible.length === 0 && <p className="text-xs font-bold text-zinc-500">Chưa có phiên bản nào được xuất bản.</p>}

          {visible.map((v) => {
            const isCurrent = v.state === 'published';
            const isViewing = viewingVersion ? viewingVersion === v.version : isCurrent;
            const st = STATE[v.state];
            return (
              <div
                key={v.id}
                data-testid={`version-row-${v.version}`}
                className={`flex flex-wrap items-center gap-3 p-3.5 rounded-3xl transition-all duration-200 ${
                  isViewing ? 'bg-[#D9F99D]/50 ring-2 ring-[#78C841]/40' : 'bg-gray-200/50 hover:bg-gray-200/80'
                }`}
              >
                <span className="shrink-0 px-2.5 py-1 rounded-xl bg-zinc-900 text-white text-[11px] font-extrabold">v{v.version}</span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-xs font-bold text-zinc-900 truncate">{v.changeNote || 'Không có ghi chú'}</p>
                  <p className="text-[11px] text-zinc-500">{formatWhen(v.publishedAt ?? v.createdAt)}</p>
                </div>
                <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] font-bold ${st.chip}`}>
                  {isCurrent && <CheckCircle2 className="w-3 h-3" />}
                  {st.label}
                </span>
                <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => {
                      onView(isCurrent ? null : v);
                      onClose();
                    }}
                    disabled={isViewing}
                    className={`${ROW_BTN} bg-white hover:bg-zinc-900 hover:text-white text-zinc-700`}
                    data-testid={`view-version-${v.version}`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>{isViewing ? 'Đang xem' : 'Xem'}</span>
                  </button>
                  {canEdit && v.state === 'archived' && (
                    <button type="button" onClick={() => setRestoreTarget(v)} disabled={rollback.isPending} className={`${ROW_BTN} bg-white hover:bg-zinc-200 text-zinc-700`}>
                      <RotateCcw className="w-3 h-3" />
                      <span>Khôi phục</span>
                    </button>
                  )}
                  {canEdit && isCurrent && (
                    <button
                      type="button"
                      onClick={() => setApplyOpen(true)}
                      className={`${ROW_BTN} bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600`}
                      data-testid="apply-to-all-papers-btn"
                    >
                      <Layers className="w-3 h-3" />
                      <span>Áp dụng cho mọi bài</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ModalCard>

      <ActionConfirmModal
        isOpen={Boolean(restoreTarget)}
        onClose={() => setRestoreTarget(null)}
        onConfirm={confirmRestore}
        variant="warning"
        zIndex={130}
        title={`Khôi phục phiên bản ${restoreTarget?.version ?? ''}?`}
        description="Quy định của phiên bản này sẽ được xuất bản lại thành một phiên bản mới và áp dụng cho các bài mở mới. Các phiên bản hiện có vẫn được giữ trong lịch sử."
        cancelLabel="Hủy bỏ"
        confirmLabel="Khôi phục"
        confirmIcon={<RotateCcw className="w-4 h-4" />}
        isLoading={rollback.isPending}
        testId="journal-rollback-confirm-modal"
        confirmTestId="confirm-rollback-btn"
      />

      <ApplyToAllPapersFlow isOpen={applyOpen} onClose={() => setApplyOpen(false)} journalKey={journalKey} version={current?.version} />
    </>
  );
};
