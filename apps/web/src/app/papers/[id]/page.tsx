'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { usePaper } from '@/context/PaperContext';
import { UnifiedEditorView, usePaperStorage } from '@/features/editor';
import { CompletePaper } from '@/lib/sample-papers';

function PaperEditorContent({ paperId }: { paperId: string }) {
  const { paper, updatePaper, setPaper, setCurrentJournal } = usePaper();
  const { loadPaper } = usePaperStorage();
  const [isLoading, setIsLoading] = useState(Boolean(paperId && (!paper || paper.id !== paperId)));

  useEffect(() => {
    if (!paperId) {
      setIsLoading(false);
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
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [paperId, loadPaper, setPaper, setCurrentJournal]);

  const handleUpdatePaper = (updated: CompletePaper) => {
    updatePaper(updated);
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex items-center justify-center bg-slate-900 text-white text-sm font-medium">
        Đang tải bản thảo từ cơ sở dữ liệu...
      </div>
    );
  }

  return (
    <UnifiedEditorView
      paper={paper}
      onUpdatePaper={handleUpdatePaper}
    />
  );
}

export default function PaperDetailPage({ params }: { params?: { id?: string } }) {
  const urlParams = useParams();
  const rawId = params?.id || (urlParams?.id as string | undefined);
  const paperId = rawId ? decodeURIComponent(rawId) : '';

  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex items-center justify-center bg-slate-900 text-white text-sm font-medium">
          Đang khởi tạo trình soạn thảo...
        </div>
      }
    >
      <PaperEditorContent paperId={paperId} />
    </Suspense>
  );
}
