'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGoBack, isHistoryPage } from '@/lib/app-history';
import { Home, Layers, Sliders, FileEdit } from 'lucide-react';
import { CompletePaper, PaperSection, LayoutSettings } from '@/types/paper';
import { resolvePaperLayout, journalLayoutOf } from '@/lib/layout/paper-profile';
import { usePaperProfile, usePaperProfileSession, useArticleTypeSync } from '@/features/journals';
import { useEditorHistory } from '../hooks/useEditorHistory';
import { isUuid } from '@/features/papers/components/types';
import { PANEL_ATTR } from '@/lib/history/focus';
import { layoutOverrides } from '@/lib/layout/profile-layout';
import { computeQualityCheck } from '@/lib/validation/quality';
import { getJournalTemplate } from '@/lib/templates';
import { usePaper } from '@/context/PaperContext';
import { sileo, toast } from '@/components/toast';
import { EditorTabKey } from './types';
import { EditorLeftDock } from './EditorLeftDock';
import { ExtractedContentDrawer } from './ExtractedContentDrawer';
import { LayoutSettingsDrawer } from './LayoutSettingsDrawer';
import { EditorTabNav } from './EditorTabNav';
import { MetadataTab } from './MetadataTab';
import { AuthorsTab } from './AuthorsTab';
import { AbstractTab } from './AbstractTab';
import { SectionsTab } from './SectionsTab';
import { ReferencesTab } from './ReferencesTab';
import { CitationTab } from './CitationTab';
import { PreflightQCTab } from './PreflightQCTab';
import { LivePreviewPane } from './LivePreviewPane';
import { ResizableSplitLayout } from './ResizableSplitLayout';
import { generateStandardCitation } from './sections/utils';
import { assignEquationNumbers, renumberPaper } from '@/lib/validation/numbering';
import { validateForExport, type ValidationReport } from '@/lib/validation/validators';
import { type ExportFormat } from './DocumentMenuBar';
import { EditorDocumentMenuBarSlot } from './EditorDocumentMenuBarSlot';
import { notifyManualSaveOutcome } from '@/lib/editor/save-feedback';
import { OpenDocumentDialog, type OpenListItem } from './OpenDocumentDialog';
import { ExportGateModal } from './ValidationModals';
import {
  CreatePaperModal,
  useEditorQuickEdit,
  PaperQuickEditModal,
  WORKFLOW_STATUS_CONFIG,
  normalizeWorkflowStatus,
  type WorkflowStatus,
} from '@/features/papers';
import { useDocumentAutosave } from '../hooks/useDocumentAutosave';
import { publishPdfPreview } from '@/lib/editor/pdf-preview-sync';
import { autosaveStatusFromSaveState } from '@/lib/editor/autosave-status';
import {
  useEditorCompilation,
  useEditorExport,
  useEditorShortcuts,
  useSyncEditorSession,
  useUnsavedChangesWarning,
  useShowPaperOnSwitch,
  usePreviewLinks,
  useHydrateDisplayName,
  EditorTabStateProvider,
  useCreateEditorTabStateStore,
} from '../hooks';
import { useEditorSession } from '@/context/EditorSessionContext';
import { useWordSourceSession } from '@/features/import-merge/hooks/useWordSourceSession';
import { useStorage } from '@/context/StorageContext';
import { usePaperStorage } from '../hooks/usePaperStorage';
import { ActionConfirmModal } from '@/components/modals/ActionConfirmModal';
import { usePlatform } from '@structpaper/platform';

interface UnifiedEditorViewProps {
  paper: CompletePaper;
  onUpdatePaper: (updated: CompletePaper) => void;
  onGoToPreview?: () => void;
}

