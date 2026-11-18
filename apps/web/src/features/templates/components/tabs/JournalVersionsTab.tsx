'use client';

import React, { useState } from 'react';
import { History, RotateCcw, CheckCircle2 } from 'lucide-react';
import type { ProfileVersion } from '@structpaper/api-client';
import { useProfileVersions, useRollbackProfile } from '@/features/journals';
import { Gate } from '@/lib/access/Gate';
import { Shimmer } from '@/components/ui/Shimmer';
import { ActionConfirmModal } from '@/components/modals';
import { toast } from '@/components/toast';

interface JournalVersionsTabProps {
  /** "hs": the key the profile endpoints address the journal by; "base" for the shared rules. */
  journalKey: string;
  scope?: 'base' | 'journal';
}

const STATE_LABEL: Record<ProfileVersion['state'], { label: string; chip: string }> = {
  published: { label: 'Đang xuất bản', chip: 'bg-[#D9F99D]/60 text-[#14532D] border-[#B4E50D]/40' },
  archived: { label: 'Đã thay thế', chip: 'bg-slate-100 text-slate-600 border-slate-200' },
  validated: { label: 'Đã kiểm tra', chip: 'bg-sky-50 text-sky-800 border-sky-200' },
  draft: { label: 'Bản nháp', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
};

const formatWhen = (iso?: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
};

const VersionRowShimmer: React.FC = () => (
  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-zinc-200/80">
    <Shimmer className="h-6 w-10 rounded-lg" />
    <div className="flex-1 space-y-2">
      <Shimmer className="h-3 w-1/3 rounded-md" />
      <Shimmer className="h-2.5 w-1/2 rounded-md" />
    </div>
    <Shimmer className="h-6 w-24 rounded-full" />
  </div>
);

/**
 * Every published version of a journal's rules. A paper pinned to a version keeps resolving to it, so
 * older versions are never edited; "rollback" publishes a copy of one as a new version.
 */
export const JournalVersionsTab: React.FC<JournalVersionsTabProps> = ({ journalKey, scope = 'journal' }) => {
  const { data: versions, isLoading, isError } = useProfileVersions(journalKey, scope);
  const rollback = useRollbackProfile(journalKey, scope);
  const [target, setTarget] = useState<ProfileVersion | null>(null);

  const visible = (versions ?? []).filter((v) => v.state === 'published' || v.state === 'archived');
  const confirmRollback = () => {
    if (!target) return;
    const version = target.version;
    setTarget(null);
    rollback.mutate(version, {
      onSuccess: (created) => toast.success('Đã khôi phục', `Đã xuất bản bản sao của phiên bản ${version} thành phiên bản ${created.version}.`),
      onError: (err) => toast.error('Không thể khôi phục', err.message),
    });
  };

  return (
    <div className="space-y-4 w-full p-5" data-testid="journal-versions-tab">
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <History className="w-4 h-4 text-zinc-700" />
        <h3 className="font-extrabold text-sm text-zinc-900">Lịch sử phiên bản quy định</h3>
      </div>
      <p className="text-xs text-zinc-500">
        Mỗi lần lưu thay đổi quy định dàn trang sẽ xuất bản một phiên bản mới. Bài đã ghim vào một phiên bản vẫn giữ
        nguyên quy định cũ; phiên bản đã xuất bản không bao giờ bị sửa.
      </p>

      {isLoading && (
        <div className="space-y-2" aria-busy="true">
          <VersionRowShimmer />
          <VersionRowShimmer />
          <VersionRowShimmer />
        </div>
      )}

      {isError && (
        <p className="text-xs font-bold text-rose-600">Không tải được lịch sử phiên bản. Bạn có thể cần đăng nhập lại.</p>
      )}

      {!isLoading && !isError && visible.length === 0 && (
        <p className="text-xs font-bold text-zinc-500">Chưa có phiên bản nào được xuất bản.</p>
      )}

      <ul className="space-y-2">
        {visible.map((v) => {
          const state = STATE_LABEL[v.state];
          return (
            <li key={v.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-zinc-200/80" data-testid={`version-row-${v.version}`}>
              <span className="shrink-0 px-2.5 py-1 rounded-lg bg-zinc-900 text-white text-[11px] font-extrabold">v{v.version}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-zinc-900 truncate">{v.changeNote || 'Không có ghi chú'}</p>
                <p className="text-[11px] text-zinc-500">{formatWhen(v.publishedAt ?? v.createdAt)}</p>
              </div>
              <span className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10.5px] font-bold ${state.chip}`}>
                {v.state === 'published' && <CheckCircle2 className="w-3 h-3" />}
                {state.label}
              </span>
              {v.state === 'archived' && (
                <Gate capability="journal:manage">
                  <button
                    type="button"
                    onClick={() => setTarget(v)}
                    disabled={rollback.isPending}
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-[11px] font-bold text-zinc-700 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Khôi phục bản này</span>
                  </button>
                </Gate>
              )}
            </li>
          );
        })}
      </ul>

      <ActionConfirmModal
        isOpen={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={confirmRollback}
        variant="warning"
        title={`Khôi phục phiên bản ${target?.version ?? ''}?`}
        description="Quy định của phiên bản này sẽ được xuất bản lại thành một phiên bản mới và áp dụng cho các bài mở mới. Các phiên bản hiện có vẫn được giữ trong lịch sử."
        cancelLabel="Hủy bỏ"
        confirmLabel="Khôi phục"
        confirmIcon={<RotateCcw className="w-4 h-4" />}
        isLoading={rollback.isPending}
        testId="journal-rollback-confirm-modal"
        confirmTestId="confirm-rollback-btn"
      />
    </div>
  );
};
