'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { usePaper } from '@/context/PaperContext';
import {
  usePaperStorage,
  useEditorCompilation,
  LivePreviewPane,
  DockIconButton,
} from '@/features/editor';

function PreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paperId = searchParams.get('id');
  const { paper, setPaper, setCurrentJournal } = usePaper();
  const { loadPaper } = usePaperStorage();
  const [isLoadingPaper, setIsLoadingPaper] = useState(Boolean(paperId && paper.id !== paperId));

  useEffect(() => {
    if (!paperId || paper.id === paperId) {
      setIsLoadingPaper(false);
      return;
    }

    let isMounted = true;
    loadPaper(paperId).then((loaded) => {
      if (isMounted) {
        if (loaded) {
          setPaper(loaded);
          if (loaded.metadata?.journalId) {
            setCurrentJournal(loaded.metadata.journalId);
          }
        }
        setIsLoadingPaper(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [paperId, paper.id, loadPaper, setPaper, setCurrentJournal]);

  const {
    compiledPdfUrl,
    isCompilingPdf,
    compileStats,
    compileErrorInfo,
    setCompileErrorInfo,
    handleRecompile,
  } = useEditorCompilation({
    paper,
    formData: paper,
    onUpdatePaper: () => {},
  });

  const handleBackToEditor = () => {
    const destination = paperId ? `/editor?id=${paperId}` : (paper.id ? `/editor?id=${paper.id}` : '/editor');
    router.push(destination);
  };

  if (isLoadingPaper) {
    return (
      <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex flex-col items-center justify-center bg-[#F6F6F9] text-zinc-600 gap-3">
        <RefreshCw className="w-6 h-6 animate-spin text-[#78C841]" />
        <span className="text-xs font-bold">Đang tải bản thảo...</span>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex flex-row p-3 gap-2 sm:gap-3 overflow-hidden bg-[#F6F6F9]">
      {/* Minimalist Left Dock: Only the Back Button */}
      <aside
        className="hidden sm:flex flex-col items-center justify-between h-full w-12 sm:w-14 py-2 px-1 flex-shrink-0 select-none relative z-50"
        aria-label="Thanh điều hướng xem trước PDF"
      >
        <div className="relative flex flex-col items-center gap-2.5">
          <DockIconButton
            id="preview-back-dock-btn"
            onClick={handleBackToEditor}
            label="Quay lại trình soạn thảo"
            icon={<ArrowLeft className="w-5 h-5 text-zinc-700" strokeWidth={2.4} />}
          />
        </div>
        <div />
        <div />
      </aside>

      {/* Main Full-Screen PDF Viewer */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        {/* Mobile Header with Back Button */}
        <div className="flex sm:hidden flex-shrink-0 items-center justify-between p-1.5 mb-1.5 bg-white/70 backdrop-blur-md rounded-2xl border border-zinc-200">
          <button
            type="button"
            onClick={handleBackToEditor}
            className="p-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Quay lại trình soạn thảo"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Soạn thảo</span>
          </button>
          <span className="text-xs font-bold text-zinc-800 truncate px-2">
            {paper.metadata?.title || 'Xem trước PDF toàn màn hình'}
          </span>
        </div>

        {/* Full-Screen PDF Container */}
        <div className="flex-1 min-h-0 h-full w-full overflow-hidden">
          <LivePreviewPane
            paper={paper}
            compiledPdfUrl={compiledPdfUrl}
            isCompilingPdf={isCompilingPdf}
            compileStats={compileStats}
            compileErrorInfo={compileErrorInfo}
            onRecompile={() => handleRecompile(paper)}
            onClearError={() => setCompileErrorInfo(null)}
          />
        </div>
      </div>
    </div>
  );
}

export default function PreviewPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex flex-col items-center justify-center bg-[#F6F6F9] text-zinc-600 gap-3">
          <RefreshCw className="w-6 h-6 animate-spin text-[#78C841]" />
          <span className="text-xs font-bold">Đang khởi tạo xem trước...</span>
        </div>
      }
    >
      <PreviewContent />
    </Suspense>
  );
}
