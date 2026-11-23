'use client';

import React from 'react';
import { ArrowLeft, Bookmark, History, ScanSearch } from 'lucide-react';
import { useEditorSession } from '@/context/EditorSessionContext';

/** The same small pill as the share and rules buttons of the paper's title bar. */
const PILL =
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-100 hover:bg-[#78C841] hover:text-zinc-950 text-zinc-600 transition-all duration-200 cursor-pointer select-none active:scale-95';

/** Left of the title bar on a paper's history page: the way back to the paper, what the page is, and whose history it is. */
export const PaperHistoryTitleBarInfo: React.FC = () => {
  const { paperHistoryBar } = useEditorSession();
  return (
    <div className="flex items-center gap-2 min-w-0" data-testid="titlebar-paper-history" data-no-drag="true">
      {paperHistoryBar && (
        <button type="button" onClick={paperHistoryBar.onBack} data-testid="history-back" title="Quay lại bài báo" aria-label="Quay lại bài báo" className={PILL}>
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại bài báo</span>
        </button>
      )}
      <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-900 text-white text-[10.5px] font-extrabold">
        <History className="w-3 h-3" />
        Lịch sử phiên bản
      </span>
      {paperHistoryBar?.title && (
        <span className="text-[12px] font-extrabold text-zinc-800 truncate max-w-[34vw]" data-testid="titlebar-paper-history-title">
          {paperHistoryBar.title}
        </span>
      )}
    </div>
  );
};

/** Right of the title bar on the history page: keeps the paper as it is now under a name. */
export const PaperHistorySaveButton: React.FC = () => {
  const { paperHistoryBar } = useEditorSession();
  if (!paperHistoryBar?.onSaveVersion) return null;
  return (
    <button
      type="button"
      onClick={paperHistoryBar.onSaveVersion}
      data-testid="history-save-version"
      data-no-drag="true"
      title="Lưu phiên bản có tên"
      aria-label="Lưu phiên bản có tên"
      className={PILL}
    >
      <Bookmark className="w-3.5 h-3.5" />
      <span>Lưu phiên bản</span>
    </button>
  );
};

/**
 * Right of the title bar on the history page: turns the detailed way of reading a version on and off. Off (the default) is the
 * paper as one page with what changed marked; on is laid out like the editor's tabs and also shows settings and page layout.
 */
export const PaperHistoryDetailToggle: React.FC = () => {
  const { paperHistoryBar } = useEditorSession();
  if (!paperHistoryBar?.onToggleDetailed) return null;
  const on = !!paperHistoryBar.detailed;
  return (
    <button
      type="button"
      onClick={paperHistoryBar.onToggleDetailed}
      aria-pressed={on}
      data-testid="history-detail-toggle"
      data-no-drag="true"
      title={on ? 'Quay về chế độ xem gọn (cả bài trên một trang)' : 'Xem chi tiết: từng tab như trình soạn thảo, kèm cài đặt và dàn trang'}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all duration-200 cursor-pointer select-none active:scale-95 ${
        on ? 'bg-zinc-900 text-white' : 'bg-zinc-100 hover:bg-[#78C841] hover:text-zinc-950 text-zinc-600'
      }`}
    >
      <ScanSearch className="w-3.5 h-3.5" />
      <span>{on ? 'Đang xem chi tiết' : 'Xem chi tiết'}</span>
    </button>
  );
};
