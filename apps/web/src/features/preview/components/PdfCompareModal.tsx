import React from 'react';
import { ExternalLink, Download, X } from 'lucide-react';

interface PdfCompareModalProps {
  pdfUrl?: string;
  onClose: () => void;
}

export const PdfCompareModal: React.FC<PdfCompareModalProps> = ({
  pdfUrl = '/demo-files/ID630_HS-2026-10-02-07-07.pdf',
  onClose,
}) => {
  return (
    <div className="mb-6 soft-card p-4 bg-white border-2 border-[#2B74B7]/40 shadow-lg animate-fade-in">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-200">
        <div>
          <h3 className="font-bold text-sm text-[#2B74B7] flex items-center gap-2">
            <span>Bản PDF Gốc Tạp Chí (13 Trang - ID630 Health Sciences)</span>
            <span className="text-[10px] bg-blue-100 text-[#2B74B7] px-2 py-0.5 rounded-full font-semibold">
              Mẫu đối chiếu 100%
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Đối chiếu trực tiếp bố cục trang, hình ảnh, bảng biểu và danh mục tài liệu tham khảo với bản PDF chính thức.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-pill-subtle text-xs py-1 px-2.5 text-[#2B74B7] hover:underline"
          >
            <span>Mở tab mới</span>
            <ExternalLink className="w-3 h-3 ml-1 inline" />
          </a>
          <a
            href={pdfUrl}
            download="ID630_Sample_Official.pdf"
            className="btn-pill-subtle text-xs py-1 px-2.5 text-gray-700"
          >
            <Download className="w-3 h-3 mr-1 inline" />
            <span>Tải về</span>
          </a>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700"
            title="Đóng bảng so sánh"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="w-full h-[75vh] bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-inner">
        <iframe
          src={`${pdfUrl}#toolbar=1&navpanes=1`}
          className="w-full h-full border-none"
          title="Bản PDF Mẫu Gốc Đối Chiếu"
        />
      </div>
    </div>
  );
};
