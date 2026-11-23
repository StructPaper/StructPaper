import type { CompletePaper } from '@/types/paper';
import { DocumentApi, type SourceInfo } from './document-api';
import { IMPORTER_VERSION } from '@/lib/docx-importer-version';
import { slimForStorage, planMerge, type MergePlan, type PaperLike } from '@/lib/import-merge/three-way';

/**
 * The Word file a paper was imported from.
 *  - On import the file, the importer version and the first reading (what the importer made of it) are remembered here until
 *    the paper exists on the server (a new paper has a local id first), then stored with the paper.
 *  - Later, "Phân tích lại" reads the stored file again with the current importer and compares three sides
 *    (see `lib/import-merge/three-way.ts`); nothing changes until the author accepts parts of the result.
 */

export interface PendingSource {
  buffer: ArrayBuffer;
  fileName: string;
  /** The first reading, pictures reduced to fingerprints. */
  baseline: PaperLike;
  importerVersion: number;
}

const pending = new Map<string, PendingSource>();

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Called right after the importer read a file: the file goes to the server with the paper's first save. */
export function registerPendingSource(paperId: string, buffer: ArrayBuffer, fileName: string, parsed: CompletePaper): void {
  pending.set(paperId, { buffer, fileName, baseline: slimForStorage(parsed as unknown as PaperLike), importerVersion: IMPORTER_VERSION });
}

export const hasPendingSource = (paperId: string): boolean => pending.has(paperId);

/** Writes the Word file and its first reading for a paper that now has a server id. Never throws: a paper must save anyway. */
export async function flushPendingSource(localId: string, serverId: string, api: DocumentApi = new DocumentApi()): Promise<boolean> {
  const item = pending.get(localId);
  if (!item) return false;
  try {
    await storeSource(api, serverId, item);
    pending.delete(localId);
    return true;
  } catch (err) {
    console.warn('[word-source] could not store the Word file yet, will retry on the next save:', err);
    return false;
  }
}

/** Stores file + first reading (+ importer version) for a paper. */
export async function storeSource(api: DocumentApi, paperId: string, item: PendingSource): Promise<SourceInfo> {
  const blob = new Blob([item.buffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  await api.putSourceFile(paperId, blob, { fileName: item.fileName, sha256: await sha256Hex(item.buffer), importerVersion: item.importerVersion });
  return api.putSourceBaseline(paperId, item.baseline, item.importerVersion);
}

export type ParseFn = (buffer: ArrayBuffer, fileName?: string) => Promise<CompletePaper>;

export interface Analysis {
  plan: MergePlan;
  /** What the file says now. */
  theirs: CompletePaper;
  buffer: ArrayBuffer;
  fileName: string;
  /** The file is new (replacement or first upload): it is stored when the author applies. */
  isNewFile: boolean;
  /** Version of the importer that read the file now. */
  importerVersion: number;
  /** The two other sides, kept so the comparison can be redone with another option. */
  base: PaperLike;
  ours: PaperLike;
}

/**
 * Reads the stored file (or `file`, a replacement, or a first upload for an older paper) with the current importer and compares it
 * with the paper. Without a stored first reading the comparison is two-sided and nothing is ticked.
 */
export async function analyzeSource(
  api: DocumentApi,
  paper: CompletePaper,
  parse: ParseFn,
  opts: { file?: File; stored?: SourceInfo | null; includeEdits?: boolean } = {},
): Promise<Analysis> {
  let buffer: ArrayBuffer;
  let fileName: string;
  let isNewFile = false;
  if (opts.file) {
    buffer = await opts.file.arrayBuffer();
    fileName = opts.file.name;
    isNewFile = true;
  } else {
    const blob = await api.getSourceFile(paper.id);
    buffer = await blob.arrayBuffer();
    fileName = opts.stored?.fileName ?? 'document.docx';
  }
  const theirs = await parse(buffer, fileName);

  // A replacement is compared with the reading of the file it replaces; a paper with no reading is compared with itself, carefully
  const stored = await api.getSourceBaseline(paper.id).catch(() => null);
  const conservative = !stored;
  const base = (stored ?? paper) as PaperLike;
  const ours = paper as unknown as PaperLike;
  const plan = planMerge(base, ours, theirs as unknown as PaperLike, { conservative, includeEdits: opts.includeEdits });
  return { plan, theirs, buffer, fileName, isNewFile, importerVersion: IMPORTER_VERSION, base, ours };
}

/**
 * After the author decided: the new first reading (and the file, when it is new) are stored, so the next reading starts from what
 * the author has now. The paper itself is saved by the editor as usual.
 */
export async function commitAnalysis(api: DocumentApi, paperId: string, analysis: Analysis): Promise<SourceInfo> {
  if (analysis.isNewFile) {
    return storeSource(api, paperId, {
      buffer: analysis.buffer,
      fileName: analysis.fileName,
      baseline: analysis.plan.newBaseline,
      importerVersion: analysis.importerVersion,
    });
  }
  return api.putSourceBaseline(paperId, analysis.plan.newBaseline, analysis.importerVersion);
}

// A batch import gives each parsed paper its own id after parsing: the file waits on the parsed object until then.
const stashed = new WeakMap<object, PendingSource>();

export function stashSource(parsed: CompletePaper, buffer: ArrayBuffer, fileName: string): void {
  stashed.set(parsed, { buffer, fileName, baseline: slimForStorage(parsed as unknown as PaperLike), importerVersion: IMPORTER_VERSION });
}

/** The file stashed for `parsed` now belongs to the paper with id `paperId`. */
export function adoptStashedSource(parsed: CompletePaper, paperId: string): void {
  const item = stashed.get(parsed);
  if (!item) return;
  pending.set(paperId, item);
  stashed.delete(parsed);
}

/** The same comparison with or without the places where the paper differs from an unchanged file. */
export function replanAnalysis(analysis: Analysis, includeEdits: boolean): Analysis {
  const plan = planMerge(analysis.base, analysis.ours, analysis.theirs as unknown as PaperLike, { conservative: analysis.plan.conservative, includeEdits });
  return { ...analysis, plan };
}
