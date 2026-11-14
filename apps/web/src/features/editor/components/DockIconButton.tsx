'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export interface DockIconButtonProps {
  id?: string;
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  active?: boolean;
  disabled?: boolean;
  badge?: React.ReactNode;
  customContent?: React.ReactNode;
  containerRef?: React.Ref<HTMLDivElement>;
  suppressTooltip?: boolean;
}

export const DockIconButton: React.FC<DockIconButtonProps> = ({
  id,
  icon,
  label,
  onClick,
  href,
  active,
  disabled,
  badge,
  customContent,
  containerRef,
  suppressTooltip,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    // 1.2 seconds delay before tooltip appears smoothly
    hoverTimerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 1000);
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
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
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
        data-testid={id}
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-all duration-200 select-none cursor-pointer relative ${active
          ? 'bg-white/90 text-zinc-950 font-bold shadow-[inset_0_0_14px_6px_rgba(255,255,255,0.95),0_0_16px_rgba(0,0,0,0.10),0_0_4px_rgba(0,0,0,0.06)] border border-white scale-105'
          : 'bg-white/60 hover:bg-white/90 backdrop-blur-md shadow-[inset_0_0_14px_6px_rgba(255,255,255,0.85),0_0_12px_rgba(0,0,0,0.04),0_0_4px_rgba(0,0,0,0.03)] hover:shadow-[inset_0_0_16px_8px_rgba(255,255,255,0.95),0_0_18px_rgba(0,0,0,0.10),0_0_6px_rgba(0,0,0,0.05)] text-zinc-700 hover:text-zinc-950 hover:scale-105 active:scale-95'
          } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        aria-label={label}
      >
        {customContent || icon}
        {badge}
      </button>

      {/* Liquid Glass Tooltip matching the former "Quay lại trang chủ" button style */}
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

  if (href) {
    return (
      <Link href={href} className="outline-none" tabIndex={-1}>
        {buttonInner}
      </Link>
    );
  }

  return buttonInner;
};
