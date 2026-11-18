import type { ArticleTypeProfile, JournalProfile, JournalTierProfile, ResolvedProfile } from '../types';
import { deepMerge } from './deep-merge';

export interface ProfileTiers {
  /** Tier 1: what every journal shares. */
  base: JournalProfile | Record<string, unknown>;
  /** Tier 2: the journal's own rules. */
  journal: JournalTierProfile;
  /** Tier 3: the article type's rules (optional). */
  articleType?: ArticleTypeProfile | null;
  /** Tier 4: ad-hoc overrides of the caller. */
  overrides?: Record<string, unknown>;
}

/**
 * The pure merge behind `resolveProfile`: the tiers come from anywhere (the code's built-ins, or the
 * published versions the server holds), so the client and the server merge them with the same function.
 */
export function resolveFromTiers(tiers: ProfileTiers): ResolvedProfile {
  let merged = deepMerge(tiers.base as Record<string, unknown>, tiers.journal as unknown as Record<string, unknown>);

  let articleTypeId: string | undefined;
  if (tiers.articleType) {
    const { id, ...rules } = tiers.articleType;
    articleTypeId = id;
    merged = deepMerge(merged, rules as unknown as Record<string, unknown>);
  }

  const overrides = tiers.overrides;
  if (overrides && Object.keys(overrides).length > 0) merged = deepMerge(merged, overrides);

  // the journal id survives unless the caller overrides it on purpose
  if (!overrides || !('id' in overrides)) merged.id = tiers.journal.id;
  if (articleTypeId) merged.articleType = articleTypeId;

  return merged as unknown as ResolvedProfile;
}
