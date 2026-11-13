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
  isMockModeEnabled,
  setMockMode,
  ProblemDetailsError,
} from './http';

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
