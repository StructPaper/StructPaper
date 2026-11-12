'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Layers,
  Sliders,
  FileEdit,
  Save,
  RefreshCw,
  Maximize2,
  Check,
} from 'lucide-react';
import { usePlatform } from '@structpaper/platform';
import {
  getWorkflowStatusConfig,
  type WorkflowStatus,
} from '@/components/papers/types';

import { DockIconButton } from './DockIconButton';
import { DockDownloadMenu } from './DockDownloadMenu';
import { DockStatusMenu } from './DockStatusMenu';
export { DockIconButton } from './DockIconButton';
export type { DockIconButtonProps } from './DockIconButton';

interface EditorLeftDockProps {
  onOpenQuickEdit?: () => void;
  onOpenExtractedDrawer: () => void;
  onOpenLayoutSettings: () => void;
  onSave: () => void;
  saveSuccess: boolean;
  isDirty?: boolean;
  onRecompile: () => void;
  isCompiling: boolean;
  onDownloadDocx: () => void;
  isExportingDocx: boolean;
  onDownloadZip: () => void;
  onDownloadXml?: () => void;
  onDownloadXmlPackage?: () => void;
  isExportingXml?: boolean;
  isExportingZip: boolean;
  onDownloadPdf?: () => void;
  isExportingPdf?: boolean;
  compiledPdfUrl: string | null;
  qcScore: number;
  hasErrors?: boolean;
  hasWarnings?: boolean;
  errorCount?: number;
  warningCount?: number;
  onOpenQCTab?: () => void;
  homeHref?: string;
  onBackClick?: () => void;
  autosaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  onDownloadTypst?: () => void;
  isExportingTypst?: boolean;
  workflowStatus?: WorkflowStatus | string;
  onUpdateWorkflowStatus?: (newStatus: WorkflowStatus) => void;
  onOpenFullscreenPdf?: () => void;
  paperId?: string;
}

