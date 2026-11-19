'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { http } from '@structpaper/api-client';
import { docFromStored, storedFromDoc } from '@structpaper/doc-diff';
import { RotateCcw, Copy, Trash2, Pencil, GitCompareArrows, Loader2, Clock, User } from 'lucide-react';
import { ActionConfirmModal } from '@/components/modals';
import { toast } from '@/components/toast';
import { Shimmer } from '@/components/ui/Shimmer';
import { useEditorSession } from '@/context/EditorSessionContext';
import { useCurrentDoc, useRevision, useRevisionActions, useRevisions, type RevisionFilter } from '../hooks/useRevisions';
import { kindLabel, revisionTitle } from '../lib/group-revisions';
import { CURRENT, RevisionList } from './RevisionList';
import { DocumentDiffView } from './DocumentDiffView';
import { DetailedDiffView } from './DetailedDiffView';
import { VersionNameModal } from './VersionNameModal';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

const BTN = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none';
const BTN_SOFT = `${BTN} bg-gray-200/70 hover:bg-zinc-900 hover:text-white text-zinc-700`;

const formatWhen = (iso?: string) => (iso ? new Date(iso).toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }) : '');

type Json = Record<string, any>;

/**
 * The history page of a paper, in the manner of Google Docs: it takes the place of the editor. The versions are on the
 * right; the one chosen is shown on the left with what it changed marked. From here a version can be named, renamed,
 * deleted, restored (which adds a version and rewrites nothing), copied into a new paper, or have a block taken from it.
 */
