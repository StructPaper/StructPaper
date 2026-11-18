'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { usePaper } from '@/context/PaperContext';
import { ExtractedContentView } from '@/features/papers';

export default function ExtractedPage() {
  const router = useRouter();
  const { paper } = usePaper();

  return (
    <ExtractedContentView
      paper={paper}
      onGoToEditor={() => {
        const target = paper?.id ? `/papers/${encodeURIComponent(paper.id)}` : '/papers';
        router.push(target);
      }}
      onGoToPreview={() => router.push('/preview')}
    />
  );
}
