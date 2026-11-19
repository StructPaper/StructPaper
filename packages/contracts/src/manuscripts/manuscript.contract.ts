import { z } from 'zod';
import { ProfilePinSchema } from '../journals/journal.contract';

export const ManuscriptStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'PROOFING',
  'READY',
  'ACCEPTED',
  'REJECTED',
  'PUBLISHED',
  'ARCHIVED',
]);

export type ManuscriptStatus = z.infer<typeof ManuscriptStatusEnum>;

export const ManuscriptMemberRoleEnum = z.enum([
  'OWNER',
  'COAUTHOR',
  'EDITOR',
  'REVIEWER',
  'VIEWER',
]);

/** Who, besides the members, may open a manuscript (Google-Docs style "general access"). */
export const GeneralAccessEnum = z.enum(['RESTRICTED', 'VIEWER', 'EDITOR']);
export type GeneralAccess = z.infer<typeof GeneralAccessEnum>;

/** Statuses from which the creator can no longer delete a manuscript. */
export const NON_DELETABLE_STATUSES: ManuscriptStatus[] = [
  'IN_REVIEW',
  'PROOFING',
  'READY',
  'ACCEPTED',
  'PUBLISHED',
];

export const UpdateGeneralAccessSchema = z.object({ generalAccess: GeneralAccessEnum });
export type UpdateGeneralAccess = z.infer<typeof UpdateGeneralAccessSchema>;

export const DuplicateQuerySchema = z.object({ title: z.string().trim().min(1).max(500) });

export const PeopleSearchQuerySchema = z.object({ q: z.string().trim().min(2).max(100) });

export const ManuscriptAccessSchema = z.object({
  canEdit: z.boolean(),
  canShare: z.boolean(),
  canDelete: z.boolean(),
});
export type ManuscriptAccess = z.infer<typeof ManuscriptAccessSchema>;

export type ManuscriptMemberRole = z.infer<typeof ManuscriptMemberRoleEnum>;

export const CreateManuscriptSchema = z.object({
  journalId: z.string().optional(),
  /** Code of one of the journal's article types ("research"). Unknown codes are ignored. */
  articleType: z.string().optional(),
  /** The profile versions the client laid the paper out with; absent: the published ones. */
  profilePin: ProfilePinSchema.optional(),
  title: z.string().min(1, 'Title is required').max(500),
  abstract: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

export type CreateManuscript = z.infer<typeof CreateManuscriptSchema>;

export const UpdateManuscriptSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  abstract: z.string().nullable().optional(),
  status: z
    .preprocess((val) => {
      if (typeof val !== 'string') return val;
      const clean = val.trim().toUpperCase().replace(/-/g, '_');
      if (clean === 'UNDER_REVIEW') return 'IN_REVIEW';
      return clean;
    }, ManuscriptStatusEnum)
    .optional(),
  metadata: z.record(z.any()).optional(),
});

export type UpdateManuscript = z.infer<typeof UpdateManuscriptSchema>;

export const ChangeManuscriptStatusSchema = z.object({
  status: ManuscriptStatusEnum,
  reason: z.string().max(1000).optional(),
  note: z.string().max(2000).optional(),
});

export type ChangeManuscriptStatus = z.infer<typeof ChangeManuscriptStatusSchema>;

export const ManuscriptQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  cursor: z.string().optional(),
  search: z.string().optional(),
  journalId: z.string().uuid().optional(),
  status: ManuscriptStatusEnum.optional(),
  /** mine (default): papers I am a member of; public: every paper shared with anyone; shared: public papers I opened through a link. */
  scope: z.enum(['mine', 'public', 'shared']).optional().default('mine'),
  sortBy: z.string().optional().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type ManuscriptQuery = z.infer<typeof ManuscriptQuerySchema>;

export const AddManuscriptMemberSchema = z.object({
  userId: z.string().uuid('Invalid user UUID'),
  role: ManuscriptMemberRoleEnum,
});

export type AddManuscriptMember = z.infer<typeof AddManuscriptMemberSchema>;

export const ManuscriptMemberSchema = z.object({
  manuscriptId: z.string().uuid(),
  userId: z.string().uuid(),
  role: ManuscriptMemberRoleEnum,
  createdAt: z.union([z.string().datetime(), z.date()]).optional(),
});

export type ManuscriptMember = z.infer<typeof ManuscriptMemberSchema>;

export const ManuscriptResponseSchema = z.object({
  id: z.string().uuid(),
  journalId: z.string().uuid(),
  title: z.string(),
  abstract: z.string().nullable().optional(),
  status: ManuscriptStatusEnum,
  generalAccess: GeneralAccessEnum.optional(),
  access: ManuscriptAccessSchema.optional(),
  createdBy: z.string().uuid(),
  currentServerRev: z.number().int().nonnegative(),
  version: z.number().int().positive(),
  /** The profile versions the paper is laid out under; only an explicit upgrade moves them. */
  profilePin: ProfilePinSchema.optional(),
  /** Code of the paper's article type ("research"). */
  articleType: z.string().nullable().optional(),
  metadata: z.record(z.any()),
  createdAt: z.union([z.string().datetime(), z.date()]),
  updatedAt: z.union([z.string().datetime(), z.date()]),
  journal: z.object({
    id: z.string(),
    slug: z.string(),
    code: z.string(),
    name: z.string(),
    shortName: z.string().optional(),
    color: z.string().optional(),
  }).optional(),
});

export type ManuscriptResponse = z.infer<typeof ManuscriptResponseSchema>;
