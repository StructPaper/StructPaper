import { z } from 'zod';

const emailPreprocessed = z.preprocess(
  (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val),
  z.string().email('Invalid email address'),
);

export const LoginRequestSchema = z.object({
  email: emailPreprocessed,
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const UserSummarySchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  status: z.enum(['ACTIVE', 'INVITED', 'SUSPENDED']).optional(),
});

export type UserSummary = z.infer<typeof UserSummarySchema>;

export const TokenResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresIn: z.number().int().positive(),
  tokenType: z.string().default('Bearer'),
  user: UserSummarySchema.optional(),
});

export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const InviteUserSchema = z.object({
  email: emailPreprocessed,
  role: z.string().min(1, 'Role name or identifier is required'),
  journalId: z.string().uuid().optional().nullable(),
  displayName: z.string().optional(),
});

export type InviteUser = z.infer<typeof InviteUserSchema>;

export const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export type ResetPassword = z.infer<typeof ResetPasswordSchema>;
