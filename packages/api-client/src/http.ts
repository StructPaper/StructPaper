import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse, AxiosRequestConfig } from 'axios';
import type { InvalidParam, ProblemDetails } from '@structpaper/contracts';
import { handleMockRequest } from './mock-adapter';

// ======= RFC 9457 Problem Details Error =======
export class ProblemDetailsError extends Error {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail: string;
  readonly instance?: string;
  readonly code?: string;
  readonly invalidParams?: InvalidParam[];
  readonly extensions?: Record<string, unknown>;

  constructor(problem: ProblemDetails | Record<string, any>) {
    super(problem?.detail || problem?.title || 'Problem Details Error');
    this.name = 'ProblemDetailsError';
    this.type = problem?.type || 'about:blank';
    this.title = problem?.title || 'Error';
    this.status = Number(problem?.status) || 500;
    this.detail = problem?.detail || '';
    this.instance = problem?.instance;
    this.code = problem?.code;
    this.invalidParams = problem?.invalidParams || (problem as any)?.errors;

    const {
      type,
      title,
      status,
      detail,
      instance,
      code,
      invalidParams,
      errors,
      ...extensions
    } = problem || {};
    this.extensions = extensions;

    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, ProblemDetailsError.prototype);
  }
}

// ======= Memory Storage for Access Token & Refresh Handler =======
let accessToken: string | null = null;
let refreshTokenGetter: (() => string | null) | null = null;
let onTokenRefreshedCallback: ((newAccessToken: string) => void) | null = null;

export const setAccessToken = (token: string | null) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const setRefreshTokenGetter = (fn: (() => string | null) | null) => {
  refreshTokenGetter = fn;
};

export const setOnTokenRefreshed = (fn: ((newAccessToken: string) => void) | null) => {
  onTokenRefreshedCallback = fn;
};

// ======= Mock Mode Controller =======
let memoryMockMode: boolean | null = null;

export const isMockModeEnabled = (): boolean => {
  if (memoryMockMode !== null) return memoryMockMode;

  if (typeof window !== 'undefined') {
    const localSetting = window.localStorage.getItem('structpaper_mock_mode');
    if (localSetting === 'false') return false;
    if (localSetting === 'true') return true;
  }

  if (typeof process !== 'undefined' && process.env) {
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK === 'false') return false;
    if (process.env.ENABLE_MOCK === 'true') return true;
  }

  return false;
};

export const setMockMode = (enabled: boolean) => {
  memoryMockMode = enabled;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('structpaper_mock_mode', enabled ? 'true' : 'false');
  }
};

// ======= Token Refresh Queue Logic =======
interface RefreshSubscriber {
  resolve: (token: string) => void;
  reject: (error: any) => void;
}

let isRefreshing = false;
let refreshSubscribers: RefreshSubscriber[] = [];

const subscribeTokenRefresh = (
  resolve: (token: string) => void,
  reject: (error: any) => void,
) => {
  refreshSubscribers.push({ resolve, reject });
};

const onRefreshed = (token: string) => {
  refreshSubscribers.forEach((sub) => sub.resolve(token));
  refreshSubscribers = [];
};

const onRefreshFailed = (error: any) => {
  refreshSubscribers.forEach((sub) => sub.reject(error));
  refreshSubscribers = [];
  setAccessToken(null);
  isRefreshing = false;

  // Route out of authenticated flow to /login (matching eatzy_frontend pattern)
  if (!isMockModeEnabled() && typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.localStorage.setItem('auth_expired', 'true');
    const redirectParam = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?redirect=${redirectParam}`;
  }
};

// ======= Axios Client Instance =======
export const http = axios.create({
  baseURL:
    typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL
      : (typeof process !== 'undefined' && process.env?.API_BASE_URL ? process.env.API_BASE_URL : ''),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json, application/problem+json',
  },
});

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  return http({
    ...config,
    ...options,
  }) as unknown as Promise<T>;
};

// Request Interceptor: Attach Token & Handle Mock Adapter
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    const mockHeader = config.headers?.['x-mock-mode'] === 'true';
    if (isMockModeEnabled() || mockHeader) {
      config.adapter = async (cfg) => {
        let parsedData = cfg.data;
        if (typeof cfg.data === 'string') {
          try {
            parsedData = JSON.parse(cfg.data);
          } catch {
            parsedData = cfg.data;
          }
        }
        const mockResult = await handleMockRequest(
          cfg.url || '',
          cfg.method || 'GET',
          parsedData,
          cfg.params,
        );

        const response: AxiosResponse = {
          data: mockResult,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: cfg,
        };
        return response;
      };
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Handle 401 Refresh Queue, Mock Fallback & RFC 9457 Normalization
http.interceptors.response.use(
  (response) => {
    return (response.data !== undefined ? response.data : response) as any;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    // Fallback to mock adapter if network is unreachable and mock is permitted
    if (
      (error.code === 'ERR_NETWORK' || !error.response || (error.response.status >= 500 && error.response.status <= 504)) &&
      originalRequest?.url &&
      isMockModeEnabled()
    ) {
      let parsedData = originalRequest.data;
      if (typeof originalRequest.data === 'string') {
        try {
          parsedData = JSON.parse(originalRequest.data);
        } catch {
          parsedData = originalRequest.data;
        }
      }
      return handleMockRequest(originalRequest.url, originalRequest.method, parsedData, originalRequest.params);
    }

    // 401 Unauthorized handling & Token Refresh Queue
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/refresh')) {
        onRefreshFailed(error);
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh(
            (token) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
              }
              resolve(http(originalRequest));
            },
            (refreshErr) => {
              reject(refreshErr);
            },
          );
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const currentRefreshToken = refreshTokenGetter ? refreshTokenGetter() : null;
        const res: any = await http.post('/api/v1/auth/refresh', {
          refreshToken: currentRefreshToken,
        });
        const newAccessToken =
          res?.accessToken || res?.access_token || res?.data?.accessToken || res?.data?.access_token;

        if (newAccessToken) {
          setAccessToken(newAccessToken);
          if (onTokenRefreshedCallback) {
            onTokenRefreshedCallback(newAccessToken);
          }
          isRefreshing = false;
          onRefreshed(newAccessToken);

          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }
          return http(originalRequest);
        } else {
          onRefreshFailed(error);
          return Promise.reject(error);
        }
      } catch (refreshErr) {
        onRefreshFailed(refreshErr);
        return Promise.reject(refreshErr);
      }
    }

    // RFC 9457 Normalization
    const resData: any = error?.response?.data;
    const contentType = error?.response?.headers?.['content-type'] || '';
    const isProblemJson =
      typeof contentType === 'string' && contentType.includes('application/problem+json');

    if (
      isProblemJson ||
      (resData && typeof resData === 'object' && ('type' in resData || 'title' in resData || 'status' in resData || 'invalidParams' in resData))
    ) {
      return Promise.reject(new ProblemDetailsError(resData));
    }

    if (resData) {
      return Promise.reject(resData);
    }

    return Promise.reject(error);
  },
);
