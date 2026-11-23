'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArchiveRestore, Trash2, Loader2 } from 'lucide-react';
import { ActionConfirmModal } from '@/components/modals';
import { toast } from '@/components/toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ReadOnlyPaperView } from '@/features/editor/components/ReadOnlyPaperView';
import { useEditorSession } from '@/context/EditorSessionContext';
import { manuscriptToCompletePaper } from '@/lib/storage/converters';
import { useGoBack } from '@/lib/app-history';
import { useAuthStore } from '@/lib/auth-store';
import { useTrashedManuscript, useTrashActions } from '../hooks/useTrash';

const INNER = { boxShadow: 'inset 0 0 14px rgba(0, 0, 0, 0.09)' };
const BTN = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-2xl border-2 border-white text-xs font-extrabold transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

type Action = 'restore' | 'purge';

/**
 * A paper in the trash, opened in the paper page itself (the same read-only page other readers get: every tab, the PDF, the
 * exports). The title bar says it is deleted and offers to restore it or delete it for good (see TrashTitleBarInfo). Nothing can
 * be edited while it is in the trash. The back button goes back one page, to wherever the user came from.
 */
export const TrashPreviewView: React.FC<{ id: string }> = ({ id }) => {
  const router = useRouter();
  const goBack = useGoBack();
  const isSignedIn = useAuthStore((s) => Boolean(s.user || s.isAuthenticated));
  const query = useTrashedManuscript(id);
  const { restore, purge } = useTrashActions();
  const { setTrashBar } = useEditorSession();
  const [confirm, setConfirm] = useState<Action | null>(null);
  const [working, setWorking] = useState(false);
  const [acting, setActing] = useState<Action | null>(null);

  const item = query.data;
  const paper = useMemo(
    () => (item ? manuscriptToCompletePaper({ id: item.id, title: item.title, status: item.status, metadata: item.metadata, journal: item.journal, journalId: item.journal?.id, version: 1 } as any) : null),
    [item],
  );

  const execute = async (action: Action) => {
    if (!item || working) return;
    setActing(action);
    setWorking(true);
    try {
      if (action === 'restore') {
        await restore.mutateAsync(item.id);
        toast.success('Đã khôi phục bài báo', `"${item.title}" đã trở lại danh sách bài báo của chủ bài.`);
        router.replace(`/papers/${item.id}`);
      } else {
        await purge.mutateAsync(item.id);
        toast.success('Đã xóa vĩnh viễn', `"${item.title}" và toàn bộ lịch sử của nó đã bị xóa.`);
        router.replace('/trash');
      }
    } catch (err) {
      toast.error(action === 'restore' ? 'Không khôi phục được' : 'Không xóa được', (err as Error).message);
    } finally {
      setWorking(false);
      setActing(null);
      setConfirm(null);
    }
  };

  // what the page says about the paper and its two actions live in the title bar
  const canRestore = item?.access.canRestore;
  const canPurge = item?.access.canPurge;
  useEffect(() => {
    if (!item) return;
    setTrashBar({
      deletedAt: item.deletedAt,
      deletedBy: item.deletedBy?.displayName,
      daysLeft: item.daysLeft,
      busy: working,
      restoring: acting === 'restore',
      onRestore: canRestore ? () => void execute('restore') : undefined,
      onPurge: canPurge ? () => setConfirm('purge') : undefined,
    });
    return () => setTrashBar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item, canRestore, canPurge, working, acting, setTrashBar]);

  if (query.isLoading) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4 bg-[#F8F9FA] text-[#1A1A1A]" aria-busy="true" data-testid="trash-preview-loading">
        <Loader2 className="w-12 h-12 animate-spin text-[#78C841]" strokeWidth={3} />
        <p className="text-sm font-medium text-zinc-600">Đang tải nội dung bài báo.....</p>
      </div>
    );
  }

  if (query.isError || !item || !paper) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-6 p-4" data-testid="trash-preview-error">
        <EmptyState icon={Trash2} testId="trash-preview-missing" title="Không xem được bài báo này" description="Bài báo không còn trong thùng rác (đã được khôi phục hoặc xóa vĩnh viễn), hoặc bạn không có quyền xem nó." />
        <button type="button" onClick={() => goBack('/trash')} data-testid="trash-preview-back" className={`${BTN} bg-slate-50/60 hover:bg-white text-zinc-700`} style={INNER}>
          Quay lại thùng rác
        </button>
      </div>
    );
  }

  return (
    <>
      <ReadOnlyPaperView paper={paper} canCompile={isSignedIn} backFallback="/trash" />

      <ActionConfirmModal
        isOpen={confirm === 'purge'}
        onClose={() => !working && setConfirm(null)}
        onConfirm={() => void execute('purge')}
        variant="danger"
        title="Xóa vĩnh viễn bài báo này?"
        description={<>Bài <b>{item.title}</b> cùng toàn bộ lịch sử phiên bản, thành viên và chia sẻ sẽ bị xóa <b>vĩnh viễn</b>. Không thể hoàn tác.</>}
        cancelLabel="Hủy bỏ"
        confirmLabel="Xóa vĩnh viễn"
        confirmIcon={<Trash2 className="w-4 h-4" />}
        isLoading={working}
        testId="purge-trash-modal"
        confirmTestId="confirm-purge-trash-btn"
      />
    </>
  );
};
