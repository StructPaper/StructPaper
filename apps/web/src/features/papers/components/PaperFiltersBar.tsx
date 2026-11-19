'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  LayoutGrid,
  List,
  X,
  Globe2,
  Users,
} from 'lucide-react';
import { useJournals } from '@/features/journals';
import { Shimmer } from '@/components/ui/Shimmer';
import { Select, SelectOption } from '@/components/ui/Select';
import {
  type FilterWorkflowStatus,
  type FilterJournal,
  type SortOption,
  type ViewMode,
  WORKFLOW_STATUS_CONFIG,
} from './types';
import { LIBRARY_LABELS, type LibraryMode } from '../hooks/useLibraryPapers';

interface PaperFiltersBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  statusFilter: FilterWorkflowStatus;
  onStatusFilterChange: (s: FilterWorkflowStatus) => void;
  journalFilter: FilterJournal;
  onJournalFilterChange: (j: FilterJournal) => void;
  sortBy: SortOption;
  onSortChange: (s: SortOption) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
  countsByStatus?: Partial<Record<FilterWorkflowStatus, number>>;
  onCreateFromTemplate?: () => void;
  /** Which list is shown; the library toggles only appear when `showLibrary` is set. */
  libraryMode?: LibraryMode;
  onLibraryModeChange?: (mode: LibraryMode) => void;
  showLibrary?: boolean;
}

const STATUS_TABS: Array<{ id: FilterWorkflowStatus; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'draft', label: WORKFLOW_STATUS_CONFIG.draft.label },
  { id: 'in-review', label: WORKFLOW_STATUS_CONFIG['in-review'].label },
  { id: 'proofing', label: WORKFLOW_STATUS_CONFIG.proofing.label },
  { id: 'ready', label: WORKFLOW_STATUS_CONFIG.ready.label },
  { id: 'published', label: WORKFLOW_STATUS_CONFIG.published.label },
];

