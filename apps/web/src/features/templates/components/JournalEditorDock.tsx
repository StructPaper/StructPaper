'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  FileEdit,
  RefreshCw,
  Save,
} from 'lucide-react';
import { JournalStatus } from '@/lib/templates/journal-storage';

interface DockIconButtonProps {
  id?: string;
  icon?: React.ReactNode;
  customContent?: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
  containerRef?: React.RefObject<HTMLDivElement>;
  suppressTooltip?: boolean;
}

const DockIconButton: React.FC<DockIconButtonProps> = ({
  id,
  icon,
  customContent,
  label,
  onClick,
  active,
  disabled,
  badge,
  containerRef,
  suppressTooltip,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 700);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`relative flex items-center justify-center ${showTooltip ? 'z-[100]' : ''}`}
    >
      <button
        id={id}
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        title={label}
        className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-200 select-none cursor-pointer relative ${
          active
            ? 'bg-white/90 text-zinc-950 font-bold shadow-[inset_0_0_14px_6px_rgba(255,255,255,0.95),0_0_16px_rgba(0,0,0,0.10),0_0_4px_rgba(0,0,0,0.06)] border border-white scale-105'
            : 'bg-white/60 hover:bg-white/90 backdrop-blur-md shadow-[inset_0_0_14px_6px_rgba(255,255,255,0.85),0_0_12px_rgba(0,0,0,0.04),0_0_4px_rgba(0,0,0,0.03)] hover:shadow-[inset_0_0_16px_8px_rgba(255,255,255,0.95),0_0_18px_rgba(0,0,0,0.10),0_0_6px_rgba(0,0,0,0.05)] text-zinc-700 hover:text-zinc-950 hover:scale-105 active:scale-95'
        } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
      >
        {customContent || icon}
        {badge}
      </button>

      {/* Liquid Glass Tooltip matching EditorLeftDock */}
      <AnimatePresence>
        {showTooltip && !suppressTooltip && !active && (
          <div className="absolute left-[62px] top-1/2 -translate-y-1/2 z-[100] pointer-events-none whitespace-nowrap">
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.95 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-10 px-3.5 rounded-3xl flex items-center gap-2 bg-white/85 backdrop-blur-sm border border-white/80 shadow-[inset_0_0_14px_6px_rgba(255,255,255,0.85),0_4px_20px_rgba(0,0,0,0.08),0_1px_6px_rgba(0,0,0,0.04)] text-zinc-800 font-extrabold text-xs tracking-tight drop-shadow-xl"
            >
              {label}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export interface JournalEditorDockProps {
  status: JournalStatus;
  onToggleStatus: () => void;
  onReset: () => void;
  onRecompile: () => void;
  isCompiling: boolean;
  onSave: () => void;
  isSaving: boolean;
  isDirty?: boolean;
  saveSuccess?: boolean;
}

export const JournalEditorDock: React.FC<JournalEditorDockProps> = ({
  status,
  onToggleStatus,
  onReset,
  onRecompile,
  isCompiling,
  onSave,
  isSaving,
  isDirty = false,
  saveSuccess = false,
}) => {
  let router: any = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter();
  } catch {
    // Fallback for headless environments
  }

  const isPublished = status === 'published';

  const handleBack = () => {
    if (router) {
      router.push('/templates');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/templates';
    }
  };

  return (
    <aside
      className="hidden sm:flex flex-col items-center justify-between h-full w-12 sm:w-14 py-2 px-1 flex-shrink-0 select-none relative z-50"
      aria-label="Thanh công cụ trình biên tập mẫu tạp chí"
    >
      {/* TOP SECTION: BACK BUTTON */}
      <div className="relative flex flex-col items-center gap-2.5">
        <DockIconButton
          onClick={handleBack}
          label="Quay lại danh mục mẫu tạp chí"
          icon={<ArrowLeft className="w-5 h-5 text-zinc-700" strokeWidth={2.4} />}
        />
      </div>

      {/* MIDDLE SECTION: CORE TEMPLATE ACTIONS */}
      <div className="relative flex flex-col items-center gap-2.5">
        {/* Action 1: Reset to Base */}
        <DockIconButton
          onClick={onReset}
          label="Khôi phục cấu hình Base mặc định"
          icon={<RotateCcw className="w-5 h-5 text-zinc-700" strokeWidth={2.4} />}
        />

        {/* Action 2: Toggle Status (Draft vs Published) */}
        <DockIconButton
          onClick={onToggleStatus}
          label={
            isPublished
              ? 'Đang phát hành (Nhấn để chuyển thành Bản nháp)'
              : 'Bản nháp (Nhấn để chuyển thành Đang phát hành)'
          }
          icon={
            isPublished ? (
              <CheckCircle2 className="w-5 h-5 text-[#78C841]" strokeWidth={2.4} />
            ) : (
              <FileEdit className="w-5 h-5 text-amber-600" strokeWidth={2.4} />
            )
          }
          badge={
            <span
              className={`absolute top-2.5 right-2.5 w-2 h-2 rounded-full ${
                isPublished ? 'bg-[#78C841]' : 'bg-amber-500'
              }`}
            />
          }
        />

        {/* Action 3: Recompile Preview */}
        <DockIconButton
          onClick={onRecompile}
          disabled={isCompiling}
          label={isCompiling ? 'Đang biên dịch lại PDF...' : 'Biên dịch lại xem thử (Recompile)'}
          icon={
            <RefreshCw
              className={`w-5 h-5 text-zinc-700 ${isCompiling ? 'animate-spin text-[#78C841]' : ''}`}
              strokeWidth={2.4}
            />
          }
        />

        {/* Subtle Separator */}
        <div className="w-8 h-[1px] my-3" />

        {/* Action 4: Save Changes */}
        <DockIconButton
          onClick={onSave}
          disabled={isSaving}
          label={saveSuccess ? 'Đã lưu thành công!' : isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
          icon={<Save className="w-5 h-5 text-zinc-700" strokeWidth={2.4} />}
          badge={
            saveSuccess ? (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#78C841] border-2 border-white flex items-center justify-center shadow-2xs">
                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
              </span>
            ) : isDirty ? (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white" />
            ) : null
          }
        />
      </div>

      {/* BOTTOM SECTION: STATUS BADGE PILL (Styled like Editor's QC pill) */}
      <div className="relative z-10 flex flex-col items-center pt-1 w-full">
        <div className="w-6 h-[1px] mb-2" />
        <DockIconButton
          onClick={onToggleStatus}
          label={
            isPublished
              ? 'Hồ sơ đang phát hành công khai (PUB)'
              : 'Hồ sơ đang lưu trữ bản nháp (DRAFT)'
          }
          customContent={
            <div className="flex flex-col items-center justify-center">
              <span
                className={`text-[11px] font-extrabold leading-none tracking-tight ${
                  isPublished ? 'text-[#14532D]' : 'text-amber-700'
                }`}
              >
                {isPublished ? 'PUB' : 'DRAFT'}
              </span>
            </div>
          }
        />
      </div>
    </aside>
  );
};
