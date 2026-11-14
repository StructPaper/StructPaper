'use client';

import React from 'react';
import { PaperSection, PaperTable, PaperFigure } from '@/types/paper';
import { FigureSettingsModal } from '../FigureSettingsModal';
import { TableSettingsModal } from '../TableSettingsModal';
import { PageLayoutBadge, PageLayoutControl } from './PageLayoutControl';
import { AnimatePresence } from 'framer-motion';
import {
  Table as TableIcon,
  Image as ImageIcon,
  Heading,
  AlignLeft,
  Maximize2,
  Trash2,
  ChevronUp,
  ChevronDown,
  Bookmark,
  Scissors,
  Settings,
} from 'lucide-react';

export interface SectionCardHeaderProps {
  sec: PaperSection;
  idx: number;
  totalSections?: number;
  isFirst?: boolean;
  isLast?: boolean;
  isDeleting: boolean;
  onUpdateSection: (index: number, updated: PaperSection) => void;
  onRemoveSection: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onConvertToHeading: (index: number, level: 'h1' | 'h2' | 'h3') => void;
  onConvertToParagraph: (index: number) => void;
  onConvertToCitation?: (index: number) => void;
  onOpenTableZoom: (index: number, table: PaperTable) => void;
  activeModalType?: 'figure' | 'table' | null;
  settingsTriggerRect?: DOMRect;
  activeSettings?: {
    secIndex: number;
    type: 'figure' | 'table';
    triggerRect?: DOMRect;
  } | null;
  onOpenFigureSettings: (index: number, rect?: DOMRect) => void;
  onOpenTableSettings: (index: number, rect?: DOMRect) => void;
  onCloseSettings: () => void;
  onSaveFigureSettings: (index: number, updated: PaperFigure) => void;
  onSaveTableSettings: (index: number, updated: PaperTable) => void;
}

