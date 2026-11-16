/**
 * Storage Configuration for StructPaper
 *
 * Controls whether offline / local IndexedDB persistence is enabled.
 * When ENABLE_LOCAL_STORAGE is false (Server-Only Mode):
 * - Papers are fetched directly from the backend server (/api/v1/manuscripts).
 * - Papers are saved and auto-saved directly to the server.
 * - No draft records are read from or written to local IndexedDB.
 * - Local dual-storage issues (e.g. duplicate cards, sync discrepancies) are eliminated.
 */
export const STORAGE_CONFIG = {
  // Config flag to toggle local IndexedDB storage.
  // Set to false for Server-Only mode (per user requirement).
  // Can be easily switched back to true in code when local storage is needed.
  ENABLE_LOCAL_STORAGE: false,
} as const;

export const isLocalStorageEnabled = (): boolean => STORAGE_CONFIG.ENABLE_LOCAL_STORAGE;
