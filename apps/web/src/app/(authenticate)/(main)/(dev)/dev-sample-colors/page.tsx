'use client';

import React, { useEffect, useState } from 'react';

interface JournalInfo {
  id: string;
  name: string;
  file: string;
}

const JOURNALS: JournalInfo[] = [
  { id: 'VNUHCM-ARNS', name: 'Natural Sciences (ARNS)', file: '/sample-pdfs/ARNS.pdf' },
  { id: 'VNUHCM-EBL', name: 'Economics, Business & Law (EBL)', file: '/sample-pdfs/EBL.pdf' },
  { id: 'VNUHCM-EES', name: 'Environment & Earth Sciences (EES)', file: '/sample-pdfs/EES.pdf' },
  { id: 'VNUHCM-HS', name: 'Health Sciences (HS)', file: '/sample-pdfs/HS.pdf' },
  { id: 'VNUHCM-SSH', name: 'Social Sciences & Humanities (SSH)', file: '/sample-pdfs/SSH.pdf' },
  { id: 'VNUHCM-STD', name: 'Science & Technology Development (STD)', file: '/sample-pdfs/STD.pdf' },
  { id: 'VNUHCM-ET', name: 'Engineering & Technology (ET)', file: '/sample-pdfs/ET.pdf' },
];

export default function DevSampleColorsPage() {
  const [results, setResults] = useState<Record<string, { bannerColor: string; topColors: string[]; dataUrl: string; error?: string }>>({});
  const [currentProcessing, setCurrentProcessing] = useState<string>('');

  useEffect(() => {
    async function loadAll() {
      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

        for (const j of JOURNALS) {
          setCurrentProcessing(`Đang xử lý ${j.name}...`);
          try {
            const doc = await pdfjsLib.getDocument(j.file).promise;
            const page = await doc.getPage(1);
            const viewport = page.getViewport({ scale: 1.0 });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;

            await page.render({ canvasContext: ctx, viewport }).promise;

            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
            const colorMap: Record<string, number> = {};
            const headerMaxY = Math.floor(canvas.height * 0.25);
            const bannerColors: Record<string, number> = {};

            for (let y = 0; y < canvas.height; y += 3) {
              for (let x = 0; x < canvas.width; x += 3) {
                const idx = (y * canvas.width + x) * 4;
                const r = imgData[idx];
                const g = imgData[idx + 1];
                const b = imgData[idx + 2];
                const a = imgData[idx + 3];

                if (a < 128) continue;
                if (r > 240 && g > 240 && b > 240) continue;
                if (r < 30 && g < 30 && b < 30) continue;
                const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));

                if (diff > 20) {
                  const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
                  colorMap[hex] = (colorMap[hex] || 0) + 1;
                  if (y < headerMaxY) {
                    bannerColors[hex] = (bannerColors[hex] || 0) + 1;
                  }
                }
              }
            }

            const sortedTop = Object.entries(colorMap).sort((a, b) => b[1] - a[1]).map(e => e[0]).slice(0, 5);
            const bannerSorted = Object.entries(bannerColors).sort((a, b) => b[1] - a[1]).map(e => e[0]);
            const bannerColor = bannerSorted[0] || sortedTop[0] || '#2B74B7';

            setResults(prev => ({
              ...prev,
              [j.id]: {
                bannerColor,
                topColors: sortedTop,
                dataUrl: canvas.toDataURL('image/jpeg', 0.6),
              }
            }));
          } catch (err: any) {
            console.error(`Error processing ${j.id}:`, err);
            setResults(prev => ({
              ...prev,
              [j.id]: {
                bannerColor: '#999999',
                topColors: [],
                dataUrl: '',
                error: err.message,
              }
            }));
          }
        }
        setCurrentProcessing('Hoàn tất toàn bộ 7 tạp chí!');
      } catch (e: any) {
        setCurrentProcessing('Lỗi: ' + e.message);
      }
    }

    loadAll();
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', background: '#f8fafc', minHeight: '100vh' }}>
      <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#0f172a', marginBottom: 8 }}>
        Phân tích chính xác màu sắc 7 Tạp chí VNUHCM
      </h1>
      <div style={{ padding: '8px 16px', background: '#e2e8f0', borderRadius: 8, display: 'inline-block', marginBottom: 24, fontSize: 13, fontWeight: 600 }}>
        {currentProcessing}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 24 }}>
        {JOURNALS.map((j) => {
          const res = results[j.id];
          return (
            <div key={j.id} style={{ background: '#ffffff', borderRadius: 16, padding: 20, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 'bold', margin: '0 0 4px 0', color: '#1e293b' }}>{j.id}</h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{j.name}</p>
                </div>
                {res && !res.error && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: res.bannerColor, border: '1px solid rgba(0,0,0,0.1)' }} />
                    <code style={{ fontSize: 13, fontWeight: 'bold', color: res.bannerColor }}>{res.bannerColor}</code>
                  </div>
                )}
              </div>

              {res?.error && (
                <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>Lỗi: {res.error}</div>
              )}

              {res?.dataUrl && (
                <div style={{ marginTop: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                  <img src={res.dataUrl} alt={j.id} style={{ width: '100%', display: 'block' }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
