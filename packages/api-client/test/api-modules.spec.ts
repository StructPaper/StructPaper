import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import {
  http,
  authApi,
  manuscriptApi,
  assetApi,
  compileApi,
  setAccessToken,
} from '../src/index';

describe('Clean API Modules (@structpaper/api-client)', () => {
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
          statusText: mockStatus === 404 ? 'Not Found' : 'Error',
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

  describe('authApi', () => {
    it('login: sends POST /api/v1/auth/login with credentials and returns tokens', async () => {
      mockResponseData = {
        accessToken: 'access-123',
        refreshToken: 'refresh-456',
        expiresIn: 3600,
        tokenType: 'Bearer',
      };

      const payload = { email: 'author@journal.org', password: 'Password123!' };
      const res = await authApi.login(payload);

      expect(lastRequest?.method).toBe('post');
      expect(lastRequest?.url).toBe('/api/v1/auth/login');
      expect(JSON.parse(lastRequest?.data)).toEqual(payload);
      expect(res).toEqual(mockResponseData);
    });

    it('login: accepts username credentials', async () => {
      mockResponseData = { accessToken: 'access-jwt' };
      const payload = { username: 'testuser', password: 'Password123!' };

      const res = await authApi.login(payload);

      expect(lastRequest?.method).toBe('post');
      expect(lastRequest?.url).toBe('/api/v1/auth/login');
      expect(JSON.parse(lastRequest?.data)).toEqual(payload);
      expect(res).toEqual(mockResponseData);
    });

    it('logout: sends POST /api/v1/auth/logout', async () => {
      mockResponseData = { success: true };

      const res = await authApi.logout();

      expect(lastRequest?.method).toBe('post');
      expect(lastRequest?.url).toBe('/api/v1/auth/logout');
      expect(res).toEqual({ success: true });
    });

    it('getAccount: sends GET /api/v1/auth/account', async () => {
      mockResponseData = {
        id: 'user-001',
        email: 'author@journal.org',
        displayName: 'Dr. Author',
      };

      const res = await authApi.getAccount();

      expect(lastRequest?.method).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/auth/account');
      expect(res).toEqual(mockResponseData);
    });

    it('refreshToken: sends POST /api/v1/auth/refresh with token payload', async () => {
      mockResponseData = { accessToken: 'new-access-token' };

      const res = await authApi.refreshToken('refresh-token-xyz');

      expect(lastRequest?.method).toBe('post');
      expect(lastRequest?.url).toBe('/api/v1/auth/refresh');
      expect(JSON.parse(lastRequest?.data)).toEqual({ refreshToken: 'refresh-token-xyz' });
      expect(res).toEqual(mockResponseData);
    });

    it('refreshToken: sends POST /api/v1/auth/refresh when called without argument', async () => {
      mockResponseData = { accessToken: 'new-token' };

      const res = await authApi.refreshToken();

      expect(lastRequest?.method).toBe('post');
      expect(lastRequest?.url).toBe('/api/v1/auth/refresh');
      expect(res).toEqual(mockResponseData);
    });
  });

  describe('manuscriptApi', () => {
    it('list: sends GET /api/v1/manuscripts with query parameters', async () => {
      mockResponseData = {
        data: [{ id: 'ms-1', title: 'Paper 1' }],
        total: 1,
      };

      const params = { page: 2, limit: 15, search: 'quantum', status: 'DRAFT' };
      const res = await manuscriptApi.list(params);

      expect(lastRequest?.method).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts');
      expect(lastRequest?.params).toEqual(params);
      expect(res).toEqual(mockResponseData);
    });

    it('list: sends GET /api/v1/manuscripts without parameters', async () => {
      mockResponseData = [];

      await manuscriptApi.list();

      expect(lastRequest?.method).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts');
      expect(lastRequest?.params).toBeUndefined();
    });

    it('get: sends GET /api/v1/manuscripts/:id', async () => {
      mockResponseData = { id: 'ms-42', title: 'Deep Learning Review' };

      const res = await manuscriptApi.get('ms-42');

      expect(lastRequest?.method).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-42');
      expect(res).toEqual(mockResponseData);
    });

    it('create: sends POST /api/v1/manuscripts with payload', async () => {
      const payload = {
        title: 'New Manuscript',
        journalId: 'journal-uuid-1',
        metadata: { keywords: ['physics'] },
      };
      mockResponseData = { id: 'ms-new', ...payload };

      const res = await manuscriptApi.create(payload);

      expect(lastRequest?.method).toBe('post');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts');
      expect(JSON.parse(lastRequest?.data)).toEqual(payload);
      expect(res).toEqual(mockResponseData);
    });

    it('update: sends PATCH /api/v1/manuscripts/:id with payload', async () => {
      const updateData = { title: 'Updated Title', abstract: 'New abstract' };
      mockResponseData = { id: 'ms-42', ...updateData, version: 2 };

      const res = await manuscriptApi.update('ms-42', updateData);

      expect(lastRequest?.method).toBe('patch');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-42');
      expect(JSON.parse(lastRequest?.data)).toEqual(updateData);
      expect(res).toEqual(mockResponseData);
    });

    it('update: forwards custom headers including If-Match for optimistic concurrency', async () => {
      const updateData = { title: 'Concurrent Edit' };
      mockResponseData = { id: 'ms-42', version: 3 };

      await manuscriptApi.update('ms-42', updateData, { 'If-Match': '"2"' });

      expect(lastRequest?.method).toBe('patch');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-42');
      expect(lastRequest?.headers['If-Match']).toBe('"2"');
    });

    it('delete: sends DELETE /api/v1/manuscripts/:id', async () => {
      mockResponseData = { success: true };

      const res = await manuscriptApi.delete('ms-42');

      expect(lastRequest?.method).toBe('delete');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-42');
      expect(res).toEqual({ success: true });
    });

    it('getMembers: sends GET /api/v1/manuscripts/:id/members', async () => {
      mockResponseData = [{ userId: 'user-1', role: 'OWNER' }];

      const res = await manuscriptApi.getMembers('ms-42');

      expect(lastRequest?.method).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-42/members');
      expect(res).toEqual(mockResponseData);
    });

    it('addMember: sends POST /api/v1/manuscripts/:id/members with payload', async () => {
      const memberData = { userId: 'user-2', role: 'COAUTHOR' };
      mockResponseData = { manuscriptId: 'ms-42', ...memberData };

      const res = await manuscriptApi.addMember('ms-42', memberData);

      expect(lastRequest?.method).toBe('post');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-42/members');
      expect(JSON.parse(lastRequest?.data)).toEqual(memberData);
      expect(res).toEqual(mockResponseData);
    });

    it('removeMember: sends DELETE /api/v1/manuscripts/:id/members/:userId', async () => {
      mockResponseData = { success: true };

      const res = await manuscriptApi.removeMember('ms-42', 'user-2');

      expect(lastRequest?.method).toBe('delete');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-42/members/user-2');
      expect(res).toEqual({ success: true });
    });

    it('getVersions: sends GET /api/v1/manuscripts/:id/versions', async () => {
      mockResponseData = [{ version: 1, createdAt: '2026-01-01' }];

      const res = await manuscriptApi.getVersions('ms-42');

      expect(lastRequest?.method).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/manuscripts/ms-42/versions');
      expect(res).toEqual(mockResponseData);
    });
  });

  describe('assetApi', () => {
    it('putAsset: sends PUT /api/v1/assets/:sha256 with binary data and default octet-stream header', async () => {
      const dummyBuffer = new Uint8Array([1, 2, 3, 4]);
      mockResponseData = { success: true };

      const res = await assetApi.putAsset('sha256-abcdef', dummyBuffer);

      expect(lastRequest?.method).toBe('put');
      expect(lastRequest?.url).toBe('/api/v1/assets/sha256-abcdef');
      expect(new Uint8Array(lastRequest?.data)).toEqual(dummyBuffer);
      expect(lastRequest?.headers['Content-Type']).toBe('application/octet-stream');
      expect(res).toEqual({ success: true });
    });

    it('putAsset: accepts custom Content-Type header', async () => {
      const dummyBuffer = new Uint8Array([137, 80, 78, 71]);
      mockResponseData = { success: true };

      await assetApi.putAsset('sha256-png-hash', dummyBuffer, 'image/png');

      expect(lastRequest?.method).toBe('put');
      expect(lastRequest?.headers['Content-Type']).toBe('image/png');
    });

    it('getAssetBlob: sends GET /api/v1/assets/:sha256 with responseType blob', async () => {
      const mockBlob = new Blob(['binary contents']);
      mockResponseData = mockBlob;

      const res = await assetApi.getAssetBlob('sha256-blob-hash');

      expect(lastRequest?.method).toBe('get');
      expect(lastRequest?.url).toBe('/api/v1/assets/sha256-blob-hash');
      expect(lastRequest?.responseType).toBe('blob');
      expect(res).toBe(mockBlob);
    });

    it('hasAsset: returns true when HEAD /api/v1/assets/:sha256 succeeds (200 OK)', async () => {
      mockStatus = 200;
      mockResponseData = null;

      const exists = await assetApi.hasAsset('sha256-existing');

      expect(lastRequest?.method).toBe('head');
      expect(lastRequest?.url).toBe('/api/v1/assets/sha256-existing');
      expect(exists).toBe(true);
    });

    it('hasAsset: returns false when HEAD /api/v1/assets/:sha256 returns 404', async () => {
      mockStatus = 404;
      mockResponseData = undefined;

      const exists = await assetApi.hasAsset('sha256-nonexistent');

      expect(lastRequest?.method).toBe('head');
      expect(lastRequest?.url).toBe('/api/v1/assets/sha256-nonexistent');
      expect(exists).toBe(false);
    });

    it('hasAsset: returns false when 404 returns RFC 9457 Problem Details', async () => {
      mockStatus = 404;
      mockHeaders = { 'content-type': 'application/problem+json' };
      mockResponseData = {
        type: 'https://example.com/errors/not-found',
        title: 'Asset Not Found',
        status: 404,
        detail: 'The requested asset sha256 was not found.',
      };

      const exists = await assetApi.hasAsset('sha256-problem-404');
      expect(exists).toBe(false);
    });

    it('hasAsset: rethrows non-404 errors (e.g. 500 Internal Server Error)', async () => {
      mockStatus = 500;
      mockResponseData = { error: 'Internal Server Error' };

      await expect(assetApi.hasAsset('sha256-server-error')).rejects.toThrow();
    });

    it('createUploadIntent & completeUpload & getAsset helpers work correctly', async () => {
      mockResponseData = { uploadUrl: 'https://s3.example.com/upload', storageKey: 'k1', expiresIn: 900 };
      const intentRes = await assetApi.createUploadIntent({
        filename: 'figure1.png',
        mimeType: 'image/png',
        fileSize: 1024,
      });
      expect(lastRequest?.url).toBe('/api/v1/assets/upload-intent');
      expect(intentRes).toEqual(mockResponseData);

      mockResponseData = { id: 'asset-1', checksum: 'sha-1' };
      const completeRes = await assetApi.completeUpload({
        storageKey: 'k1',
        checksum: 'sha-1',
      });
      expect(lastRequest?.url).toBe('/api/v1/assets/upload-complete');
      expect(completeRes).toEqual(mockResponseData);

      const getRes = await assetApi.getAsset('asset-1');
      expect(lastRequest?.url).toBe('/api/v1/assets/asset-1');
      expect(getRes).toEqual(mockResponseData);
    });
  });

  describe('compileApi', () => {
    it('compileLatex: sends POST /api/v1/compile/latex with blob responseType', async () => {
      const mockPdfBlob = new Blob(['%PDF-1.4 mock pdf data'], { type: 'application/pdf' });
      mockResponseData = mockPdfBlob;

      const payload = {
        tex: '\\documentclass{article}\\begin{document}Hello World\\end{document}',
        engine: 'XELATEX',
        jobName: 'main',
        images: {
          'figure1.png': 'sha256-fig1-hash',
        },
      };

      const res = await compileApi.compileLatex(payload);

      expect(lastRequest?.method).toBe('post');
      expect(lastRequest?.url).toBe('/api/v1/compile/latex');
      expect(lastRequest?.responseType).toBe('blob');
      expect(JSON.parse(lastRequest?.data)).toEqual(payload);
      expect(res).toBe(mockPdfBlob);
    });
  });
});
