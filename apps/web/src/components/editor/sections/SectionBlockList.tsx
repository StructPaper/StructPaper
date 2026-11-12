'use client';

import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import type { VirtualItem } from '@tanstack/react-virtual';
import { PaperSection, PaperTable, PaperFigure, PaperReference } from '@/types/paper';
import {
  useSectionVirtualizer,
  getSectionId,
  type SectionVirtualizerSnapshot,
} from './useSectionVirtualizer';
import { SectionCardItem } from './SectionCardItem';
import { matchesSectionFilter } from '@/lib/editor/section-filter';
import type { SectionFilterType } from '../hooks/tab-view-state-store';
import {
  EndOfListIndicator,
  FilteredSectionsEmptyState,
  EmptySectionsState,
} from './SectionEmptyStates';

export interface DisplayedSectionItem {
  sec: PaperSection;
  secId: string;
  originalIdx: number;
  isPrevFigure: boolean;
  prevFigureCaption?: string;
}

export interface SectionBlockListProps {
  sections: PaperSection[];
  displayedItems?: DisplayedSectionItem[];
  totalSectionsCount?: number;
  filterType: SectionFilterType;
  setFilterType: (filter: SectionFilterType) => void;
  newlyAddedId: string | null;
  /** Jump to a section (e.g. from a click in the PDF preview); a new `n` repeats the jump to the same id. */
  scrollRequest?: { id: string; n: number } | null;
  deletingIds: Set<string>;
  activeEditingParaId: string | null;
  setActiveEditingParaId: (id: string | null) => void;
  onStartEdit?: (secId: string) => void;
  onEndEdit?: () => void;
  activeSettings: {
    secIndex: number;
    type: 'figure' | 'table';
    triggerRect?: DOMRect;
  } | null;
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
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
  setFileInputRef: (idx: number, el: HTMLInputElement | null) => void;
  references?: PaperReference[];
  initialScrollOffset?: number;
  initialMeasurementsCache?: VirtualItem[];
  virtualizerPaperId?: string | null;
  getSavedScrollOffset?: () => number;
  onSaveVirtualSnapshot?: (
    snapshot: SectionVirtualizerSnapshot,
    paperId?: string | null,
    scrollEl?: HTMLElement | null
  ) => void;
}

