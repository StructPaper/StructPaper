'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, CopyPlus } from 'lucide-react';
import {
  diffDocs,
  diffInline,
  flattenLayout,
  layoutLabel,
  type BlockChange,
  type DocDiff,
  type FieldChange,
  type InlineSegment,
  type ItemChange,
} from '@structpaper/doc-diff';

type Json = Record<string, any>;

interface DocumentDiffViewProps {
  /** The paper as it is in the version on screen. */
  doc: Json;
  /** The version it is compared with (older), or null to just read the version. */
  compareTo?: Json | null;
  /** Mark what changed. */
  showChanges: boolean;
  /** When given, every block shows a button that takes it into the paper as it is now (used on older versions). */
  onInsertBlock?: (section: Json) => void;
}

export const KIND_LABEL: Record<string, string> = { added: 'Mới', removed: 'Đã xóa', modified: 'Đã sửa', moved: 'Đã di chuyển' };
export const KIND_BOX: Record<string, string> = {
  added: 'border-l-4 border-emerald-400 bg-emerald-50/60',
  removed: 'border-l-4 border-rose-400 bg-rose-50/60',
  modified: 'border-l-4 border-amber-400 bg-amber-50/50',
  moved: 'border-l-4 border-sky-300 bg-sky-50/50',
};
const KIND_BADGE: Record<string, string> = {
  added: 'bg-emerald-200 text-emerald-900',
  removed: 'bg-rose-200 text-rose-900',
  modified: 'bg-amber-200 text-amber-900',
  moved: 'bg-sky-200 text-sky-900',
};

/** Text with the added words green and the removed words red and struck through. */
export const Marked: React.FC<{ segments: InlineSegment[] }> = ({ segments }) => (
  <>
    {segments.map((s, i) =>
      s.type === 'same' ? (
        <React.Fragment key={i}>{s.text}</React.Fragment>
      ) : s.type === 'add' ? (
        <ins key={i} className="bg-emerald-200/80 text-emerald-950 no-underline rounded-[3px] px-px" data-testid="mark-add">{s.text}</ins>
      ) : (
        <del key={i} className="bg-rose-200/80 text-rose-900 rounded-[3px] px-px" data-testid="mark-del">{s.text}</del>
      ),
    )}
  </>
);

export const Badge: React.FC<{ kind: string }> = ({ kind }) => (
  <span className={`inline-block mb-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${KIND_BADGE[kind]}`}>{KIND_LABEL[kind]}</span>
);

export const personName = (a: Json) => String(a.name || a.fullName || a.nameEn || a.id || '');
export const text = (v: unknown): string => (v === undefined || v === null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v));

/** A table cell's text, from either shape the paper keeps. */
const cellText = (c: unknown): string => (typeof c === 'string' ? c : c && typeof c === 'object' ? String((c as Json).text ?? '') : '');

export function tableRows(t: Json | undefined): { header: string[]; body: string[][] } {
  if (!t) return { header: [], body: [] };
  const header = Array.isArray(t.headers) && t.headers.length ? t.headers.map(cellText) : (t.headerRows?.[0] ?? []).map(cellText);
  const body = Array.isArray(t.rows) && t.rows.length ? t.rows.map((r: unknown[]) => r.map(cellText)) : (t.bodyRows ?? []).map((r: unknown[]) => r.map(cellText));
  return { header, body };
}

