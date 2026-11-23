import { diffInline as diffRaw, type InlineSegment } from '@structpaper/doc-diff';
import { stripMarkup } from '../inline-markup';

/** The words that changed, read without the <b>/<i> tags the text carries (a change of look alone is shown apart). */
const diffInline = (before: string, after: string) => diffRaw(stripMarkup(before), stripMarkup(after));

/** The text is the same but its bold, italic or underline is not. */
const onlyLook = (before: string, after: string) => before !== after && stripMarkup(before) === stripMarkup(after);

/**
 * Three-way comparison for "read the Word file again".
 *
 *   base   = what the importer made of the file when it was first uploaded (kept on the server, never edited)
 *   ours   = the paper as the author has it now (hand edits included)
 *   theirs = what the importer makes of the file now (a newer importer, or a replacement file)
 *
 * The result is a list of proposals the author accepts or drops one by one. A part the author never touched (ours = base) is
 * proposed as "apply" and ticked; a part the author edited by hand is a conflict, kept as it is unless the author ticks it.
 * The page-layout settings of the paper and each block's own settings (columns, orientation, type size, page layout...) are
 * never taken from the file: only the content changes.
 *
 * Block ids are positions ("s_3"), so they do not survive a re-read: blocks of base and theirs are paired by content, and
 * blocks of base and ours by id (ours grew out of base).
 *
 * Pure and dependency free (apart from the word-level text diff), so it is tested without a browser.
 */

type Json = Record<string, any>;

export interface PaperLike {
  metadata?: Json;
  sections?: Json[];
  references?: Json[];
  layoutSettings?: Json;
  [key: string]: unknown;
}

/** Settings of a block, kept from the paper whatever the file says. */
export const BLOCK_SETTING_KEYS = ['pageLayout', 'pageBreakAfter'] as const;
export const TABLE_SETTING_KEYS = ['isFullWidth', 'columnSpan', 'isRotated', 'fontSize', 'rowStretch', 'hasZebraStripes', 'placement', 'breakAcrossPages', 'bodyFill', 'sideColumn'] as const;
export const FIGURE_SETTING_KEYS = ['isFullWidth', 'columnSpan', 'scalePercent', 'alignment', 'placement', 'hasBorder'] as const;

const NOTE_EDITED = 'Bạn đã sửa tay · file không đổi';
const NOTE_DELETED = 'Bạn đã xóa khối này';

export type ProposalScope = 'field' | 'authors' | 'references' | 'block';
export type ProposalKind = 'added' | 'removed' | 'modified';

export interface MergeProposal {
  /** "field:title", "authors", "references", "block:s_3" */
  id: string;
  scope: ProposalScope;
  kind: ProposalKind;
  label: string;
  /** The author changed this part by hand too (or there is no first reading to tell): kept unless ticked. */
  conflict: boolean;
  /** Suggested decision. */
  accept: boolean;
  /** Text of the part now, and as the file says now (for the list). */
  before: string;
  after: string;
  inline: InlineSegment[];
  /** Only the bold, italic or underline differs: the words are the same. */
  formatOnly?: boolean;
  /** Why the author is asked although the file did not change it ("Bạn đã sửa tay..."). */
  note?: string;
  /** A block: the type ("paragraph", "table"...) and the block itself on each side. */
  blockType?: string;
  oursBlock?: Json;
  theirsBlock?: Json;
  /** What else differs in a block besides text ("table", "figure", "equation", "type"). */
  fields?: string[];
}

export interface MergePlan {
  proposals: MergeProposal[];
  /** The new first reading to keep once the author has decided: theirs, with block ids made to match the paper's. */
  newBaseline: PaperLike;
  /** What the file says now. */
  theirs: PaperLike;
  /** No first reading existed: everything differing is a conflict and nothing is ticked. */
  conservative: boolean;
  /** Built with `includeEdits`. */
  includeEdits: boolean;
  isEmpty: boolean;
  /** Ids (in the paper) of the blocks of the file, in the order of the file; internal, used to place added blocks. */
  order: string[];
  /** Added block id -> id of the block of the file just before it (internal). */
  prevOf: Record<string, string | null>;
}

