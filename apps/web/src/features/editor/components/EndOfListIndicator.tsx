'use client';

import React from 'react';
import { Check, ArrowUp } from 'lucide-react';

interface EndOfListIndicatorProps {
  title?: string;
  subtitle?: string;
  onScrollToTop?: () => void;
  className?: string;
}

export const EndOfListIndicator: React.FC<EndOfListIndicatorProps> = ({
  title = 'Bạn đã lướt đến cuối trang',
  subtitle,
  onScrollToTop,
  className = '',
}) => {
  return (
    <div className={`pt-6 pb-10 flex flex-col items-center justify-center text-center select-none ${className}`}>
      {/* Decorative divider with pill/icon */}
      <div className="flex items-center gap-3 w-full max-w-xs mb-3">
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-300 to-zinc-300 flex-1" />
        <div className="w-6 h-6 rounded-full bg-zinc-200/90 border border-zinc-300/80 flex items-center justify-center text-zinc-600 shadow-2xs">
          <Check className="w-3 h-3 stroke-[2.5] text-zinc-700" />
        </div>
        <div className="h-px bg-gradient-to-l from-transparent via-zinc-300 to-zinc-300 flex-1" />
      </div>

      {/* Title */}
      <p className="text-xs font-bold text-zinc-700 tracking-tight">
        {title}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-[11px] text-zinc-400 font-medium mt-0.5 max-w-sm">
          {subtitle}
        </p>
      )}

      {/* Action button: Cuộn lên đầu trang */}
      {onScrollToTop && (
        <button
          type="button"
          onClick={onScrollToTop}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200/90 px-3.5 py-1.5 rounded-full shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          <ArrowUp className="w-3 h-3 text-zinc-500" />
          <span>Cuộn lên đầu trang</span>
        </button>
      )}
    </div>
  );
};
