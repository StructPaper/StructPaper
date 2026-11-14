'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Sliders,
  Layers,
  Type,
  Eye,
  Save,
  Settings,
  Palette,
  Check,
  LayoutGrid,
  Sparkles,
} from 'lucide-react';
import { BuilderStudioStep } from '@/types/template-builder';

interface DockIconButtonProps {
  id?: string;
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
  containerRef?: React.Ref<HTMLDivElement>;
}

const DockIconButton: React.FC<DockIconButtonProps> = ({
  id,
  icon,
  label,
  onClick,
  href,
  active,
  disabled,
  badge,
  containerRef,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    hoverTimerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 600);
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

  const buttonInner = (
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
        className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-200 select-none cursor-pointer relative ${
          active
            ? 'bg-white/95 text-zinc-950 font-bold shadow-[inset_0_0_14px_6px_rgba(255,255,255,0.95),0_0_16px_rgba(0,0,0,0.10),0_0_4px_rgba(0,0,0,0.06)] border border-white scale-105 ring-2 ring-[#78C841]/50'
            : 'bg-white/60 hover:bg-white/90 backdrop-blur-md shadow-[inset_0_0_14px_6px_rgba(255,255,255,0.85),0_0_12px_rgba(0,0,0,0.04),0_0_4px_rgba(0,0,0,0.03)] hover:shadow-[inset_0_0_16px_8px_rgba(255,255,255,0.95),0_0_18px_rgba(0,0,0,0.10),0_0_6px_rgba(0,0,0,0.05)] text-zinc-700 hover:text-zinc-950 hover:scale-105 active:scale-95'
        } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        aria-label={label}
      >
        {icon}
        {badge}
      </button>

      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <div className="absolute left-[62px] top-1/2 -translate-y-1/2 z-[100] pointer-events-none whitespace-nowrap">
            <motion.div
              initial={{ opacity: 0, x: -8, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -8, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-10 px-3.5 rounded-3xl flex items-center gap-2 bg-white/90 backdrop-blur-md border border-white/80 shadow-[inset_0_0_14px_6px_rgba(255,255,255,0.85),0_4px_20px_rgba(0,0,0,0.08),0_1px_6px_rgba(0,0,0,0.04)] text-zinc-800 font-extrabold text-xs tracking-tight drop-shadow-xl"
            >
              {label}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="outline-none" tabIndex={-1}>
        {buttonInner}
      </Link>
    );
  }

  return buttonInner;
};

interface TemplateBuilderDockProps {
  currentStep: BuilderStudioStep;
  onStepChange: (step: BuilderStudioStep) => void;
  onSaveToLibrary: () => void;
  onExportJson: () => void;
  onTriggerImport: () => void;
  primaryColor?: string;
  onColorChange?: (color: string) => void;
  saveSuccess?: boolean;
  isDirty?: boolean;
}

const COLOR_PALETTE = [
  '#2B74B7', // VNUHCM Blue
  '#D9381E', // Nature Red
  '#00629B', // IEEE Navy
  '#E9711C', // Elsevier Orange
  '#78C841', // StructPaper Green
  '#7B1FA2', // Deep Purple
];

export const TemplateBuilderDock: React.FC<TemplateBuilderDockProps> = ({
  currentStep,
  onStepChange,
  onSaveToLibrary,
  onExportJson,
  onTriggerImport,
  primaryColor = '#2B74B7',
  onColorChange,
  saveSuccess = false,
  isDirty = false,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <aside
      className="hidden sm:flex flex-col items-center justify-between h-full w-12 sm:w-14 py-2 px-1 flex-shrink-0 select-none relative z-50"
      aria-label="Thanh công cụ trình thiết kế template"
    >
      {/* TOP SECTION: BACK TO TEMPLATE HUB */}
      <div className="relative flex flex-col items-center gap-2.5">
        <DockIconButton
          href="/templates"
          label="Quay lại Thư viện mẫu"
          icon={<ArrowLeft className="w-5 h-5 text-zinc-700" strokeWidth={2.4} />}
        />
      </div>

      {/* MIDDLE SECTION: 5 BUILDER STUDIO STEPS (Sequential Workflow) */}
      <div className="relative flex flex-col items-center gap-2.5">
        {/* Step 1: Page Architecture */}
        <DockIconButton
          id="dock-step-page-zones"
          onClick={() => onStepChange('page-zones')}
          active={currentStep === 'page-zones'}
          label="1. Khổ giấy & Lề"
          icon={<Sliders className="w-5 h-5" strokeWidth={2.4} />}
        />

        {/* Step 2: Grid Zones Layout */}
        <DockIconButton
          id="dock-step-grid-zones"
          onClick={() => onStepChange('grid-zones')}
          active={currentStep === 'grid-zones'}
          label="2. Bố cục Lưới & Phân vùng"
          icon={<LayoutGrid className="w-5 h-5" strokeWidth={2.4} />}
        />

        {/* Step 3: Dynamic Elements Tree */}
        <DockIconButton
          id="dock-step-elements-tree"
          onClick={() => onStepChange('elements-tree')}
          active={currentStep === 'elements-tree'}
          label="3. Cấu trúc Thành phần"
          icon={<Layers className="w-5 h-5" strokeWidth={2.4} />}
        />

        {/* Step 4: Deep Styling & Typography */}
        <DockIconButton
          id="dock-step-deep-styling"
          onClick={() => onStepChange('deep-styling')}
          active={currentStep === 'deep-styling'}
          label="4. Định dạng Sâu & Thuộc tính"
          icon={<Type className="w-5 h-5" strokeWidth={2.4} />}
        />

        {/* Step 5: Special & Floating Elements Master Design */}
        <DockIconButton
          id="dock-step-special-elements"
          onClick={() => onStepChange('special-elements')}
          active={currentStep === 'special-elements'}
          label="5. Thành phần Nổi & Đặc biệt"
          icon={<Sparkles className="w-5 h-5" strokeWidth={2.4} />}
        />

        {/* Subtle Separator */}
        <div className="w-6 h-[1px] bg-zinc-300/60 my-1" />

        {/* Quick Color Swatch Selector */}
        <div className="relative">
          <DockIconButton
            onClick={() => setShowColorPicker(!showColorPicker)}
            label="Màu chủ đạo tạp chí"
            icon={
              <div
                className="w-5 h-5 rounded-full border-2 border-white shadow-xs"
                style={{ backgroundColor: primaryColor }}
              />
            }
          />

          <AnimatePresence>
            {showColorPicker && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.9, x: -8 }}
                className="absolute left-[62px] top-1/2 -translate-y-1/2 z-50 bg-white/95 backdrop-blur-md rounded-2xl p-2.5 shadow-xl border border-zinc-200/80 flex items-center gap-1.5"
              >
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (onColorChange) onColorChange(c);
                      setShowColorPicker(false);
                    }}
                    className="w-6 h-6 rounded-full border border-black/10 flex items-center justify-center transition-transform hover:scale-115 cursor-pointer shadow-xs"
                    style={{ backgroundColor: c }}
                  >
                    {primaryColor.toLowerCase() === c.toLowerCase() && (
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* BOTTOM SECTION: ACTIONS (Save, Advanced Elements Manager & Composer) */}
      <div className="relative z-10 flex flex-col items-center gap-2.5">
        {/* Save to library */}
        <DockIconButton
          onClick={onSaveToLibrary}
          label={
            saveSuccess
              ? 'Đã lưu thành công!'
              : isDirty
                ? 'Có thay đổi chưa lưu (bấm để lưu)'
                : 'Lưu vào Kho mẫu'
          }
          icon={
            saveSuccess ? (
              <Check className="w-5 h-5 text-[#78C841] stroke-[2.8]" />
            ) : (
              <Save className="w-5 h-5 text-zinc-700" strokeWidth={2.4} />
            )
          }
          badge={
            saveSuccess ? (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-[#78C841] border-2 border-white flex items-center justify-center shadow-2xs">
                <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
              </span>
            ) : isDirty ? (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border border-white animate-pulse" />
            ) : null
          }
        />

        {/* Gear icon: Quản lý Toàn bộ Thành phần & Tạo thành phần Biến/Hằng */}
        <DockIconButton
          onClick={() => onStepChange('advanced-manager')}
          active={currentStep === 'advanced-manager'}
          label="Quản lý Toàn bộ Thành phần & Tạo mới (Biến/Hằng)"
          icon={
            <Settings
              className={`w-5 h-5 transition-transform duration-300 ${
                currentStep === 'advanced-manager'
                  ? 'text-[#78C841] rotate-90 stroke-[2.8]'
                  : 'text-zinc-700 hover:rotate-45'
              }`}
              strokeWidth={2.4}
            />
          }
        />
      </div>
    </aside>
  );
};
