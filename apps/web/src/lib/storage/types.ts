import type { CompletePaper } from '@/types/paper';
import type { ManuscriptRecord, ManuscriptInfo, Manuscript } from '@structpaper/doc-model';

/**
 * Result returned after saving a manuscript.
 */
export interface SavePaperResult {
  id: string;
  version?: number;
}

/**
 * Core interface for manuscript storage operations.
 * Implemented by LocalStorageAdapter, NoopStorageAdapter, ServerStorageAdapter,
 * and coordinated by UnifiedManuscriptRepository (Composite Pattern).
 */
export interface ManuscriptStorage {
  /**
   * Indicates whether local storage persistence is active.
   * True for LocalStorageAdapter, False for NoopStorageAdapter.
   */
  readonly isLocalAvailable: boolean;

  /**
   * Persists a paper.
   * - In Server-Only mode: writes directly to the API server.
   * - In Local-First mode: writes to local IndexedDB and synchronizes with server.
   */
  savePaper(paper: CompletePaper): Promise<SavePaperResult>;

  /**
   * Persists a low-level AST manuscript record and info into local storage.
   */
  saveRecord(doc: Manuscript, info?: Partial<ManuscriptInfo>): Promise<void>;

  /**
   * Loads a complete paper by ID.
   * Returns null if the paper is not found.
   */
  loadPaper(id: string): Promise<CompletePaper | null>;

  /**
   * Lists all manuscript records for hub views, recents, and paper tables.
   */
  listRecords(): Promise<ManuscriptRecord[]>;

  /**
   * Retrieves a single manuscript record by ID.
   */
  getRecord(id: string): Promise<ManuscriptRecord | null>;

  /**
   * Deletes a manuscript by ID across active storage tiers.
   */
  delete(id: string): Promise<void>;

  /**
   * Updates partial metadata/info of a manuscript (e.g. pinned, tags, status, displayName).
   */
  updateInfo(id: string, patch: Partial<ManuscriptInfo>): Promise<void>;

  /**
   * Creates a duplicate copy of a manuscript.
   */
  duplicate(paper: ManuscriptRecord): Promise<{ id: string }>;
}
