export interface BatchActivity {
  total: number;
  finished: number;
}

type Listener = (a: BatchActivity | null) => void;

let current: BatchActivity | null = null;
const listeners = new Set<Listener>();

/** What the import running in THIS tab is doing (null when none). The title bar shows it. */
export const batchActivity = {
  get: (): BatchActivity | null => current,
  set(next: BatchActivity | null) {
    current = next;
    listeners.forEach((l) => l(next));
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
