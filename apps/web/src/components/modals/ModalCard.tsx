'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export interface ModalCardProps {
  isOpen: boolean;
  onClose: () => void;
  /** Heading row: a round icon badge, the title and an optional line under it. */
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right of the heading, before the close button (a status chip, a badge). */
  headerExtra?: React.ReactNode;
  /** Pinned under the content (buttons). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  maxWidthClass?: string;
  zIndex?: number;
  testId?: string;
  /** Leave with the same soft spring as it arrives (instead of the quick fade). */
  springExit?: boolean;
  /** The card eases to its new size (a spring) when its content grows or shrinks, instead of jumping. */
  animateLayout?: boolean;
}

/**
 * The shell of the content dialogs (history, diff, rules in force): the same card, motion and close button as
 * ActionConfirmModal, with a heading row and a scrolling body instead of a centred message.
 */
export const ModalCard: React.FC<ModalCardProps> = ({
  isOpen,
  onClose,
  icon,
  title,
  subtitle,
  headerExtra,
  footer,
  children,
  maxWidthClass = 'max-w-[640px]',
  zIndex = 110,
  testId = 'modal-card',
  springExit = false,
  animateLayout = false,
}) => (
  <ModalPortal isOpen={isOpen} onClose={onClose} zIndex={zIndex}>
    <motion.div
      data-testid={testId}
      layout={animateLayout && !isTest ? true : undefined}
      initial={isTest ? undefined : { opacity: 0, scale: 0.92, y: 28 }}
      animate={isTest ? undefined : { opacity: 1, scale: 1, y: 0 }}
      exit={isTest ? undefined : { opacity: 0, scale: 0.92, y: 28, transition: springExit ? { type: 'spring', damping: 28, stiffness: 240 } : { duration: 0.2, ease: [0.32, 0, 0.67, 0] } }}
      transition={isTest ? { duration: 0 } : { type: 'spring', damping: 26, stiffness: 220 }}
      className={`bg-white w-full ${maxWidthClass} max-h-[86vh] rounded-[36px] p-6 sm:p-7 shadow-2xl border border-slate-100 flex flex-col relative overflow-hidden select-none`}
    >
      <div className="flex items-start gap-3 pr-10 mb-4 shrink-0">
        {icon && (
          <span className="w-11 h-11 rounded-2xl bg-gray-200/60 text-zinc-800 flex items-center justify-center shrink-0">{icon}</span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-black text-slate-900 tracking-tight leading-snug">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{subtitle}</p>}
        </div>
        {headerExtra && <div className="shrink-0 mt-1">{headerExtra}</div>}
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
        aria-label="Đóng"
      >
        <X className="w-4 h-4" />
      </button>

      {/* padded so rings and shadows at the edges of the content are not cut by the scroll box */}
      <div className="flex-1 min-h-0 overflow-y-auto -mx-2 px-2 -my-2 py-2">{children}</div>

      {footer && <div className="shrink-0 mt-5">{footer}</div>}
    </motion.div>
  </ModalPortal>
);
