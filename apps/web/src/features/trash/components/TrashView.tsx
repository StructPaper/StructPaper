'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trash2, Search, X, ArchiveRestore, Hourglass, Clock, User, LayoutGrid, List, Check, CheckCircle2, Eraser, Loader2 } from 'lucide-react';
import type { TrashedManuscript } from '@structpaper/api-client';
import { ActionConfirmModal } from '@/components/modals';
import { toast } from '@/components/toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select, type SelectOption } from '@/components/ui/Select';
import { StickyHubToolbar } from '@/components/layout/StickyHubToolbar';
import { PaperCardShimmer } from '@/features/papers/components/PaperCardShimmer';
import { PaperTableShimmer } from '@/features/papers/components/PaperTableShimmer';
import { formatRelativeTime } from '@/features/papers/components/types';
import { useAccess } from '@/lib/access';
import { useAuthStore } from '@/lib/auth-store';
import { useTrash, useTrashActions } from '../hooks/useTrash';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

type ViewMode = 'grid' | 'table';
type Scope = 'all' | 'soon' | 'mine' | 'others';
type Sort = 'recent' | 'expiring' | 'title';
type Action = 'restore' | 'purge';

/** A paper with this many days left or fewer is "about to disappear". */
const SOON_DAYS = 7;

/** Days left decide the colour: a paper close to being removed for good stands out. */
const urgency = (daysLeft: number): string => (daysLeft <= 3 ? 'text-rose-600' : daysLeft <= SOON_DAYS ? 'text-amber-600' : 'text-zinc-500');

const daysText = (daysLeft: number): string => (daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Sắp bị xóa');
const titleOf = (item: TrashedManuscript): string => item.title || 'Bản thảo không tên';
const dateOf = (iso: string): string => new Date(iso).toLocaleDateString('vi-VN');

const SORTS: SelectOption<Sort>[] = [
  { value: 'recent', label: 'Sắp xếp: Mới xóa nhất' },
  { value: 'expiring', label: 'Sắp xếp: Sắp hết hạn' },
  { value: 'title', label: 'Sắp xếp: Tên A-Z' },
];

const sortItems = (items: TrashedManuscript[], sort: Sort): TrashedManuscript[] => {
  const copy = [...items];
  if (sort === 'expiring') return copy.sort((a, b) => new Date(a.purgeAt).getTime() - new Date(b.purgeAt).getTime());
  if (sort === 'title') return copy.sort((a, b) => titleOf(a).localeCompare(titleOf(b), 'vi'));
  return copy.sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
};

// ---------------------------------------------------------------------------------------------------------------------

const Tick: React.FC<{ checked: boolean; onChange: () => void; label: string; testId: string }> = ({ checked, onChange, label, testId }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    data-testid={testId}
    onClick={(e) => {
      e.stopPropagation();
      onChange();
    }}
    className={`shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
      checked ? 'bg-[#78C841] border-[#78C841] text-zinc-950' : 'bg-white border-zinc-300 hover:border-[#78C841] text-transparent'
    }`}
  >
    <Check className="w-3.5 h-3.5" strokeWidth={3.5} />
  </button>
);

const JournalPill: React.FC<{ item: TrashedManuscript }> = ({ item }) =>
  item.journal ? (
    <span className="shrink-0 whitespace-nowrap px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white shadow-2xs" style={{ backgroundColor: item.journal.color }} title={item.journal.name}>
      {item.journal.code}
    </span>
  ) : (
    <span className="shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-zinc-300 text-zinc-700">—</span>
  );

const DaysChip: React.FC<{ item: TrashedManuscript }> = ({ item }) => (
  <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold ${urgency(item.daysLeft)}`} data-testid={`trash-days-${item.id}`}>
    <Hourglass className="w-3 h-3" />
    {daysText(item.daysLeft)}
  </span>
);

const BTN = 'inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

interface ItemProps {
  item: TrashedManuscript;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onRestore: () => void;
  restoring?: boolean;
  onPurge: () => void;
}

const INNER = { boxShadow: 'inset 0 0 14px rgba(0, 0, 0, 0.09)' };
const INNER_RED = { boxShadow: 'inset 0 0 14px rgba(225, 29, 72, 0.16)' };
const ICON_BTN = 'inline-flex items-center justify-center w-10 h-10 rounded-2xl border-2 border-white transition-all duration-200 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none';

const RowButtons: React.FC<ItemProps> = ({ item, disabled, restoring, onRestore, onPurge }) => (
  <>
    {item.access.canRestore && (
      <button type="button" onClick={onRestore} disabled={disabled} title="Khôi phục" aria-label="Khôi phục" data-testid={`restore-${item.id}`} style={INNER} className={`${ICON_BTN} bg-slate-50/60 hover:bg-white text-[#4a9a1f]`}>
        {restoring ? <Loader2 className="w-[18px] h-[18px] animate-spin" strokeWidth={2.2} /> : <ArchiveRestore className="w-[18px] h-[18px]" strokeWidth={2.2} />}
      </button>
    )}
    {item.access.canPurge && (
      <button type="button" onClick={onPurge} disabled={disabled} title="Xóa vĩnh viễn" aria-label="Xóa vĩnh viễn" data-testid={`purge-${item.id}`} style={INNER_RED} className={`${ICON_BTN} bg-rose-50/70 hover:bg-white text-rose-600`}>
        <Trash2 className="w-[18px] h-[18px]" strokeWidth={2.2} />
      </button>
    )}
  </>
);

