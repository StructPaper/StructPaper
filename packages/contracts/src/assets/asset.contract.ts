import { z } from 'zod';

export const UploadIntentSchema = z.object({
  filename: z.string().min(1, 'Filename is required'),
  mimeType: z.string().min(1, 'MIME type is required'),
  fileSize: z.number().int().positive('File size must be positive'),
  manuscriptId: z.string().uuid('Invalid manuscript UUID').nullable().optional(),
});

export type UploadIntent = z.infer<typeof UploadIntentSchema>;

export const UploadIntentResponseSchema = z.object({
  uploadUrl: z.string().url(),
  storageKey: z.string().min(1),
  expiresIn: z.number().int().positive(),
});

export type UploadIntentResponse = z.infer<typeof UploadIntentResponseSchema>;

export const UploadCompleteSchema = z.object({
  storageKey: z.string().min(1, 'Storage key is required'),
  checksum: z.string().min(1, 'Checksum is required'),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  fileSize: z.number().int().positive().optional(),
  manuscriptId: z.string().uuid('Invalid manuscript UUID').nullable().optional(),
});

export type UploadComplete = z.infer<typeof UploadCompleteSchema>;

export const AssetResponseSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid().nullable().optional(),
  filename: z.string(),
  fileSize: z.number().int().nonnegative(),
  mimeType: z.string(),
  storageKey: z.string(),
  checksum: z.string(),
  createdBy: z.string().uuid().optional(),
  createdAt: z.union([z.string().datetime(), z.date()]).optional(),
});

export type AssetResponse = z.infer<typeof AssetResponseSchema>;
