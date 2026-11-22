'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  readAutoSavePreference,
  subscribeAutoSavePreference,
  writeAutoSavePreference,
} from '@/lib/editor/autosave-preferences';
import type { DocumentSaveState } from '@/lib/editor/save-status';
import type { SaveState } from '@/lib/documents/autosave-controller';
import type { ExportFormat } from '@/features/editor';
import type { PageLanguage } from '@/lib/page-labels';
import type { SourceInfo } from '@/lib/documents/document-api';
import type { Analysis } from '@/lib/documents/word-source';

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
  /** Opens the version history page of the paper (only papers the server knows have one). */
  onOpenHistory?: () => void;
  /** View-only access: the title bar hides every editing control. */
  readOnly?: boolean;
}

/** What the title bar shows while a journal's template is open (name, code, colour, and which version is on screen). */
export interface JournalBarState {
  names: { vi: string; en: string };
  short: string;
  color: string;
  /** A past version is on screen: its number, and whether it is the one in force. */
  viewing?: { version: number; isCurrent: boolean } | null;
  /** Opens the version history; absent for a journal that has no history yet. */
  onOpenHistory?: () => void;
}

/** The rules a paper is laid out under, for the title bar's "which rules apply" dialog. */
export interface PaperProfileInfo {
  paperId: string;
  journalKey: string;
  journalName: { vi: string; en: string };
  journalShort: string;
  journalColor: string;
  articleType?: { vi: string; en: string } | null;
  pin?: { base?: number; journal?: number; articleType?: number };
  latestPin?: { base?: number; journal?: number; articleType?: number };
  isOutdated: boolean;
  isUpgrading: boolean;
  onUpgrade: () => void;
}

/** The Word file the open paper was imported from, and reading it again (the dialog of the title bar's "?"). */
export interface WordSourceState {
  paperId: string;
  loading: boolean;
  /** The stored file, or null when the paper has none (an older paper). */
  info: SourceInfo | null;
  /** Version of the importer now; the file was read with `info.importerVersion`. */
  currentImporterVersion: number;
  busy: 'idle' | 'analyzing' | 'applying' | 'replanning';
  error: string | null;
  /** The comparison waiting for the author's decisions, if any. */
  review: Analysis | null;
  /** Read the stored file again with the current importer. */
  reanalyze: () => void;
  /** Read a new file in place of the stored one (or the first file of an older paper). */
  replaceWith: (file: File) => void;
  /** Take the accepted proposals (ids) into the paper. */
  apply: (accepted: ReadonlySet<string>) => Promise<void>;
  cancelReview: () => void;
  /** Save the stored Word file to the computer. */
  download: () => Promise<void>;
  /** Redo the comparison listing (or not) the places where the paper differs from a file that did not change. */
  showEdits: (on: boolean) => Promise<void>;
}

/** The paper's undo/redo, for the title bar's two buttons. */
export interface EditorHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;
  undo: () => void;
  redo: () => void;
}

/** The title bar on a deleted paper's page in the trash: when it was deleted, how long it stays, and what can be done with it. */
export interface TrashBarState {
  deletedAt: string;
  deletedBy?: string;
  daysLeft: number;
  busy: boolean;
  /** The restore is running (its icon spins). */
  restoring?: boolean;
  /** Absent when the server does not allow the action for this person. */
  onRestore?: () => void;
  onPurge?: () => void;
}

/** The title bar on a paper's history page: the paper's title and the way back to the editor. */
export interface PaperHistoryBarState {
  title: string;
  onBack: () => void;
  /** Keeps the paper under a name; absent for someone who may not change the paper. */
  onSaveVersion?: () => void;
  /** The detailed way of reading a version (tabs like the editor's, with settings) is on. */
  detailed?: boolean;
  onToggleDetailed?: () => void;
}

export type EditorViewMode = 'form' | 'overview';

export interface EditorSessionContextValue {
  autoSaveEnabled: boolean;
  setAutoSaveEnabled: (enabled: boolean) => void;
  toggleAutoSave: () => void;
  documentSession: EditorDocumentSession | null;
  setDocumentSession: (session: EditorDocumentSession | null) => void;
  pdfFocusMode: boolean;
  setPdfFocusMode: (enabled: boolean) => void;
  togglePdfFocusMode: () => void;
  /** Language the PDF preview is laid out in (its closing page is the other language). */
  pdfLanguage: PageLanguage;
  setPdfLanguage: (language: PageLanguage) => void;
  /** The editor shows the form tabs, or the whole paper as one page (the overview). */
  editorView: EditorViewMode;
  setEditorView: (view: EditorViewMode) => void;
  journalBar: JournalBarState | null;
  setJournalBar: (state: JournalBarState | null) => void;
  paperProfile: PaperProfileInfo | null;
  setPaperProfile: (info: PaperProfileInfo | null) => void;
  wordSource: WordSourceState | null;
  setWordSource: (state: WordSourceState | null) => void;
  history: EditorHistoryState | null;
  setHistory: (state: EditorHistoryState | null) => void;
  paperHistoryBar: PaperHistoryBarState | null;
  setPaperHistoryBar: (state: PaperHistoryBarState | null) => void;
  trashBar: TrashBarState | null;
  setTrashBar: (state: TrashBarState | null) => void;
}

