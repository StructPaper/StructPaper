'use client';

import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import '@/lib/api-client-init';
import { toastStore, type ToastItem } from './toast-store';
import { LiquidGlassToast } from './LiquidGlassToast';
import { FullWidthStickyToast } from './FullWidthStickyToast';

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isAnyHovered, setIsAnyHovered] = useState(false);
  const [hoverResetKey, setHoverResetKey] = useState(0);
  const [toastHeights, setToastHeights] = useState<Record<string, number>>({});
  const hoverEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = toastStore.subscribe((newToasts) => {
      setToasts(newToasts);
    });
    return () => unsubscribe();
  }, []);

  const handleDismiss = (id: string) => {
    toastStore.dismissToast(id);
  };

  const handleHeightChange = (id: string, h: number) => {
    setToastHeights((prev) => (prev[id] === h ? prev : { ...prev, [id]: h }));
  };

  const handleHoverStart = () => {
    if (hoverEndTimeoutRef.current) {
      clearTimeout(hoverEndTimeoutRef.current);
      hoverEndTimeoutRef.current = null;
    }
    setIsAnyHovered(true);
    // When hovering on any notification, reset the countdown timer for all active toasts
    setHoverResetKey((prev) => prev + 1);
  };

  const handleHoverEnd = () => {
    if (hoverEndTimeoutRef.current) clearTimeout(hoverEndTimeoutRef.current);
    hoverEndTimeoutRef.current = setTimeout(() => {
      setIsAnyHovered(false);
    }, 150);
  };

  const stickyToasts = toasts.filter((t) => t.sticky || t.variant === 'full-width-sticky');
  const islandToasts = toasts.filter((t) => !t.sticky && t.variant !== 'full-width-sticky');

  return (
    <>
      {/* Sticky Full-Width Top Banner(s) */}
      <div
        aria-live="assertive"
        aria-label="Thông báo khẩn cấp"
        style={{ top: 'var(--titlebar-height, 0px)' }}
        className="fixed left-0 right-0 z-[100000] w-full pointer-events-auto flex flex-col"
      >
        <AnimatePresence mode="popLayout">
          {stickyToasts.map((toastItem) => (
            <FullWidthStickyToast
              key={toastItem.id}
              toast={toastItem}
              onDismiss={handleDismiss}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Dynamic Island Floating Toasts */}
      <div
        aria-live="polite"
        aria-label="Thông báo hệ thống"
        style={{
          top:
            stickyToasts.length > 0
              ? 'calc(var(--titlebar-height, 0px) + 2.75rem)'
              : 'var(--titlebar-height, 0px)',
        }}
        className={`fixed left-1/2 -translate-x-1/2 z-[99999] pointer-events-none flex flex-col items-center gap-2 w-full max-w-xl px-4 select-none transition-[top] duration-200 ${
          stickyToasts.length > 0 ? 'pt-2' : 'pt-0'
        }`}
      >
        <AnimatePresence mode="popLayout">
          {islandToasts.map((toastItem, index) => {
            let collapsedY = 0;
            if (index === 1) {
              const h1 = toastHeights[toastItem.id] || 44;
              collapsedY = -(h1 + 8) + 12;
            } else if (index === 2) {
              const h1 = toastHeights[islandToasts[1]?.id] || 44;
              const h2 = toastHeights[toastItem.id] || 44;
              collapsedY = -(h1 + h2 + 16) + 22;
            } else if (index >= 3) {
              const h1 = toastHeights[islandToasts[1]?.id] || 44;
              const h2 = toastHeights[islandToasts[2]?.id] || 44;
              collapsedY = -(h1 + h2 + 16) + 28;
            }

            return (
              <LiquidGlassToast
                key={toastItem.id}
                toast={toastItem}
                index={index}
                isTop={index === 0}
                isExpanded={isAnyHovered}
                collapsedY={collapsedY}
                isPaused={isAnyHovered}
                resetKey={hoverResetKey}
                onHoverStart={handleHoverStart}
                onHoverEnd={handleHoverEnd}
                onHeightChange={handleHeightChange}
                onDismiss={handleDismiss}
              />
            );
          })}
        </AnimatePresence>
      </div>
    </>
  );
};
