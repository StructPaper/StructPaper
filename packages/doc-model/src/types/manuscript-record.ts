import type { Manuscript } from './manuscript';

/**
 * Pinned profile configuration versions (PDF Spec 5.1d).
 * Pinning ensures that regenerating or reopening an older revision
 * re-evaluates rules according to the exact pinned profile version,
 * rather than quietly applying newer editorial guidelines.
 */
export interface ProfilePin {
  base: number;
  journal: number;
  articleType: number;
  environmentId?: string;
}

/**
 * Editorial workflow status of a manuscript.
 * Independent of preflight QC score or compile status.
 */
export type WorkflowStatus =
  | 'draft'
  | 'in-review'
  | 'proofing'
  | 'ready'
  | 'published';

/**
 * Origin source file information for ingested Word documents.
 */
export interface ManuscriptSourceInfo {
  fileName: string;
  importedAt: string;
  sha256: string;
}

/**
 * Manuscript identification profile (ManuscriptInfo, PDF Spec 3.6).
 * Contains descriptive information used for dashboard listings, tab titles,
 * tags, search, and workflow tracking.
 *
 * NOTE: Updating `ManuscriptInfo` does NOT modify the article content,
 * does NOT bump `doc.rev`, and does NOT trigger TeX recompilation.
 */
export interface ManuscriptInfo {
  id: string;
  displayName: string;
  submissionId?: string;
  note?: string;
  tags: string[];
  workflowStatus: WorkflowStatus;
  pinned: boolean;
  archived: boolean;
  color?: string;
  source?: ManuscriptSourceInfo;
  ownerId?: string;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
}

/**
 * Complete manuscript record encapsulating metadata info and document content.
 */
export interface ManuscriptRecord {
  info: ManuscriptInfo;
  doc: Manuscript;
  revision?: number;
  syncState?: 'synced' | 'local' | 'syncing';
}
