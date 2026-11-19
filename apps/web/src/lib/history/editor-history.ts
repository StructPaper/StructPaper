import { sameContent, locateChange, type PaperContent, type ChangeLocation } from './paper-content';

/** Where the cursor was when the change was made, so undo can put it back there. */
export interface FocusTarget {
  tab: ChangeLocation['tab'];
  /** The block (card) the field belongs to. */
  sectionId?: string;
  /** The block opens in its rich-text editor when focused. */
  isParagraph?: boolean;
  /** Which editable field inside the tab (or inside the block): its position among them. */
  nth?: number;
  /** A distinctive attribute of the field (id, name, test id), to find it again if positions shifted. */
  fieldKey?: string;
  selection?: { start: number; end: number };
}

export interface HistoryEntry {
  before: PaperContent;
  after: PaperContent;
  label: string;
  /** Edits with the same key close in time are one step. */
  coalesceKey: string | null;
  focus: FocusTarget;
  /** When the step started and when its last edit happened. */
  startedAt: number;
  lastAt: number;
}

export interface HistoryOptions {
  /** Steps kept; the oldest are dropped beyond this. */
  maxSteps?: number;
  /** Two edits to one place within this gap are one step. */
  coalesceGapMs?: number;
  /** A step stops growing after this long, however steadily the author types. */
  coalesceMaxMs?: number;
}

export const HISTORY_DEFAULTS = { maxSteps: 300, coalesceGapMs: 1000, coalesceMaxMs: 20_000 } as const;

type Listener = () => void;

/**
 * The one undo history of a paper. Each step keeps the content before and after (the parts an edit did not touch are
 * shared between the two, so a step costs about the size of what was edited). A run of typing in one field is one
 * step; a new edit after undoing drops what could have been redone.
 */
export class EditorHistory {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private listeners = new Set<Listener>();
  private readonly opts: Required<HistoryOptions>;

  constructor(opts: HistoryOptions = {}) {
    this.opts = { ...HISTORY_DEFAULTS, ...opts };
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  get undoLabel(): string | null { return this.undoStack[this.undoStack.length - 1]?.label ?? null; }
  get redoLabel(): string | null { return this.redoStack[this.redoStack.length - 1]?.label ?? null; }
  get size() { return this.undoStack.length; }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() { this.listeners.forEach((fn) => fn()); }

  /** Records that `before` became `after`. Returns false when nothing really changed. */
  record(before: PaperContent, after: PaperContent, focus: FocusTarget | null, now: number = Date.now()): boolean {
    if (sameContent(before, after)) return false;
    const where = locateChange(before, after);
    const target: FocusTarget = { ...(focus ?? {}), tab: focus?.tab ?? where.tab, sectionId: focus?.sectionId ?? where.sectionId, isParagraph: focus?.isParagraph ?? where.isParagraph };

    const last = this.undoStack[this.undoStack.length - 1];
    if (
      last &&
      this.redoStack.length === 0 &&
      where.coalesceKey !== null &&
      last.coalesceKey === where.coalesceKey &&
      now - last.lastAt <= this.opts.coalesceGapMs &&
      now - last.startedAt <= this.opts.coalesceMaxMs
    ) {
      last.after = after;
      last.lastAt = now;
      last.focus = { ...last.focus, ...(focus ?? {}), tab: last.focus.tab };
      // typed back to where it started: the step is a no-op, drop it
      if (sameContent(last.before, last.after)) this.undoStack.pop();
      this.emit();
      return true;
    }

    this.undoStack.push({ before, after, label: where.label, coalesceKey: where.coalesceKey, focus: target, startedAt: now, lastAt: now });
    if (this.undoStack.length > this.opts.maxSteps) this.undoStack.shift();
    this.redoStack = [];
    this.emit();
    return true;
  }

  /** The step to undo (moved to the redo side); apply `entry.before`. */
  undo(): HistoryEntry | null {
    const entry = this.undoStack.pop();
    if (!entry) return null;
    this.redoStack.push(entry);
    this.emit();
    return entry;
  }

  /** The step to redo (moved back to the undo side); apply `entry.after`. */
  redo(): HistoryEntry | null {
    const entry = this.redoStack.pop();
    if (!entry) return null;
    this.undoStack.push(entry);
    this.emit();
    return entry;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }
}
