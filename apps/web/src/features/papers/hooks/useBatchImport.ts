'use client';
import type { ManagedJournalProfile } from '@/lib/templates/journal-storage';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBatchDeps } from '@/lib/batch-import/default-deps';
import { retryFailed, runBatchImport, initialItems } from '@/lib/batch-import/run-batch';
import type { BatchDeps, BatchItem, BatchJournal } from '@/lib/batch-import/types';
import { summarize } from '@/lib/batch-import/summary';
import { batchActivity } from '@/lib/batch-import/activity';
import { toast } from '@/components/toast';

const TOAST_ID = 'batch-import-progress';

/** One loading toast per run, updated as files finish: it stays visible after the dialog is closed. */
function showProgress(items: BatchItem[]) {
  const sum = summarize(items);
  batchActivity.set({ total: sum.total, finished: sum.finished });
  toast.loading(`Đang nhập ${sum.finished}/${sum.total} bài báo…`, 'Bạn có thể đóng hộp thoại, quá trình vẫn chạy ngầm.', { id: TOAST_ID, dismissible: false });
}

export interface UseBatchImportOptions {
  /** Called once when a run (or a retry) has finished or been cancelled, with the final items. */
  onFinished?: (items: BatchItem[]) => void;
  /** Dependencies; the real ones by default (tests pass fakes). */
  createDeps?: () => BatchDeps;
  /** Journals an automatic template choice may pick from (the server's list). */
  catalog?: ManagedJournalProfile[];
}

/** State around runBatchImport: progress for the UI, cancel, retry of the failed files. */
export function useBatchImport({ onFinished, createDeps = createBatchDeps, catalog }: UseBatchImportOptions = {}) {
  const catalogRef = useRef(catalog);
  catalogRef.current = catalog;
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const filesRef = useRef<File[]>([]);
  const journalRef = useRef<BatchJournal | null>(null);
  const journalsRef = useRef<Array<BatchJournal | null> | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const latestRef = useRef<BatchItem[]>([]);
  const finishedRef = useRef(onFinished);
  finishedRef.current = onFinished;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const execute = useCallback(
    async (job: (signal: AbortSignal, onUpdate: (it: BatchItem[]) => void) => Promise<BatchItem[]>) => {
      abortRef.current = new AbortController();
      setRunning(true);
      let final: BatchItem[] = [];
      try {
        final = await job(abortRef.current.signal, (it) => {
          latestRef.current = it;
          showProgress(it);
          if (mounted.current) setItems(it);
        });
      } catch (e) {
        console.error('[batch-import] run failed', e); // keep what the user last saw instead of wiping the list
        final = latestRef.current;
      } finally {
        if (mounted.current) {
          setItems(final);
          setRunning(false);
        }
        abortRef.current = null;
        batchActivity.set(null);
        toast.dismiss(TOAST_ID);
        finishedRef.current?.(final);
      }
    },
    []
  );

  const start = useCallback(
    (files: File[], journal: BatchJournal, skippedCount = 0, journals?: Array<BatchJournal | null>) => {
      if (abortRef.current) return Promise.resolve(); // a run is already going
      filesRef.current = files;
      journalRef.current = journal;
      journalsRef.current = journals;
      setSkipped(skippedCount);
      latestRef.current = initialItems(files);
      setItems(latestRef.current);
      return execute((signal, onUpdate) => runBatchImport({ files, journal, journals, catalog: catalogRef.current, deps: createDeps(), signal, onUpdate }));
    },
    [execute, createDeps]
  );

  const retry = useCallback(() => {
    const journal = journalRef.current;
    if (abortRef.current || !journal) return Promise.resolve();
    const prev = items;
    return execute((signal, onUpdate) => retryFailed(prev, filesRef.current, { journal, journals: journalsRef.current, catalog: catalogRef.current, deps: createDeps(), signal, onUpdate }));
  }, [execute, createDeps, items]);

  const cancel = useCallback(() => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    if (abortRef.current) return; // never throw away a run in progress
    filesRef.current = [];
    setItems([]);
    setSkipped(0);
  }, []);

  return { items, running, skipped, start, retry, cancel, reset };
}
