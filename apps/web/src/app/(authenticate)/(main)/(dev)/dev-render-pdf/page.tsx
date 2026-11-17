'use client';

import React, { useEffect, useState } from 'react';

export default function DevRenderPdfPage() {
  const [status, setStatus] = useState<string>('Khởi tạo...');
  const [progress, setProgress] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(13);
  const [done, setDone] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function renderAndExportAll() {
      try {
        setStatus('Đang nạp pdf.js...');
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

        setStatus('Đang tải tệp PDF /demo-assets/id630/ID630_HS.pdf...');
        const loadingTask = pdfjsLib.getDocument('/demo-assets/id630/ID630_HS.pdf');
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;
        setTotalPages(numPages);

        for (let i = 1; i <= numPages; i++) {
          if (cancelled) return;
          setStatus(`Đang xuất trang ${i} / ${numPages}...`);
          const page = await pdf.getPage(i);
          // Standard scale: 2x for ultra high-fidelity rendering
          const viewport = page.getViewport({ scale: 2.0 });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          const dataUrl = canvas.toDataURL('image/png');

          await fetch('/api/dev-export-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ page: i, imageBase64: dataUrl }),
          });

          setProgress(i);
        }

        if (!cancelled) {
          setStatus('Hoàn tất xuất tất cả 13 trang ra PNG!');
          setDone(true);
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setStatus(`Lỗi: ${message}`);
      }
    }

    renderAndExportAll();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-8 max-w-xl mx-auto font-sans">
      <h1 className="text-xl font-bold mb-4">Trích xuất 13 trang PDF ID630 sang PNG độ nét cao</h1>
      <div className="bg-slate-100 p-4 rounded-lg border border-slate-300">
        <p className="font-semibold text-slate-800 mb-2">{status}</p>
        <div className="w-full bg-slate-200 h-4 rounded-full overflow-hidden">
          <div
            className="bg-blue-600 h-full transition-all duration-300"
            style={{ width: `${(progress / totalPages) * 100}%` }}
          />
        </div>
        <p className="text-sm text-slate-600 mt-2">
          Tiến trình: {progress} / {totalPages} trang
        </p>
      </div>
      {done && (
        <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
          Đã lưu tất cả 13 trang vào <code>public/demo-assets/id630/pages/page-[1-13].png</code>!
        </div>
      )}
    </div>
  );
}
