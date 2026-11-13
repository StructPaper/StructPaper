/**
 * REST client for the StructPaper backend /api/v1/documents (+ /assets).
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
  return (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL) || 'http://localhost:8080';
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class DocumentApi {
  constructor(
    private baseUrl: string = defaultApiBase(),
    private fetchImpl: FetchLike = (i, init) => fetch(i, init),
    private timeoutMs = 5_000
  ) {}

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
          msg = body?.message || body?.error || msg;
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
    return (await this.request('/api/v1/documents')).json();
  }

  async get(id: string): Promise<DocumentDetail> {
    return (await this.request(`/api/v1/documents/${encodeURIComponent(id)}`)).json();
  }

  async create(name: string, journalId?: string, doc?: unknown): Promise<DocumentDetail> {
    return (await this.request('/api/v1/documents', { method: 'POST', ...this.json({ name, journalId, doc }) })).json();
  }

  async save(id: string, body: SaveBody): Promise<SaveResult> {
    return (
      await this.request(`/api/v1/documents/${encodeURIComponent(id)}`, { method: 'PUT', ...this.json(body) })
    ).json();
  }

  async remove(id: string): Promise<void> {
    await this.request(`/api/v1/documents/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async uploadExport(id: string, blob: Blob, format: 'docx' | 'pdf' | 'xml', fileName: string): Promise<ExportItem> {
    const form = new FormData();
    form.append('format', format);
    form.append('fileName', fileName);
    form.append('file', blob, fileName);
    return (await this.request(`/api/v1/documents/${encodeURIComponent(id)}/exports`, { method: 'POST', body: form })).json();
  }

  async listExports(id: string): Promise<ExportItem[]> {
    return (await this.request(`/api/v1/documents/${encodeURIComponent(id)}/exports`)).json();
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
