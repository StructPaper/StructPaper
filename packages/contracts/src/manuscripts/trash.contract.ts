import { z } from 'zod';

export const TrashQuerySchema = z.object({
  /** Words of the title. */
  search: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type TrashQuery = z.infer<typeof TrashQuerySchema>;

export interface TrashedManuscriptDto {
  id: string;
  title: string;
  status: string;
  journal: { id: string; slug: string; code: string; name: string; color: string; shortName: string } | null;
  owner: { id: string; displayName: string } | null;
  deletedAt: string;
  deletedBy: { id: string; displayName: string } | null;
  /** When the trash removes it for good (deletedAt + retention). */
  purgeAt: string;
  /** Whole days left before that. */
  daysLeft: number;
  /** What the caller may do with it: whoever deleted a paper restores or deletes it for good; managers do it for their journals' papers. */
  access: { canRestore: boolean; canPurge: boolean };
}

export interface TrashListDto {
  items: TrashedManuscriptDto[];
  /** Days a paper stays in the trash. */
  retentionDays: number;
}

export const TrashBulkSchema = z.object({
  action: z.enum(['restore', 'purge']),
  /** The papers to act on; leave out for every paper the caller can see in the trash ("empty the trash"). */
  ids: z.array(z.string().uuid()).max(500).optional(),
});
export type TrashBulk = z.infer<typeof TrashBulkSchema>;

export interface TrashBulkResultDto {
  done: number;
  skipped: number;
}

/** A paper in the trash with its content, for reading before restoring. */
export interface TrashPreviewDto extends TrashedManuscriptDto {
  /** The stored content (read with docFromStored). */
  metadata: Record<string, unknown>;
}
