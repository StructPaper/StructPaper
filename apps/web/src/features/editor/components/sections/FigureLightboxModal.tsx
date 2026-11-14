'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { PaperFigure } from '@/types/paper';
import { X } from 'lucide-react';

export interface FigureLightboxModalProps {
  figure: PaperFigure | null;
  isOpen: boolean;
  isClosing: boolean;
  onClose: () => void;
}

export const FigureLightboxModal: React.FC<FigureLightboxModalProps> = ({
  figure,
  isOpen,
  isClosing,
  onClose,
}) => {
  if (!isOpen || !figure) return null;

  return createPortal(
    <div
      className={`fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen m-0 p-4 sm:p-8 z-[999999] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md overflow-hidden ${
        isClosing ? 'animate-lightbox-backdrop-out' : 'animate-lightbox-backdrop-in'
      }`}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed top-5 right-5 sm:top-6 sm:right-6 p-2.5 rounded-full bg-white/10 hover:bg-white/25 active:scale-90 text-white backdrop-blur-md transition-all cursor-pointer z-[1000000] shadow-xl border border-white/20"
        title="Đóng (Esc)"
      >
        <X className="w-6 h-6 stroke-[2.5]" />
      </button>

      <div
        className={`relative max-w-5xl max-h-[88vh] flex flex-col items-center justify-center select-none ${
          isClosing ? 'animate-lightbox-content-out' : 'animate-lightbox-content-in'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={figure.src}
          alt={figure.caption}
          className="max-h-[76vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl bg-white/5 border border-white/15 ring-1 ring-white/10"
        />
        <div className="mt-3.5 px-5 py-2.5 rounded-2xl bg-zinc-950/85 text-white text-xs sm:text-sm text-center max-w-2xl border border-white/15 shadow-2xl backdrop-blur-md space-y-0.5">
          <p className="font-extrabold tracking-wide">
            Hình {figure.num}: {figure.caption}
          </p>
          {figure.source && (
            <p className="text-zinc-400 text-xs italic font-medium">
              {figure.source}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
