import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  http,
  setAccessToken,
  ProblemDetailsError,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from '@structpaper/api-client';
import { DocumentApi, ApiError } from '@/lib/documents/document-api';

describe('DocumentApi with Axios http (@structpaper/api-client)', () => {
  const originalAdapter = http.defaults.adapter;
  let lastRequest: InternalAxiosRequestConfig | null = null;
  let mockResponseData: any = {};
  let mockStatus = 200;
  let mockHeaders: Record<string, string> = {};

  beforeEach(() => {
    lastRequest = null;
    mockResponseData = {};
    mockStatus = 200;
    mockHeaders = {};
    setAccessToken(null);

    http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      lastRequest = config;
      if (mockStatus >= 400) {
        const error: any = new Error(`Request failed with status code ${mockStatus}`);
        error.isAxiosError = true;
        error.config = config;
        error.response = {
          data: mockResponseData,
          status: mockStatus,
          statusText: mockStatus === 404 ? 'Not Found' : mockStatus === 409 ? 'Conflict' : 'Error',
          headers: mockHeaders,
          config,
        };
        throw error;
      }

      return {
        data: mockResponseData,
        status: mockStatus,
        statusText: 'OK',
        headers: mockHeaders,
        config,
      } as AxiosResponse;
    };
  });

  afterEach(() => {
    http.defaults.adapter = originalAdapter;
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  describe('Axios Client Configuration & Authentication', () => {
    it('uses baseURL /api/proxy from http', () => {
      expect(http.defaults.baseURL).toBe('/api/proxy');
    });

    it('automatically injects Bearer token from api-client session into requests', async () => {
      setAccessToken('test-jwt-token-xyz');
      mockResponseData = [];

      const api = new DocumentApi();
      await api.list();

      expect(lastRequest).not.toBeNull();
      expect(lastRequest?.headers?.Authorization).toBe('Bearer test-jwt-token-xyz');
    });

    it('does not include Authorization header when access token is unset', async () => {
      setAccessToken(null);
      mockResponseData = [];

      const api = new DocumentApi();
      await api.list();

      expect(lastRequest).not.toBeNull();
      expect(lastRequest?.headers?.Authorization).toBeUndefined();
    });
  });

  describe('Manuscript CRUD Methods', () => {
    it('list: calls GET /api/v1/manuscripts and normalizes summaries', async () => {
      mockResponseData = [
        {
          id: 'ms-1',
          title: 'Quantum Teleportation Paper',
          journalId: 'journal-123',
          status: 'DRAFT',
          version: 2,
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-02T00:00:00Z',
        },
      ];

      const api = new DocumentApi();
      const list = await api.list();

      expect(lastRequest?.method?.toLowerCase()).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts');
      expect(list).toEqual([
        {
          id: 'ms-1',
          name: 'Quantum Teleportation Paper',
          journalId: 'journal-123',
          status: 'DRAFT',
          rev: 2,
          createdAt: '2026-11-01T00:00:00Z',
          updatedAt: '2026-11-02T00:00:00Z',
        },
      ]);
    });

    it('list: handles wrapped { data: [...] } responses gracefully', async () => {
      mockResponseData = {
        data: [
          {
            id: 'ms-2',
            name: 'Legacy Field Paper',
            journalId: null,
            status: 'READY',
            rev: 1,
          },
        ],
        total: 1,
      };

      const api = new DocumentApi();
      const list = await api.list();

      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('ms-2');
      expect(list[0].name).toBe('Legacy Field Paper');
      expect(list[0].rev).toBe(1);
    });

    it('get: calls GET /api/v1/manuscripts/:id and extracts doc from metadata', async () => {
      mockResponseData = {
        id: 'ms-1',
        title: 'Quantum Teleportation Paper',
        journalId: 'journal-123',
        status: 'IN_REVIEW',
        version: 3,
        createdAt: '2026-11-01T00:00:00Z',
        updatedAt: '2026-11-03T00:00:00Z',
        metadata: {
          doc: { sections: [{ id: 's1', text: 'Hello Quantum' }] },
        },
      };

      const api = new DocumentApi();
      const doc = await api.get('ms-1');

      expect(lastRequest?.method?.toLowerCase()).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-1');
      expect(doc.id).toBe('ms-1');
      expect(doc.name).toBe('Quantum Teleportation Paper');
      expect(doc.rev).toBe(3);
      expect(doc.doc).toEqual({ sections: [{ id: 's1', text: 'Hello Quantum' }] });
    });

    it('create: calls POST /api/v1/manuscripts with title, journalId, and metadata.doc', async () => {
      mockResponseData = {
        id: 'ms-new',
        title: 'New Manuscript',
        journalId: 'j-456',
        status: 'DRAFT',
        version: 1,
        createdAt: '2026-11-14T00:00:00Z',
        updatedAt: '2026-11-14T00:00:00Z',
        metadata: {
          doc: { title: 'New Manuscript' },
        },
      };

      const api = new DocumentApi();
      const created = await api.create('New Manuscript', 'j-456', { title: 'New Manuscript' });

      expect(lastRequest?.method?.toLowerCase()).toBe('post');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts');
      const sentPayload = typeof lastRequest?.data === 'string' ? JSON.parse(lastRequest.data) : lastRequest?.data;
      expect(sentPayload).toEqual({
        title: 'New Manuscript',
        journalId: 'j-456',
        metadata: { doc: { title: 'New Manuscript' } },
      });
      expect(created.id).toBe('ms-new');
      expect(created.name).toBe('New Manuscript');
      expect(created.rev).toBe(1);
    });

    it('save: calls PATCH /api/v1/manuscripts/:id with If-Match header when baseRev is provided', async () => {
      mockResponseData = {
        id: 'ms-1',
        title: 'Updated Manuscript',
        status: 'DRAFT',
        version: 4,
        updatedAt: '2026-11-14T01:00:00Z',
      };

      const api = new DocumentApi();
      const saveRes = await api.save('ms-1', {
        name: 'Updated Manuscript',
        status: 'DRAFT',
        doc: { sections: [] },
        baseRev: 3,
        snapshot: true,
      });

      expect(lastRequest?.method?.toLowerCase()).toBe('patch');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-1');
      expect(lastRequest?.headers?.['If-Match']).toBe('"3"');
      const sentPayload = typeof lastRequest?.data === 'string' ? JSON.parse(lastRequest.data) : lastRequest?.data;
      expect(sentPayload).toEqual({
        title: 'Updated Manuscript',
        status: 'DRAFT',
        metadata: { doc: { sections: [] } },
      });
      expect(saveRes).toEqual({
        id: 'ms-1',
        name: 'Updated Manuscript',
        rev: 4,
        updatedAt: '2026-11-14T01:00:00Z',
        snapshotted: true,
      });
    });

    it('save: omits If-Match header when baseRev is not provided', async () => {
      mockResponseData = {
        id: 'ms-1',
        title: 'Force Save',
        version: 5,
        updatedAt: '2026-11-14T02:00:00Z',
      };

      const api = new DocumentApi();
      await api.save('ms-1', { name: 'Force Save' });

      expect(lastRequest?.headers?.['If-Match']).toBeUndefined();
    });

    it('remove: calls DELETE /api/v1/manuscripts/:id', async () => {
      mockResponseData = { success: true };

      const api = new DocumentApi();
      await api.remove('ms-delete-123');

      expect(lastRequest?.method?.toLowerCase()).toBe('delete');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-delete-123');
    });
  });

  describe('Export Upload & Listing', () => {
    it('uploadExport: sends FormData to POST /api/v1/manuscripts/:id/exports', async () => {
      mockResponseData = {
        id: 'exp-1',
        format: 'pdf',
        fileName: 'paper.pdf',
        sizeBytes: 1024,
        createdAt: '2026-11-14T03:00:00Z',
      };

      const api = new DocumentApi();
      const blob = new Blob(['pdf-bytes'], { type: 'application/pdf' });
      const exp = await api.uploadExport('ms-1', blob, 'pdf', 'paper.pdf');

      expect(lastRequest?.method?.toLowerCase()).toBe('post');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-1/exports');
      expect(lastRequest?.data).toBeInstanceOf(FormData);
      expect(exp).toEqual({
        id: 'exp-1',
        format: 'pdf',
        fileName: 'paper.pdf',
        sizeBytes: 1024,
        createdAt: '2026-11-14T03:00:00Z',
      });
    });

    it('listExports: calls GET /api/v1/manuscripts/:id/exports', async () => {
      mockResponseData = [
        {
          id: 'exp-1',
          format: 'pdf',
          fileName: 'paper.pdf',
          sizeBytes: 1024,
          createdAt: '2026-11-14T03:00:00Z',
        },
      ];

      const api = new DocumentApi();
      const list = await api.listExports('ms-1');

      expect(lastRequest?.method?.toLowerCase()).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-1/exports');
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('exp-1');
    });
  });

  describe('Asset Management Methods', () => {
    it('putAsset: calls PUT /api/v1/assets/:sha256 with binary blob and correct Content-Type', async () => {
      mockResponseData = { success: true };

      const api = new DocumentApi();
      const blob = new Blob(['asset-data'], { type: 'image/png' });
      await api.putAsset('sha256-abcdef', blob);

      expect(lastRequest?.method?.toLowerCase()).toBe('put');
      expect(lastRequest?.url).toBe('/api/v1/assets/sha256-abcdef');
      expect(lastRequest?.headers?.['Content-Type']).toBe('image/png');
    });

    it('hasAsset: calls HEAD /api/v1/assets/:sha256 and returns true on 200 OK', async () => {
      mockStatus = 200;
      mockResponseData = null;

      const api = new DocumentApi();
      const exists = await api.hasAsset('sha256-exists');

      expect(lastRequest?.method?.toLowerCase()).toBe('head');
      expect(lastRequest?.url).toBe('/api/v1/assets/sha256-exists');
      expect(exists).toBe(true);
    });

    it('hasAsset: returns false when server responds with 404 Not Found', async () => {
      mockStatus = 404;
      mockResponseData = { detail: 'Asset not found', status: 404 };

      const api = new DocumentApi();
      const exists = await api.hasAsset('sha256-missing');

      expect(exists).toBe(false);
    });

    it('hasAsset: throws ApiError on 500 server error', async () => {
      mockStatus = 500;
      mockResponseData = { detail: 'Internal server error', status: 500 };

      const api = new DocumentApi();
      await expect(api.hasAsset('sha256-err')).rejects.toThrow(ApiError);
    });

    it('getAssetBlob: calls GET /api/v1/assets/:sha256 with responseType blob', async () => {
      const returnedBlob = new Blob(['sample-blob-data'], { type: 'image/png' });
      mockResponseData = returnedBlob;

      const api = new DocumentApi();
      const blob = await api.getAssetBlob('sha256-download');

      expect(lastRequest?.method?.toLowerCase()).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/assets/sha256-download');
      expect(lastRequest?.responseType).toBe('blob');
      expect(blob).toBe(returnedBlob);
    });
  });

  describe('Error Normalization & ApiError Wrapping', () => {
    it('wraps 409 conflict into ApiError with isConflict === true', async () => {
      mockStatus = 409;
      mockResponseData = {
        type: 'https://httpstatuses.com/409',
        title: 'Conflict',
        status: 409,
        detail: 'Document revision conflict',
      };

      const api = new DocumentApi();
      await expect(api.save('ms-1', { name: 'Conflict test' })).rejects.toSatisfy(
        (err: unknown) => {
          const apiErr = err as ApiError;
          return (
            apiErr instanceof ApiError &&
            apiErr.status === 409 &&
            apiErr.isConflict &&
            apiErr.message.includes('Document revision conflict')
          );
        }
      );
    });

    it('wraps 412 precondition failed into ApiError with isConflict === true', async () => {
      mockStatus = 412;
      mockResponseData = {
        type: 'https://httpstatuses.com/412',
        title: 'Precondition Failed',
        status: 412,
        detail: 'If-Match header precondition failed',
      };

      const api = new DocumentApi();
      await expect(api.save('ms-1', { name: 'Precondition test', baseRev: 1 })).rejects.toSatisfy(
        (err: unknown) => {
          const apiErr = err as ApiError;
          return apiErr instanceof ApiError && apiErr.status === 412 && apiErr.isConflict;
        }
      );
    });

    it('wraps network errors (code ERR_NETWORK) into ApiError with status 0 and isNetwork === true', async () => {
      http.defaults.adapter = async (config) => {
        const error: any = new Error('Network Error');
        error.code = 'ERR_NETWORK';
        error.isAxiosError = true;
        error.config = config;
        throw error;
      };

      const api = new DocumentApi();
      await expect(api.list()).rejects.toSatisfy((err: unknown) => {
        const apiErr = err as ApiError;
        return apiErr instanceof ApiError && apiErr.status === 0 && apiErr.isNetwork;
      });
    });
  });
});
