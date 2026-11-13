import { z } from 'zod';

export const CompileEngineEnum = z.enum(['XELATEX', 'TECTONIC']);
export type CompileEngine = z.infer<typeof CompileEngineEnum>;

export const CompileJobStatusEnum = z.enum([
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);
export type CompileJobStatus = z.infer<typeof CompileJobStatusEnum>;

export const TriggerCompileSchema = z.object({
  manuscriptId: z.string().uuid('Invalid manuscript UUID'),
  revisionId: z.string().uuid('Invalid revision UUID').nullable().optional(),
  serverRev: z.number().int().nonnegative().optional(),
  engine: CompileEngineEnum.default('XELATEX'),
});

export type TriggerCompile = z.infer<typeof TriggerCompileSchema>;

export const CompileJobResponseSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  revisionId: z.string().uuid().nullable().optional(),
  serverRev: z.number().int().nonnegative().optional(),
  status: CompileJobStatusEnum,
  engine: CompileEngineEnum,
  logOutput: z.string().nullable().optional(),
  pdfAssetId: z.string().uuid().nullable().optional(),
  pdfUrl: z.string().url().nullable().optional(),
  durationMs: z.number().int().nullable().optional(),
  createdAt: z.union([z.string().datetime(), z.date()]).optional(),
  updatedAt: z.union([z.string().datetime(), z.date()]).optional(),
});

export type CompileJobResponse = z.infer<typeof CompileJobResponseSchema>;
