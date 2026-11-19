'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layers, Plus, Archive, ArchiveRestore, ArrowUp, ArrowDown, Save, Loader2, X } from 'lucide-react';
import type { ArticleType } from '@structpaper/api-client';
import type { JournalProfile } from '@structpaper/journal-profiles';
import {
  useArticleTypes,
  useArticleTypeActions,
  useArticleTypeRules,
  useSetAbstractRequired,
  needsAbstract,
} from '@/features/journals';
import { Shimmer } from '@/components/ui/Shimmer';
import { toast } from '@/components/toast';

interface JournalArticleTypesTabProps {
  profile: JournalProfile;
  /** "hs": the key the journal is addressed by. */
  journalKey: string;
  /** The journal does not exist on the server yet: its article types start with the default ones. */
  isNew?: boolean;
  canEdit?: boolean;
}

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

/** White fields on the grey cards: no borders, rounded, a green ring on focus. */
const INPUT =
  'w-full bg-white rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none ring-2 ring-transparent focus:ring-[#78C841]/40 transition-all disabled:bg-white/50 disabled:text-zinc-500';
const CODE_PATTERN = /^[a-z][a-z0-9-]{1,49}$/;

const SOFT_BTN =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-white hover:bg-zinc-900 hover:text-white text-zinc-700 text-[11px] font-bold transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none';

const TypeRowShimmer: React.FC = () => (
  <div className="flex items-center gap-3 p-3.5 rounded-3xl bg-gray-200/50">
    <Shimmer className="h-6 w-16 rounded-xl" />
    <Shimmer className="h-9 flex-1 rounded-2xl" />
    <Shimmer className="h-9 flex-1 rounded-2xl" />
  </div>
);

