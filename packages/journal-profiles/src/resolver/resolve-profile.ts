import { ResolvedProfile } from '../types';
import { BASE_PROFILE } from '../profiles/base.profile';
import {
  ALL_JOURNAL_IDS,
  JOURNAL_DEFINITIONS,
  normalizeJournalId,
} from '../profiles/journals';
import {
  ARTICLE_TYPE_DEFINITIONS,
  normalizeArticleTypeId,
} from '../profiles/article-types';
import { resolveFromTiers } from './resolve-from-tiers';
import { getRemoteArticleType, getRemoteBase, getRemoteJournalTier, hasRemoteArticleTypes, remoteJournalKeys } from './registry';

/**
 * Resolves a Journal Profile through 3-tier inheritance:
 * 1. Tier 1: Base Profile (common default configuration)
 * 2. Tier 2: Journal Profile (e.g. std, hs, ssh, ebl, et, ees, arns, or a journal the server added)
 * 3. Tier 3: Article Type Profile (e.g. research, review, editorial, letter, etc.)
 * 4. Tier 4: Runtime Overrides (ad-hoc custom config passed by caller)
 *
 * Tiers 1 and 2 come from what the server published when the app registered it
 * (`registerRemoteProfiles`), else from the built-in definitions.
 *
 * @param journalId Target journal identifier or alias (e.g. 'hs', 'vnuhcm-hs', 'std')
 * @param articleTypeId Optional article type identifier or alias (e.g. 'research', 'editorial')
 * @param overrides Optional custom object overrides
 * @returns Fully resolved, deeply-merged, immutable ResolvedProfile
 */
export function resolveProfile(
  journalId: string,
  articleTypeId?: string,
  overrides?: Record<string, unknown>
): ResolvedProfile {
  const builtInId = normalizeJournalId(journalId);
  const journalTier = getRemoteJournalTier(builtInId ?? journalId) ?? (builtInId ? JOURNAL_DEFINITIONS[builtInId] : undefined);

  if (!journalTier) {
    const available = [...ALL_JOURNAL_IDS, ...remoteJournalKeys().filter((k) => !(ALL_JOURNAL_IDS as readonly string[]).includes(k))].join(', ');
    throw new Error(
      `Unknown journal profile: "${journalId}". Available journals: [${available}]`
    );
  }

  let articleType;
  let normalizedArticleTypeId: string | undefined;
  if (articleTypeId !== undefined && articleTypeId !== null && articleTypeId !== '') {
    normalizedArticleTypeId = normalizeArticleTypeId(articleTypeId);
    // the journal's own published rules for the type win; else the type's built-in definition
    articleType = getRemoteArticleType(journalTier.id, normalizedArticleTypeId) ?? ARTICLE_TYPE_DEFINITIONS[normalizedArticleTypeId];

    if (!articleType) {
      const available = Object.keys(ARTICLE_TYPE_DEFINITIONS).join(', ');
      throw new Error(
        `Unknown article type: "${articleTypeId}". Available article types: [${available}]`
      );
    }
  }

  return resolveFromTiers({
    base: getRemoteBase() ?? (BASE_PROFILE as unknown as Record<string, unknown>),
    journal: journalTier,
    articleType,
    overrides,
  });
}
