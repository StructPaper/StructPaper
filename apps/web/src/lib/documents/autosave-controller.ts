import type { CompletePaper } from '@/types/paper';
import { ApiError } from './document-api';
import type { DocumentSync } from './document-sync';

/**
 * Auto-save state machine (framework-free so it is unit-testable).
 *
 *  edit -> notify(paper) -> debounce -> local save (IndexedDB, always) -> server push (best effort)
 *
 *  idle         nothing to save yet
 *  dirty        edits waiting for the debounce
 *  saving       a save is running
 *  saved        stored locally AND on the server
 *  saved-local  stored locally; server unreachable/failed, retried on the next change/flush
 *  conflict     server has a newer revision (another session saved); needs a user decision
 *  error        local save failed (data at risk)
 */
export type SaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'saved-local' | 'conflict' | 'error';

export interface AutosaveOptions {
  debounceMs?: number;
  saveLocal: (paper: CompletePaper) => Promise<boolean>;
  sync?: DocumentSync | null;
  onState?: (state: SaveState, info?: { error?: unknown; savedAt?: number; paper?: CompletePaper }) => void;
}

export class AutosaveController {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private latest: CompletePaper | null = null;
  private running: Promise<void> | null = null;
  private syncChain: Promise<void> = Promise.resolve();
  private rerun = false;
  private pendingSnapshot = false;
  private disposed = false;
  private state: SaveState = 'idle';

  constructor(private opts: AutosaveOptions) {}

  getState(): SaveState {
    return this.state;
  }

  private emit(state: SaveState, info?: { error?: unknown; savedAt?: number; paper?: CompletePaper }) {
    this.state = state;
    try {
      this.opts.onState?.(state, info);
    } catch {
      /* listener errors must never break saving */
    }
  }

  /** Mark the document as having unsaved edits without scheduling an automatic save timer. */
  markDirty(paper?: CompletePaper): void {
    if (this.disposed) return;
    if (paper) this.latest = paper;
    if (this.state !== 'saving' && this.state !== 'dirty') this.emit('dirty');
  }

  /** Call on every edit. Cheap: only stores the reference and (re)starts the debounce. */
  notify(paper: CompletePaper): void {
    if (this.disposed) return;
    this.latest = paper;
    if (this.state !== 'saving') this.emit('dirty');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.run();
    }, this.opts.debounceMs ?? 1200);
  }

  /**
   * Save right now (explicit "Lưu"): persists to local storage immediately,
   * emits 'saved-local', and pushes a snapshot to the server in the background.
   * If awaitSync is true, waits for the background server sync to settle.
   */
  async saveNow(paper?: CompletePaper, opts?: { awaitSync?: boolean }): Promise<SaveState> {
    if (paper) this.latest = paper;
    this.pendingSnapshot = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.run();
    if (opts?.awaitSync) {
      await this.syncChain;
    }
    return this.state;
  }

  /** Flush a pending debounce (tab hidden / navigating away / before export). */
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      await this.run();
    } else if (this.running) {
      await this.running;
    }
    await this.syncChain;
  }

  /** User chose "keep my version" after a conflict. */
  async resolveKeepMine(): Promise<void> {
    const paper = this.latest;
    if (!paper || !this.opts.sync) return;
    this.emit('saving');
    try {
      await this.opts.sync.push(paper, { force: true });
      this.emit('saved', { savedAt: Date.now(), paper });
    } catch (e) {
      this.emit('saved-local', { error: e, paper });
    }
  }

  /** Re-arm after dispose() (React StrictMode runs effect cleanup and setup back to back). */
  activate(): void {
    this.disposed = false;
  }

  dispose(): void {
    this.disposed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async run(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      while (this.running) {
        await this.running;
      }
      return;
    }
    this.running = this.execute().finally(() => {
      this.running = null;
      if (this.rerun && !this.disposed) {
        this.rerun = false;
        void this.run();
      }
    });
    while (this.running) {
      await this.running;
    }
  }

  private async execute(): Promise<void> {
    const paper = this.latest;
    if (!paper) return;
    const snapshot = this.pendingSnapshot;
    this.pendingSnapshot = false;
    this.emit('saving');

    let localOk = false;
    try {
      localOk = await this.opts.saveLocal(paper);
    } catch (e) {
      this.emit('error', { error: e });
      return;
    }
    if (!localOk) {
      this.emit('error', { error: new Error('Không thể lưu cục bộ') });
      return;
    }

    // Step 1 (Local-first): Data is safely saved locally. Notify immediately.
    this.emit('saved-local', { savedAt: Date.now(), paper });

    // Step 2 (Server sync): Run best-effort synchronization in the background.
    const sync = this.opts.sync;
    if (!sync) return;

    this.triggerBackgroundSync(paper, snapshot);
  }

  private triggerBackgroundSync(paper: CompletePaper, snapshot: boolean): Promise<void> {
    const sync = this.opts.sync;
    if (!sync) return Promise.resolve();

    const task = async () => {
      if (this.disposed) return;
      try {
        await sync.push(paper, { snapshot });
        // Only upgrade to fully saved if no newer edits occurred while syncing
        if (!this.disposed && this.latest === paper) {
          this.emit('saved', { savedAt: Date.now(), paper });
        }
      } catch (e) {
        if (this.disposed) return;
        if (e instanceof ApiError && e.isConflict) {
          this.emit('conflict', { error: e });
        } else {
          this.emit('saved-local', { error: e, savedAt: Date.now(), paper });
        }
      }
    };

    this.syncChain = this.syncChain.catch(() => {}).then(task);
    return this.syncChain;
  }
}
