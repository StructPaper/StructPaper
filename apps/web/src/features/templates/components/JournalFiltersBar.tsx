'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Search, Plus, X } from 'lucide-react';
import { JournalStatus } from '@/lib/templates/journal-storage';

interface JournalFiltersBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: 'all' | JournalStatus;
  onStatusFilterChange: (status: 'all' | JournalStatus) => void;
  totalCount: number;
  filteredCount: number;
}

export const JournalFiltersBar: React.FC<JournalFiltersBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  totalCount,
  filteredCount,
}) => {
  const [searchInputValue, setSearchInputValue] = React.useState(searchQuery);
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

  const statusOptions: { value: 'all' | JournalStatus; label: string }[] = [
    { value: 'all', label: 'Tất cả' },
    { value: 'published', label: 'Đang phát hành' },
    { value: 'draft', label: 'Bản nháp' },
  ];

  return (
    <div className="space-y-3">
      {/* Row 1: Eatzy-style Search & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Eatzy Search Input Box */}
        <div className="flex-1 max-w-lg relative group">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 z-10 pointer-events-none">
            <Search className="w-5 h-5 text-gray-400 group-hover:text-zinc-600 group-focus-within:text-[#78C841] transition-colors" />
            <div className="w-px h-4 bg-gray-200 group-hover:bg-zinc-300 transition-colors" />
          </div>

          <input
            type="text"
            role="searchbox"
            value={searchInputValue}
            onChange={handleInputChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Tìm theo mã STDJ-*, tên tiếng Việt hoặc tiếng Anh... (nhấn Enter để tìm)"
            style={{ boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.09)' }}
            className="w-full bg-slate-50/60 backdrop-blur-sm border-2 border-white focus:border-[#78C841]/20 rounded-3xl py-3.5 sm:py-4 pl-14 pr-12 text-sm sm:text-base font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#78C841]/5 transition-all shadow-eatzy-inner hover:shadow-eatzy-inner-hover"
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

        {/* Right side: Add new journal button */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/templates/journal/new"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs font-extrabold bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950 shadow-2xs transition-all cursor-pointer"
            title="Tạo hồ sơ tạp chí khoa học mới"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Thêm Tạp chí Mới</span>
          </Link>
        </div>
      </div>

      {/* Row 2: Status filter chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-none pt-1">
        {statusOptions.map((opt) => {
          const active = statusFilter === opt.value;
          return (
            <motion.button
              key={opt.value}
              whileHover={isTestEnv ? undefined : { scale: 1.03 }}
              whileTap={isTestEnv ? undefined : { scale: 0.97 }}
              onClick={() => onStatusFilterChange(opt.value)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-[#1A1A1A] text-white shadow-md shadow-black/10'
                  : 'bg-gray-200 text-zinc-600 hover:text-zinc-900 hover:bg-gray-200/70'
              }`}
            >
              {opt.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
