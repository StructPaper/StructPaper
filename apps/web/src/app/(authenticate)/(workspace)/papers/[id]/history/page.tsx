'use client';

import React, { Suspense } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { PaperHistoryView } from '@/features/history';
import { useSessionReady } from '@/features/auth';

const Loading = () => (
  <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex flex-col items-center justify-center gap-4 bg-[#F8F9FA] text-[#1A1A1A]">
    <Loader2 className="w-12 h-12 animate-spin text-[#78C841]" strokeWidth={3} />
    <p className="text-sm font-medium text-zinc-600">Đang tải lịch sử phiên bản.....</p>
  </div>
);

function HistoryContent() {
  const urlParams = useParams();
  const rawId = urlParams?.id as string | undefined;
  const paperId = rawId ? decodeURIComponent(rawId) : '';
  // after a reload wait for the session, or the requests go out as a guest and a private paper looks missing
  const ready = useSessionReady();
  if (!ready || !paperId) return <Loading />;
  return <PaperHistoryView paperId={paperId} />;
}

export default function PaperHistoryPage() {
  return (
    <Suspense fallback={<Loading />}>
      <HistoryContent />
    </Suspense>
  );
}
