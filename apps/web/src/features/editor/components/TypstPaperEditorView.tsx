'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CompletePaper,
  PaperSection,
  LayoutSettings,
  DEFAULT_LAYOUT_SETTINGS,
} from '@/types/paper';
import { UniversalTemplateSchema } from '@/types/template-builder';
import { BUILT_IN_TEMPLATES } from '@/data/templates';
import { computePreflightCheck } from '@/lib/docx-extractor';
import { exportPaperToDocx } from '@/lib/docx-export';
import { exportBaseName } from '../hooks/useEditorExport';
import { compilePaperToTypst } from '@/lib/authoring/typst-paper-compiler';
import { saveAuthoringPaper } from '@/lib/authoring/paper-storage';
import {
  EditorTabKey,
} from './types';
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
import { generateStandardCitation } from './sections/utils';
import { ResizableSplitLayout } from './ResizableSplitLayout';
import { TypstLivePreviewPane } from './TypstLivePreviewPane';
import { Home, Eye, Edit3, FileEdit } from 'lucide-react';
import { sileo } from '@/components/toast';
import { PaperQuickEditModal, useEditorQuickEdit } from '@/features/papers';
import { useEditorAutoSave, useSyncEditorSession, useHydrateDisplayName } from '../hooks';
import { useEditorSession } from '@/context/EditorSessionContext';

interface TypstPaperEditorViewProps {
  initialPaper: CompletePaper;
}

