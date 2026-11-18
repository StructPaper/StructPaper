'use client';

import React from 'react';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import { Pin, PinOff, Edit3, Sliders, Copy, Download, Trash2, Share2, X } from 'lucide-react';
import { paperAccessOfRecord } from '../access';

export interface PaperMenuItemsProps {
  paper: ManuscriptRecord;
  onCloseMenu: () => void;
  onOpenEditor: (id: string) => void;
  onQuickEdit: (paper: ManuscriptRecord) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onDuplicate: (paper: ManuscriptRecord) => void;
  onExportBackup: (paper: ManuscriptRecord) => void;
  onDelete: (id: string) => void;
  onShare?: (paper: ManuscriptRecord) => void;
}

/** The actions of the table row menu. Share / delete only appear when the user may do them. */
export const PaperMenuItems: React.FC<PaperMenuItemsProps> = ({
  paper,
  onCloseMenu,
  onOpenEditor,
  onQuickEdit,
  onTogglePin,
  onDuplicate,
  onExportBackup,
  onDelete,
  onShare,
}) => {
  const access = paperAccessOfRecord(paper);
  return (
    <>
      <div className="flex items-center justify-between px-2 py-1 select-none">
        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
          Thao tác bài báo
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCloseMenu();
          }}
          className="w-5 h-5 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-700 cursor-pointer"
          title="Đóng menu"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      <div className="border-t border-zinc-200/80 my-0.5" />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenEditor(paper.info.id);
          onCloseMenu();
        }}
        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-zinc-800 font-medium transition-colors text-left cursor-pointer"
      >
        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
        <span>Mở soạn thảo</span>
      </button>

      <button
        type="button"
        data-testid={`quick-edit-${paper.info.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onQuickEdit(paper);
          onCloseMenu();
        }}
        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-zinc-800 font-medium transition-colors text-left cursor-pointer"
      >
        <Sliders className="w-3.5 h-3.5 text-indigo-600" />
        <span>Sửa thông tin nhanh</span>
      </button>

      {access.canShare && onShare && (
        <button
          type="button"
          data-testid={`share-paper-${paper.info.id}`}
          onClick={(e) => {
            e.stopPropagation();
            onShare(paper);
            onCloseMenu();
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-zinc-800 font-medium transition-colors text-left cursor-pointer"
        >
          <Share2 className="w-3.5 h-3.5 text-[#14532D]" />
          <span>Chia sẻ</span>
        </button>
      )}

      <button
        type="button"
        data-testid={`pin-toggle-${paper.info.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePin(paper.info.id, paper.info.pinned);
          onCloseMenu();
        }}
        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-zinc-800 font-medium transition-colors text-left cursor-pointer"
      >
        {paper.info.pinned ? (
          <>
            <PinOff className="w-3.5 h-3.5 text-amber-600" />
            <span>Bỏ ghim</span>
          </>
        ) : (
          <>
            <Pin className="w-3.5 h-3.5 text-amber-600" />
            <span>Ghim lên đầu</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDuplicate(paper);
          onCloseMenu();
        }}
        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-zinc-800 font-medium transition-colors text-left cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5 text-zinc-600" />
        <span>Nhân bản bài báo</span>
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onExportBackup(paper);
          onCloseMenu();
        }}
        className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-zinc-800 font-medium transition-colors text-left cursor-pointer"
      >
        <Download className="w-3.5 h-3.5 text-[#14532D]" />
        <span>Xuất .structpaper</span>
      </button>

      {access.canDelete && (
        <>
          <div className="border-t border-zinc-200/80 my-0.5" />

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(paper.info.id);
              onCloseMenu();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium transition-colors text-left cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Xóa bài báo</span>
          </button>
        </>
      )}

    </>
  );
};
