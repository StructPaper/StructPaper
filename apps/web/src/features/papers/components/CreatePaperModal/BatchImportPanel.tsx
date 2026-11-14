'use client';

import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Download, FileText, Loader2, RotateCcw, XCircle, ExternalLink, Ban } from 'lucide-react';
import type { BatchItem } from '@/lib/batch-import/types';
import { itemStatus, saveBlob, summarize } from '@/lib/batch-import/summary';
import { safeFileName, zipPdfs } from '@/lib/batch-import/zip-pdfs';

interface BatchImportPanelProps {
  items: BatchItem[];
  running: boolean;
  skipped?: number;
  onCancel: () => void;
  onRetry: () => void;
  onOpen: (item: BatchItem) => void;
  onClose: () => void;
}

const kb = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function StageIcon({ it }: { it: BatchItem }) {
  if (it.stage === 'done') return it.compileError ? <AlertCircle className="w-4 h-4 text-amber-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (it.stage === 'error') return <XCircle className="w-4 h-4 text-rose-500" />;
  if (it.stage === 'cancelled') return <Ban className="w-4 h-4 text-slate-400" />;
  if (it.stage === 'queued' || it.stage === 'waiting') return <Clock className="w-4 h-4 text-slate-400" />;
  return <Loader2 className="w-4 h-4 text-[#78C841] animate-spin" />;
}

/** Progress and result of a multi-file import: one row per Word file, all running side by side. */
export const BatchImportPanel: React.FC<BatchImportPanelProps> = ({ items, running, skipped = 0, onCancel, onRetry, onOpen, onClose }) => {
  const sum = summarize(items);
  const percent = Math.round(sum.progress * 100);

  const downloadAll = async () => {
    const zip = await zipPdfs(items);
    if (zip) saveBlob(zip, 'bai-bao-pdf.zip');
  };

  return (
    <div className="space-y-3" data-testid="batch-panel">
      <div>
        <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1.5">
          <span data-testid="batch-summary">
            {running
              ? `Đang xử lý ${sum.finished}/${sum.total} bài…`
              : `Hoàn thành ${sum.created}/${sum.total} bài báo${sum.failed ? ` · ${sum.failed} lỗi` : ''}${sum.cancelled ? ` · ${sum.cancelled} đã hủy` : ''}${sum.pdfFailed ? ` · ${sum.pdfFailed} chưa có PDF` : ''}`}
          </span>
          <span className="tabular-nums text-slate-500">{percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#78C841] transition-all duration-300" style={{ width: `${percent}%` }} />
        </div>
        {skipped > 0 && <p className="mt-1.5 text-[11px] text-amber-600 font-semibold">Đã bỏ qua {skipped} tệp không phải Word (.docx / .doc).</p>}
      </div>

      <ul className="max-h-[46vh] overflow-y-auto space-y-1.5 pr-1 custom-scrollbar" data-testid="batch-list">
        {items.map((it) => (
          <li
            key={it.key}
            data-testid="batch-item"
            data-stage={it.stage}
            className="rounded-2xl bg-white border border-slate-200 px-3.5 py-2.5 flex items-start gap-3"
          >
            <div className="mt-0.5 shrink-0">
              <StageIcon it={it} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[13px] font-bold text-slate-900">
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate" title={it.fileName}>
                  {it.title || it.fileName}
                </span>
                {it.journalAbbv && (
                  <span data-testid="batch-item-journal" className="shrink-0 px-1.5 py-0.5 rounded-md bg-zinc-900 text-white text-[10px] font-black">
                    {it.journalAbbv}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 truncate" title={it.title ? it.fileName : undefined}>
                {it.title ? `${it.fileName} · ` : ''}
                {kb(it.size)}
              </div>
              <div
                data-testid="batch-item-status"
                className={`text-[11px] font-semibold mt-0.5 ${it.stage === 'error' ? 'text-rose-600' : it.compileError ? 'text-amber-600' : it.stage === 'done' ? 'text-emerald-600' : 'text-slate-600'}`}
              >
                {itemStatus(it)}
                {it.pdf ? ` · PDF ${kb(it.pdf.blob.size)}, ${(it.pdf.ms / 1000).toFixed(1)}s` : ''}
              </div>
              {it.paperId && (it.errors > 0 || it.warnings > 0) && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Kiểm tra nhập: {it.errors > 0 ? <b className="text-rose-600">{it.errors} lỗi</b> : null}
                  {it.errors > 0 && it.warnings > 0 ? ' · ' : ''}
                  {it.warnings > 0 ? <b className="text-amber-600">{it.warnings} cảnh báo</b> : null}
                  <span> (xem trong trình soạn)</span>
                </div>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-1">
              {it.pdf && (
                <button
                  type="button"
                  title="Tải PDF"
                  data-testid="batch-item-download"
                  onClick={() => saveBlob(it.pdf!.blob, `${safeFileName(it.title || '', it.fileName)}.pdf`)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                </button>
              )}
              {it.paperId && it.stage !== 'error' && (
                <button
                  type="button"
                  data-testid="batch-item-open"
                  onClick={() => onOpen(it)}
                  title={it.stage === 'done' ? 'Mở trong trình soạn' : 'Bài đã lưu, có thể mở ngay (PDF vẫn đang biên dịch)'}
                  className="inline-flex items-center gap-1 px-3 h-8 rounded-full text-[11px] font-extrabold bg-zinc-900 text-white hover:bg-zinc-700 cursor-pointer"
                >
                  <ExternalLink className="w-3 h-3" /> Mở
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-end gap-2">
        {running ? (
          <button
            type="button"
            data-testid="batch-cancel"
            onClick={onCancel}
            className="px-4 h-9 rounded-full text-xs font-extrabold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 cursor-pointer"
          >
            Hủy các tệp chưa xong
          </button>
        ) : (
          <>
            {sum.retryable > 0 && (
              <button
                type="button"
                data-testid="batch-retry"
                onClick={onRetry}
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-extrabold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Thử lại {sum.retryable} bài
              </button>
            )}
            {sum.withPdf > 1 && (
              <button
                type="button"
                data-testid="batch-download-all"
                onClick={downloadAll}
                className="inline-flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-extrabold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Tải tất cả PDF (.zip)
              </button>
            )}
            <button
              type="button"
              data-testid="batch-done"
              onClick={onClose}
              className="px-5 h-9 rounded-full text-xs font-extrabold bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950 cursor-pointer"
            >
              Xong
            </button>
          </>
        )}
      </div>
    </div>
  );
};
