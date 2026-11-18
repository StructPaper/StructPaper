'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { usePaper } from '@/context/PaperContext';
import { UnifiedEditorView, ReadOnlyPaperView, usePaperStorage } from '@/features/editor';
import { usePaperAccess } from '@/features/papers';
import { useAuthStore } from '@/lib/auth-store';
import { CompletePaper } from '@/lib/sample-papers';

function PaperEditorContent({ paperId }: { paperId: string }) {
  const router = useRouter();
  const { paper, updatePaper, setPaper, setCurrentJournal } = usePaper();
  const { loadPaper } = usePaperStorage();
  const [loadedPaper, setLoadedPaper] = useState<CompletePaper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const { access } = usePaperAccess(paperId);
  const isSignedIn = useAuthStore((state) => Boolean(state.user || state.isAuthenticated));

  useEffect(() => {
    if (!paperId) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setNotFound(false);

    loadPaper(paperId).then((loaded) => {
      if (isMounted) {
        if (loaded) {
          setLoadedPaper(loaded);
          setPaper(loaded);
          if (loaded.metadata?.journalId) {
            setCurrentJournal(loaded.metadata.journalId);
          }
        } else {
          setNotFound(true);
        }
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [paperId, loadPaper, setPaper, setCurrentJournal]);

  const handleUpdatePaper = (updated: CompletePaper) => {
    setLoadedPaper(updated);
    updatePaper(updated);
  };

  if (isLoading || access.status === 'loading') {
    return (
      <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex flex-col items-center justify-center gap-4 bg-[#F8F9FA] text-[#1A1A1A]">
        <Loader2 className="w-12 h-12 animate-spin text-[#78C841]" strokeWidth={3} />
        <p className="text-sm font-medium text-zinc-600">Đang tải nội dung bài báo.....</p>
      </div>
    );
  }

  const currentPaper = loadedPaper || paper;

  if (notFound || !currentPaper) {
    return (
      <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex flex-col items-center justify-center bg-[#F8F9FA] text-[#1A1A1A] gap-3 p-4">
        <p className="text-base font-semibold text-rose-500">Không tìm thấy bản thảo</p>
        <p className="text-xs text-zinc-500 max-w-md text-center">
          Bản thảo với mã &ldquo;{paperId}&rdquo; không tồn tại hoặc đã bị xóa trên máy chủ.
        </p>
        <button
          onClick={() => router.push('/papers')}
          className="mt-2 px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-medium text-white transition-colors"
        >
          Quay lại danh sách bài báo
        </button>
      </div>
    );
  }

  if (access.readOnly) {
    return <ReadOnlyPaperView paper={currentPaper} canCompile={isSignedIn} />;
  }

  return (
    <UnifiedEditorView
      paper={currentPaper}
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
        <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex flex-col items-center justify-center gap-4 bg-[#F8F9FA] text-[#1A1A1A]">
          <Loader2 className="w-12 h-12 animate-spin text-[#78C841]" strokeWidth={3} />
          <p className="text-sm font-medium text-zinc-600">Đang tải nội dung bài báo.....</p>
        </div>
      }
    >
      <PaperEditorContent paperId={paperId} />
    </Suspense>
  );
}