export const PaperHistoryView: React.FC<{ paperId: string }> = ({ paperId }) => {
  const router = useRouter();
  // the router object is only used inside handlers: keep it out of effect dependencies
  const routerRef = React.useRef(router);
  routerRef.current = router;
  const { setPaperHistoryBar } = useEditorSession();
  const [filter, setFilter] = useState<RevisionFilter>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [showChanges, setShowChanges] = useState(true);
  // the detailed way of reading a version (tabs like the editor's, with settings), switched in the title bar
  const [detailed, setDetailed] = useState(false);
  const toggleDetailed = useCallback(() => setDetailed((v) => !v), []);
  const [saveOpen, setSaveOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const list = useRevisions(paperId, 'all');
  const current = useCurrentDoc(paperId);
  const actions = useRevisionActions(paperId);

  const revisions = useMemo(() => list.data?.pages.flatMap((p) => p.items) ?? [], [list.data]);
  // open on the newest version (what the author last kept) once the list is there
  useEffect(() => {
    if (selected === null && !list.isLoading) setSelected(revisions[0]?.id ?? CURRENT);
  }, [selected, list.isLoading, revisions]);

  const Diff = detailed ? DetailedDiffView : DocumentDiffView;
  const selectedId = selected ?? CURRENT;
  const isCurrent = selectedId === CURRENT;
  const index = revisions.findIndex((r) => r.id === selectedId);
  const summary = index >= 0 ? revisions[index] : null;
  // a version is compared with the one before it; the current paper with the newest version
  const previous = isCurrent ? revisions[0] : revisions[index + 1];

  const version = useRevision(paperId, isCurrent ? null : selectedId);
  const before = useRevision(paperId, previous?.id ?? null);
  const shownDoc: Json | null = isCurrent ? (current.data?.doc ?? null) : ((version.data?.doc as Json | undefined) ?? null);
  const compareDoc: Json | null = previous ? ((before.data?.doc as Json | undefined) ?? null) : null;
  const loadingDoc = isCurrent ? current.isLoading : version.isLoading;
  const title = (current.data?.manuscript.title as string | undefined) || 'Bản thảo';

  const canManage = current.data?.manuscript.access?.canEdit !== false;
  const openSave = useCallback(() => setSaveOpen(true), []);
  useEffect(() => {
    setPaperHistoryBar({ title, onBack: () => routerRef.current.push(`/papers/${paperId}`), onSaveVersion: canManage ? openSave : undefined, detailed, onToggleDetailed: toggleDetailed });
    return () => setPaperHistoryBar(null);
  }, [title, paperId, canManage, openSave, detailed, toggleDetailed, setPaperHistoryBar]);

  const saveVersion = (v: { name: string; description: string }) =>
    actions.save.mutate(v, {
      onSuccess: (created) => {
        setSaveOpen(false);
        setSelected(created.id);
        toast.success('Đã lưu phiên bản', `"${v.name}" được giữ lại và không bị xóa tự động.`);
      },
      onError: (err) => toast.error('Không lưu được phiên bản', err.message),
    });

  const renameVersion = (v: { name: string; description: string }) =>
    summary &&
    actions.rename.mutate(
      { id: summary.id, name: v.name, description: v.description || null },
      {
        onSuccess: () => {
          setRenameOpen(false);
          toast.success('Đã đổi tên phiên bản');
        },
        onError: (err) => toast.error('Không đổi được tên', err.message),
      },
    );

  const deleteVersion = () =>
    summary &&
    actions.remove.mutate(summary.id, {
      onSuccess: () => {
        setDeleteOpen(false);
        setSelected(null);
        toast.success('Đã xóa phiên bản', `"${revisionTitle(summary)}" đã bị xóa.`);
      },
      onError: (err) => toast.error('Không xóa được', err.message),
    });

  const restoreVersion = () =>
    summary &&
    actions.restore.mutate(summary.id, {
      onSuccess: () => {
        setRestoreOpen(false);
        toast.success('Đã khôi phục', 'Bài báo đã trở về phiên bản này. Trạng thái trước đó được giữ trong lịch sử.');
        router.push(`/papers/${paperId}`);
      },
      onError: (err) => {
        setRestoreOpen(false);
        toast.error('Không khôi phục được', err.message);
      },
    });

  const duplicateVersion = () =>
    summary &&
    actions.duplicate.mutate(summary.id, {
      onSuccess: (copy) =>
        toast.success('Đã tạo bản sao', `Bài mới được tạo từ "${revisionTitle(summary)}".`, {
          duration: 10_000,
          action: { label: 'Mở bản sao', onClick: () => router.push(`/papers/${copy.id}`) },
        }),
      onError: (err) => toast.error('Không tạo được bản sao', err.message),
    });

  /** Takes one block of this older version into the paper as it is now (it gets a new id, so it never clashes). */
  const insertBlock = useCallback(
    async (section: Json) => {
      try {
        const now = await http.get(`/api/v1/manuscripts/${paperId}`).then((r: any) => r.data ?? r);
        const meta = (now.metadata ?? {}) as Json;
        const doc = docFromStored(meta) as Json;
        const copy = { ...section, id: `sec_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}` };
        const next = { ...doc, sections: [...(doc.sections ?? []), copy] };
        // written in the shape the paper is stored in, or the app would keep reading the old content
        await http.patch(`/api/v1/manuscripts/${paperId}`, { metadata: storedFromDoc(next, meta) }, { headers: { 'If-Match': `"${now.version}"` } });
        await current.refetch();
        toast.success('Đã chèn vào bài hiện tại', 'Khối được thêm vào cuối bài; hãy kéo nó đến vị trí cần.');
      } catch (err) {
        toast.error('Không chèn được khối', (err as Error).message);
      }
    },
    [paperId, current],
  );

  const isNamed = summary?.kind === 'named';

  return (
    <div className="h-full w-full flex flex-col gap-3 p-2 sm:p-3 overflow-hidden bg-[#F8F9FA]" data-testid="paper-history-view">
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3">
        {/* the version on screen */}
        <motion.section
          key={selectedId}
          initial={isTest ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: isTest ? 0 : 0.22, ease: 'easeOut' }}
          className="min-h-0 flex flex-col rounded-[32px] bg-gray-200/50 p-3 sm:p-4 gap-3"
          data-testid="version-panel"
        >
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 basis-56">
              <h2 className="text-sm font-black text-zinc-900 truncate" data-testid="version-title">{isCurrent ? 'Phiên bản hiện tại' : summary ? revisionTitle(summary) : '…'}</h2>
              <p className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-x-3">
                <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{formatWhen(isCurrent ? current.data?.manuscript.updatedAt : summary?.createdAt)}</span>
                {summary?.author?.displayName && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{summary.author.displayName}</span>}
                {summary && <span className="px-2 py-px rounded-full bg-white text-zinc-600 font-bold">{kindLabel(summary.kind)}</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {previous && (
                <button type="button" onClick={() => setShowChanges((v) => !v)} aria-pressed={showChanges} data-testid="toggle-changes" className={`${BTN} ${showChanges ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-700 hover:bg-zinc-200'}`}>
                  <GitCompareArrows className="w-3.5 h-3.5" />
                  <span>{showChanges ? 'Đang hiện thay đổi' : 'Hiện thay đổi'}</span>
                </button>
              )}
              {!isCurrent && summary && canManage && (
                <>
                  {summary.kind !== 'restore' && (
                    <button type="button" onClick={() => setRenameOpen(true)} data-testid="rename-version" className={BTN_SOFT}>
                      <Pencil className="w-3.5 h-3.5" />
                      <span>{isNamed ? 'Đổi tên' : 'Đặt tên'}</span>
                    </button>
                  )}
                  <button type="button" onClick={duplicateVersion} disabled={actions.duplicate.isPending} data-testid="duplicate-version" className={BTN_SOFT}>
                    {actions.duplicate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>Tạo bản sao</span>
                  </button>
                  {isNamed && (
                    <button type="button" onClick={() => setDeleteOpen(true)} data-testid="delete-version" className={`${BTN} bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600`}>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa</span>
                    </button>
                  )}
                  <button type="button" onClick={() => setRestoreOpen(true)} data-testid="restore-version" className={`${BTN} bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950 shadow-2xs`}>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Khôi phục phiên bản này</span>
                  </button>
                </>
              )}
            </div>
          </div>
          {summary?.description && <p className="shrink-0 text-xs text-zinc-600 bg-white/70 rounded-2xl px-3 py-2">{summary.description}</p>}

          <div className="flex-1 min-h-0">
            {loadingDoc || !shownDoc ? (
              <div className="mx-auto max-w-[820px] space-y-3 bg-white rounded-[28px] p-8" aria-busy="true" data-testid="version-loading">
                <Shimmer className="h-6 w-2/3 rounded-lg" />
                <Shimmer className="h-3 w-1/3 rounded-md" />
                <Shimmer className="h-24 w-full rounded-2xl" />
                <Shimmer className="h-24 w-full rounded-2xl" />
              </div>
            ) : (
              <Diff
                doc={shownDoc}
                compareTo={showChanges && previous ? compareDoc : null}
                showChanges={showChanges && !!previous && !!compareDoc}
                onInsertBlock={!isCurrent && canManage ? insertBlock : undefined}
              />
            )}
          </div>
        </motion.section>

        {/* the list */}
        <aside className="min-h-0 rounded-[32px] bg-white p-3 sm:p-4 shadow-sm flex flex-col" aria-label="Danh sách phiên bản">
          <RevisionList
            revisions={revisions}
            filter={filter}
            onFilter={setFilter}
            selectedId={selectedId}
            onSelect={setSelected}
            isLoading={list.isLoading}
            isError={list.isError}
            hasMore={!!list.hasNextPage}
            isFetchingMore={list.isFetchingNextPage}
            onLoadMore={() => void list.fetchNextPage()}
            current={{ updatedAt: current.data?.manuscript.updatedAt, title }}
          />
        </aside>
      </div>

      <VersionNameModal isOpen={saveOpen} onClose={() => setSaveOpen(false)} mode="save" isSaving={actions.save.isPending} onSubmit={saveVersion} />
      <VersionNameModal
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        mode="rename"
        initialName={summary?.name ?? ''}
        initialDescription={summary?.description ?? ''}
        isSaving={actions.rename.isPending}
        onSubmit={renameVersion}
      />
      <ActionConfirmModal
        isOpen={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        onConfirm={() => void restoreVersion()}
        variant="warning"
        zIndex={130}
        title="Khôi phục phiên bản này?"
        description={
          <>
            Nội dung bài báo sẽ trở về <b>{summary ? revisionTitle(summary) : ''}</b> ({formatWhen(summary?.createdAt)}). Trạng thái hiện tại không bị mất: nó được giữ lại thành
            một phiên bản “Trước khi khôi phục”, nên bạn vẫn quay lại được.
          </>
        }
        cancelLabel="Hủy bỏ"
        confirmLabel="Khôi phục"
        confirmIcon={<RotateCcw className="w-4 h-4" />}
        isLoading={actions.restore.isPending}
        testId="restore-confirm-modal"
        confirmTestId="confirm-restore-btn"
      />
      <ActionConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void deleteVersion()}
        variant="danger"
        zIndex={130}
        title="Xóa phiên bản này?"
        description={<>Phiên bản <b>{summary ? revisionTitle(summary) : ''}</b> sẽ bị xóa vĩnh viễn khỏi lịch sử. Nội dung bài báo hiện tại không đổi.</>}
        cancelLabel="Hủy bỏ"
        confirmLabel="Xóa phiên bản"
        confirmIcon={<Trash2 className="w-4 h-4" />}
        isLoading={actions.remove.isPending}
        testId="delete-version-modal"
        confirmTestId="confirm-delete-version-btn"
      />
    </div>
  );
};
