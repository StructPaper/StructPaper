import { z } from 'zod';

/** The versions of a paper's content an author sees in its history. */
export const RevisionKindEnum = z.enum(['auto', 'named', 'pre-risk', 'profile-upgrade', 'restore', 'import']);
export type RevisionKindValue = z.infer<typeof RevisionKindEnum>;

export const CreateRevisionSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional(),
  /** Only a named version or the safety copy before a risky step can be asked for; the rest the server decides. */
  kind: z.enum(['named', 'pre-risk']).default('named'),
});
export type CreateRevision = z.infer<typeof CreateRevisionSchema>;

export const UpdateRevisionSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.description !== undefined, { message: 'Nothing to change' });
export type UpdateRevision = z.infer<typeof UpdateRevisionSchema>;

export const ListRevisionsQuerySchema = z.object({
  /** "named" = only named versions; otherwise one of RevisionKindEnum; absent = every kind. */
  kind: RevisionKindEnum.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** createdAt of the last item of the previous page. */
  before: z.string().optional(),
});
export type ListRevisionsQuery = z.infer<typeof ListRevisionsQuerySchema>;

export interface RevisionStatsDto {
  blocksAdded: number;
  blocksRemoved: number;
  blocksModified: number;
  blocksMoved: number;
  wordsDelta: number;
  refsDelta: number;
  fieldsChanged: number;
  itemsChanged: number;
  layoutChanged: boolean;
}

export interface RevisionSummaryDto {
  id: string;
  manuscriptId: string;
  kind: RevisionKindValue;
  name: string | null;
  description: string | null;
  pinned: boolean;
  createdAt: string;
  author: { id: string; displayName: string } | null;
  stats: RevisionStatsDto;
  sizeBytes: number;
}

export interface RevisionDto extends RevisionSummaryDto {
  /** The paper as it was (the same shape the editor saves). */
  doc: Record<string, unknown>;
}

export interface RevisionListDto {
  items: RevisionSummaryDto[];
  /** Pass as `before` for the next page; null at the end. */
  nextBefore: string | null;
}

export interface RestoreRevisionResultDto {
  version: number;
  /** The revision that was written for the restore. */
  restoredAs: RevisionSummaryDto;
}
