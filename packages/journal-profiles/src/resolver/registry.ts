import type { ArticleTypeProfile, JournalProfile, JournalTierProfile } from '../types';

/**
 * The published profile tiers the server hands out (GET /profiles/published). `resolveProfile` is a
 * synchronous pure function used by the parser, the QC engine and the LaTeX writer, so instead of
 * threading a list through every call, the app registers what the server published once, and the
 * resolver prefers it over the built-in definitions. Nothing registered: the built-ins answer, as before.
 */
export interface RemoteProfiles {
  base?: JournalProfile | Record<string, unknown> | null;
  /** journal key ("hs") -> its published tier-2 rules */
  journals: Record<string, JournalTierProfile>;
  /** journal key -> article type code -> that type's published rules (tier 3) */
  articleTypes?: Record<string, Record<string, ArticleTypeProfile>>;
}

let remoteBase: Record<string, unknown> | null = null;
let remoteJournals = new Map<string, JournalTierProfile>();
let remoteArticleTypes = new Map<string, Map<string, ArticleTypeProfile>>();

const keyOf = (id: string): string => id.trim().toLowerCase().replace(/^vnuhcm[-_]/, '');

export function registerRemoteProfiles(profiles: RemoteProfiles): void {
  remoteBase = (profiles.base as Record<string, unknown> | null | undefined) ?? null;
  remoteJournals = new Map(Object.entries(profiles.journals).map(([id, tier]) => [keyOf(id), tier]));
  remoteArticleTypes = new Map(
    Object.entries(profiles.articleTypes ?? {}).map(([id, types]) => [keyOf(id), new Map(Object.entries(types))]),
  );
}

export function clearRemoteProfiles(): void {
  remoteBase = null;
  remoteJournals = new Map();
  remoteArticleTypes = new Map();
}

export function getRemoteBase(): Record<string, unknown> | null {
  return remoteBase;
}

export function getRemoteJournalTier(id: string): JournalTierProfile | undefined {
  return remoteJournals.get(keyOf(id));
}

/** Keys of the journals the server published (so a journal the code does not know can still be resolved). */
export function remoteJournalKeys(): string[] {
  return [...remoteJournals.keys()];
}

/** The published rules of one article type of a journal; undefined when the server published none for it. */
export function getRemoteArticleType(journalId: string, code: string): ArticleTypeProfile | undefined {
  return remoteArticleTypes.get(keyOf(journalId))?.get(code);
}

/** Whether the server published an article type list for the journal (so its own list, not the code's, applies). */
export function hasRemoteArticleTypes(journalId: string): boolean {
  return remoteArticleTypes.has(keyOf(journalId));
}
