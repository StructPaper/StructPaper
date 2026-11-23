'use client';

import React, { useRef } from 'react';
import { Download, FileText, Loader2, RefreshCw, Upload, Sparkles } from 'lucide-react';
import { toast } from '@/components/toast';
import { useEditorSession } from '@/context/EditorSessionContext';
import type { Analysis } from '@/lib/documents/word-source';
import { ImportMergeReviewModal } from './ImportMergeReviewModal';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

const SOLID = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-700 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-60 active:scale-95';
const SOFT = 'inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-zinc-100 text-zinc-800 text-xs font-bold transition-all cursor-pointer disabled:opacity-60 active:scale-95';

/**
 * "File Word đã tải lên" in the dialog of the title bar's "?": the file the paper was imported from, and the two things the author
 * can ask for (both on purpose, nothing runs by itself): read it again with the current importer, or read a new file in its place.
 */
export const WordSourceSection: React.FC = () => {
  const { wordSource: ws } = useEditorSession();
  const input = useRef<HTMLInputElement>(null);
  // kept after the dialog is closed so that it can leave with its animation
  const lastReview = useRef<Analysis | null>(null);
  if (ws?.review) lastReview.current = ws.review;
  if (!ws) return null;

  const working = ws.busy !== 'idle';
  const behind = !!ws.info && ws.info.importerVersion < ws.currentImporterVersion;

  const pick = () => input.current?.click();
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.docx$/i.test(file.name)) return;
    ws.replaceWith(file);
  };

  return (
    <div className="rounded-3xl bg-gray-200/50 p-3.5 space-y-2.5" data-testid="paper-word-source">
      <input ref={input} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="hidden" onChange={onFile} data-testid="paper-word-source-input" />
      <p className="flex items-center gap-2 text-xs font-extrabold text-zinc-900">
        <FileText className="w-4 h-4 shrink-0" />
        File Word đã tải lên
      </p>

      {ws.loading && !ws.info ? (
        <p className="text-[11px] text-zinc-500 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang kiểm tra...</p>
      ) : ws.info ? (
        <>
          <div className="rounded-2xl bg-white/70 px-3 py-2.5 space-y-1" data-testid="paper-word-source-info">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 text-xs font-bold text-zinc-900 break-all">{ws.info.fileName}</p>
              <button
                type="button"
                onClick={() => void ws.download()}
                disabled={working}
                title="Tải file Word về máy"
                aria-label="Tải file Word về máy"
                data-testid="paper-word-source-download"
                className="shrink-0 w-7 h-7 rounded-full bg-zinc-100 hover:bg-[#78C841] text-zinc-700 hover:text-zinc-950 flex items-center justify-center transition-all cursor-pointer disabled:opacity-60 active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-zinc-500">
              Tải lên {fmtDate(ws.info.uploadedAt)} · {fmtSize(ws.info.size)}
            </p>
            <p className="text-[11px] text-zinc-500 flex items-center gap-2 flex-wrap">
              Phiên bản bộ phân tích:
              <span className="px-2 py-0.5 rounded-xl bg-zinc-900 text-white font-extrabold" data-testid="paper-word-source-version">v{ws.info.importerVersion}</span>
              {behind ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold" data-testid="paper-word-source-behind">mới nhất v{ws.currentImporterVersion}</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-[#D9F99D] text-[#14532D] font-bold">mới nhất</span>
              )}
            </p>
          </div>
          {behind && (
            <p className="flex items-start gap-2 text-[11px] font-semibold text-amber-900 leading-relaxed">
              <Sparkles className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>Bộ phân tích file Word đã được cải tiến. Bạn có thể phân tích lại để xem những gì khác đi; bài của bạn chỉ đổi khi bạn chấp nhận.</span>
            </p>
          )}
          {!ws.info.hasBaseline && (
            <p className="text-[11px] text-zinc-600 leading-relaxed">Chưa có bản phân tích gốc của file này: khi phân tích lại, mọi khác biệt đều để bạn tự chọn.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={ws.reanalyze} disabled={working} data-testid="paper-word-source-reanalyze" className={SOLID}>
              {ws.busy === 'analyzing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>{ws.busy === 'analyzing' ? 'Đang phân tích...' : 'Phân tích lại'}</span>
            </button>
            <button type="button" onClick={pick} disabled={working} data-testid="paper-word-source-replace" className={SOFT}>
              <Upload className="w-3.5 h-3.5" />
              <span>Tải file mới thay thế</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[11px] text-zinc-600 leading-relaxed" data-testid="paper-word-source-missing">
            Bài này được nhập trước khi hệ thống lưu file Word gốc nên chưa có file để phân tích lại. Bạn có thể tải file Word của bài lên một lần; hệ thống sẽ lưu file và cho bạn chọn từng thay đổi so với bài hiện tại, không tự ghi đè.
          </p>
          <button type="button" onClick={pick} disabled={working} data-testid="paper-word-source-upload" className={SOLID}>
            {ws.busy === 'analyzing' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>{ws.busy === 'analyzing' ? 'Đang phân tích...' : 'Tải file Word lên'}</span>
          </button>
        </>
      )}

      {ws.error && <p className="text-[11px] font-semibold text-rose-700" data-testid="paper-word-source-error">{ws.error}</p>}

      {lastReview.current && <ImportMergeReviewModal analysis={lastReview.current} isOpen={!!ws.review} busy={ws.busy === 'applying'} replanning={ws.busy === 'replanning'} onApply={(ids) => void ws.apply(ids)} onCancel={ws.cancelReview} onShowEdits={(on) => void ws.showEdits(on)} />}
    </div>
  );
};
