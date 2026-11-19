'use client';

import React from 'react';
import { ArchiveRestore, Trash2, Clock, User, Hourglass, Loader2 } from 'lucide-react';
import { useEditorSession } from '@/context/EditorSessionContext';
import { formatRelativeTime } from '@/features/papers/components/types';

const PILL =
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-200 cursor-pointer select-none active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

/** Left of the title bar on a deleted paper's page: that it is in the trash (read-only), who deleted it, when, and how long is left. */
export const TrashTitleBarInfo: React.FC = () => {
  const { trashBar } = useEditorSession();
  const color = !trashBar ? '' : trashBar.daysLeft <= 3 ? 'text-rose-600' : trashBar.daysLeft <= 7 ? 'text-amber-600' : 'text-zinc-600';
  return (
    <div className="flex items-center gap-2 min-w-0" data-testid="titlebar-trash" data-no-drag="true">
      <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 text-white text-[10.5px] font-extrabold" title="Bài báo đang nằm trong thùng rác nên chỉ xem được, không sửa được">
        <Trash2 className="w-3 h-3" />
        Thùng rác · chỉ xem
      </span>
      {trashBar && (
        <span className="hidden md:flex items-center gap-3 text-[11px] text-zinc-500 min-w-0 whitespace-nowrap" data-testid="titlebar-trash-info">
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />Xóa {formatRelativeTime(trashBar.deletedAt)}</span>
          {trashBar.deletedBy && <span className="inline-flex items-center gap-1 truncate"><User className="w-3 h-3" />bởi {trashBar.deletedBy}</span>}
          <span className={`inline-flex items-center gap-1 font-bold ${color}`} data-testid="trash-preview-days">
            <Hourglass className="w-3 h-3" />
            {trashBar.daysLeft > 0 ? `Còn ${trashBar.daysLeft} ngày` : 'Sắp bị xóa'}
          </span>
        </span>
      )}
    </div>
  );
};

/** Right of the title bar on a deleted paper's page: restore it, or delete it for good (only what the server allows). */
export const TrashTitleBarActions: React.FC = () => {
  const { trashBar } = useEditorSession();
  if (!trashBar || (!trashBar.onRestore && !trashBar.onPurge)) return null;
  return (
    <>
      {trashBar.onRestore && (
        <button type="button" onClick={trashBar.onRestore} disabled={trashBar.busy} data-testid="trash-preview-restore" data-no-drag="true" title="Khôi phục" aria-label="Khôi phục" className={`${PILL} bg-zinc-100 hover:bg-[#78C841] hover:text-zinc-950 text-[#4a9a1f]`}>
          {trashBar.restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2.4} /> : <ArchiveRestore className="w-3.5 h-3.5" strokeWidth={2.4} />}
          <span>Khôi phục</span>
        </button>
      )}
      {trashBar.onPurge && (
        <button type="button" onClick={trashBar.onPurge} disabled={trashBar.busy} data-testid="trash-preview-purge" data-no-drag="true" title="Xóa vĩnh viễn" aria-label="Xóa vĩnh viễn" className={`${PILL} bg-rose-50 hover:bg-rose-500 hover:text-white text-rose-600`}>
          <Trash2 className="w-3.5 h-3.5" strokeWidth={2.4} />
          <span>Xóa vĩnh viễn</span>
        </button>
      )}
    </>
  );
};
