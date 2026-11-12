import type { AutosaveStatus } from '@/components/editor/hooks/useEditorAutoSave';

export type DocumentSaveState = 'saved' | 'saving' | 'unsaved' | 'error';

export interface ResolveDocumentSaveStateInput {
  autosaveStatus: AutosaveStatus;
  isDirty: boolean;
  saveSuccess?: boolean;
}

export interface SaveStateMetadata {
  state: DocumentSaveState;
  label: string;
  ariaLabel: string;
}

const SAVE_STATE_METADATA: Record<DocumentSaveState, SaveStateMetadata> = {
  saved: {
    state: 'saved',
    label: 'Saved',
    ariaLabel: 'Bản thảo đã được lưu',
  },
  saving: {
    state: 'saving',
    label: 'Saving...',
    ariaLabel: 'Đang lưu bản thảo',
  },
  unsaved: {
    state: 'unsaved',
    label: 'Unsaved',
    ariaLabel: 'Có thay đổi chưa lưu',
  },
  error: {
    state: 'error',
    label: 'Error',
    ariaLabel: 'Lỗi lưu bản thảo',
  },
};

const DEFAULT_DOCUMENT_TITLE = 'Bản thảo chưa đặt tên';

/**
 * Resolves the user-facing document save state from editor dirty flags and autosave lifecycle.
 */
export function resolveDocumentSaveState({
  autosaveStatus,
  isDirty,
}: ResolveDocumentSaveStateInput): DocumentSaveState {
  if (autosaveStatus === 'saving') {
    return 'saving';
  }
  if (autosaveStatus === 'error') {
    return 'error';
  }
  if (isDirty) {
    return 'unsaved';
  }
  return 'saved';
}

export function getSaveStateMetadata(state: DocumentSaveState): SaveStateMetadata {
  return SAVE_STATE_METADATA[state] ?? SAVE_STATE_METADATA.saved;
}

/**
 * Formats the manuscript display name ("Tên hiển thị bài báo") shown in desktop chrome,
 * falling back to a neutral placeholder when unset (never uses academic title).
 */
export function resolveDocumentDisplayTitle(displayName?: string | null): string {
  const normalized = displayName?.trim();
  return normalized && normalized.length > 0 ? normalized : DEFAULT_DOCUMENT_TITLE;
}

/**
 * Formats a Unix epoch timestamp into a Vietnamese HH:MM:SS string for save tooltips.
 */
export function formatSavedTime(savedAt?: number | null): string | null {
  if (!savedAt) return null;
  return new Date(savedAt).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Formats tooltip text indicating local-only persistence awaiting server synchronization.
 */
export function formatLocalOnlyTooltip(savedAt?: number | null): string {
  const savedTime = formatSavedTime(savedAt);
  return savedTime
    ? `Đã lưu trên máy lúc ${savedTime} (chưa đồng bộ máy chủ)`
    : 'Đã lưu trên máy (chưa đồng bộ máy chủ)';
}
