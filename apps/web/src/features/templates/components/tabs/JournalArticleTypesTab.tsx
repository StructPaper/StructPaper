'use client';

import React, { useState } from 'react';
import { Layers, Plus, Archive, ArchiveRestore, ArrowUp, ArrowDown, Save } from 'lucide-react';
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

const INPUT =
  'w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/20 outline-none transition-all disabled:bg-zinc-50 disabled:text-zinc-500';
const CODE_PATTERN = /^[a-z][a-z0-9-]{1,49}$/;

const TypeRowShimmer: React.FC = () => (
  <div className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-zinc-200/80">
    <Shimmer className="h-6 w-16 rounded-lg" />
    <Shimmer className="h-8 flex-1 rounded-xl" />
    <Shimmer className="h-8 flex-1 rounded-xl" />
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
  busy: boolean;
}> = ({ type, journalKey, canEdit, isFirst, isLast, onMove, onSetStatus, onRename, busy }) => {
  const [vi, setVi] = useState(type.labels.vi);
  const [en, setEn] = useState(type.labels.en);
  const archived = type.status === 'archived';
  const changed = vi.trim() !== type.labels.vi || en.trim() !== type.labels.en;

  const rules = useArticleTypeRules(journalKey, type.code, canEdit && !archived);
  const setAbstract = useSetAbstractRequired(journalKey, type.code);
  const abstractRequired = needsAbstract(rules.data?.config);

  return (
    <li className={`p-3 rounded-2xl bg-white border border-zinc-200/80 space-y-2 ${archived ? 'opacity-70' : ''}`} data-testid={`article-type-${type.code}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-zinc-900 text-white text-[11px] font-extrabold">{type.code}</span>
        {archived && <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-[10.5px] font-bold">Đã lưu trữ</span>}
        <div className="flex-1" />
        {canEdit && (
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Đưa lên" disabled={busy || isFirst} onClick={() => onMove(-1)} className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 cursor-pointer">
              <ArrowUp className="w-3.5 h-3.5" />
            </button>
            <button type="button" aria-label="Đưa xuống" disabled={busy || isLast} onClick={() => onMove(1)} className="p-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 disabled:opacity-40 cursor-pointer">
              <ArrowDown className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSetStatus(archived ? 'active' : 'archived')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-[11px] font-bold text-zinc-700 cursor-pointer disabled:opacity-50"
            >
              {archived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
              {archived ? 'Dùng lại' : 'Lưu trữ'}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <label className="block">
          <span className="block text-[11px] font-bold text-zinc-600 mb-1">Tên tiếng Việt</span>
          <input className={INPUT} value={vi} disabled={!canEdit} onChange={(e) => setVi(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-zinc-600 mb-1">Tên tiếng Anh</span>
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
            </label>
          )}
          <div className="flex-1" />
          <button
            type="button"
            disabled={!changed || !vi.trim() || !en.trim() || busy}
            onClick={() => onRename({ vi: vi.trim(), en: en.trim() })}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#78C841] hover:bg-[#6cb43a] text-[11px] font-extrabold text-zinc-950 cursor-pointer disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            Lưu tên
          </button>
        </div>
      )}
    </li>
  );
};

/**
 * The article types a journal accepts, kept on the server: each has its own names, order and rules, and
 * papers are of one of them. Offline (nothing to ask) it only lists what the profile carries.
 */
export const JournalArticleTypesTab: React.FC<JournalArticleTypesTabProps> = ({ profile, journalKey, isNew = false, canEdit = true }) => {
  const types = useArticleTypes(journalKey, !isNew);
  const { create, update } = useArticleTypeActions(journalKey);
  const [code, setCode] = useState('');
  const [vi, setVi] = useState('');
  const [en, setEn] = useState('');

  const list = [...(types.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const busy = create.isPending || update.isPending;
  const codeOk = CODE_PATTERN.test(code);
  const canAdd = canEdit && codeOk && vi.trim() !== '' && en.trim() !== '' && !busy;
  const fail = (title: string) => (err: Error) => toast.error(title, err.message);

  const add = () =>
    create.mutate(
      { code, labels: { vi: vi.trim(), en: en.trim() } },
      {
        onSuccess: () => {
          setCode('');
          setVi('');
          setEn('');
          toast.success('Đã thêm loại bài', `Loại bài "${code}" đã có quy tắc mặc định.`);
        },
        onError: fail('Không thêm được loại bài'),
      },
    );

  /** Swapping places with the neighbour: both get each other's number. */
  const move = (index: number, direction: -1 | 1) => {
    const a = list[index];
    const b = list[index + direction];
    if (!a || !b) return;
    update.mutate({ code: a.code, body: { sortOrder: b.sortOrder } }, { onError: fail('Không đổi được thứ tự') });
    update.mutate({ code: b.code, body: { sortOrder: a.sortOrder } }, { onError: fail('Không đổi được thứ tự') });
  };

  return (
    <div className="space-y-4 w-full p-5">
      <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
        <Layers className="w-4 h-4 text-zinc-700" />
        <h3 className="font-extrabold text-sm text-zinc-900">Chuyên Mục &amp; Loại Bài</h3>
      </div>

      {isNew && (
        <p className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-2xl px-4 py-3">
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
            <li key={t.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white border border-zinc-200/80">
              <span className="px-2.5 py-1 rounded-lg bg-zinc-900 text-white text-[11px] font-extrabold">{t.id}</span>
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
            onMove={(d) => move(i, d)}
            onSetStatus={(status) => update.mutate({ code: t.code, body: { status } }, { onError: fail('Không đổi được trạng thái') })}
            onRename={(labels) =>
              update.mutate({ code: t.code, body: { labels } }, { onSuccess: () => toast.success('Đã lưu tên loại bài'), onError: fail('Không lưu được tên') })
            }
          />
        ))}
      </ul>

      {!isNew && canEdit && types.data && (
        <div className="p-3 rounded-2xl border border-dashed border-zinc-300 space-y-2" data-testid="add-article-type">
          <p className="text-xs font-extrabold text-zinc-800">Thêm loại bài</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <label className="block">
              <span className="block text-[11px] font-bold text-zinc-600 mb-1">Mã (vd: protocol)</span>
              <input className={INPUT} value={code} onChange={(e) => setCode(e.target.value.toLowerCase())} placeholder="protocol" />
              {code && !codeOk && <span className="text-[11px] text-rose-600 font-bold">2-50 ký tự a-z, 0-9, gạch ngang; bắt đầu bằng chữ</span>}
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold text-zinc-600 mb-1">Tên tiếng Việt</span>
              <input className={INPUT} value={vi} onChange={(e) => setVi(e.target.value)} placeholder="Đề cương nghiên cứu" />
            </label>
            <label className="block">
              <span className="block text-[11px] font-bold text-zinc-600 mb-1">Tên tiếng Anh</span>
              <input className={INPUT} value={en} onChange={(e) => setEn(e.target.value)} placeholder="Protocol" />
            </label>
          </div>
          <button
            type="button"
            disabled={!canAdd}
            onClick={add}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#78C841] hover:bg-[#6cb43a] text-[11px] font-extrabold text-zinc-950 cursor-pointer disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm
          </button>
        </div>
      )}
    </div>
  );
};