const DEFAULT_FALLBACK_SESSION: EditorSessionContextValue = {
  autoSaveEnabled: true,
  setAutoSaveEnabled: () => {},
  toggleAutoSave: () => {},
  documentSession: null,
  setDocumentSession: () => {},
  pdfFocusMode: false,
  setPdfFocusMode: () => {},
  togglePdfFocusMode: () => {},
  pdfLanguage: 'vi',
  setPdfLanguage: () => {},
  editorView: 'form',
  setEditorView: () => {},
  journalBar: null,
  setJournalBar: () => {},
  paperProfile: null,
  setPaperProfile: () => {},
  wordSource: null,
  setWordSource: () => {},
  history: null,
  setHistory: () => {},
  paperHistoryBar: null,
  setPaperHistoryBar: () => {},
  trashBar: null,
  setTrashBar: () => {},
};

const EditorSessionContext = createContext<EditorSessionContextValue | null>(null);

export function EditorSessionProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  // First render = the server's defaults, so the HTML always matches; the stored choices are read right after mount.
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState<boolean>(true);
  const [documentSession, setDocumentSession] = useState<EditorDocumentSession | null>(null);
  const [pdfFocusMode, setPdfFocusModeState] = useState<boolean>(false);
  const [pdfLanguage, setPdfLanguageState] = useState<PageLanguage>('vi');
  const [editorView, setEditorViewState] = useState<EditorViewMode>('form');
  const [journalBar, setJournalBar] = useState<JournalBarState | null>(null);
  const [paperProfile, setPaperProfile] = useState<PaperProfileInfo | null>(null);
  const [wordSource, setWordSource] = useState<WordSourceState | null>(null);
  const [history, setHistory] = useState<EditorHistoryState | null>(null);
  const [paperHistoryBar, setPaperHistoryBar] = useState<PaperHistoryBarState | null>(null);
  const [trashBar, setTrashBar] = useState<TrashBarState | null>(null);

  useEffect(() => {
    try {
      setPdfFocusModeState(localStorage.getItem('structpaper_pdf_interactive_mode') === 'true');
      setPdfLanguageState(localStorage.getItem('structpaper_pdf_language') === 'en' ? 'en' : 'vi');
      // (the view is not restored: a paper always opens in the form, see UnifiedEditorView)
    } catch {
      // storage unavailable: keep the defaults
    }
  }, []);
  const setEditorView = useCallback((view: EditorViewMode) => {
    setEditorViewState(view);
    try {
      localStorage.setItem('structpaper_editor_view', view);
    } catch {
      // ignore
    }
  }, []);
  const setPdfLanguage = useCallback((language: PageLanguage) => {
    setPdfLanguageState(language);
    try {
      localStorage.setItem('structpaper_pdf_language', language);
    } catch {
      // ignore
    }
  }, []);

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

  const setPdfFocusMode = useCallback((enabled: boolean) => {
    setPdfFocusModeState(enabled);
    try {
      localStorage.setItem('structpaper_pdf_interactive_mode', String(enabled));
    } catch {
      // ignore
    }
  }, []);

  const togglePdfFocusMode = useCallback(() => {
    setPdfFocusModeState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('structpaper_pdf_interactive_mode', String(next));
      } catch {
        // ignore
      }
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
      pdfFocusMode,
      setPdfFocusMode,
      togglePdfFocusMode,
      pdfLanguage,
      setPdfLanguage,
      editorView,
      setEditorView,
      journalBar,
      setJournalBar,
      paperProfile,
      setPaperProfile,
      wordSource,
      setWordSource,
      history,
      setHistory,
      paperHistoryBar,
      setPaperHistoryBar,
      trashBar,
      setTrashBar,
    }),
    [autoSaveEnabled, setAutoSaveEnabled, toggleAutoSave, documentSession, pdfFocusMode, setPdfFocusMode, togglePdfFocusMode, pdfLanguage, setPdfLanguage, editorView, setEditorView, journalBar, paperProfile, wordSource, history, paperHistoryBar, trashBar]
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
