'use client';

import React, { useState } from 'react';
import { AlertTriangle, X, Terminal, ExternalLink, Download } from 'lucide-react';

export interface CompileErrorInfo {
  error: string;
  details?: string;
  engine?: string;
  rawLog?: string;
}

interface CompileErrorModalProps {
  errorInfo: CompileErrorInfo;
  onClose: () => void;
  latexCode?: string;
}

export const CompileErrorModal: React.FC<CompileErrorModalProps> = ({
  errorInfo,
  onClose,
  latexCode,
}) => {
  const [showFullLog, setShowFullLog] = useState<boolean>(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl max-w-2xl w-full border border-red-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-red-50 border-b border-red-200 px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-red-900">
                Báo Cáo Lỗi Biên Dịch {errorInfo.engine && errorInfo.engine !== 'None' ? errorInfo.engine : 'LaTeX'}
              </h3>
              <p className="text-[11px] text-red-700">
                Hệ thống báo lỗi trung thực theo lệnh biên dịch, không sử dụng cơ chế nạp sẵn (no fallback)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-red-100 text-red-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Main error message */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-red-900 font-semibold flex items-start gap-2.5">
            <span className="w-2 h-2 rounded-full bg-red-500 mt-1 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-bold text-sm text-red-900">{errorInfo.error}</p>
              {errorInfo.engine && errorInfo.engine !== 'None' && (
                <p className="text-xs text-red-700">Engine thực thi: {errorInfo.engine}</p>
              )}
            </div>
          </div>

          {/* Details / Instructions */}
          {errorInfo.details && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3.5 text-gray-800 space-y-2">
              <p className="font-bold text-gray-900 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-[#2B74B7]" />
                <span>Chi tiết kỹ thuật &amp; Hướng dẫn khắc phục:</span>
              </p>
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-700 bg-white p-3 rounded-lg border border-gray-200 overflow-x-auto">
                {errorInfo.details}
              </pre>
            </div>
          )}

          {/* Raw Log viewer (if available) */}
          {errorInfo.rawLog && (
            <div>
              <button
                onClick={() => setShowFullLog(!showFullLog)}
                className="text-xs text-[#2B74B7] hover:underline font-semibold flex items-center gap-1 mb-1.5"
              >
                <span>{showFullLog ? '▼ Thu gọn' : '▶ Xem toàn bộ'} Nhật ký biên dịch LaTeX (article.log)</span>
              </button>

              {showFullLog && (
                <pre className="bg-[#1E1E2E] text-[#CDD6F4] font-mono text-[10px] p-3 rounded-xl max-h-60 overflow-auto whitespace-pre leading-snug">
                  {errorInfo.rawLog}
                </pre>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="bg-gray-50 border-t border-gray-200 px-5 py-3 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <a
              href="https://miktex.org/download"
              target="_blank"
              rel="noreferrer"
              className="btn-pill-subtle text-xs py-1.5 px-3 bg-white hover:bg-gray-100 flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5 text-gray-600" />
              <span>Tải MiKTeX Windows (200MB)</span>
            </a>

            {latexCode && (
              <form
                action="https://www.overleaf.com/docs"
                method="POST"
                target="_blank"
                className="inline-block"
              >
                <input type="hidden" name="snip" value={latexCode} />
                <button
                  type="submit"
                  className="btn-pill-green text-xs py-1.5 px-3 font-bold flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Biên Dịch Qua Overleaf</span>
                </button>
              </form>
            )}
          </div>

          <button
            onClick={onClose}
            className="btn-pill-subtle text-xs py-1.5 px-4 font-bold bg-gray-200 hover:bg-gray-300 text-gray-800"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
