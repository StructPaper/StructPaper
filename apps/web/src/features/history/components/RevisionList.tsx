'use client';

import React, { useMemo, useState } from 'react';
import { Clock, Bookmark, ShieldCheck, RotateCcw, Layers, FileUp, ChevronRight, Loader2, Pin, Sparkles } from 'lucide-react';
import type { RevisionSummary } from '@structpaper/api-client';
import { Shimmer } from '@/components/ui/Shimmer';
import { groupRevisions, revisionTitle, statChips, timeLabel, type HistoryRow } from '../lib/group-revisions';
import type { RevisionFilter } from '../hooks/useRevisions';

export const CURRENT = 'current';

const KIND_ICON: Record<string, React.ReactNode> = {
  auto: <Clock className="w-4 h-4" />,
  named: <Bookmark className="w-4 h-4" />,
  'pre-risk': <ShieldCheck className="w-4 h-4" />,
  'profile-upgrade': <Layers className="w-4 h-4" />,
  restore: <RotateCcw className="w-4 h-4" />,
  import: <FileUp className="w-4 h-4" />,
};

const FILTERS: { key: RevisionFilter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'named', label: 'Có tên' },
  { key: 'auto', label: 'Tự động' },
  { key: 'pre-risk', label: 'Trước thao tác rủi ro' },
  { key: 'restore', label: 'Khôi phục' },
];

const matches = (filter: RevisionFilter, r: RevisionSummary) =>
  filter === 'all' ? true : filter === 'pre-risk' ? r.kind === 'pre-risk' || r.kind === 'profile-upgrade' : r.kind === filter;

const TONE: Record<string, string> = {
  add: 'bg-emerald-100 text-emerald-800',
  del: 'bg-rose-100 text-rose-800',
  mod: 'bg-amber-100 text-amber-800',
  neutral: 'bg-white text-zinc-600',
};

interface RevisionListProps {
  revisions: RevisionSummary[];
  filter: RevisionFilter;
  onFilter: (f: RevisionFilter) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  isLoading: boolean;
  hasMore: boolean;
  isFetchingMore: boolean;
  onLoadMore: () => void;
  /** The paper as it is now, always the first line. */
  current: { updatedAt?: string; title?: string } | null;
  isError?: boolean;
}

const ItemRow: React.FC<{ revision: RevisionSummary; selected: boolean; onSelect: () => void; nested?: boolean }> = ({ revision, selected, onSelect, nested }) => {
  const chips = statChips(revision.stats);
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`revision-${revision.id}`}
      data-kind={revision.kind}
      aria-current={selected}
      className={`w-full text-left rounded-3xl transition-all duration-200 cursor-pointer active:scale-[0.99] ${nested ? 'px-3 py-2' : 'p-3'} ${
        selected ? 'bg-[#D9F99D]/55 ring-2 ring-[#78C841]/40' : 'bg-gray-200/50 hover:bg-gray-200/90'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${revision.kind === 'named' ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-600'}`}>{KIND_ICON[revision.kind]}</span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-zinc-900 truncate flex items-center gap-1">
            {revisionTitle(revision)}
            {revision.pinned && <Pin className="w-3 h-3 shrink-0 text-zinc-500" aria-label="Được giữ lại" />}
          </p>
          <p className="text-[11px] text-zinc-500 truncate">
            {timeLabel(revision.createdAt)}
            {revision.author?.displayName ? ` · ${revision.author.displayName}` : ''}
          </p>
        </div>
      </div>
      {revision.description && <p className="mt-1.5 text-[11px] text-zinc-600 line-clamp-2">{revision.description}</p>}
      {chips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {chips.slice(0, 4).map((c) => (
            <span key={c.text} className={`px-1.5 py-px rounded-full text-[10px] font-bold ${TONE[c.tone]}`}>{c.text}</span>
          ))}
        </div>
      )}
    </button>
  );
};

