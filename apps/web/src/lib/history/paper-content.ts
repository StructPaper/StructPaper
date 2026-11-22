import type { CompletePaper, PaperSection } from '@/types/paper';

/**
 * The part of a paper the undo history covers: what the author wrote and laid out. Server bookkeeping (version, pin,
 * article-type code, timestamps) is not part of it, so undo never rolls those back.
 */
export const CONTENT_KEYS = ['metadata', 'sections', 'references', 'layoutSettings', 'displayName'] as const;
export type PaperContent = Pick<CompletePaper, 'metadata' | 'sections' | 'references' | 'layoutSettings' | 'displayName'>;

export const contentOf = (paper: CompletePaper): PaperContent => ({
  metadata: paper.metadata,
  sections: paper.sections,
  references: paper.references,
  layoutSettings: paper.layoutSettings,
  displayName: paper.displayName,
});

/** Same references all the way down: cheap, and exactly what an immutable update that changed nothing keeps. */
export const sameContentRefs = (a: PaperContent, b: PaperContent): boolean => CONTENT_KEYS.every((k) => a[k] === b[k]);

const sortKeys = (v: unknown): unknown => {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]));
  return v;
};
const stable = (v: unknown) => JSON.stringify(sortKeys(v));

/** Deep equality for the rare case the references differ but the values may not. */
export const sameContent = (a: PaperContent, b: PaperContent): boolean => {
  if (sameContentRefs(a, b)) return true;
  return CONTENT_KEYS.every((k) => a[k] === b[k] || stable(a[k]) === stable(b[k]));
};

// ---------------------------------------------------------------------------------------------- what changed, cheaply

export type EditorTab = 'metadata' | 'authors' | 'abstract' | 'sections' | 'appendix' | 'refs' | 'citation' | 'preflight';

export interface ChangeLocation {
  /** The tab the change is in. */
  tab: EditorTab;
  /** Key used to merge a run of edits to the same place into one undo step; null = never merge. */
  coalesceKey: string | null;
  /** "Sửa tiêu đề" */
  label: string;
  /** The block that changed (when it is one). */
  sectionId?: string;
  /** Whether that block is a paragraph, which opens in its rich-text editor when focused. */
  isParagraph?: boolean;
}

const FIELD_TAB: Record<string, [EditorTab, string]> = {
  title: ['metadata', 'tiêu đề'],
  titleEn: ['metadata', 'tiêu đề tiếng Anh'],
  articleType: ['metadata', 'loại bài'],
  articleTypeEn: ['metadata', 'loại bài'],
  articleTypeCode: ['metadata', 'loại bài'],
  journalId: ['metadata', 'tạp chí'],
  journalName: ['metadata', 'tạp chí'],
  journalAbbv: ['metadata', 'tạp chí'],
  doi: ['metadata', 'DOI'],
  volume: ['metadata', 'tập'],
  issue: ['metadata', 'số'],
  year: ['metadata', 'năm'],
  firstPage: ['metadata', 'trang đầu'],
  lastPage: ['metadata', 'trang cuối'],
  dates: ['metadata', 'ngày tháng'],
  publication: ['metadata', 'thông tin xuất bản'],
  authors: ['authors', 'tác giả'],
  affiliations: ['authors', 'đơn vị'],
  corresponding: ['authors', 'tác giả liên hệ'],
  abstract: ['abstract', 'tóm tắt'],
  abstractEn: ['abstract', 'tóm tắt tiếng Anh'],
  keywords: ['abstract', 'từ khóa'],
  keywordsEn: ['abstract', 'từ khóa tiếng Anh'],
};

const BLOCK_NAME: Record<string, string> = {
  h1: 'tiêu đề mục', h2: 'tiêu đề mục', h3: 'tiêu đề mục', paragraph: 'đoạn văn', figure: 'hình', table: 'bảng',
  quote: 'trích dẫn', box: 'khung', equation: 'công thức', citation: 'trích dẫn bài',
};

