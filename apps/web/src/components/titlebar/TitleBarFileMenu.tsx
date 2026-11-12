'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, FileDown, FilePlus2, FolderOpen, Loader2, Save } from 'lucide-react';
import type { ExportFormat } from '@/components/documents/DocumentMenuBar';

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export interface TitleBarFileMenuProps {
  onNew?: () => void;
  onOpen?: () => void;
  onSave?: () => Promise<void> | void;
  onExport?: (format: ExportFormat) => void;
  exporting?: Partial<Record<ExportFormat, boolean>>;
}

const EXPORT_ITEMS: ReadonlyArray<{ format: ExportFormat; label: string; badge: string }> = [
  { format: 'docx', label: 'Xuất Word (.docx)', badge: 'DOCX' },
  { format: 'pdf', label: 'Xuất PDF (.pdf)', badge: 'PDF' },
  { format: 'xml', label: 'Xuất XML (JATS)', badge: 'XML' },
];

const MENU_ITEM_CLASS =
  'w-full px-2.5 py-1.5 rounded-xl text-left flex items-center gap-2 hover:bg-zinc-900/[0.06] active:bg-zinc-900/[0.1] disabled:opacity-50 disabled:pointer-events-none transition-colors cursor-pointer';

/**
 * Compact "Tệp ▾" dropdown menu for DesktopTitleBar so File/Save/Export actions
 * fit natively inside the 38px desktop header without a second top bar.
 */
export const TitleBarFileMenu: React.FC<TitleBarFileMenuProps> = ({
  onNew,
  onOpen,
  onSave,
  onExport,
  exporting,
}) => {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 44, left: 48 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0) {
      setMenuPos({
        top: Math.round(rect.bottom + 6),
        left: Math.round(rect.left),
      });
    } else {
      setMenuPos({ top: 44, left: 48 });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const inTrigger = rootRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      if (!inTrigger && !inMenu) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
    };
  }, [open, updateMenuPosition]);

  if (!onNew && !onOpen && !onSave && !onExport) {
    return null;
  }

  const activeExport = EXPORT_ITEMS.find((item) => exporting?.[item.format]);

  const popover =
    typeof document !== 'undefined'
      ? createPortal(
          <AnimatePresence>
            {open && (
              <motion.div
                ref={menuRef}
                role="menu"
                data-testid="titlebar-file-menu-popover"
                data-no-drag="true"
                initial={isTest ? false : { opacity: 0, y: -6, scale: 0.96 }}
                animate={isTest ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={isTest ? undefined : { opacity: 0, y: -4, scale: 0.97 }}
                transition={
                  isTest
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 460, damping: 32, mass: 0.7 }
                }
                style={{
                  position: 'fixed',
                  top: menuPos.top,
                  left: menuPos.left,
                  transformOrigin: 'top left',
                }}
                className="w-56 p-1.5 rounded-3xl bg-white/75 backdrop-blur-md backdrop-saturate-150 border border-white/85 ring-1 ring-black/[0.06] shadow-[0_14px_40px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.85)] z-[100020] text-[12px] font-medium text-zinc-800 select-none"
              >
                {onNew && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="titlebar-file-new"
                    onClick={() => {
                      setOpen(false);
                      onNew();
                    }}
                    className={MENU_ITEM_CLASS}
                  >
                    <FilePlus2 className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Mới…</span>
                  </button>
                )}
                {onOpen && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="titlebar-file-open"
                    onClick={() => {
                      setOpen(false);
                      onOpen();
                    }}
                    className={MENU_ITEM_CLASS}
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Mở…</span>
                  </button>
                )}
                {onSave && (
                  <button
                    type="button"
                    role="menuitem"
                    data-testid="titlebar-file-save"
                    onClick={() => {
                      setOpen(false);
                      void onSave();
                    }}
                    className={MENU_ITEM_CLASS}
                  >
                    <Save className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Lưu</span>
                    <span className="ml-auto text-[10px] text-zinc-400">Ctrl+S</span>
                  </button>
                )}
                {onExport && (
                  <>
                    <div className="my-1 mx-1 border-t border-zinc-900/[0.08]" />
                    <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                      Xuất bản thảo
                    </div>
                    {EXPORT_ITEMS.map(({ format, label }) => {
                      const busy = Boolean(exporting?.[format]);
                      return (
                        <button
                          key={format}
                          type="button"
                          role="menuitem"
                          disabled={busy}
                          data-testid={`titlebar-export-${format}`}
                          onClick={() => {
                            setOpen(false);
                            onExport(format);
                          }}
                          className={MENU_ITEM_CLASS}
                        >
                          <FileDown className="w-3.5 h-3.5 text-zinc-500" />
                          <span>{label}</span>
                          {busy && (
                            <span className="ml-auto text-[10px] text-zinc-400">Đang xuất…</span>
                          )}
                        </button>
                      );
                    })}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative flex items-center gap-1.5 shrink-0" data-no-drag="true">
      <button
        ref={triggerRef}
        type="button"
        data-testid="titlebar-file-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          updateMenuPosition();
          setOpen((prev) => !prev);
        }}
        className={`h-6 px-2 rounded-md text-[11.5px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
          open
            ? 'bg-zinc-300/80 text-zinc-900'
            : 'text-zinc-700 hover:bg-zinc-300/55 hover:text-zinc-900'
        }`}
      >
        <span>Tệp</span>
        <ChevronDown
          className={`w-3 h-3 text-zinc-500 transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {activeExport && (
        <span
          data-testid="titlebar-exporting-badge"
          className="px-1.5 py-[2px] rounded-full bg-white/80 border border-zinc-300/80 text-[10.5px] font-semibold text-zinc-700 inline-flex items-center gap-1 shrink-0"
        >
          <Loader2 className="w-3 h-3 animate-spin text-zinc-600" />
          <span>Đang xuất {activeExport.badge}…</span>
        </span>
      )}

      {popover}
    </div>
  );
};
