'use client';

import React from 'react';
import { UploadView, usePaperUpload } from '@/features/papers';

export default function UploadPage() {
  const { currentPaper, handlePaperLoaded } = usePaperUpload();

  return (
    <div className="flex-1 w-full flex flex-col justify-center min-h-[calc(100vh-5rem)]">
      <UploadView onPaperLoaded={handlePaperLoaded} currentPaper={currentPaper} />
    </div>
  );
}
