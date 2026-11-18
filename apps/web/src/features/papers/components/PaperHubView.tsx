'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGroup } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { usePapersHub } from '../hooks/usePapersHub';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import { RecentPapersRow } from './RecentPapersRow';
import { PaperFiltersBar } from './PaperFiltersBar';
import { PaperCard } from './PaperCard';
import { PaperCardShimmer } from './PaperCardShimmer';
import { PaperTable } from './PaperTable';
import { PaperTableShimmer } from './PaperTableShimmer';
import { PaperQuickEditModal } from './PaperQuickEditModal';
import { PaperDeleteConfirmModal } from './PaperDeleteConfirmModal';
import { ShareManuscriptModal } from '@/features/sharing';
import { getManuscriptTitle } from './types';
import { useAccess } from '@/lib/access';
import { LIBRARY_LABELS, type LibraryMode } from '../hooks/useLibraryPapers';
import { LibraryFetcher, NO_LIBRARY, type LibraryState } from './LibraryFetcher';
import { EmptyPapersState } from './EmptyPapersState';
import { CreatePaperModal } from './CreatePaperModal';
import { StickyHubToolbar } from '@/components/layout/StickyHubToolbar';

export const PaperHubView: React.FC = () => {
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingPaper, setDeletingPaper] = useState<ManuscriptRecord | null>(null);
  const [sharingPaper, setSharingPaper] = useState<ManuscriptRecord | null>(null);
  const [libraryMode, setLibraryMode] = useState<LibraryMode>('mine');
  const [library, setLibrary] = useState<LibraryState>(NO_LIBRARY);
  // Switching lists shows a loading state at once instead of the previous list.
  const changeLibraryMode = (mode: LibraryMode) => {
    setLibrary(mode === 'mine' ? NO_LIBRARY : { records: [], isLoading: true });
    setLibraryMode(mode);
  };
  // Whoever can already read every paper does not need the public library / shared-with-me shortcuts.
  const access = useAccess();
  const showLibrary = access.status === 'ready' && !access.can('manuscript:read_all');

  const {
    records,
    filteredPapers,
    isLoading,
    searchQuery,
    statusFilter,
    journalFilter,
    sortBy,
    viewMode,
    activeMenuId,
    editingPaper,
    countsByStatus,
    setSearchQuery,
    setStatusFilter,
    setJournalFilter,
    setSortBy,
    setViewMode,
    setActiveMenuId,
    setEditingPaper,
    loadRecords,
    handleOpenEditor,
    handleTogglePin,
    handleSaveQuickEdit,
    handleDuplicate,
    handleExportBackup,
    handleDelete,
  } = usePapersHub({ libraryRecords: library.records, libraryLoading: library.isLoading });

  // Close menus on click outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [setActiveMenuId]);

  return (
    <LayoutGroup id="paper-hub-layout-group">
      {libraryMode !== 'mine' && <LibraryFetcher mode={libraryMode} onState={setLibrary} />}
      <div className="w-full max-w-7xl mx-auto space-y-7 pb-16 pt-4 px-4 sm:px-6">
        {/* 1. Top Horizontal Recent Papers Row */}
        <RecentPapersRow
          papers={records}
          onOpenPaper={handleOpenEditor}
          onCreateNew={() => setIsCreateModalOpen(true)}
          isCreateOpen={isCreateModalOpen}
          isLoading={isLoading}
        />

            {/* 2. Sticky Filter Toolbar */}
            <StickyHubToolbar data-testid="paper-hub-sticky-toolbar">
              <PaperFiltersBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                onStatusFilterChange={setStatusFilter}
                journalFilter={journalFilter}
                onJournalFilterChange={setJournalFilter}
                sortBy={sortBy}
                onSortChange={setSortBy}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                countsByStatus={countsByStatus}
                onCreateFromTemplate={() => setIsCreateModalOpen(true)}
                libraryMode={libraryMode}
                onLibraryModeChange={changeLibraryMode}
                showLibrary={showLibrary}
              />
            </StickyHubToolbar>

            {/* 3. Papers List (Loading Shimmer vs Grid vs Table vs Empty) */}
            {isLoading ? (
              viewMode === 'grid' ? (
                <div
                  data-testid="papers-shimmer-grid"
                  className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                >
                  <PaperCardShimmer cardCount={8} />
                </div>
              ) : (
                <div data-testid="papers-shimmer-table">
                  <PaperTableShimmer rowCount={8} />
                </div>
              )
            ) : filteredPapers.length === 0 && libraryMode !== 'mine' ? (
              <p data-testid="library-empty" className="py-16 text-center text-sm font-semibold text-zinc-500">
                {LIBRARY_LABELS[libraryMode].empty}
              </p>
            ) : filteredPapers.length === 0 ? (
              <EmptyPapersState
                isFiltered={Boolean(searchQuery || statusFilter !== 'all' || journalFilter !== 'all')}
                onResetFilters={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setJournalFilter('all');
                }}
                onCreateFromTemplate={() => setIsCreateModalOpen(true)}
              />
            ) : viewMode === 'grid' ? (
              <div
                data-testid="papers-grid"
                className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              >
                {filteredPapers.map((paper) => (
                  <PaperCard
                    key={paper.info.id}
                    paper={paper}
                    isMenuOpen={activeMenuId === paper.info.id}
                    onToggleMenu={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === paper.info.id ? null : paper.info.id);
                    }}
                    onCloseMenu={() => setActiveMenuId(null)}
                    onOpenEditor={handleOpenEditor}
                    onQuickEdit={(p) => setEditingPaper(p)}
                    onTogglePin={handleTogglePin}
                    onDuplicate={handleDuplicate}
                    onExportBackup={handleExportBackup}
                    onShare={(p) => setSharingPaper(p)}
                    onDelete={(id) => {
                      const target = records.find((r) => r.info.id === id);
                      if (target) {
                        setDeletingPaper(target);
                      } else {
                        handleDelete(id);
                      }
                    }}
                  />
                ))}
              </div>
            ) : (
              <PaperTable
                papers={filteredPapers}
                activeMenuId={activeMenuId}
                onToggleMenu={(id, e) => {
                  e.stopPropagation();
                  setActiveMenuId(activeMenuId === id ? null : id);
                }}
                onCloseMenu={() => setActiveMenuId(null)}
                onOpenEditor={handleOpenEditor}
                onQuickEdit={(p) => setEditingPaper(p)}
                onTogglePin={handleTogglePin}
                onDuplicate={handleDuplicate}
                onExportBackup={handleExportBackup}
                onShare={(p) => setSharingPaper(p)}
                onDelete={(id) => {
                  const target = records.find((r) => r.info.id === id);
                  if (target) {
                    setDeletingPaper(target);
                  } else {
                    handleDelete(id);
                  }
                }}
              />
            )}

            {/* 4. End of list indicator */}
            {!isLoading && filteredPapers.length > 0 && (
              <div className="py-10 flex items-center justify-center gap-4 opacity-50 select-none">
                <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
                <div className="flex flex-col items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-zinc-500" />
                  <span className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">
                    Bạn đã xem hết danh sách bài báo
                  </span>
                </div>
                <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
              </div>
            )}

        {/* 5. Quick Edit Modal */}
        <PaperQuickEditModal
          paper={editingPaper}
          isOpen={Boolean(editingPaper)}
          onClose={() => setEditingPaper(null)}
          onSave={handleSaveQuickEdit}
        />

        {/* 6. Delete Confirmation Modal (matching Image 2) */}
        <PaperDeleteConfirmModal
          paper={deletingPaper}
          isOpen={Boolean(deletingPaper)}
          onClose={() => setDeletingPaper(null)}
          onConfirm={handleDelete}
        />

        <ShareManuscriptModal
          isOpen={Boolean(sharingPaper)}
          onClose={() => setSharingPaper(null)}
          manuscriptId={sharingPaper?.info.id ?? ''}
          manuscriptTitle={sharingPaper ? getManuscriptTitle(sharingPaper) : undefined}
        />

        {/* 7. 2-Step Create Paper Modal (Upload DOCX / Blank -> Select Template -> Editor) */}
        <CreatePaperModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onPaperCreated={() => loadRecords()}
          onBatchFinished={() => loadRecords()}
        />
      </div>
    </LayoutGroup>
  );
};

export default PaperHubView;
