'use client';

import React from 'react';
import { PageArchitectureConfig, FloatingElementsDesignRules } from '@/types/template-builder';

interface PreviewFooterProps {
  pageNumbering: PageArchitectureConfig['pageNumbering'];
  floatingRules?: FloatingElementsDesignRules;
  demoSpecialElements?: boolean;
  padLeftPx: number;
  contentWidthPx: number;
  footerHeightPx: number;
  marginBottomMm: number;
  mmToPx: number;
  onSelectHeader?: () => void;
  footers?: PageArchitectureConfig['headers'];
  pageNumber?: number;
  primaryColor?: string;
  totalPages?: number;
}

function formatPageNumber(num: number, format: string, prefix = '', totalPages = 10): string {
  const pfx = prefix ? `${prefix} ` : '';
  const romanMap: Record<string, number> = {
    M: 1000, CM: 900, D: 500, CD: 400, C: 100, XC: 90, L: 50, XL: 40, X: 10, IX: 9, V: 5, IV: 4, I: 1
  };
  const toRomanStr = (nVal: number) => {
    let str = '';
    let n = Math.max(1, Math.min(3999, Math.floor(nVal)));
    for (const k of Object.keys(romanMap)) {
      const q = Math.floor(n / romanMap[k]);
      n -= q * romanMap[k];
      str += k.repeat(q);
    }
    return str || 'I';
  };

  switch (format) {
    case 'roman-lower':
      return `${pfx}${toRomanStr(num).toLowerCase()}`;
    case 'roman-upper':
      return `${pfx}${toRomanStr(num)}`;
    case 'alpha-lower':
      return `${pfx}${String.fromCharCode(96 + ((num - 1) % 26) + 1)}`;
    case 'alpha-upper':
      return `${pfx}${String.fromCharCode(64 + ((num - 1) % 26) + 1)}`;
    case 'hyphen':
      return `- ${num} -`;
    case 'page-of-n':
      return `Page ${num} of ${totalPages}`;
    case 'page-x-of-y':
      return `${pfx}${num} / ${totalPages}`;
    case 'arabic':
    default:
      return `${pfx}${num}`;
  }
}

/**
 * Bottom Page Numbering & Footnote Strip for Live A4 Preview
 * Supports flexible Word-style page numbering (position, format, startNumber, first page suppression)
 */
