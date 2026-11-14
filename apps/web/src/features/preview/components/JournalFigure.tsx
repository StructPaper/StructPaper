import React from 'react';
import { PaperFigure } from '@/types/paper';

import { stripCaptionLabel } from '@/lib/docx-table-extras';
interface JournalFigureProps {
  figure: PaperFigure;
  isFullWidth?: boolean;
}

export const JournalFigure: React.FC<JournalFigureProps> = ({ figure, isFullWidth = false }) => {
  return (
    <div
      className="my-5 break-inside-avoid"
      style={{ columnSpan: isFullWidth ? 'all' : undefined }}
    >
      {/* Light-blue figure background container - Exact LaTeX: unitednationsblue (#E7ECF7) */}
      <div className="bg-[#E7ECF7] p-3 text-center rounded-none shadow-xs border border-[#CBD8EF]">
        {figure.src ? (
          <img
            src={figure.src}
            alt={figure.caption}
            className="max-h-[300px] mx-auto object-contain"
          />
        ) : (
          <div className="h-32 flex items-center justify-center text-gray-400 text-xs italic">
            [Hình ảnh minh họa khoa học]
          </div>
        )}
      </div>

      {/* Caption & Source attribution - Exact LaTeX format */}
      <div className="mt-1.5 text-left leading-snug">
        <p
          className="text-[8.5pt] text-gray-900 leading-snug"
          style={{ fontFamily: "'Source Sans 3', Calibri, Arial, sans-serif" }}
        >
          <strong className="text-[#2B74B7] font-bold">Hình {figure.num}: </strong>
          <span>{stripCaptionLabel(figure.caption)}</span>
        </p>
      </div>
    </div>
  );
};
