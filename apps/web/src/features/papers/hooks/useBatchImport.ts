'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBatchDeps } from '@/lib/batch-import/default-deps';
import { retryFailed, runBatchImport, initialItems } from '@/lib/batch-import/run-batch';
import type { BatchDeps, BatchItem, BatchJournal } from '@/lib/batch-import/types';

export interface UseBatchImportOptions {
  /** Called once when a run (or a retry) has finished or been cancelled, with the final items. */
  onFinished?: (items: BatchItem[]) => void;
  /** Dependencies; the real ones by default (tests pass fakes). */
  createDeps?: () => BatchDeps;
}

/** State around runBatchImport: progress for the UI, cancel, retry of the failed files. */
export function useBatchImport({ onFinished, createDeps = createBatchDeps }: UseBatchImportOptions = {}) {
  const [items, setItems] = useState<BatchItem[]>([]);
  const [running, setRunning] = useState(false);
  const [skipped, setSkipped] = useState(0);
  const filesRef = useRef<File[]>([]);
  const journalRef = useRef<BatchJournal | null>(null);
  const journalsRef = useRef<BatchJournal[] | undefined>(undefined);
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
        finishedRef.current?.(final);
      }
    },
    []
  );

  const start = useCallback(
    (files: File[], journal: BatchJournal, skippedCount = 0, journals?: BatchJournal[]) => {
      if (abortRef.current) return Promise.resolve(); // a run is already going
      filesRef.current = files;
      journalRef.current = journal;
      journalsRef.current = journals;
      setSkipped(skippedCount);
      latestRef.current = initialItems(files);
      setItems(latestRef.current);
      return execute((signal, onUpdate) => runBatchImport({ files, journal, journals, deps: createDeps(), signal, onUpdate }));
    },
    [execute, createDeps]
  );

  const retry = useCallback(() => {
    const journal = journalRef.current;
    if (abortRef.current || !journal) return Promise.resolve();
    const prev = items;
    return execute((signal, onUpdate) => retryFailed(prev, filesRef.current, { journal, journals: journalsRef.current, deps: createDeps(), signal, onUpdate }));
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
