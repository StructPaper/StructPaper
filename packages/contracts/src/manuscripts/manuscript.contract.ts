import { z } from 'zod';

export const ManuscriptStatusEnum = z.enum([
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'ACCEPTED',
  'REJECTED',
  'PUBLISHED',
]);

export type ManuscriptStatus = z.infer<typeof ManuscriptStatusEnum>;

export const ManuscriptMemberRoleEnum = z.enum([
  'OWNER',
  'COAUTHOR',
  'EDITOR',
  'REVIEWER',
]);

export type ManuscriptMemberRole = z.infer<typeof ManuscriptMemberRoleEnum>;

export const CreateManuscriptSchema = z.object({
  journalId: z.string().optional(),
  title: z.string().min(1, 'Title is required').max(500),
  abstract: z.string().nullable().optional(),
  metadata: z.record(z.any()).optional().default({}),
});

export type CreateManuscript = z.infer<typeof CreateManuscriptSchema>;

export const UpdateManuscriptSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  abstract: z.string().nullable().optional(),
  status: z
    .preprocess(
      (val) => (typeof val === 'string' ? val.toUpperCase() : val),
      ManuscriptStatusEnum,
    )
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
  createdBy: z.string().uuid(),
  currentServerRev: z.number().int().nonnegative(),
  version: z.number().int().positive(),
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
