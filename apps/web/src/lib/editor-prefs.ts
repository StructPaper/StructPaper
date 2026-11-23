import { useSyncExternalStore } from 'react';

/**
 * Preferences of the person working in the editor (not of the paper): kept in the browser, shared by every part of the editor that
 * reads them, and never part of the paper itself.
 */
const HOVER_INSERT_KEY = 'structpaper_hover_insert';

const listeners = new Set<() => void>();
let hoverInsert = true;
let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    hoverInsert = localStorage.getItem(HOVER_INSERT_KEY) !== 'false';
  } catch {
    // storage unavailable: keep the default
  }
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Whether the strip "Thêm bên dưới: + Tiêu đề, Đoạn văn, Bảng, Hình…" unfolds when the pointer rests on a block (default: yes). */
export const useHoverInsert = (): [boolean, (on: boolean) => void] => {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      load();
      return hoverInsert;
    },
    () => true
  );
  const set = (on: boolean) => {
    load();
    hoverInsert = on;
    try {
      localStorage.setItem(HOVER_INSERT_KEY, String(on));
    } catch {
      // ignore
    }
    listeners.forEach((fn) => fn());
  };
  return [value, set];
};

/** For tests: forget what was read, so the next read starts from the browser again. */
export const resetEditorPrefsForTest = (): void => {
  loaded = false;
  hoverInsert = true;
  listeners.forEach((fn) => fn());
};
