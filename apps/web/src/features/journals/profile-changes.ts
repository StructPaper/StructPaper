/**
 * What changed between two states of the journal editor, in the shape of a diff: one entry per value that was
 * added, removed or changed, grouped by the part of the journal it belongs to. The save dialog shows it so the
 * author sees exactly what is about to be saved (and published) before confirming.
 */
type Json = Record<string, unknown>;

export type ChangeKind = 'added' | 'removed' | 'changed';

export interface FieldChange {
  /** Human path, e.g. "Dàn trang › Số cột". */
  label: string;
  kind: ChangeKind;
  before?: string;
  after?: string;
}

export interface ChangeGroup {
  /** "Nhận diện", "Dàn trang"... */
  title: string;
  /** Saved at once (identity) or published as a new version of the rules. */
  scope: 'identity' | 'rules';
  changes: FieldChange[];
}

export interface EditorState {
  status?: string;
  profile: Json;
}

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

const AREAS: Record<string, string> = {
  frontMatter: 'Tóm tắt & từ khoá',
  articleTypes: 'Loại bài',
  citation: 'Trích dẫn',
  layout: 'Dàn trang',
  typography: 'Kiểu chữ',
  latex: 'LaTeX',
  qc: 'Kiểm tra chất lượng',
  languages: 'Ngôn ngữ',
  styleMap: 'Ánh xạ style Word',
  publication: 'Thông tin in & trích dẫn',
};

const IDENTITY_LABELS: Record<string, string> = {
  'names.vi': 'Tên tiếng Việt',
  'names.en': 'Tên tiếng Anh',
  'names.short': 'Mã tạp chí',
  color: 'Màu thương hiệu',
  status: 'Trạng thái',
  'publication.issn': 'ISSN',
};

const STATUS_LABELS: Record<string, string> = { published: 'Đang phát hành', draft: 'Bản nháp', archived: 'Lưu trữ' };

/** Keys that are not rules (who the journal is, or derived data). */
const NOT_RULES = new Set(['id', 'names', 'color', 'articleType', 'articleTypes']);

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (isObject(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

const same = (a: unknown, b: unknown) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

/** Every leaf of an object as "a.b.c" -> value (arrays and primitives are leaves). */
function flatten(value: unknown, prefix = '', out: Record<string, unknown> = {}): Record<string, unknown> {
  if (isObject(value)) {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
    if (Object.keys(value).length === 0 && prefix) out[prefix] = value;
  } else {
    out[prefix] = value;
  }
  return out;
}

function show(value: unknown, path?: string): string {
  if (value === undefined) return '';
  if (path === 'status' && typeof value === 'string') return STATUS_LABELS[value] ?? value;
  if (typeof value === 'string') return value === '' ? '(trống)' : value;
  const text = JSON.stringify(value);
  return text.length > 140 ? `${text.slice(0, 137)}...` : text;
}

function diffLeaves(before: Record<string, unknown>, after: Record<string, unknown>): { path: string; kind: ChangeKind; before?: unknown; after?: unknown }[] {
  const paths = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const out: { path: string; kind: ChangeKind; before?: unknown; after?: unknown }[] = [];
  for (const path of paths) {
    const inBefore = path in before;
    const inAfter = path in after;
    if (inBefore && inAfter) {
      if (!same(before[path], after[path])) out.push({ path, kind: 'changed', before: before[path], after: after[path] });
    } else if (inAfter) {
      out.push({ path, kind: 'added', after: after[path] });
    } else {
      out.push({ path, kind: 'removed', before: before[path] });
    }
  }
  return out;
}

const identityOf = (s: EditorState): Record<string, unknown> => {
  const p = s.profile as Json;
  const names = (p.names ?? {}) as Json;
  const publication = (p.publication ?? {}) as Json;
  return {
    'names.vi': names.vi,
    'names.en': names.en,
    'names.short': names.short,
    color: p.color,
    status: s.status,
    'publication.issn': publication.issn,
  };
};

const rulesOf = (s: EditorState): Json => {
  const out: Json = {};
  for (const [k, v] of Object.entries(s.profile)) if (!NOT_RULES.has(k)) out[k] = v;
  if (isObject(out.publication)) {
    const { issn: _issn, ...rest } = out.publication as Json;
    out.publication = rest;
  }
  return out;
};

/** The labelled path of a rules leaf: "layout.columns" -> "Dàn trang › columns". */
function labelFor(path: string): string {
  const [head, ...rest] = path.split('.');
  return [AREAS[head] ?? head, ...rest].join(' › ');
}

/**
 * The changes from `before` to `after`. Without `before` (a journal that does not exist yet) every identity value
 * counts as added and the rules are inherited, so there is nothing to list for them.
 */
export function describeChanges(before: EditorState | null, after: EditorState): ChangeGroup[] {
  const groups: ChangeGroup[] = [];

  const idBefore = before ? identityOf(before) : {};
  const idAfter = identityOf(after);
  const identity = diffLeaves(
    Object.fromEntries(Object.entries(idBefore).filter(([, v]) => v !== undefined && v !== '')),
    Object.fromEntries(Object.entries(idAfter).filter(([, v]) => v !== undefined && v !== '')),
  ).map<FieldChange>((c) => ({
    label: IDENTITY_LABELS[c.path] ?? c.path,
    kind: c.kind,
    before: c.kind === 'added' ? undefined : show(c.before, c.path),
    after: c.kind === 'removed' ? undefined : show(c.after, c.path),
  }));
  if (identity.length > 0) groups.push({ title: 'Nhận diện tạp chí', scope: 'identity', changes: identity });

  if (before) {
    const byArea = new Map<string, FieldChange[]>();
    for (const c of diffLeaves(flatten(rulesOf(before)), flatten(rulesOf(after)))) {
      const area = AREAS[c.path.split('.')[0]] ?? c.path.split('.')[0];
      const list = byArea.get(area) ?? [];
      list.push({
        label: labelFor(c.path),
        kind: c.kind,
        before: c.kind === 'added' ? undefined : show(c.before),
        after: c.kind === 'removed' ? undefined : show(c.after),
      });
      byArea.set(area, list);
    }
    for (const [title, changes] of byArea) groups.push({ title, scope: 'rules', changes });
  }
  return groups;
}

export const countChanges = (groups: ChangeGroup[]) => ({
  total: groups.reduce((n, g) => n + g.changes.length, 0),
  rules: groups.filter((g) => g.scope === 'rules').reduce((n, g) => n + g.changes.length, 0),
  added: groups.reduce((n, g) => n + g.changes.filter((c) => c.kind === 'added').length, 0),
  removed: groups.reduce((n, g) => n + g.changes.filter((c) => c.kind === 'removed').length, 0),
  changed: groups.reduce((n, g) => n + g.changes.filter((c) => c.kind === 'changed').length, 0),
});
