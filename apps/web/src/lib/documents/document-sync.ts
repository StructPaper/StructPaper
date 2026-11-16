import type { CompletePaper } from '@/types/paper';
import { DocumentApi, type DocumentSummary, type SaveResult } from './document-api';

/**
 * Server sync for Word-like documents.
 *  - Content goes to the DB as JSON (CompletePaper).
 *  - Figure images are NOT embedded: they are uploaded once (content-addressed by SHA-256)
 *    to the asset store and referenced as "asset:<sha256>" inside the saved JSON.
 */

export const ASSET_PREFIX = 'asset:';

export interface SyncDeps {
  api: DocumentApi;
  /** Resolve a data:/blob: URL to bytes. Defaults to fetch(). */
  readBlob?: (url: string) => Promise<Blob>;
  sha256?: (data: ArrayBuffer) => Promise<string>;
}

async function defaultSha256(data: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(bin)}`;
}

function isLocalImage(src: string | undefined): src is string {
  return !!src && (src.startsWith('data:') || src.startsWith('blob:'));
}

/** Replace embedded/blob figure sources by content-addressed asset references. */
export async function packForServer(paper: CompletePaper, deps: SyncDeps): Promise<CompletePaper> {
  const readBlob = deps.readBlob ?? (async (u: string) => (await fetch(u)).blob());
  const sha = deps.sha256 ?? defaultSha256;
  const cache = new Map<string, string>();

  const sections = await Promise.all(
    (paper.sections || []).map(async (sec) => {
      const fig = sec.figure;
      if (!fig || !isLocalImage(fig.src)) return sec;
      let hash = cache.get(fig.src);
      if (!hash) {
        const blob = await readBlob(fig.src);
        hash = await sha(await blob.arrayBuffer());
        if (!(await deps.api.hasAsset(hash))) await deps.api.putAsset(hash, blob);
        cache.set(fig.src, hash);
      }
      return { ...sec, figure: { ...fig, src: `${ASSET_PREFIX}${hash}`, assetId: hash } };
    })
  );
  return { ...paper, sections };
}

/** Inverse of packForServer: asset references become data URLs the editor/compiler understand. */
export async function unpackFromServer(doc: CompletePaper, deps: SyncDeps): Promise<CompletePaper> {
  const sections = await Promise.all(
    (doc.sections || []).map(async (sec) => {
      const fig = sec.figure;
      if (!fig || !fig.src?.startsWith(ASSET_PREFIX)) return sec;
      const hash = fig.src.slice(ASSET_PREFIX.length);
      try {
        const blob = await deps.api.getAssetBlob(hash);
        return { ...sec, figure: { ...fig, src: await blobToDataUrl(blob), assetId: hash } };
      } catch {
        // Missing asset: keep the reference so a later sync can still resolve it.
        return sec;
      }
    })
  );
  return { ...doc, sections };
}

export function documentName(paper: CompletePaper): string {
  const named = (paper as any).displayName as string | undefined;
  return (named || paper.metadata?.title || paper.metadata?.titleEn || 'Tài liệu chưa đặt tên').trim().slice(0, 200);
}

export class DocumentSync {
  /** Last revision we know the server holds, per document (optimistic locking). */
  private revs = new Map<string, number>();

  constructor(private deps: SyncDeps) {}

  knownRev(id: string): number | undefined {
    return this.revs.get(id);
  }

  async push(
    paper: CompletePaper,
    opts: { snapshot?: boolean; force?: boolean } = {}
  ): Promise<SaveResult> {
    const packed = await packForServer(paper, this.deps);
    const rawStatus = (paper as any).workflowStatus || paper.status || 'draft';
    const result = await this.deps.api.save(paper.id, {
      name: documentName(paper),
      status: String(rawStatus).trim().toUpperCase().replace(/-/g, '_'),
      doc: packed,
      baseRev: opts.force ? undefined : this.revs.get(paper.id),
      snapshot: opts.snapshot,
    });
    if (result.id && result.id !== paper.id) {
      paper.id = result.id;
    }
    this.revs.set(paper.id, result.rev);
    return result;
  }

  async pull(id: string): Promise<CompletePaper> {
    const detail = await this.deps.api.get(id);
    this.revs.set(id, detail.rev);
    const base = (detail.doc || {}) as CompletePaper;
    const paper = await unpackFromServer({ ...base, id: detail.id }, this.deps);
    (paper as any).displayName = detail.name;
    return paper;
  }

  list(): Promise<DocumentSummary[]> {
    return this.deps.api.list();
  }
}