const Row: React.FC<{ row: HistoryRow; selectedId: string; onSelect: (id: string) => void }> = ({ row, selectedId, onSelect }) => {
  const [open, setOpen] = useState(false);
  if (row.type === 'item') return <ItemRow revision={row.revision} selected={selectedId === row.revision.id} onSelect={() => onSelect(row.revision.id)} />;
  const containsSelected = row.revisions.some((r) => r.id === selectedId);
  const expanded = open || containsSelected;
  return (
    <div className="rounded-3xl bg-gray-200/50" data-testid={`session-${row.id}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={expanded} className="w-full flex items-center gap-2 p-3 cursor-pointer text-left active:scale-[0.99] transition-transform">
        <span className="shrink-0 w-7 h-7 rounded-full bg-white text-zinc-600 flex items-center justify-center"><Clock className="w-4 h-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold text-zinc-900">{timeLabel(row.from)} – {timeLabel(row.to)}</p>
          <p className="text-[11px] text-zinc-500">{row.revisions.length} phiên bản tự động trong một lần làm việc</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-zinc-500 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-2 pb-2 space-y-1.5">
          {row.revisions.map((r) => (
            <ItemRow key={r.id} revision={r} selected={selectedId === r.id} onSelect={() => onSelect(r.id)} nested />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * The versions of a paper, the way Google Docs lists them: the current one first, then by day, with the automatic versions
 * of one working session folded together, and chips to show only the named ones, the automatic ones and so on.
 */
export const RevisionList: React.FC<RevisionListProps> = ({ revisions, filter, onFilter, selectedId, onSelect, isLoading, hasMore, isFetchingMore, onLoadMore, current, isError }) => {
  const groups = useMemo(() => groupRevisions(revisions.filter((r) => matches(filter, r))), [revisions, filter]);

  return (
    <div className="flex flex-col h-full min-h-0" data-testid="revision-list">
      <div className="flex flex-wrap gap-1.5 pb-3 shrink-0">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => onFilter(f.key)}
            data-testid={`filter-${f.key}`}
            aria-pressed={filter === f.key}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-200 cursor-pointer active:scale-95 ${
              filter === f.key ? 'bg-[#1A1A1A] text-white shadow-md shadow-black/10' : 'bg-gray-200 text-zinc-600 hover:text-zinc-900 hover:bg-gray-200/70'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* padded (and pulled back by the same amount) so the ring of a selected card is not cut by the scroll box */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 -mx-1.5 px-1.5 -my-1 py-1 pb-2">
        <button
          type="button"
          onClick={() => onSelect(CURRENT)}
          data-testid="revision-current"
          aria-current={selectedId === CURRENT}
          className={`w-full text-left rounded-3xl p-3 transition-all duration-200 cursor-pointer active:scale-[0.99] ${selectedId === CURRENT ? 'bg-[#D9F99D]/55 ring-2 ring-[#78C841]/40' : 'bg-gray-200/50 hover:bg-gray-200/90'}`}
        >
          <div className="flex items-center gap-2">
            <span className="shrink-0 w-7 h-7 rounded-full bg-[#78C841] text-zinc-950 flex items-center justify-center"><Sparkles className="w-4 h-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-zinc-900">Phiên bản hiện tại</p>
              <p className="text-[11px] text-zinc-500 truncate">{current?.updatedAt ? `Cập nhật ${new Date(current.updatedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' })}` : 'Bản đang soạn'}</p>
            </div>
          </div>
        </button>

        {isLoading && (
          <div className="space-y-2" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-3xl bg-gray-200/50 p-3 flex items-center gap-2">
                <Shimmer className="w-7 h-7 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Shimmer className="h-3 w-1/2 rounded-md" />
                  <Shimmer className="h-2.5 w-1/3 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        )}
        {isError && <p className="text-xs font-bold text-rose-600 px-1">Không tải được lịch sử phiên bản.</p>}
        {!isLoading && !isError && groups.length === 0 && (
          <p className="text-xs font-bold text-zinc-500 bg-gray-200/50 rounded-3xl px-4 py-5 text-center" data-testid="revision-empty">
            {revisions.length === 0 ? 'Chưa có phiên bản nào. Phiên bản được tạo khi bạn ngừng sửa một lúc, hoặc khi bạn bấm “Lưu phiên bản”.' : 'Không có phiên bản nào thuộc loại này.'}
          </p>
        )}

        {groups.map((g) => (
          <section key={g.key} className="space-y-1.5" data-testid={`day-${g.key}`}>
            <h3 className="px-2 text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">{g.label}</h3>
            {g.rows.map((row) => (
              <Row key={row.type === 'item' ? row.revision.id : row.id} row={row} selectedId={selectedId} onSelect={onSelect} />
            ))}
          </section>
        ))}

        {hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            disabled={isFetchingMore}
            data-testid="revisions-load-more"
            className="w-full py-2.5 rounded-full bg-gray-200/70 hover:bg-gray-200 text-xs font-bold text-zinc-700 transition-all cursor-pointer active:scale-95 disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
          >
            {isFetchingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Xem thêm phiên bản cũ hơn
          </button>
        )}
      </div>
    </div>
  );
};
