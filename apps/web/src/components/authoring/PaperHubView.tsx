'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGroup } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { usePapersHub } from '@/hooks';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import {
  RecentPapersRow,
  PaperFiltersBar,
  PaperCard,
  PaperCardShimmer,
  PaperTable,
  PaperTableShimmer,
  PaperQuickEditModal,
  PaperDeleteConfirmModal,
  EmptyPapersState,
} from '@/components/papers';
import { CreatePaperModal } from '@/components/modals/CreatePaperModal';
import { StickyHubToolbar } from '@/components/layout/StickyHubToolbar';

export const PaperHubView: React.FC = () => {
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deletingPaper, setDeletingPaper] = useState<ManuscriptRecord | null>(null);

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
  } = usePapersHub();

  // Close menus on click outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [setActiveMenuId]);

  return (
    <LayoutGroup id="paper-hub-layout-group">
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
