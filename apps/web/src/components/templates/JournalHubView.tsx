'use client';

import React, { useState } from 'react';
import { useManagedJournals } from '@/hooks';
import { JournalFiltersBar } from './JournalFiltersBar';
import { JournalProfilesList } from './JournalProfilesList';
import { JournalProfileCardShimmer } from './JournalProfileCardShimmer';
import { BookOpen, CheckCircle2 } from 'lucide-react';
import { ManagedJournalProfile } from '@/lib/templates/journal-storage';
import { CreatePaperModal } from '@/features/papers';
import { StickyHubToolbar } from '@/components/layout/StickyHubToolbar';

export const JournalHubView: React.FC = () => {
  const [selectedJournalForPaper, setSelectedJournalForPaper] =
    useState<ManagedJournalProfile | null>(null);

  const {
    journals,
    filteredJournals,
    isLoading,
    searchQuery,
    statusFilter,
    setSearchQuery,
    setStatusFilter,
    createPaperFromTemplate,
  } = useManagedJournals();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-16 px-4 sm:px-6">
      {/* 1. Header Hero Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#78C841]" strokeWidth={3} />
            <span>Quản Lý Mẫu &amp; Tạp Chí Khoa Học</span>
          </h1>
        </div>
      </div>

      {/* 2. Top Sticky Filter Toolbar matching Eatzy */}
      <StickyHubToolbar data-testid="journal-hub-sticky-toolbar">
        <JournalFiltersBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          totalCount={journals.length}
          filteredCount={filteredJournals.length}
        />
      </StickyHubToolbar>

      {/* 3. Journal Profiles Grid */}
      {isLoading ? (
        <div className="w-full grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
          <JournalProfileCardShimmer cardCount={7} />
        </div>
      ) : (
        <JournalProfilesList
          journals={filteredJournals}
          onCreatePaper={(managed) => setSelectedJournalForPaper(managed)}
          onResetFilters={() => {
            setSearchQuery('');
            setStatusFilter('all');
          }}
        />
      )}

      {/* 4. End of list indicator matching Eatzy */}
      {!isLoading && filteredJournals.length > 0 && (
        <div className="py-10 flex items-center justify-center gap-4 opacity-50 select-none">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
          <div className="flex flex-col items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-zinc-500" />
            <span className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">
              Bạn đã xem hết danh sách mẫu tạp chí
            </span>
          </div>
          <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
        </div>
      )}

      {/* 5. Create Paper Modal with Preselected Template */}
      <CreatePaperModal
        isOpen={Boolean(selectedJournalForPaper)}
        onClose={() => setSelectedJournalForPaper(null)}
        preselectedManaged={selectedJournalForPaper}
      />
    </div>
  );
};

export default JournalHubView;
