'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GripVertical } from 'lucide-react';

interface ResizableSplitLayoutProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
  defaultSplit?: number; // percentage, e.g. 42
  minPercent?: number; // min left panel width, e.g. 25
  maxPercent?: number; // max left panel width, e.g. 70
  storageKey?: string;
  className?: string;
}

export const ResizableSplitLayout: React.FC<ResizableSplitLayoutProps> = ({
  leftContent,
  rightContent,
  defaultSplit = 50,
  minPercent = 25,
  maxPercent = 70,
  storageKey = 'structpaper_editor_split_v3',
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [splitPercent, setSplitPercent] = useState<number>(defaultSplit);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);

  // Restore saved split percentage from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= minPercent && val <= maxPercent) {
          setSplitPercent(val);
        }
      }
    } catch {
      // Ignore localStorage access errors
    }
  }, [storageKey, minPercent, maxPercent]);

  // Handle pointer down on the splitter handle
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    isDraggingRef.current = true;

    // Set cursor on document
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }, []);

  // Handle pointer move & up on window
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      if (containerRect.width <= 0) return;

      const clientX = e.clientX;
      const rawPercent = ((clientX - containerRect.left) / containerRect.width) * 100;
      const clamped = Math.min(Math.max(rawPercent, minPercent), maxPercent);

      setSplitPercent(clamped);
    };

    const handlePointerUp = () => {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      setIsDragging(false);

      // Restore document styles
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      // Persist to localStorage
      try {
        localStorage.setItem(storageKey, String(splitPercent));
      } catch {
        // Ignore
      }
    };

    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('pointercancel', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging, minPercent, maxPercent, splitPercent, storageKey]);

  // Reset to default ratio on double click
  const handleDoubleClick = () => {
    setSplitPercent(defaultSplit);
    try {
      localStorage.setItem(storageKey, String(defaultSplit));
    } catch {
      // Ignore
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full min-h-0 flex flex-col lg:flex-row items-stretch select-none ${
        isDragging ? 'cursor-col-resize' : ''
      } ${className}`}
    >
      {/* LEFT PANEL */}
      <div
        style={{ width: `${splitPercent}%` }}
        className="hidden lg:flex flex-col h-full min-w-0 flex-shrink-0 transition-none"
      >
        <div className="select-text pr-1.5 h-full flex flex-col min-h-0 min-w-0 w-full overflow-hidden flex-1">
          {leftContent}
        </div>
      </div>

      {/* DRAGGABLE RESIZER HANDLE (Desktop only) */}
      <div
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        title="Kéo sang trái/phải để tùy chỉnh kích thước cột. Nhấp đúp để đặt lại kích thước mặc định."
        className={`hidden lg:flex flex-col items-center justify-center flex-shrink-0 relative z-30 cursor-col-resize group touch-none select-none transition-colors h-full ${
          isDragging ? 'w-5 -mx-1.5' : 'w-4 -mx-1'
        }`}
      >
        {/* Subtle background track */}
        <div
          className={`w-[2px] h-full rounded-full transition-all duration-150 ${
            isDragging
              ? 'bg-[#1A1A1A] w-1 shadow-sm'
              : 'bg-zinc-200 group-hover:bg-zinc-400 group-hover:w-[3px]'
          }`}
        />

        {/* Center Grab Handle Pill */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-4 h-12 rounded-full border shadow-xs transition-all duration-150 ${
            isDragging
              ? 'bg-[#1A1A1A] border-zinc-900 text-white scale-110 shadow-md'
              : 'bg-white border-zinc-300/80 text-zinc-500 group-hover:border-zinc-400 group-hover:text-zinc-900 group-hover:scale-105'
          }`}
        >
          <GripVertical className="w-3 h-3" strokeWidth={2.5} />
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div
        style={{ width: `calc(100% - ${splitPercent}% - 8px)` }}
        className="hidden lg:flex flex-col h-full min-w-0 flex-1 relative"
      >
        <div className="select-text pl-1.5 h-full flex flex-col min-h-0 flex-1">
          {rightContent}
        </div>

        {/* Invisible transparent shield over right panel while dragging so iframe doesn't swallow pointer events! */}
        {isDragging && (
          <div className="absolute inset-0 z-50 cursor-col-resize bg-transparent" />
        )}
      </div>

      {/* MOBILE / TABLET STACKED FALLBACK */}
      <div className="block lg:hidden w-full space-y-4">
        {leftContent}
        {rightContent}
      </div>
    </div>
  );
};
