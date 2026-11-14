'use client';

import React from 'react';
import {
  LayoutGrid,
  Sparkles,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  SplitSquareVertical,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface PreviewControlBarProps {
  showGridOverlay?: boolean;
  onToggleGridOverlay?: () => void;
  isStep4?: boolean;
  demoSpecialElements?: boolean;
  onToggleDemoSpecialElements?: () => void;
  zoomLevel: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  showPdfCompare?: boolean;
  onTogglePdfCompare?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

/**
 * Top Control Toolbar for Live A4 Preview
 */
export const PreviewControlBar: React.FC<PreviewControlBarProps> = ({
  showGridOverlay = false,
  onToggleGridOverlay,
  isStep4 = false,
  demoSpecialElements = false,
  onToggleDemoSpecialElements,
  zoomLevel,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  showPdfCompare = false,
  onTogglePdfCompare,
  isExpanded = false,
  onToggleExpand,
}) => {
  return (
    <div className="w-full bg-white border-b border-slate-200/80 px-2 sm:px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs z-30 select-none">
      {/* LEFT SECTION: View Options & Grid */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Paper Grid Overlay Toggle */}
        {onToggleGridOverlay && (
          <button
            id="btn-toggle-grid-overlay"
            type="button"
            onClick={onToggleGridOverlay}
            className={`h-8 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all duration-200 select-none cursor-pointer ${
              showGridOverlay
                ? 'bg-[#78C841] text-zinc-950 font-extrabold shadow-sm ring-2 ring-[#78C841]/40 hover:bg-[#6cb938]'
                : 'bg-lime-50/80 hover:bg-lime-100/90 text-[#14532D] border border-[#78C841]/40'
            }`}
            title="Bật/Tắt Lớp phủ Lưới Phân vùng trên trang giấy"
          >
            <LayoutGrid strokeWidth={2.5} className={`w-3.5 h-3.5 ${showGridOverlay ? 'text-zinc-950' : 'text-[#78C841]'}`} />
            <span>Lưới: {showGridOverlay ? 'Bật' : 'Tắt'}</span>
          </button>
        )}

        {/* Synchronized PDF Comparison Mode Toggle (Default: OFF) */}
        {onTogglePdfCompare && (
          <button
            type="button"
            onClick={onTogglePdfCompare}
            className={`h-8 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all duration-200 select-none cursor-pointer ${
              showPdfCompare
                ? 'bg-[#2B74B7] text-white shadow-xs ring-2 ring-[#2B74B7]/40'
                : 'bg-sky-50 hover:bg-sky-100 text-[#2B74B7] border border-sky-200'
            }`}
            title="So sánh song song với bản PDF Gốc của Nhà Xuất Bản"
          >
            <SplitSquareVertical className="w-3.5 h-3.5" />
            <span>So sánh PDF Gốc: {showPdfCompare ? 'Bật' : 'Tắt'}</span>
          </button>
        )}

        {/* Special Elements Demo Mode Toggle */}
        {isStep4 && onToggleDemoSpecialElements && (
          <button
            type="button"
            onClick={onToggleDemoSpecialElements}
            className={`h-8 px-3 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all duration-200 select-none cursor-pointer ${
              demoSpecialElements
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
            }`}
            title="Bật/Tắt chế độ xem trước toàn bộ Thành phần Đặc biệt trên trang giấy"
          >
            <Sparkles strokeWidth={2.5} className="w-3.5 h-3.5" />
            <span>Demo: {demoSpecialElements ? 'Bật' : 'Tắt'}</span>
          </button>
        )}
      </div>

      {/* RIGHT SECTION: Zoom & Expand Controls */}
      <div className="flex items-center gap-2">
        {/* Zoom Controls */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
          <button
            id="btn-zoom-out"
            type="button"
            onClick={onZoomOut}
            className="p-1 rounded-lg hover:bg-white text-slate-700 transition-colors cursor-pointer"
            title="Thu nhỏ (-5%)"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-bold text-slate-800 px-2 font-mono">
            {zoomLevel}%
          </span>
          <button
            id="btn-zoom-in"
            type="button"
            onClick={onZoomIn}
            className="p-1 rounded-lg hover:bg-white text-slate-700 transition-colors cursor-pointer"
            title="Phóng to (+5%)"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-reset-zoom"
            type="button"
            onClick={onResetZoom}
            className="p-1 rounded-lg hover:bg-white text-slate-500 hover:text-slate-800 transition-colors cursor-pointer ml-0.5"
            title="Đặt lại mức thu phóng (Fit)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Expand / Minimize Fullscreen Preview */}
        {onToggleExpand && (
          <button
            id="btn-toggle-expand-preview"
            type="button"
            onClick={onToggleExpand}
            className={`h-8 px-2.5 rounded-xl flex items-center gap-1.5 text-xs font-bold transition-all cursor-pointer ${
              isExpanded
                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
            title={isExpanded ? 'Thu gọn khung xem trước' : 'Mở rộng toàn màn hình bản vẽ'}
          >
            {isExpanded ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Thu gọn</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Mở rộng</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
