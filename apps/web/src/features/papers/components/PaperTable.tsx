'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  Clock,
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
import { isLocalStorageEnabled } from '@/config/storage.config';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

interface PaperTableProps {
  papers: ManuscriptRecord[];
  activeMenuId: string | null;
  onToggleMenu: (id: string, e: React.MouseEvent) => void;
  onCloseMenu: () => void;
  onOpenEditor: (id: string) => void;
  onQuickEdit: (paper: ManuscriptRecord) => void;
  onTogglePin: (id: string, currentPinned: boolean) => void;
  onDuplicate: (paper: ManuscriptRecord) => void;
  onExportBackup: (paper: ManuscriptRecord) => void;
  onDelete: (id: string) => void;
}

interface MenuAnchor {
  id: string;
  top: number;
  bottom: number;
  right: number;
  openUpwards: boolean;
}

export const PaperTable: React.FC<PaperTableProps> = ({
  papers,
  activeMenuId,
  onToggleMenu,
  onCloseMenu,
  onOpenEditor,
  onQuickEdit,
  onTogglePin,
  onDuplicate,
  onExportBackup,
  onDelete,
}) => {
  const [mounted, setMounted] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // Compute position relative to viewport
  const computeAnchor = (targetId: string, buttonEl: HTMLElement): MenuAnchor => {
    const rect = buttonEl.getBoundingClientRect();
    const estimatedHeight = 270;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const spaceBelow = windowHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUpwards = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

    return {
      id: targetId,
      top: rect.bottom + 6,
      bottom: windowHeight - rect.top + 6,
      right: Math.max(12, windowWidth - rect.right),
      openUpwards,
    };
  };

  const handleToggleClick = (id: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (activeMenuId === id) {
      onCloseMenu();
      setMenuAnchor(null);
      return;
    }

    const anchor = computeAnchor(id, e.currentTarget);
    setMenuAnchor(anchor);
    onToggleMenu(id, e);
  };

  // Synchronize anchor if activeMenuId changes or is set externally
  useEffect(() => {
    if (!activeMenuId) {
      setMenuAnchor(null);
      return;
    }
    if (!menuAnchor || menuAnchor.id !== activeMenuId) {
      const el = triggerRefs.current[activeMenuId];
      if (el) {
        setMenuAnchor(computeAnchor(activeMenuId, el));
      }
    }
  }, [activeMenuId, menuAnchor]);

  // Close floating menu on scroll or window resize
  useEffect(() => {
    if (!activeMenuId) return;

    const handleScrollOrResize = () => {
      onCloseMenu();
    };

    window.addEventListener('scroll', handleScrollOrResize, { passive: true, capture: true });
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, { capture: true });
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeMenuId, onCloseMenu]);

  const activePaper = activeMenuId ? papers.find((p) => p.info.id === activeMenuId) : null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" data-testid="papers-table">
          <thead>
            <tr className="border-b border-slate-200/80 bg-gray-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-3 w-10 text-center">Ghim</th>
              <th className="py-3 px-4 min-w-[260px]">Tên bài báo & Mã bài</th>
              <th className="py-3 px-4 min-w-[130px]">Tạp chí</th>
              <th className="py-3 px-4 min-w-[120px]">Trạng thái</th>
              <th className="py-3 px-4 min-w-[180px]">Tác giả</th>
              <th className="py-3 px-4 min-w-[120px]">Cập nhật</th>
              <th className="py-3 px-3 w-28 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {papers.map((paper) => {
              const { info, doc } = paper;
              const title = getManuscriptTitle(paper);
              const authors = getManuscriptAuthors(paper);
              const journalColor = getJournalColor(doc.journalId, paper);
              const journalShort = getJournalShortName(doc.journalId, paper);
              const statusConfig = getWorkflowStatusConfig(info.workflowStatus);
              const syncBadgeConfig = getSyncBadgeConfig(paper);
              const relativeTime = formatRelativeTime(
                info.lastOpenedAt || info.updatedAt
              );
              const isMenuOpen = activeMenuId === info.id;

              return (
                <tr
                  key={info.id}
                  data-testid={`paper-row-${info.id}`}
                  onClick={() => onOpenEditor(info.id)}
                  className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                >
                  {/* Pin Column */}
                  <td
                    className="py-3 px-3 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => onTogglePin(info.id, info.pinned)}
                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                        info.pinned
                          ? 'text-amber-500 hover:text-amber-600 bg-amber-50'
                          : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                      title={info.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
                    >
                      <Pin
                        className={`w-3.5 h-3.5 ${
                          info.pinned ? 'fill-amber-500 text-amber-500' : ''
                        }`}
                      />
                    </button>
                  </td>

                  {/* Title & Submission ID */}
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900 group-hover:text-zinc-950 line-clamp-1 transition-colors">
                      {title}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {info.submissionId && (
                        <span className="font-mono text-[10px] font-semibold text-slate-500">
                          {info.submissionId}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Journal */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-extrabold text-[11px]"
                        style={{ color: journalColor }}
                      >
                        {journalShort}
                      </span>
                    </div>
                  </td>

                  {/* Workflow Status */}
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded-full text-[10px] border inline-flex items-center gap-1 ${statusConfig.chipBg} ${statusConfig.chipText} ${statusConfig.border}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotBg}`}
                        />
                        {statusConfig.label}
                      </span>
                      {isLocalStorageEnabled() && paper.syncState !== 'synced' && (
                        <span
                          data-testid={`sync-badge-${info.id}`}
                          className={`font-semibold px-2 py-0.5 rounded-full text-[10px] border inline-flex items-center gap-1 ${syncBadgeConfig.classes}`}
                        >
                          {syncBadgeConfig.label}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Authors */}
                  <td className="py-3 px-4 text-slate-500">
                    <span className="line-clamp-1 font-normal text-[11px]">{authors}</span>
                  </td>

                  {/* Updated Time */}
                  <td className="py-3 px-4 text-slate-500 text-[11px]">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>{relativeTime}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td
                    className="py-3 px-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1 relative">
                      {/* Quick Edit button */}
                      <button
                        onClick={() => onQuickEdit(paper)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
                        title="Sửa thông tin nhanh"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>

                      {/* 3-dots trigger button */}
                      <div
                        className="w-7 h-7 shrink-0 relative flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          ref={(el) => {
                            triggerRefs.current[info.id] = el;
                          }}
                          key={`table-menu-trigger-btn-${info.id}`}
                          data-testid={`menu-trigger-${info.id}`}
                          onClick={(e) => handleToggleClick(info.id, e)}
                          className={`w-7 h-7 rounded-full flex items-center justify-center shadow-xs border transition-colors cursor-pointer ${
                            isMenuOpen
                              ? 'bg-zinc-900 text-white border-zinc-900 ring-2 ring-zinc-900/20'
                              : 'bg-white/70 hover:bg-white text-zinc-600 hover:text-zinc-950 border-zinc-200/60'
                          }`}
                          title="Thao tác khác"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Floating Menu rendered into Portal: completely escapes table overflow-hidden / overflow-x-auto */}
      {mounted && activePaper && menuAnchor && (
        createPortal(
          <AnimatePresence>
            {activeMenuId === activePaper.info.id && (
              <div
                key={`table-menu-portal-wrapper-${activePaper.info.id}`}
                className="fixed inset-0 z-[9999] pointer-events-none"
              >
                {/* Transparent click-outside dismisser */}
                <div
                  className="fixed inset-0 z-[9998] pointer-events-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseMenu();
                  }}
                />

                {/* Floating Popup */}
                <motion.div
                  key={`table-menu-dropdown-popup-${activePaper.info.id}`}
                  data-testid={`paper-menu-${activePaper.info.id}`}
                  initial={
                    isTest
                      ? false
                      : {
                          opacity: 0,
                          scale: 0.9,
                          y: menuAnchor.openUpwards ? 8 : -8,
                        }
                  }
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={
                    isTest
                      ? undefined
                      : {
                          opacity: 0,
                          scale: 0.9,
                          y: menuAnchor.openUpwards ? 8 : -8,
                        }
                  }
                  transition={
                    isTest
                      ? { duration: 0 }
                      : {
                          type: 'spring',
                          stiffness: 350,
                          damping: 25,
                          mass: 0.5,
                        }
                  }
                  onClick={(e) => e.stopPropagation()}
                  className="fixed z-[9999] pointer-events-auto w-52 max-h-[min(380px,85vh)] overflow-y-auto bg-white/98 backdrop-blur-xl border border-zinc-200/90 rounded-2xl shadow-2xl p-1.5 text-xs text-zinc-800 space-y-0.5 select-none text-left"
                  style={{
                    top: menuAnchor.openUpwards ? undefined : `${menuAnchor.top}px`,
                    bottom: menuAnchor.openUpwards ? `${menuAnchor.bottom}px` : undefined,
                    right: `${menuAnchor.right}px`,
                    transformOrigin: menuAnchor.openUpwards ? 'bottom right' : 'top right',
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
                      onOpenEditor(activePaper.info.id);
                      onCloseMenu();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-zinc-800 font-medium transition-colors text-left cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Mở soạn thảo</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`quick-edit-${activePaper.info.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickEdit(activePaper);
                      onCloseMenu();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-zinc-800 font-medium transition-colors text-left cursor-pointer"
                  >
                    <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Sửa thông tin nhanh</span>
                  </button>

                  <button
                    type="button"
                    data-testid={`pin-toggle-${activePaper.info.id}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePin(activePaper.info.id, activePaper.info.pinned);
                      onCloseMenu();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-zinc-800 font-medium transition-colors text-left cursor-pointer"
                  >
                    {activePaper.info.pinned ? (
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
                      onDuplicate(activePaper);
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
                      onExportBackup(activePaper);
                      onCloseMenu();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-zinc-800 font-medium transition-colors text-left cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-[#14532D]" />
                    <span>Xuất .structpaper</span>
                  </button>

                  <div className="border-t border-zinc-200/80 my-0.5" />

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(activePaper.info.id);
                      onCloseMenu();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-xl hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium transition-colors text-left cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa bài báo</span>
                  </button>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )
      )}
    </div>
  );
};
