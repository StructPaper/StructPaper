'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useEditorSession } from '@/context/EditorSessionContext';
import type { AutosaveStatus } from './useEditorAutoSave';
import type { SaveState } from '@/lib/documents/autosave-controller';
import type { ExportFormat } from '@/components/documents/DocumentMenuBar';
import {
  resolveDocumentDisplayTitle,
  resolveDocumentSaveState,
} from '@/lib/editor/save-status';

export interface UseSyncEditorSessionOptions {
  paperId?: string;
  displayName?: string;
  autosaveStatus: AutosaveStatus;
  isDirty: boolean;
  saveSuccess: boolean;
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

/**
 * Synchronizes the active manuscript's display name, save state, and document actions
 * with EditorSessionContext so top-level chrome (DesktopTitleBar) stays decoupled.
 */
export function useSyncEditorSession({
  paperId,
  displayName,
  autosaveStatus,
  isDirty,
  saveSuccess,
  rawSaveState,
  savedAt,
  exporting,
  onManualSave,
  onRename,
  onNew,
  onOpen,
  onExport,
  onKeepMine,
}: UseSyncEditorSessionOptions): void {
  const { setDocumentSession } = useEditorSession();

  const manualSaveRef = useRef(onManualSave);
  manualSaveRef.current = onManualSave;
  const renameRef = useRef(onRename);
  renameRef.current = onRename;
  const newRef = useRef(onNew);
  newRef.current = onNew;
  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const exportRef = useRef(onExport);
  exportRef.current = onExport;
  const keepMineRef = useRef(onKeepMine);
  keepMineRef.current = onKeepMine;

  const triggerManualSave = useCallback(async () => {
    await manualSaveRef.current?.();
  }, []);
  const triggerRename = useCallback((name: string) => {
    renameRef.current?.(name);
  }, []);
  const triggerNew = useCallback(() => {
    newRef.current?.();
  }, []);
  const triggerOpen = useCallback(() => {
    openRef.current?.();
  }, []);
  const triggerExport = useCallback((format: ExportFormat) => {
    exportRef.current?.(format);
  }, []);
  const triggerKeepMine = useCallback(async () => {
    await keepMineRef.current?.();
  }, []);

  const resolvedTitle = resolveDocumentDisplayTitle(displayName);
  const saveState = resolveDocumentSaveState({
    autosaveStatus,
    isDirty,
    saveSuccess,
  });

  const hasExporting = Boolean(exporting);
  const exportingDocx = Boolean(exporting?.docx);
  const exportingPdf = Boolean(exporting?.pdf);
  const exportingXml = Boolean(exporting?.xml);
  const normalizedExporting = useMemo(
    () => (hasExporting ? { docx: exportingDocx, pdf: exportingPdf, xml: exportingXml } : undefined),
    [hasExporting, exportingDocx, exportingPdf, exportingXml]
  );

  const hasManualSave = Boolean(onManualSave);
  const hasRename = Boolean(onRename);
  const hasNew = Boolean(onNew);
  const hasOpen = Boolean(onOpen);
  const hasExport = Boolean(onExport);
  const hasKeepMine = Boolean(onKeepMine);

  useEffect(() => {
    setDocumentSession({
      paperId,
      title: resolvedTitle,
      saveState,
      rawSaveState,
      savedAt,
      exporting: normalizedExporting,
      onManualSave: hasManualSave ? triggerManualSave : undefined,
      onRename: hasRename ? triggerRename : undefined,
      onNew: hasNew ? triggerNew : undefined,
      onOpen: hasOpen ? triggerOpen : undefined,
      onExport: hasExport ? triggerExport : undefined,
      onKeepMine: hasKeepMine ? triggerKeepMine : undefined,
    });
  }, [
    paperId,
    resolvedTitle,
    saveState,
    rawSaveState,
    savedAt,
    normalizedExporting,
    hasManualSave,
    hasRename,
    hasNew,
    hasOpen,
    hasExport,
    hasKeepMine,
    triggerManualSave,
    triggerRename,
    triggerNew,
    triggerOpen,
    triggerExport,
    triggerKeepMine,
    setDocumentSession,
  ]);

  useEffect(() => {
    return () => {
      setDocumentSession(null);
    };
  }, [setDocumentSession]);
}
