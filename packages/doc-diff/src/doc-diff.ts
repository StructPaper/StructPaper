import { diffInline, countWords, type InlineSegment } from './inline-diff';

/**
 * Compares two versions of a paper the way an author reads it: what happened to the metadata fields, to the authors
 * and references, and to each block of the body. Blocks, authors and references have stable ids, so "this paragraph
 * was edited" is told apart from "that one was deleted and another added", and a block that only moved is a move.
 *
 * Pure and dependency free: the browser draws the result, the server only counts it for the revision list.
 */
type Json = Record<string, any>;

export interface DocLike {
  metadata?: Json;
  sections?: Json[];
  references?: Json[];
  layoutSettings?: Json;
  [key: string]: unknown;
}

export type ChangeKind = 'added' | 'removed' | 'modified' | 'moved';

export interface FieldChange {
  /** "metadata.title" */
  path: string;
  label: string;
  kind: 'added' | 'removed' | 'modified';
  before: string;
  after: string;
  /** Word level diff for text fields. */
  inline: InlineSegment[];
}

export interface ItemChange {
  scope: 'author' | 'affiliation' | 'reference';
  id: string;
  kind: 'added' | 'removed' | 'modified';
  label: string;
  before?: Json;
  after?: Json;
}

export interface BlockChange {
  id: string;
  kind: ChangeKind;
  /** h1, paragraph, table... */
  type: string;
  /** Position in the newer paper (or the older, for a removed block). */
  index: number;
  before?: Json;
  after?: Json;
  /** Text of the block (title + content) compared word by word. */
  inline?: InlineSegment[];
  /** What else changed in the block: "table", "figure", "equation", "type", "layout". */
  fields: string[];
}

export interface DiffStats {
  blocksAdded: number;
  blocksRemoved: number;
  blocksModified: number;
  blocksMoved: number;
  wordsDelta: number;
  refsDelta: number;
  fieldsChanged: number;
  itemsChanged: number;
  layoutChanged: boolean;
}

export interface DocDiff {
  fields: FieldChange[];
  /** The page-layout settings of the paper that changed, one entry each. */
  layout: FieldChange[];
  items: ItemChange[];
  blocks: BlockChange[];
  layoutChanged: boolean;
  stats: DiffStats;
  isEmpty: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Tiêu đề',
  titleEn: 'Tiêu đề (tiếng Anh)',
  abstract: 'Tóm tắt',
  abstractEn: 'Tóm tắt (tiếng Anh)',
  keywords: 'Từ khóa',
  keywordsEn: 'Từ khóa (tiếng Anh)',
  articleType: 'Loại bài',
  articleTypeEn: 'Loại bài (tiếng Anh)',
  articleTypeCode: 'Mã loại bài',
  journalId: 'Tạp chí',
  journalName: 'Tên tạp chí',
  journalAbbv: 'Tên viết tắt tạp chí',
  doi: 'DOI',
  volume: 'Tập',
  issue: 'Số',
  year: 'Năm',
  firstPage: 'Trang đầu',
  lastPage: 'Trang cuối',
  'publication.volume': 'Tập (do tòa soạn cấp)',
  'publication.issue': 'Số (do tòa soạn cấp)',
  'publication.firstPage': 'Trang đầu (do tòa soạn cấp)',
  'publication.lastPage': 'Trang cuối (do tòa soạn cấp)',
  'publication.doi': 'DOI (do tòa soạn cấp)',
  'publication.published': 'Ngày xuất bản',
  'publication.articleId': 'Mã bài trên nền tảng tạp chí',
  'dates.received': 'Ngày nhận',
  'dates.revised': 'Ngày sửa',
  'dates.accepted': 'Ngày chấp nhận',
  'dates.published': 'Ngày xuất bản',
  'corresponding.name': 'Tác giả liên hệ',
  'corresponding.email': 'Email liên hệ',
  'corresponding.affiliation': 'Đơn vị tác giả liên hệ',
};

const str = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ');
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

function pick(meta: Json | undefined, path: string): unknown {
  return path.split('.').reduce<any>((acc, key) => (acc === undefined || acc === null ? undefined : acc[key]), meta);
}

const stable = (v: unknown): string => JSON.stringify(sortKeys(v));
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as Json).sort().map((k) => [k, sortKeys((v as Json)[k])]));
  return v;
}

const sectionId = (s: Json, index: number): string => (s.id !== undefined && s.id !== null ? String(s.id) : `#${index}`);
const sectionText = (s: Json): string => [s.title, s.content].filter((x) => typeof x === 'string' && x).join('\n');

