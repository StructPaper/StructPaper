'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Building, BookOpen, Bookmark, Calendar, ChevronDown, ChevronUp, FileText, LayoutTemplate, Quote, Tag, UserCheck, CheckCircle, AlertTriangle, Check } from 'lucide-react';
import { diffDocs, diffInline, flattenLayout, layoutLabel, type DocDiff, type FieldChange, type ItemChange } from '@structpaper/doc-diff';
import { BlockSettingChips } from '@/features/editor/components/sections/BlockSettingChips';
import { PageLayoutBadge } from '@/features/editor/components/sections/PageLayoutControl';
import { blockSettingChanges, blockSettingChips, hasBlockSettings } from '../lib/block-settings';
import { Badge, BlockBody, KIND_BOX, Marked, authorChanges, buildRows, infoRowsOf, personName, text } from './DocumentDiffView';

type Json = Record<string, any>;
type TabKey = 'metadata' | 'authors' | 'abstract' | 'sections' | 'refs' | 'citation' | 'layout';

interface DetailedDiffViewProps {
  /** The paper as it is in the version on screen. */
  doc: Json;
  /** The version it is compared with (older), or null to just read the version. */
  compareTo?: Json | null;
  /** Mark what changed. */
  showChanges: boolean;
  /** When given, every block shows a button that takes it into the paper as it is now (used on older versions). */
  onInsertBlock?: (section: Json) => void;
}

const ABSTRACT_PATHS = ['metadata.abstract', 'metadata.abstractEn', 'metadata.keywords', 'metadata.keywordsEn'];
const isAuthorField = (path: string) => path.startsWith('metadata.corresponding.');

// ---------------------------------------------------------------------------------------------------------------------
// The pieces below look like the editor's own tabs (same headings, labels, order, boxes and colours) but show values and
// what changed instead of inputs.

/** The heading of a part of a tab: icon, title and a line under it (as in the editor's tabs). */
const PartTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode; hint?: string }> = ({ icon, children, hint }) => (
  <div className="pb-2 border-b border-zinc-200/60">
    <div className="flex items-center gap-2">
      {icon}
      <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">{children}</h3>
    </div>
    {hint && <p className="text-xs text-zinc-500 mt-0.5">{hint}</p>}
  </div>
);

const wordsOf = (s: string) => (s ? s.trim().split(/\s+/).filter(Boolean).length : 0);

interface ValueBoxProps {
  label: React.ReactNode;
  value: string;
  change?: FieldChange;
  /** Visual size of the label: the editor uses 12px for a tab's own fields and 10-11px inside cards. */
  small?: boolean;
  /** Classes of the box, as the editor's input has them. */
  box?: string;
  right?: React.ReactNode;
  testId?: string;
  empty?: string;
}

/** What the editor shows as a labelled input or textarea. A changed value is marked in place, with the old one under it. */
const ValueBox: React.FC<ValueBoxProps> = ({ label, value, change, small, box = 'p-3 rounded-2xl text-sm text-zinc-900', right, testId, empty = '—' }) => (
  <div data-change={change ? 'modified' : undefined} data-testid={testId} className={`rounded-2xl transition-shadow ${change ? 'ring-2 ring-amber-300/80 bg-amber-50/40 p-1.5 -m-1.5' : ''}`}>
    <div className="flex items-center justify-between mb-1.5">
      <label className={small ? 'text-[10px] font-bold text-zinc-600 block' : 'text-xs font-bold text-zinc-700 flex items-center gap-1.5'}>
        {label}
        {change && <span className="ml-2 align-middle"><Badge kind="modified" /></span>}
      </label>
      {right}
    </div>
    <div className={`w-full border border-zinc-200 bg-white shadow-2xs leading-snug whitespace-pre-wrap break-words ${box}`}>
      {change ? <Marked segments={change.inline} /> : value || <span className="text-zinc-400">{empty}</span>}
    </div>
    {change && (
      <p className="mt-1.5 text-[11px] text-rose-800 bg-rose-50 rounded-xl px-2.5 py-1 whitespace-pre-wrap break-words" data-testid="before-value">
        <b className="font-extrabold">Trước:</b> {change.before || '—'}
      </p>
    )}
  </div>
);

