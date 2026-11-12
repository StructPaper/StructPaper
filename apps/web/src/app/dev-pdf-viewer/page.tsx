'use client';

import React, { useState } from 'react';
import { PdfInteractiveViewer, type PdfPickContext, type PdfRotateContext } from '@/components/preview/PdfInteractiveViewer';

// Test harness for the preview: a hidden browser pane stops requestAnimationFrame, which pdf.js needs to draw.
// "?raf=timeout" replaces it with a timer so the viewer can be driven there.
if (typeof window !== 'undefined' && window.location.search.includes('raf=timeout')) {
  window.requestAnimationFrame = (cb: FrameRequestCallback) => window.setTimeout(() => cb(performance.now()), 16);
}

export default function DevPdfViewerPage() {
  const [log, setLog] = useState<string[]>([]);
  const add = (s: string) => setLog((l) => [...l, s]);
  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PdfInteractiveViewer
          url="/api_compiled_preview.pdf"
          onPickText={(c: PdfPickContext) => add(`pick: ${c.lines[c.center]}`)}
          onRotatePage={(c: PdfRotateContext) => add(`rotate page ${c.page} -> ${c.orientation}`)}
        />
      </div>
      <pre data-testid="dev-log" style={{ height: 80, overflow: 'auto', margin: 0, fontSize: 11 }}>
        {log.join('\n')}
      </pre>
    </div>
  );
}
