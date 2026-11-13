import { z } from 'zod';

export const PatchSchema = z.object({
  op: z.string().min(1, 'Patch operation is required'),
  path: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]),
  value: z.any().optional(),
  from: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]).optional(),
});

export type Patch = z.infer<typeof PatchSchema>;

export const ManuscriptOpSchema = z.object({
  id: z.string().uuid(),
  manuscriptId: z.string().uuid(),
  serverRev: z.number().int().nonnegative(),
  clientRev: z.number().int().nonnegative(),
  opId: z.string().uuid(),
  patches: z.array(PatchSchema),
  checksum: z.string().optional(),
  createdBy: z.string().uuid().optional(),
  createdAt: z.union([z.string().datetime(), z.date()]).optional(),
});

export type ManuscriptOp = z.infer<typeof ManuscriptOpSchema>;

export const SubmitOpsSchema = z.object({
  baseServerRev: z.number().int().nonnegative('baseServerRev must be non-negative'),
  clientRev: z.number().int().nonnegative('clientRev must be non-negative'),
  opId: z.string().uuid('Invalid opId UUID'),
  patches: z.array(PatchSchema).min(1, 'Patches array cannot be empty'),
});

export type SubmitOps = z.infer<typeof SubmitOpsSchema>;

export const OpsDeltaResponseSchema = z.object({
  serverRev: z.number().int().nonnegative(),
  ops: z.array(ManuscriptOpSchema),
  missingOps: z.array(ManuscriptOpSchema).optional(),
  code: z.string().optional(),
});

export type OpsDeltaResponse = z.infer<typeof OpsDeltaResponseSchema>;
