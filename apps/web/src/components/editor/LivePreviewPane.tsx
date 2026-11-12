'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LivePreviewPaneProps } from './types';
import { CompileErrorModal } from '../preview/CompileErrorModal';
import { exportToLatex } from '@/lib/exporters';
import { RefreshCw, AlertTriangle, Check, Loader2 } from 'lucide-react';
import type { PaperSection, SectionPageLayout } from '@/types/paper';
import { PdfInteractiveViewer, type PdfFillIssue, type PdfPickContext, type PdfRotateContext } from '../preview/PdfInteractiveViewer';
import { rotatePageAt } from '@/lib/editor/page-turn';
import { equationIndex, extendRotatedRange, resolveClick } from '@/lib/editor/pdf-click-target';
import { buildFrontIndex, buildSectionIndex, firstNewSectionOnPage, matchLineToFrontTab } from '@/lib/editor/pdf-section-map';

/** Every section's page-layout marker by id (undefined where it has none). */
const markersOf = (sections: PaperSection[]) => new Map(sections.map((s) => [s.id, s.pageLayout] as [string, SectionPageLayout | undefined]));

export const LivePreviewPane: React.FC<LivePreviewPaneProps> = ({
  paper,
  compiledPdfUrl,
  isCompilingPdf,
  compileErrorInfo,
  onRecompile,
  onClearError,
  compileStartedAt,
  busyLabel,
  onFocusSection,
  onFocusTab,
  onSectionsChange,
  layoutDefaults = { oneColumn: false, landscape: false },
}) => {
  const [viewerFailed, setViewerFailed] = useState(false);
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

  useEffect(() => {
    if (isCompilingPdf) {
      setIsOverlayActive(true);
      setJustFinished(false);
    } else if (isOverlayActive) {
      // Just finished compiling: show finished checkmark state and hold blur for 1s
      setJustFinished(true);
      const timer = setTimeout(() => {
        setIsOverlayActive(false);
        setJustFinished(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isCompilingPdf, isOverlayActive]);

  return (
    <div className="h-full flex flex-col min-h-0 space-y-2">
      {/* Compilation Error notification */}
      {compileErrorInfo && !isCompilingPdf && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs space-y-2 flex-shrink-0">
          <div className="flex items-start gap-2 text-red-800 font-bold">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p>Biên dịch thất bại: {compileErrorInfo.error}</p>
              {compileErrorInfo.engine && (
                <p className="text-[11px] font-normal text-red-600">
                  Engine: {compileErrorInfo.engine}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={onRecompile}
              className="px-2.5 py-1 bg-white border border-red-200 text-red-700 rounded-lg text-xs font-bold hover:bg-red-100/50 cursor-pointer"
            >
              Thử lại
            </button>
            <button
              type="button"
              onClick={onClearError}
              className="px-2.5 py-1 text-zinc-500 hover:text-zinc-800 text-xs cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {/* PDF View Container - Fits 100% of the height */}
      <div className="soft-card p-2 sm:p-2.5 bg-white border border-[#E8E8EE] rounded-3xl overflow-hidden shadow-xs relative h-full flex flex-col min-h-0 flex-1">
        {/* Subtle Blur Loading Overlay with Liquid Glass Badge */}
        <div
          className={`absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center transition-all duration-500 ease-out ${
            isOverlayActive
              ? `opacity-100 backdrop-blur-[2px] ${compiledPdfUrl ? 'bg-white/40' : 'bg-white/70'} pointer-events-auto`
              : 'opacity-0 backdrop-blur-none bg-transparent pointer-events-none'
          }`}
        >
          <div
            role="status"
            aria-live="polite"
            aria-busy={isCompilingPdf}
            data-testid="compile-status"
            className="liquid-glass-pill px-5 py-2.5 rounded-2xl flex flex-col items-center gap-1 shadow-lg transition-all duration-300"
          >
            <div className="flex items-center gap-2.5">
            {justFinished ? (
              <>
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span className="font-extrabold text-xs text-zinc-900 tracking-tight">
                  Đã hoàn tất biên dịch PDF
                </span>
              </>
            ) : (
              <>
                <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#78C841] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#78C841]"></span>
                </span>
                <span className="font-extrabold text-xs text-zinc-900 tracking-tight">
                  {busyLabel || 'Đang biên dịch PDF XeLaTeX…'} {elapsed > 0 ? `${elapsed}s` : ''}
                </span>
              </>
            )}
            </div>
            {!justFinished && elapsed >= 5 && (
              <span className="text-[11px] text-zinc-600">
                Bản PDF dàn trang thường mất 15–40 giây, vui lòng đợi…
              </span>
            )}
          </div>
        </div>

        {/* The PDF Iframe Wrapper */}
        <div className="w-full flex-1 min-h-0 h-full rounded-2xl overflow-hidden bg-zinc-100 border border-zinc-200 shadow-inner">
          {compiledPdfUrl && !viewerFailed ? (
            <PdfInteractiveViewer
              url={compiledPdfUrl}
              onPickText={onFocusSection ? handlePick : undefined}
              onRotatePage={onSectionsChange ? handleRotate : undefined}
              canFill={canFill}
              onFillPage={onSectionsChange ? handleFill : undefined}
              onUndoTurn={snapshot ? handleUndo : undefined}
              onLoadError={() => setViewerFailed(true)}
            />
          ) : compiledPdfUrl ? (
            <iframe
              src={`${compiledPdfUrl}#toolbar=1&navpanes=0`}
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

      {/* Compile Error Modal if error exists */}
      {compileErrorInfo && (
        <CompileErrorModal
          errorInfo={compileErrorInfo}
          onClose={onClearError}
          latexCode={exportToLatex(paper)}
        />
      )}
    </div>
  );
};
