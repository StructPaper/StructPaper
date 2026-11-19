/**
 * The editor works on a whole resolved profile, but the server stores only a journal's own rules
 * (tier 2); what the journal shares with every other journal stays in the base, so a later change to
 * the base still reaches it. These helpers cut a resolved profile down to the rules that differ.
 */
type Json = Record<string, unknown>;

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Who the journal is lives in the journals table, not in its rules. */
const IDENTITY_KEYS = ['names', 'color'] as const;

/** Object keys that differ from the base, recursively; arrays and values are compared whole. */
export function diffFromBase(base: Json, resolved: Json): Json {
  const out: Json = {};
  for (const [key, value] of Object.entries(resolved)) {
    const was = base[key];
    if (isObject(value) && isObject(was)) {
      const nested = diffFromBase(was, value);
      if (Object.keys(nested).length > 0) out[key] = nested;
    } else if (!sameRules({ v: value }, { v: was })) {
      // key order is not part of the rules: the database hands objects back with their keys re-sorted
      out[key] = value;
    }
  }
  return out;
}

/** What to store as a journal's rules: the resolved profile minus the base's rules and minus identity. */
export function toTierConfig(resolved: Json, base: Json, key: string): Json {
  const diff = diffFromBase(base, resolved);
  for (const k of IDENTITY_KEYS) delete diff[k];
  delete diff.articleType;
  // the list of article types comes from the journal's article_types, not from its rules
  delete diff.articleTypes;
  // the ISSN is the journal's own field (saved with the journal), not one of its rules
  if (isObject(diff.publication)) {
    const { issn: _issn, ...rest } = diff.publication as Json;
    if (Object.keys(rest).length > 0) diff.publication = rest;
    else delete diff.publication;
  }
  return { ...diff, id: key };
}

export const sameRules = (a: Json, b: Json): boolean => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (isObject(v)) return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])]));
  return v;
}

/** The parts of the profile that changed, in the editor's words, for the version's change note. */
const AREAS: Record<string, string> = {
  frontMatter: 'tóm tắt & từ khoá',
  articleTypes: 'loại bài',
  citation: 'trích dẫn',
  layout: 'dàn trang',
  typography: 'kiểu chữ',
  latex: 'LaTeX',
  qc: 'kiểm tra chất lượng',
  languages: 'ngôn ngữ',
  styleMap: 'ánh xạ style Word',
  publication: 'thông tin in & trích dẫn',
};

export function describeChange(before: Json, after: Json): string {
  const changed = Object.keys(after).filter((k) => k !== 'id' && JSON.stringify(sortKeys(after[k])) !== JSON.stringify(sortKeys(before[k])));
  const removed = Object.keys(before).filter((k) => k !== 'id' && !(k in after));
  const names = [...new Set([...changed, ...removed])].map((k) => AREAS[k] ?? k);
  return names.length > 0 ? `Sửa ${names.join(', ')}` : 'Cập nhật quy định';
}
