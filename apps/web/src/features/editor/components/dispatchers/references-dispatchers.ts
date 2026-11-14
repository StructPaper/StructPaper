import { CommandBus } from '@structpaper/editor-core';
import { PaperReference } from '@/types/paper';

export function dispatchAddReference(
  bus: CommandBus | undefined,
  ref: PaperReference,
  onChange: (updated: PaperReference[]) => void,
  current: PaperReference[]
): void {
  const updated = [...current, ref];
  if (bus) {
    try {
      bus.dispatch({
        type: 'reference/add',
        payload: {
          reference: {
            id: String(ref.id),
            raw: ref.raw,
            doi: ref.doi,
            parse: 'ok' as const,
          },
        },
      });
    } catch (e) {
      console.warn('CommandBus reference/add dispatch warning:', e);
    }
  }
  onChange(updated);
}

export function dispatchUpdateReference(
  bus: CommandBus | undefined,
  refId: number,
  updates: Partial<PaperReference>,
  onChange: (updated: PaperReference[]) => void,
  current: PaperReference[]
): void {
  const updated = current.map((r) => (r.id === refId ? { ...r, ...updates } : r));
  if (bus) {
    try {
      bus.dispatch({
        type: 'reference/update',
        payload: {
          referenceId: String(refId),
          updates,
        },
      });
    } catch (e) {
      console.warn('CommandBus reference/update dispatch warning:', e);
    }
  }
  onChange(updated);
}

export function dispatchRemoveReference(
  bus: CommandBus | undefined,
  refId: number,
  onChange: (updated: PaperReference[]) => void,
  current: PaperReference[]
): void {
  const filtered = current.filter((r) => r.id !== refId);
  const renumbered = filtered.map((r, i) => ({ ...r, id: i + 1 }));
  if (bus) {
    try {
      bus.dispatch({
        type: 'reference/remove',
        payload: {
          referenceId: String(refId),
        },
      });
    } catch (e) {
      console.warn('CommandBus reference/remove dispatch warning:', e);
    }
  }
  onChange(renumbered);
}
