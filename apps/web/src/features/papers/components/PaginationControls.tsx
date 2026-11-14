'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) => {
  const safeTotalPages = Math.max(totalPages, 1);
  const isFirstPage = currentPage <= 1;
  const isLastPage = currentPage >= safeTotalPages;

  // Compute page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (safeTotalPages <= 7) {
      for (let i = 1; i <= safeTotalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('...');
        pages.push(safeTotalPages);
      } else if (currentPage >= safeTotalPages - 3) {
        pages.push(1);
        pages.push('...');
        for (let i = safeTotalPages - 4; i <= safeTotalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(safeTotalPages);
      }
    }
    return pages;
  };

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      data-testid="pagination-controls"
      className="flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs text-xs text-zinc-600 dark:text-zinc-400"
    >
      {/* Total items info */}
      <div className="flex items-center gap-2" data-testid="pagination-info">
        <span>
          Hiển thị <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{startItem}-{endItem}</strong> trên{' '}
          <strong className="font-semibold text-zinc-900 dark:text-zinc-100">{totalItems}</strong> bài báo
        </span>
        <span className="text-zinc-300 dark:text-zinc-700">|</span>
        <div className="flex items-center gap-1.5">
          <span>Kích thước trang:</span>
          <select
            aria-label="Kích thước trang"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>

      {/* Page navigation buttons */}
      <div className="flex items-center gap-1">
        {/* Previous page button */}
        <button
          type="button"
          aria-label="Trang trước"
          disabled={isFirstPage}
          onClick={() => !isFirstPage && onPageChange(currentPage - 1)}
          className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-all ${
            isFirstPage
              ? 'opacity-40 cursor-not-allowed text-zinc-400 dark:text-zinc-600'
              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer active:scale-95'
          }`}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Trước</span>
        </button>

        {/* Page buttons */}
        <div className="flex items-center gap-1">
          {getPageNumbers().map((p, idx) => {
            if (p === '...') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-zinc-400 dark:text-zinc-600 select-none"
                >
                  ...
                </span>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <button
                key={`page-${p}`}
                type="button"
                aria-label={String(p)}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => onPageChange(p as number)}
                className={`min-w-[28px] h-7 px-2 rounded-lg text-xs font-semibold transition-all ${
                  isCurrent
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer'
                }`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next page button */}
        <button
          type="button"
          aria-label="Trang sau"
          disabled={isLastPage}
          onClick={() => !isLastPage && onPageChange(currentPage + 1)}
          className={`px-2.5 py-1.5 rounded-lg flex items-center gap-1 font-medium transition-all ${
            isLastPage
              ? 'opacity-40 cursor-not-allowed text-zinc-400 dark:text-zinc-600'
              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 cursor-pointer active:scale-95'
          }`}
        >
          <span>Sau</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
