import { z } from 'zod';

export const SystemRoleEnum = z.enum([
  'SuperAdmin',
  'JournalManager',
  'Editor',
  'Author',
  'Reviewer',
]);

export type SystemRole = z.infer<typeof SystemRoleEnum>;

export const PermissionSchema = z.object({
  id: z.string().uuid().optional(),
  action: z.string().min(1, 'Action is required'),
  subject: z.string().min(1, 'Subject is required'),
  conditions: z.record(z.any()).nullable().optional(),
});

export type Permission = z.infer<typeof PermissionSchema>;

export const RoleSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Role name is required'),
  description: z.string().nullable().optional(),
  journalId: z.string().uuid().nullable().optional(),
  isSystem: z.boolean().default(false),
  permissions: z.array(PermissionSchema).optional(),
});

export type Role = z.infer<typeof RoleSchema>;

export const AssignRoleSchema = z.object({
  userId: z.string().uuid('Invalid user UUID'),
  roleId: z.string().uuid('Invalid role UUID'),
  journalId: z.string().uuid('Invalid journal UUID').nullable().optional(),
});

export type AssignRole = z.infer<typeof AssignRoleSchema>;

export const RevokeRoleSchema = z.object({
  userId: z.string().uuid('Invalid user UUID'),
  roleId: z.string().uuid('Invalid role UUID'),
  journalId: z.string().uuid('Invalid journal UUID').nullable().optional(),
});

export type RevokeRole = z.infer<typeof RevokeRoleSchema>;
