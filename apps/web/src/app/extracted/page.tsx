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
      onGoToEditor={() => router.push('/editor')}
      onGoToPreview={() => router.push('/preview')}
    />
  );
}
