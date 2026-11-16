'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import {
  Pin,
  PinOff,
  MoreVertical,
  Edit3,
  Sliders,
  Copy,
  Download,
  Trash2,
  ArrowRight,
  X,
} from 'lucide-react';
import {
  getJournalColor,
  getJournalShortName,
  getManuscriptTitle,
  getManuscriptAuthors,
  getWorkflowStatusConfig,
  formatRelativeTime,
  getSyncBadgeConfig,
} from './types';
import { useStorage } from '@/context/StorageContext';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

interface PaperCardProps {
  paper: ManuscriptRecord;
  isMenuOpen: boolean;
  onToggleMenu: (e: React.MouseEvent) => void;
  onCloseMenu: () => void;
  onOpenEditor: (id: string) => void;
  onQuickEdit: (paper: ManuscriptRecord) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onDuplicate: (paper: ManuscriptRecord) => void;
  onExportBackup: (paper: ManuscriptRecord) => void;
  onDelete: (id: string) => void;
}

export const PaperCard: React.FC<PaperCardProps> = ({
  paper,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onOpenEditor,
  onQuickEdit,
  onTogglePin,
  onDuplicate,
  onExportBackup,
  onDelete,
}) => {
  const storage = useStorage();
  const { info, doc } = paper;
  const title = getManuscriptTitle(paper);
  const authors = getManuscriptAuthors(paper);
  const journalColor = getJournalColor(doc.journalId, paper);
  const journalShort = getJournalShortName(doc.journalId, paper);
  const statusConfig = getWorkflowStatusConfig(info.workflowStatus);
  const syncBadgeConfig = getSyncBadgeConfig(paper);
  const relativeTime = formatRelativeTime(info.lastOpenedAt || info.updatedAt);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleDismissOnScroll = () => {
      onCloseMenu();
    };

    window.addEventListener('scroll', handleDismissOnScroll, true);
    return () => {
      window.removeEventListener('scroll', handleDismissOnScroll, true);
    };
  }, [isMenuOpen, onCloseMenu]);

  return (
    <motion.div
      data-testid={`paper-card-${info.id}`}
      onClick={() => onOpenEditor(info.id)}
      whileHover={isTest || isMenuOpen ? undefined : { scale: 1.02 }}
      whileTap={isTest || isMenuOpen ? undefined : { scale: 0.98 }}
      transition={isTest ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
      className={`w-full bg-gray-200/50 p-4 rounded-3xl transition-all duration-300 cursor-pointer flex flex-col justify-between hover:bg-white hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] group relative select-none min-h-[178px] ${
        isMenuOpen ? 'z-40 shadow-xl bg-white' : 'z-10'
      }`}
    >
      <div>
        {/* Top Badges & Actions matching UploadView */}
        <div className="flex items-center justify-between mb-2">
          {/* Journal Badge */}
          <span
            className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white shadow-2xs"
            style={{ backgroundColor: journalColor }}
          >
            {journalShort}
          </span>

          {/* Right Badges & Context Menu */}
          <div
            className="flex items-center gap-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            {info.pinned && (
              <span title="Đã ghim" className="text-amber-500">
                <Pin className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              </span>
            )}

            {/* Sync Status Badge (only when local storage is active and not synced) */}
            {storage.isLocalAvailable && paper.syncState !== 'synced' && (
              <span
                data-testid={`sync-badge-${info.id}`}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${syncBadgeConfig.classes}`}
              >
                {syncBadgeConfig.label}
              </span>
            )}

            <span
              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${statusConfig.chipBg} ${statusConfig.chipText}`}
            >
              {statusConfig.label}
            </span>

            {/* Fixed-size slot for 3-dots and Shared Element Transition Popup (prevents vertical layout shift) */}
            <div
              className="w-7 h-7 shrink-0 relative flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <AnimatePresence>
                {!isMenuOpen ? (
                  <motion.button
                    key="menu-trigger-btn"
                    layoutId={`paper-menu-card-${info.id}`}
                    data-testid={`menu-trigger-${info.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleMenu(e);
                    }}
                    className="w-7 h-7 rounded-full bg-white/70 hover:bg-white text-zinc-600 hover:text-zinc-950 flex items-center justify-center shadow-xs border border-zinc-200/60 transition-colors cursor-pointer"
                    title="Thao tác khác"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </motion.button>
                ) : (
                  <motion.div
                    key="menu-dropdown-popup"
                    layoutId={`paper-menu-card-${info.id}`}
                    data-testid={`paper-menu-${info.id}`}
                    initial={isTest ? false : undefined}
                    transition={
                      isTest
                        ? { duration: 0 }
                        : {
                            type: 'spring',
                            stiffness: 150,
                            damping: 18,
                            mass: 0.8,
                          }
                    }
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-0 top-0 z-50 w-52 bg-white/98 backdrop-blur-xl border border-zinc-200/90 rounded-3xl shadow-2xl p-1.5 text-xs text-zinc-800 space-y-0.5 select-none"
                    style={{
                      transformOrigin: 'top right',
                    }}
                  >
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
                        onOpenEditor(info.id);
                        onCloseMenu();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-left font-medium cursor-pointer transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Mở soạn thảo</span>
                    </button>

                    <button
                      type="button"
                      data-testid={`quick-edit-${info.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickEdit(paper);
                        onCloseMenu();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                    >
                      <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Sửa thông tin nhanh</span>
                    </button>

                    <button
                      type="button"
                      data-testid={`pin-toggle-${info.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePin(info.id, info.pinned);
                        onCloseMenu();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                    >
                      {info.pinned ? (
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
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 font-medium cursor-pointer transition-colors"
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
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-[#14532D]" />
                      <span>Xuất file .structpaper</span>
                    </button>

                    <div className="border-t border-zinc-200/80 my-0.5" />

                    <button
                      type="button"
                      data-testid={`delete-paper-${info.id}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(info.id);
                        onCloseMenu();
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl hover:bg-red-50 text-red-600 hover:text-red-700 flex items-center gap-2 font-medium cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa bài báo</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Paper Display Title */}
        <h4
          className="font-bold text-xs text-[#1A1A1A] line-clamp-2 mb-1.5 leading-snug"
          title={title}
        >
          {title}
        </h4>

        {/* Authors */}
        <p className="text-[11px] text-zinc-500 line-clamp-2 mb-2">
          {authors || 'Tác giả bài báo'}
        </p>

        {/* Metadata stats row matching UploadView (no hashtags) */}
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-semibold mb-2 flex-wrap">
          <span>{relativeTime}</span>
          {info.submissionId && <span>• {info.submissionId}</span>}
        </div>
      </div>

      {/* Action Footer matching UploadView exactly */}
      <div className="mt-3 pt-2.5 border-t border-gray-300/50 flex items-center justify-between text-xs font-bold text-zinc-800">
        <span>Mở soạn thảo</span>
        <ArrowRight className="w-3.5 h-3.5 text-[#78C841]" />
      </div>
    </motion.div>
  );
};
