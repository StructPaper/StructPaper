/**
 * StructPaper API Client SDK
 * Automated typed client, React Query hooks, Axios instance, and RFC 9457 error normalization.
 */

// HTTP Client & Interceptors
export {
  http,
  customInstance,
  setAccessToken,
  getAccessToken,
  setRefreshTokenGetter,
  setOnTokenRefreshed,
  isMockModeEnabled,
  setMockMode,
  ProblemDetailsError,
  setGlobalApiErrorHandler,
  getGlobalApiErrorHandler,
  STATUS_VI_FALLBACKS,
  getStatusFallback,
} from './http';
export type { GlobalApiErrorHandler, GlobalApiErrorInfo, StatusMessageFallback } from './http';
export type { AxiosResponse, InternalAxiosRequestConfig, AxiosError, AxiosRequestConfig } from 'axios';

// API Modules (Eatzy architecture pattern)
export * from './modules/auth';
export * from './modules/manuscripts';
export * from './modules/assets';
export * from './modules/compile';

// Mock Adapter
export { handleMockRequest } from './mock-adapter';

// Generated React Query Hooks & API Callers
export * from './generated/endpoints/auth/auth';
export * from './generated/endpoints/access/access';
export * from './generated/endpoints/manuscripts/manuscripts';
export * from './generated/endpoints/sync/sync';
export * from './generated/endpoints/assets/assets';
export * from './generated/endpoints/health/health';

// Generated Schema Models & Types
export * from './generated/model';