export const TableBlock: React.FC<{ table: Json; before?: Json; compare: boolean }> = ({ table, before, compare }) => {
  const now = tableRows(table);
  const was = tableRows(before);
  const changed = (r: number, c: number) => compare && !!before && (was.body[r]?.[c] ?? null) !== (now.body[r]?.[c] ?? null);
  return (
    <div className="overflow-x-auto">
      {table.caption && <p className="text-xs font-bold text-zinc-700 mb-1">Bảng {table.num ?? ''}: {table.caption}</p>}
      <table className="text-[11px] border-collapse w-full">
        {now.header.length > 0 && (
          <thead>
            <tr>
              {now.header.map((h, c) => (
                <th key={c} className="border border-zinc-300 bg-zinc-100 px-2 py-1 text-left font-bold">{h}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {now.body.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c} className={`border border-zinc-300 px-2 py-1 ${changed(r, c) ? 'bg-amber-200/70' : ''}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.source && <p className="text-[11px] italic text-zinc-500 mt-1">{table.source}</p>}
    </div>
  );
};

/** The body of one block, in the way it reads on the page. */
export const BlockBody: React.FC<{ section: Json; before?: Json; change?: BlockChange; compare: boolean }> = ({ section, before, change, compare }) => {
  const marks = compare && change?.inline && change.kind !== 'moved' ? change.inline : null;
  const body = (plain: string) => (marks ? <Marked segments={marks} /> : <>{plain}</>);
  switch (section.type) {
    case 'h1':
      return <h3 className="text-base font-extrabold text-zinc-900 mt-1">{marks ? <Marked segments={marks} /> : section.title || section.content}</h3>;
    case 'h2':
    case 'h3':
      return <h4 className="text-sm font-bold text-zinc-800">{marks ? <Marked segments={marks} /> : section.title || section.content}</h4>;
    case 'table':
      return <TableBlock table={section.table ?? {}} before={before?.table} compare={compare} />;
    case 'figure':
      return (
        <figure className="space-y-1">
          {typeof section.figure?.src === 'string' && /^(https?:|data:|blob:|\/)/.test(section.figure.src) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={section.figure.src} alt={section.figure?.caption ?? ''} className="max-h-72 rounded-xl border border-zinc-200" />
          ) : (
            <div className="h-20 rounded-xl bg-zinc-100 text-zinc-400 text-xs font-bold flex items-center justify-center">Hình {section.figure?.num ?? ''}</div>
          )}
          <figcaption className="text-xs text-zinc-600">Hình {section.figure?.num ?? ''}: {section.figure?.caption}{section.figure?.source ? ` (${section.figure.source})` : ''}</figcaption>
        </figure>
      );
    case 'equation':
      return <p className="font-mono text-xs bg-white/70 rounded-xl px-3 py-2 break-all">{section.equation?.latex ?? section.content}{section.equation?.numbered && section.equation?.num ? `   (${section.equation.num})` : ''}</p>;
    case 'quote':
      return <blockquote className="border-l-4 border-zinc-300 pl-3 italic text-[13px] text-zinc-700 whitespace-pre-wrap">{body(section.content ?? '')}</blockquote>;
    case 'box':
      return <div className="rounded-2xl bg-sky-50 px-3 py-2 text-[13px] text-zinc-800 whitespace-pre-wrap">{section.title && <b className="block">{section.title}</b>}{body(section.content ?? '')}</div>;
    default:
      return <p className="text-[13px] leading-relaxed text-zinc-800 whitespace-pre-wrap">{body(section.content ?? '')}</p>;
  }
};

export interface Row {
  section: Json;
  before?: Json;
  change?: BlockChange;
}

/** The new blocks in order, with the removed ones put back after the block that used to come before them. */
export function buildRows(doc: Json, compareTo: Json | null | undefined, diff: DocDiff | null): Row[] {
  const sections = (doc.sections ?? []).filter((s: Json) => s.type !== 'citation');
  const byId = new Map<string, BlockChange>((diff?.blocks ?? []).map((b) => [b.id, b]));
  const rows: Row[] = sections.map((section: Json) => ({ section, change: byId.get(String(section.id)), before: byId.get(String(section.id))?.before }));
  if (!diff || !compareTo) return rows;

  const oldSections = (compareTo.sections ?? []).filter((s: Json) => s.type !== 'citation');
  const present = new Set(sections.map((s: Json) => String(s.id)));
  for (const b of diff.blocks.filter((x) => x.kind === 'removed')) {
    let at = 0;
    for (let i = b.index - 1; i >= 0; i--) {
      const prevId = String(oldSections[i]?.id);
      if (present.has(prevId)) {
        at = rows.findIndex((r) => String(r.section.id) === prevId) + 1;
        break;
      }
    }
    rows.splice(at, 0, { section: b.before ?? {}, change: b });
  }
  return rows;
}

/** What differs between two versions of one author, in words. */
export function authorChanges(a: Json | undefined, b: Json | undefined): string[] {
  if (!a || !b) return [];
  const out: string[] = [];
  if (a.name !== b.name) out.push(`tên: ${a.name} → ${b.name}`);
  if (text(a.affiliationIds) !== text(b.affiliationIds)) out.push(`đơn vị: ${text(a.affiliationIds) || '—'} → ${text(b.affiliationIds) || '—'}`);
  if (!!a.isCorresponding !== !!b.isCorresponding) out.push(b.isCorresponding ? 'trở thành tác giả liên hệ' : 'không còn là tác giả liên hệ');
  if ((a.email ?? '') !== (b.email ?? '')) out.push(`email: ${a.email || '—'} → ${b.email || '—'}`);
  if ((a.orcid ?? '') !== (b.orcid ?? '')) out.push(`ORCID: ${a.orcid || '—'} → ${b.orcid || '—'}`);
  return out;
}

/** A labelled line of the paper's information. */
export interface InfoRow {
  label: string;
  /** Path(s) of the diff field(s) this row shows. */
  paths: string[];
  value: string;
}

/** The article's information as labelled lines, in the order the metadata tab asks for it. */
export function infoRowsOf(meta: Json): InfoRow[] {
  const pub = (meta.publication ?? {}) as Json;
  return [
    { label: 'Loại bài', paths: ['metadata.articleType'], value: text(meta.articleType) },
    { label: 'Loại bài (tiếng Anh)', paths: ['metadata.articleTypeEn'], value: text(meta.articleTypeEn) },
    { label: 'Tạp chí', paths: ['metadata.journalName', 'metadata.journalId'], value: [meta.journalName, meta.journalId].filter(Boolean).join(' · ') },
    { label: 'Tên viết tắt tạp chí', paths: ['metadata.journalAbbv'], value: text(meta.journalAbbv) },
    { label: 'Tập', paths: ['metadata.publication.volume', 'metadata.volume'], value: text(pub.volume ?? meta.volume) },
    { label: 'Số', paths: ['metadata.publication.issue', 'metadata.issue'], value: text(pub.issue ?? meta.issue) },
    { label: 'Năm', paths: ['metadata.year'], value: text(meta.year) },
    { label: 'Trang đầu', paths: ['metadata.publication.firstPage', 'metadata.firstPage'], value: text(pub.firstPage ?? meta.firstPage) },
    { label: 'Trang cuối', paths: ['metadata.publication.lastPage', 'metadata.lastPage'], value: text(pub.lastPage ?? meta.lastPage) },
    { label: 'DOI', paths: ['metadata.publication.doi', 'metadata.doi'], value: text(pub.doi ?? meta.doi) },
    { label: 'Mã bài trên nền tảng tạp chí', paths: ['metadata.publication.articleId'], value: text(pub.articleId) },
    { label: 'Ngày nhận', paths: ['metadata.dates.received'], value: text(meta.dates?.received) },
    { label: 'Ngày sửa đổi', paths: ['metadata.dates.revised'], value: text(meta.dates?.revised) },
    { label: 'Ngày chấp nhận', paths: ['metadata.dates.accepted'], value: text(meta.dates?.accepted) },
    { label: 'Ngày xuất bản', paths: ['metadata.publication.published', 'metadata.dates.published'], value: text(pub.published ?? meta.dates?.published) },
    { label: 'Tác giả liên hệ', paths: ['metadata.corresponding.name'], value: text(meta.corresponding?.name) },
    { label: 'Email liên hệ', paths: ['metadata.corresponding.email'], value: text(meta.corresponding?.email) },
    { label: 'Đơn vị tác giả liên hệ', paths: ['metadata.corresponding.affiliation'], value: text(meta.corresponding?.affiliation) },
  ];
}

/**
 * A version of the paper laid out to read, with everything the editor's tabs hold: the information about the article
 * (type, journal, volume, issue, pages, DOI, dates), authors with their units, e-mail and ORCID, abstract and keywords in
 * both languages, the body (headings, paragraphs, figures, tables, equations, quotes, boxes), the citation, the references
 * and the page layout. What changed since an older version is marked: new words green, removed words red, blocks boxed
 * and labelled, and buttons jump from one change to the next.
 */
export const DocumentDiffView: React.FC<DocumentDiffViewProps> = ({ doc, compareTo, showChanges, onInsertBlock }) => {
  const compare = showChanges && !!compareTo;
  const diff = useMemo(() => (compare ? diffDocs(compareTo, doc) : null), [compare, compareTo, doc]);
  const rows = useMemo(() => buildRows(doc, compareTo, diff), [doc, compareTo, diff]);
  const root = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState(-1);

  const meta = (doc.metadata ?? {}) as Json;
  const pub = (meta.publication ?? {}) as Json;
  const field = (path: string): FieldChange | undefined => diff?.fields.find((f) => f.path === path);
  const item = (scope: ItemChange['scope'], id: unknown) => diff?.items.find((i) => i.scope === scope && i.id === String(id));
  const removedItems = (scope: ItemChange['scope']) => (diff?.items ?? []).filter((i) => i.scope === scope && i.kind === 'removed');

  /** A value, or its word-level diff when it changed. */
  const val = (path: string, value: unknown) => {
    const f = compare ? field(path) : undefined;
    return f ? <Marked segments={f.inline} /> : <>{text(value)}</>;
  };
  const changedAt = (...paths: string[]) => compare && paths.some((p) => !!field(p));

  // the article's information, in the order the metadata tab asks for it
  const info = infoRowsOf(meta);
  const shownInfo = info.filter((r) => r.value !== '' || changedAt(...r.paths));
  const shownPaths = new Set(['metadata.title', 'metadata.titleEn', 'metadata.abstract', 'metadata.abstractEn', 'metadata.keywords', 'metadata.keywordsEn', 'citation', ...info.flatMap((r) => r.paths)]);
  const otherFields = (diff?.fields ?? []).filter((f) => !shownPaths.has(f.path));

  const citation = (doc.sections ?? []).find((s: Json) => s.type === 'citation');
  const layoutNow = flattenLayout(doc.layoutSettings);
  const layoutRemoved = (diff?.layout ?? []).filter((f) => f.kind === 'removed');

  const jump = useCallback((dir: 1 | -1) => {
    const nodes = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-change]') ?? []);
    if (nodes.length === 0) return;
    const next = (cursor + dir + nodes.length) % nodes.length;
    setCursor(next);
    nodes[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
    nodes[next].classList.add('ring-2', 'ring-zinc-900/30');
    setTimeout(() => nodes[next].classList.remove('ring-2', 'ring-zinc-900/30'), 900);
  }, [cursor]);

  const changeCount = diff ? diff.fields.length + diff.layout.length + diff.items.length + diff.blocks.length : 0;
  const authorMarks = (a: Json) => {
    const c = item('author', a.id ?? personName(a));
    return { c, notes: c?.kind === 'modified' ? authorChanges(c.before, c.after) : [] };
  };

  return (
    <div ref={root} className="h-full overflow-y-auto" data-testid="document-diff-view">
      {compare && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-white/90 backdrop-blur px-3 py-2 shadow-2xs" data-testid="diff-summary">
          {diff!.isEmpty ? (
            <span className="text-xs font-bold text-zinc-500">Không có thay đổi so với bản được chọn để so sánh.</span>
          ) : (
            <>
              <span className="text-xs font-extrabold text-zinc-800">{changeCount} thay đổi</span>
              {diff!.stats.blocksAdded > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10.5px] font-bold">+{diff!.stats.blocksAdded} khối mới</span>}
              {diff!.stats.blocksRemoved > 0 && <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10.5px] font-bold">−{diff!.stats.blocksRemoved} khối xóa</span>}
              {diff!.stats.blocksModified > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10.5px] font-bold">{diff!.stats.blocksModified} khối sửa</span>}
              {diff!.stats.wordsDelta !== 0 && <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700 text-[10.5px] font-bold">{diff!.stats.wordsDelta > 0 ? '+' : '−'}{Math.abs(diff!.stats.wordsDelta)} từ</span>}
              <span className="flex-1" />
              <button type="button" onClick={() => jump(-1)} aria-label="Thay đổi trước" data-testid="diff-prev" className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-900 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => jump(1)} aria-label="Thay đổi tiếp theo" data-testid="diff-next" className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-900 hover:text-white flex items-center justify-center transition-all active:scale-90 cursor-pointer">
                <ChevronDown className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )}

      <article className="mx-auto max-w-[820px] bg-white rounded-[28px] shadow-sm px-6 sm:px-10 py-8 space-y-5">
        <header className="space-y-2">
          <h1 className="text-xl font-black text-zinc-900 leading-snug" data-change={changedAt('metadata.title') ? 'modified' : undefined}>{val('metadata.title', meta.title) || 'Chưa có tiêu đề'}</h1>
          {(meta.titleEn || field('metadata.titleEn')) && <p className="text-sm italic text-zinc-600" data-change={changedAt('metadata.titleEn') ? 'modified' : undefined}>{val('metadata.titleEn', meta.titleEn)}</p>}

          <ul className="space-y-1 pt-1" data-testid="doc-authors">
            {(meta.authors ?? []).map((a: Json) => {
              const { c, notes } = authorMarks(a);
              return (
                <li key={String(a.id ?? personName(a))} data-change={compare && c ? c.kind : undefined} className={`text-xs ${c && compare ? (c.kind === 'added' ? 'bg-emerald-100/80 rounded-xl px-2 py-1' : 'bg-amber-100/80 rounded-xl px-2 py-1') : ''}`}>
                  <span className="font-bold text-zinc-800">{personName(a)}</span>
                  {Array.isArray(a.affiliationIds) && a.affiliationIds.length > 0 && <sup className="text-zinc-500 font-semibold"> {a.affiliationIds.join(',')}</sup>}
                  {a.isCorresponding && <span className="ml-1 px-1.5 py-px rounded-full bg-zinc-900 text-white text-[9.5px] font-bold">liên hệ</span>}
                  {(a.email || a.orcid) && (
                    <span className="block text-[11px] text-zinc-500">{[a.email, a.orcid && `ORCID ${a.orcid}`].filter(Boolean).join(' · ')}</span>
                  )}
                  {notes.length > 0 && <span className="block text-[11px] text-amber-800">Đã sửa: {notes.join('; ')}</span>}
                </li>
              );
            })}
            {compare && removedItems('author').map((c) => (
              <li key={c.id} data-change="removed" className="text-xs bg-rose-100/80 rounded-xl px-2 py-1"><del className="text-rose-900 font-bold">{personName(c.before ?? {})}</del> <span className="text-rose-700 text-[11px]">(đã xóa)</span></li>
            ))}
          </ul>

          <ul className="text-[11px] text-zinc-500 space-y-0.5" data-testid="doc-affiliations">
            {(meta.affiliations ?? []).map((a: Json) => {
              const c = item('affiliation', a.id ?? a.name);
              const nameMarks = compare && c?.kind === 'modified' ? diffInline(text(c.before?.name), text(a.name)) : null;
              return (
                <li key={String(a.id ?? a.name)} data-change={compare && c ? c.kind : undefined} className={c && compare ? (c.kind === 'added' ? 'bg-emerald-100/70 rounded px-1' : 'bg-amber-100/70 rounded px-1') : ''}>
                  {a.id}. {nameMarks ? <Marked segments={nameMarks} /> : a.name}
                  {a.nameEn && <span className="italic"> / {a.nameEn}</span>}
                </li>
              );
            })}
            {compare && removedItems('affiliation').map((c) => (
              <li key={c.id} data-change="removed"><del className="bg-rose-100 text-rose-800 rounded px-1">{String(c.before?.name ?? '')}</del></li>
            ))}
          </ul>
        </header>

        {shownInfo.length > 0 && (
          <section className="rounded-2xl bg-gray-100/70 p-3.5" data-testid="doc-info">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">Thông tin bài báo</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {shownInfo.map((r) => (
                <div key={r.label} data-change={changedAt(...r.paths) ? 'modified' : undefined} className={`flex gap-2 text-xs rounded-lg px-1 ${changedAt(...r.paths) ? 'bg-amber-100/70' : ''}`}>
                  <dt className="shrink-0 font-bold text-zinc-500 w-[7.5rem]">{r.label}</dt>
                  <dd className="min-w-0 text-zinc-800 break-words">
                    {r.paths.map((p) => field(p)).find(Boolean) && compare ? (
                      <span className="space-y-0.5 block">
                        {r.paths.map((p) => field(p)).filter(Boolean).map((f) => <span key={f!.path} className="block"><Marked segments={f!.inline} /></span>)}
                      </span>
                    ) : (
                      r.value || '—'
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {(meta.abstract || field('metadata.abstract')) && (
          <section data-change={changedAt('metadata.abstract') ? 'modified' : undefined}>
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">Tóm tắt</h2>
            <p className="text-[13px] leading-relaxed text-zinc-800 whitespace-pre-wrap">{val('metadata.abstract', meta.abstract)}</p>
          </section>
        )}
        {((meta.keywords ?? []).length > 0 || field('metadata.keywords')) && (
          <p className="text-xs text-zinc-700" data-change={changedAt('metadata.keywords') ? 'modified' : undefined}><b>Từ khóa:</b> {val('metadata.keywords', meta.keywords)}</p>
        )}
        {(meta.abstractEn || field('metadata.abstractEn')) && (
          <section data-change={changedAt('metadata.abstractEn') ? 'modified' : undefined}>
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">Abstract</h2>
            <p className="text-[13px] leading-relaxed text-zinc-700 italic whitespace-pre-wrap">{val('metadata.abstractEn', meta.abstractEn)}</p>
          </section>
        )}
        {((meta.keywordsEn ?? []).length > 0 || field('metadata.keywordsEn')) && (
          <p className="text-xs text-zinc-700 italic" data-change={changedAt('metadata.keywordsEn') ? 'modified' : undefined}><b>Keywords:</b> {val('metadata.keywordsEn', meta.keywordsEn)}</p>
        )}

        {compare && otherFields.length > 0 && (
          <section className="rounded-2xl bg-amber-50/70 p-3 space-y-1" data-change="modified" data-testid="diff-other-fields">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800">Thông tin khác đã đổi</h2>
            {otherFields.map((f) => (
              <p key={f.path} className="text-xs text-zinc-800"><b>{f.label}:</b> <Marked segments={f.inline} /></p>
            ))}
          </section>
        )}

        <div className="space-y-3" data-testid="doc-body">
          {rows.map(({ section, before, change }, i) => {
            const kind = compare ? change?.kind : undefined;
            return (
              <div key={`${section.id}-${i}`} data-change={kind} data-block={section.id} className={`group/block relative rounded-2xl px-3 py-2 transition-shadow ${kind ? KIND_BOX[kind] : ''}`}>
                {onInsertBlock && kind !== 'removed' && (
                  <button
                    type="button"
                    onClick={() => onInsertBlock(section)}
                    data-testid={`insert-block-${section.id}`}
                    title="Chèn khối này vào bài hiện tại"
                    className="absolute right-2 top-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-zinc-900 text-white text-[10.5px] font-bold opacity-0 group-hover/block:opacity-100 focus:opacity-100 transition-all cursor-pointer active:scale-95"
                  >
                    <CopyPlus className="w-3 h-3" />
                    Chèn vào bài hiện tại
                  </button>
                )}
                {kind && <Badge kind={kind} />}
                <BlockBody section={section} before={before} change={change} compare={compare} />
              </div>
            );
          })}
          {rows.length === 0 && <p className="text-xs font-bold text-zinc-400 text-center py-6">Phiên bản này chưa có nội dung.</p>}
        </div>

        {(citation?.content || field('citation')) && (
          <section className="rounded-2xl bg-gray-100/70 p-3.5" data-change={changedAt('citation') ? 'modified' : undefined} data-testid="doc-citation">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-1">{citation?.title || 'Trích dẫn bài báo này'}</h2>
            <p className="text-xs text-zinc-800 whitespace-pre-wrap">{val('citation', citation?.content)}</p>
          </section>
        )}

        {((doc.references ?? []).length > 0 || (compare && removedItems('reference').length > 0)) && (
          <section className="space-y-1.5" data-testid="doc-references">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400">Tài liệu tham khảo</h2>
            <ol className="space-y-1 text-xs text-zinc-700">
              {(doc.references ?? []).map((r: Json) => {
                const c = item('reference', r.id ?? r.raw);
                const marks = compare && c?.kind === 'modified' ? diffInline(text(c.before?.raw), text(r.raw)) : null;
                return (
                  <li key={String(r.id ?? r.raw)} data-change={compare && c ? c.kind : undefined} className={c && compare ? (c.kind === 'added' ? 'bg-emerald-100/70 rounded px-1.5 py-0.5' : 'bg-amber-100/70 rounded px-1.5 py-0.5') : ''}>
                    [{r.id}] {marks ? <Marked segments={marks} /> : r.raw}
                  </li>
                );
              })}
              {compare && removedItems('reference').map((c) => (
                <li key={c.id} data-change="removed" className="bg-rose-100/70 rounded px-1.5 py-0.5"><del className="text-rose-800">[{String(c.before?.id ?? '')}] {String(c.before?.raw ?? '')}</del></li>
              ))}
            </ol>
          </section>
        )}

        {(Object.keys(layoutNow).length > 0 || layoutRemoved.length > 0) && (
          <section className="rounded-2xl bg-gray-100/70 p-3.5" data-testid="doc-layout">
            <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">Dàn trang của bài (phần tác giả đã đổi so với quy tắc tạp chí)</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {Object.entries(layoutNow).map(([path, value]) => {
                const f = compare ? diff?.layout.find((x) => x.path === `layout.${path}`) : undefined;
                return (
                  <div key={path} data-change={f ? 'modified' : undefined} className={`flex gap-2 text-xs rounded-lg px-1 ${f ? 'bg-amber-100/70' : ''}`}>
                    <dt className="shrink-0 font-bold text-zinc-500 w-[9rem]">{layoutLabel(path)}</dt>
                    <dd className="min-w-0 text-zinc-800 break-words">{f ? <Marked segments={f.inline} /> : value}</dd>
                  </div>
                );
              })}
              {compare && layoutRemoved.map((f) => (
                <div key={f.path} data-change="removed" className="flex gap-2 text-xs rounded-lg px-1 bg-rose-100/70">
                  <dt className="shrink-0 font-bold text-zinc-500 w-[9rem]">{f.label}</dt>
                  <dd><del className="text-rose-800">{f.before}</del> <span className="text-rose-700">(đã bỏ, theo quy tắc tạp chí)</span></dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </article>
    </div>
  );
};
