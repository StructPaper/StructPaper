'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { CompletePaper } from '@/types/paper';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface UseEditorAutoSaveOptions {
  paperId?: string;
  formData: CompletePaper;
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  onSave: (paper: CompletePaper) => Promise<boolean | void>;
  debounceMs?: number;
  enabled?: boolean;
}

export interface UseEditorAutoSaveReturn {
  autosaveStatus: AutosaveStatus;
  lastSavedAt: string | null;
  flush: () => Promise<boolean>;
  cancel: () => void;
}

/**
 * Custom hook to manage debounced auto-save to persistent storage (IndexedDB)
 * and prevent accidental data loss on browser tab/window close via beforeunload.
 */
export function useEditorAutoSave({
  paperId,
  formData,
  isDirty,
  setIsDirty,
  onSave,
  debounceMs = 1500,
  enabled = true,
}: UseEditorAutoSaveOptions): UseEditorAutoSaveReturn {
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const formDataRef = useRef<CompletePaper>(formData);
  formDataRef.current = formData;

  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const setIsDirtyRef = useRef(setIsDirty);
  setIsDirtyRef.current = setIsDirty;

  const isSavingRef = useRef(false);

  // 1. Immediately flush pending save
  const flush = useCallback(async (): Promise<boolean> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!isDirty && autosaveStatus !== 'saving') {
      return true;
    }

    isSavingRef.current = true;
    setAutosaveStatus('saving');

    try {
      const target = formDataRef.current;
      const res = await onSaveRef.current(target);
      const success = res !== false;
      if (success) {
        setIsDirtyRef.current(false);
        setAutosaveStatus('saved');
        setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
        setTimeout(() => {
          setAutosaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
        }, 2500);
      } else {
        setAutosaveStatus('error');
      }
      return success;
    } catch (err) {
      console.error('[useEditorAutoSave] flush save error:', err);
      setAutosaveStatus('error');
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, [isDirty, autosaveStatus]);

  // 2. Cancel pending timer
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 3. Debounced auto-save effect whenever formData changes while isDirty
  useEffect(() => {
    if (!enabled) {
      cancel();
      return;
    }

    if (!isDirty) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      if (isSavingRef.current) return;

      isSavingRef.current = true;
      setAutosaveStatus('saving');

      try {
        const target = formDataRef.current;
        const res = await onSaveRef.current(target);
        const success = res !== false;
        if (success) {
          setIsDirtyRef.current(false);
          setAutosaveStatus('saved');
          setLastSavedAt(new Date().toLocaleTimeString('vi-VN'));
          setTimeout(() => {
            setAutosaveStatus((prev) => (prev === 'saved' ? 'idle' : prev));
          }, 2500);
        } else {
          setAutosaveStatus('error');
        }
      } catch (err) {
        console.error('[useEditorAutoSave] background autosave error:', err);
        setAutosaveStatus('error');
      } finally {
        isSavingRef.current = false;
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [formData, isDirty, debounceMs, enabled, cancel]);

  // 4. Register window beforeunload event when isDirty
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    if (isDirty) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty]);

  return {
    autosaveStatus,
    lastSavedAt,
    flush,
    cancel,
  };
}