const SectionBlockListBase: React.FC<SectionBlockListProps> = ({
  sections,
  displayedItems: propDisplayedItems,
  totalSectionsCount: propTotalSectionsCount,
  filterType,
  setFilterType,
  newlyAddedId,
  scrollRequest,
  deletingIds,
  activeEditingParaId,
  setActiveEditingParaId,
  onStartEdit,
  onEndEdit,
  activeSettings,
  scrollContainerRef: propScrollContainerRef,
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
  references,
  onAddHeading,
  onAddParagraph,
  onAddTable,
  onAddFigure,
  onAddCitation,
  onAddEquation,
  setFileInputRef,
  initialScrollOffset,
  initialMeasurementsCache,
  virtualizerPaperId,
  getSavedScrollOffset,
  onSaveVirtualSnapshot,
}) => {
  const totalSectionsCount = propTotalSectionsCount ?? sections.length;

  const displayedItems = useMemo<DisplayedSectionItem[]>(() => {
    if (propDisplayedItems) return propDisplayedItems;
    const list: DisplayedSectionItem[] = [];
    for (let originalIdx = 0; originalIdx < sections.length; originalIdx++) {
      const sec = sections[originalIdx];
      if (sec.type === 'citation') continue;
      if (!matchesSectionFilter(sec, filterType)) continue;

      const prevSec = originalIdx > 0 ? sections[originalIdx - 1] : undefined;
      const isPrevFigure = prevSec?.type === 'figure';
      list.push({
        sec,
        secId: getSectionId(sec, originalIdx),
        originalIdx,
        isPrevFigure,
        prevFigureCaption: isPrevFigure ? prevSec.figure?.caption : undefined,
      });
    }
    return list;
  }, [propDisplayedItems, sections, filterType]);

  const {
    scrollContainerRef,
    virtualizer,
    virtualItems,
    totalSize,
    scrollToSectionId,
    notifyScrollResetToTop,
  } = useSectionVirtualizer({
    items: displayedItems,
    scrollContainerRef: propScrollContainerRef,
    initialOffset: initialScrollOffset,
    initialMeasurementsCache,
    filterKey: filterType,
    paperId: virtualizerPaperId,
    getSavedScrollOffset,
    onSaveSnapshot: onSaveVirtualSnapshot,
  });

  useEffect(() => {
    if (scrollRequest) scrollToSectionId(scrollRequest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRequest]);

  const lastHandledNewlyAddedRef = useRef<string | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusRafRef = useRef<number | null>(null);

  const clearPendingFocus = useCallback(() => {
    if (focusTimerRef.current !== null) {
      clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    if (focusRafRef.current !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(focusRafRef.current);
      focusRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPendingFocus();
    };
  }, [newlyAddedId, clearPendingFocus]);

  // Coordinate newlyAddedId scroll-to-index + DOM focus even past virtualized fold
  useEffect(() => {
    if (!newlyAddedId) {
      lastHandledNewlyAddedRef.current = null;
      return;
    }
    if (lastHandledNewlyAddedRef.current === newlyAddedId) return;

    const scrolled = scrollToSectionId(newlyAddedId);
    if (!scrolled) return;

    lastHandledNewlyAddedRef.current = newlyAddedId;
    clearPendingFocus();

    const targetId = newlyAddedId;
    const focusTarget = () => {
      const cardEl = document.getElementById(`section-card-${targetId}`);
      if (!cardEl) return;
      const inputEl = cardEl.querySelector<HTMLElement>(
        'textarea, input[type="text"], [contenteditable="true"], [role="textbox"]'
      );
      inputEl?.focus();
    };

    focusTimerRef.current = setTimeout(() => {
      focusTimerRef.current = null;
      if (typeof requestAnimationFrame === 'function') {
        focusRafRef.current = requestAnimationFrame(() => {
          focusRafRef.current = null;
          focusTarget();
        });
      } else {
        focusTarget();
      }
    }, 50);
  }, [newlyAddedId, displayedItems, scrollToSectionId, clearPendingFocus]);

  const handleStartEditFallback = useCallback(
    (secId: string) => {
      setActiveEditingParaId(secId);
    },
    [setActiveEditingParaId]
  );

  const handleEndEditFallback = useCallback(() => {
    setActiveEditingParaId(null);
  }, [setActiveEditingParaId]);

  const resolvedOnStartEdit = onStartEdit ?? handleStartEditFallback;
  const resolvedOnEndEdit = onEndEdit ?? handleEndEditFallback;

  const prevEditingIdRef = useRef<string | null>(null);
  const wasEditingRowMountedRef = useRef(false);

  // Clear activeEditingParaId when an active paragraph scrolls outside the virtualized overscan window
  useEffect(() => {
    if (prevEditingIdRef.current !== activeEditingParaId) {
      prevEditingIdRef.current = activeEditingParaId;
      wasEditingRowMountedRef.current = false;
    }
    if (!activeEditingParaId) return;

    const isCurrentlyMounted = virtualItems.some(
      (vItem) => displayedItems[vItem.index]?.secId === activeEditingParaId
    );
    if (isCurrentlyMounted) {
      wasEditingRowMountedRef.current = true;
      return;
    }

    if (wasEditingRowMountedRef.current) {
      wasEditingRowMountedRef.current = false;
      resolvedOnEndEdit();
    }
  }, [activeEditingParaId, virtualItems, displayedItems, resolvedOnEndEdit]);

  const handleScrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    notifyScrollResetToTop();
  }, [scrollContainerRef, notifyScrollResetToTop]);

  const handleShowAll = useCallback(() => {
    setFilterType('all');
  }, [setFilterType]);

  const visibleSectionsCount = displayedItems.length;
  const endSubtitle =
    filterType === 'all'
      ? `Đã hiển thị toàn bộ ${totalSectionsCount} khối nội dung bài báo`
      : `Đã hiển thị toàn bộ ${visibleSectionsCount} khối theo bộ lọc đang chọn`;

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 min-h-0 min-w-0 w-full max-w-full overflow-y-auto overflow-x-hidden pr-1"
    >
      {visibleSectionsCount > 0 ? (
        <>
          <div
            style={{
              height: `${totalSize}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualItems.map((virtualItem) => {
              const entry = displayedItems[virtualItem.index];
              if (!entry) return null;

              const { sec, secId, originalIdx, isPrevFigure, prevFigureCaption } = entry;
              const isDeleting = deletingIds.has(secId);
              const isNewlyAdded = sec.id === newlyAddedId;
              const isEditing = activeEditingParaId === secId;
              const activeModalType =
                activeSettings?.secIndex === originalIdx ? activeSettings.type : null;
              const settingsTriggerRect =
                activeSettings?.secIndex === originalIdx
                  ? activeSettings.triggerRect
                  : undefined;
              const isSettingsOpen = activeModalType !== null;
              const hasSpacingAfter = virtualItem.index < displayedItems.length - 1;

              return (
                <div
                  key={secId}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className={`hover:z-20 focus-within:z-30 ${hasSpacingAfter ? 'pb-2' : ''}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                    zIndex: isEditing || isSettingsOpen ? 40 : undefined,
                  }}
                >
                  <SectionCardItem
                    sec={sec}
                    secId={secId}
                    idx={originalIdx}
                    isFirst={originalIdx === 0}
                    isLast={originalIdx === totalSectionsCount - 1}
                    isDeleting={isDeleting}
                    isNewlyAdded={isNewlyAdded}
                    isEditing={isEditing}
                    activeModalType={activeModalType}
                    settingsTriggerRect={settingsTriggerRect}
                    isPrevFigure={isPrevFigure}
                    prevFigureCaption={prevFigureCaption}
                    references={sec.type === 'paragraph' ? references : undefined}
                    onUpdateSection={onUpdateSection}
                    onRemoveSection={onRemoveSection}
                    onMoveUp={onMoveUp}
                    onMoveDown={onMoveDown}
                    onConvertToHeading={onConvertToHeading}
                    onConvertToParagraph={onConvertToParagraph}
                    onOpenTableZoom={onOpenTableZoom}
                    onOpenFigureSettings={onOpenFigureSettings}
                    onOpenTableSettings={onOpenTableSettings}
                    onCloseSettings={onCloseSettings}
                    onSaveFigureSettings={onSaveFigureSettings}
                    onSaveTableSettings={onSaveTableSettings}
                    onOpenLightbox={onOpenLightbox}
                    onDetachFigureSource={onDetachFigureSource}
                    onMergeParagraphIntoPrevFigure={onMergeParagraphIntoPrevFigure}
                    onPasteFigureImage={onPasteFigureImage}
                    onDropFigureImage={onDropFigureImage}
                    onFileInputChange={onFileInputChange}
                    onPasteImageFromClipboardButton={onPasteImageFromClipboardButton}
                    onTriggerFileInput={onTriggerFileInput}
                    onPasteTableData={onPasteTableData}
                    onPasteTableFromClipboardButton={onPasteTableFromClipboardButton}
                    onAddHeading={onAddHeading}
                    onAddParagraph={onAddParagraph}
                    onAddTable={onAddTable}
                    onAddFigure={onAddFigure}
                    onAddCitation={onAddCitation}
                    onAddEquation={onAddEquation}
                    setFileInputRef={setFileInputRef}
                    onStartEdit={resolvedOnStartEdit}
                    onEndEdit={resolvedOnEndEdit}
                  />
                </div>
              );
            })}
          </div>

          <EndOfListIndicator
            className="mt-2"
            title="Bạn đã lướt đến cuối nội dung bài báo"
            subtitle={endSubtitle}
            onScrollToTop={handleScrollToTop}
          />
        </>
      ) : totalSectionsCount > 0 ? (
        <FilteredSectionsEmptyState
          totalSections={totalSectionsCount}
          onShowAll={handleShowAll}
        />
      ) : (
        <EmptySectionsState
          onAddHeading={onAddHeading}
          onAddParagraph={onAddParagraph}
        />
      )}
    </div>
  );
};

export const SectionBlockList = React.memo(SectionBlockListBase);
SectionBlockList.displayName = 'SectionBlockList';
