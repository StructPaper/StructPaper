'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Search, RefreshCw, AlertCircle, Database, Cloud } from 'lucide-react';
import {
  useListManuscripts,
  isMockModeEnabled,
  setMockMode,
  type Manuscript,
  type ListManuscriptsStatus,
} from '@structpaper/api-client';
import { useDeletePaper } from '../hooks/useDeletePaper';
import { ManuscriptTable } from './ManuscriptTable';
import { PaginationControls } from './PaginationControls';

export interface ServerManuscriptsViewProps {
  onOpenManuscript?: (id: string) => void;
  defaultPageSize?: number;
}

const STATUS_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'ALL', label: 'Tất cả' },
  { id: 'DRAFT', label: 'Bản nháp (Draft)' },
  { id: 'SUBMITTED', label: 'Đã nộp (Submitted)' },
  { id: 'UNDER_REVIEW', label: 'Đang phản biện (Review)' },
  { id: 'ACCEPTED', label: 'Chấp nhận (Accepted)' },
  { id: 'REJECTED', label: 'Từ chối (Rejected)' },
  { id: 'ARCHIVED', label: 'Lưu trữ (Archived)' },
];

export const ServerManuscriptsView: React.FC<ServerManuscriptsViewProps> = ({
  onOpenManuscript,
  defaultPageSize = 10,
}) => {
  const router = useRouter();

  // Pagination & filter state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [mockActive, setMockActive] = useState(() => isMockModeEnabled());

  const { deletePaper, isPending: isDeleting } = useDeletePaper();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Query params for TanStack Query
  const queryParams = useMemo(() => {
    return {
      page: currentPage,
      limit: pageSize,
      search: debouncedSearch || undefined,
      status: statusFilter === 'ALL' ? undefined : (statusFilter as ListManuscriptsStatus),
    };
  }, [currentPage, pageSize, debouncedSearch, statusFilter]);

  // TanStack Query hook from @structpaper/api-client
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useListManuscripts(queryParams, {
    query: {
      placeholderData: (prev) => prev,
    },
  });

  // Normalize data (support array or paginated response shape)
  const manuscripts: Manuscript[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray((data as any).items)) return (data as any).items;
    return [];
  }, [data]);

  const totalItems = useMemo(() => {
    if (!data) return 0;
    if (typeof (data as any).total === 'number') return (data as any).total;
    if (Array.isArray(data)) return data.length;
    if (Array.isArray((data as any).items)) return (data as any).items.length;
    return manuscripts.length;
  }, [data, manuscripts.length]);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  // Handlers
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleOpen = (id: string) => {
    if (onOpenManuscript) {
      onOpenManuscript(id);
    } else {
      router.push(`/editor?id=${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa bài báo này không? Thao tác này sẽ xóa trên cả máy chủ và máy bạn.')) {
      await deletePaper(id);
      refetch();
    }
  };

  const toggleMockMode = () => {
    const next = !mockActive;
    setMockMode(next);
    setMockActive(next);
    refetch();
  };

  return (
    <div data-testid="server-manuscripts-view" className="w-full space-y-4">
      {/* Top Controls: Search + Status Filter + Mock Mode Toggle */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            data-testid="manuscripts-search-input"
            type="text"
            placeholder="Tìm kiếm theo tiêu đề, tác giả..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        {/* Right side controls: Mock Mode Badge & Refresh Button */}
        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            type="button"
            data-testid="toggle-mock-mode-btn"
            onClick={toggleMockMode}
            title={mockActive ? 'Đang dùng dữ liệu Mock cục bộ' : 'Đang kết nối NestJS Backend'}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
              mockActive
                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            }`}
          >
            {mockActive ? <Database className="w-3.5 h-3.5" /> : <Cloud className="w-3.5 h-3.5" />}
            <span>{mockActive ? 'Mock Mode' : 'Live API'}</span>
          </button>

          <button
            type="button"
            aria-label="Làm mới"
            onClick={() => refetch()}
            className="p-2 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Status Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        {STATUS_FILTERS.map((f) => {
          const isActive = statusFilter === f.id;
          return (
            <button
              key={f.id}
              data-testid={`filter-${f.id}`}
              type="button"
              onClick={() => handleStatusChange(f.id)}
              className={`px-3 py-1.5 rounded-full font-medium whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white shadow-2xs font-semibold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Error notification if live API fails */}
      {isError && (
        <div
          data-testid="manuscripts-error-alert"
          className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3 text-xs text-rose-800 dark:text-rose-200"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
          <div className="flex-1 space-y-1">
            <div className="font-semibold">Không thể kết nối đến máy chủ backend</div>
            <div className="text-rose-600 dark:text-rose-300">
              {(error as any)?.message || 'Vui lòng kiểm tra kết nối mạng hoặc bật Mock Mode để tiếp tục phát triển.'}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMockMode}
            className="px-2.5 py-1 bg-rose-100 dark:bg-rose-900 hover:bg-rose-200 text-rose-800 dark:text-rose-100 rounded-md font-medium cursor-pointer"
          >
            Bật Mock Mode
          </button>
        </div>
      )}

      {/* Manuscripts Table */}
      <ManuscriptTable
        manuscripts={manuscripts}
        isLoading={isLoading || isDeleting}
        onOpen={handleOpen}
        onDelete={handleDelete}
      />

      {/* Pagination Controls */}
      <PaginationControls
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        pageSize={pageSize}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
      />
    </div>
  );
};