const TrashCard: React.FC<ItemProps> = (props) => {
  const { item, selected, onSelect } = props;
  return (
    <motion.div
      layout={!isTest}
      initial={isTest ? false : { opacity: 0, y: 8 }}
      animate={isTest ? undefined : { opacity: 1, y: 0 }}
      whileHover={isTest ? undefined : { scale: 1.035, y: -3 }}
      whileTap={isTest ? undefined : { scale: 0.98 }}
      transition={isTest ? { duration: 0 } : { type: 'spring', stiffness: 320, damping: 17, mass: 0.7 }}
      data-testid={`trash-item-${item.id}`}
      onClick={props.onOpen}
      className={`w-full p-4 rounded-3xl transition-all duration-300 cursor-pointer flex flex-col justify-between group relative min-h-[178px] hover:bg-white hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] ${
        selected ? 'bg-white ring-2 ring-[#78C841]/70 shadow-md' : 'bg-gray-200/50'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Tick checked={selected} onChange={onSelect} label={`Chọn ${titleOf(item)}`} testId={`select-${item.id}`} />
            <JournalPill item={item} />
          </div>
          <DaysChip item={item} />
        </div>

        <h4 className="font-bold text-xs text-[#1A1A1A] line-clamp-2 mb-1.5 leading-snug" title={item.title}>
          {titleOf(item)}
        </h4>
        <p className="text-[11px] text-zinc-500 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />Xóa {formatRelativeTime(item.deletedAt)}</span>
          {item.deletedBy?.displayName && <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />bởi {item.deletedBy.displayName}</span>}
        </p>
        {item.owner?.displayName && item.owner.id !== item.deletedBy?.id && (
          <p className="text-[10.5px] text-zinc-400 font-semibold mt-1">chủ bài: {item.owner.displayName}</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <RowButtons {...props} />
      </div>
    </motion.div>
  );
};

const TrashTable: React.FC<{
  items: TrashedManuscript[];
  selected: Set<string>;
  allSelected: boolean;
  disabled: boolean;
  restoring: Set<string>;
  onToggleAll: () => void;
  onSelect: (id: string) => void;
  onOpen: (item: TrashedManuscript) => void;
  onRestore: (item: TrashedManuscript) => void;
  onPurge: (item: TrashedManuscript) => void;
}> = ({ items, selected, allSelected, disabled, restoring, onToggleAll, onSelect, onOpen, onRestore, onPurge }) => (
  <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse" data-testid="trash-table">
        <thead>
          <tr className="border-b border-slate-200/80 bg-gray-100 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
            <th className="py-3 px-3 w-10 text-center">
              <Tick checked={allSelected} onChange={onToggleAll} label="Chọn tất cả" testId="select-all-table" />
            </th>
            <th className="py-3 px-4 min-w-[240px]">Tên bài báo</th>
            <th className="py-3 px-4 min-w-[170px]">Tạp chí</th>
            <th className="py-3 px-4 min-w-[150px]">Người xóa</th>
            <th className="py-3 px-4 min-w-[120px]">Ngày xóa</th>
            <th className="py-3 px-4 min-w-[120px]">Còn lại</th>
            <th className="py-3 px-3 text-right whitespace-nowrap w-28">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
          {items.map((item) => (
            <tr key={item.id} data-testid={`trash-item-${item.id}`} onClick={() => onOpen(item)} className={`transition-colors cursor-pointer ${selected.has(item.id) ? 'bg-lime-50/70' : 'hover:bg-slate-50/80'}`}>
              <td className="py-3 px-3 text-center">
                <Tick checked={selected.has(item.id)} onChange={() => onSelect(item.id)} label={`Chọn ${titleOf(item)}`} testId={`select-${item.id}`} />
              </td>
              <td className="py-3 px-4">
                <div className="font-bold text-slate-900 line-clamp-1" title={item.title}>{titleOf(item)}</div>
                {item.owner?.displayName && item.owner.id !== item.deletedBy?.id && (
                  <div className="text-[10.5px] text-slate-400 font-semibold mt-0.5">chủ bài: {item.owner.displayName}</div>
                )}
              </td>
              <td className="py-3 px-4 whitespace-nowrap"><JournalPill item={item} /></td>
              <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">{item.deletedBy?.displayName ? `bởi ${item.deletedBy.displayName}` : '—'}</td>
              <td className="py-3 px-4 text-slate-500 text-[11px]" title={new Date(item.deletedAt).toLocaleString('vi-VN')}>
                <div className="flex items-center gap-1"><Clock className="w-3 h-3 text-slate-400" />{dateOf(item.deletedAt)}</div>
              </td>
              <td className="py-3 px-4 whitespace-nowrap"><DaysChip item={item} /></td>
              <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-nowrap items-center justify-end gap-1">
                  <RowButtons item={item} selected={selected.has(item.id)} disabled={disabled} restoring={restoring.has(item.id)} onSelect={() => onSelect(item.id)} onOpen={() => onOpen(item)} onRestore={() => onRestore(item)} onPurge={() => onPurge(item)} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// ---------------------------------------------------------------------------------------------------------------------

interface Confirm {
  action: Action;
  items: TrashedManuscript[];
  /** What the confirmation is about: one paper, the selection, everything shown ("empty the trash"). */
  scope: 'one' | 'selection' | 'all';
}

/**
 * The trash: deleted papers that can still be brought back. Everybody has one: it lists what they deleted themselves, and they
 * can restore or delete those for good. Journal managers also see the papers of their journals that others deleted and can
 * do the same with them. A paper stays here for the retention period (30 days by default) and is then deleted for good, with
 * its history. Laid out like the papers page: search and filters on top, cards or a table below, plus bulk actions.
 */
export const TrashView: React.FC = () => {
  const router = useRouter();
  const access = useAccess();
  const manager = access.can('trash:manage');
  const userId = useAuthStore((s) => s.user?.id);

  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<Scope>('all');
  const [journal, setJournal] = useState('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [view, setView] = useState<ViewMode>('grid');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [working, setWorking] = useState(false);
  const [restoring, setRestoring] = useState<Set<string>>(new Set());

  // the search runs a moment after typing stops
  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), isTest ? 0 : 300);
    return () => clearTimeout(t);
  }, [input]);

  const trash = useTrash(search);
  const { restore, purge, bulk } = useTrashActions();
  const all = trash.data?.items ?? [];

  const counts = useMemo(
    () => ({
      all: all.length,
      soon: all.filter((i) => i.daysLeft <= SOON_DAYS).length,
      mine: all.filter((i) => i.deletedBy?.id === userId).length,
      others: all.filter((i) => i.deletedBy?.id !== userId).length,
    }),
    [all, userId],
  );

  const journals = useMemo(() => {
    const seen = new Map<string, NonNullable<TrashedManuscript['journal']>>();
    for (const i of all) if (i.journal) seen.set(i.journal.id, i.journal);
    return [...seen.values()];
  }, [all]);
  const journalOptions: SelectOption<string>[] = [
    { value: 'all', label: 'Tất cả tạp chí' },
    ...journals.map((j) => ({ value: j.id, label: j.code, color: j.color })),
  ];

  const items = useMemo(() => {
    const filtered = all.filter((i) => {
      if (scope === 'soon' && i.daysLeft > SOON_DAYS) return false;
      if (scope === 'mine' && i.deletedBy?.id !== userId) return false;
      if (scope === 'others' && i.deletedBy?.id === userId) return false;
      if (journal !== 'all' && i.journal?.id !== journal) return false;
      return true;
    });
    return sortItems(filtered, sort);
  }, [all, scope, journal, sort, userId]);

  // a selection never keeps papers that are gone or filtered out
  const visibleIds = useMemo(() => new Set(items.map((i) => i.id)), [items]);
  const picked = items.filter((i) => selected.has(i.id));
  const allSelected = items.length > 0 && picked.length === items.length;
  const restorable = items.filter((i) => i.access.canRestore);
  const purgeable = items.filter((i) => i.access.canPurge);
  const filtering = Boolean(search || scope !== 'all' || journal !== 'all');

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => visibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));

  /** Runs an action; the confirm modal (only for deleting for good) stays open with a spinner until the server is done, and only then the toast shows. */
  const execute = async (c: Confirm) => {
    if (working) return;
    const { action, items: list } = c;
    setWorking(true);
    if (action === 'restore') setRestoring(new Set(list.map((i) => i.id)));
    try {
      if (c.scope === 'one') {
        if (action === 'restore') await restore.mutateAsync(list[0].id);
        else await purge.mutateAsync(list[0].id);
        if (action === 'restore') toast.success('Đã khôi phục bài báo', `"${list[0].title}" đã trở lại danh sách bài báo của chủ bài.`);
        else toast.success('Đã xóa vĩnh viễn', `"${list[0].title}" và toàn bộ lịch sử của nó đã bị xóa.`);
      } else {
        const res = await bulk.mutateAsync({ action, ids: list.map((i) => i.id) });
        const skipped = res.skipped > 0 ? ` ${res.skipped} bài không thuộc quyền của bạn nên được giữ nguyên.` : '';
        if (action === 'restore') toast.success(`Đã khôi phục ${res.done} bài báo`, `Các bài đã trở lại danh sách của chủ bài.${skipped}`);
        else toast.success(`Đã xóa vĩnh viễn ${res.done} bài báo`, `Các bài cùng toàn bộ lịch sử của chúng đã bị xóa.${skipped}`);
      }
      setSelected(new Set());
    } catch (err) {
      toast.error(action === 'restore' ? 'Không khôi phục được' : 'Không xóa được', (err as Error).message);
    } finally {
      setWorking(false);
      setRestoring(new Set());
      setConfirm(null);
    }
  };

  /** Restoring starts at once; deleting for good first asks. */
  const ask = (action: Action, list: TrashedManuscript[], scopeOf: Confirm['scope']) => {
    if (list.length === 0) return;
    const c: Confirm = { action, items: list, scope: scopeOf };
    if (action === 'restore') void execute(c);
    else setConfirm(c);
  };
  const run = () => {
    if (confirm) void execute(confirm);
  };

  const many = confirm ? confirm.scope !== 'one' : false;
  const first = confirm?.items[0];
  const purgeText = many
    ? <><b>{confirm!.items.length} bài báo</b> cùng toàn bộ lịch sử phiên bản, thành viên và chia sẻ sẽ bị xóa <b>vĩnh viễn</b>. Không thể hoàn tác.</>
    : <>Bài <b>{first?.title}</b> cùng toàn bộ lịch sử phiên bản, thành viên và chia sẻ sẽ bị xóa <b>vĩnh viễn</b>. Không thể hoàn tác.</>;

  const chips: Array<{ id: Scope; label: string }> = [
    { id: 'all', label: 'Tất cả' },
    { id: 'soon', label: `Sắp hết hạn (≤ ${SOON_DAYS} ngày)` },
    ...(manager ? [{ id: 'mine' as Scope, label: 'Tôi xóa' }, { id: 'others' as Scope, label: 'Người khác xóa' }] : []),
  ];

  const shown = (
    <span data-testid="trash-count" className="text-xs font-bold text-zinc-500">
      {items.length} bài báo{filtering && all.length !== items.length ? ` (trên tổng ${all.length})` : ''}
    </span>
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-16 pt-4 px-4 sm:px-6" data-testid="trash-view">
      <div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <Trash2 className="w-6 h-6 text-[#78C841]" strokeWidth={2.8} />
          <span>Thùng rác</span>
        </h1>
      </div>

      <StickyHubToolbar data-testid="trash-toolbar">
        <div className="space-y-3">
          <div className="w-full flex flex-wrap items-center gap-2.5">
            <div className="flex-1 min-w-[260px] max-w-xl relative group">
              <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-3 z-10 pointer-events-none">
                <Search className="w-5 h-5 text-gray-400 group-hover:text-zinc-600 group-focus-within:text-[#78C841] transition-colors" />
                <div className="w-px h-4 bg-gray-200 group-hover:bg-zinc-300 transition-colors" />
              </div>
              <input
                type="text"
                role="searchbox"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Tìm bài báo trong thùng rác theo tiêu đề..."
                data-testid="trash-search"
                style={{ boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.09)' }}
                className="w-full bg-slate-50/40 backdrop-blur-sm border-2 border-white focus:border-[#78C841]/20 rounded-3xl py-3.5 sm:py-4 pl-14 pr-12 text-sm sm:text-base font-bold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#78C841]/5 transition-all shadow-eatzy-inner hover:shadow-eatzy-inner-hover"
              />
              {input && (
                <button type="button" onClick={() => setInput('')} aria-label="Xóa tìm kiếm" className="absolute right-3.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl bg-zinc-200 hover:bg-zinc-300 flex items-center justify-center transition-all cursor-pointer">
                  <X className="w-4 h-4 text-zinc-600" />
                </button>
              )}
            </div>

            {all.length > 0 && (
              <div className="ml-auto flex items-center gap-2 flex-wrap">
                {restorable.length > 0 && (
                  <button
                    type="button"
                    onClick={() => ask('restore', restorable, 'all')}
                    disabled={working}
                    data-testid="restore-all"
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-3xl text-xs font-extrabold bg-slate-50/60 border-2 border-white text-zinc-700 hover:text-zinc-950 hover:bg-white shadow-eatzy-inner transition-all cursor-pointer whitespace-nowrap"
                  >
                    <ArchiveRestore className="w-4 h-4" />
                    <span>{filtering ? `Khôi phục ${restorable.length} bài đang lọc` : 'Khôi phục tất cả'}</span>
                  </button>
                )}
                {purgeable.length > 0 && (
                  <button
                    type="button"
                    onClick={() => ask('purge', purgeable, 'all')}
                    data-testid="empty-trash"
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-3xl text-xs font-extrabold bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border-2 border-white transition-all cursor-pointer whitespace-nowrap"
                  >
                    <Eraser className="w-4 h-4" />
                    <span>{filtering ? `Xóa vĩnh viễn ${purgeable.length} bài đang lọc` : 'Dọn sạch thùng rác'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {chips.map((chip) => {
                const active = scope === chip.id;
                return (
                  <button
                    key={chip.id}
                    type="button"
                    data-testid={`trash-chip-${chip.id}`}
                    aria-pressed={active}
                    onClick={() => setScope(chip.id)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      active ? 'bg-[#1A1A1A] text-white shadow-md shadow-black/10' : 'bg-gray-200 text-zinc-600 hover:text-zinc-900 hover:bg-gray-200/70'
                    }`}
                  >
                    {chip.label} <span className={active ? 'opacity-70' : 'text-zinc-400'}>{counts[chip.id]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="w-44">
                <Select options={journalOptions} value={journal} onChange={(v) => setJournal(String(v))} size="sm" variant="eatzy-inner" fullWidth />
                <select data-testid="trash-journal-select" value={journal} onChange={(e) => setJournal(e.target.value)} className="sr-only" aria-hidden="true" tabIndex={-1}>
                  <option value="all">Tất cả tạp chí</option>
                  {journals.map((j) => <option key={j.id} value={j.id}>{j.code}</option>)}
                </select>
              </div>
              <div className="w-48">
                <Select options={SORTS} value={sort} onChange={(v) => setSort(v as Sort)} size="sm" variant="eatzy-inner" fullWidth />
                <select data-testid="trash-sort-select" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="sr-only" aria-hidden="true" tabIndex={-1}>
                  {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex items-center bg-gray-300 p-0.5 rounded-2xl border">
                {([['grid', LayoutGrid, 'Dạng lưới'], ['table', List, 'Dạng bảng']] as const).map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    data-testid={`trash-view-${mode}`}
                    aria-pressed={view === mode}
                    onClick={() => setView(mode)}
                    title={label}
                    className={`p-1.5 rounded-xl transition-all cursor-pointer ${view === mode ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-700 hover:text-zinc-700'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </StickyHubToolbar>

      {!trash.isLoading && !trash.isError && items.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 min-h-9" data-testid="trash-selection-bar">
          {picked.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 bg-[#1A1A1A] text-white rounded-full pl-4 pr-1.5 py-1.5">
              <span className="text-xs font-bold" data-testid="trash-selected-count">Đã chọn {picked.length} bài</span>
              {picked.some((i) => i.access.canRestore) && (
                <button type="button" data-testid="restore-selected" disabled={working} onClick={() => ask('restore', picked.filter((i) => i.access.canRestore), 'selection')} className={`${BTN} bg-[#78C841] text-zinc-950 hover:bg-[#6cb43a]`}>
                  <ArchiveRestore className="w-3.5 h-3.5" /><span>Khôi phục</span>
                </button>
              )}
              {picked.some((i) => i.access.canPurge) && (
                <button type="button" data-testid="purge-selected" onClick={() => ask('purge', picked.filter((i) => i.access.canPurge), 'selection')} className={`${BTN} bg-white/10 text-rose-300 hover:bg-rose-500 hover:text-white`}>
                  <Trash2 className="w-3.5 h-3.5" /><span>Xóa vĩnh viễn</span>
                </button>
              )}
              <button type="button" data-testid="clear-selection" onClick={() => setSelected(new Set())} className={`${BTN} bg-white/10 hover:bg-white/20 text-white`}>
                <X className="w-3.5 h-3.5" /><span>Bỏ chọn</span>
              </button>
            </div>
          ) : (
            <button type="button" data-testid="select-all" onClick={toggleAll} className="inline-flex items-center gap-2 text-xs font-bold text-zinc-600 hover:text-zinc-900 cursor-pointer">
              <Tick checked={allSelected} onChange={toggleAll} label="Chọn tất cả" testId="select-all-box" />
              Chọn tất cả
            </button>
          )}
          {shown}
        </div>
      )}

      {trash.isLoading ? (
        view === 'grid' ? (
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" aria-busy="true" data-testid="trash-list-loading">
            <PaperCardShimmer cardCount={8} />
          </div>
        ) : (
          <div aria-busy="true" data-testid="trash-list-loading">
            <PaperTableShimmer rowCount={8} />
          </div>
        )
      ) : trash.isError ? (
        <p className="text-sm font-bold text-rose-600" data-testid="trash-error">Không tải được thùng rác. Vui lòng thử lại.</p>
      ) : items.length === 0 ? (
        <div className="pt-10">
          <EmptyState
            icon={Trash2}
            testId="trash-empty"
            title={filtering ? 'Không tìm thấy bài báo nào' : 'Thùng rác trống'}
            description={filtering ? 'Thử một từ khóa hoặc bộ lọc khác.' : 'Bài báo bạn xóa sẽ nằm ở đây để khôi phục khi cần.'}
          />
        </div>
      ) : view === 'grid' ? (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="trash-list">
          {items.map((item) => (
            <TrashCard
              key={item.id}
              item={item}
              selected={selected.has(item.id)}
              disabled={working}
              restoring={restoring.has(item.id)}
              onSelect={() => toggle(item.id)}
              onOpen={() => router.push(`/trash/${item.id}`)}
              onRestore={() => ask('restore', [item], 'one')}
              onPurge={() => ask('purge', [item], 'one')}
            />
          ))}
        </div>
      ) : (
        <div data-testid="trash-list">
          <TrashTable
            items={items}
            selected={selected}
            allSelected={allSelected}
            disabled={working}
            restoring={restoring}
            onToggleAll={toggleAll}
            onSelect={toggle}
            onOpen={(i) => router.push(`/trash/${i.id}`)}
            onRestore={(i) => ask('restore', [i], 'one')}
            onPurge={(i) => ask('purge', [i], 'one')}
          />
        </div>
      )}

      {!trash.isLoading && items.length > 0 && (
        <div className="py-8 flex items-center justify-center gap-4 opacity-50 select-none">
          <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
          <div className="flex flex-col items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-zinc-500" />
            <span className="text-[12px] font-bold text-zinc-500 uppercase tracking-wider">Bạn đã xem hết thùng rác</span>
          </div>
          <div className="h-[1px] bg-gradient-to-r from-transparent via-zinc-300 to-transparent w-24" />
        </div>
      )}

      <ActionConfirmModal
        isOpen={confirm?.action === 'purge'}
        onClose={() => !working && setConfirm(null)}
        onConfirm={run}
        variant="danger"
        title={confirm?.scope === 'all' && many ? 'Dọn sạch thùng rác?' : many ? `Xóa vĩnh viễn ${confirm!.items.length} bài báo?` : 'Xóa vĩnh viễn bài báo này?'}
        description={purgeText}
        cancelLabel="Hủy bỏ"
        confirmLabel="Xóa vĩnh viễn"
        confirmIcon={<Trash2 className="w-4 h-4" />}
        isLoading={working}
        testId="purge-trash-modal"
        confirmTestId="confirm-purge-trash-btn"
      />
    </div>
  );
};
