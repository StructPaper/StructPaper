import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse, AxiosRequestConfig } from 'axios';
import type { InvalidParam, ProblemDetails } from '@structpaper/contracts';

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

// ======= Memory Storage for Access Token & Refresh Handlers =======
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

// ======= Mock Mode Helpers (Kept for compatibility) =======
let mockModeEnabled = false;

export const isMockModeEnabled = (): boolean => mockModeEnabled;

export const setMockMode = (enabled: boolean) => {
  mockModeEnabled = enabled;
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

  // On refresh failure: clear token and redirect to /login if in browser
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.localStorage.setItem('auth_expired', 'true');
    window.location.href = '/login';
  }
};

// ======= Axios Client Instance =======
export const http = axios.create({
  baseURL: '/api/proxy',
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

// Request Interceptor: Attach Bearer Token & resolve SSR host if needed
http.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    if (typeof window === 'undefined' && !config.adapter && !http.defaults.adapter) {
      const isRelative = (u?: string) => u && !u.startsWith('http://') && !u.startsWith('https://');
      if (isRelative(config.baseURL)) {
        const serverHost =
          process.env.INTERNAL_API_URL ||
          process.env.API_SERVER_URL ||
          process.env.NEXT_PUBLIC_API_URL ||
          'http://127.0.0.1:3001';
        const cleanHost = serverHost.replace(/\/+$/, '');
        const cleanBase = config.baseURL!.replace(/^\/api\/proxy/, '');
        config.baseURL = `${cleanHost}${cleanBase}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response Interceptor: Unpack data, handle 401 token refresh queue & error normalization
http.interceptors.response.use(
  (response) => {
    return (response.data !== undefined ? response.data : response) as any;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    // 401 Unauthorized handling & Token Refresh Queue
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Prevent infinite loops if the refresh endpoint itself returns 401
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
        const res: any = currentRefreshToken
          ? await http.post('/api/v1/auth/refresh', { refreshToken: currentRefreshToken })
          : await http.get('/api/v1/auth/refresh');

        const newAccessToken =
          res?.access_token ||
          res?.data?.access_token ||
          res?.accessToken ||
          res?.data?.accessToken;

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

    // RFC 9457 Normalization & Error Data rejection
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
