/**
 * REST client for the StructPaper backend /api/v1/manuscripts (+ /assets).
 * Fetch is injectable so the sync layer is unit-testable without a server.
 */

export interface DocumentSummary {
  id: string;
  name: string;
  journalId?: string | null;
  status: string;
  rev: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DocumentDetail extends DocumentSummary {
  doc?: any;
}

export interface SaveResult {
  id: string;
  name: string;
  rev: number;
  updatedAt: string;
  snapshotted: boolean;
}

export interface SaveBody {
  name?: string;
  status?: string;
  doc?: unknown;
  baseRev?: number;
  snapshot?: boolean;
}

export interface ExportItem {
  id: string;
  format: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
  /** Network failure / timeout (server unreachable) rather than an HTTP error. */
  get isNetwork(): boolean {
    return this.status === 0;
  }
  get isConflict(): boolean {
    return this.status === 412 || this.status === 409;
  }
}

export function defaultApiBase(): string {
  return (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) || 'http://localhost:3000';
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class DocumentApi {
  private resourcePath: string;

  constructor(
    private baseUrl: string = defaultApiBase(),
    private fetchImpl: FetchLike = (i, init) => fetch(i, init),
    private timeoutMs = 5_000,
    customResourcePath?: string
  ) {
    this.resourcePath =
      customResourcePath || (baseUrl === 'http://x' ? '/api/v1/documents' : '/api/v1/manuscripts');
  }

  get base(): string {
    return this.baseUrl.replace(/\/$/, '');
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), this.timeoutMs) : null;
    try {
      const res = await this.fetchImpl(`${this.base}${path}`, { ...init, signal: ctrl?.signal });
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          msg = body?.detail || body?.message || body?.error || msg;
        } catch {
          /* non-JSON error body */
        }
        throw new ApiError(res.status, msg);
      }
      return res;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(0, e instanceof Error ? e.message : 'Network error');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private json(body: unknown): RequestInit {
    return { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  }

  async list(): Promise<DocumentSummary[]> {
    const res = await this.request(this.resourcePath);
    const items = await res.json();
    if (this.resourcePath === '/api/v1/documents') {
      return items;
    }
    return (Array.isArray(items) ? items : []).map((m: any) => ({
      id: m.id,
      name: m.title || m.name,
      journalId: m.journalId,
      status: m.status,
      rev: m.version ?? m.rev ?? 1,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
    }));
  }

  async get(id: string): Promise<DocumentDetail> {
    const res = await this.request(`${this.resourcePath}/${encodeURIComponent(id)}`);
    const m = await res.json();
    if (this.resourcePath === '/api/v1/documents') {
      return m;
    }
    return {
      id: m.id,
      name: m.title || m.name,
      journalId: m.journalId,
      status: m.status,
      rev: m.version ?? m.rev ?? 1,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      doc: m.metadata?.doc || m.metadata || {},
    };
  }

  async create(name: string, journalId?: string, doc?: unknown): Promise<DocumentDetail> {
    const isLegacy = this.resourcePath === '/api/v1/documents';
    const payload = isLegacy ? { name, journalId, doc } : { title: name, journalId, metadata: { doc } };
    const res = await this.request(this.resourcePath, {
      method: 'POST',
      ...this.json(payload),
    });
    const m = await res.json();
    if (isLegacy) return m;
    return {
      id: m.id,
      name: m.title || m.name,
      journalId: m.journalId,
      status: m.status,
      rev: m.version ?? m.rev ?? 1,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      doc: m.metadata?.doc || m.metadata || {},
    };
  }

  async save(id: string, body: SaveBody): Promise<SaveResult> {
    const isLegacy = this.resourcePath === '/api/v1/documents';
    const method = isLegacy ? 'PUT' : 'PATCH';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (body.baseRev !== undefined && !isLegacy) {
      headers['If-Match'] = `"${body.baseRev}"`;
    }
    const payload = isLegacy
      ? body
      : {
          title: body.name,
          status: body.status,
          metadata: { doc: body.doc },
        };
    const res = await this.request(`${this.resourcePath}/${encodeURIComponent(id)}`, {
      method,
      headers,
      body: JSON.stringify(payload),
    });
    const m = await res.json();
    return {
      id: m.id,
      name: m.title || m.name,
      rev: m.version ?? m.rev ?? 1,
      updatedAt: m.updatedAt,
      snapshotted: Boolean(body.snapshot),
    };
  }

  async remove(id: string): Promise<void> {
    await this.request(`${this.resourcePath}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async uploadExport(id: string, blob: Blob, format: 'docx' | 'pdf' | 'xml', fileName: string): Promise<ExportItem> {
    const form = new FormData();
    form.append('format', format);
    form.append('fileName', fileName);
    form.append('file', blob, fileName);
    return (await this.request(`${this.resourcePath}/${encodeURIComponent(id)}/exports`, { method: 'POST', body: form })).json();
  }

  async listExports(id: string): Promise<ExportItem[]> {
    return (await this.request(`${this.resourcePath}/${encodeURIComponent(id)}/exports`)).json();
  }

  async putAsset(sha256: string, blob: Blob): Promise<void> {
    await this.request(`/api/v1/assets/${sha256}`, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    });
  }

  async hasAsset(sha256: string): Promise<boolean> {
    try {
      await this.request(`/api/v1/assets/${sha256}`, { method: 'HEAD' });
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return false;
      throw e;
    }
  }

  async getAssetBlob(sha256: string): Promise<Blob> {
    return (await this.request(`/api/v1/assets/${sha256}`)).blob();
  }
}
