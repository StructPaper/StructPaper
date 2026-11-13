import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  http,
  customInstance,
  setAccessToken,
  getAccessToken,
  ProblemDetailsError,
  isMockModeEnabled,
  setMockMode,
  listManuscripts,
  login,
  getRoles,
  getHealth,
  createUploadIntent,
  useListManuscripts,
  useLogin,
  useGetRoles,
  useGetHealth,
} from '../src/index';

describe('HTTP Client & Interceptors', () => {
  const originalAdapter = http.defaults.adapter;

  beforeEach(() => {
    setAccessToken(null);
    setMockMode(false);
  });

  afterEach(() => {
    http.defaults.adapter = originalAdapter;
    setAccessToken(null);
    setMockMode(false);
    vi.restoreAllMocks();
  });

  describe('Authorization Header & Token Management', () => {
    it('stores and retrieves access token in memory', () => {
      expect(getAccessToken()).toBeNull();
      setAccessToken('token-123');
      expect(getAccessToken()).toBe('token-123');
    });

    it('attaches Authorization header when access token is set', async () => {
      setAccessToken('auth-jwt-xyz');

      let capturedHeaders: any = null;
      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        capturedHeaders = config.headers;
        return {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      const res: any = await http.get('/test-auth');
      expect(capturedHeaders.Authorization).toBe('Bearer auth-jwt-xyz');
      expect(res).toEqual({ success: true });
    });
  });

  describe('Response Unwrapping', () => {
    it('unwraps response.data directly', async () => {
      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        return {
          data: { id: 'item-1', name: 'StructPaper Manuscript' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      const data: any = await http.get('/manuscript');
      expect(data).toEqual({ id: 'item-1', name: 'StructPaper Manuscript' });
      expect(data.data).toBeUndefined();
    });
  });

  describe('RFC 9457 Error Normalization', () => {
    it('transforms RFC 9457 problem details response into ProblemDetailsError instance', async () => {
      const problemData = {
        type: 'https://tools.ietf.org/html/rfc9457',
        title: 'Validation Error',
        status: 400,
        detail: 'Request body failed validation rules',
        instance: '/api/v1/manuscripts',
        code: 'VALIDATION_FAILED',
        invalidParams: [
          { name: 'title', reason: 'Title cannot be empty' },
        ],
      };

      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const error = new AxiosError(
          'Request failed with status code 400',
          'ERR_BAD_REQUEST',
          config,
          null,
          {
            status: 400,
            statusText: 'Bad Request',
            headers: { 'content-type': 'application/problem+json' },
            data: problemData,
            config,
          } as AxiosResponse,
        );
        throw error;
      };

      try {
        await http.post('/api/v1/manuscripts', { title: '' });
        expect.unreachable('Should have thrown ProblemDetailsError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ProblemDetailsError);
        expect(err.name).toBe('ProblemDetailsError');
        expect(err.status).toBe(400);
        expect(err.title).toBe('Validation Error');
        expect(err.detail).toBe('Request body failed validation rules');
        expect(err.code).toBe('VALIDATION_FAILED');
        expect(err.invalidParams).toHaveLength(1);
        expect(err.invalidParams[0].name).toBe('title');
        expect(err.invalidParams[0].reason).toBe('Title cannot be empty');
      }
    });

    it('preserves ProblemDetailsError extension properties', () => {
      const error = new ProblemDetailsError({
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'Version mismatch',
        serverRev: 5,
        requiredRev: 4,
      });

      expect(error.status).toBe(409);
      expect(error.detail).toBe('Version mismatch');
      expect(error.extensions?.serverRev).toBe(5);
      expect(error.extensions?.requiredRev).toBe(4);
    });
  });

  describe('Token Refresh Queue & 401 Replay', () => {
    it('queues concurrent requests on 401, refreshes token once, and replays all with new access token', async () => {
      setAccessToken('expired-access-token');

      let refreshCalls = 0;
      let request1Attempt = 0;
      let request2Attempt = 0;

      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const url = config.url || '';

        // Intercept refresh request
        if (url.includes('/api/v1/auth/refresh')) {
          refreshCalls++;
          return {
            data: { accessToken: 'new-fresh-token', expiresIn: 3600 },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse;
        }

        // Endpoint 1
        if (url === '/api/v1/manuscripts/m-1') {
          request1Attempt++;
          if (request1Attempt === 1) {
            throw new AxiosError(
              'Unauthorized',
              'ERR_BAD_REQUEST',
              config,
              null,
              { status: 401, statusText: 'Unauthorized', headers: {}, data: { title: 'Unauthorized' }, config } as AxiosResponse,
            );
          }
          return {
            data: { id: 'm-1', authHeader: config.headers?.Authorization },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse;
        }

        // Endpoint 2
        if (url === '/api/v1/manuscripts/m-2') {
          request2Attempt++;
          if (request2Attempt === 1) {
            throw new AxiosError(
              'Unauthorized',
              'ERR_BAD_REQUEST',
              config,
              null,
              { status: 401, statusText: 'Unauthorized', headers: {}, data: { title: 'Unauthorized' }, config } as AxiosResponse,
            );
          }
          return {
            data: { id: 'm-2', authHeader: config.headers?.Authorization },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse;
        }

        return {
          data: { ok: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      // Fire concurrent requests that will both receive 401
      const [res1, res2]: any = await Promise.all([
        http.get('/api/v1/manuscripts/m-1'),
        http.get('/api/v1/manuscripts/m-2'),
      ]);

      // Exactly 1 refresh call should have been triggered
      expect(refreshCalls).toBe(1);

      // Access token updated in memory
      expect(getAccessToken()).toBe('new-fresh-token');

      // Both requests replayed and succeeded with new bearer token
      expect(res1.id).toBe('m-1');
      expect(res1.authHeader).toBe('Bearer new-fresh-token');

      expect(res2.id).toBe('m-2');
      expect(res2.authHeader).toBe('Bearer new-fresh-token');
    });

    it('rejects queued requests and clears state if refresh request fails', async () => {
      setAccessToken('expired-token');

      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const url = config.url || '';
        if (url.includes('/api/v1/auth/refresh')) {
          throw new AxiosError(
            'Refresh token expired',
            'ERR_BAD_REQUEST',
            config,
            null,
            { status: 401, statusText: 'Unauthorized', headers: {}, data: { title: 'Refresh token invalid' }, config } as AxiosResponse,
          );
        }

        throw new AxiosError(
          'Unauthorized',
          'ERR_BAD_REQUEST',
          config,
          null,
          { status: 401, statusText: 'Unauthorized', headers: {}, data: { title: 'Unauthorized' }, config } as AxiosResponse,
        );
      };

      await expect(http.get('/api/v1/manuscripts/m-1')).rejects.toThrow();
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('Mock Mode & Adapter Routing', () => {
    it('returns mock data when mock mode is enabled', async () => {
      setMockMode(true);
      const mockResult: any = await http.get('/health');
      expect(mockResult).toBeDefined();
      expect(mockResult.status).toBe('ok');
    });

    it('returns mock data when header x-mock-mode is true', async () => {
      const mockResult: any = await http.get('/api/v1/health', {
        headers: { 'x-mock-mode': 'true' },
      });
      expect(mockResult).toBeDefined();
      expect(mockResult.status).toBe('ok');
    });
  });

  describe('Automated Generated Client Functions', () => {
    it('exports typed React Query hooks and callers', () => {
      expect(typeof listManuscripts).toBe('function');
      expect(typeof useListManuscripts).toBe('function');
      expect(typeof login).toBe('function');
      expect(typeof useLogin).toBe('function');
      expect(typeof getRoles).toBe('function');
      expect(typeof useGetRoles).toBe('function');
      expect(typeof getHealth).toBe('function');
      expect(typeof useGetHealth).toBe('function');
      expect(typeof createUploadIntent).toBe('function');
    });

    it('invokes generated functions through mock adapter when mock mode is enabled', async () => {
      setMockMode(true);

      const manuscripts = await listManuscripts();
      expect(Array.isArray(manuscripts)).toBe(true);
      expect(manuscripts[0].title).toBe('Mock Research Manuscript');

      const loginRes = await login({ email: 'test@structpaper.org', password: 'password123' });
      expect(loginRes.accessToken).toBeDefined();
      expect(loginRes.user?.email).toBe('test@structpaper.org');

      const health = await getHealth();
      expect(health.status).toBe('ok');
      expect(health.database.status).toBe('ok');
    });
  });
});