/** What a block contains besides its text, as a name for the list ("table", "figure"...). */
function changedParts(a: Json, b: Json): string[] {
  const parts: string[] = [];
  if (a.type !== b.type) parts.push('type');
  if (stable(a.table) !== stable(b.table)) parts.push('table');
  if (stable(a.figure) !== stable(b.figure)) parts.push('figure');
  if (stable(a.equation) !== stable(b.equation)) parts.push('equation');
  if (stable(a.pageLayout) !== stable(b.pageLayout) || a.pageBreakAfter !== b.pageBreakAfter) parts.push('layout');
  return parts;
}

/** Ids that kept their relative order stay; the rest of the common ids moved (longest increasing run of new positions). */
function movedIds(oldIds: string[], newIds: string[]): Set<string> {
  const newPos = new Map(newIds.map((id, i) => [id, i]));
  const common = oldIds.filter((id) => newPos.has(id));
  const seq = common.map((id) => newPos.get(id)!);
  // longest increasing subsequence, O(n log n)
  const tails: number[] = [];
  const tailIdx: number[] = [];
  const prev: number[] = new Array(seq.length).fill(-1);
  for (let i = 0; i < seq.length; i++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < seq[i]) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = seq[i];
    tailIdx[lo] = i;
    prev[i] = lo > 0 ? tailIdx[lo - 1] : -1;
  }
  const stay = new Set<number>();
  for (let k = tailIdx[tails.length - 1]; k !== undefined && k >= 0; k = prev[k]) stay.add(k);
  const moved = new Set<string>();
  common.forEach((id, i) => {
    if (!stay.has(i)) moved.add(id);
  });
  return moved;
}

function diffItems<T extends Json>(scope: ItemChange['scope'], before: T[], after: T[], key: (x: T) => string, label: (x: T) => string): ItemChange[] {
  const out: ItemChange[] = [];
  const old = new Map(before.map((x) => [key(x), x]));
  const seen = new Set<string>();
  for (const item of after) {
    const k = key(item);
    seen.add(k);
    const was = old.get(k);
    if (!was) out.push({ scope, id: k, kind: 'added', label: label(item), after: item });
    else if (stable(was) !== stable(item)) out.push({ scope, id: k, kind: 'modified', label: label(item), before: was, after: item });
  }
  for (const [k, item] of old) if (!seen.has(k)) out.push({ scope, id: k, kind: 'removed', label: label(item), before: item });
  return out;
}

/** Names of the paper's own layout settings. */
const LAYOUT_LABELS: Record<string, string> = {
  paperSize: 'Khổ giấy',
  columnLayout: 'Số cột',
  orientation: 'Hướng giấy',
  fontSize: 'Cỡ chữ',
  columnSep: 'Khoảng cách giữa các cột',
  lineSpacing: 'Giãn dòng',
};

/** "pageNumbering.format" -> "Đánh số trang › format". */
export function layoutLabel(path: string): string {
  if (LAYOUT_LABELS[path]) return LAYOUT_LABELS[path];
  const [head, ...rest] = path.split('.');
  const group = head === 'pageNumbering' ? 'Đánh số trang' : head === 'theme' ? 'Giao diện' : (LAYOUT_LABELS[head] ?? head);
  return [group, ...rest].join(' › ');
}

/** Every setting of a layout as "a.b" -> text. */
export function flattenLayout(layout: unknown, prefix = '', out: Record<string, string> = {}): Record<string, string> {
  if (layout && typeof layout === 'object' && !Array.isArray(layout)) {
    for (const [k, v] of Object.entries(layout as Json)) flattenLayout(v, prefix ? `${prefix}.${k}` : k, out);
  } else if (layout !== undefined && layout !== null && prefix) {
    out[prefix] = str(layout);
  }
  return out;
}

/** What the paper says of itself in a "citation" block (the tab "Trích dẫn"). */
const citationText = (d: DocLike): string => {
  const c = (d.sections ?? []).find((s) => s.type === 'citation');
  return c ? str(c.content) : '';
};

