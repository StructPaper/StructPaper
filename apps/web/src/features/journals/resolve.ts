import type { Journal } from '@structpaper/api-client';
import { ALL_JOURNAL_IDS, JOURNAL_DEFINITIONS } from '@structpaper/journal-profiles';

/** One journal as the screens show it. The server owns these values (name, code, colour, status). */
export interface JournalInfo {
  /** Server id (uuid) when it comes from the API, the short key for the built-in fallback. */
  id: string;
  /** "vnuhcm-hs" */
  slug: string;
  /** "hs": the slug without the VNUHCM prefix, the key the templates and profiles use. */
  key: string;
  /** "VNUHCM-HS" */
  code: string;
  name: string;
  nameEn: string | null;
  issn: string | null;
  color: string;
  status: string;
  /** The journal's version on the server (its ETag); 0 for the built-in stand-in. */
  version: number;
  articleTypes: string[];
}

/** Colour of a paper whose journal is not known (yet): neutral, never a journal's brand colour. */
export const NEUTRAL_JOURNAL_COLOR = '#71717A';

const stripPrefix = (value: string): string => value.trim().toLowerCase().replace(/^vnuhcm[-_]/, '');

/** Old names of the standard journal: papers saved on a machine before the journals were managed may carry "vnu-jst" or "stdj". */
const LEGACY_ALIASES: Record<string, string> = { 'vnu-jst': 'std', stdj: 'std', jst: 'std' };
const aliasKey = (key: string): string => LEGACY_ALIASES[key] ?? key;

/** A row under an old name duplicates the standard journal and is not a journal of its own (a database made before the clean schema may still have one). */
export const isLegacyJournal = (dto: Pick<Journal, 'slug'>): boolean => (dto.slug || '').toLowerCase() in LEGACY_ALIASES;

export function toJournalInfo(dto: Journal): JournalInfo {
  const key = stripPrefix(dto.slug || dto.code || dto.id);
  return {
    id: dto.id,
    slug: dto.slug,
    key,
    code: dto.code || `VNUHCM-${key.toUpperCase()}`,
    name: dto.name,
    nameEn: dto.nameEn ?? null,
    issn: dto.issn ?? null,
    color: dto.color || NEUTRAL_JOURNAL_COLOR,
    status: dto.status || 'published',
    version: dto.version ?? 1,
    articleTypes: dto.articleTypes ?? [],
  };
}

/**
 * The journals the app ships with. Only a stand-in for when the server can not be reached (offline,
 * mock mode); while it is loading the screens show a shimmer instead, never these values.
 */
export function builtInJournals(): JournalInfo[] {
  return ALL_JOURNAL_IDS.map((key) => {
    const def = JOURNAL_DEFINITIONS[key];
    return {
      id: key,
      slug: `vnuhcm-${key}`,
      key,
      code: def?.names?.short || `VNUHCM-${key.toUpperCase()}`,
      name: def?.names?.vi || def?.names?.en || key.toUpperCase(),
      nameEn: def?.names?.en || null,
      issn: null,
      color: def?.color || NEUTRAL_JOURNAL_COLOR,
      status: key === 'arns' ? 'draft' : 'published',
      version: 0,
      articleTypes: [],
    };
  });
}

/** What a paper may call its journal: server id, slug, code ("VNUHCM-HS"), key ("hs"), old alias "stdj". */
export function findJournal(journals: readonly JournalInfo[], ref?: string | null): JournalInfo | undefined {
  if (!ref) return undefined;
  const raw = ref.trim();
  const byId = journals.find((j) => j.id === raw);
  if (byId) return byId;
  const key = stripPrefix(raw);
  const wanted = aliasKey(key);
  return journals.find((j) => j.key === wanted || j.slug.toLowerCase() === raw.toLowerCase());
}
