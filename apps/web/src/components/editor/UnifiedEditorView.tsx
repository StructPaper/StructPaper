'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, Layers, Sliders, FileEdit } from 'lucide-react';
import { CompletePaper, PaperSection, LayoutSettings, DEFAULT_LAYOUT_SETTINGS } from '@/types/paper';
import { computePreflightCheck } from '@/lib/docx-extractor';
import { JOURNAL_TEMPLATES } from '@/lib/templates';
import { usePaper } from '@/context/PaperContext';
import { sileo, toast } from '@/components/DynamicIslandToast';
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
import { type ExportFormat } from '@/components/documents/DocumentMenuBar';
import { EditorDocumentMenuBarSlot } from '@/components/documents/EditorDocumentMenuBarSlot';
import { notifyManualSaveOutcome } from '@/lib/editor/save-feedback';
import { OpenDocumentDialog, type OpenListItem } from '@/components/documents/OpenDocumentDialog';
import { ExportGateModal } from '@/components/documents/ValidationModals';
import { CreatePaperModal } from '@/components/modals/CreatePaperModal';
import { useDocumentAutosave } from '@/hooks/useDocumentAutosave';
import { DocumentApi } from '@/lib/documents/document-api';
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
} from './hooks';
import { useEditorSession } from '@/context/EditorSessionContext';
import { usePaperStorage, useEditorQuickEdit } from '@/hooks';
import { PaperQuickEditModal } from '@/components/papers';
import { ActionConfirmModal } from '@/components/modals/ActionConfirmModal';
import { usePlatform } from '@structpaper/platform';
import {
  WORKFLOW_STATUS_CONFIG,
  type WorkflowStatus,
} from '@/components/papers/types';

interface UnifiedEditorViewProps {
  paper: CompletePaper;
  onUpdatePaper: (updated: CompletePaper) => void;
  onGoToPreview?: () => void;
}

