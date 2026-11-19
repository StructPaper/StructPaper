'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { CompletePaper } from '@/types/paper';
import { EditorHistory, type HistoryEntry, type FocusTarget } from '@/lib/history/editor-history';
import { contentOf, sameContentRefs, type EditorTab, type PaperContent } from '@/lib/history/paper-content';
import { describeFocus, focusTarget, PANEL_ATTR } from '@/lib/history/focus';

export interface EditorHistoryApi {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undo: () => void;
  redo: () => void;
}

interface Options {
  formData: CompletePaper;
  setFormData: Dispatch<SetStateAction<CompletePaper>>;
  setIsDirty: (dirty: boolean) => void;
  setActiveTab: (tab: EditorTab) => void;
  /** Shows a block in the content tab (and opens it for typing when it is a paragraph). */
  showSection: (id: string, edit: boolean) => void;
}

/** The cursor counts as "where the author was working" for this long after it last moved into a field. */
const FOCUS_MEMORY_MS = 15_000;
/** Time for a rich-text block to hand its pending text to the paper before undo reads it. */
const FLUSH_WAIT_MS = 60;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const modalIsOpen = () => typeof document !== 'undefined' && !!document.querySelector('[data-testid="modal-portal-root"]');

/**
 * One undo/redo for the whole paper, whatever tab the change was made in. It watches the paper, records each change of
 * its content (a run of typing in one place is one step), and on Ctrl+Z / Ctrl+Y puts the content back, switches to the
 * tab where it was made and puts the cursor back in the very field (the block, for a long paper).
 *
 * Changes the history itself makes, and bookkeeping the server changes (version, pin), are not recorded.
 */
export function useEditorHistory({ formData, setFormData, setIsDirty, setActiveTab, showSection }: Options): EditorHistoryApi {
  const historyRef = useRef<EditorHistory>();
  if (!historyRef.current) historyRef.current = new EditorHistory();
  const history = historyRef.current;

  const [, setTick] = useState(0);
  useEffect(() => history.subscribe(() => setTick((n) => n + 1)), [history]);

  const prevContent = useRef<PaperContent>(contentOf(formData));
  const paperId = useRef(formData.id);
  const applying = useRef<PaperContent | null>(null);
  const lastFocus = useRef<{ target: FocusTarget; at: number } | null>(null);
  const busy = useRef(false);

  // where the cursor has been: the field the author is working in
  useEffect(() => {
    const onFocusIn = (e: FocusEvent) => {
      const target = describeFocus(e.target as Element);
      if (target) lastFocus.current = { target, at: Date.now() };
    };
    document.addEventListener('focusin', onFocusIn, true);
    return () => document.removeEventListener('focusin', onFocusIn, true);
  }, []);

  // record every change of content
  useEffect(() => {
    if (formData.id !== paperId.current) {
      // another paper: its history starts empty
      paperId.current = formData.id;
      history.clear();
      prevContent.current = contentOf(formData);
      applying.current = null;
      return;
    }
    const next = contentOf(formData);
    if (applying.current && sameContentRefs(next, applying.current)) {
      applying.current = null;
      prevContent.current = next;
      return;
    }
    if (sameContentRefs(next, prevContent.current)) return;

    const active = typeof document !== 'undefined' ? describeFocus(document.activeElement) : null;
    const remembered = lastFocus.current && Date.now() - lastFocus.current.at < FOCUS_MEMORY_MS ? lastFocus.current.target : null;
    history.record(prevContent.current, next, active ?? remembered);
    prevContent.current = next;
  }, [formData, history]);

  const apply = useCallback(
    async (entry: HistoryEntry, content: PaperContent) => {
      applying.current = content;
      setFormData((prev) => ({ ...prev, ...content }));
      setIsDirty(true);
      const target = entry.focus;
      if (target.sectionId && target.tab === 'sections') {
        setActiveTab('sections');
        showSection(target.sectionId, !!target.isParagraph);
      } else {
        setActiveTab(target.tab);
      }
      // the tab, and the block, take a moment to show; the field is looked for until it is there
      await focusTarget(target);
    },
    [setFormData, setIsDirty, setActiveTab, showSection],
  );

  const run = useCallback(
    async (direction: 'undo' | 'redo') => {
      if (busy.current) return;
      busy.current = true;
      try {
        // the field that has the cursor may hold text it has not handed over yet: let it commit, then read the history
        (document.activeElement as HTMLElement | null)?.blur?.();
        await wait(FLUSH_WAIT_MS);
        const entry = direction === 'undo' ? history.undo() : history.redo();
        if (!entry) return;
        await apply(entry, direction === 'undo' ? entry.before : entry.after);
      } finally {
        busy.current = false;
      }
    },
    [history, apply],
  );

  const undo = useCallback(() => void run('undo'), [run]);
  const redo = useCallback(() => void run('redo'), [run]);

  // Ctrl/Cmd+Z, Ctrl+Shift+Z, Ctrl+Y: ours when the cursor is in the editor's tabs or nowhere; fields elsewhere keep their own
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      const isUndo = key === 'z' && !e.shiftKey;
      const isRedo = (key === 'z' && e.shiftKey) || key === 'y';
      if (!isUndo && !isRedo) return;
      if (modalIsOpen()) return; // a dialog (a table editor, a form) has its own fields and its own undo
      const el = document.activeElement as HTMLElement | null;
      const typing = !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (typing && !el!.closest(`[${PANEL_ATTR}]`)) return;
      e.preventDefault();
      e.stopPropagation();
      if (isUndo) undo();
      else redo();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [undo, redo]);

  return { canUndo: history.canUndo, canRedo: history.canRedo, undoLabel: history.undoLabel, redoLabel: history.redoLabel, undo, redo };
}
