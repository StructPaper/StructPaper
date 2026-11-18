import { resolveProfile, type ResolvedProfile } from '@structpaper/journal-profiles';
import type { CompletePaper, LayoutSettings } from '@/types/paper';
import { journalKeyOf } from '@/lib/templates';
import { effectiveLayout, layoutFromProfile, type LayoutProfile } from './profile-layout';

/** What identifies the profile a paper is laid out with: its journal, article type and the versions pinned. */
export interface PaperProfileRef {
  journal: string;
  articleType?: string;
  pin?: { base?: number; journal?: number; articleType?: number };
}

/** "hs|research|1,2,1": a pinned profile never changes, so it can be kept for good. */
export const profileCacheKey = (ref: PaperProfileRef): string =>
  `${journalKeyOf(ref.journal)}|${ref.articleType ?? ''}|${ref.pin?.base ?? ''},${ref.pin?.journal ?? ''},${ref.pin?.articleType ?? ''}`;

/** What a paper says about the profile it is written under. Undefined when it names no journal. */
export function profileRefOf(paper: Pick<CompletePaper, 'metadata' | 'profilePin' | 'articleTypeCode'>): PaperProfileRef | undefined {
  const journal = paper.metadata?.journalId;
  if (!journal) return undefined;
  return { journal, articleType: paper.articleTypeCode, pin: paper.profilePin };
}

const pinned = new Map<string, ResolvedProfile>();

/** Remembers a profile the server resolved for a pin (the paper's editor fetches it once when the paper opens). */
export function rememberPinnedProfile(ref: PaperProfileRef, profile: ResolvedProfile): void {
  pinned.set(profileCacheKey(ref), profile);
}

export function forgetPinnedProfiles(): void {
  pinned.clear();
}

/**
 * The profile a paper is laid out with, found without waiting: the pinned one the editor already fetched, else
 * the journal's latest rules (the ones the app registered from the server, or its built-ins).
 */
export function profileForPaper(paper: Pick<CompletePaper, 'metadata' | 'profilePin' | 'articleTypeCode'>): ResolvedProfile | undefined {
  const ref = profileRefOf(paper);
  if (!ref) return undefined;
  const kept = pinned.get(profileCacheKey(ref));
  if (kept) return kept;
  for (const type of [ref.articleType, undefined]) {
    try {
      return resolveProfile(journalKeyOf(ref.journal), type);
    } catch {
      // a type the journal does not have, or a journal nobody knows: try without the type, then give up
    }
  }
  return undefined;
}

/** The page layout of a paper: its journal's rules, with the paper's own changes laid over them. */
export function resolvePaperLayout(
  paper: Pick<CompletePaper, 'metadata' | 'profilePin' | 'articleTypeCode' | 'layoutSettings'>,
): LayoutSettings {
  const fromJournal = layoutFromProfile(profileForPaper(paper) as LayoutProfile | undefined);
  return effectiveLayout(fromJournal, paper.layoutSettings);
}

/** What the journal alone would lay a paper out as (the baseline the paper's changes are measured against). */
export function journalLayoutOf(paper: Pick<CompletePaper, 'metadata' | 'profilePin' | 'articleTypeCode'>): LayoutSettings {
  return layoutFromProfile(profileForPaper(paper) as LayoutProfile | undefined);
}
