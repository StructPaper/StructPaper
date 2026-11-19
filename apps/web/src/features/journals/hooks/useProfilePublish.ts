import { useMutation } from '@tanstack/react-query';
import { createProfileDraft, validateProfileDraft, publishProfileDraft, type ProfileVersion } from '@structpaper/api-client';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';
import { PUBLISHED_PROFILES_KEY } from './usePublishedProfiles';
import { profileVersionsKey, type ProfileScope } from './useProfileVersions';
import { ProfileValidationError } from './useJournalPublisher';

export interface PublishRulesInput {
  config: Record<string, unknown>;
  changeNote?: string;
}

/**
 * Publishes new rules for a scope: a draft, checked by the server, then published (the version being
 * replaced is kept as history). A draft the server refuses is not published and says where it is wrong.
 */
export function usePublishRules(scope: ProfileScope, id: string) {
  const client = useOptionalQueryClient() ?? idleQueryClient;
  return useMutation<ProfileVersion, Error, PublishRulesInput>(
    {
      mutationFn: async ({ config, changeNote }) => {
        const draft = await createProfileDraft(scope, id, { config, ...(changeNote ? { changeNote } : {}) });
        const checked = await validateProfileDraft(scope, id, draft.version);
        if (!checked.ok) throw new ProfileValidationError(checked.issues);
        return publishProfileDraft(scope, id, draft.version, {});
      },
      onSettled: async () => {
        await Promise.all([
          client.invalidateQueries({ queryKey: profileVersionsKey(id, scope) }),
          client.invalidateQueries({ queryKey: PUBLISHED_PROFILES_KEY }),
          client.invalidateQueries({ queryKey: ['journals', 'resolved-profile'] }),
        ]);
      },
    },
    client,
  );
}
