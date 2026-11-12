'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  readAutoSavePreference,
  subscribeAutoSavePreference,
  writeAutoSavePreference,
} from '@/lib/editor/autosave-preferences';
import type { DocumentSaveState } from '@/lib/editor/save-status';
import type { SaveState } from '@/lib/documents/autosave-controller';
import type { ExportFormat } from '@/components/documents/DocumentMenuBar';

export interface EditorDocumentSession {
  paperId?: string;
  title: string;
  saveState: DocumentSaveState;
  rawSaveState?: SaveState;
  savedAt?: number | null;
  exporting?: Partial<Record<ExportFormat, boolean>>;
  onManualSave?: () => Promise<void> | void;
  onRename?: (name: string) => void;
  onNew?: () => void;
  onOpen?: () => void;
  onExport?: (format: ExportFormat) => void;
  onKeepMine?: () => Promise<void> | void;
}

export interface EditorSessionContextValue {
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  toggleAutoSave: () => void;
  documentSession: EditorDocumentSession | null;
  setDocumentSession: (session: EditorDocumentSession | null) => void;
}

const DEFAULT_FALLBACK_SESSION: EditorSessionContextValue = {
  autoSaveEnabled: true,
  setAutoSaveEnabled: () => {},
  toggleAutoSave: () => {},
  documentSession: null,
  setDocumentSession: () => {},
};

const EditorSessionContext = createContext<EditorSessionContextValue | null>(null);

export function EditorSessionProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState<boolean>(() =>
    readAutoSavePreference()
  );
  const [documentSession, setDocumentSession] = useState<EditorDocumentSession | null>(null);

  useEffect(() => {
    setAutoSaveEnabledState(readAutoSavePreference());
    return subscribeAutoSavePreference((next) => {
      setAutoSaveEnabledState(next);
    });
  }, []);

  const setAutoSaveEnabled = useCallback((enabled: boolean) => {
    setAutoSaveEnabledState(enabled);
    writeAutoSavePreference(enabled);
  }, []);

  const toggleAutoSave = useCallback(() => {
    setAutoSaveEnabledState((prev) => {
      const next = !prev;
      writeAutoSavePreference(next);
      return next;
    });
  }, []);

  const value = useMemo<EditorSessionContextValue>(
    () => ({
      autoSaveEnabled,
      setAutoSaveEnabled,
      toggleAutoSave,
      documentSession,
      setDocumentSession,
    }),
    [autoSaveEnabled, setAutoSaveEnabled, toggleAutoSave, documentSession]
  );

  return (
    <EditorSessionContext.Provider value={value}>
      {children}
    </EditorSessionContext.Provider>
  );
}

/**
 * Reads active editor document & auto-save session state.
 * Falls back safely when rendered outside root provider (e.g. isolated unit tests).
 */
export function useEditorSession(): EditorSessionContextValue {
  const ctx = useContext(EditorSessionContext);
  return ctx ?? DEFAULT_FALLBACK_SESSION;
}