/** A row of pills for keywords, as under the editor's keyword input. */
const Keywords: React.FC<{ list: string[]; italic?: boolean }> = ({ list, italic }) =>
  list.length === 0 ? null : (
    <div className="flex items-center gap-1.5 flex-wrap pt-1">
      {list.map((kw, i) => (
        <span key={`${kw}-${i}`} className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200/60 ${italic ? 'italic' : ''}`}>
          {kw}
        </span>
      ))}
    </div>
  );

/** The tabs of the editor, each with the number of changes it holds. */
const DetailTabs: React.FC<{ tabs: TabDef[]; active: TabKey; onChange: (k: TabKey) => void; compare: boolean }> = ({ tabs, active, onChange, compare }) => (
  <div className="flex items-center gap-1 overflow-x-auto p-1 bg-zinc-200/70 rounded-2xl w-full select-none" style={{ scrollbarWidth: 'none' }} role="tablist" data-testid="detail-tabs">
    {tabs.map((t) => {
      const isActive = t.key === active;
      const count = compare ? t.changes : t.total;
      return (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={isActive}
          data-testid={`detail-tab-${t.key}`}
          onClick={() => onChange(t.key)}
          className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex-1 min-w-fit ${
            isActive ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60 font-extrabold' : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60'
          }`}
        >
          <span>{t.label}</span>
          {count !== undefined && count > 0 && (
            <span data-testid={`detail-count-${t.key}`} className={`text-[10px] px-1.5 rounded-full font-bold ${compare ? 'bg-amber-300 text-amber-950' : 'bg-zinc-300 text-zinc-700'}`}>
              {count}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

interface TabDef {
  key: TabKey;
  label: string;
  /** How many things changed in the tab (shown when changes are marked). */
  changes: number;
  /** How many things the tab holds, shown when changes are not marked. */
  total?: number;
}

/** A list of setting changes, "Hướng bảng: Hướng dọc → Hướng ngang (xoay 90°)". */
const SettingChanges: React.FC<{ changes: { label: string; from: string; to: string }[] }> = ({ changes }) =>
  changes.length === 0 ? null : (
    <ul className="rounded-xl bg-amber-50 px-3 py-2 space-y-1" data-testid="setting-changes">
      <li className="text-[10.5px] font-extrabold uppercase tracking-wider text-amber-800">Cài đặt đã đổi</li>
      {changes.map((c) => (
        <li key={c.label} className="text-xs text-zinc-800 flex flex-wrap items-center gap-1.5">
          <b>{c.label}:</b>
          <span className="px-1.5 py-px rounded-full bg-rose-100 text-rose-800 line-through decoration-rose-400">{c.from}</span>
          <ArrowRight className="w-3 h-3 text-zinc-400" />
          <span className="px-1.5 py-px rounded-full bg-emerald-100 text-emerald-900 font-semibold">{c.to}</span>
        </li>
      ))}
    </ul>
  );

/** The type of a block as the editor labels it on the card's header. */
function blockBadge(sec: Json): { label: string; cls: string } {
  switch (sec.type) {
    case 'h1': return { label: 'Mục Cấp 1 (H1)', cls: 'bg-zinc-900 text-white' };
    case 'h2': return { label: 'Mục Cấp 2 (H2)', cls: 'bg-zinc-700 text-white' };
    case 'h3': return { label: 'Mục Cấp 3 (H3)', cls: 'bg-zinc-500 text-white' };
    case 'table': return { label: `Bảng số liệu ${sec.table?.num ? `(Bảng ${sec.table.num})` : ''}`.trim(), cls: 'bg-zinc-200/80 text-zinc-800' };
    case 'figure': return { label: `Hình minh họa ${sec.figure?.num ? `(Hình ${sec.figure.num})` : ''}`.trim(), cls: 'bg-zinc-200/80 text-zinc-800' };
    case 'equation': return { label: `Công thức ${sec.equation?.numbered && sec.equation.num ? `(${sec.equation.num})` : ''}`.trim(), cls: 'bg-violet-100 text-violet-800' };
    default: return { label: 'Đoạn văn', cls: 'bg-zinc-200/80 text-zinc-800' };
  }
}

const PANEL = 'p-4 sm:p-5 space-y-4';

/**
 * The other way to read a version: laid out like the editor's tabs (same headings, labels, order and boxes) so a change is
 * seen where it would be edited. Each tab says how many changes it holds, a changed value is marked in place with the old one
 * under it, and two buttons walk through the changes of the tab on screen. A last tab holds the paper's page layout.
 */
export const DetailedDiffView: React.FC<DetailedDiffViewProps> = ({ doc, compareTo, showChanges, onInsertBlock }) => {
  const compare = showChanges && !!compareTo;
  const diff: DocDiff | null = useMemo(() => (compare ? diffDocs(compareTo, doc) : null), [compare, compareTo, doc]);
  const [active, setActive] = useState<TabKey>('metadata');
  const panel = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(-1);
  const [found, setFound] = useState(0);

  const meta = (doc.metadata ?? {}) as Json;
  const field = (path: string) => (compare ? diff?.fields.find((f) => f.path === path) : undefined);
  const item = (scope: ItemChange['scope'], id: unknown) => (compare ? diff?.items.find((i) => i.scope === scope && i.id === String(id)) : undefined);
  const removed = (scope: ItemChange['scope']) => (compare ? (diff?.items ?? []).filter((i) => i.scope === scope && i.kind === 'removed') : []);

  const rows = useMemo(() => buildRows(doc, compareTo, diff), [doc, compareTo, diff]);
  const sections = ((doc.sections ?? []) as Json[]).filter((s) => s.type !== 'citation');
  const blockSettingDiffs = useMemo(() => {
    const out = new Map<string, ReturnType<typeof blockSettingChanges>>();
    for (const b of diff?.blocks ?? []) {
      if (b.kind !== 'modified') continue;
      const changes = blockSettingChanges(b.before, b.after);
      if (changes.length > 0) out.set(b.id, changes);
    }
    return out;
  }, [diff]);

  const info = infoRowsOf(meta);
  const byLabel = (label: string) => info.find((r) => r.label === label);
  const value = (label: string) => byLabel(label)?.value ?? '';
  const fieldOf = (label: string) => byLabel(label)?.paths.map((p) => field(p)).find(Boolean);
  // what the metadata tab does not hold in its own boxes still shows when it changed
  const knownPaths = new Set(['metadata.title', 'metadata.titleEn', 'metadata.articleType', 'metadata.dates.received', 'metadata.dates.revised', 'metadata.dates.accepted', 'metadata.publication.volume', 'metadata.volume', 'metadata.publication.issue', 'metadata.issue', 'metadata.publication.firstPage', 'metadata.firstPage', 'metadata.publication.lastPage', 'metadata.lastPage', 'metadata.publication.published', 'metadata.dates.published', 'metadata.publication.doi', 'metadata.doi', 'citation']);
  const otherFields = (diff?.fields ?? []).filter((f) => !knownPaths.has(f.path) && !ABSTRACT_PATHS.includes(f.path) && !isAuthorField(f.path));

  const metadataChanges = (diff?.fields ?? []).filter((f) => !ABSTRACT_PATHS.includes(f.path) && !isAuthorField(f.path) && f.path !== 'citation').length;
  const authorChangesCount = (diff?.fields ?? []).filter((f) => isAuthorField(f.path)).length + (diff?.items ?? []).filter((i) => i.scope === 'author' || i.scope === 'affiliation').length;
  const abstractChanges = (diff?.fields ?? []).filter((f) => ABSTRACT_PATHS.includes(f.path)).length;
  const layoutChanges = diff?.layout.length ?? 0;

  const citation = ((doc.sections ?? []) as Json[]).find((s) => s.type === 'citation');
  const layoutNow = flattenLayout(doc.layoutSettings);
  const layoutRemoved = (diff?.layout ?? []).filter((f) => f.kind === 'removed');
  const authors = (meta.authors ?? []) as Json[];
  const affiliations = (meta.affiliations ?? []) as Json[];
  const references = (doc.references ?? []) as Json[];
  const affName = (id: unknown) => {
    const a = affiliations.find((x) => String(x.id) === String(id));
    return a ? `${a.id}. ${a.name}` : text(id);
  };

  const tabs: TabDef[] = [
    { key: 'metadata', label: 'Tựa đề', changes: metadataChanges },
    { key: 'authors', label: 'Tác giả', changes: authorChangesCount, total: authors.length },
    { key: 'abstract', label: 'Tóm tắt', changes: abstractChanges },
    { key: 'sections', label: 'Nội dung', changes: diff?.blocks.length ?? 0, total: sections.length },
    { key: 'refs', label: 'Tài liệu tham khảo', changes: (diff?.items ?? []).filter((i) => i.scope === 'reference').length, total: references.length },
    { key: 'citation', label: 'Trích dẫn', changes: field('citation') ? 1 : 0 },
    { key: 'layout', label: 'Dàn trang', changes: layoutChanges },
  ];

  // ---- walking through the changes of the tab on screen (never those of another tab)
  useEffect(() => {
    setCursor(-1);
    setFound(panel.current?.querySelectorAll('[data-change]').length ?? 0);
  }, [active, diff, doc]);

  const jump = useCallback(
    (dir: 1 | -1) => {
      const nodes = Array.from(panel.current?.querySelectorAll<HTMLElement>('[data-change]') ?? []);
      if (nodes.length === 0) return;
      const next = cursor < 0 ? (dir === 1 ? 0 : nodes.length - 1) : (cursor + dir + nodes.length) % nodes.length;
      setCursor(next);
      nodes[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
      nodes[next].classList.add('ring-2', 'ring-zinc-900/40');
      setTimeout(() => nodes[next].classList.remove('ring-2', 'ring-zinc-900/40'), 900);
    },
    [cursor],
  );

  return (
    // the width is capped in pixels, not in proportion: on a wide screen the boxes do not stretch out, on a small one they do not shrink
    <div className="h-full w-full flex items-stretch justify-center gap-3">
    <div className="h-full w-full max-w-[880px] min-w-0 flex flex-col min-h-0 gap-3" data-testid="detailed-diff-view">
      <div className="shrink-0 space-y-2">
        <DetailTabs tabs={tabs} active={active} onChange={setActive} compare={compare} />
        {compare && (
          <p className="text-[11px] font-bold text-zinc-500 px-1" data-testid="detail-summary">
            {diff!.isEmpty ? 'Không có thay đổi so với bản được chọn để so sánh.' : `${tabs.reduce((n, t) => n + t.changes, 0)} thay đổi, chia theo từng tab. Tab có số màu vàng là nơi có thay đổi.`}
          </p>
        )}
      </div>

      <div ref={panel} className="flex-1 min-h-0 overflow-y-auto rounded-3xl bg-gray-100/50" data-testid={`detail-panel-${active}`}>
        {active === 'metadata' && (
          <div className={PANEL}>
            <PartTitle icon={<FileText className="w-4 h-4 text-zinc-700" />}>Thông tin cơ bản bài báo & Xuất bản</PartTitle>
            <ValueBox label="Tựa đề bài báo (Tiếng Việt):" value={text(meta.title)} change={field('metadata.title')} box="min-h-[56px] p-3 rounded-2xl text-sm font-semibold text-zinc-900" empty="Chưa có tựa đề" />
            <ValueBox label="Tựa đề bài báo (Tiếng Anh - nếu có):" value={text(meta.titleEn)} change={field('metadata.titleEn')} box="min-h-[56px] p-3 rounded-2xl text-sm font-semibold italic text-zinc-900" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <ValueBox label="Loại bài báo (Article Type):" value={text(meta.articleType)} change={field('metadata.articleType')} box="p-2.5 rounded-2xl text-xs font-semibold text-zinc-900" />
            </div>

            <div className="pt-2 space-y-2">
              <p className="text-xs font-bold text-zinc-700 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-zinc-500" />Các mốc thời gian xuất bản (Tòa soạn):</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <ValueBox small label="Ngày nhận:" value={value('Ngày nhận')} change={fieldOf('Ngày nhận')} box="p-2.5 rounded-xl text-xs text-zinc-900" />
                <ValueBox small label="Ngày sửa đổi:" value={value('Ngày sửa đổi')} change={fieldOf('Ngày sửa đổi')} box="p-2.5 rounded-xl text-xs text-zinc-900" />
                <ValueBox small label="Ngày chấp nhận:" value={value('Ngày chấp nhận')} change={fieldOf('Ngày chấp nhận')} box="p-2.5 rounded-xl text-xs text-zinc-900" />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <p className="text-xs font-bold text-zinc-700 flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5 text-zinc-500" />Thông tin xuất bản (do Tòa soạn cấp):</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ValueBox small label="Tập (Volume):" value={value('Tập')} change={fieldOf('Tập')} box="p-2 rounded-xl text-xs text-zinc-900" empty="?" />
                <ValueBox small label="Số (Issue):" value={value('Số')} change={fieldOf('Số')} box="p-2 rounded-xl text-xs text-zinc-900" empty="?" />
                <ValueBox small label="Trang đầu:" value={value('Trang đầu')} change={fieldOf('Trang đầu')} box="p-2 rounded-xl text-xs text-zinc-900" empty="?" />
                <ValueBox small label="Trang cuối:" value={value('Trang cuối')} change={fieldOf('Trang cuối')} box="p-2 rounded-xl text-xs text-zinc-900" empty="?" />
                <ValueBox small label="Ngày đăng (dd-mm-yyyy):" value={value('Ngày xuất bản')} change={fieldOf('Ngày xuất bản')} box="p-2 rounded-xl text-xs text-zinc-900" empty="?" />
                <div className="col-span-2 sm:col-span-3">
                  <ValueBox small label="Mã định danh DOI:" value={value('DOI')} change={fieldOf('DOI')} box="p-2 rounded-xl text-xs font-mono text-zinc-900" empty="?" />
                </div>
              </div>
            </div>

            {otherFields.length > 0 && (
              <div className="pt-2 space-y-3">
                <p className="text-xs font-bold text-zinc-700">Thông tin khác đã đổi:</p>
                {otherFields.map((f) => (
                  <ValueBox key={f.path} small label={f.label} value={f.after} change={f} box="p-2.5 rounded-xl text-xs text-zinc-900" />
                ))}
              </div>
            )}
          </div>
        )}

        {active === 'authors' && (
          <div className="p-4 sm:p-5 space-y-6">
            <div className="space-y-4">
              <PartTitle icon={<UserCheck className="w-4 h-4 text-zinc-700" />} hint="Nhập họ tên, chọn cơ quan công tác tương ứng và đánh dấu tác giả liên hệ để hiển thị đúng dấu sao (*) trong bài báo.">
                Danh sách Tác giả ({authors.length})
              </PartTitle>
              <div className="space-y-1.5" data-testid="doc-authors">
                {authors.map((a) => {
                  const c = item('author', a.id ?? personName(a));
                  const was = c?.kind === 'modified' ? (c.before as Json) : undefined;
                  const changedName = !!was && was.name !== a.name;
                  const changedAff = !!was && text(was.affiliationIds) !== text(a.affiliationIds);
                  const changedEmail = !!was && (was.email ?? '') !== (a.email ?? '');
                  const changedOrcid = !!was && (was.orcid ?? '') !== (a.orcid ?? '');
                  const changedCorr = !!was && !!was.isCorresponding !== !!a.isCorresponding;
                  const flag = (on: boolean) => (on ? 'ring-2 ring-amber-300 bg-amber-50' : '');
                  const notes = was ? authorChanges(was, a) : [];
                  return (
                    <div key={String(a.id ?? personName(a))} id={`author-item-${a.id}`} data-change={c?.kind} className={`p-4 rounded-3xl flex flex-col gap-3 ${c ? KIND_BOX[c.kind] : 'bg-gray-200/50'}`}>
                      {c && <Badge kind={c.kind} />}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                        <div className="md:col-span-4">
                          <label className="text-[10px] font-bold text-zinc-600 block mb-1">Họ và tên tác giả:</label>
                          <div className={`w-full p-2.5 rounded-xl text-xs font-bold text-zinc-900 bg-white shadow-2xs ${flag(changedName)}`}>{personName(a) || '—'}</div>
                        </div>
                        <div className="md:col-span-4">
                          <label className="text-[10px] font-bold text-zinc-600 block mb-1">Cơ quan công tác:</label>
                          <div className={`w-full p-2.5 rounded-xl text-xs text-zinc-900 bg-white shadow-2xs ${flag(changedAff)}`}>{Array.isArray(a.affiliationIds) && a.affiliationIds.length ? a.affiliationIds.map(affName).join('; ') : '—'}</div>
                        </div>
                        <div className="md:col-span-4">
                          <label className="text-[10px] font-bold text-zinc-600 block mb-1">Email liên hệ:</label>
                          <div className={`w-full p-2.5 rounded-xl text-xs text-zinc-900 bg-white shadow-2xs ${flag(changedEmail)}`}>{a.email || '—'}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                        <div className="md:col-span-6">
                          <label className="text-[10px] font-bold text-zinc-600 block mb-1">Mã ORCID (tùy chọn):</label>
                          <div className={`w-full p-2 rounded-xl text-xs font-mono text-zinc-900 bg-white shadow-2xs ${flag(changedOrcid)}`}>{a.orcid || '—'}</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-300/40">
                        <span className={`flex items-center gap-2 text-xs font-semibold text-zinc-700 rounded-lg px-1.5 py-0.5 ${flag(changedCorr)}`}>
                          <span className={`w-4 h-4 rounded flex items-center justify-center border ${a.isCorresponding ? 'bg-zinc-900 border-zinc-900 text-white' : 'bg-white border-zinc-300'}`}>
                            {a.isCorresponding && <Check className="w-3 h-3" strokeWidth={3} />}
                          </span>
                          <span className="font-bold text-zinc-800">Tác giả liên hệ* (Corresponding Author)</span>
                        </span>
                      </div>
                      {notes.length > 0 && (
                        <ul className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 list-disc pl-6" data-testid="author-notes">
                          {notes.map((n) => <li key={n}>{n}</li>)}
                        </ul>
                      )}
                    </div>
                  );
                })}
                {removed('author').map((c) => (
                  <div key={c.id} data-change="removed" className={`p-4 rounded-3xl ${KIND_BOX.removed}`}>
                    <Badge kind="removed" />
                    <p className="text-xs"><del className="font-bold text-rose-900">{personName(c.before ?? {})}</del>{c.before?.email ? <span className="text-rose-700"> · {String(c.before.email)}</span> : null}</p>
                  </div>
                ))}
                {authors.length === 0 && removed('author').length === 0 && <p className="text-xs font-bold text-zinc-400">Chưa có tác giả.</p>}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <PartTitle icon={<Building className="w-4 h-4 text-zinc-700" />} hint="Mỗi cơ quan có cùng mã số ID, gồm tên Tiếng Việt & Tiếng Anh.">
                Cơ quan & Viện nghiên cứu ({affiliations.length})
              </PartTitle>
              <div className="space-y-2.5" data-testid="doc-affiliations">
                {affiliations.map((a) => {
                  const c = item('affiliation', a.id ?? a.name);
                  const was = c?.kind === 'modified' ? (c.before as Json) : undefined;
                  const viMarks = was && was.name !== a.name ? diffInline(text(was.name), text(a.name)) : null;
                  const enMarks = was && (was.nameEn ?? '') !== (a.nameEn ?? '') ? diffInline(text(was.nameEn), text(a.nameEn)) : null;
                  const used = authors.filter((x) => (x.affiliationIds || []).includes(a.id)).length;
                  return (
                    <div key={String(a.id ?? a.name)} data-change={c?.kind} className={`p-3.5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center gap-3 ${c ? KIND_BOX[c.kind] : 'bg-gray-200/50'}`}>
                      <span className="w-8 h-8 rounded-2xl bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-black shadow-2xs shrink-0">{a.id}</span>
                      <div className="flex-1 w-full space-y-1 min-w-0">
                        {c && <Badge kind={c.kind} />}
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-gray-50 text-gray-700 shrink-0">Tiếng Việt</span>
                          <div className={`flex-1 p-2 rounded-xl text-xs font-medium text-zinc-900 bg-white shadow-2xs ${viMarks ? 'ring-2 ring-amber-300' : ''}`}>{viMarks ? <Marked segments={viMarks} /> : a.name || '—'}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-gray-50 text-gray-800 shrink-0">English</span>
                          <div className={`flex-1 p-2 rounded-xl text-xs font-medium text-zinc-900 bg-white ${enMarks ? 'ring-2 ring-amber-300' : ''}`}>{enMarks ? <Marked segments={enMarks} /> : a.nameEn || '—'}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-zinc-500 shrink-0">{used > 0 ? `${used} tác giả chọn` : 'Chưa gán tác giả'}</span>
                    </div>
                  );
                })}
                {removed('affiliation').map((c) => (
                  <div key={c.id} data-change="removed" className={`p-3.5 rounded-3xl ${KIND_BOX.removed}`}>
                    <Badge kind="removed" />
                    <p className="text-xs"><del className="text-rose-900">{c.before?.id}. {String(c.before?.name ?? '')}</del></p>
                  </div>
                ))}
              </div>
            </div>

            {(meta.corresponding || diff?.fields.some((f) => isAuthorField(f.path))) && (
              <div className="space-y-3 pt-2">
                <PartTitle icon={<UserCheck className="w-4 h-4 text-zinc-700" />}>Tác giả liên hệ của bài</PartTitle>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ValueBox small label="Tên:" value={text(meta.corresponding?.name)} change={field('metadata.corresponding.name')} box="p-2.5 rounded-xl text-xs text-zinc-900" />
                  <ValueBox small label="Email:" value={text(meta.corresponding?.email)} change={field('metadata.corresponding.email')} box="p-2.5 rounded-xl text-xs text-zinc-900" />
                  <ValueBox small label="Đơn vị:" value={text(meta.corresponding?.affiliation)} change={field('metadata.corresponding.affiliation')} box="p-2.5 rounded-xl text-xs text-zinc-900" />
                </div>
              </div>
            )}
          </div>
        )}

        {active === 'abstract' && (
          <div className={PANEL}>
            <PartTitle icon={<BookOpen className="w-4 h-4 text-zinc-700" />}>Tóm tắt & Từ khóa (Abstract & Keywords)</PartTitle>
            <ValueBox
              label="Tóm tắt tiếng Việt (Abstract):"
              value={text(meta.abstract)}
              change={field('metadata.abstract')}
              box="p-3.5 rounded-2xl text-sm leading-relaxed text-zinc-900"
              right={<span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{wordsOf(text(meta.abstract))} từ</span>}
              empty="Chưa có tóm tắt"
            />
            <ValueBox
              label="Abstract (English - nếu có):"
              value={text(meta.abstractEn)}
              change={field('metadata.abstractEn')}
              box="p-3.5 rounded-2xl text-sm leading-relaxed italic text-zinc-800"
              right={wordsOf(text(meta.abstractEn)) > 0 ? <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{wordsOf(text(meta.abstractEn))} words</span> : undefined}
            />
            <div className="space-y-1.5 pt-1">
              <ValueBox label={<><Tag className="w-3.5 h-3.5 text-zinc-500" />Từ khóa tiếng Việt (phân cách bằng dấu phẩy):</>} value={text(meta.keywords)} change={field('metadata.keywords')} box="p-2.5 rounded-2xl text-xs text-zinc-900" />
              <Keywords list={(meta.keywords ?? []) as string[]} />
            </div>
            <div className="space-y-1.5 pt-1">
              <ValueBox label={<><Tag className="w-3.5 h-3.5 text-zinc-500" />Keywords (English - comma separated):</>} value={text(meta.keywordsEn)} change={field('metadata.keywordsEn')} box="p-2.5 rounded-2xl text-xs text-zinc-900 italic" />
              <Keywords list={(meta.keywordsEn ?? []) as string[]} italic />
            </div>
          </div>
        )}

        {active === 'sections' && (
          <div className={PANEL} data-testid="doc-body">
            {rows.map(({ section, before, change }, i) => {
              const kind = compare ? change?.kind : undefined;
              const settingDiff = compare && change ? blockSettingDiffs.get(change.id) ?? [] : [];
              const badge = blockBadge(section);
              const isHeading = section.type === 'h1' || section.type === 'h2' || section.type === 'h3';
              return (
                <div key={`${section.id}-${i}`} id={`section-card-${section.id}`} data-change={kind} data-block={section.id} className={`group/block relative p-3.5 rounded-3xl space-y-2.5 shadow-2xs ${kind ? KIND_BOX[kind] : 'bg-gray-200/50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                      <PageLayoutBadge layout={section.pageLayout} />
                      {kind && <Badge kind={kind} />}
                    </div>
                    {onInsertBlock && kind !== 'removed' && (
                      <button
                        type="button"
                        onClick={() => onInsertBlock(section)}
                        data-testid={`insert-block-${section.id}`}
                        className="px-2.5 py-1 rounded-full bg-zinc-900 text-white text-[10.5px] font-bold opacity-0 group-hover/block:opacity-100 focus:opacity-100 transition-all cursor-pointer active:scale-95"
                      >
                        Chèn vào bài hiện tại
                      </button>
                    )}
                  </div>
                  <div className={`bg-white shadow-2xs ${isHeading ? 'p-2.5 rounded-2xl' : 'p-3 rounded-2xl'}`}>
                    <BlockBody section={section} before={before} change={change} compare={compare} />
                  </div>
                  {kind !== 'removed' && hasBlockSettings(section) && <BlockSettingChips chips={blockSettingChips(section)} testId={`block-settings-${section.id}`} />}
                  <SettingChanges changes={settingDiff} />
                </div>
              );
            })}
            {rows.length === 0 && <p className="text-xs font-bold text-zinc-400 text-center py-6">Phiên bản này chưa có nội dung.</p>}
          </div>
        )}

        {active === 'refs' && (
          <div className={PANEL}>
            <PartTitle icon={<Quote className="w-4 h-4 text-zinc-700" />} hint="Hệ thống tự động đồng bộ số thứ tự [1], [2], [3]... theo đúng chuẩn Vancouver khi bạn chỉnh sửa hoặc xóa mục.">
              Tài liệu Tham khảo ({references.length})
            </PartTitle>
            <div className="space-y-2" data-testid="doc-references">
              {references.map((r) => {
                const c = item('reference', r.id ?? r.raw);
                const was = c?.kind === 'modified' ? (c.before as Json) : undefined;
                const marks = was && was.raw !== r.raw ? diffInline(text(was.raw), text(r.raw)) : null;
                const doiChanged = !!was && (was.doi ?? '') !== (r.doi ?? '');
                return (
                  <div key={String(r.id ?? r.raw)} id={`ref-item-${r.id}`} data-change={c?.kind} className={`p-3.5 rounded-3xl flex items-start gap-3 shadow-2xs ${c ? KIND_BOX[c.kind] : 'bg-gray-200/50'}`}>
                    <span className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-1 shadow-2xs">{r.id}</span>
                    <div className="flex-1 space-y-2 min-w-0">
                      {c && <Badge kind={c.kind} />}
                      <div className="w-full p-2.5 rounded-2xl text-xs text-zinc-900 bg-white leading-relaxed shadow-2xs whitespace-pre-wrap break-words">{marks ? <Marked segments={marks} /> : r.raw}</div>
                      {was && marks && <p className="text-[11px] text-rose-800 bg-rose-50 rounded-xl px-2.5 py-1 break-words"><b>Trước:</b> {text(was.raw)}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-zinc-500">DOI:</span>
                        <span className={`p-1 px-2.5 rounded-2xl text-[11px] font-mono text-zinc-900 bg-white min-w-[200px] ${doiChanged ? 'ring-2 ring-amber-300' : ''}`}>{r.doi || '—'}</span>
                        {doiChanged && <span className="text-[11px] text-rose-800">(trước: {text(was?.doi) || '—'})</span>}
                        <div className="ml-auto">
                          {r.isCited ? (
                            <span className="text-[10px] font-bold bg-lime-200/70 text-lime-700 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs"><CheckCircle className="w-3 h-3" /> Đã cite trong bài</span>
                          ) : (
                            <span className="text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-600" /> Chưa gọi cite</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {removed('reference').map((c) => (
                <div key={c.id} data-change="removed" className={`p-3.5 rounded-3xl flex items-start gap-3 ${KIND_BOX.removed}`}>
                  <span className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-1">{String(c.before?.id ?? '')}</span>
                  <div className="min-w-0"><Badge kind="removed" /><p className="text-xs"><del className="text-rose-900">{String(c.before?.raw ?? '')}</del></p></div>
                </div>
              ))}
              {references.length === 0 && removed('reference').length === 0 && (
                <div className="p-8 text-center rounded-3xl bg-gray-200/50"><Quote className="w-8 h-8 text-zinc-400 mx-auto" /><p className="text-sm font-semibold text-zinc-600 mt-2">Chưa có tài liệu tham khảo nào trong danh sách.</p></div>
              )}
            </div>
          </div>
        )}

        {active === 'citation' && (
          <div className="p-4 sm:p-5 space-y-5">
            <PartTitle icon={<Bookmark className="w-4 h-4 text-zinc-700" />}>Trích Dẫn Bài Báo Này (How to Cite)</PartTitle>
            <ValueBox
              label="Nội dung trích dẫn bài báo:"
              value={text(citation?.content)}
              change={field('citation')}
              box="p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed text-zinc-900 min-h-[96px]"
              right={<span className="text-[11px] font-bold text-zinc-500">{wordsOf(text(citation?.content))} từ &bull; {text(citation?.content).length} ký tự</span>}
              empty="Chưa có trích dẫn"
              testId="doc-citation"
            />
          </div>
        )}

        {active === 'layout' && (
          <div className={PANEL} data-testid="doc-layout">
            <PartTitle icon={<LayoutTemplate className="w-4 h-4 text-zinc-700" />} hint="Chỉ gồm phần tác giả đã đổi so với quy tắc của tạp chí; còn lại bài theo đúng quy tắc tạp chí. Cài đặt của từng bảng, hình và khối nằm ở tab Nội dung.">
              Dàn trang của bài
            </PartTitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {Object.entries(layoutNow).map(([path, v]) => (
                <ValueBox key={path} small label={`${layoutLabel(path)}:`} value={v} change={compare ? diff?.layout.find((x) => x.path === `layout.${path}`) : undefined} box="p-2.5 rounded-xl text-xs text-zinc-900" />
              ))}
              {layoutRemoved.map((f) => (
                <div key={f.path} data-change="removed" className={`rounded-2xl p-3 ${KIND_BOX.removed}`}>
                  <label className="text-[10px] font-bold text-zinc-600 block mb-1">{f.label}:</label>
                  <p className="text-xs"><del className="text-rose-900">{f.before}</del> <span className="text-rose-700">(đã bỏ, theo quy tắc tạp chí)</span></p>
                </div>
              ))}
            </div>
            {Object.keys(layoutNow).length === 0 && layoutRemoved.length === 0 && <p className="text-xs font-bold text-zinc-400">Bài theo đúng quy tắc tạp chí, chưa có thay đổi riêng.</p>}
          </div>
        )}
      </div>

    </div>

      {/* in the margin beside the frame, at its lower corner: never over the content */}
      {compare && found > 0 && (
        <div className="shrink-0 self-end mb-1 flex flex-col items-center gap-1 rounded-full bg-white p-1 shadow-lg" data-testid="detail-nav">
          <button type="button" onClick={() => jump(-1)} aria-label="Thay đổi trước" title="Thay đổi trước (trong tab này)" data-testid="detail-prev" className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-900 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer">
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="text-[10px] font-extrabold text-zinc-600 tabular-nums" data-testid="detail-nav-position">{cursor < 0 ? '–' : cursor + 1}/{found}</span>
          <button type="button" onClick={() => jump(1)} aria-label="Thay đổi tiếp theo" title="Thay đổi tiếp theo (trong tab này)" data-testid="detail-next" className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-900 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