// ---------------------------------------------------------------------------------------------------------------------
// helpers

const isObj = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v);

/** Cheap 32-bit FNV-1a fingerprint of a long string (a picture's data URL). */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fp:${h.toString(16)}-${text.length}`;
}

const isHeavySrc = (s: unknown): s is string => typeof s === 'string' && (s.startsWith('data:') || s.startsWith('blob:'));

/** A copy of the value with pictures' data URLs replaced by their fingerprint (so a stored first reading stays small). */
export function slimForStorage<T>(value: T): T {
  if (Array.isArray(value)) return value.map(slimForStorage) as unknown as T;
  if (isObj(value)) {
    const out: Json = {};
    for (const [k, v] of Object.entries(value)) out[k] = k === 'src' && isHeavySrc(v) ? fingerprint(v) : slimForStorage(v);
    return out as T;
  }
  return value;
}

const stableStringify = (v: unknown): string => JSON.stringify(sortKeys(v));
function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (isObj(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

/** Drops ids (positions that shift when something is inserted) and fingerprints pictures: what is left is the content. */
function strip(v: unknown, drop: Set<string> = new Set()): unknown {
  if (Array.isArray(v)) return v.map((x) => strip(x));
  if (isObj(v)) {
    const out: Json = {};
    for (const [k, x] of Object.entries(v)) {
      if (k === 'id' || drop.has(k) || x === undefined) continue;
      out[k] = k === 'src' && isHeavySrc(x) ? fingerprint(x) : strip(x);
    }
    return out;
  }
  return v;
}

/** A block without its id and without its settings (what the author reads, not how it is set). */
export function blockContent(block: Json): Json {
  const out: Json = {};
  for (const [k, v] of Object.entries(block)) {
    if (k === 'id' || (BLOCK_SETTING_KEYS as readonly string[]).includes(k) || v === undefined) continue;
    if (k === 'table' && isObj(v)) out[k] = strip(v, new Set(TABLE_SETTING_KEYS));
    else if (k === 'figure' && isObj(v)) out[k] = strip(v, new Set([...FIGURE_SETTING_KEYS, 'assetId']));
    else out[k] = strip(v);
  }
  return out;
}

const sameBlock = (a: Json, b: Json): boolean => stableStringify(blockContent(a)) === stableStringify(blockContent(b));
const sameValue = (a: unknown, b: unknown): boolean => stableStringify(strip(a ?? null)) === stableStringify(strip(b ?? null));

const cellText = (c: unknown): string => (typeof c === 'string' ? c : isObj(c) ? String(c.text ?? '') : '');

/** The text of a block as the author reads it. */
export function blockText(s: Json): string {
  const parts: string[] = [];
  if (typeof s.title === 'string') parts.push(s.title);
  if (typeof s.content === 'string') parts.push(s.content);
  if (isObj(s.table)) {
    const t = s.table;
    parts.push(String(t.caption ?? ''));
    if (Array.isArray(t.headers)) parts.push(t.headers.map(cellText).join(' | '));
    if (Array.isArray(t.rows)) for (const r of t.rows) if (Array.isArray(r)) parts.push(r.map(cellText).join(' | '));
  }
  if (isObj(s.figure)) parts.push(String(s.figure.caption ?? ''));
  if (isObj(s.equation)) parts.push(String(s.equation.latex ?? ''));
  return parts.filter(Boolean).join('\n');
}

const normalizeText = (t: string) => stripMarkup(t).toLowerCase().replace(/\s+/g, ' ').trim();

function wordSet(t: string): Set<string> {
  return new Set(normalizeText(t).split(/[^\p{L}\p{N}]+/u).filter(Boolean));
}

/** 0..1: how much two texts share (Jaccard of their words). */
export function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const A = wordSet(a);
  const B = wordSet(b);
  if (A.size === 0 || B.size === 0) return normalizeText(a) === normalizeText(b) ? 1 : 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Pairs the blocks of two readings of the same file, in order: exact matches first, near matches (the same paragraph with a few
 * words changed) when the same kind of block sits in the same place. Returns pairs [indexInA, indexInB].
 */
export function alignBlocks(a: Json[], b: Json[], threshold = 0.5): Array<[number, number]> {
  const n = a.length;
  const m = b.length;
  const textA = a.map(blockText);
  const textB = b.map(blockText);
  const sigA = a.map((s, i) => `${s.type}|${normalizeText(textA[i])}`);
  const sigB = b.map((s, j) => `${s.type}|${normalizeText(textB[j])}`);

  const score = (i: number, j: number): number => {
    if (sigA[i] === sigB[j]) return 2;
    if (a[i].type !== b[j].type) return -1;
    const s = similarity(textA[i], textB[j]);
    return s >= threshold ? s : -1;
  };

  // dp[i][j] = best total score aligning a[i..] with b[j..]
  const W = m + 1;
  const dp = new Float64Array((n + 1) * W);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      let best = Math.max(dp[(i + 1) * W + j], dp[i * W + j + 1]);
      const s = score(i, j);
      if (s >= 0) best = Math.max(best, s + dp[(i + 1) * W + j + 1]);
      dp[i * W + j] = best;
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    const s = score(i, j);
    if (s >= 0 && dp[i * W + j] === s + dp[(i + 1) * W + j + 1]) {
      pairs.push([i, j]);
      i++;
      j++;
    } else if (dp[(i + 1) * W + j] >= dp[i * W + j + 1]) i++;
    else j++;
  }
  return pairs;
}

const bodyBlocks = (p: PaperLike): Json[] => (p.sections ?? []).filter((s) => s.type !== 'citation');

function pickKeys(from: Json | undefined, keys: readonly string[]): Json {
  const out: Json = {};
  if (!from) return out;
  for (const k of keys) if (from[k] !== undefined) out[k] = from[k];
  return out;
}

/**
 * The block after taking the file's content into the paper's block: text, cells, caption, picture, formula come from the file;
 * the block's id, page layout, and the table's / figure's settings stay as the author has them.
 */
export function takeContent(ours: Json, theirs: Json): Json {
  const out: Json = { ...theirs, id: ours.id };
  for (const k of BLOCK_SETTING_KEYS) {
    if (ours[k] !== undefined) out[k] = ours[k];
    else delete out[k];
  }
  if (isObj(theirs.table)) {
    out.table = { ...theirs.table, ...(isObj(ours.table) && ours.table.id !== undefined ? { id: ours.table.id } : {}), ...pickKeys(ours.table, TABLE_SETTING_KEYS) };
  }
  if (isObj(theirs.figure)) {
    out.figure = { ...theirs.figure, ...(isObj(ours.figure) && ours.figure.id !== undefined ? { id: ours.figure.id } : {}), ...pickKeys(ours.figure, FIGURE_SETTING_KEYS) };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// fields

interface FieldUnit {
  id: string;
  scope: ProposalScope;
  label: string;
  /** Keys of `metadata` the unit covers. */
  metaKeys: string[];
  /** Top level keys of the paper (references). */
  paperKeys?: string[];
}

const FIELD_UNITS: FieldUnit[] = [
  { id: 'field:title', scope: 'field', label: 'Tiêu đề', metaKeys: ['title', 'titleOriginal'] },
  { id: 'field:titleEn', scope: 'field', label: 'Tiêu đề (tiếng Anh)', metaKeys: ['titleEn', 'titleEnOriginal'] },
  { id: 'authors', scope: 'authors', label: 'Tác giả và đơn vị', metaKeys: ['authors', 'affiliations', 'corresponding'] },
  { id: 'field:abstract', scope: 'field', label: 'Tóm tắt', metaKeys: ['abstract'] },
  { id: 'field:abstractEn', scope: 'field', label: 'Tóm tắt (tiếng Anh)', metaKeys: ['abstractEn'] },
  { id: 'field:keywords', scope: 'field', label: 'Từ khóa', metaKeys: ['keywords'] },
  { id: 'field:keywordsEn', scope: 'field', label: 'Từ khóa (tiếng Anh)', metaKeys: ['keywordsEn'] },
  { id: 'references', scope: 'references', label: 'Tài liệu tham khảo', metaKeys: [], paperKeys: ['references'] },
];

function unitValue(p: PaperLike, u: FieldUnit): Json {
  const out: Json = {};
  for (const k of u.metaKeys) out[k] = p.metadata?.[k];
  for (const k of u.paperKeys ?? []) out[k] = (p as Json)[k];
  return out;
}

const listText = (v: unknown): string => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : isObj(x) ? String(x.name ?? x.raw ?? x.nameEn ?? '') : String(x))).filter(Boolean).join('; ') : '');

function unitText(p: PaperLike, u: FieldUnit): string {
  const v = unitValue(p, u);
  switch (u.id) {
    case 'authors': {
      const names = listText(v.authors);
      const aff = listText(v.affiliations);
      return [names, aff].filter(Boolean).join('\n');
    }
    case 'references':
      return listText(v.references).split('; ').join('\n');
    case 'field:keywords':
      return listText(v.keywords);
    case 'field:keywordsEn':
      return listText(v.keywordsEn);
    default:
      return String(v[u.metaKeys[0]] ?? '');
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// the plan

export interface PlanOptions {
  /** No first reading exists: `base` is the paper itself and nothing is ticked. */
  conservative?: boolean;
  /** Also list what the author changed by hand where the file did not change (never ticked): "show where the paper differs from the file". */
  includeEdits?: boolean;
}

export function planMerge(base: PaperLike, ours: PaperLike, theirs: PaperLike, opts: PlanOptions = {}): MergePlan {
  const conservative = !!opts.conservative;
  const includeEdits = !!opts.includeEdits;
  const proposals: MergeProposal[] = [];

  // ---- fields
  for (const u of FIELD_UNITS) {
    const b = unitValue(base, u);
    const o = unitValue(ours, u);
    const t = unitValue(theirs, u);
    const fileUnchanged = sameValue(t, b);
    if (fileUnchanged && !includeEdits) continue; // the file says what it said
    if (sameValue(o, t)) continue; // the paper already says it
    const conflict = !sameValue(o, b);
    const before = unitText(ours, u);
    const after = unitText(theirs, u);
    proposals.push({
      id: u.id,
      scope: u.scope,
      kind: before === '' ? 'added' : after === '' ? 'removed' : 'modified',
      label: u.label,
      conflict,
      accept: !conflict && !conservative,
      ...(fileUnchanged ? { note: NOTE_EDITED } : {}),
      before,
      after,
      inline: diffInline(before, after),
      ...(onlyLook(before, after) ? { formatOnly: true } : {}),
    });
  }

  // ---- blocks
  const bBlocks = bodyBlocks(base);
  const oBlocks = bodyBlocks(ours);
  const tBlocks = bodyBlocks(theirs);
  const oursById = new Map<string, Json>(oBlocks.map((s) => [String(s.id), s]));
  const allOursIds = new Set<string>((ours.sections ?? []).map((s) => String(s.id)));

  const pairs = alignBlocks(bBlocks, tBlocks);
  const tToB = new Map<number, number>(pairs.map(([bi, ti]) => [ti, bi]));
  const bMatched = new Set(pairs.map(([bi]) => bi));

  const taken = new Set<string>(allOursIds);
  const unique = (wanted: unknown): string => {
    let id = String(wanted ?? 'blk');
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
    let n = 2;
    while (taken.has(`${id}~${n}`)) n++;
    id = `${id}~${n}`;
    taken.add(id);
    return id;
  };

  const idOf: string[] = []; // id in the paper (or reserved for a new block) of each block of the file
  const order: string[] = [];
  const prevOf: Record<string, string | null> = {};
  const blockProposals: MergeProposal[] = [];
  const added: Array<{ ti: number; id: string; note?: string }> = [];

  tBlocks.forEach((t, ti) => {
    const bi = tToB.get(ti);
    const b = bi === undefined ? undefined : bBlocks[bi];
    const o = b ? oursById.get(String(b.id)) : undefined;
    if (!b) {
      const id = unique(t.id);
      idOf[ti] = id;
      added.push({ ti, id });
      return;
    }
    if (!o) {
      // the author deleted it: stays deleted, and the file's block keeps an id the paper does not use
      idOf[ti] = unique(t.id);
      // asked to show every difference: the block comes back as a proposal, never ticked
      if (includeEdits) added.push({ ti, id: idOf[ti], note: NOTE_DELETED });
      return;
    }
    idOf[ti] = String(o.id);
    const fileUnchanged = sameBlock(t, b);
    if (fileUnchanged && !includeEdits) return; // the file did not change it
    if (sameBlock(t, o)) return; // the paper already has it
    const conflict = !sameBlock(o, b);
    const before = blockText(o);
    const after = blockText(t);
    blockProposals.push({
      id: `block:${o.id}`,
      scope: 'block',
      kind: 'modified',
      label: String(t.type),
      conflict,
      accept: !conflict && !conservative,
      ...(fileUnchanged ? { note: NOTE_EDITED } : {}),
      before,
      after,
      inline: diffInline(before, after),
      ...(onlyLook(before, after) ? { formatOnly: true } : {}),
      blockType: t.type,
      oursBlock: o,
      theirsBlock: t,
      fields: changedParts(o, t),
    });
  });

  tBlocks.forEach((_, ti) => {
    order.push(idOf[ti]);
    prevOf[idOf[ti]] = ti > 0 ? idOf[ti - 1] : null;
  });

  for (const { ti, id, note } of added) {
    const t = tBlocks[ti];
    const after = blockText(t);
    blockProposals.push({
      id: `block:${id}`,
      scope: 'block',
      kind: 'added',
      label: String(t.type),
      conflict: !!note,
      accept: !conservative && !note,
      ...(note ? { note } : {}),
      before: '',
      after,
      inline: diffInline('', after),
      blockType: t.type,
      theirsBlock: { ...t, id },
      fields: [],
    });
  }

  bBlocks.forEach((b, bi) => {
    if (bMatched.has(bi)) return;
    const o = oursById.get(String(b.id));
    if (!o) return; // already gone from the paper
    const conflict = !sameBlock(o, b);
    const before = blockText(o);
    blockProposals.push({
      id: `block:${o.id}`,
      scope: 'block',
      kind: 'removed',
      label: String(o.type),
      conflict,
      accept: !conflict && !conservative,
      before,
      after: '',
      inline: diffInline(before, ''),
      blockType: o.type,
      oursBlock: o,
      fields: [],
    });
  });

  // blocks in the order of the paper (removed ones where they are), the file's new ones after their neighbour
  const position = new Map<string, number>(oBlocks.map((s, i) => [String(s.id), i]));
  const orderIndex = new Map<string, number>(order.map((id, i) => [id, i]));
  const rank = (p: MergeProposal): number => {
    const key = p.id.slice('block:'.length);
    if (p.kind !== 'added') return (position.get(key) ?? 0) * 2;
    // an added block goes right after the nearest earlier block of the file that the paper has
    let k: string | null = prevOf[key] ?? null;
    while (k && !position.has(k)) k = prevOf[k] ?? null;
    const anchor = k ? position.get(k)! : -1;
    return anchor * 2 + 1 + (orderIndex.get(key) ?? 0) / 1e6;
  };
  blockProposals.sort((x, y) => rank(x) - rank(y));
  proposals.push(...blockProposals);
  // without a first reading there is no telling what the author wrote: every difference is a question
  if (conservative) for (const p of proposals) p.conflict = true;

  // ---- the new first reading: the file's content with ids the paper uses
  const newBaseline: PaperLike = slimForStorage({
    ...theirs,
    sections: (theirs.sections ?? []).map((s) => {
      if (s.type === 'citation') return s;
      const ti = tBlocks.indexOf(s);
      return ti >= 0 ? { ...s, id: idOf[ti] } : s;
    }),
  } as PaperLike);

  return { proposals, newBaseline, theirs, conservative, includeEdits, isEmpty: proposals.length === 0, order, prevOf };
}

function changedParts(a: Json, b: Json): string[] {
  const parts: string[] = [];
  if (a.type !== b.type) parts.push('type');
  if (!sameValue(a.table && strip(a.table, new Set(TABLE_SETTING_KEYS)), b.table && strip(b.table, new Set(TABLE_SETTING_KEYS)))) parts.push('table');
  if (!sameValue(a.figure && strip(a.figure, new Set([...FIGURE_SETTING_KEYS, 'assetId'])), b.figure && strip(b.figure, new Set([...FIGURE_SETTING_KEYS, 'assetId'])))) parts.push('figure');
  if (!sameValue(a.equation, b.equation)) parts.push('equation');
  return parts;
}

// ---------------------------------------------------------------------------------------------------------------------
// applying the author's decisions

/**
 * The paper with the accepted proposals taken in. Everything not accepted stays as it is; the paper's layout settings are
 * never touched. `accepted` holds proposal ids.
 */
export function applyMerge<T extends PaperLike>(ours: T, plan: MergePlan, accepted: ReadonlySet<string>): T {
  const result: T = { ...ours, metadata: { ...(ours.metadata ?? {}) } };
  let sections: Json[] = [...(ours.sections ?? [])];

  for (const p of plan.proposals) {
    if (!accepted.has(p.id)) continue;
    if (p.scope === 'block') continue;
    const unit = FIELD_UNITS.find((u) => u.id === p.id);
    if (!unit) continue;
    for (const k of unit.metaKeys) {
      const v = plan.theirs.metadata?.[k];
      if (v === undefined) delete (result.metadata as Json)[k];
      else (result.metadata as Json)[k] = v;
    }
    for (const k of unit.paperKeys ?? []) {
      const v = (plan.theirs as Json)[k];
      if (v === undefined) delete (result as Json)[k];
      else (result as Json)[k] = v;
    }
  }

  // modified and removed blocks first (by id), then the added ones
  for (const p of plan.proposals) {
    if (p.scope !== 'block' || !accepted.has(p.id)) continue;
    if (p.kind === 'modified' && p.oursBlock && p.theirsBlock) {
      sections = sections.map((s) => (String(s.id) === String(p.oursBlock!.id) ? takeContent(s, p.theirsBlock!) : s));
    } else if (p.kind === 'removed' && p.oursBlock) {
      sections = sections.filter((s) => String(s.id) !== String(p.oursBlock!.id));
    }
  }
  const orderIndex = new Map<string, number>(plan.order.map((id, i) => [id, i]));
  const adds = plan.proposals
    .filter((p) => p.scope === 'block' && p.kind === 'added' && accepted.has(p.id) && p.theirsBlock)
    .sort((x, y) => (orderIndex.get(String(x.theirsBlock!.id)) ?? 0) - (orderIndex.get(String(y.theirsBlock!.id)) ?? 0));
  for (const p of adds) {
    const block = p.theirsBlock!;
    let k: string | null = plan.prevOf[String(block.id)] ?? null;
    let at = 0;
    while (k) {
      const idx = sections.findIndex((s) => String(s.id) === k);
      if (idx >= 0) {
        at = idx + 1;
        break;
      }
      k = plan.prevOf[k] ?? null;
    }
    sections.splice(at, 0, block);
  }

  result.sections = sections;
  return result;
}

/** Ticks the proposals the plan suggests. */
export const suggestedSelection = (plan: MergePlan): Set<string> => new Set(plan.proposals.filter((p) => p.accept).map((p) => p.id));

/** How many proposals of each kind, for the summary line. */
export function summarizePlan(plan: MergePlan): { total: number; clean: number; conflicts: number } {
  const conflicts = plan.proposals.filter((p) => p.conflict).length;
  return { total: plan.proposals.length, clean: plan.proposals.length - conflicts, conflicts };
}
