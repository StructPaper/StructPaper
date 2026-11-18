import { useMutation } from '@tanstack/react-query';
import {
  createJournal,
  updateJournal,
  createProfileDraft,
  validateProfileDraft,
  publishProfileDraft,
  getListJournalsQueryKey,
  type Journal,
  type ProfileVersion,
  type UpdateJournalRequest,
} from '@structpaper/api-client';
import type { ManagedJournalProfile, JournalStatus } from '@/lib/templates/journal-storage';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';
import { describeChange, sameRules, toTierConfig } from '../profile-diff';
import { PUBLISHED_PROFILES_KEY } from './usePublishedProfiles';
import { profileVersionsKey } from './useProfileVersions';

/** The draft was rejected: it would not produce a complete profile. Each issue says where. */
export class ProfileValidationError extends Error {
  constructor(public readonly issues: { path: string; message: string }[]) {
    super(`Quy định chưa hợp lệ: ${issues.slice(0, 3).map((i) => `${i.path} (${i.message})`).join('; ')}`);
    this.name = 'ProfileValidationError';
  }
}

export interface SaveJournalInput {
  /** Create the journal on the server first (the editor's "new journal" page). */
  isNew: boolean;
  /** "hs": the key the profile endpoints address the journal by. */
  key: string;
  /** What the editor loaded (undefined for a new journal). */
  original?: ManagedJournalProfile;
  edited: ManagedJournalProfile;
  /** The published base rules the journal inherits. */
  base: Record<string, unknown>;
  /** Server version of the journal, sent as If-Match so a stale editor is told so instead of overwriting. */
  serverVersion?: number;
}

export interface SaveJournalResult {
  journal?: Journal;
  /** The new profile version, when the rules changed. */
  published?: ProfileVersion;
}

/** The server stores draft/published/archived; the editor's "validated" is just a draft that passed checks. */
const toServerStatus = (s: JournalStatus): 'draft' | 'published' | 'archived' => (s === 'validated' ? 'draft' : s);

function identityPatch(original: ManagedJournalProfile, edited: ManagedJournalProfile): UpdateJournalRequest {
  const was = original.profile;
  const now = edited.profile;
  const patch: UpdateJournalRequest = {};
  if (now.names?.vi && now.names.vi !== was.names?.vi) patch.name = now.names.vi;
  if (now.names?.en && now.names.en !== was.names?.en) patch.nameEn = now.names.en;
  if (now.names?.short && now.names.short !== was.names?.short) patch.code = now.names.short;
  if (now.color && now.color.toLowerCase() !== was.color?.toLowerCase()) patch.color = now.color;
  const issnWas = was.publication?.issn ?? '';
  const issnNow = now.publication?.issn?.trim() ?? '';
  if (issnNow !== issnWas && /^\d{4}-\d{3}[\dXx]$/.test(issnNow)) patch.issn = issnNow;
  else if (issnNow === '' && issnWas !== '') patch.issn = null;
  if (toServerStatus(edited.status) !== toServerStatus(original.status)) patch.status = toServerStatus(edited.status);
  return patch;
}

/**
 * Saves the journal editor: who the journal is (name, code, colour, status) goes to the journal itself,
 * its rules go through a profile version (draft -> validate -> publish), so papers pinned to the earlier
 * version keep resolving to the rules they were written under.
 */
export function useJournalPublisher() {
  const client = useOptionalQueryClient() ?? idleQueryClient;

  return useMutation<SaveJournalResult, Error, SaveJournalInput>(
    {
      mutationFn: async ({ isNew, key, original, edited, base, serverVersion }) => {
        const result: SaveJournalResult = {};

        if (isNew) {
          result.journal = await createJournal({
            key,
            name: edited.profile.names.vi,
            nameEn: edited.profile.names.en,
            code: edited.profile.names.short,
            color: edited.profile.color,
            status: toServerStatus(edited.status),
            ...(/^\d{4}-\d{3}[\dXx]$/.test(edited.profile.publication?.issn ?? '') && { issn: edited.profile.publication!.issn }),
          });
        } else if (original) {
          const patch = identityPatch(original, edited);
          if (Object.keys(patch).length > 0) {
            result.journal = await updateJournal(key, patch, serverVersion ? { headers: { 'If-Match': `"${serverVersion}"` } } : undefined);
          }
        }

        const before = original ? toTierConfig(original.profile, base, key) : { id: key };
        const after = toTierConfig(edited.profile, base, key);
        if (!sameRules(before, after)) {
          const draft = await createProfileDraft('journal', key, { config: after, changeNote: describeChange(before, after) });
          const checked = await validateProfileDraft('journal', key, draft.version);
          if (!checked.ok) throw new ProfileValidationError(checked.issues);
          result.published = await publishProfileDraft('journal', key, draft.version, {});
        }
        return result;
      },
      onSettled: async (_data, _error, input) => {
        // even a half-done save (journal updated, rules refused) changed something the screens show
        await Promise.all([
          client.invalidateQueries({ queryKey: getListJournalsQueryKey() }),
          client.invalidateQueries({ queryKey: PUBLISHED_PROFILES_KEY }),
          client.invalidateQueries({ queryKey: profileVersionsKey(input.key, 'journal') }),
        ]);
      },
    },
    client,
  );
}