export const PreviewFooter: React.FC<PreviewFooterProps> = ({
  pageNumbering,
  floatingRules,
  demoSpecialElements = false,
  padLeftPx,
  contentWidthPx,
  footerHeightPx,
  marginBottomMm,
  mmToPx,
  onSelectHeader,
  footers,
  pageNumber = 1,
  primaryColor = '#2B74B7',
  totalPages = 10,
}) => {
  const isFirst = pageNumber === 1;
  const isOdd = pageNumber % 2 !== 0;
  const hasCitationBar = isFirst && Boolean(footers?.firstPage?.leftText);

  // Check if page numbering should be hidden
  const isPositionHidden = pageNumbering?.position === 'none' ||
    pageNumbering?.position === 'top-center' ||
    pageNumbering?.position === 'top-left' ||
    pageNumbering?.position === 'top-right' ||
    pageNumbering?.position === 'top-alternating';

  const isSuppressed = pageNumbering?.suppressOnFirstPage && isFirst;
  const showFooterPageNum = !isPositionHidden && !isSuppressed;

  // Calculate actual formatted page number with offset
  const actualPageNum = (pageNumbering?.startNumber || 1) + (pageNumber - 1);
  const formattedPageText = formatPageNumber(
    actualPageNum,
    pageNumbering?.format || 'arabic',
    pageNumbering?.prefixText,
    totalPages
  );

  // Position alignment
  let justifyAlignment = 'space-between';
  if (pageNumbering?.position === 'bottom-center') {
    justifyAlignment = 'center';
  } else if (pageNumbering?.position === 'bottom-right') {
    justifyAlignment = 'flex-end';
  } else if (pageNumbering?.position === 'bottom-left') {
    justifyAlignment = 'flex-start';
  } else {
    // bottom-alternating (odd right, even left)
    justifyAlignment = isOdd ? 'flex-end' : 'flex-start';
  }

  return (
    <>
      {/* Demo Footnote when in Special Elements Demo Mode */}
      {demoSpecialElements && floatingRules?.footnote && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none select-none font-serif"
          style={{
            left: `${padLeftPx}px`,
            width: `${contentWidthPx}px`,
            bottom: `${Math.max(
              26,
              Math.round(marginBottomMm * mmToPx * 0.4) + footerHeightPx + (hasCitationBar ? 24 : 4)
            )}px`,
            fontSize: `${floatingRules.footnote.fontSize || 7.5}pt`,
          }}
        >
          {floatingRules.footnote.showSeparatorRule && (
            <div
              className="w-24 mb-1"
              style={{
                borderTop: `1px solid ${floatingRules.footnote.ruleColor || '#94A3B8'}`,
              }}
            />
          )}
          <div className="flex items-start gap-1">
            <span
              style={{
                fontWeight: floatingRules.footnote.numWeight === 'normal' ? 400 : 700,
                color: floatingRules.footnote.numColor || '#0F172A',
              }}
            >
              {floatingRules.footnote.numberingStyle === 'asterisk'
                ? '*'
                : floatingRules.footnote.numberingStyle === 'roman'
                  ? 'i'
                  : '1'}
            </span>
            <span
              style={{
                color: floatingRules.footnote.noteTextColor || '#334155',
              }}
            >
              Đề tài được tài trợ bởi Quỹ Phát triển Khoa học & Công nghệ ĐHQG TP.HCM.
            </span>
          </div>
        </div>
      )}

      {/* Page 1 Scholarly Citation Strip (matching VNUHCM Health Sciences demo PDF) */}
      {hasCitationBar && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelectHeader?.();
          }}
          className="group absolute z-20 cursor-pointer rounded-xs px-2.5 py-1 flex items-center justify-between transition-all hover:ring-1 hover:ring-blue-400"
          style={{
            left: `${padLeftPx}px`,
            width: `${contentWidthPx}px`,
            bottom: `${Math.max(6, Math.round(marginBottomMm * mmToPx * 0.35))}px`,
            backgroundColor: '#E7ECF7',
            fontSize: '7pt',
            fontFamily: 'Arial, sans-serif',
          }}
          title="Thanh trích dẫn bài báo (Footer trang 1)"
        >
          <span className="text-slate-800 line-clamp-1 pr-2 font-medium">
            <span className="font-bold text-slate-900">Trích dẫn bài báo này: </span>
            {footers!.firstPage.leftText.replace(/^Trích dẫn bài báo này:\s*/i, '')}
          </span>
          {showFooterPageNum && (
            <span
              style={{ color: primaryColor }}
              className="font-bold shrink-0 text-[8.5pt]"
            >
              {formattedPageText}
            </span>
          )}
        </div>
      )}

      {/* Multi-Page Numbering Footer */}
      {!hasCitationBar && showFooterPageNum && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onSelectHeader?.();
          }}
          className="group absolute z-20 flex items-center text-[9pt] font-sans font-bold cursor-pointer hover:outline-2 hover:outline-dashed hover:outline-blue-500 hover:outline-offset-2 hover:bg-blue-50/20 rounded-sm transition-all"
          style={{
            left: `${padLeftPx}px`,
            width: `${contentWidthPx}px`,
            bottom: `${Math.max(8, Math.round(marginBottomMm * mmToPx * 0.4))}px`,
            height: `${footerHeightPx || 20}px`,
            justifyContent: justifyAlignment,
          }}
          title={`Đánh số trang (Footer - Trang ${pageNumber})`}
        >
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[8pt] font-medium px-2 py-0.5 rounded-full shadow-md z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
            Đánh số trang (Footer)
          </span>
          <span style={{ color: primaryColor }} className="px-1">
            {formattedPageText}
          </span>
        </div>
      )}
    </>
  );
};
