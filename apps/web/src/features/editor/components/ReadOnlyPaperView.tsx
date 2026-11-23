'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useGoBack, isHistoryPage } from '@/lib/app-history';
import type { CompletePaper } from '@/types/paper';
import { computePreflightCheck } from '@/lib/docx-extractor';
import { useEditorSession } from '@/context/EditorSessionContext';
import { normalizeWorkflowStatus } from '@/features/papers';
import { EditorTabKey } from './types';
import { EditorLeftDock } from './EditorLeftDock';
import { EditorTabNav } from './EditorTabNav';
import { MetadataTab } from './MetadataTab';
import { AuthorsTab } from './AuthorsTab';
import { AbstractTab } from './AbstractTab';
import { SectionsTab } from './SectionsTab';
import { ReferencesTab } from './ReferencesTab';
import { CitationTab } from './CitationTab';
import { LivePreviewPane } from './LivePreviewPane';
import { ResizableSplitLayout } from './ResizableSplitLayout';
import { ExtractedContentDrawer } from './ExtractedContentDrawer';
import { ReadOnlyScope } from './ReadOnlyScope';
import { generateStandardCitation } from './sections/utils';
import {
  useEditorCompilation,
  useServerPdfPreview,
  useEditorExport,
  EditorTabStateProvider,
  useCreateEditorTabStateStore,
} from '../hooks';

const noop = () => undefined;

interface ReadOnlyPaperViewProps {
  paper: CompletePaper;
  /** Signed-in readers can have the PDF laid out for them; guests can only read the content. */
  canCompile: boolean;
  /** Shown above the paper (the trash uses it for "this paper is deleted" and its buttons). */
  banner?: React.ReactNode;
  /** Where the back button goes when there is no page of the app behind this one. */
  backFallback?: string;
}

/**
 * The paper page for people who may only READ it (view-only members, anyone with the link).
 * Same layout as the editor, but there is nothing to save: no autosave, no sync, no editing
 * controls, and every tab is a read-only view of the content.
 */
