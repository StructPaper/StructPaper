import {
  BASE_PROFILE,
  JOURNAL_DEFINITIONS,
  ARTICLE_TYPE_DEFINITIONS,
  JournalProfileSchema,
  resolveFromTiers,
  type ArticleTypeProfile,
  type JournalId,
  type JournalTierProfile,
} from '@structpaper/journal-profiles';
import type { ArticleType, Journal } from '@structpaper/db';
import type { ProfileIssueDto } from '@structpaper/contracts';

/** "vnuhcm-hs" -> "hs" */
export const journalKey = (journal: Pick<Journal, 'slug'>): string => journal.slug.replace(/^vnuhcm-/i, '').toLowerCase();

/** What a journal prints about itself, starting from who it is (used for a journal the code has no rules for). */
export function defaultPublication(journal: Journal): Record<string, string | undefined> {
  return {
    name: journal.name,
    shortName: journal.shortName,
    publisher: 'ĐHQG TP.HCM / VNU-HCM Press',
    accentColor: journal.color,
    headerText: journal.nameEn || journal.name,
    officialNameEn: journal.nameEn || undefined,
    officialAbbvEn: journal.shortName,
  };
}

/**
 * The rules the code ships with for a journal. A journal the code does not know starts from just its id
 * (plus what it prints about itself, when its row is at hand): the base rules fill in the rest.
 */
export function builtInTier(key: string, journal?: Journal): JournalTierProfile {
  const known = JOURNAL_DEFINITIONS[key as JournalId];
  if (known) return structuredClone(known) as JournalTierProfile;
  return journal ? { id: key, publication: defaultPublication(journal) } : { id: key };
}

/** The rules the code ships with for an article type; a type the code does not know has no rules of its own. */
export function builtInArticleTier(code: string, labels?: { vi: string; en: string }): ArticleTypeProfile {
  const known = ARTICLE_TYPE_DEFINITIONS[code];
  if (known) return structuredClone(known);
  return { id: code, ...(labels ? { label: labels } : {}), requiredSections: ['heading.abstract', 'h1', 'heading.references'] };
}

export const builtInBase = (): Record<string, unknown> => structuredClone(BASE_PROFILE) as unknown as Record<string, unknown>;

/** An article type as the profile lists it. */
export interface ListedArticleType {
  id: string;
  label: { vi: string; en: string };
  requiredSections: string[];
}

/**
 * Who the journal is (names, code, colour, ISSN, the article types it accepts) comes from the journals tables,
 * which admins edit directly, so it is laid over the published rules: renaming or recolouring needs no new
 * profile version.
 */
export function withIdentity(config: Record<string, any>, journal: Journal, articleTypes?: ListedArticleType[]): JournalTierProfile {
  const key = journalKey(journal);
  const names = config.names || {};
  return {
    ...config,
    id: key,
    names: {
      vi: journal.name,
      en: journal.nameEn || names.en || journal.name,
      short: journal.code,
    },
    color: journal.color,
    // the ISSN belongs to the journal itself, wherever the rules were written
    publication: { ...(config.publication || {}), ...(journal.issn ? { issn: journal.issn } : {}) },
    latex: { ...(config.latex || {}), cls: journal.latexCls },
    ...(articleTypes ? { articleTypes } : {}),
  } as JournalTierProfile;
}

/** The labels of an article type are edited on the type itself, so they are laid over its published rules. */
export function withTypeIdentity(config: Record<string, any>, type: Pick<ArticleType, 'code' | 'labels'>): ArticleTypeProfile {
  return { ...config, id: type.code, label: type.labels } as ArticleTypeProfile;
}

/** Active types of a journal in the shape the profile lists them (labels from the type, sections from its rules). */
export function listArticleTypes(types: ArticleType[], configs: Map<string, Record<string, any>>): ListedArticleType[] {
  return types
    .filter((t) => t.status === 'active')
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .map((t) => ({
      id: t.code,
      label: t.labels,
      requiredSections: (configs.get(t.id)?.requiredSections as string[] | undefined) ?? [],
    }));
}

const pathOf = (path: (string | number)[]): string => path.join('.') || '(root)';

export interface ValidationContext {
  /** The published base (the code's base when the database has none). */
  base: Record<string, any>;
  /** The journal's published rules with identity, for the article type scope. */
  journalTier?: JournalTierProfile;
  journal?: Journal;
  type?: ArticleType;
}

/**
 * A version is valid when the profile it produces is complete: for the base that is the config itself,
 * for a journal it is the base merged with the journal's rules, for an article type it is that merged
 * with the type's rules.
 */
export function validateTier(scope: 'base' | 'journal' | 'article_type', config: Record<string, any>, ctx: ValidationContext): ProfileIssueDto[] {
  let target: Record<string, any>;
  if (scope === 'base') {
    target = config;
  } else if (scope === 'journal') {
    target = resolveFromTiers({
      base: ctx.base,
      journal: ctx.journal ? withIdentity(config, ctx.journal) : ({ id: String(config.id ?? ''), ...config } as JournalTierProfile),
    });
  } else {
    target = resolveFromTiers({
      base: ctx.base,
      journal: ctx.journalTier ?? ({ id: 'journal' } as JournalTierProfile),
      articleType: ctx.type ? withTypeIdentity(config, ctx.type) : (config as ArticleTypeProfile),
    });
  }
  const parsed = JournalProfileSchema.safeParse(target);
  if (parsed.success) return [];
  return parsed.error.issues.map((i) => ({ path: pathOf(i.path), message: i.message }));
}
