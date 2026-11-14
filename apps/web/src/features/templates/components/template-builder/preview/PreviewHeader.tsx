'use client';

import React from 'react';
import { HeaderFooterConfig } from '@/types/template-builder';

interface PreviewHeaderProps {
  headers: HeaderFooterConfig;
  topPx: number;
  leftPx: number;
  widthPx: number;
  heightPx: number;
  onSelectHeader?: () => void;
  pageNumber?: number;
  primaryColor?: string;
}

/**
 * Top Running Header Strip for Live A4 Preview
 */
export const PreviewHeader: React.FC<PreviewHeaderProps> = ({
  headers,
  topPx,
  leftPx,
  widthPx,
  heightPx,
  onSelectHeader,
  pageNumber = 1,
  primaryColor = '#2B74B7',
}) => {
  const isFirst = pageNumber === 1;
  const isOdd = pageNumber % 2 !== 0;

  const slot = isFirst
    ? headers.firstPage
    : headers.differentOddEven
      ? isOdd
        ? headers.oddPages
        : headers.evenPages
      : headers.oddPages;

  const hasOpenAccess =
    isFirst &&
    (slot.centerText?.toLowerCase().includes('open access') ||
      slot.leftText?.toLowerCase().includes('health sciences') ||
      slot.rightText?.toLowerCase().includes('bài tổng quan'));

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelectHeader?.();
      }}
      className="group absolute rounded-sm transition-all duration-150 hover:outline-2 hover:outline-dashed hover:outline-blue-500 hover:outline-offset-2 hover:bg-blue-50/20 cursor-pointer z-20"
      style={{
        top: `${topPx}px`,
        left: `${leftPx}px`,
        width: `${widthPx}px`,
        height: `${heightPx}px`,
      }}
      title="Nhấn để tùy biến Tiêu đề đầu trang (Header)"
    >
      <span className="absolute -top-1 left-4 bg-slate-900/90 text-white text-[8pt] font-medium px-2 py-0.5 rounded-full shadow-md z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        Tiêu đề trang (Header - {isFirst ? 'Trang 1' : isOdd ? 'Trang lẻ' : 'Trang chẵn'})
      </span>

      {isFirst ? (
        <div className="pb-1 text-[8pt] font-sans">
          <div className="flex items-start justify-between">
            <div className="space-y-0.5">
              <div
                className="font-bold italic text-slate-800 leading-tight"
                style={{
                  fontFamily: slot.fontFamily || 'sans-serif',
                  fontSize: `${slot.fontSize || 8.5}pt`,
                }}
              >
                {slot.leftText || 'Tạp chí Phát triển Khoa học và Công nghệ – Health Sciences 2026, 7(2):804-816'}
              </div>
              {hasOpenAccess && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <img
                    src="/demo-assets/id630/open-access.png"
                    alt="Open Access"
                    className="w-3.5 h-3.5 object-contain"
                  />
                  <span className="font-sans font-bold text-[7.5pt] text-slate-500">
                    Open Access Full Text Article
                  </span>
                </div>
              )}
            </div>

            {slot.rightText && (
              <div className="font-serif font-bold italic underline text-[11pt] text-slate-900">
                {slot.rightText}
              </div>
            )}
          </div>

          {slot.showDividerLine && (
            <div
              className="w-full mt-1.5"
              style={{
                borderBottom: `${slot.dividerLineThickness || 0.5}px solid ${
                  slot.dividerLineColor || '#CBD5E1'
                }`,
              }}
            />
          )}
        </div>
      ) : (
        <div className="pb-1 text-[8pt] font-sans">
          <div className="flex items-center justify-between pb-1 border-b border-slate-400">
            <div
              className="font-bold italic text-slate-800"
              style={{
                fontFamily: slot.fontFamily || 'sans-serif',
                fontSize: `${slot.fontSize || 8.5}pt`,
              }}
            >
              {slot.leftText || slot.rightText || 'Tạp chí Phát triển Khoa học và Công nghệ – Health Sciences 2026, 7(2):804-816'}
            </div>
            {slot.centerText && <div className="text-slate-600">{slot.centerText}</div>}
          </div>
        </div>
      )}
    </div>
  );
};