const SectionCardHeaderBase: React.FC<SectionCardHeaderProps> = ({
  sec,
  idx,
  totalSections,
  isFirst,
  isLast,
  isDeleting,
  onUpdateSection,
  onRemoveSection,
  onMoveUp,
  onMoveDown,
  onConvertToHeading,
  onConvertToParagraph,
  onOpenTableZoom,
  activeModalType,
  settingsTriggerRect,
  activeSettings,
  onOpenFigureSettings,
  onOpenTableSettings,
  onCloseSettings,
  onSaveFigureSettings,
  onSaveTableSettings,
}) => {
  const isHeading = sec.type === 'h1' || sec.type === 'h2' || sec.type === 'h3';
  const isParagraph = sec.type === 'paragraph';
  const isTable = sec.type === 'table';
  const isFigure = sec.type === 'figure';
  const isCitation = sec.type === 'citation';
  const isEquation = sec.type === 'equation';

  const secId = sec.id || `sec_${idx}`;
  const resolvedModalType =
    activeModalType !== undefined
      ? activeModalType
      : activeSettings?.secIndex === idx
        ? activeSettings.type
        : null;
  const resolvedTriggerRect =
    settingsTriggerRect !== undefined
      ? settingsTriggerRect
      : activeSettings?.secIndex === idx
        ? activeSettings.triggerRect
        : undefined;
  const isFigureOpen = resolvedModalType === 'figure';
  const isTableOpen = resolvedModalType === 'table';
  const isCardSettingsOpen = isFigureOpen || isTableOpen;
  const isMoveUpDisabled = isFirst !== undefined ? isFirst : idx === 0;
  const isMoveDownDisabled =
    isLast !== undefined ? isLast : idx === (totalSections ?? 0) - 1;

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Type Badge */}
        {isHeading && (
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
              sec.type === 'h1'
                ? 'bg-zinc-900 text-white'
                : sec.type === 'h2'
                  ? 'bg-zinc-700 text-white'
                  : 'bg-zinc-500 text-white'
            }`}
          >
            {sec.type === 'h1'
              ? 'Mục Cấp 1 (H1)'
              : sec.type === 'h2'
                ? 'Mục Cấp 2 (H2)'
                : 'Mục Cấp 3 (H3)'}
          </span>
        )}

        {isParagraph && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-800 flex items-center gap-1">
            <AlignLeft className="w-3 h-3" />
            Đoạn văn
          </span>
        )}

        {isTable && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-800 flex items-center gap-1">
              <TableIcon className="w-3 h-3" />
              Bảng số liệu {sec.table?.num ? `(Bảng ${sec.table.num})` : ''}
            </span>
            <button
              type="button"
              onClick={() => sec.table && onOpenTableZoom(idx, sec.table)}
              className="px-2 py-0.5 rounded-lg bg-lime-50 hover:bg-lime-100 text-lime-800 text-[10px] font-bold border border-lime-200 flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
              title="Phóng to bảng số liệu toàn màn hình & chỉnh sửa kiểu Excel"
            >
              <Maximize2 className="w-2.5 h-2.5 text-lime-600" />
              <span>Soạn thảo</span>
            </button>
          </div>
        )}

        {isFigure && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-zinc-200/80 text-zinc-800 flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            Hình minh họa {sec.figure?.num ? `(Hình ${sec.figure.num})` : ''}
          </span>
        )}

        {isEquation && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 flex items-center gap-1">
            Công thức {sec.equation?.numbered && sec.equation.num ? `(${sec.equation.num})` : ''}
          </span>
        )}

        {isCitation && (
          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 flex items-center gap-1 shadow-2xs">
            <Bookmark className="w-3 h-3 text-blue-600" />
            Trích dẫn bài báo này (Citation)
          </span>
        )}

        <PageLayoutBadge layout={sec.pageLayout} />

        {/* Heading Level Switcher & Convert to Paragraph */}
        {isHeading && (
          <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-lg text-[10px]">
            {(['h1', 'h2', 'h3'] as const).map((hType) => (
              <button
                key={hType}
                type="button"
                onClick={() => onUpdateSection(idx, { ...sec, type: hType })}
                className={`px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${
                  sec.type === hType
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {hType}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onConvertToParagraph(idx)}
              className="px-1.5 py-0.5 rounded font-bold text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200 transition-colors cursor-pointer flex items-center gap-0.5 ml-0.5"
              title="Chuyển tiêu đề này thành đoạn văn bản"
            >
              <AlignLeft className="w-2.5 h-2.5" />
              <span>↳ Đoạn văn</span>
            </button>
          </div>
        )}

        {/* Paragraph Conversion Controls */}
        {isParagraph && (
          <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-lg text-[10px]">
            <span className="text-[10px] text-zinc-400 font-medium px-1 select-none">
              Chuyển sang:
            </span>
            {(['h1', 'h2', 'h3'] as const).map((hType) => (
              <button
                key={hType}
                type="button"
                onClick={() => onConvertToHeading(idx, hType)}
                className="px-1.5 py-0.5 rounded font-bold uppercase text-zinc-600 hover:text-zinc-950 hover:bg-zinc-200 transition-colors cursor-pointer"
                title={`Chuyển đoạn văn này thành Tiêu đề ${hType.toUpperCase()}`}
              >
                {hType}
              </button>
            ))}
          </div>
        )}

        {/* Citation Conversion Controls */}
        {isCitation && (
          <div className="flex items-center gap-1 bg-white/80 p-0.5 rounded-lg text-[10px]">
            <button
              type="button"
              onClick={() => onConvertToParagraph(idx)}
              className="px-1.5 py-0.5 rounded font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer flex items-center gap-1"
              title="Chuyển thành đoạn văn bản"
            >
              <AlignLeft className="w-2.5 h-2.5" />
              <span>↳ Đoạn văn</span>
            </button>
            <button
              type="button"
              onClick={() => onConvertToHeading(idx, 'h1')}
              className="px-1.5 py-0.5 rounded font-bold text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors cursor-pointer flex items-center gap-1"
              title="Chuyển thành tiêu đề H1"
            >
              <Heading className="w-2.5 h-2.5" />
              <span>↳ Tiêu đề H1</span>
            </button>
          </div>
        )}
      </div>

      {/* Right Action Icons (Reorder, Page Break & Delete) */}
      <div className="flex items-center gap-1.5 ml-auto">
        <PageLayoutControl sec={sec} idx={idx} onUpdateSection={onUpdateSection} />

        {/* Page Break Toggle */}
        <button
          type="button"
          onClick={() =>
            onUpdateSection(idx, {
              ...sec,
              pageBreakAfter: !sec.pageBreakAfter,
            })
          }
          title={
            sec.pageBreakAfter
              ? 'Hủy ngắt trang sau phần này'
              : 'Ngắt trang sau phần này (nội dung tiếp theo sẽ sang trang mới)'
          }
          className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
            sec.pageBreakAfter
              ? 'bg-violet-100 text-violet-800 ring-1 ring-violet-300 shadow-2xs'
              : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/80'
          }`}
        >
          <Scissors className="w-3.5 h-3.5 rotate-90 text-violet-600" />
          <span className="text-[10px] hidden sm:inline">
            {sec.pageBreakAfter ? 'Đã ngắt trang' : 'Ngắt trang'}
          </span>
        </button>

        <button
          type="button"
          disabled={isMoveUpDisabled}
          onClick={() => onMoveUp(idx)}
          title="Di chuyển lên trên"
          className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-white/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          disabled={isMoveDownDisabled}
          onClick={() => onMoveDown(idx)}
          title="Di chuyển xuống dưới"
          className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-white/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {(isFigure || isTable) && (
          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (isFigure) onOpenFigureSettings(idx, rect);
                if (isTable) onOpenTableSettings(idx, rect);
              }}
              title={
                isFigure
                  ? 'Cài đặt hình ảnh (bố cục 1 cột / 2 cột, kích thước...)'
                  : 'Cài đặt bảng số liệu (bố cục 1 cột / 2 cột, xoay bảng 90°...)'
              }
              className={`p-1 rounded-lg transition-colors cursor-pointer ${
                isCardSettingsOpen
                  ? 'text-zinc-900 bg-white/90 shadow-2xs'
                  : 'text-zinc-400 hover:text-zinc-900 hover:bg-white/80'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {isFigureOpen && sec.figure && (
                <FigureSettingsModal
                  key={`figure-modal-${secId}`}
                  figure={sec.figure}
                  triggerRect={resolvedTriggerRect}
                  onSave={(updated) => onSaveFigureSettings(idx, updated)}
                  onClose={onCloseSettings}
                />
              )}

              {isTableOpen && sec.table && (
                <TableSettingsModal
                  key={`table-modal-${secId}`}
                  table={sec.table}
                  triggerRect={resolvedTriggerRect}
                  onSave={(updated) => onSaveTableSettings(idx, updated)}
                  onClose={onCloseSettings}
                />
              )}
            </AnimatePresence>
          </div>
        )}

        <button
          type="button"
          disabled={isDeleting}
          onClick={() => onRemoveSection(idx)}
          title="Xóa phần này"
          className="p-1 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const SectionCardHeader = React.memo(SectionCardHeaderBase);
SectionCardHeader.displayName = 'SectionCardHeader';
