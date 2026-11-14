import React from 'react';
import { ExternalLink, Download, FileCheck, Layers } from 'lucide-react';

interface PdfNativeViewerProps {
  pdfUrl?: string;
}

export const PdfNativeViewer: React.FC<PdfNativeViewerProps> = ({
  pdfUrl = '/demo-files/ID630_HS-2026-10-02-07-07.pdf',
}) => {
  return (
    <div className="space-y-3">
      {/* Informational banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-2xl text-xs flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0 font-bold">
            <FileCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-sm text-[#1E3A8A]">
              Bản PDF Gốc Tạp chí – 100% Khớp Định Dạng LaTeX (13 Trang)
            </p>
            <p className="text-gray-600 text-[11px]">
              Tạp chí Phát triển Khoa học và Công nghệ – Health Sciences 2026, 7(2):804–816. Mã bài: ID630.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-pill-subtle text-xs py-1.5 px-3 bg-white hover:bg-gray-50 text-[#2B74B7] font-semibold border-blue-200"
          >
            <span>Mở toàn màn hình</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <a
            href={pdfUrl}
            download="ID630_HealthSciences_2026_Official.pdf"
            className="btn-pill-subtle text-xs py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold border-none"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Tải file PDF</span>
          </a>
        </div>
      </div>

      {/* Embedded 13-page PDF Frame */}
      <div className="w-full h-[88vh] bg-gray-200 rounded-2xl overflow-hidden border border-zinc-200 shadow-md relative">
        <iframe
          src={`${pdfUrl}#toolbar=1&navpanes=1&scrollbar=1`}
          className="w-full h-full border-none"
          title="Bản PDF Gốc Tạp chí VNUHCM"
        />
      </div>
    </div>
  );
};
