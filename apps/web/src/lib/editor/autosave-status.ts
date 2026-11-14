import type { SaveState } from '@/lib/documents/autosave-controller';
import type { AutosaveStatus } from '@/features/editor';

/**
 * The title bar and the left dock show a four-value status (idle | saving | saved | error); the document
 * auto-save (local + server, with conflict detection) has more states. Collapse them:
 *  saved / saved-local -> saved (the data is safe on this machine), conflict / error -> error.
 */
export function autosaveStatusFromSaveState(state: SaveState): AutosaveStatus {
  switch (state) {
    case 'saving':
      return 'saving';
    case 'saved':
    case 'saved-local':
      return 'saved';
    case 'conflict':
    case 'error':
      return 'error';
    default:
      return 'idle'; // idle, dirty
  }
}
