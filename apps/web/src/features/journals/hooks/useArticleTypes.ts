import { useMutation, useQuery } from '@tanstack/react-query';
import {
  listArticleTypes,
  createArticleType,
  updateArticleType,
  listProfileVersions,
  createProfileDraft,
  validateProfileDraft,
  publishProfileDraft,
  getListJournalsQueryKey,
  type ArticleType,
  type CreateArticleTypeRequest,
  type UpdateArticleTypeRequest,
} from '@structpaper/api-client';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';
import { PUBLISHED_PROFILES_KEY } from './usePublishedProfiles';
import { ProfileValidationError } from './useJournalPublisher';

export const articleTypesKey = (journalKey: string) => ['journals', 'article-types', journalKey] as const;
const typeVersionsKey = (journalKey: string, code: string) => ['journals', 'article-type-versions', journalKey, code] as const;

/** The article types a journal accepts, archived ones included (the admin can bring them back). */
export function useArticleTypes(journalKey: string | undefined, enabled = true) {
  const client = useOptionalQueryClient();
  return useQuery<ArticleType[]>(
    {
      queryKey: articleTypesKey(journalKey ?? ''),
      queryFn: ({ signal }) => listArticleTypes(journalKey!, { includeArchived: true }, undefined, signal),
      enabled: !!client && enabled && !!journalKey,
      staleTime: 30_000,
    },
    client ?? idleQueryClient,
  );
}

/** Add, rename, reorder or archive article types of a journal. */
export function useArticleTypeActions(journalKey: string) {
  const client = useOptionalQueryClient() ?? idleQueryClient;
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: articleTypesKey(journalKey) }),
      client.invalidateQueries({ queryKey: getListJournalsQueryKey() }),
      client.invalidateQueries({ queryKey: PUBLISHED_PROFILES_KEY }),
    ]);
  };
  const create = useMutation({ mutationFn: (body: CreateArticleTypeRequest) => createArticleType(journalKey, body), onSuccess: refresh }, client);
  const update = useMutation(
    { mutationFn: (v: { code: string; body: UpdateArticleTypeRequest }) => updateArticleType(journalKey, v.code, v.body), onSuccess: refresh },
    client,
  );
  return { create, update };
}

/** The abstract is the rule article types differ on most: an editorial or a letter has none. */
export const needsAbstract = (config: Record<string, any> | undefined): boolean => config?.frontMatter?.abstract !== null;

/** The published rules of one article type (loaded when its rules are opened). */
export function useArticleTypeRules(journalKey: string, code: string, enabled: boolean) {
  const client = useOptionalQueryClient();
  return useQuery(
    {
      queryKey: typeVersionsKey(journalKey, code),
      queryFn: async ({ signal }) => {
        const versions = await listProfileVersions('article_type', `${journalKey}:${code}`, undefined, signal);
        return versions.find((v) => v.state === 'published');
      },
      enabled: !!client && enabled,
      staleTime: 30_000,
    },
    client ?? idleQueryClient,
  );
}

/** Whether papers of this type need an abstract, saved as a new version of the type's rules (draft -> validate -> publish). */
export function useSetAbstractRequired(journalKey: string, code: string) {
  const client = useOptionalQueryClient() ?? idleQueryClient;
  return useMutation(
    {
      mutationFn: async (v: { current: Record<string, any>; required: boolean }) => {
        const frontMatter = { ...(v.current.frontMatter ?? {}) };
        if (v.required) delete frontMatter.abstract;
        else frontMatter.abstract = null;
        const config = { ...v.current, frontMatter };
        if (Object.keys(frontMatter).length === 0) delete (config as any).frontMatter;
        const draft = await createProfileDraft('article_type', `${journalKey}:${code}`, {
          config,
          changeNote: v.required ? 'Bắt buộc có tóm tắt' : 'Không yêu cầu tóm tắt',
        });
        const checked = await validateProfileDraft('article_type', `${journalKey}:${code}`, draft.version);
        if (!checked.ok) throw new ProfileValidationError(checked.issues);
        return publishProfileDraft('article_type', `${journalKey}:${code}`, draft.version, {});
      },
      onSuccess: async () => {
        await Promise.all([
          client.invalidateQueries({ queryKey: typeVersionsKey(journalKey, code) }),
          client.invalidateQueries({ queryKey: PUBLISHED_PROFILES_KEY }),
          client.invalidateQueries({ queryKey: ['journals', 'resolved-profile'] }),
        ]);
      },
    },
    client,
  );
}
