'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Tag, X } from 'lucide-react';
import {
  WORKFLOW_STATUS_CONFIG,
  getWorkflowStatusConfig,
  normalizeWorkflowStatus,
  type WorkflowStatus,
} from '@/features/papers';

export interface DockStatusMenuProps {
  setIsDownloadOpen: (open: boolean) => void;
  setIsStatusOpen: (open: boolean) => void;
  isStatusOpen: boolean;
  statusMenuRef: React.RefObject<HTMLDivElement>;
  isTest: boolean;
  springTransition: Record<string, unknown>;
  workflowStatus: WorkflowStatus | string;
  currentStatusConfig: ReturnType<typeof getWorkflowStatusConfig>;
  currentStatusTheme: { innerShadow: string; border: string };
  onUpdateWorkflowStatus?: (newStatus: WorkflowStatus) => void;
}

/** Manuscript workflow-status pop-up of the left dock. */
export const DockStatusMenu: React.FC<DockStatusMenuProps> = ({
  setIsDownloadOpen,
  setIsStatusOpen,
  isStatusOpen,
  statusMenuRef,
  isTest,
  springTransition,
  workflowStatus,
  currentStatusConfig,
  currentStatusTheme,
  onUpdateWorkflowStatus,
}) => (
  <div className="w-[52px] h-[52px] relative flex items-center justify-center">
    <AnimatePresence>
      {!isStatusOpen ? (
        <motion.button
          key="status-trigger-btn"
          layoutId="dock-status-menu"
          id="status-dock-btn"
          data-testid="status-dock-btn"
          type="button"
          onClick={() => {
            setIsDownloadOpen(false);
            setIsStatusOpen(true);
          }}
          initial={isTest ? false : undefined}
          transition={springTransition}
          aria-label={`Trạng thái bản thảo: ${currentStatusConfig.label}`}
          title={`Trạng thái bản thảo: ${currentStatusConfig.label}`}
          className={`w-[52px] h-[52px] rounded-full flex items-center justify-center transition-colors duration-150 select-none cursor-pointer relative bg-white/60 hover:bg-white/90 backdrop-blur-md text-zinc-700 hover:text-zinc-950 border ${currentStatusTheme.border}`}
          style={{
            boxShadow: `${currentStatusTheme.innerShadow}, inset 0 0 14px 6px rgba(255,255,255,0.85), 0 0 12px rgba(0,0,0,0.04), 0 0 4px rgba(0,0,0,0.03)`,
          }}
        >
          <Tag className="w-4 h-4 text-zinc-700" strokeWidth={2.8} />
          <span
            className={`w-2.5 h-2.5 rounded-full absolute top-2 right-2 ${currentStatusConfig.dotBg} ring-2 ring-white shadow-xs`}
            title={`Trạng thái: ${currentStatusConfig.label}`}
          />
        </motion.button>
      ) : (
        <motion.div
          key="status-popup-menu"
          layoutId="dock-status-menu"
          ref={statusMenuRef}
          id="status-popup-menu"
          data-testid="status-popup-menu"
          initial={isTest ? false : undefined}
          transition={springTransition}
          onClick={(e) => e.stopPropagation()}
          className="absolute left-[64px] top-0 z-[100] w-56 bg-white/98 backdrop-blur-xl border border-zinc-200/90 rounded-3xl shadow-2xl p-1.5 text-xs text-zinc-800 space-y-0.5 select-none overflow-hidden"
          style={{ transformOrigin: 'top left' }}
        >
          <div className="flex items-center justify-between px-2 py-1 select-none">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
              Trạng thái bài báo
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsStatusOpen(false);
              }}
              className="w-5 h-5 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 hover:text-zinc-700 cursor-pointer"
              title="Đóng menu"
              aria-label="Đóng menu"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="border-t border-zinc-200/80 my-0.5" />

          {(['draft', 'in-review', 'proofing', 'ready', 'published'] as const).map((st) => {
            const cfg = WORKFLOW_STATUS_CONFIG[st];
            const isSelected = normalizeWorkflowStatus(workflowStatus) === st;
            return (
              <button
                key={st}
                type="button"
                data-testid={`status-option-${st}`}
                onClick={() => {
                  setIsStatusOpen(false);
                  onUpdateWorkflowStatus?.(st);
                }}
                className={`w-full px-2.5 py-1.5 rounded-xl flex items-center justify-between text-left font-medium cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-zinc-100 text-zinc-950 font-bold'
                    : 'hover:bg-zinc-50 text-zinc-700 hover:text-zinc-900'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full ${cfg.dotBg} shrink-0`} />
                  <span className="text-xs truncate">{cfg.label}</span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
);