export const EditorLeftDock: React.FC<EditorLeftDockProps> = ({
  onOpenQuickEdit,
  onOpenExtractedDrawer,
  onOpenLayoutSettings,
  onSave,
  saveSuccess,
  isDirty,
  onRecompile,
  isCompiling,
  onDownloadDocx,
  isExportingDocx,
  onDownloadZip,
  onDownloadXml,
  onDownloadXmlPackage,
  isExportingXml,
  isExportingZip,
  onDownloadPdf,
  isExportingPdf = false,
  compiledPdfUrl,
  qcScore,
  hasErrors = false,
  hasWarnings = false,
  errorCount = 0,
  warningCount = 0,
  onOpenQCTab,
  homeHref = '/upload',
  onBackClick,
  autosaveStatus = 'idle',
  onDownloadTypst,
  isExportingTypst = false,
  workflowStatus = 'draft',
  onUpdateWorkflowStatus,
  onOpenFullscreenPdf,
  paperId,
}) => {
  let router: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    // Fallback for headless testing environments where AppRouter is not mounted
  }

  let isDesktop = false;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const platform = usePlatform();
    isDesktop = platform.capabilities.kind === 'desktop';
  } catch {
    isDesktop = false;
  }

  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  const [isDownloadOpen, setIsDownloadOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const downloadMenuRef = useRef<HTMLDivElement>(null);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const currentStatusConfig = getWorkflowStatusConfig(workflowStatus);

  const WORKFLOW_STATUS_THEMES: Record<WorkflowStatus, { innerShadow: string; border: string }> = {
    draft: {
      innerShadow: 'inset 0 0 20px rgba(100, 116, 139, 0.28)',
      border: 'border-slate-300/70',
    },
    'in-review': {
      innerShadow: 'inset 0 0 20px rgba(217, 119, 6, 0.32)',
      border: 'border-amber-300/70',
    },
    proofing: {
      innerShadow: 'inset 0 0 20px rgba(2, 132, 199, 0.32)',
      border: 'border-sky-300/70',
    },
    ready: {
      innerShadow: 'inset 0 0 20px rgba(101, 163, 13, 0.35)',
      border: 'border-[#78C841]/70',
    },
    published: {
      innerShadow: 'inset 0 0 20px rgba(99, 102, 241, 0.32)',
      border: 'border-indigo-300/70',
    },
  };

  const currentStatusTheme =
    WORKFLOW_STATUS_THEMES[workflowStatus as WorkflowStatus] || WORKFLOW_STATUS_THEMES.draft;

  const springTransition = isTest
    ? { duration: 0 }
    : {
        type: 'spring' as const,
        stiffness: 150,
        damping: 18,
        mass: 0.8,
      };

  useEffect(() => {
    if (!isDownloadOpen && !isStatusOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        isDownloadOpen &&
        downloadMenuRef.current &&
        !downloadMenuRef.current.contains(target)
      ) {
        const triggerBtn = document.getElementById('download-dock-btn');
        if (!triggerBtn || !triggerBtn.contains(target)) {
          setIsDownloadOpen(false);
        }
      }
      if (
        isStatusOpen &&
        statusMenuRef.current &&
        !statusMenuRef.current.contains(target)
      ) {
        const triggerBtn = document.getElementById('status-dock-btn');
        if (!triggerBtn || !triggerBtn.contains(target)) {
          setIsStatusOpen(false);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDownloadOpen(false);
        setIsStatusOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDownloadOpen, isStatusOpen]);

  const isAnyExporting = isExportingDocx || isExportingZip || isExportingPdf || isExportingTypst || !!isExportingXml;

  return (
    <aside
      className="hidden sm:flex flex-col items-center justify-between h-full w-12 sm:w-14 py-2 px-1 flex-shrink-0 select-none relative z-50"
      aria-label="Thanh công cụ trình biên tập"
    >
      {/* TOP SECTION: BACK BUTTON */}
      <div className="relative flex flex-col items-center gap-2.5">
        <DockIconButton
          onClick={() => {
            if (onBackClick) {
              onBackClick();
              return;
            }
            const destination = homeHref || '/papers';
            if (router) router.push(destination);
            else if (typeof window !== 'undefined') window.location.href = destination;
          }}
          label="Quay lại danh sách bài báo"
          icon={<ArrowLeft className="w-5 h-5 text-zinc-700" strokeWidth={2.4} />}
        />
      </div>

      {/* MIDDLE SECTION: FEATURE CLUSTER + ACTION CLUSTER */}
      <div className="relative flex flex-col items-center gap-2.5">
        {/* Feature 0: Quick Edit Paper Info Modal */}
        {onOpenQuickEdit && (
          <DockIconButton
            onClick={onOpenQuickEdit}
            label="Sửa thông tin bài báo"
            icon={<FileEdit className="w-5 h-5 text-zinc-700" strokeWidth={2.4} />}
          />
        )}

        {/* Feature 1: Extracted Content Drawer */}
        <DockIconButton
          onClick={onOpenExtractedDrawer}
          label="Nội dung trích xuất bản thảo"
          icon={<Layers className="w-5 h-5 text-zinc-700" strokeWidth={2.4} />}
        />

        {/* Feature 2: PDF Layout Settings Drawer */}
        <DockIconButton
          onClick={onOpenLayoutSettings}
          label="Cài đặt dàn trang PDF"
          icon={<Sliders className="w-5 h-5 text-zinc-700" strokeWidth={2.4} />}
        />

        {/* Subtle Separator */}
        <div className="w-8 h-[1px] my-3" />

        {/* Action 1: Save Changes */}
        <DockIconButton
          onClick={onSave}
          label={
            saveSuccess || autosaveStatus === 'saved'
              ? 'Đã lưu thành công!'
              : autosaveStatus === 'saving'
                ? 'Đang tự động lưu...'
                : autosaveStatus === 'error'
                  ? 'Lỗi tự động lưu'
                  : isDirty
                    ? 'Lưu thay đổi bản thảo (Ctrl+S)'
                    : 'Lưu thay đổi bản thảo'
          }
          icon={<Save className="w-4 h-4 text-zinc-700" strokeWidth={2.8} />}
          badge={
            saveSuccess || autosaveStatus === 'saved' ? (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#78C841] border-2 border-white flex items-center justify-center shadow-sm">
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </span>
            ) : autosaveStatus === 'saving' ? (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border border-white animate-pulse" />
            ) : autosaveStatus === 'error' ? (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-rose-500 border border-white" />
            ) : isDirty ? (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />
            ) : null
          }
        />

        {/* Action 2: Recompile */}
        <DockIconButton
          onClick={onRecompile}
          disabled={isCompiling}
          label={isCompiling ? 'Đang biên dịch LaTeX...' : 'Biên dịch lại PDF'}
          icon={
            <RefreshCw
              className={`w-4 h-4 text-zinc-700 ${isCompiling ? 'animate-spin text-[#78C841]' : ''}`}
              strokeWidth={2.8}
            />
          }
        />

        <DockDownloadMenu
          isDownloadOpen={isDownloadOpen}
          setIsDownloadOpen={setIsDownloadOpen}
          setIsStatusOpen={setIsStatusOpen}
          downloadMenuRef={downloadMenuRef}
          isTest={isTest}
          springTransition={springTransition}
          isExportingDocx={isExportingDocx}
          isExportingPdf={isExportingPdf}
          isExportingZip={isExportingZip}
          isExportingTypst={isExportingTypst}
          isAnyExporting={isAnyExporting}
          onDownloadDocx={onDownloadDocx}
          onDownloadPdf={onDownloadPdf}
          onDownloadZip={onDownloadZip}
          onDownloadXml={onDownloadXml}
          onDownloadXmlPackage={onDownloadXmlPackage}
          isExportingXml={isExportingXml}
          onDownloadTypst={onDownloadTypst}
          compiledPdfUrl={compiledPdfUrl}
        />

        <DockStatusMenu
          setIsDownloadOpen={setIsDownloadOpen}
          setIsStatusOpen={setIsStatusOpen}
          isStatusOpen={isStatusOpen}
          statusMenuRef={statusMenuRef}
          isTest={isTest}
          springTransition={springTransition}
          workflowStatus={workflowStatus}
          currentStatusConfig={currentStatusConfig}
          currentStatusTheme={currentStatusTheme}
          onUpdateWorkflowStatus={onUpdateWorkflowStatus}
        />

        {/* Action 4: Maximize / Fullscreen PDF */}
        {compiledPdfUrl && (
          <DockIconButton
            id="maximize-pdf-dock-btn"
            onClick={() => {
              if (onOpenFullscreenPdf) {
                onOpenFullscreenPdf();
              } else if (isDesktop) {
                const destination = paperId ? `/preview?id=${paperId}` : '/preview';
                if (router) router.push(destination);
                else if (typeof window !== 'undefined') window.location.href = destination;
              } else {
                if (typeof window !== 'undefined') {
                  window.open(compiledPdfUrl, '_blank', 'noreferrer');
                }
              }
            }}
            label={isDesktop ? 'Mở PDF toàn màn hình' : 'Mở PDF toàn màn hình trong tab mới'}
            icon={<Maximize2 className="w-4 h-4 text-zinc-700" strokeWidth={2.8} />}
          />
        )}
      </div>

      {/* BOTTOM SECTION: MANUSCRIPT QUALITY PERCENTAGE SCORE */}
      <div className="relative flex flex-col items-center pt-1 w-full">
        <div className="w-6 h-[1px] mb-2" />
        <DockIconButton
          onClick={onOpenQCTab}
          label={`Chất lượng bản thảo: ${qcScore}%${
            hasErrors
              ? ` (${errorCount} lỗi cần xử lý)`
              : hasWarnings
                ? ` (${warningCount} cảnh báo)`
                : ' (Đạt tiêu chuẩn)'
          }`}
          badge={
            hasErrors ? (
              <span className="absolute top-2.5 right-2.5 flex items-center justify-center pointer-events-none">
                <motion.span
                  className="w-2 h-2 rounded-full bg-[#FB4141] ring-1.5 ring-white/90 shadow-[0_1px_3px_rgba(251,65,65,0.4)]"
                  animate={{
                    opacity: [1, 0.45, 1],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                />
              </span>
            ) : null
          }
          customContent={
            <div className="flex flex-col items-center justify-center">
              <span
                className={`text-[11px] font-extrabold leading-none tracking-tight transition-colors duration-200 ${
                  hasErrors
                    ? 'text-[#FB4141]'
                    : hasWarnings
                      ? 'text-[#FF9B2F]'
                      : 'text-[#14532D]'
                }`}
              >
                {qcScore}%
              </span>
            </div>
          }
          active
        />
      </div>
    </aside>
  );
};
