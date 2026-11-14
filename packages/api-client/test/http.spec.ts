import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  http,
  customInstance,
  setAccessToken,
  getAccessToken,
  setRefreshTokenGetter,
  setOnTokenRefreshed,
  ProblemDetailsError,
  isMockModeEnabled,
  setMockMode,
  handleMockRequest,
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
    setRefreshTokenGetter(null);
    setOnTokenRefreshed(null);
    setMockMode(false);
  });

  afterEach(() => {
    http.defaults.adapter = originalAdapter;
    setAccessToken(null);
    setRefreshTokenGetter(null);
    setOnTokenRefreshed(null);
    setMockMode(false);
    vi.restoreAllMocks();
  });

  describe('baseURL Configuration', () => {
    it('configures baseURL to /api/proxy', () => {
      expect(http.defaults.baseURL).toBe('/api/proxy');
    });

    it('enables withCredentials for cookie transmission', () => {
      expect(http.defaults.withCredentials).toBe(true);
    });
  });

  describe('Authorization Header & Token Management', () => {
    it('stores and retrieves access token in memory', () => {
      expect(getAccessToken()).toBeNull();
      setAccessToken('token-123');
      expect(getAccessToken()).toBe('token-123');
      setAccessToken(null);
      expect(getAccessToken()).toBeNull();
    });

    it('attaches Authorization: Bearer header when access token is set', async () => {
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

    it('omits Authorization header when access token is null', async () => {
      setAccessToken(null);

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

      await http.get('/test-public');
      expect(capturedHeaders.Authorization).toBeUndefined();
    });
  });

  describe('Response Unwrapping', () => {
    it('unwraps response.data directly', async () => {
      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        return {
          data: { id: 'item-1', name: 'Test Resource' },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      const data: any = await http.get('/resource');
      expect(data).toEqual({ id: 'item-1', name: 'Test Resource' });
      expect(data.data).toBeUndefined();
    });

    it('returns raw response if response.data is undefined', async () => {
      const mockResponse = {
        data: undefined,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      } as AxiosResponse;

      http.defaults.adapter = async () => mockResponse;

      const result: any = await http.delete('/resource/1');
      expect(result).toBe(mockResponse);
    });
  });

  describe('RFC 9457 Error Normalization & General Errors', () => {
    it('transforms RFC 9457 problem details response into ProblemDetailsError instance', async () => {
      const problemData = {
        type: 'https://tools.ietf.org/html/rfc9457',
        title: 'Validation Error',
        status: 400,
        detail: 'Request body failed validation rules',
        instance: '/api/v1/manuscripts',
        code: 'VALIDATION_FAILED',
        invalidParams: [{ name: 'title', reason: 'Title cannot be empty' }],
      };

      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError(
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

    it('rejects with error.response.data when not a ProblemDetails structure', async () => {
      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError(
          'Custom server error',
          'ERR_BAD_RESPONSE',
          config,
          null,
          {
            status: 500,
            statusText: 'Internal Server Error',
            headers: {},
            data: { error: 'Database connection failed', statusCode: 500 },
            config,
          } as AxiosResponse,
        );
      };

      await expect(http.get('/error-test')).rejects.toEqual({
        error: 'Database connection failed',
        statusCode: 500,
      });
    });
  });

  describe('Token Refresh Queue & 401 Replay', () => {
    it('queues concurrent requests on 401, refreshes token once via /api/v1/auth/refresh, and replays all with new access token', async () => {
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
            data: { access_token: 'new-fresh-token', expiresIn: 3600 },
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
              { status: 401, statusText: 'Unauthorized', headers: {}, data: { message: 'Unauthorized' }, config } as AxiosResponse,
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
              { status: 401, statusText: 'Unauthorized', headers: {}, data: { message: 'Unauthorized' }, config } as AxiosResponse,
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

    it('supports camelCase accessToken from refresh endpoint and notifies onTokenRefreshed callback', async () => {
      setAccessToken('old-token');

      let refreshedCallbackToken = '';
      setOnTokenRefreshed((tok) => {
        refreshedCallbackToken = tok;
      });

      let attempt = 0;
      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const url = config.url || '';
        if (url.includes('/api/v1/auth/refresh')) {
          return {
            data: { accessToken: 'camelCase-new-token' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse;
        }

        attempt++;
        if (attempt === 1) {
          throw new AxiosError(
            'Unauthorized',
            'ERR_BAD_REQUEST',
            config,
            null,
            { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config } as AxiosResponse,
          );
        }

        return {
          data: { done: true, auth: config.headers?.Authorization },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      const result: any = await http.get('/api/v1/user/profile');
      expect(result.done).toBe(true);
      expect(result.auth).toBe('Bearer camelCase-new-token');
      expect(getAccessToken()).toBe('camelCase-new-token');
      expect(refreshedCallbackToken).toBe('camelCase-new-token');
    });

    it('uses refreshTokenGetter when set and posts to /api/v1/auth/refresh', async () => {
      setAccessToken('expired-token');
      setRefreshTokenGetter(() => 'stored-refresh-token');

      let refreshPayload: any = null;
      let attempt = 0;

      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const url = config.url || '';
        if (url.includes('/api/v1/auth/refresh')) {
          refreshPayload = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
          return {
            data: { access_token: 'refreshed-via-post' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse;
        }

        attempt++;
        if (attempt === 1) {
          throw new AxiosError(
            'Unauthorized',
            'ERR_BAD_REQUEST',
            config,
            null,
            { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config } as AxiosResponse,
          );
        }

        return {
          data: { success: true },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      await http.get('/api/v1/dashboard');
      expect(refreshPayload).toEqual({ refreshToken: 'stored-refresh-token' });
      expect(getAccessToken()).toBe('refreshed-via-post');
    });

    it('prevents refresh loop when /auth/refresh itself returns 401', async () => {
      setAccessToken('invalid-token');

      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        throw new AxiosError(
          'Unauthorized refresh',
          'ERR_BAD_REQUEST',
          config,
          null,
          { status: 401, statusText: 'Unauthorized', headers: {}, data: { message: 'Invalid refresh token' }, config } as AxiosResponse,
        );
      };

      await expect(http.get('/api/v1/auth/refresh')).rejects.toThrow();
      expect(getAccessToken()).toBeNull();
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

    it('clears token and redirects to /login on refresh failure in browser environment', async () => {
      setAccessToken('expired-token');

      const mockLocalStorage: Record<string, string> = {};
      const fakeWindow = {
        location: {
          pathname: '/dashboard',
          search: '',
          href: '/dashboard',
        },
        localStorage: {
          setItem: (k: string, v: string) => {
            mockLocalStorage[k] = v;
          },
          getItem: (k: string) => mockLocalStorage[k] || null,
        },
      };

      vi.stubGlobal('window', fakeWindow);

      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const url = config.url || '';
        if (url.includes('/api/v1/auth/refresh')) {
          throw new AxiosError(
            'Refresh failed',
            'ERR_BAD_REQUEST',
            config,
            null,
            { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config } as AxiosResponse,
          );
        }

        throw new AxiosError(
          'Unauthorized',
          'ERR_BAD_REQUEST',
          config,
          null,
          { status: 401, statusText: 'Unauthorized', headers: {}, data: {}, config } as AxiosResponse,
        );
      };

      await expect(http.get('/api/v1/user/settings')).rejects.toThrow();
      expect(getAccessToken()).toBeNull();
      expect(mockLocalStorage.auth_expired).toBe('true');
      expect(fakeWindow.location.href).toBe('/login');

      vi.unstubAllGlobals();
    });
  });

  describe('customInstance helper', () => {
    it('passes options and configs to http client', async () => {
      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        return {
          data: { url: config.url, method: config.method },
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      const result: any = await customInstance({ url: '/custom-url', method: 'post' });
      expect(result).toEqual({ url: '/custom-url', method: 'post' });
    });
  });

  describe('Mock Mode Compatibility Helpers', () => {
    it('provides isMockModeEnabled and setMockMode helpers', () => {
      expect(isMockModeEnabled()).toBe(false);
      setMockMode(true);
      expect(isMockModeEnabled()).toBe(true);
      setMockMode(false);
      expect(isMockModeEnabled()).toBe(false);
    });

    it('handleMockRequest returns expected responses for development testing', async () => {
      const mockResult: any = await handleMockRequest('/health', 'GET');
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

    it('invokes generated callers through http pipeline with configured adapter', async () => {
      http.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
        const url = config.url || '';
        if (url.includes('/health')) {
          return {
            data: {
              status: 'ok',
              version: '1.0.0',
              timestamp: '2026-11-14T00:00:00Z',
              database: { status: 'ok', latencyMs: 2 },
            },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          } as AxiosResponse;
        }

        return {
          data: {},
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        } as AxiosResponse;
      };

      const health = await getHealth();
      expect(health.status).toBe('ok');
      expect(health.database.status).toBe('ok');
    });
  });
});