export function diffDocs(before: DocLike | null | undefined, after: DocLike | null | undefined): DocDiff {
  const a = before ?? {};
  const b = after ?? {};
  const aMeta = a.metadata ?? {};
  const bMeta = b.metadata ?? {};

  // ---- metadata fields
  const fields: FieldChange[] = [];
  for (const [path, label] of Object.entries(FIELD_LABELS)) {
    const x = str(pick(aMeta, path));
    const y = str(pick(bMeta, path));
    if (x === y) continue;
    fields.push({ path: `metadata.${path}`, label, kind: x === '' ? 'added' : y === '' ? 'removed' : 'modified', before: x, after: y, inline: diffInline(x, y) });
  }

  // the citation block of the "Trích dẫn" tab
  const citeA = citationText(a);
  const citeB = citationText(b);
  if (citeA !== citeB) {
    fields.push({ path: 'citation', label: 'Trích dẫn bài báo này', kind: citeA === '' ? 'added' : citeB === '' ? 'removed' : 'modified', before: citeA, after: citeB, inline: diffInline(citeA, citeB) });
  }

  // ---- authors, affiliations, references
  const authorName = (x: Json) => str(x.name || x.fullName || x.nameEn || x.id);
  const items: ItemChange[] = [
    ...diffItems('author', aMeta.authors ?? [], bMeta.authors ?? [], (x) => str(x.id ?? authorName(x)), authorName),
    ...diffItems('affiliation', aMeta.affiliations ?? [], bMeta.affiliations ?? [], (x) => str(x.id ?? x.name), (x) => str(x.name || x.nameEn || x.id)),
    ...diffItems('reference', a.references ?? [], b.references ?? [], (x) => str(x.id ?? x.raw), (x) => str(x.raw || x.title || x.id).slice(0, 90)),
  ];

  // ---- body blocks
  const aSecs = (a.sections ?? []).filter((s) => s.type !== 'citation');
  const bSecs = (b.sections ?? []).filter((s) => s.type !== 'citation');
  const aIds = aSecs.map(sectionId);
  const bIds = bSecs.map(sectionId);
  const aById = new Map(aSecs.map((s, i) => [aIds[i], s]));
  const bById = new Map(bSecs.map((s, i) => [bIds[i], s]));
  const moved = movedIds(aIds, bIds);

  const blocks: BlockChange[] = [];
  bSecs.forEach((s, i) => {
    const id = bIds[i];
    const was = aById.get(id);
    if (!was) {
      blocks.push({ id, kind: 'added', type: s.type, index: i, after: s, inline: diffInline('', sectionText(s)), fields: [] });
      return;
    }
    const textBefore = sectionText(was);
    const textAfter = sectionText(s);
    const parts = changedParts(was, s);
    const textChanged = textBefore !== textAfter;
    if (textChanged || parts.length > 0) {
      blocks.push({
        id, kind: 'modified', type: s.type, index: i, before: was, after: s,
        inline: textChanged ? diffInline(textBefore, textAfter) : undefined,
        fields: parts,
      });
    } else if (moved.has(id)) {
      blocks.push({ id, kind: 'moved', type: s.type, index: i, before: was, after: s, fields: [] });
    }
  });
  aSecs.forEach((s, i) => {
    const id = aIds[i];
    if (!bById.has(id)) blocks.push({ id, kind: 'removed', type: s.type, index: i, before: s, inline: diffInline(sectionText(s), ''), fields: [] });
  });

  const lA = flattenLayout(a.layoutSettings);
  const lB = flattenLayout(b.layoutSettings);
  const layout: FieldChange[] = [];
  for (const path of [...new Set([...Object.keys(lA), ...Object.keys(lB)])].sort()) {
    if (lA[path] === lB[path]) continue;
    layout.push({
      path: `layout.${path}`,
      label: layoutLabel(path),
      kind: lA[path] === undefined ? 'added' : lB[path] === undefined ? 'removed' : 'modified',
      before: lA[path] ?? '',
      after: lB[path] ?? '',
      inline: diffInline(lA[path] ?? '', lB[path] ?? ''),
    });
  }
  const layoutChanged = layout.length > 0;

  // ---- numbers for the revision list
  const words = (d: DocLike, secs: Json[]) =>
    countWords(str(pick(d.metadata, 'title'))) + countWords(str(pick(d.metadata, 'abstract'))) + secs.reduce((n, s) => n + countWords(sectionText(s)), 0);
  const stats: DiffStats = {
    blocksAdded: blocks.filter((x) => x.kind === 'added').length,
    blocksRemoved: blocks.filter((x) => x.kind === 'removed').length,
    blocksModified: blocks.filter((x) => x.kind === 'modified').length,
    blocksMoved: blocks.filter((x) => x.kind === 'moved').length,
    wordsDelta: words(b, bSecs) - words(a, aSecs),
    refsDelta: (b.references ?? []).length - (a.references ?? []).length,
    fieldsChanged: fields.length,
    itemsChanged: items.length,
    layoutChanged,
  };

  const isEmpty = fields.length === 0 && items.length === 0 && blocks.length === 0 && !layoutChanged;
  return { fields, layout, items, blocks, layoutChanged, stats, isEmpty };
}

/**
 * The part of a paper that counts as its content: what the author wrote and laid out. Two saves with the same
 * content have the same fingerprint; bookkeeping fields (version, timestamps, pins...) are not part of it.
 */
export function contentFingerprintSource(doc: DocLike | null | undefined): string {
  const d = doc ?? {};
  return stable({ metadata: d.metadata ?? {}, sections: d.sections ?? [], references: d.references ?? [], layoutSettings: d.layoutSettings ?? {} });
}

export const EMPTY_STATS: DiffStats = {
  blocksAdded: 0, blocksRemoved: 0, blocksModified: 0, blocksMoved: 0, wordsDelta: 0, refsDelta: 0, fieldsChanged: 0, itemsChanged: 0, layoutChanged: false,
};