/** One article type: its names, its place in the list, whether it is offered, and whether papers of it need an abstract. */
const TypeRow: React.FC<{
  type: ArticleType;
  journalKey: string;
  canEdit: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onSetStatus: (status: 'active' | 'archived') => void;
  onRename: (labels: { vi: string; en: string }) => void;
  /** Something is being saved anywhere in the list (buttons wait for it). */
  busy: boolean;
  /** The save in flight is about this row (its button spins). */
  working: 'status' | 'move' | 'rename' | null;
}> = ({ type, journalKey, canEdit, isFirst, isLast, onMove, onSetStatus, onRename, busy, working }) => {
  const [vi, setVi] = useState(type.labels.vi);
  const [en, setEn] = useState(type.labels.en);
  const archived = type.status === 'archived';
  const changed = vi.trim() !== type.labels.vi || en.trim() !== type.labels.en;

  const rules = useArticleTypeRules(journalKey, type.code, canEdit && !archived);
  const setAbstract = useSetAbstractRequired(journalKey, type.code);
  const abstractRequired = needsAbstract(rules.data?.config);

  return (
    <motion.li
      layout={!isTest}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className={`p-3.5 rounded-3xl bg-gray-200/50 space-y-2.5 transition-opacity duration-300 ${archived ? 'opacity-60' : 'opacity-100'}`}
      data-testid={`article-type-${type.code}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 px-2.5 py-1 rounded-xl bg-zinc-900 text-white text-[11px] font-extrabold">{type.code}</span>
        {archived && <span className="px-2.5 py-0.5 rounded-full bg-white text-zinc-600 text-[10.5px] font-bold">Đã lưu trữ</span>}
        <div className="flex-1" />
        {canEdit && (
          <div className="flex items-center gap-1.5">
            <button type="button" aria-label="Đưa lên" disabled={busy || isFirst} onClick={() => onMove(-1)} className={`${SOFT_BTN} w-8 h-8`}>
              {working === 'move' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className="w-3.5 h-3.5" />}
            </button>
            <button type="button" aria-label="Đưa xuống" disabled={busy || isLast} onClick={() => onMove(1)} className={`${SOFT_BTN} w-8 h-8`}>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSetStatus(archived ? 'active' : 'archived')}
              data-testid={`toggle-archive-${type.code}`}
              className={`${SOFT_BTN} px-3.5 h-8 min-w-[104px]`}
            >
              {working === 'status' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : archived ? (
                <ArchiveRestore className="w-3.5 h-3.5" />
              ) : (
                <Archive className="w-3.5 h-3.5" />
              )}
              <span>{working === 'status' ? 'Đang lưu...' : archived ? 'Dùng lại' : 'Lưu trữ'}</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[11px] font-bold text-zinc-600 mb-1 px-1">Tên tiếng Việt</span>
          <input className={INPUT} value={vi} disabled={!canEdit} onChange={(e) => setVi(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-zinc-600 mb-1 px-1">Tên tiếng Anh</span>
          <input className={INPUT} value={en} disabled={!canEdit} onChange={(e) => setEn(e.target.value)} />
        </label>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          {!archived && rules.data && (
            <label className="inline-flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer">
              <input
                type="checkbox"
                checked={abstractRequired}
                disabled={setAbstract.isPending}
                className="accent-[#78C841] w-4 h-4"
                onChange={(e) =>
                  setAbstract.mutate(
                    { current: rules.data!.config, required: e.target.checked },
                    {
                      onSuccess: () => toast.success('Đã lưu quy tắc', `Loại bài "${type.code}": phiên bản mới đã được xuất bản.`),
                      onError: (err) => toast.error('Không lưu được quy tắc', err.message),
                    },
                  )
                }
              />
              <span>Bài loại này phải có tóm tắt</span>
              {setAbstract.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500" />}
            </label>
          )}
          <div className="flex-1" />
          <button
            type="button"
            disabled={!changed || !vi.trim() || !en.trim() || busy}
            onClick={() => onRename({ vi: vi.trim(), en: en.trim() })}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#78C841] hover:bg-[#6cb43a] text-[11px] font-extrabold text-zinc-950 shadow-2xs transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {working === 'rename' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {working === 'rename' ? 'Đang lưu...' : 'Lưu tên'}
          </button>
        </div>
      )}
    </motion.li>
  );
};

/**
 * The article types a journal accepts, kept on the server: each has its own names, order and rules, and
 * papers are of one of them. Offline (nothing to ask) it only lists what the profile carries.
 */
export const JournalArticleTypesTab: React.FC<JournalArticleTypesTabProps> = ({ profile, journalKey, isNew = false, canEdit = true }) => {
  const types = useArticleTypes(journalKey, !isNew);
  const { create, update } = useArticleTypeActions(journalKey);
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [vi, setVi] = useState('');
  const [en, setEn] = useState('');
  /** Which row and which kind of save is in flight, for the spinner on that button. */
  const [working, setWorking] = useState<{ code: string; kind: 'status' | 'move' | 'rename' } | null>(null);

  const list = [...(types.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const busy = create.isPending || update.isPending;
  const codeOk = CODE_PATTERN.test(code);
  const canAdd = canEdit && codeOk && vi.trim() !== '' && en.trim() !== '' && !busy;
  const fail = (title: string) => (err: Error) => toast.error(title, err.message);
  const canAddHere = !isNew && canEdit && !!types.data;

  const resetForm = () => {
    setCode('');
    setVi('');
    setEn('');
  };

  const add = () =>
    create.mutate(
      { code, labels: { vi: vi.trim(), en: en.trim() } },
      {
        onSuccess: () => {
          resetForm();
          setAdding(false);
          toast.success('Đã thêm loại bài', `Loại bài "${code}" đã có quy tắc mặc định.`);
        },
        onError: fail('Không thêm được loại bài'),
      },
    );

  /** Run a save for one row, remembering which one for its spinner. */
  const save = (rowCode: string, kind: 'status' | 'move' | 'rename', body: Parameters<typeof update.mutate>[0]['body'], onSuccess?: () => void, error = 'Không lưu được') => {
    setWorking({ code: rowCode, kind });
    update.mutate(
      { code: rowCode, body },
      { onSuccess, onError: fail(error), onSettled: () => setWorking(null) },
    );
  };

  /** Swapping places with the neighbour: both get each other's number. */
  const move = (index: number, direction: -1 | 1) => {
    const a = list[index];
    const b = list[index + direction];
    if (!a || !b) return;
    setWorking({ code: a.code, kind: 'move' });
    update.mutate({ code: b.code, body: { sortOrder: a.sortOrder } }, { onError: fail('Không đổi được thứ tự') });
    update.mutate({ code: a.code, body: { sortOrder: b.sortOrder } }, { onError: fail('Không đổi được thứ tự'), onSettled: () => setWorking(null) });
  };

  return (
    <div className="space-y-4 w-full p-5">
      {/* header: the add button sits level with the title, where people look for it */}
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 rounded-2xl bg-gray-200/60 text-zinc-800 flex items-center justify-center shrink-0">
          <Layers className="w-4 h-4" />
        </span>
        <h3 className="font-extrabold text-sm text-zinc-900 flex-1">Chuyên Mục &amp; Loại Bài</h3>
        {canAddHere && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            data-testid="toggle-add-article-type"
            aria-expanded={adding}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-extrabold shadow-2xs transition-all duration-200 cursor-pointer active:scale-95 hover:-translate-y-0.5 ${
              adding ? 'bg-zinc-900 text-white hover:bg-zinc-700' : 'bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950'
            }`}
          >
            {adding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
            <span>{adding ? 'Đóng' : 'Thêm loại bài'}</span>
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {adding && canAddHere && (
          <motion.div
            key="add-form"
            initial={isTest ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={isTest ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: isTest ? 0 : 0.25, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="p-3.5 rounded-3xl bg-gray-200/50 space-y-3" data-testid="add-article-type">
              <p className="text-xs font-extrabold text-zinc-800 px-1">Thêm loại bài</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="block">
                  <span className="block text-[11px] font-bold text-zinc-600 mb-1 px-1">Mã (vd: protocol)</span>
                  <input className={INPUT} value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} placeholder="protocol" />
                  {code && !codeOk && <span className="block mt-1 px-1 text-[11px] text-rose-600 font-bold">2-50 ký tự a-z, 0-9, gạch ngang; bắt đầu bằng chữ</span>}
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold text-zinc-600 mb-1 px-1">Tên tiếng Việt</span>
                  <input className={INPUT} value={vi} onChange={(e) => setVi(e.target.value)} placeholder="Đề cương nghiên cứu" />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-bold text-zinc-600 mb-1 px-1">Tên tiếng Anh</span>
                  <input className={INPUT} value={en} onChange={(e) => setEn(e.target.value)} placeholder="Protocol" />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={!canAdd}
                  onClick={add}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#78C841] hover:bg-[#6cb43a] text-xs font-extrabold text-zinc-950 shadow-2xs transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
                >
                  {create.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  {create.isPending ? 'Đang thêm...' : 'Thêm'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isNew && (
        <p className="text-xs text-zinc-600 bg-gray-200/50 rounded-3xl px-4 py-3">
          Tạp chí mới bắt đầu với các loại bài mặc định (nghiên cứu, tổng quan). Hãy lưu tạp chí trước, rồi thêm hoặc sửa loại bài tại đây.
        </p>
      )}

      {!isNew && types.isLoading && (
        <div className="space-y-2" aria-busy="true">
          <TypeRowShimmer />
          <TypeRowShimmer />
        </div>
      )}

      {/* without a server: what the loaded profile says */}
      {(isNew || types.isError || (!types.isLoading && !types.data)) && (
        <ul className="space-y-2">
          {(profile.articleTypes ?? []).map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-3.5 rounded-3xl bg-gray-200/50">
              <span className="px-2.5 py-1 rounded-xl bg-zinc-900 text-white text-[11px] font-extrabold">{t.id}</span>
              <span className="text-xs font-bold text-zinc-900">{t.label?.vi}</span>
              <span className="text-xs text-zinc-500">{t.label?.en}</span>
            </li>
          ))}
        </ul>
      )}

      <ul className="space-y-2">
        {list.map((t, i) => (
          <TypeRow
            key={`${t.id}-${t.labels.vi}-${t.labels.en}`}
            type={t}
            journalKey={journalKey}
            canEdit={canEdit}
            isFirst={i === 0}
            isLast={i === list.length - 1}
            busy={busy}
            working={working?.code === t.code ? working.kind : null}
            onMove={(d) => move(i, d)}
            onSetStatus={(status) => save(t.code, 'status', { status }, undefined, 'Không đổi được trạng thái')}
            onRename={(labels) => save(t.code, 'rename', { labels }, () => toast.success('Đã lưu tên loại bài'), 'Không lưu được tên')}
          />
        ))}
      </ul>
    </div>
  );
};
