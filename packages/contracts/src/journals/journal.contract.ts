import { z } from 'zod';

export const JournalStatusEnum = z.enum(['draft', 'published', 'archived']);
export type JournalStatusValue = z.infer<typeof JournalStatusEnum>;

/** "VNUHCM-HS": what the journal calls itself in headers and lists. */
const JournalCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,30}$/, 'Code: letters, digits and dashes, e.g. VNUHCM-HS');

const HexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colour must look like #RRGGBB');

/** "hs": letters, digits and dashes; the slug is "vnuhcm-" + this. */
const JournalKey = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9-]{1,30}$/, 'Key: 2-31 letters, digits or dashes, starting with a letter');

export const CreateJournalSchema = z.object({
  key: JournalKey,
  name: z.string().trim().min(3).max(255),
  nameEn: z.string().trim().max(255).optional(),
  code: JournalCode.optional(),
  shortName: z.string().trim().min(1).max(20).optional(),
  issn: z.string().trim().regex(/^\d{4}-\d{3}[\dXx]$/, 'ISSN looks like 1859-0128').nullable().optional(),
  color: HexColor,
  status: JournalStatusEnum.default('draft'),
  articleTypes: z.array(z.string().min(1)).min(1).optional(),
});
export type CreateJournal = z.infer<typeof CreateJournalSchema>;

export const UpdateJournalSchema = z
  .object({
    name: z.string().trim().min(3).max(255),
    nameEn: z.string().trim().max(255),
    code: JournalCode,
    shortName: z.string().trim().min(1).max(20),
    issn: z.string().trim().regex(/^\d{4}-\d{3}[\dXx]$/, 'ISSN looks like 1859-0128').nullable(),
    color: HexColor,
    status: JournalStatusEnum,
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateJournal = z.infer<typeof UpdateJournalSchema>;

export const ProfileScopeEnum = z.enum(['base', 'journal', 'article_type']);
export type ProfileScopeValue = z.infer<typeof ProfileScopeEnum>;

export const ProfileStateEnum = z.enum(['draft', 'validated', 'published', 'archived']);
export type ProfileStateValue = z.infer<typeof ProfileStateEnum>;

/** The rules of one tier. The shape is checked on validate, not here: a draft may be incomplete. */
export const ProfileConfigSchema = z.record(z.unknown());

export const CreateProfileDraftSchema = z.object({
  config: ProfileConfigSchema,
  changeNote: z.string().trim().max(500).optional(),
});
export type CreateProfileDraft = z.infer<typeof CreateProfileDraftSchema>;

export const UpdateProfileDraftSchema = z
  .object({ config: ProfileConfigSchema, changeNote: z.string().trim().max(500) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateProfileDraft = z.infer<typeof UpdateProfileDraftSchema>;

export const PublishProfileSchema = z.object({ changeNote: z.string().trim().max(500).optional() }).default({});
export type PublishProfile = z.infer<typeof PublishProfileSchema>;

export const RollbackProfileSchema = z.object({
  /** The earlier version whose rules become the newly published version. */
  toVersion: z.number().int().positive(),
  changeNote: z.string().trim().max(500).optional(),
});
export type RollbackProfile = z.infer<typeof RollbackProfileSchema>;

export interface ProfileVersionDto {
  id: string;
  scope: ProfileScopeValue;
  journalId: string | null;
  version: number;
  state: ProfileStateValue;
  config: Record<string, unknown>;
  schemaVersion: number;
  changeNote: string | null;
  createdBy: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface ProfileIssueDto {
  path: string;
  message: string;
}

export interface ProfileValidationDto {
  ok: boolean;
  issues: ProfileIssueDto[];
  version: ProfileVersionDto;
}

/** The versions of the profile tiers a paper was written under. */
export const ProfilePinSchema = z.object({
  base: z.number().int().positive().optional(),
  journal: z.number().int().positive().optional(),
  articleType: z.number().int().positive().optional(),
});
export type ProfilePin = z.infer<typeof ProfilePinSchema>;

const ArticleTypeCode = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9-]{1,49}$/, 'Code: 2-50 letters, digits or dashes, starting with a letter');

export const ArticleTypeLabelsSchema = z.object({
  vi: z.string().trim().min(1).max(120),
  en: z.string().trim().min(1).max(120),
});

export const CreateArticleTypeSchema = z.object({
  code: ArticleTypeCode,
  labels: ArticleTypeLabelsSchema,
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
export type CreateArticleType = z.infer<typeof CreateArticleTypeSchema>;

export const UpdateArticleTypeSchema = z
  .object({
    labels: ArticleTypeLabelsSchema,
    status: z.enum(['active', 'archived']),
    sortOrder: z.number().int().min(0).max(10_000),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');
export type UpdateArticleType = z.infer<typeof UpdateArticleTypeSchema>;

export interface ArticleTypeDto {
  id: string;
  /** "research" */
  code: string;
  labels: { vi: string; en: string };
  status: 'active' | 'archived';
  sortOrder: number;
}

/** Moves a paper to another article type of its journal (or to none). Its base and journal pins stay as they are. */
export const ChangeArticleTypeSchema = z.object({
  articleType: z.string().trim().toLowerCase().regex(/^[a-z][a-z0-9-]{1,49}$/, 'Article type code').nullable(),
});
export type ChangeArticleType = z.infer<typeof ChangeArticleTypeSchema>;

/** Moving every paper of a journal to its newest rules cannot be undone, so the caller proves who they are first. */
export const ApplyProfileToPapersSchema = z.object({
  password: z.string().min(1).max(256),
});
export type ApplyProfileToPapers = z.infer<typeof ApplyProfileToPapersSchema>;

export interface ApplyProfileToPapersResult {
  /** Papers moved to the newest rules. */
  updated: number;
  /** Papers that were already on them. */
  unchanged: number;
}