export const UnifiedEditorView: React.FC<UnifiedEditorViewProps> = ({ paper, onUpdatePaper }) => {
  const { currentJournal, setCurrentJournal, setPaper } = usePaper();
  const router = useRouter();
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

  const { autoSaveEnabled } = useEditorSession();

  const { compiledPdfUrl, isCompilingPdf, compileStartedAt, lastOutcomeRef, compileStats, compileErrorInfo, setCompileErrorInfo, compileLatexToPdf, handleRecompile } =
    useEditorCompilation({
      paper,
      formData,
      onUpdatePaper,
      onSavePaper: savePaper,
      setIsDirty,
    });
  /** Export in progress (covers the save + compile phase before the download starts). */
  const [pendingExport, setPendingExport] = useState<ExportFormat | null>(null);

  const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const remoteSync = !isTestEnv && process.env.NEXT_PUBLIC_DISABLE_SYNC !== '1';

  // Auto-save: every edit is persisted locally (IndexedDB) and pushed to the backend (DB + MinIO).
  const { state: saveState, savedAt, saveNow, flush, resolveKeepMine, sync } = useDocumentAutosave({
    paper: formData,
    documentId: paper.id,
    remote: remoteSync,
    enabled: autoSaveEnabled, // the title-bar switch: off = nothing is saved until "Lưu"/Ctrl+S
    saveLocal: async (p) => {
      // A save that finishes after the user switched to another document must only persist its own
      // document: pushing it into the shared context would swap the new document back to the old one.
      if (p.id === currentPaperId.current) onUpdatePaper(p);
      return savePaper(p);
    },
  });

  // The dock / title bar speak the simple idle|saving|saved|error vocabulary.
  const autosaveStatus = autosaveStatusFromSaveState(saveState);

  useEffect(() => {
    if (saveState === 'saved' || saveState === 'saved-local') setIsDirty(false);
    else if (saveState === 'dirty') setIsDirty(true);
  }, [saveState]);

  // Archive each produced deliverable on the server (best-effort; the download already happened).
  const handleExported = useCallback(
    (format: ExportFormat, blob: Blob, fileName: string) => {
      if (!remoteSync) return;
      new DocumentApi().uploadExport(formData.id, blob, format, fileName).catch(() => undefined);
    },
    [formData.id, remoteSync]
  );

  const { isExportingDocx, isExportingZip, isExportingPdf, isExportingXml, handleDownloadDocx, handleDownloadZip, handleDownloadPdf, handleDownloadXml, handleDownloadXmlPackage } =
    useEditorExport({ formData, compiledPdfUrl, compileLatexToPdf, onExported: handleExported });

  const handleSave = useCallback(async (): Promise<boolean> => {
    onUpdatePaper(formData);
    if (!notifyManualSaveOutcome(await saveNow(formData))) return false;
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
    return true;
  }, [formData, onUpdatePaper, saveNow]);

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
      router.replace(`/editor?id=${encodeURIComponent(loaded.id)}`);
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
  });

  // Back Navigation Guard handlers
  const handleRequestBack = useCallback(() => {
    if (isDirty) {
      setIsExitWarningOpen(true);
    } else {
      router.push('/papers');
    }
  }, [isDirty, router]);

  const handleConfirmSaveAndExit = useCallback(async () => {
    if (!(await handleSave())) return;
    setIsExitWarningOpen(false);
    router.push('/papers');
  }, [handleSave, router]);

  const handleDiscardAndExit = useCallback(() => {
    setIsExitWarningOpen(false);
    router.push('/papers');
  }, [router]);

  // Handler for updating paper workflow status
  const handleUpdateWorkflowStatus = useCallback(
    (newStatus: WorkflowStatus) => {
      const updated: CompletePaper = {
        ...formData,
        status: newStatus as any,
        workflowStatus: newStatus,
      };
      setFormData(updated);
      setIsDirty(true);
      onUpdatePaper(updated);
      const label = WORKFLOW_STATUS_CONFIG[newStatus]?.label || newStatus;
      sileo.success({
        title: 'Đã cập nhật trạng thái',
        description: `Bản thảo đã được chuyển sang trạng thái "${label}"`,
      });
    },
    [formData, onUpdatePaper]
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
    () => computePreflightCheck(deferredFormData),
    [deferredFormData]
  );

  const { focusRequest, paneProps } = usePreviewLinks({ formData, setFormData, setIsDirty, setActiveSubTab, recompile: handleRecompile });

  const handleSectionsChange = useCallback((sections: PaperSection[]) => {
    setFormData((prev) => ({ ...prev, sections: assignEquationNumbers(sections) }));
    setIsDirty(true);
  }, []);

  const handleApplyLayoutSettings = (newSettings: LayoutSettings, newJournalId?: string) => {
    const journalIdToUse = newJournalId || formData.metadata.journalId || currentJournal;
    const tmpl = JOURNAL_TEMPLATES[journalIdToUse] || JOURNAL_TEMPLATES['VNUHCM-HS'];
    const updated: CompletePaper = {
      ...formData,
      layoutSettings: newSettings,
      metadata: { ...formData.metadata, journalId: journalIdToUse, journalName: tmpl.name, journalAbbv: tmpl.shortName },
    };
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
      <div className="flex-1 min-h-0 min-w-0 h-full w-full overflow-hidden">
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
            references={formData.references} focusRequest={focusRequest}
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
        workflowStatus={formData.status || (formData as any).workflowStatus || 'draft'}
        onUpdateWorkflowStatus={handleUpdateWorkflowStatus}
        onOpenFullscreenPdf={handleOpenFullscreenPdf}
        onOpenQuickEdit={handleOpenQuickEdit}
        onOpenExtractedDrawer={() => setIsExtractedDrawerOpen(true)}
        onOpenLayoutSettings={() => setIsSettingsDrawerOpen(true)}
        onSave={handleSave}
        saveSuccess={saveSuccess}
        isDirty={isDirty}
        onRecompile={() => handleRecompile(formData)}
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
      <LayoutSettingsDrawer isOpen={isSettingsDrawerOpen} onClose={() => setIsSettingsDrawerOpen(false)} settings={formData.layoutSettings || DEFAULT_LAYOUT_SETTINGS} journalId={formData.metadata.journalId || currentJournal} onApplySettings={handleApplyLayoutSettings} isCompiling={isCompilingPdf} />
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
