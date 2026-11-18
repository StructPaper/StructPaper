import type { CompletePaper } from '@/types/paper';

/**
 * queued -> parsing (read the Word file) -> saving (local + server copy) -> waiting (for a free
 * typesetting slot) -> compiling (PDF) -> done. `queued`/`waiting` mean "not running yet".
 * `error`: the paper could not be created (unreadable file, save failed). A paper that was created
 * but whose PDF failed is `done` with `compileError` set. `cancelled`: stopped before it was created.
 */
export type BatchStage = 'queued' | 'parsing' | 'saving' | 'waiting' | 'compiling' | 'done' | 'error' | 'cancelled';

export interface BatchItem {
  /** Stable key for lists (index + name). */
  key: string;
  fileName: string;
  size: number;
  stage: BatchStage;
  /** Why the paper was not created (stage 'error'). */
  error?: string;
  /** Why there is no PDF although the paper exists. */
  compileError?: string;
  paperId?: string;
  title?: string;
  /** Journal template this paper was made with (abbreviation), e.g. 'HS'. */
  journalAbbv?: string;
  /** Import checks (same rules as the single-file import gate). */
  errors: number;
  warnings: number;
  pdf?: { blob: Blob; ms: number };
}

export interface BatchJournal {
  /** e.g. 'VNUHCM-HS' */
  journalId: string;
  journalName: string;
  journalAbbv: string;
}

/** Everything the run needs from the outside world (the real ones are in default-deps.ts). */
export interface BatchDeps {
  /** Read and parse one Word file. */
  parse(file: File): Promise<CompletePaper>;
  /** Titles already in use (so new papers get "Title (1)" instead of duplicates). */
  existingTitles(): Promise<string[]>;
  /** Persist locally; false = failed. */
  save(paper: CompletePaper): Promise<boolean>;
  /** Read a saved paper back (so a paper waiting for a typesetting slot need not stay in memory). */
  load?(id: string): Promise<CompletePaper | null>;
  /** Best-effort copy on the server; failures never fail the item. */
  push?(paper: CompletePaper): Promise<void>;
  /** Import checks. */
  check(paper: CompletePaper): { errors: number; warnings: number };
  /** Typeset the paper to PDF. Must reject with an AbortError when `signal` aborts. */
  compile(paper: CompletePaper, signal: AbortSignal): Promise<{ blob: Blob; ms: number }>;
  /** Keep the PDF with the paper on the server (best-effort). */
  archive?(paper: CompletePaper, pdf: Blob, fileName: string): Promise<void>;
}

export interface BatchOptions {
  files: File[];
  /** Template for every file that has no entry in `journals`. */
  journal: BatchJournal;
  /** Template per file (same order as `files`); a file may use a different journal than the others. */
  /** null = automatic: the journal the file states, else `journal`. */
  journals?: Array<BatchJournal | null>;
  deps: BatchDeps;
  /** Word files read at the same time (browser CPU). Default 2. */
  parseLimit?: number;
  /** PDFs typeset at the same time (server CPU). Default 3. */
  compileLimit?: number;
  signal?: AbortSignal;
  onUpdate?: (items: BatchItem[]) => void;
}
