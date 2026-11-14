'use client';

import React, { useCallback } from 'react';
import {
  PaperSection,
  PaperTable,
  PaperFigure,
  PaperReference,
} from '@/types/paper';
import { Scissors, X } from 'lucide-react';
import { SectionHeaderCard } from './SectionHeaderCard';
import { HeadingSectionItem } from './HeadingSectionItem';
import { ParagraphSectionItem } from './ParagraphSectionItem';
import { TableSectionItem } from './TableSectionItem';
import { FigureSectionItem } from './FigureSectionItem';
import { EquationSectionItem } from './EquationSectionItem';
import { SectionInsertDivider } from './SectionInsertDivider';

export interface SectionCardItemProps {
  sec: PaperSection;
  secId: string;
  idx: number;
  isFirst: boolean;
  isLast: boolean;
  isDeleting: boolean;
  isNewlyAdded: boolean;
  isEditing: boolean;
  activeModalType: 'figure' | 'table' | null;
  settingsTriggerRect?: DOMRect;
  isPrevFigure: boolean;
  prevFigureCaption?: string;
  references?: PaperReference[];
  onUpdateSection: (index: number, updated: PaperSection) => void;
  onRemoveSection: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onConvertToHeading: (index: number, level: 'h1' | 'h2' | 'h3') => void;
  onConvertToParagraph: (index: number) => void;
  onOpenTableZoom: (index: number, table: PaperTable) => void;
  onOpenFigureSettings: (index: number, rect?: DOMRect) => void;
  onOpenTableSettings: (index: number, rect?: DOMRect) => void;
  onCloseSettings: () => void;
  onSaveFigureSettings: (index: number, updated: PaperFigure) => void;
  onSaveTableSettings: (index: number, updated: PaperTable) => void;
  onOpenLightbox: (figure: PaperFigure) => void;
  onDetachFigureSource: (figIndex: number) => void;
  onMergeParagraphIntoPrevFigure: (paraIndex: number) => void;
  onPasteFigureImage: (secIdx: number, e: React.ClipboardEvent) => void;
  onDropFigureImage: (secIdx: number, e: React.DragEvent) => void;
  onFileInputChange: (secIdx: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onPasteImageFromClipboardButton: (secIdx: number) => void;
  onTriggerFileInput: (secIdx: number) => void;
  onPasteTableData: (secIdx: number, e: React.ClipboardEvent) => void;
  onPasteTableFromClipboardButton: (secIdx: number) => void;
  onAddHeading: (level?: 'h1' | 'h2' | 'h3', insertAfterIndex?: number) => void;
  onAddParagraph: (insertAfterIndex?: number) => void;
  onAddTable: (insertAfterIndex?: number) => void;
  onAddFigure: (insertAfterIndex?: number) => void;
  onAddCitation?: (insertAfterIndex?: number) => void;
  onAddEquation?: (insertAfterIndex?: number) => void;
  /** Page group this section belongs to (stable object per group) and whether it opens the group. */
  setFileInputRef: (idx: number, el: HTMLInputElement | null) => void;
  onStartEdit: (secId: string) => void;
  onEndEdit: () => void;
}

const SectionCardItemBase: React.FC<SectionCardItemProps> = ({
  sec,
  secId,
  idx,
  isFirst,
  isLast,
  isDeleting,
  isNewlyAdded,
  isEditing,
  activeModalType,
  settingsTriggerRect,
  isPrevFigure,
  prevFigureCaption,
  references,
  onUpdateSection,
  onRemoveSection,
  onMoveUp,
  onMoveDown,
  onConvertToHeading,
  onConvertToParagraph,
  onOpenTableZoom,
  onOpenFigureSettings,
  onOpenTableSettings,
  onCloseSettings,
  onSaveFigureSettings,
  onSaveTableSettings,
  onOpenLightbox,
  onDetachFigureSource,
  onMergeParagraphIntoPrevFigure,
  onPasteFigureImage,
  onDropFigureImage,
  onFileInputChange,
  onPasteImageFromClipboardButton,
  onTriggerFileInput,
  onPasteTableData,
  onPasteTableFromClipboardButton,
  onAddHeading,
  onAddParagraph,
  onAddTable,
  onAddFigure,
  onAddCitation,
  onAddEquation,
  setFileInputRef,
  onStartEdit,
  onEndEdit,
}) => {
  const isHeading = sec.type === 'h1' || sec.type === 'h2' || sec.type === 'h3';
  const isTable = sec.type === 'table';
  const isFigure = sec.type === 'figure';
  const isEquation = sec.type === 'equation';
  const isParagraph = sec.type === 'paragraph';
  const isCardSettingsOpen = activeModalType === 'figure' || activeModalType === 'table';
  const elevateStack = isCardSettingsOpen || isEditing;

  const handleClearPageBreak = useCallback(() => {
    onUpdateSection(idx, { ...sec, pageBreakAfter: false });
  }, [onUpdateSection, idx, sec]);

  return (
    <div
      id={`section-card-${secId}`}
      className={`grid min-w-0 max-w-full w-full transition-all duration-300 ease-in-out ${
        isDeleting
          ? 'grid-rows-[0fr] opacity-0 scale-95 -translate-y-2 pointer-events-none'
          : 'grid-rows-[1fr] opacity-100 scale-100 translate-y-0'
      } ${isNewlyAdded ? 'animate-section-enter' : ''}`}
    >
      <div className={`min-w-0 max-w-full w-full ${isDeleting ? 'overflow-hidden' : ''}`}>
        <div
          className={`p-3.5 rounded-3xl space-y-2.5 shadow-2xs transition-all duration-300 group min-w-0 max-w-full w-full bg-gray-200/50 hover:bg-gray-200/70 ${
            elevateStack ? 'z-50 relative' : 'z-0 relative'
          } ${
            isNewlyAdded ? 'section-highlight-glow ring-2 ring-blue-300' : ''
          }`}
        >
          {/* Section Header Controls */}
          <SectionHeaderCard
            sec={sec}
            idx={idx}
            isFirst={isFirst}
            isLast={isLast}
            isDeleting={isDeleting}
            onUpdateSection={onUpdateSection}
            onRemoveSection={onRemoveSection}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onConvertToHeading={onConvertToHeading}
            onConvertToParagraph={onConvertToParagraph}
            onOpenTableZoom={onOpenTableZoom}
            activeModalType={activeModalType}
            settingsTriggerRect={settingsTriggerRect}
            onOpenFigureSettings={onOpenFigureSettings}
            onOpenTableSettings={onOpenTableSettings}
            onCloseSettings={onCloseSettings}
            onSaveFigureSettings={onSaveFigureSettings}
            onSaveTableSettings={onSaveTableSettings}
          />

          {/* 1. HEADING */}
          {isHeading && (
            <HeadingSectionItem
              sec={sec}
              idx={idx}
              onUpdateSection={onUpdateSection}
            />
          )}

          {/* 2. PARAGRAPH */}
          {isParagraph && (
            <ParagraphSectionItem
              sec={sec}
              idx={idx}
              isPrevFigure={isPrevFigure}
              prevFigureCaption={prevFigureCaption}
              isEditing={isEditing}
              onStartEdit={onStartEdit}
              onEndEdit={onEndEdit}
              onUpdateSection={onUpdateSection}
              onMergeParagraphIntoPrevFigure={onMergeParagraphIntoPrevFigure}
              references={references}
            />
          )}

          {/* 3. TABLE */}
          {isTable && (
            <TableSectionItem
              sec={sec}
              idx={idx}
              onUpdateSection={onUpdateSection}
              onOpenTableZoom={onOpenTableZoom}
              onPasteTableData={onPasteTableData}
              onPasteTableFromClipboardButton={onPasteTableFromClipboardButton}
            />
          )}

          {/* 4. FIGURE */}
          {isFigure && (
            <FigureSectionItem
              sec={sec}
              idx={idx}
              setFileInputRef={setFileInputRef}
              onUpdateSection={onUpdateSection}
              onOpenLightbox={onOpenLightbox}
              onDetachFigureSource={onDetachFigureSource}
              onPasteFigureImage={onPasteFigureImage}
              onDropFigureImage={onDropFigureImage}
              onFileInputChange={onFileInputChange}
              onPasteImageFromClipboardButton={onPasteImageFromClipboardButton}
              onTriggerFileInput={onTriggerFileInput}
            />
          )}

          {/* 5. EQUATION */}
          {isEquation && <EquationSectionItem sec={sec} idx={idx} onUpdateSection={onUpdateSection} />}

          {/* Quick Add Bar below section */}
          <SectionInsertDivider
            idx={idx}
            onAddHeading={onAddHeading}
            onAddParagraph={onAddParagraph}
            onAddTable={onAddTable}
            onAddFigure={onAddFigure}
            onAddCitation={onAddCitation}
            onAddEquation={onAddEquation}
          />
        </div>
      </div>

      {/* Page Break Visual Indicator between sections */}
      {sec.pageBreakAfter && (
        <div className="flex items-center gap-2 my-2 py-1 select-none animate-fadeIn">
          <div className="flex-1 border-t-2 border-dashed border-gray-300" />
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-700 text-[11px] font-bold shadow-2xs">
            <Scissors className="w-3.5 h-3.5 rotate-90 text-gray-600" />
            <span>Ngắt trang — Khối tiếp theo sẽ bắt đầu ở trang mới</span>
            <button
              type="button"
              onClick={handleClearPageBreak}
              className="ml-1 p-0.5 hover:bg-gray-200 rounded text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
              title="Hủy ngắt trang"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 border-t-2 border-dashed border-gray-300" />
        </div>
      )}
    </div>
  );
};

export const SectionCardItem = React.memo(SectionCardItemBase);
SectionCardItem.displayName = 'SectionCardItem';