const sectionKey = (s: PaperSection, i: number) => (s.id ? String(s.id) : `#${i}`);

/**
 * Where a change is, without comparing whole texts: references of untouched parts are the same object, so this only
 * walks the lists once. It names the tab, the block or the field, a label for the undo button, and the key that
 * lets a burst of typing in one place count as one step.
 */
export function locateChange(before: PaperContent, after: PaperContent): ChangeLocation {
  const found: ChangeLocation[] = [];

  if (before.metadata !== after.metadata) {
    const keys = new Set([...Object.keys(before.metadata ?? {}), ...Object.keys(after.metadata ?? {})]);
    for (const key of keys) {
      const x = (before.metadata as any)?.[key];
      const y = (after.metadata as any)?.[key];
      if (x === y) continue;
      if (typeof x === 'object' && typeof y === 'object' && stable(x) === stable(y)) continue;
      const [tab, name] = FIELD_TAB[key] ?? ['metadata' as EditorTab, key];
      const verb = x === undefined || x === '' || (Array.isArray(x) && x.length === 0) ? 'Nhập' : Array.isArray(x) && Array.isArray(y) && y.length < x.length ? 'Xóa' : 'Sửa';
      found.push({ tab, coalesceKey: `field:${key}`, label: `${verb} ${name}` });
    }
  }

  if (before.references !== after.references) {
    const added = after.references.length - before.references.length;
    found.push({ tab: 'refs', coalesceKey: added === 0 ? 'refs' : null, label: added > 0 ? 'Thêm tài liệu tham khảo' : added < 0 ? 'Xóa tài liệu tham khảo' : 'Sửa tài liệu tham khảo' });
  }

  if (before.sections !== after.sections) {
    const old = new Map(before.sections.map((s, i) => [sectionKey(s, i), s]));
    const seen = new Set<string>();
    let moved = false;
    let last = -1;
    after.sections.forEach((s, i) => {
      const id = sectionKey(s, i);
      seen.add(id);
      const was = old.get(id);
      const tab: EditorTab = s.type === 'citation' ? 'citation' : 'sections';
      const name = BLOCK_NAME[s.type] ?? 'khối';
      if (!was) found.push({ tab, coalesceKey: null, label: `Thêm ${name}`, sectionId: id, isParagraph: s.type === 'paragraph' });
      else if (was !== s && stable(was) !== stable(s)) found.push({ tab, coalesceKey: `section:${id}`, label: `Sửa ${name}`, sectionId: id, isParagraph: s.type === 'paragraph' });
      const prevIndex = before.sections.findIndex((b, bi) => sectionKey(b, bi) === id);
      if (was && prevIndex !== -1 && prevIndex < last) moved = true;
      if (was && prevIndex !== -1) last = Math.max(last, prevIndex);
    });
    before.sections.forEach((s, i) => {
      const id = sectionKey(s, i);
      if (!seen.has(id)) found.push({ tab: s.type === 'citation' ? 'citation' : 'sections', coalesceKey: null, label: `Xóa ${BLOCK_NAME[s.type] ?? 'khối'}` });
    });
    if (moved && found.length === 0) found.push({ tab: 'sections', coalesceKey: null, label: 'Di chuyển khối' });
  }

  if (before.layoutSettings !== after.layoutSettings && stable(before.layoutSettings ?? {}) !== stable(after.layoutSettings ?? {})) {
    found.push({ tab: 'metadata', coalesceKey: 'layout', label: 'Đổi dàn trang' });
  }
  if (before.displayName !== after.displayName) found.push({ tab: 'metadata', coalesceKey: 'displayName', label: 'Đổi tên bản thảo' });

  if (found.length === 0) return { tab: 'metadata', coalesceKey: null, label: 'Thay đổi' };
  if (found.length === 1) return found[0];
  // several places at once (an automatic fix, a paste across blocks): one step, never merged, aimed at the first
  return { ...found[0], coalesceKey: null, label: 'Nhiều thay đổi' };
}