export const TypstPaperEditorView: React.FC<TypstPaperEditorViewProps> = ({
  initialPaper,
}) => {
  // Working draft paper state
  const [formData, setFormData] = useState<CompletePaper>(() =>
    JSON.parse(JSON.stringify(initialPaper))
  );

  // Template associated with this paper
  const template: UniversalTemplateSchema =
    BUILT_IN_TEMPLATES.find((t) => t.id === formData.templateId) ||
    BUILT_IN_TEMPLATES[0];

  const [isDirty, setIsDirty] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isSettingsDrawerOpen, setIsSettingsDrawerOpen] = useState(false);
  const [isExtractedDrawerOpen, setIsExtractedDrawerOpen] = useState(false);

  const {
    isQuickEditOpen,
    quickEditRecord,
    handleOpenQuickEdit,
    handleCloseQuickEdit,
    handleSaveQuickEdit,
  } = useEditorQuickEdit(formData, setFormData, saveAuthoringPaper);

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

  // Export progress states
  const [isExportingDocx, setIsExportingDocx] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingTypst, setIsExportingTypst] = useState(false);

  // Subtab navigation state (same tabs as /editor)
  const [activeSubTab, setActiveSubTab] = useState<EditorTabKey>('metadata');

  // Mobile active pane switch: 'editor' | 'preview'
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');

  // Preview sync state
  const [isCompiling, setIsCompiling] = useState(false);

  const { autoSaveEnabled } = useEditorSession();

  const { autosaveStatus } = useEditorAutoSave({
    paperId: formData.id,
    formData,
    isDirty,
    setIsDirty,
    enabled: autoSaveEnabled,
    debounceMs: 2000,
    onSave: async (updated) => {
      saveAuthoringPaper(updated);
      return true;
    },
  });

  // Save changes to storage
  const handleSave = useCallback(() => {
    saveAuthoringPaper(formData);
    setIsDirty(false);
    setSaveSuccess(true);
    sileo.success({
      title: 'Đã lưu thay đổi',
      description: 'Bản thảo bài báo đã được cập nhật thành công vào hệ thống',
    });
    setTimeout(() => setSaveSuccess(false), 2500);
  }, [formData]);

  useSyncEditorSession({
    paperId: formData.id,
    displayName: formData.displayName,
    autosaveStatus,
    isDirty,
    saveSuccess,
    onManualSave: handleSave,
  });

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Handle data updates
  const updateData = (updated: CompletePaper) => {
    setFormData(updated);
    setIsDirty(true);
  };

  const handleMetadataChange = (newMetadata: any) => {
    updateData({ ...formData, metadata: newMetadata });
  };

  const handleSectionsChange = (newSections: PaperSection[]) => {
    updateData({ ...formData, sections: newSections });
  };

  const handleReferencesChange = (newRefs: any[]) => {
    updateData({ ...formData, references: newRefs });
  };

  const handleLayoutSettingsChange = (newLayout: LayoutSettings) => {
    updateData({ ...formData, layoutSettings: newLayout });
  };

  // Recompile / Refresh preview
  const handleRecompile = () => {
    setIsCompiling(true);
    setTimeout(() => {
      setIsCompiling(false);
      sileo.info({
        title: 'Đã đồng bộ dàn trang',
        description: `Bản thảo đã được cập nhật theo mẫu ${template.name}`,
      });
    }, 600);
  };

  // Export Typst
  const handleDownloadTypst = () => {
    setIsExportingTypst(true);
    try {
      const typstCode = compilePaperToTypst(formData, template);
      const blob = new Blob([typstCode], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (formData.metadata.title || 'paper')
        .replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]/g, '_')
        .slice(0, 40);
      a.download = `${safeTitle || 'paper'}_typst.typ`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      sileo.success({
        title: 'Đã xuất file Typst',
        description: `Tệp ${a.download} đã được tải về máy của bạn.`,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingTypst(false);
    }
  };

  // Export Docx
  const handleDownloadDocx = async () => {
    setIsExportingDocx(true);
    try {
      const blob = await exportPaperToDocx(formData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${exportBaseName(formData)}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      sileo.success({
        title: 'Đã xuất file Word',
        description: 'Tệp bản thảo .docx đã được tạo thành công.',
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsExportingDocx(false);
    }
  };

  // Export PDF
  const handleDownloadPdf = () => {
    handleDownloadTypst();
  };

  // Export ZIP
  const handleDownloadZip = () => {
    handleDownloadTypst();
  };

  // Preflight QC Check
  const preflight = computePreflightCheck(formData);

  // Citation text
  const citationSection = formData.sections.find((s) => s.type === 'citation');
  const citationText = citationSection?.content || generateStandardCitation(formData.metadata);

  const handleUpdateCitation = (updatedText: string) => {
    const list = [...formData.sections];
    const existingIdx = list.findIndex((s) => s.type === 'citation');
    if (existingIdx >= 0) {
      list[existingIdx] = { ...list[existingIdx], content: updatedText };
    } else {
      list.unshift({
        id: `sec_citation_${Date.now()}`,
        type: 'citation',
        title: 'Trích dẫn bài báo này',
        content: updatedText,
      });
    }
    handleSectionsChange(list);
  };

  // Left Column Content
  const leftEditorContent = (
    <div className="h-full flex flex-col min-h-0 min-w-0 w-full overflow-hidden space-y-2">
      {/* Subtabs Navigation */}
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

      {/* Active Tab Card */}
      <div className="flex-1 min-h-0 min-w-0 h-full w-full overflow-hidden">
        {activeSubTab === 'metadata' && (
          <MetadataTab
            metadata={formData.metadata}
            onChange={handleMetadataChange}
          />
        )}

        {activeSubTab === 'authors' && (
          <AuthorsTab
            metadata={formData.metadata}
            onChange={handleMetadataChange}
          />
        )}

        {activeSubTab === 'abstract' && (
          <AbstractTab
            metadata={formData.metadata}
            onChange={handleMetadataChange}
          />
        )}

        {activeSubTab === 'sections' && (
          <SectionsTab
            sections={formData.sections}
            onChange={handleSectionsChange}
            metadata={formData.metadata}
            references={formData.references}
          />
        )}

        {activeSubTab === 'refs' && (
          <ReferencesTab
            references={formData.references}
            onChange={handleReferencesChange}
          />
        )}

        {activeSubTab === 'citation' && (
          <CitationTab
            citationText={citationText}
            onChange={handleUpdateCitation}
            metadata={formData.metadata}
          />
        )}

        {activeSubTab === 'preflight' && (
          <PreflightQCTab
            preflight={preflight}
            onNavigateTab={(tab) => setActiveSubTab(tab)}
          />
        )}
      </div>
    </div>
  );

  // Right Column Preview Content
  const rightPreviewContent = (
    <div className="h-full flex flex-col min-h-0">
      <TypstLivePreviewPane
        paper={formData}
        template={template}
        isCompiling={isCompiling}
        onRecompile={handleRecompile}
      />
    </div>
  );

  return (
    <div className="h-full w-full flex flex-row p-3 min-h-0 gap-2 sm:gap-3 overflow-hidden">
      {/* 1. LEFT VERTICAL DOCK (Desktop/Tablet) */}
      <EditorLeftDock
        homeHref="/papers"
        autosaveStatus={autosaveStatus}
        onOpenQuickEdit={handleOpenQuickEdit}
        onOpenExtractedDrawer={() => setIsExtractedDrawerOpen(true)}
        onOpenLayoutSettings={() => setIsSettingsDrawerOpen(true)}
        onSave={handleSave}
        saveSuccess={saveSuccess}
        isDirty={isDirty}
        onRecompile={handleRecompile}
        isCompiling={isCompiling}
        onDownloadDocx={handleDownloadDocx}
        isExportingDocx={isExportingDocx}
        onDownloadZip={handleDownloadZip}
        isExportingZip={isExportingZip}
        onDownloadPdf={handleDownloadPdf}
        isExportingPdf={isExportingPdf}
        onDownloadTypst={handleDownloadTypst}
        isExportingTypst={isExportingTypst}
        compiledPdfUrl={null}
        qcScore={preflight.score}
        hasErrors={preflight.issues?.some((i) => i.severity === 'error')}
        hasWarnings={preflight.issues?.some((i) => i.severity === 'warning')}
        errorCount={preflight.issues?.filter((i) => i.severity === 'error').length || 0}
        warningCount={preflight.issues?.filter((i) => i.severity === 'warning').length || 0}
        onOpenQCTab={() => setActiveSubTab('preflight')}
      />

      {/* 2. MAIN WORKSPACE: Fills 100% of height and width right up to the top edge */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        {/* Mobile Top Header */}
        <div className="flex sm:hidden flex-shrink-0 items-center justify-between p-1.5 mb-1.5 bg-white/70 backdrop-blur-md rounded-2xl border border-zinc-200">
          <Link
            href="/papers"
            className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 font-bold text-xs flex items-center gap-1 shadow-2xs"
            title="Quay lại danh sách bài báo"
          >
            <Home className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-1 bg-zinc-200/70 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setMobilePane('editor')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mobilePane === 'editor' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600'
              }`}
            >
              Soạn thảo
            </button>
            <button
              type="button"
              onClick={() => setMobilePane('preview')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mobilePane === 'preview' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600'
              }`}
            >
              Xem trước
            </button>
          </div>
        </div>

        {/* Desktop Split View: Fills 100% of height directly from the top edge */}
        <div className="hidden sm:flex flex-1 min-h-0 h-full w-full overflow-hidden">
          <ResizableSplitLayout
            className="h-full flex-1 min-h-0"
            leftContent={leftEditorContent}
            rightContent={rightPreviewContent}
            defaultSplit={50}
            minPercent={28}
            maxPercent={72}
            storageKey="structpaper_papers_editor_split_v1"
          />
        </div>

        {/* Mobile Single Pane View */}
        <div className="flex sm:hidden flex-1 min-h-0 h-full w-full overflow-hidden">
          {mobilePane === 'editor' ? leftEditorContent : rightPreviewContent}
        </div>
      </div>

      {/* 3. DRAWERS */}
      <ExtractedContentDrawer
        isOpen={isExtractedDrawerOpen}
        onClose={() => setIsExtractedDrawerOpen(false)}
        paper={formData}
      />

      <LayoutSettingsDrawer
        isOpen={isSettingsDrawerOpen}
        onClose={() => setIsSettingsDrawerOpen(false)}
        settings={formData.layoutSettings || DEFAULT_LAYOUT_SETTINGS}
        journalId={formData.metadata.journalId}
        onApplySettings={handleLayoutSettingsChange}
      />

      <PaperQuickEditModal
        paper={quickEditRecord}
        isOpen={isQuickEditOpen}
        onClose={handleCloseQuickEdit}
        onSave={handleSaveQuickEdit}
      />
    </div>
  );
};

export default TypstPaperEditorView;
