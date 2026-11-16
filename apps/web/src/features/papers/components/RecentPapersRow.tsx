'use client';

import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import {
  Clock,
  Pin,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowRight,
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

interface RecentPapersRowProps {
  papers: ManuscriptRecord[];
  onOpenPaper: (id: string) => void;
  onCreateNew?: () => void;
  isCreateOpen?: boolean;
  isLoading?: boolean;
}

export const RecentPapersRow: React.FC<RecentPapersRowProps> = ({
  papers,
  onOpenPaper,
  onCreateNew,
  isCreateOpen = false,
  isLoading = false,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Take the most recently updated or opened 5 papers
  const recentPapers = [...papers]
    .sort((a, b) => {
      const timeA = new Date(a.info.lastOpenedAt || a.info.updatedAt).getTime();
      const timeB = new Date(b.info.lastOpenedAt || b.info.updatedAt).getTime();
      return timeB - timeA;
    })
    .slice(0, 5);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollContainerRef.current) return;
    const offset = direction === 'left' ? -320 : 320;
    scrollContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
  };

  return (
    <div className="w-full space-y-3.5">
      {/* Header with Title and Scroll Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-[#D9F99D]/70 border border-[#B4E50D]/40 flex items-center justify-center text-[#14532D]">
            <Clock className="w-4 h-4 text-[#14532D]" />
          </div>
          <h2 className="text-sm font-extrabold text-[#1A1A1A] tracking-tight flex items-center gap-2">
            <span>Bài chỉnh sửa gần đây</span>
            <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
              {isLoading ? '...' : recentPapers.length}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleScroll('left')}
            className="w-7 h-7 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer shadow-2xs"
            title="Cuộn sang trái"
            aria-label="Cuộn sang trái"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleScroll('right')}
            className="w-7 h-7 rounded-xl border border-zinc-200/80 bg-white hover:bg-zinc-50 flex items-center justify-center text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer shadow-2xs"
            title="Cuộn sang phải"
            aria-label="Cuộn sang phải"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Scrollable Carousel */}
      <div
        ref={scrollContainerRef}
        data-testid="recent-papers-scroll-container"
        className="w-full flex items-stretch gap-3.5 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-zinc-200 scrollbar-track-transparent snap-x snap-mandatory"
        style={{ scrollbarWidth: 'thin' }}
      >
        {/* Quick New Paper Starter Card with Shared Element Transition */}
        <motion.div
          layout
          layoutId="create-paper-modal-card"
          data-testid="create-paper-starter-card"
          onClick={onCreateNew}
          whileTap={{ scale: 0.98 }}
          transition={
            isTest
              ? { duration: 0 }
              : {
                  type: 'spring',
                  stiffness: 100,
                  damping: 18,
                  mass: 0.8,
                }
          }
          className={`group cursor-pointer shrink-0 w-60 sm:w-64 snap-start select-none bg-white p-4 rounded-3xl border-2 border-dashed border-[#78C841]/40 hover:border-[#78C841] hover:bg-[#D9F99D]/10 flex flex-col justify-between shadow-2xs hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${
            isCreateOpen ? 'opacity-0 pointer-events-none' : ''
          }`}
        >
          <div className='flex-col items-center justify-center'>
            <div className="w-10 h-10 rounded-2xl bg-[#D9F99D] text-[#14532D] flex items-center justify-center mb-3 transition-transform group-hover:scale-110 shadow-2xs">
              <Plus className="w-5 h-5 stroke-[3.5]" />
            </div>
            <h4 className="font-extrabold text-md text-[#1A1A1A] group-hover:text-zinc-950 mb-1">
              Tạo bài báo mới
            </h4>
          </div>
          <div className="mt-4 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs font-bold text-zinc-800">
            <span>Bắt đầu</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#78C841]" />
          </div>
        </motion.div>

        {/* Recent Papers Cards (Loading Shimmer vs Real Cards) */}
        {isLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div
              key={`recent-shimmer-${idx}`}
              className="shrink-0 w-64 sm:w-72 snap-start select-none bg-gray-200/50 p-4 rounded-3xl flex flex-col justify-between overflow-hidden relative min-h-[148px]"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div
                    style={{
                      background: 'linear-gradient(90deg, #e5e7eb 25%, rgba(255,255,255,0.85) 50%, #e5e7eb 75%)',
                      backgroundSize: '200% 100%',
                    }}
                    className="h-4 w-14 rounded-full animate-pulse"
                  />
                  <div
                    style={{
                      background: 'linear-gradient(90deg, #e5e7eb 25%, rgba(255,255,255,0.85) 50%, #e5e7eb 75%)',
                      backgroundSize: '200% 100%',
                    }}
                    className="h-4 w-12 rounded-full animate-pulse"
                  />
                </div>
                <div
                  style={{
                    background: 'linear-gradient(90deg, #e5e7eb 25%, rgba(255,255,255,0.85) 50%, #e5e7eb 75%)',
                    backgroundSize: '200% 100%',
                  }}
                  className="h-3.5 w-4/5 rounded mb-1.5 animate-pulse"
                />
                <div
                  style={{
                    background: 'linear-gradient(90deg, #e5e7eb 25%, rgba(255,255,255,0.85) 50%, #e5e7eb 75%)',
                    backgroundSize: '200% 100%',
                  }}
                  className="h-3 w-1/2 rounded mb-2 animate-pulse"
                />
              </div>
              <div className="mt-3 pt-2.5 border-t border-gray-300/40 flex items-center justify-between">
                <div
                  style={{
                    background: 'linear-gradient(90deg, #e5e7eb 25%, rgba(255,255,255,0.85) 50%, #e5e7eb 75%)',
                    backgroundSize: '200% 100%',
                  }}
                  className="h-3 w-16 rounded animate-pulse"
                />
                <div
                  style={{
                    background: 'linear-gradient(90deg, #e5e7eb 25%, rgba(255,255,255,0.85) 50%, #e5e7eb 75%)',
                    backgroundSize: '200% 100%',
                  }}
                  className="h-3.5 w-3.5 rounded-full animate-pulse"
                />
              </div>
            </div>
          ))
        ) : (
          recentPapers.map((paper) => {
            const title = getManuscriptTitle(paper);
            const authors = getManuscriptAuthors(paper);
            const journalColor = getJournalColor(paper.doc.journalId, paper);
            const journalShort = getJournalShortName(paper.doc.journalId, paper);
            const statusConfig = getWorkflowStatusConfig(paper.info.workflowStatus);
            const syncBadgeConfig = getSyncBadgeConfig(paper);
            const relativeTime = formatRelativeTime(
              paper.info.lastOpenedAt || paper.info.updatedAt
            );

            return (
              <motion.div
                key={paper.info.id}
                data-testid={`recent-paper-${paper.info.id}`}
                onClick={() => onOpenPaper(paper.info.id)}
                whileHover={isTest ? undefined : { scale: 1.02 }}
                whileTap={isTest ? undefined : { scale: 0.98 }}
                transition={isTest ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
              className="group cursor-pointer shrink-0 w-64 sm:w-72 snap-start select-none bg-white p-4 rounded-3xl border border-zinc-200/80 transition-shadow duration-300 flex flex-col justify-between hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)]"
            >
              <div>
                {/* Card Top: Journal code badge & Status pill / Pinned */}
                <div className="flex items-center justify-between mb-2.5">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white shadow-2xs"
                    style={{ backgroundColor: journalColor }}
                  >
                    {journalShort}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {paper.info.pinned && (
                      <Pin className="w-3.5 h-3.5 fill-amber-500 text-amber-600" />
                    )}
                    {isLocalStorageEnabled() && paper.syncState !== 'synced' && (
                      <span
                        data-testid={`sync-badge-${paper.info.id}`}
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
                  </div>
                </div>

                {/* Title */}
                <h4
                  className="font-bold text-xs text-[#1A1A1A] line-clamp-2 mb-1.5 leading-snug group-hover:text-zinc-950 transition-colors"
                  title={title}
                >
                  {title}
                </h4>

                {/* Authors */}
                <p className="text-[11px] text-zinc-500 line-clamp-1 mb-2">
                  {authors || 'Chưa cập nhật tác giả'}
                </p>

                {/* Metadata */}
                <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-semibold">
                  <span>{relativeTime}</span>
                  {paper.info.submissionId && (
                    <span>• {paper.info.submissionId}</span>
                  )}
                </div>
              </div>

              {/* Card Footer: Action */}
              <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between text-xs font-bold text-zinc-800">
                <span>Mở soạn thảo</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#78C841]" />
              </div>
            </motion.div>
          );
        })
      )}
    </div>
    </div>
  );
};
