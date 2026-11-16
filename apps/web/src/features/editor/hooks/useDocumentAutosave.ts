import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { CompletePaper } from '@/types/paper';
import { AutosaveController, type SaveState } from '@/lib/documents/autosave-controller';
import { DocumentApi } from '@/lib/documents/document-api';
import { DocumentSync } from '@/lib/documents/document-sync';
import { sileo } from '@/components/toast';

export interface UseDocumentAutosaveOptions {
  /** Current editor content. A new object identity means "edited". */
  paper: CompletePaper;
  /** Identity of the loaded document; resets the baseline when it changes. */
  documentId: string;
  saveLocal: (paper: CompletePaper) => Promise<boolean>;
  /** Pass false to disable server sync (tests, fully-offline desktop). */
  remote?: boolean;
  debounceMs?: number;
  /** false = manual saving only (the editor's auto-save switch): edits are not saved on their own. */
  enabled?: boolean;
  /** Pass false for Server-Only mode where local persistence is bypassed. */
  isLocalAvailable?: boolean;
}

/**
 * Returns true if user-facing document content has changed relative to baseline.
 * Ignores server synchronization counters (version, currentServerRev, updatedAt)
 * to prevent auto-save response cycles.
 */
export function hasPaperContentChanged(current: CompletePaper, baseline: CompletePaper): boolean {
  if (current === baseline) return false;
  if (current.id !== baseline.id) return true;
  if (current.displayName !== baseline.displayName) return true;
  if (current.metadata !== baseline.metadata) return true;
  if (current.sections !== baseline.sections) return true;
  if (current.references !== baseline.references) return true;
  if (current.layoutSettings !== baseline.layoutSettings) return true;
  if (current.templateId !== baseline.templateId) return true;
  return false;
}

export function useDocumentAutosave({
  paper,
  documentId,
  saveLocal,
  remote = true,
  debounceMs = 1200,
  enabled = true,
  isLocalAvailable = true,
}: UseDocumentAutosaveOptions) {
  const [state, setState] = useState<SaveState>('idle');
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const baseline = useRef<CompletePaper>(paper);
  const saveLocalRef = useRef(saveLocal);
  saveLocalRef.current = saveLocal;

  const sync = useMemo(() => (remote ? new DocumentSync({ api: new DocumentApi() }) : null), [remote]);

  const controller = useMemo(
    () =>
      new AutosaveController({
        debounceMs,
        sync,
        isLocalAvailable,
        saveLocal: (p) => saveLocalRef.current(p),
        onState: (s, info) => {
          setState(s);
          if (info?.savedAt) setSavedAt(info.savedAt);
          if ((s === 'saved' || s === 'saved-local') && info?.paper) {
            baseline.current = info.paper;
          }
          if (s === 'conflict') {
            sileo.warning({
              title: 'Xung đột phiên bản máy chủ',
              description: 'Máy chủ đang có bản mới hơn từ phiên làm việc khác. Bạn có thể chọn "Ghi đè" trên thanh tiêu đề.',
              error: info?.error,
            });
          }
        },
      }),
    [sync, debounceMs, isLocalAvailable]
  );

  // Id of the document `baseline` belongs to.
  const baselineId = useRef<string>(paper.id);

  // New document loaded: it is by definition clean. The editor swaps its content a render *after*
  // the id changes, so the baseline is adopted from the first content that carries the new id (below).
  useEffect(() => {
    setState('idle');
  }, [documentId]);

  // Any later content change schedules an autosave.
  useEffect(() => {
    // Content of another document (the editor still shows the previous one for a render): not an edit.
    if (paper.id !== documentId) return;
    // First content of a freshly loaded document (the editor re-clones it on load): adopt it as clean.
    if (baselineId.current !== documentId) {
      baselineId.current = documentId;
      baseline.current = paper;
      return;
    }
    if (hasPaperContentChanged(paper, baseline.current)) {
      if (enabled) controller.notify(paper);
      else controller.markDirty(paper);
    } else {
      // Version or non-content metadata changed as a result of save; advance baseline reference.
      baseline.current = paper;
    }
  }, [paper, documentId, controller, enabled]);

  // Don't lose the last edits when the tab is hidden/closed.
  useEffect(() => {
    controller.activate();
    const flush = () => void controller.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      void controller.flush();
      controller.dispose();
    };
  }, [controller]);

  const saveNow = useCallback(
    (p?: CompletePaper, opts?: { awaitSync?: boolean }) => controller.saveNow(p ?? paper, opts),
    [controller, paper]
  );
  const flush = useCallback(() => controller.flush(), [controller]);
  const resolveKeepMine = useCallback(async () => {
    await controller.resolveKeepMine();
    sileo.success({
      title: 'Đã ghi đè thành công',
      description: 'Bản thảo của bạn đã được lưu đè lên máy chủ.',
    });
  }, [controller]);

  return { state, savedAt, saveNow, flush, resolveKeepMine, sync };
}