export const ReadOnlyPaperView: React.FC<ReadOnlyPaperViewProps> = ({ paper, canCompile, banner, backFallback = '/papers' }) => {
  const goBack = useGoBack();
  const { setDocumentSession } = useEditorSession();
  const [activeTab, setActiveTab] = useState<EditorTabKey>('metadata');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [mobilePane, setMobilePane] = useState<'content' | 'pdf'>('content');
  const { store: tabStateStore } = useCreateEditorTabStateStore(paper.id);

  // Readers see the PDF the editors last compiled; only when there is none do signed-in readers compile it.
  const serverPreview = useServerPdfPreview(paper.id);
  const compilation = useEditorCompilation({
    paper,
    formData: paper,
    onUpdatePaper: noop,
    autoCompile: false,
    publishPreview: false,
  });
  const { isCompilingPdf, compileLatexToPdf } = compilation;
  const compiledPdfUrl = serverPreview.url ?? compilation.compiledPdfUrl;
  useEffect(() => {
    if (serverPreview.status === 'missing' && canCompile) void compileLatexToPdf(paper);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverPreview.status, canCompile, paper.id]);
  const exporter = useEditorExport({ formData: paper, compiledPdfUrl, compileLatexToPdf });

  const title = (paper as any).displayName || paper.metadata.title || 'Bản thảo bài báo';
  useEffect(() => {
    setDocumentSession({ paperId: paper.id, title, saveState: 'saved', readOnly: true });
    return () => setDocumentSession(null);
  }, [paper.id, title, setDocumentSession]);

  const downloadPdf = useCallback(async () => {
    const url = compiledPdfUrl ?? (canCompile ? await compileLatexToPdf(paper) : null);
    if (url) await exporter.handleDownloadPdf(url);
  }, [compiledPdfUrl, canCompile, compileLatexToPdf, exporter, paper]);

  const preflight = useMemo(() => computePreflightCheck(paper), [paper]);
  const citationSection = paper.sections.find((s) => s.type === 'citation');
  const citationText = citationSection?.content ?? generateStandardCitation(paper.metadata);

  const content = (
    <div className="h-full flex flex-col min-h-0 min-w-0 w-full overflow-hidden space-y-2" data-testid="readonly-paper-content">
      <div className="flex-shrink-0">
        <EditorTabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          authorsCount={paper.metadata.authors.length}
          sectionsCount={paper.sections.filter((s) => s.type !== 'citation').length}
          referencesCount={paper.references.length}
          preflight={preflight}
        />
      </div>
      <ReadOnlyScope readOnly className="flex-1 min-h-0 min-w-0 h-full w-full overflow-hidden">
        {activeTab === 'metadata' && <MetadataTab metadata={paper.metadata} showAbstractAndKeywords={false} onChange={noop} />}
        {activeTab === 'authors' && <AuthorsTab metadata={paper.metadata} onChange={noop} />}
        {activeTab === 'abstract' && <AbstractTab metadata={paper.metadata} onChange={noop} />}
        {activeTab === 'sections' && (
          <SectionsTab sections={paper.sections} onChange={noop} metadata={paper.metadata} references={paper.references} />
        )}
        {activeTab === 'refs' && <ReferencesTab references={paper.references} onChange={noop} />}
        {activeTab === 'citation' && <CitationTab citationText={citationText} onChange={noop} metadata={paper.metadata} />}
      </ReadOnlyScope>
    </div>
  );

  const preview = (
    <div className="h-full flex flex-col min-h-0">
      <LivePreviewPane
        paper={paper}
        compiledPdfUrl={compiledPdfUrl}
        isCompilingPdf={isCompilingPdf || serverPreview.status === 'loading'}
        compileStats={compilation.compileStats}
        compileErrorInfo={compilation.compileErrorInfo}
        onRecompile={canCompile ? () => compileLatexToPdf(paper) : undefined}
        onClearError={() => compilation.setCompileErrorInfo(null)}
        compileStartedAt={compilation.compileStartedAt}
        busyLabel={serverPreview.status === 'loading' ? 'Đang tải bản xem trước…' : undefined}
        interactiveMode={false}
      />
    </div>
  );

  return (
    <EditorTabStateProvider paperId={paper.id} store={tabStateStore}>
      <div className="h-full w-full flex flex-row p-3 min-h-0 gap-2 sm:gap-3 overflow-hidden" data-testid="readonly-paper-view">
        <EditorLeftDock
          readOnly
          homeHref={backFallback}
          paperId={paper.id}
          onBackClick={() => goBack(backFallback, isHistoryPage)}
          workflowStatus={normalizeWorkflowStatus((paper as any).workflowStatus || paper.status)}
          onOpenExtractedDrawer={() => setIsDrawerOpen(true)}
          onOpenLayoutSettings={noop}
          onSave={noop}
          saveSuccess={false}
          onRecompile={noop}
          isCompiling={isCompilingPdf}
          onDownloadDocx={() => void exporter.handleDownloadDocx()}
          isExportingDocx={exporter.isExportingDocx}
          onDownloadZip={exporter.handleDownloadZip}
          onDownloadXml={exporter.handleDownloadXml}
          onDownloadXmlPackage={exporter.handleDownloadXmlPackage}
          isExportingXml={exporter.isExportingXml}
          isExportingZip={exporter.isExportingZip}
          onDownloadPdf={compiledPdfUrl || canCompile ? () => void downloadPdf() : undefined}
          isExportingPdf={exporter.isExportingPdf}
          compiledPdfUrl={compiledPdfUrl}
          qcScore={0}
        />

        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
          {banner && <div className="flex-shrink-0 mb-2 sm:mb-3">{banner}</div>}
          <div className="flex sm:hidden flex-shrink-0 items-center justify-center p-1.5 mb-1.5 bg-white/70 rounded-2xl border border-zinc-200">
            <div className="flex items-center gap-1 bg-zinc-200/70 p-0.5 rounded-xl">
              <button type="button" onClick={() => setMobilePane('content')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${mobilePane === 'content' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600'}`}>Nội dung</button>
              <button type="button" onClick={() => setMobilePane('pdf')} className={`px-3 py-1.5 text-xs font-bold rounded-lg ${mobilePane === 'pdf' ? 'bg-white text-zinc-900 shadow-2xs' : 'text-zinc-600'}`}>PDF</button>
            </div>
          </div>
          <div className="hidden sm:flex flex-1 min-h-0 h-full w-full overflow-hidden">
            <ResizableSplitLayout className="h-full" leftContent={content} rightContent={preview} defaultSplit={50} minPercent={28} maxPercent={72} />
          </div>
          <div className="block sm:hidden flex-1 min-h-0 overflow-y-auto">{mobilePane === 'content' ? content : preview}</div>
        </div>

        <ExtractedContentDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} paper={paper} />
      </div>
    </EditorTabStateProvider>
  );
};