export const UnifiedEditorView: React.FC<UnifiedEditorViewProps> = ({ paper, onUpdatePaper }) => {
  const { currentJournal, setCurrentJournal, setPaper } = usePaper();
  const router = useRouter();
  const goBack = useGoBack();
  const storage = useStorage();
  const { savePaper, loadPaper } = usePaperStorage();
  const [formData, setFormData] = useState<CompletePaper>(() => JSON.parse(JSON.stringify(paper)));
  const currentPaperId = useRef(paper.id);
  currentPaperId.current = paper.id;
  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isExitWarningOpen, setIsExitWarningOpen] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [isExtractedDrawerOpen, setIsExtractedDrawerOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<EditorTabKey>('metadata');
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');
  const [exportGate, setExportGate] = useState<{ format: ExportFormat; report: ValidationReport } | null>(null);
  const [isOpenDialog, setIsOpenDialog] = useState(false);
  const [isNewDialog, setIsNewDialog] = useState(false);
  const { store: tabStateStore, markTabPendingReset } = useCreateEditorTabStateStore(formData.id);
  const handleNavigateFromPreflight = useCallback(
    (tab: EditorTabKey) => {
      markTabPendingReset(tab);
      setActiveSubTab(tab);
    },
    [markTabPendingReset]
  );

  const {
    isQuickEditOpen,
    quickEditRecord,
    handleOpenQuickEdit,
    handleCloseQuickEdit,
    handleSaveQuickEdit,
  } = useEditorQuickEdit(formData, setFormData, onUpdatePaper);

  const handleHydrateDisplayName = useCallback(
    (paperId: string, hydratedName: string) => {
      setFormData((prev) =>
        prev.id === paperId && !prev.displayName?.trim()
          ? { ...prev, displayName: hydratedName }
          : prev
      );
    },
    []
  );
  useHydrateDisplayName(formData.id, formData.displayName, handleHydrateDisplayName);

  const { autoSaveEnabled, pdfLanguage, setPdfLanguage } = useEditorSession();
  // The title bar's language picker follows the paper: opening a paper selects the language it was written in (found when its Word
  // file was imported), and a later choice in the picker is kept with the paper. Papers with no stored language are left untouched.
  const langPaperRef = useRef<string | null>(null);
  const langSeenRef = useRef<string>(pdfLanguage);
  useEffect(() => {
    if (langPaperRef.current !== paper.id) {
      langPaperRef.current = paper.id;
      const stored = paper.metadata?.primaryLanguage;
      if (stored && stored !== pdfLanguage) {
        langSeenRef.current = stored;
        setPdfLanguage(stored);
        return;
      }
    }
    if (langSeenRef.current === pdfLanguage) return;
    langSeenRef.current = pdfLanguage;
    setFormData((prev) => (prev.metadata?.primaryLanguage === pdfLanguage ? prev : { ...prev, metadata: { ...prev.metadata, primaryLanguage: pdfLanguage } }));
    setIsDirty(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paper.id, pdfLanguage]);
  // Recompiling saves the paper first. That save goes through the autosave controller (one save at a time, one revision number), not a
  // second parallel save: two saves sent with the same revision made the server answer "your version is older".
  const saveBeforeCompileRef = useRef<((p: CompletePaper) => Promise<unknown>) | null>(null);

  const { compiledPdfUrl, isCompilingPdf, compileStartedAt, lastOutcomeRef, compileStats, compileErrorInfo, setCompileErrorInfo, compileLatexToPdf, handleRecompile, hasChangesSinceCompile } =
    useEditorCompilation({
      paper,
      formData,
      onUpdatePaper,
      onSavePaper: (p) => (saveBeforeCompileRef.current ? saveBeforeCompileRef.current(p) : savePaper(p)) as Promise<boolean | void>,
      setIsDirty,
    });
  // the rules this paper is pinned to; when they lay the page out differently from the latest ones, typeset again
  const profile = usePaperProfile(formData, { onLayoutChange: () => void compileLatexToPdf() });
  // the article type the author picks moves the paper to that type's rules on the server
  useArticleTypeSync(formData, setFormData);
  // newer rules: a toast that stays until the author acts, and the title bar's "which rules apply" dialog
  usePaperProfileSession(formData, {
    isOutdated: profile.isOutdated,
    latestPin: profile.latestPin,
    onUpgraded: (pin, version) => setFormData((prev) => ({ ...prev, profilePin: pin, version })),
  });
  // the Word file this paper was imported from: read again (on request) and compared before anything changes
  useWordSourceSession(formData, setFormData, () => setIsDirty(true));
  /** Export in progress (covers the save + compile phase before the download starts). */
  const [pendingExport, setPendingExport] = useState<ExportFormat | null>(null);

  const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const remoteSync = !isTestEnv && process.env.NEXT_PUBLIC_DISABLE_SYNC !== '1';

  // Auto-save: in Server-Only mode (ENABLE_LOCAL_STORAGE: false), persistence goes directly to the API
  // via saveLocal, so background DocumentSync is disabled to prevent duplicate PATCH requests and version conflicts.
  const { state: saveState, savedAt, saveNow, flush, resolveKeepMine, sync } = useDocumentAutosave({
    paper: formData,
    documentId: paper.id,
    remote: storage.isLocalAvailable ? remoteSync : false,
    isLocalAvailable: storage.isLocalAvailable,
    enabled: autoSaveEnabled, // the title-bar switch: off = nothing is saved until "Lưu"/Ctrl+S
    saveLocal: async (p) => {
      // A save that finishes after the user switched to another document must only persist its own
      // document: pushing it into the shared context would swap the new document back to the old one.
      const ok = await savePaper(p);
      if (ok && p.version !== undefined) {
        setFormData((prev) => (prev.id === p.id ? { ...prev, version: p.version, currentServerRev: p.version } : prev));
      }
      if (p.id === currentPaperId.current) onUpdatePaper(p);
      return ok;
    },
  });

  // The dock / title bar speak the simple idle|saving|saved|error vocabulary.
  saveBeforeCompileRef.current = (p) => saveNow(p);
  const autosaveStatus = autosaveStatusFromSaveState(saveState);

  useEffect(() => {
    if (saveState === 'saved' || saveState === 'saved-local') setIsDirty(false);
    else if (saveState === 'dirty') setIsDirty(true);
  }, [saveState]);

  // A compiled PDF becomes the copy readers see (best-effort and silent; the download already happened).
  const handleExported = useCallback(
    (format: ExportFormat, blob: Blob) => {
      if (!remoteSync || format !== 'pdf') return;
      void publishPdfPreview(formData.id, blob);
    },
    [formData.id, remoteSync]
  );

  const { isExportingDocx, isExportingZip, isExportingPdf, isExportingXml, handleDownloadDocx, handleDownloadZip, handleDownloadPdf, handleDownloadXml, handleDownloadXmlPackage } =
    useEditorExport({ formData, compiledPdfUrl, compileLatexToPdf, onExported: handleExported });

  const handleSave = useCallback(async (): Promise<boolean> => {
    onUpdatePaper(formData);
    const saveStateOutcome = await saveNow(formData);
    if (!notifyManualSaveOutcome(saveStateOutcome, storage.isLocalAvailable)) return false;
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    return true;
  }, [formData, onUpdatePaper, saveNow, storage.isLocalAvailable]);

  // ---- GATE 2: validate before producing the deliverable ----
  const runExport = useCallback(
    async (format: ExportFormat) => {
      if (format === 'docx') return handleDownloadDocx();
      if (format === 'xml') return handleDownloadXml();
      toast.loading('Đang xuất PDF…', 'Đang dàn trang bằng XeLaTeX, thường mất 15–40 giây.', { id: 'export-pdf' });
      // Retry once when the compile was only superseded (e.g. by the automatic preview compile).
      let url = await compileLatexToPdf(formData);
      if (!url && lastOutcomeRef.current === 'cancelled') url = await compileLatexToPdf(formData);
      if (!url) {
        toast.error('Xuất PDF thất bại', 'Xem chi tiết lỗi biên dịch ở khung xem trước.', { id: 'export-pdf' });
        setExportGate({ format, report: validateForExport(formData, { format, pdfCompiled: false }) });
        return;
      }
      toast.dismiss('export-pdf');
      return handleDownloadPdf(url);
    },
    [formData, handleDownloadDocx, handleDownloadXml, handleDownloadPdf, compileLatexToPdf, lastOutcomeRef]
  );

  const requestExport = useCallback(
    async (format: ExportFormat) => {
      if (pendingExport) return;
      setPendingExport(format);
      try {
        await flush();
        const report = validateForExport(formData, { format });
        if (report.issues.length === 0) {
          await runExport(format);
          return;
        }
        setExportGate({ format, report });
      } finally {
        setPendingExport(null);
      }
    },
    [flush, formData, runExport, pendingExport]
  );

  const handleGateAutoFix = useCallback(() => {
    if (!exportGate) return;
    const fixed = renumberPaper({ ...formData, sections: assignEquationNumbers(formData.sections) });
    setFormData(fixed);
    setIsDirty(true);
    setExportGate({ format: exportGate.format, report: validateForExport(fixed, { format: exportGate.format }) });
  }, [exportGate, formData]);

  const handleGateFix = useCallback((issue: { fixTab?: string }) => {
    if (issue.fixTab) setActiveSubTab(issue.fixTab as EditorTabKey);
    setExportGate(null);
  }, []);

  const handleConfirmExport = useCallback(async () => {
    if (!exportGate) return;
    const { format } = exportGate;
    setExportGate(null);
    setPendingExport(format);
    try {
      await runExport(format);
    } finally {
      setPendingExport(null);
    }
  }, [exportGate, runExport]);

  // ---- Open: pick a previously saved document (local + server) ----
  const handleOpenItem = useCallback(
    async (item: OpenListItem) => {
      await flush();
      let loaded = await loadPaper(item.id);
      if (!loaded && sync) {
        try {
          loaded = await sync.pull(item.id);
          await savePaper(loaded);
        } catch {
          loaded = null;
        }
      }
      if (!loaded) {
        sileo.error({ title: 'Không mở được tài liệu', description: 'Không tìm thấy nội dung tài liệu này.' });
        return;
      }
      setPaper(loaded);
      if (loaded.metadata?.journalId) setCurrentJournal(loaded.metadata.journalId);
      setIsOpenDialog(false);
      router.replace(`/papers/${encodeURIComponent(loaded.id)}`);
    },
    [flush, loadPaper, sync, savePaper, setPaper, setCurrentJournal, router]
  );

  const documentName = ((formData as any).displayName as string | undefined) || formData.metadata.title || 'Bản thảo bài báo';
  const handleRename = useCallback((name: string) => {
    setFormData((p) => ({ ...p, displayName: name } as CompletePaper));
    setIsDirty(true);
  }, []);
  const exporting = { docx: isExportingDocx || pendingExport === 'docx', pdf: isExportingPdf || pendingExport === 'pdf', xml: isExportingXml || pendingExport === 'xml' };

  useSyncEditorSession({
    paperId: formData.id, displayName: formData.displayName, autosaveStatus, isDirty, saveSuccess,
    rawSaveState: saveState, savedAt, exporting, onManualSave: async () => { await handleSave(); },
    onRename: handleRename, onNew: () => setIsNewDialog(true), onOpen: () => setIsOpenDialog(true), onExport: requestExport, onKeepMine: resolveKeepMine,
    // a paper the server knows has a history; what was just typed is saved first so the history page shows it
    onOpenHistory: isUuid(formData.id)
      ? async () => {
          await handleSave();
          router.push(`/papers/${formData.id}/history`);
        }
      : undefined,
  });

  // Back Navigation Guard handlers
  const handleRequestBack = useCallback(() => {
    if (isDirty) {
      setIsExitWarningOpen(true);
    } else {
      goBack('/papers', isHistoryPage);
    }
  }, [isDirty, goBack]);

  const handleConfirmSaveAndExit = useCallback(async () => {
    if (!(await handleSave())) return;
    setIsExitWarningOpen(false);
    goBack('/papers', isHistoryPage);
  }, [handleSave, goBack]);

  const handleDiscardAndExit = useCallback(() => {
    setIsExitWarningOpen(false);
    goBack('/papers', isHistoryPage);
  }, [goBack]);

  // Handler for updating paper workflow status
  const handleUpdateWorkflowStatus = useCallback(
    async (newStatus: WorkflowStatus) => {
      const prevFormData = formData;
      const normalizedStatus = normalizeWorkflowStatus(newStatus);
      const updated: CompletePaper = {
        ...formData,
        status: normalizedStatus as any,
        workflowStatus: normalizedStatus,
      };
      setFormData(updated);
      setIsDirty(true);
      onUpdatePaper(updated);

      try {
        const outcome = await saveNow(updated, { awaitSync: true });
        if (outcome === 'saved' || outcome === 'saved-local') {
          const label = WORKFLOW_STATUS_CONFIG[normalizedStatus]?.label || normalizedStatus;
          sileo.success({
            title: 'Đã cập nhật trạng thái',
            description: `Bản thảo đã được chuyển sang trạng thái "${label}"`,
          });
        } else {
          setFormData(prevFormData);
          onUpdatePaper(prevFormData);
        }
      } catch {
        // Rollback state if server rejected
        setFormData(prevFormData);
        onUpdatePaper(prevFormData);
      }
    },
    [formData, onUpdatePaper, saveNow]
  );

  let isDesktop = false;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const platform = usePlatform();
    isDesktop = platform.capabilities.kind === 'desktop';
  } catch {
    isDesktop = false;
  }

  const handleOpenFullscreenPdf = useCallback(() => {
    if (isDesktop) {
      router.push(`/preview?id=${formData.id}`);
    } else if (compiledPdfUrl) {
      window.open(compiledPdfUrl, '_blank', 'noreferrer');
    }
  }, [isDesktop, formData.id, router, compiledPdfUrl]);

  useEditorShortcuts({ onSave: handleSave });
  useEffect(() => {
    if (isDirty) {
      setSaveSuccess(false);
    }
  }, [isDirty]);

  useUnsavedChangesWarning(isDirty);
  useShowPaperOnSwitch(paper, setFormData, () => setIsDirty(false));
  useEffect(() => {
    if (paper.displayName?.trim() && paper.id === formData.id && !formData.displayName?.trim()) {
      setFormData((prev) => ({ ...prev, displayName: paper.displayName }));
    }
  }, [paper.id, paper.displayName, formData.id, formData.displayName]);
  const deferredFormData = useDeferredValue(formData);
  const preflight = useMemo(
    () => computeQualityCheck(deferredFormData),
    [deferredFormData]
  );

  const { focusRequest, paneProps } = usePreviewLinks({ formData, setFormData, setIsDirty, setActiveSubTab, recompile: handleRecompile });

  // one undo/redo for the whole paper: Ctrl+Z puts the content back and the cursor in the field it was made in
  const [historyFocus, setHistoryFocus] = useState<{ id: string; n: number; edit: boolean } | null>(null);
  useEffect(() => setHistoryFocus(null), [focusRequest]);
  const showSection = useCallback((id: string, edit: boolean) => setHistoryFocus((r) => ({ id, edit, n: (r?.n ?? 0) + 1 })), []);
  const editorHistory = useEditorHistory({ formData, setFormData, setIsDirty, setActiveTab: setActiveSubTab, showSection });
  const { setHistory } = useEditorSession();
  useEffect(() => {
    setHistory({
      canUndo: editorHistory.canUndo,
      canRedo: editorHistory.canRedo,
      undoLabel: editorHistory.undoLabel,
      redoLabel: editorHistory.redoLabel,
      undo: editorHistory.undo,
      redo: editorHistory.redo,
    });
  }, [editorHistory.canUndo, editorHistory.canRedo, editorHistory.undoLabel, editorHistory.redoLabel, editorHistory.undo, editorHistory.redo, setHistory]);
  useEffect(() => () => setHistory(null), [setHistory]);

  const handleSectionsChange = useCallback((sections: PaperSection[]) => {
    setFormData((prev) => ({ ...prev, sections: assignEquationNumbers(sections) }));
    setIsDirty(true);
  }, []);

  const handleApplyLayoutSettings = (newSettings: LayoutSettings, newJournalId?: string) => {
    const journalIdToUse = newJournalId || formData.metadata.journalId || currentJournal;
    const tmpl = getJournalTemplate(journalIdToUse);
    // the paper stores only what differs from its journal's rules; another journal means another set of rules
    const journalChanged = journalIdToUse !== (formData.metadata.journalId || currentJournal);
    const target: CompletePaper = {
      ...formData,
      metadata: { ...formData.metadata, journalId: journalIdToUse, journalName: tmpl.name, journalAbbv: tmpl.shortName },
      ...(journalChanged ? { profilePin: undefined, articleTypeCode: undefined } : {}),
    };
    const updated: CompletePaper = { ...target, layoutSettings: layoutOverrides(journalLayoutOf(target), newSettings) };
    setFormData(updated);
    setIsDirty(true);
    onUpdatePaper(updated);
    if (newJournalId && newJournalId !== currentJournal) setCurrentJournal(newJournalId);
    compileLatexToPdf(updated);
  };

  const citationSection = formData.sections.find((s) => s.type === 'citation');
  const citationText = citationSection?.content ?? (formData.metadata ? generateStandardCitation(formData.metadata) : '');

  const handleUpdateCitation = (updatedText: string) => {
    const list = [...formData.sections];
    const existingIdx = list.findIndex((s) => s.type === 'citation');
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], content: updatedText };
    } else {
      list.unshift({ id: `sec_citation_${Date.now()}`, type: 'citation', title: 'Trích dẫn bài báo này', content: updatedText });
    }
    setFormData((prev) => ({ ...prev, sections: list }));
    setIsDirty(true);
  };

  const leftEditorContent = (
    <div className="h-full flex flex-col min-h-0 min-w-0 w-full overflow-hidden space-y-2">
      <div className="flex-shrink-0">
        <EditorTabNav
          activeTab={activeSubTab}
          onTabChange={setActiveSubTab}
          authorsCount={formData.metadata.authors.length}
          sectionsCount={formData.sections.filter((s) => s.type !== 'citation').length}
          referencesCount={formData.references.length}
          preflight={preflight}
        />
      </div>
      <div className="flex-1 min-h-0 min-w-0 h-full w-full overflow-hidden" {...{ [PANEL_ATTR]: activeSubTab }}>
        {activeSubTab === 'metadata' && (
          <MetadataTab
            metadata={formData.metadata}
            showAbstractAndKeywords={false}
            onChange={(m) => {
              setFormData((p) => ({ ...p, metadata: m }));
              setIsDirty(true);
            }}
          />
        )}
        {activeSubTab === 'authors' && <AuthorsTab metadata={formData.metadata} onChange={(m) => { setFormData((p) => ({ ...p, metadata: m })); setIsDirty(true); }} />}
        {activeSubTab === 'abstract' && <AbstractTab metadata={formData.metadata} onChange={(m) => { setFormData((p) => ({ ...p, metadata: m })); setIsDirty(true); }} />}
        {activeSubTab === 'sections' && (
          <SectionsTab
            sections={formData.sections}
            onChange={handleSectionsChange}
            metadata={formData.metadata}
            references={formData.references} focusRequest={historyFocus ?? focusRequest}
          />
        )}
        {activeSubTab === 'refs' && <ReferencesTab references={formData.references} onChange={(r) => { setFormData((p) => ({ ...p, references: r })); setIsDirty(true); }} />}
        {activeSubTab === 'citation' && <CitationTab citationText={citationText} onChange={handleUpdateCitation} metadata={formData.metadata} />}
        {activeSubTab === 'preflight' && <PreflightQCTab preflight={preflight} onNavigateTab={handleNavigateFromPreflight} />}
      </div>
    </div>
  );

  const rightPreviewContent = (
    <div className="h-full flex flex-col min-h-0">
      <LivePreviewPane
        paper={formData}
        compiledPdfUrl={compiledPdfUrl}
        isCompilingPdf={isCompilingPdf}
        compileStats={compileStats}
        compileErrorInfo={compileErrorInfo}
        onRecompile={() => handleRecompile(formData)}
        onClearError={() => setCompileErrorInfo(null)}
        compileStartedAt={compileStartedAt}
        busyLabel={pendingExport === 'pdf' ? 'Đang xuất PDF…' : undefined}
        {...paneProps}
      />
    </div>
  );

  return (
    <EditorTabStateProvider paperId={formData.id} store={tabStateStore}>
      <div className="h-full w-full flex flex-row p-3 min-h-0 gap-2 sm:gap-3 overflow-hidden">
      <EditorLeftDock
        homeHref="/papers"
        paperId={formData.id}
        onBackClick={handleRequestBack}
        autosaveStatus={autosaveStatus}
        workflowStatus={normalizeWorkflowStatus((formData as any).workflowStatus || formData.status)}
        onUpdateWorkflowStatus={handleUpdateWorkflowStatus}
        onOpenFullscreenPdf={handleOpenFullscreenPdf}
        onOpenQuickEdit={handleOpenQuickEdit}
        onOpenExtractedDrawer={() => setIsExtractedDrawerOpen(true)}
        onOpenLayoutSettings={() => setIsSettingsDrawerOpen(true)}
        onSave={handleSave}
        saveSuccess={saveSuccess}
        isDirty={isDirty}
        onRecompile={() => handleRecompile(formData)}
        recompileDisabled={!hasChangesSinceCompile}
        isCompiling={isCompilingPdf}
        onDownloadDocx={() => requestExport('docx')}
        isExportingDocx={isExportingDocx || pendingExport === 'docx'}
        onDownloadZip={handleDownloadZip}
        onDownloadXml={handleDownloadXml}
        onDownloadXmlPackage={handleDownloadXmlPackage}
        isExportingXml={isExportingXml}
        isExportingZip={isExportingZip}
        onDownloadPdf={() => requestExport('pdf')}
        isExportingPdf={isExportingPdf || pendingExport === 'pdf'}
        compiledPdfUrl={compiledPdfUrl}
        qcScore={preflight.score}
        hasErrors={preflight.issues?.some((i) => i.severity === 'error')}
        hasWarnings={preflight.issues?.some((i) => i.severity === 'warning')}
        errorCount={preflight.issues?.filter((i) => i.severity === 'error').length || 0}
        warningCount={preflight.issues?.filter((i) => i.severity === 'warning').length || 0}
        onOpenQCTab={() => setActiveSubTab('preflight')}
      />

      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        <EditorDocumentMenuBarSlot
          name={documentName}
          onRename={handleRename}
          saveState={saveState}
          savedAt={savedAt}
          onNew={() => setIsNewDialog(true)}
          onOpen={() => setIsOpenDialog(true)}
          onSave={handleSave}
          onExport={requestExport}
          onKeepMine={resolveKeepMine}
          exporting={exporting}
        />
        <div className="flex sm:hidden flex-shrink-0 items-center justify-between p-1.5 mb-1.5 bg-white/70 backdrop-blur-md rounded-2xl border border-zinc-200">
          <button
            type="button"
            onClick={handleRequestBack}
            className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 font-bold text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
            title="Quay lại danh sách bài báo"
          >
            <Home className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1 bg-zinc-200/70 p-0.5 rounded-xl">
            <button type="button" onClick={() => setMobilePane('editor')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${mobilePane === 'editor' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600'}`}>Soạn thảo</button>
            <button type="button" onClick={() => setMobilePane('preview')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${mobilePane === 'preview' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600'}`}>PDF</button>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={handleOpenQuickEdit} className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 shadow-2xs" title="Sửa thông tin bài báo"><FileEdit className="w-4 h-4" /></button>
            <button type="button" onClick={() => setIsExtractedDrawerOpen(true)} className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 shadow-2xs" title="Nội dung trích xuất"><Layers className="w-4 h-4" /></button>
            <button type="button" onClick={() => setIsSettingsDrawerOpen(true)} className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 shadow-2xs" title="Cài đặt dàn trang"><Sliders className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="hidden sm:flex flex-1 min-h-0 h-full w-full overflow-hidden">
          <ResizableSplitLayout className="h-full" leftContent={leftEditorContent} rightContent={rightPreviewContent} defaultSplit={50} minPercent={28} maxPercent={72} />
        </div>

        <div className="block sm:hidden flex-1 min-h-0 overflow-y-auto">
          {mobilePane === 'editor' ? leftEditorContent : rightPreviewContent}
        </div>
      </div>

      <ExtractedContentDrawer isOpen={isExtractedDrawerOpen} onClose={() => setIsExtractedDrawerOpen(false)} paper={formData} />
      <LayoutSettingsDrawer isOpen={isSettingsDrawerOpen} onClose={() => setIsSettingsDrawerOpen(false)} settings={resolvePaperLayout(formData)} journalId={formData.metadata.journalId || currentJournal} onApplySettings={handleApplyLayoutSettings} isCompiling={isCompilingPdf} />
      <OpenDocumentDialog isOpen={isOpenDialog} onClose={() => setIsOpenDialog(false)} onOpen={handleOpenItem} />
      <ExportGateModal
        isOpen={exportGate !== null}
        report={exportGate?.report ?? null}
        format={exportGate?.format ?? 'docx'}
        onClose={() => setExportGate(null)}
        onAutoFix={handleGateAutoFix}
        onFix={handleGateFix}
        onExport={handleConfirmExport}
      />
      <CreatePaperModal isOpen={isNewDialog} onClose={() => setIsNewDialog(false)} />
      <PaperQuickEditModal
        paper={quickEditRecord}
        isOpen={isQuickEditOpen}
        onClose={handleCloseQuickEdit}
        onSave={handleSaveQuickEdit}
      />

      {/* Unsaved Changes Confirmation Modal */}
      <ActionConfirmModal
        isOpen={isExitWarningOpen}
        onClose={() => setIsExitWarningOpen(false)}
        onConfirm={handleConfirmSaveAndExit}
        secondaryAction={{
          label: 'Rời đi không lưu',
          onClick: handleDiscardAndExit,
          testId: 'editor-discard-and-exit-btn',
        }}
        variant="warning"
        title="Thay đổi chưa được lưu"
        description="Bạn có chỉnh sửa chưa lưu trong bản thảo bài báo. Bạn có muốn lưu các thay đổi này trước khi rời khỏi trang soạn thảo không?"
        confirmLabel="Lưu & Thoát"
        cancelLabel="Ở lại"
        testId="editor-exit-confirm-modal"
        confirmTestId="editor-save-and-exit-btn"
      />
      </div>
    </EditorTabStateProvider>
  );
};