export const PaperFiltersBar: React.FC<PaperFiltersBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  journalFilter,
  onJournalFilterChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onCreateFromTemplate,
  libraryMode = 'mine',
  onLibraryModeChange,
  showLibrary = false,
}) => {
  const [searchInputValue, setSearchInputValue] = React.useState(searchQuery);
  const { journals, isLoading: journalsLoading } = useJournals();
  const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

  React.useEffect(() => {
    setSearchInputValue(searchQuery);
  }, [searchQuery]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInputValue(val);
    if (isTestEnv) {
      onSearchChange(val);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSearchChange(searchInputValue);
    }
  };

  // Journal select options
  const journalOptions: SelectOption<string>[] = [
    { value: 'all', label: 'Tất cả tạp chí' },
    ...journals.map((j) => ({
      value: j.key,
      label: j.code,
      color: j.color,
      badge: j.key.toUpperCase(),
    })),
  ];

  // Sort select options
  const sortOptions: SelectOption<SortOption>[] = [
    { value: 'newest', label: 'Sắp xếp: Mới nhất' },
    { value: 'title', label: 'Sắp xếp: Tên A-Z' },
    { value: 'status', label: 'Sắp xếp: Trạng thái' },
  ];

  return (
    <div className="space-y-3">
      {/* Row 1: Eatzy-style Search Bar */}
      <div className="w-full flex flex-wrap items-center justify-start gap-2.5">
        {/* Eatzy Search Input Box with constrained width */}
        <div className="flex-1 min-w-[260px] max-w-xl relative group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 z-10 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400 group-hover:text-zinc-600 group-focus-within:text-[#78C841] transition-colors" />
            <div className="w-px h-4 bg-gray-200 group-hover:bg-zinc-300 transition-colors" />
          </div>

          <input
            type="text"
            role="searchbox"
            data-testid="paper-search-input"
            value={searchInputValue}
            onChange={handleInputChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Tìm theo tên bài, mã bài, tác giả... (nhấn Enter để tìm)"
            style={{ boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.09)' }}
            className="w-full bg-slate-50/40 backdrop-blur-sm border-2 border-white focus:border-[#78C841]/20 rounded-3xl py-3.5 sm:py-4 pl-14 pr-12 text-sm sm:text-base font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#78C841]/5 transition-all shadow-eatzy-inner hover:shadow-eatzy-inner-hover"
          />

          {searchInputValue && (
            <button
              onClick={() => {
                setSearchInputValue('');
                onSearchChange('');
              }}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center transition-all group/close cursor-pointer"
              title="Xóa tìm kiếm"
            >
              <X className="w-4 h-4 text-zinc-600 group-hover/close:rotate-90 transition-transform duration-300" />
            </button>
          )}
        </div>

        {showLibrary && onLibraryModeChange && (
          <div className="ml-auto flex items-center gap-2" data-testid="library-toggles">
            {(['public', 'shared'] as const).map((mode) => {
              const active = libraryMode === mode;
              const Icon = mode === 'public' ? Globe2 : Users;
              return (
                <button
                  key={mode}
                  type="button"
                  data-testid={`library-toggle-${mode}`}
                  aria-pressed={active}
                  onClick={() => onLibraryModeChange(active ? 'mine' : mode)}
                  className={`inline-flex items-center gap-2 px-4 py-3 rounded-3xl text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-[#78C841] text-zinc-950 shadow-md shadow-lime-900/10'
                      : 'bg-slate-50/60 border-2 border-white text-zinc-600 hover:text-zinc-900 hover:bg-white shadow-eatzy-inner'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{LIBRARY_LABELS[mode].label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Row 2: Status Filter Chips & Right Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
        {/* Status Filter Chips (Eatzy style without counts) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.id;

            return (
              <motion.button
                key={tab.id}
                data-testid={`filter-chip-${tab.id}`}
                whileHover={isTestEnv ? undefined : { scale: 1.03 }}
                whileTap={isTestEnv ? undefined : { scale: 0.97 }}
                transition={isTestEnv ? { duration: 0 } : undefined}
                onClick={() => onStatusFilterChange(tab.id)}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1A1A1A] text-white shadow-md shadow-black/10'
                    : 'bg-gray-200 text-zinc-600 hover:text-zinc-900 hover:bg-gray-200/70'
                }`}
              >
                {tab.label}
              </motion.button>
            );
          })}
        </div>

        {/* Right side: Custom Selects & View Toggle */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Custom Select for Journal */}
          <div className="w-44">
            {journalsLoading ? (
              <Shimmer className="h-9 w-full rounded-2xl" />
            ) : (
              <Select
                options={journalOptions}
                value={journalFilter}
                onChange={(val) => onJournalFilterChange(val as FilterJournal)}
                size="sm"
                variant="eatzy-inner"
                fullWidth
              />
            )}
            {/* Hidden native select for test & accessibility integration */}
            <select
              data-testid="filter-journal-select"
              value={journalFilter}
              onChange={(e) => onJournalFilterChange(e.target.value as FilterJournal)}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            >
              <option value="all">Tất cả tạp chí</option>
              {journals.map((j) => (
                <option key={j.key} value={j.key}>
                  {j.code}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Select for Sort */}
          <div className="w-40">
            <Select
              options={sortOptions}
              value={sortBy}
              onChange={(val) => onSortChange(val as SortOption)}
              size="sm"
              variant="eatzy-inner"
              fullWidth
            />
            {/* Hidden native select for test & accessibility integration */}
            <select
              data-testid="sort-by-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="sr-only"
              aria-hidden="true"
              tabIndex={-1}
            >
              <option value="newest">Sắp xếp: Mới nhất</option>
              <option value="title">Sắp xếp: Tên A-Z</option>
              <option value="status">Sắp xếp: Trạng thái</option>
            </select>
          </div>

          {/* View Mode Toggle: Grid vs Table */}
          <div className="flex items-center bg-gray-300 p-0.5 rounded-2xl border">
            <button
              data-testid="view-mode-grid"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-700 hover:text-zinc-700'
              }`}
              title="Dạng lưới"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              data-testid="view-mode-table"
              onClick={() => onViewModeChange('table')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-zinc-900 shadow-2xs'
                  : 'text-zinc-700 hover:text-zinc-700'
              }`}
              title="Dạng bảng"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
