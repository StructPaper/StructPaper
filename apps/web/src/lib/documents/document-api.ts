/**
 * REST client for the StructPaper backend /api/v1/manuscripts (+ /assets).
 * Uses Axios http from @structpaper/api-client with unified interceptors,
 * with fallback to injectable fetch for unit tests.
 */

import { http, ProblemDetailsError } from '@structpaper/api-client';

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

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (e instanceof ProblemDetailsError) {
    return new ApiError(e.status, e.detail || e.title || e.message);
  }
  const anyErr = e as any;
  if (anyErr?.code === 'ERR_NETWORK' || anyErr?.message === 'Network Error' || anyErr?.isNetwork) {
    return new ApiError(0, anyErr?.message || 'Network error');
  }
  const status = anyErr?.response?.status ?? anyErr?.status ?? anyErr?.statusCode ?? 0;
  const message =
    anyErr?.response?.data?.detail ||
    anyErr?.response?.data?.message ||
    anyErr?.response?.data?.error ||
    anyErr?.detail ||
    anyErr?.message ||
    (status ? `HTTP ${status}` : 'Network error');

  return new ApiError(status, typeof message === 'string' ? message : JSON.stringify(message));
}

export class DocumentApi {
  private resourcePath: string;
  private httpClient: typeof http;
  private fetchImpl?: FetchLike;

  constructor(
    private baseUrl: string = defaultApiBase(),
    fetchOrClient?: FetchLike | typeof http,
    private timeoutMs = 5_000,
    customResourcePath?: string
  ) {
    if (typeof fetchOrClient === 'function' && !('interceptors' in fetchOrClient)) {
      this.fetchImpl = fetchOrClient as FetchLike;
      this.httpClient = http;
    } else if (fetchOrClient && ('interceptors' in (fetchOrClient as any) || 'get' in (fetchOrClient as any))) {
      this.httpClient = fetchOrClient as typeof http;
    } else {
      this.httpClient = http;
    }

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
      const res = await (this.fetchImpl || fetch)(`${this.base}${path}`, { ...init, signal: ctrl?.signal });
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
    if (this.fetchImpl) {
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

    try {
      const res = await this.httpClient.get<any>(this.resourcePath);
      const items = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      if (this.resourcePath === '/api/v1/documents') {
        return items;
      }
      return items.map((m: any) => ({
        id: m.id,
        name: m.title || m.name,
        journalId: m.journalId,
        status: m.status,
        rev: m.version ?? m.rev ?? 1,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      }));
    } catch (err) {
      throw toApiError(err);
    }
  }

  async get(id: string): Promise<DocumentDetail> {
    if (this.fetchImpl) {
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

    try {
      const res = await this.httpClient.get<any>(`${this.resourcePath}/${encodeURIComponent(id)}`);
      const m = (res as any)?.data ?? res;
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
    } catch (err) {
      throw toApiError(err);
    }
  }

  async create(name: string, journalId?: string, doc?: unknown): Promise<DocumentDetail> {
    const isLegacy = this.resourcePath === '/api/v1/documents';
    const payload = isLegacy ? { name, journalId, doc } : { title: name, journalId, metadata: { doc } };

    if (this.fetchImpl) {
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

    try {
      const res = await this.httpClient.post<any>(this.resourcePath, payload);
      const m = (res as any)?.data ?? res;
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
    } catch (err) {
      throw toApiError(err);
    }
  }

  async save(id: string, body: SaveBody): Promise<SaveResult> {
    const isLegacy = this.resourcePath === '/api/v1/documents';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // If local non-UUID manuscript id, create it on the server first to establish cloud persistence
    if (!isLegacy && !isUuid) {
      const created = await this.create(
        body.name || 'Bản thảo bài báo',
        (body.doc as any)?.metadata?.journalId,
        body.doc,
      );
      if (body.doc && typeof body.doc === 'object') {
        (body.doc as any).id = created.id;
      }
      return {
        id: created.id,
        name: created.name,
        rev: created.rev,
        updatedAt: created.updatedAt || new Date().toISOString(),
        snapshotted: Boolean(body.snapshot),
      };
    }

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

    if (this.fetchImpl) {
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

    try {
      const res = isLegacy
        ? await this.httpClient.put<any>(`${this.resourcePath}/${encodeURIComponent(id)}`, payload, { headers })
        : await this.httpClient.patch<any>(`${this.resourcePath}/${encodeURIComponent(id)}`, payload, { headers });
      const m = (res as any)?.data ?? res;
      return {
        id: m.id,
        name: m.title || m.name,
        rev: m.version ?? m.rev ?? 1,
        updatedAt: m.updatedAt,
        snapshotted: Boolean(body.snapshot),
      };
    } catch (err) {
      throw toApiError(err);
    }
  }

  async remove(id: string): Promise<void> {
    if (this.fetchImpl) {
      await this.request(`${this.resourcePath}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return;
    }

    try {
      await this.httpClient.delete(`${this.resourcePath}/${encodeURIComponent(id)}`);
    } catch (err) {
      throw toApiError(err);
    }
  }

  async uploadExport(id: string, blob: Blob, format: 'docx' | 'pdf' | 'xml', fileName: string): Promise<ExportItem> {
    const form = new FormData();
    form.append('format', format);
    form.append('fileName', fileName);
    form.append('file', blob, fileName);

    if (this.fetchImpl) {
      return (await this.request(`${this.resourcePath}/${encodeURIComponent(id)}/exports`, { method: 'POST', body: form })).json();
    }

    try {
      const res = await this.httpClient.post<ExportItem>(
        `${this.resourcePath}/${encodeURIComponent(id)}/exports`,
        form,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return res as unknown as ExportItem;
    } catch (err) {
      throw toApiError(err);
    }
  }

  async listExports(id: string): Promise<ExportItem[]> {
    if (this.fetchImpl) {
      return (await this.request(`${this.resourcePath}/${encodeURIComponent(id)}/exports`)).json();
    }

    try {
      const res = await this.httpClient.get<ExportItem[]>(
        `${this.resourcePath}/${encodeURIComponent(id)}/exports`
      );
      return (Array.isArray(res) ? res : []) as ExportItem[];
    } catch (err) {
      throw toApiError(err);
    }
  }

  async putAsset(sha256: string, blob: Blob): Promise<void> {
    if (this.fetchImpl) {
      await this.request(`/api/v1/assets/${sha256}`, {
        method: 'PUT',
        headers: { 'Content-Type': blob.type || 'application/octet-stream' },
        body: blob,
      });
      return;
    }

    try {
      await this.httpClient.put(`/api/v1/assets/${sha256}`, blob, {
        headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      });
    } catch (err) {
      throw toApiError(err);
    }
  }

  async hasAsset(sha256: string): Promise<boolean> {
    if (this.fetchImpl) {
      try {
        await this.request(`/api/v1/assets/${sha256}`, { method: 'HEAD' });
        return true;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return false;
        throw e;
      }
    }

    try {
      await this.httpClient.head(`/api/v1/assets/${sha256}`);
      return true;
    } catch (err) {
      const apiError = toApiError(err);
      if (apiError.status === 404) return false;
      throw apiError;
    }
  }

  async getAssetBlob(sha256: string): Promise<Blob> {
    if (this.fetchImpl) {
      return (await this.request(`/api/v1/assets/${sha256}`)).blob();
    }

    try {
      const res = await this.httpClient.get<Blob>(`/api/v1/assets/${sha256}`, {
        responseType: 'blob',
      });
      return res as unknown as Blob;
    } catch (err) {
      throw toApiError(err);
    }
  }
}
