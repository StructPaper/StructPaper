'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CompletePaper } from '@/types/paper';
import { getAuthoringPaperById, getAuthoringPapers, createNewPaperFromTemplate } from '@/lib/authoring/paper-storage';
import { BUILT_IN_TEMPLATES } from '@/data/templates';
import { TypstPaperEditorView } from '@/features/editor';
import { Loader2, AlertCircle } from 'lucide-react';

function PaperEditorLoader() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paperId = searchParams.get('id');

  const [paper, setPaper] = useState<CompletePaper | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!paperId) {
      // If no ID provided, try first available or create from default template
      const papers = getAuthoringPapers();
      if (papers.length > 0) {
        setPaper(papers[0]);
      } else {
        const fallback = createNewPaperFromTemplate(BUILT_IN_TEMPLATES[0]);
        setPaper(fallback);
      }
      setIsLoading(false);
      return;
    }

    const loaded = getAuthoringPaperById(paperId);
    if (loaded) {
      setPaper(loaded);
    } else {
      // If id not found in storage, create from default template or load first
      const papers = getAuthoringPapers();
      if (papers.length > 0) {
        setPaper(papers[0]);
      } else {
        const fallback = createNewPaperFromTemplate(BUILT_IN_TEMPLATES[0]);
        setPaper(fallback);
      }
    }
    setIsLoading(false);
  }, [paperId]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-3">
        <Loader2 className="w-8 h-8 text-[#78C841] animate-spin" />
        <p className="text-sm font-bold text-slate-700">
          Đang nạp dữ liệu bài báo khoa học & mẫu Typst...
        </p>
      </div>
    );
  }

  if (!paper) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <h2 className="text-lg font-bold text-slate-800">Không tìm thấy bài báo</h2>
        <button
          onClick={() => router.push('/papers')}
          className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs"
        >
          Quay lại danh sách bài báo
        </button>
      </div>
    );
  }

  return <TypstPaperEditorView initialPaper={paper} />;
}

export default function PaperEditorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center space-y-3">
          <Loader2 className="w-8 h-8 text-[#78C841] animate-spin" />
          <p className="text-sm font-bold text-slate-700">Đang khởi tạo trình soạn thảo Typst...</p>
        </div>
      }
    >
      <PaperEditorLoader />
    </Suspense>
  );
}
