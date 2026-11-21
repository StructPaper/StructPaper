'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { LivePreviewPaneProps } from './types';
import {
  PdfInteractiveViewer,
  lastReadPage,
  type PdfFillIssue,
  type PdfPickContext,
  type PdfRotateContext,
} from '@/features/preview';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { useEditorSession } from '@/context/EditorSessionContext';
import type { PaperSection, SectionPageLayout } from '@/types/paper';
import { rotatePageAt } from '@/lib/editor/page-turn';
import { equationIndex, extendRotatedRange, resolveClick } from '@/lib/editor/pdf-click-target';
import { buildFrontIndex, buildSectionIndex, firstNewSectionOnPage, matchLineToFrontTab } from '@/lib/editor/pdf-section-map';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

/** Every section's page-layout marker by id (undefined where it has none). */
const markersOf = (sections: PaperSection[]) => new Map(sections.map((s) => [s.id, s.pageLayout] as [string, SectionPageLayout | undefined]));

export const LivePreviewPane: React.FC<LivePreviewPaneProps> = ({
  paper,
  compiledPdfUrl,
  isCompilingPdf,
  compileStats,
  compileErrorInfo,
  onRecompile,
  onClearError,
  compileStartedAt,
  busyLabel,
  onFocusSection,
  onFocusTab,
  onSectionsChange,
  layoutDefaults = { oneColumn: false, landscape: false },
  interactiveMode: customInteractiveMode,
}) => {
  const [viewerFailed, setViewerFailed] = useState(false);
  const session = useEditorSession();
  const interactiveMode = customInteractiveMode ?? session?.pdfFocusMode ?? false;

  /** Markers as they were before the last turn or fill, so it can be taken back without touching the text. */
  const [snapshot, setSnapshot] = useState<Map<string, SectionPageLayout | undefined> | null>(null);
  const sectionIndex = useMemo(() => buildSectionIndex(paper.sections), [paper.sections]);
  const equations = useMemo(() => equationIndex(paper.sections), [paper.sections]);
  const frontIndex = useMemo(() => buildFrontIndex(paper.metadata, paper.references), [paper.metadata, paper.references]);

  const handlePick = useCallback(
    (ctx: PdfPickContext) => {
      const id = resolveClick(sectionIndex, equations, ctx.lines, ctx.center);
      if (id) return onFocusSection?.(id);
      const tab = matchLineToFrontTab(frontIndex, ctx.lines[ctx.center] ?? '');
      if (tab) onFocusTab?.(tab);
    },
    [sectionIndex, equations, frontIndex, onFocusSection, onFocusTab]
  );

  /** The section that opens the page after a page cut short by an orientation change, when it carries the marker. */
  const fillTarget = useCallback(
    (issue: PdfFillIssue) => {
      const id = firstNewSectionOnPage(sectionIndex, issue.nextLines, issue.lines);
      const sec = id ? paper.sections.find((s) => s.id === id) : undefined;
      return sec?.pageLayout ? sec.id : null;
    },
    [sectionIndex, paper.sections]
  );
  const canFill = useCallback((issue: PdfFillIssue) => !!fillTarget(issue), [fillTarget]);
  const handleFill = useCallback(
    (issue: PdfFillIssue) => {
      const id = fillTarget(issue);
      if (!id) return;
      const updated = extendRotatedRange(paper.sections, id);
      if (updated !== paper.sections) {
        setSnapshot(markersOf(paper.sections));
        onSectionsChange?.(updated);
      }
    },
    [fillTarget, paper.sections, onSectionsChange]
  );

  const handleUndo = useCallback(() => {
    if (!snapshot) return;
    onSectionsChange?.(
      paper.sections.map((s) => {
        if (!snapshot.has(s.id)) return s;
        const { pageLayout: _drop, ...rest } = s;
        const marker = snapshot.get(s.id);
        return (marker ? { ...rest, pageLayout: marker } : rest) as typeof s;
      })
    );
    setSnapshot(null);
  }, [snapshot, paper.sections, onSectionsChange]);

  const handleRotate = useCallback(
    (ctx: PdfRotateContext) => {
      const anchor = firstNewSectionOnPage(sectionIndex, ctx.lines, ctx.prevLines);
      if (!anchor) return;
      const next = ctx.nextLines ? firstNewSectionOnPage(sectionIndex, ctx.nextLines, ctx.lines) : null;
      const updated = rotatePageAt(paper.sections, anchor, next, ctx.orientation, layoutDefaults);
      if (updated !== paper.sections) {
        setSnapshot(markersOf(paper.sections));
        onSectionsChange?.(updated);
      }
      onFocusSection?.(anchor);
    },
    [sectionIndex, paper.sections, layoutDefaults, onSectionsChange, onFocusSection]
  );

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isCompilingPdf) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [isCompilingPdf]);
  const elapsed = isCompilingPdf && compileStartedAt ? Math.max(0, Math.floor((now - compileStartedAt) / 1000)) : 0;
  const [isOverlayActive, setIsOverlayActive] = useState<boolean>(false);
  const [justFinished, setJustFinished] = useState<boolean>(false);
  // "Thử lại" answers at once: the strip turns to "processing" before the request even leaves (saving first can take a moment)
  const [retrying, setRetrying] = useState(false);
  const sawCompile = useRef(false);
  const handleRetry = useCallback(() => {
    sawCompile.current = false;
    setRetrying(true);
    onRecompile?.();
  }, [onRecompile]);
  useEffect(() => {
    if (!retrying) return;
    if (isCompilingPdf) sawCompile.current = true;
    else if (sawCompile.current || compileErrorInfo) setRetrying(false);
  }, [retrying, isCompilingPdf, compileErrorInfo]);
  useEffect(() => {
    if (!retrying) return;
    const t = setTimeout(() => setRetrying(false), 90_000); // never stay stuck
    return () => clearTimeout(t);
  }, [retrying]);

  useEffect(() => {
    if (isCompilingPdf || retrying) {
      setIsOverlayActive(true);
      setJustFinished(false);
    } else if (isOverlayActive) {
      // Just finished compiling: dismiss overlay promptly
      setJustFinished(true);
      const timer = setTimeout(() => {
        setIsOverlayActive(false);
        setJustFinished(false);
      }, 1200); // the green "done" stays at least a second, so a quick compile does not flash by
      return () => clearTimeout(timer);
    }
  }, [isCompilingPdf, isOverlayActive, retrying]);

  const showError = Boolean(compileErrorInfo) && !isCompilingPdf && !retrying;
  const stripState: 'compiling' | 'done' | 'error' = isCompilingPdf || retrying ? 'compiling' : showError ? 'error' : justFinished ? 'done' : 'compiling';
  const errorTitle = compileErrorInfo?.error || 'Không rõ nguyên nhân';
  const errorDetails = compileErrorInfo?.details || compileErrorInfo?.rawLog || '';
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    if (!compileErrorInfo) setShowDetails(false);
  }, [compileErrorInfo]);

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* PDF View Container: the frame stays (room for future tools) but the PDF sits flush to its edges */}
      <div className="soft-card bg-white border border-[#E8E8EE] rounded-3xl overflow-hidden shadow-xs relative h-full flex flex-col min-h-0 flex-1">
        {/* Status strip: grows out of the frame's top edge while compiling, then folds away */}
        <AnimatePresence initial={false}>
          {(isOverlayActive || showError || retrying) && (
            <motion.div
              key="compile-strip"
              initial={isTest ? false : { height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={isTest ? undefined : { height: 0, opacity: 0 }}
              transition={isTest ? { duration: 0 } : { duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
              className="overflow-hidden shrink-0"
            >
              <div
                role="status"
                aria-live="polite"
                aria-busy={isCompilingPdf}
                data-testid="compile-status"
                data-state={stripState}
                className={`border-b transition-colors duration-500 ${
                  stripState === 'error'
                    ? 'bg-red-100 border-red-200 text-red-900'
                    : stripState === 'done'
                      ? 'bg-lime-100 border-lime-200 text-lime-900'
                      : 'bg-amber-100 border-amber-200 text-amber-900'
                }`}
              >
                <div className="px-4 py-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {stripState === 'error' ? (
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={2.75} />
                    ) : stripState === 'done' ? (
                      <span className="w-5 h-5 rounded-full bg-lime-200 text-lime-800 flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    ) : (
                      <Loader2 className="w-4 h-4 animate-spin text-amber-700 shrink-0" strokeWidth={2.75} />
                    )}
                    <span className="font-extrabold text-xs tracking-tight truncate" title={stripState === 'error' ? errorTitle : undefined}>
                      {stripState === 'error'
                        ? `Biên dịch thất bại: ${errorTitle}`
                        : stripState === 'done'
                          ? 'Đã hoàn tất biên dịch PDF'
                          : retrying && !isCompilingPdf ? 'Đang xử lý…' : `${busyLabel || 'Đang biên dịch PDF XeLaTeX…'} ${elapsed > 0 ? `${elapsed}s` : ''}`}
                    </span>
                  </div>
                  {stripState === 'compiling' && elapsed >= 5 && (
                    <span className="hidden sm:block text-[11px] text-amber-800/80 shrink-0">
                      Thường mất 15–40 giây, vui lòng đợi…
                    </span>
                  )}
                  {stripState === 'error' && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {errorDetails && (
                        <button
                          type="button"
                          onClick={() => setShowDetails((v) => !v)}
                          aria-expanded={showDetails}
                          className="px-2.5 py-1 text-red-700 hover:bg-red-200/60 rounded-lg text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          {showDetails ? 'Ẩn chi tiết' : 'Chi tiết'}
                        </button>
                      )}
                      {onRecompile && (
                        <button
                          type="button"
                          onClick={handleRetry}
                          className="px-2.5 py-1 bg-white border border-red-200 text-red-700 rounded-lg text-[11px] font-bold hover:bg-red-50 cursor-pointer transition-colors"
                        >
                          Thử lại
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onClearError}
                        aria-label="Đóng thông báo lỗi"
                        className="w-6 h-6 rounded-full text-red-500 hover:bg-red-200/60 flex items-center justify-center cursor-pointer transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {stripState === 'error' && showDetails && errorDetails && (
                    <motion.pre
                      key="compile-error-details"
                      initial={isTest ? false : { height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={isTest ? undefined : { height: 0, opacity: 0 }}
                      transition={isTest ? { duration: 0 } : { duration: 0.25, ease: 'easeOut' }}
                      className="mx-4 mb-2 overflow-auto max-h-40 whitespace-pre-wrap break-words rounded-xl bg-white/70 border border-red-200 p-2.5 font-mono text-[11px] leading-relaxed text-red-950"
                    >
                      {errorDetails}
                    </motion.pre>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* The PDF Viewport Wrapper - 100% full height */}
        <div className="w-full flex-1 min-h-0 overflow-hidden bg-zinc-100">
          {compiledPdfUrl && interactiveMode && !viewerFailed ? (
            // "Focus định vị" on: our own viewer, which knows the page being read and keeps it when the PDF is made again
            <PdfInteractiveViewer
              url={compiledPdfUrl}
              placeKey={paper.id}
              onPickText={interactiveMode && onFocusSection ? handlePick : undefined}
              onRotatePage={interactiveMode && onSectionsChange ? handleRotate : undefined}
              canFill={canFill}
              onFillPage={interactiveMode && onSectionsChange ? handleFill : undefined}
              onUndoTurn={interactiveMode && snapshot ? handleUndo : undefined}
              onLoadError={() => setViewerFailed(true)}
            />
          ) : compiledPdfUrl ? (
            // keyed by the PDF: changing an iframe's src adds an entry to the browser history (one more "back" per recompile); a new iframe does not
            <iframe
              key={compiledPdfUrl}
              // "Focus định vị" off: the browser's own PDF viewer, opened on the page last read in the other viewer (it cannot report its own)
              src={`${compiledPdfUrl}#toolbar=1&navpanes=0${lastReadPage(paper.id) > 1 ? `&page=${lastReadPage(paper.id)}` : ''}`}
              className="w-full h-full border-none"
              title="XeLaTeX Compiled PDF Live Preview"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-400 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-3xl bg-zinc-200/70 flex items-center justify-center shadow-2xs">
                <RefreshCw className="w-6 h-6 text-zinc-400" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-zinc-700">Chưa có bản xem trước PDF</p>
                <p className="text-[11px] text-zinc-500 max-w-xs leading-relaxed">
                  Bấm nút &quot;Biên dịch ngay&quot; ở thanh công cụ để tạo và xem trước bản PDF dàn trang chuẩn tạp chí.
                </p>
              </div>
              {onRecompile && (
                <button
                  type="button"
                  onClick={onRecompile}
                  disabled={isCompilingPdf}
                  aria-busy={isCompilingPdf}
                  className="btn-pill-lime text-xs px-3.5 py-1.5 flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer mt-1 disabled:opacity-60 disabled:cursor-wait disabled:hover:scale-100"
                >
                  {isCompilingPdf ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  <span>{isCompilingPdf ? 'Đang biên dịch…' : 'Biên dịch ngay'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
