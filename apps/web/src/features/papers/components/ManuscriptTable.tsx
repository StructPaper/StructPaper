'use client';

import React from 'react';
import type { Manuscript } from '@structpaper/api-client';
import { FileText, ExternalLink, Trash2, Clock, GitBranch } from 'lucide-react';

export interface ManuscriptTableProps {
  manuscripts?: Manuscript[];
  isLoading?: boolean;
  onOpen?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  DRAFT: {
    label: 'DRAFT',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800',
  },
  SUBMITTED: {
    label: 'SUBMITTED',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800',
  },
  UNDER_REVIEW: {
    label: 'UNDER_REVIEW',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800',
  },
  ACCEPTED: {
    label: 'ACCEPTED',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800',
  },
  REJECTED: {
    label: 'REJECTED',
    bg: 'bg-rose-50 dark:bg-rose-950/40',
    text: 'text-rose-700 dark:text-rose-300',
    border: 'border-rose-200 dark:border-rose-800',
  },
  ARCHIVED: {
    label: 'ARCHIVED',
    bg: 'bg-zinc-100 dark:bg-zinc-800',
    text: 'text-zinc-600 dark:text-zinc-400',
    border: 'border-zinc-200 dark:border-zinc-700',
  },
};

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export const ManuscriptTable: React.FC<ManuscriptTableProps> = ({
  manuscripts = [],
  isLoading = false,
  onOpen,
  onDelete,
}) => {
  if (isLoading) {
    return (
      <div
        data-testid="manuscript-table-shimmer"
        className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs"
      >
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800 animate-pulse">
          <div className="h-11 bg-zinc-50 dark:bg-zinc-800/60" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded-md w-3/5" />
                <div className="h-3 bg-zinc-100 dark:bg-zinc-800 rounded-md w-2/5" />
              </div>
              <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded-md w-20" />
              <div className="h-6 bg-zinc-200 dark:bg-zinc-700 rounded-md w-16" />
              <div className="h-7 bg-zinc-200 dark:bg-zinc-700 rounded-md w-14" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (manuscripts.length === 0) {
    return (
      <div
        data-testid="manuscript-table-empty"
        className="w-full py-16 px-4 flex flex-col items-center justify-center text-center bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xs"
      >
        <div className="w-12 h-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-3">
          <FileText className="w-6 h-6 text-zinc-400" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          Không có bài báo nào
        </h3>
        <p className="text-xs text-zinc-500 max-w-sm">
          Chưa tìm thấy bài báo khoa học nào phù hợp với bộ lọc tìm kiếm hiện tại.
        </p>
      </div>
    );
  }

  return (
    <div
      data-testid="manuscript-table"
      className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs"
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/50 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
              <th scope="col" className="py-3 px-4">Bài báo</th>
              <th scope="col" className="py-3 px-3">Tạp chí</th>
              <th scope="col" className="py-3 px-3">Phiên bản / Rev</th>
              <th scope="col" className="py-3 px-3">Trạng thái</th>
              <th scope="col" className="py-3 px-3">Cập nhật</th>
              <th scope="col" className="py-3 px-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
            {manuscripts.map((paper) => {
              const badge = STATUS_BADGES[paper.status] || STATUS_BADGES.DRAFT;
              return (
                <tr
                  key={paper.id}
                  data-testid={`manuscript-row-${paper.id}`}
                  className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                  onClick={() => onOpen?.(paper.id)}
                >
                  {/* Title & Abstract */}
                  <td className="py-3.5 px-4 max-w-md">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 transition-colors line-clamp-1">
                      {paper.title || 'Untitled Manuscript'}
                    </div>
                    {paper.abstract && (
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
                        {paper.abstract}
                      </div>
                    )}
                  </td>

                  {/* Journal */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                      {paper.journalId || 'Default'}
                    </span>
                  </td>

                  {/* Version / Server Revision */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                        v{paper.version ?? 1}
                      </span>
                      <span className="flex items-center gap-0.5 text-zinc-500">
                        <GitBranch className="w-3 h-3 text-zinc-400" />
                        Rev {paper.currentServerRev ?? 0}
                      </span>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-3 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {paper.status}
                    </span>
                  </td>

                  {/* Updated At */}
                  <td className="py-3.5 px-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400 text-[11px]">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-zinc-400" />
                      {formatDate(paper.updatedAt || paper.createdAt)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        aria-label="Mở"
                        onClick={() => onOpen?.(paper.id)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Mở</span>
                      </button>
                      {onDelete && (
                        <button
                          type="button"
                          aria-label="Xoá"
                          onClick={() => onDelete(paper.id)}
                          className="p-1 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
