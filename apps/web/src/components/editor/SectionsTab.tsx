'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { PaperSection, PaperTable, PaperFigure } from '@/types/paper';
import { SectionsTabProps } from './types';
import { TableSpreadsheetModal } from './TableSpreadsheetModal';
import {
  applyScrollTopInstantly,
  isElementHiddenByCss,
  useSectionsTabViewState,
  type SectionFilterType,
  type SectionsTabViewState,
} from './hooks';
import {
  SectionActionToolbar,
  SectionBlockList,
  FigureLightboxModal,
  useSectionMediaHandlers,
  useSectionInspectors,
  getSectionId,
  type DisplayedSectionItem,
} from './sections';
import { useEditorCommandBus } from './command-bus-adapter';
import {
  dispatchAddSection,
  dispatchUpdateSection,
  dispatchRemoveSection,
  dispatchReorderSections,
} from './dispatchers/sections-dispatchers';
import { matchesSectionFilter } from '@/lib/editor/section-filter';


const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect;

export const SectionsTab: React.FC<SectionsTabProps> = ({
  sections,
  onChange,
  references,
  commandBus: propCommandBus,
  focusRequest,
}) => {
  const contextCommandBus = useEditorCommandBus().commandBus;
  const activeBus = propCommandBus || contextCommandBus;

  const {
    paperId,
    peekInitialSectionsState,
    consumePendingSectionsReset,
    getSectionsState,
    updateSectionsFilter,
    subscribeSectionsFilter,
    saveVirtualSnapshot,
  } = useSectionsTabViewState();

  const [initialSnapshot, setInitialSnapshot] = useState<SectionsTabViewState>(() =>
    peekInitialSectionsState()
  );
  const [filterType, setFilterType] = useState<SectionFilterType>(
    initialSnapshot.filterType
  );
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Active editing paragraph ID (null means viewing mode with colored [1] citations)
  const [activeEditingParaId, setActiveEditingParaId] = useState<string | null>(null);

  // Lightbox Zoom State
  const [lightboxFigure, setLightboxFigure] = useState<PaperFigure | null>(null);
  const [isClosingLightbox, setIsClosingLightbox] = useState<boolean>(false);
  const [mounted, setMounted] = useState<boolean>(false);

  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const activeBusRef = useRef(activeBus);
  activeBusRef.current = activeBus;
  const deletingIdsRef = useRef(deletingIds);
  deletingIdsRef.current = deletingIds;
  const filterTypeRef = useRef(filterType);
  filterTypeRef.current = filterType;
  const isClosingLightboxRef = useRef(isClosingLightbox);
  isClosingLightboxRef.current = isClosingLightbox;

  const deleteTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const lightboxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPaperIdRef = useRef(paperId);

  useIsomorphicLayoutEffect(() => {
    if (prevPaperIdRef.current !== paperId) {
      prevPaperIdRef.current = paperId;
      const nextInitial = peekInitialSectionsState();
      setInitialSnapshot(nextInitial);
      filterTypeRef.current = nextInitial.filterType;
      setFilterType(nextInitial.filterType);
      if (scrollContainerRef.current && scrollContainerRef.current.scrollTop !== 0) {
        applyScrollTopInstantly(scrollContainerRef.current, 0);
      }
    }
    consumePendingSectionsReset();

    const storeFilter = getSectionsState().filterType;
    if (storeFilter !== filterTypeRef.current) {
      filterTypeRef.current = storeFilter;
      setFilterType(storeFilter);
    }

    return subscribeSectionsFilter((nextFilter) => {
      if (nextFilter !== filterTypeRef.current) {
        filterTypeRef.current = nextFilter;
        setFilterType(nextFilter);
      }
    });
  }, [
    paperId,
    peekInitialSectionsState,
    consumePendingSectionsReset,
    getSectionsState,
    subscribeSectionsFilter,
  ]);

  const handleFilterChange = useCallback(
    (nextFilter: SectionFilterType) => {
      if (nextFilter === filterTypeRef.current) return;
      filterTypeRef.current = nextFilter;
      setFilterType(nextFilter);
      updateSectionsFilter(nextFilter);
      if (scrollContainerRef.current && !isElementHiddenByCss(scrollContainerRef.current)) {
        applyScrollTopInstantly(scrollContainerRef.current, 0);
      }
    },
    [updateSectionsFilter]
  );

  const getSavedScrollOffset = useCallback(
    () => getSectionsState().scrollOffset,
    [getSectionsState]
  );

  useEffect(() => {
    setMounted(true);
    const deleteTimers = deleteTimersRef.current;
    return () => {
      deleteTimers.forEach((timer) => clearTimeout(timer));
      deleteTimers.clear();
      if (lightboxTimerRef.current !== null) {
        clearTimeout(lightboxTimerRef.current);
        lightboxTimerRef.current = null;
      }
    };
  }, []);

  // Clear highlight glow after newly added section enters view (scroll/focus handled by SectionBlockList)
  useEffect(() => {
    if (!newlyAddedId) return;

    const clearTimer = setTimeout(() => {
      setNewlyAddedId(null);
    }, 1800);

    return () => {
      clearTimeout(clearTimer);
    };
  }, [newlyAddedId]);

  const handleOpenLightbox = useCallback((fig: PaperFigure) => {
    if (lightboxTimerRef.current !== null) {
      clearTimeout(lightboxTimerRef.current);
      lightboxTimerRef.current = null;
    }
    setIsClosingLightbox(false);
    setLightboxFigure(fig);
  }, []);

  const handleCloseLightbox = useCallback(() => {
    if (isClosingLightboxRef.current) return;
    setIsClosingLightbox(true);
    lightboxTimerRef.current = setTimeout(() => {
      lightboxTimerRef.current = null;
      setLightboxFigure(null);
      setIsClosingLightbox(false);
    }, 240);
  }, []);

  // Lightbox keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxFigure && !isClosingLightbox) {
        handleCloseLightbox();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxFigure, isClosingLightbox, handleCloseLightbox]);

  const prevSectionCountsRef = useRef<{
    all: number;
    heading: number;
    paragraph: number;
    table: number;
    figure: number;
    equation: number;
    citation: number;
  } | null>(null);

  // Single-pass counts over sections (keeps stable identity when all 6 counts match)
  const sectionCounts = useMemo(() => {
    let all = 0;
    let heading = 0;
    let paragraph = 0;
    let table = 0;
    let figure = 0;
    let equation = 0;
    let citation = 0;

    for (let i = 0; i < sections.length; i++) {
      const type = sections[i].type;
      if (type === 'citation') {
        citation++;
        continue;
      }
      all++;
      if (type === 'h1' || type === 'h2' || type === 'h3') {
        heading++;
      } else if (type === 'paragraph') {
        paragraph++;
      } else if (type === 'table') {
        table++;
      } else if (type === 'figure') {
        figure++;
      } else if (type === 'equation') {
        equation++;
      }
    }

    const prev = prevSectionCountsRef.current;
    if (
      prev &&
      prev.all === all &&
      prev.heading === heading &&
      prev.paragraph === paragraph &&
      prev.table === table &&
      prev.figure === figure &&
      prev.equation === equation &&
      prev.citation === citation
    ) {
      return prev;
    }

    const next = { all, heading, paragraph, table, figure, equation, citation };
    prevSectionCountsRef.current = next;
    return next;
  }, [sections]);

  const sectionCountsRef = useRef(sectionCounts);
  sectionCountsRef.current = sectionCounts;

  const toolbarCounts = useMemo(
    () => ({
      all: sectionCounts.all,
      headings: sectionCounts.heading,
      paragraphs: sectionCounts.paragraph,
      tables: sectionCounts.table,
      figures: sectionCounts.figure,
      equations: sectionCounts.equation,
    }),
    [sectionCounts]
  );

  const [scrollRequest, setScrollRequest] = useState<{ id: string; n: number } | null>(null);
  const jumpToSection = useCallback((id: string) => {
    if (filterTypeRef.current !== 'all') {
      filterTypeRef.current = 'all';
      setFilterType('all');
      updateSectionsFilter('all');
    }
    setScrollRequest((r) => ({ id, n: (r?.n ?? 0) + 1 }));
  }, [updateSectionsFilter]);

  // A click in the PDF preview: show and highlight that section
  useEffect(() => {
    if (!focusRequest) return;
    jumpToSection(focusRequest.id);
    setNewlyAddedId(focusRequest.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusRequest]);

  // Filtered display entries with precomputed adjacent-figure context
  const displayedItems = useMemo<DisplayedSectionItem[]>(() => {
    const items: DisplayedSectionItem[] = [];
    for (let originalIdx = 0; originalIdx < sections.length; originalIdx++) {
      const sec = sections[originalIdx];
      if (sec.type === 'citation') continue;

      if (!matchesSectionFilter(sec, filterType)) continue;

      const prevSec = originalIdx > 0 ? sections[originalIdx - 1] : undefined;
      const isPrevFigure = prevSec?.type === 'figure';

      items.push({
        sec,
        secId: getSectionId(sec, originalIdx),
        originalIdx,
        isPrevFigure,
        prevFigureCaption: isPrevFigure ? prevSec.figure?.caption : undefined,
      });
    }
    return items;
  }, [sections, filterType]);

  // Handlers for section modification via dispatchers (stable callbacks reading latest refs)
  const handleUpdateSection = useCallback((index: number, updated: PaperSection) => {
    dispatchUpdateSection(
      activeBusRef.current,
      index,
      updated,
      onChangeRef.current,
      sectionsRef.current
    );
  }, []);

  const handleRemoveSection = useCallback((index: number) => {
    const sec = sectionsRef.current[index];
    if (!sec) return;
    const secId = getSectionId(sec, index);
    if (deletingIdsRef.current.has(secId)) return;

    setDeletingIds((prev) => new Set(prev).add(secId));

    const timer = setTimeout(() => {
      deleteTimersRef.current.delete(timer);
      dispatchRemoveSection(
        activeBusRef.current,
        secId,
        onChangeRef.current,
        sectionsRef.current
      );
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(secId);
        return next;
      });
    }, 320);

    deleteTimersRef.current.add(timer);
  }, []);

  const handleMoveUp = useCallback((index: number) => {
    if (index <= 0) return;
    dispatchReorderSections(
      activeBusRef.current,
      index,
      index - 1,
      onChangeRef.current,
      sectionsRef.current
    );
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    if (index >= sectionsRef.current.length - 1) return;
    dispatchReorderSections(
      activeBusRef.current,
      index,
      index + 1,
      onChangeRef.current,
      sectionsRef.current
    );
  }, []);

  const handleInsertSection = useCallback(
    (insertAfterIndex: number | undefined, newSection: PaperSection) => {
      dispatchAddSection(
        activeBusRef.current,
        newSection,
        insertAfterIndex,
        onChangeRef.current,
        sectionsRef.current
      );
      setNewlyAddedId(newSection.id);
      if (filterTypeRef.current !== 'all') {
        filterTypeRef.current = 'all';
        setFilterType('all');
        updateSectionsFilter('all');
      }
    },
    [updateSectionsFilter]
  );

  // Inspector and Media hooks
  const inspectors = useSectionInspectors(sections, handleUpdateSection);
  const mediaHandlers = useSectionMediaHandlers(sections, handleUpdateSection);

  // Add new sections
  const handleAddHeading = useCallback(
    (type: 'h1' | 'h2' | 'h3' = 'h1', insertAfterIndex?: number) => {
      const newSection: PaperSection = {
        id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type,
        title: '',
        content: '',
      };
      handleInsertSection(insertAfterIndex, newSection);
    },
    [handleInsertSection]
  );

  const handleAddParagraph = useCallback(
    (insertAfterIndex?: number) => {
      const newSection: PaperSection = {
        id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'paragraph',
        content: '',
      };
      handleInsertSection(insertAfterIndex, newSection);
    },
    [handleInsertSection]
  );

  const handleAddTable = useCallback(
    (insertAfterIndex?: number) => {
      const tableCount = sectionCountsRef.current.table + 1;
      const newTable: PaperTable = {
        id: `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        num: tableCount,
        caption: `Bảng ${tableCount}: Tiêu đề bảng số liệu mới`,
        headers: [],
        rows: [],
        isFullWidth: true,
      };
      const newSection: PaperSection = {
        id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'table',
        content: newTable.caption,
        table: newTable,
      };
      handleInsertSection(insertAfterIndex, newSection);
    },
    [handleInsertSection]
  );

  const handleAddFigure = useCallback(
    (insertAfterIndex?: number) => {
      const figCount = sectionCountsRef.current.figure + 1;
      const newFigure: PaperFigure = {
        id: `fig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        num: figCount,
        caption: `Hình ${figCount}: Chú thích hình ảnh minh họa mới`,
        src: '',
        isFullWidth: true,
      };
      const newSection: PaperSection = {
        id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'figure',
        content: newFigure.caption,
        figure: newFigure,
      };
      handleInsertSection(insertAfterIndex, newSection);
    },
    [handleInsertSection]
  );

  // Stable identity: it is passed to the memoised section cards, which must not re-render on every keystroke.
  const handleAddEquation = useCallback(
    (insertAfterIndex?: number) => {
      const newSection: PaperSection = {
        id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: 'equation',
        content: '',
        equation: { latex: '', numbered: true },
      };
      handleInsertSection(insertAfterIndex, newSection);
    },
    [handleInsertSection]
  );

  // Conversions between Paragraph and Heading
  const handleConvertToHeading = useCallback(
    (index: number, level: 'h1' | 'h2' | 'h3') => {
      const sec = sectionsRef.current[index];
      if (!sec) return;
      handleUpdateSection(index, {
        ...sec,
        type: level,
        title: sec.title || sec.content || (level === 'h1' ? 'TIÊU ĐỀ MỤC MỚI' : 'Tiêu đề mục con'),
        content: '',
      });
    },
    [handleUpdateSection]
  );

  const handleConvertToParagraph = useCallback(
    (index: number) => {
      const sec = sectionsRef.current[index];
      if (!sec) return;
      handleUpdateSection(index, {
        ...sec,
        type: 'paragraph',
        content: sec.content || sec.title || '',
        title: undefined,
      });
    },
    [handleUpdateSection]
  );

  // Merge paragraph into immediately preceding figure's source
  const handleMergeParagraphIntoPrevFigure = useCallback((paraIndex: number) => {
    if (paraIndex <= 0) return;
    const currentSections = sectionsRef.current;
    const prevSec = currentSections[paraIndex - 1];
    const currSec = currentSections[paraIndex];
    if (prevSec?.type === 'figure' && prevSec.figure && currSec) {
      const updatedPrev: PaperSection = {
        ...prevSec,
        figure: {
          ...prevSec.figure,
          source: currSec.content.trim(),
        },
      };
      const list = [...currentSections];
      list[paraIndex - 1] = updatedPrev;
      list.splice(paraIndex, 1);
      onChangeRef.current(list);
    }
  }, []);

  // Detach figure's source into an isolated paragraph
  const handleDetachFigureSource = useCallback((figIndex: number) => {
    const currentSections = sectionsRef.current;
    const figSec = currentSections[figIndex];
    if (!figSec?.figure?.source) return;
    const sourceText = figSec.figure.source;
    const updatedFig: PaperSection = {
      ...figSec,
      figure: {
        ...figSec.figure,
        source: undefined,
      },
    };
    const newParagraph: PaperSection = {
      id: `s_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'paragraph',
      content: sourceText,
    };
    const list = [...currentSections];
    list[figIndex] = updatedFig;
    list.splice(figIndex + 1, 0, newParagraph);
    onChangeRef.current(list);
    setNewlyAddedId(newParagraph.id);
    if (filterTypeRef.current !== 'all') {
      filterTypeRef.current = 'all';
      setFilterType('all');
      updateSectionsFilter('all');
    }
  }, [updateSectionsFilter]);

  const handleStartEdit = useCallback((secId: string) => {
    setActiveEditingParaId(secId);
  }, []);

  const handleEndEdit = useCallback(() => {
    setActiveEditingParaId(null);
  }, []);

  const handleCloseTableZoom = useCallback(() => {
    inspectors.setZoomTableInfo(null);
  }, [inspectors.setZoomTableInfo]);

  return (
    <div className="h-full flex flex-col min-h-0 min-w-0 w-full max-w-full overflow-hidden space-y-4 p-4 sm:p-5 sm:pt-3 sm:pb-1">
      {/* Top Header & Filter Toolbar */}
      <SectionActionToolbar
        totalSections={sectionCounts.all}
        filterType={filterType}
        onFilterChange={handleFilterChange}
        onAddHeading={handleAddHeading}
        onAddParagraph={handleAddParagraph}
        onAddTable={handleAddTable}
        onAddFigure={handleAddFigure}
        onAddEquation={() => handleAddEquation()}
        counts={toolbarCounts}
      />

      {/* Main Scrollable Sections & Blocks List */}
      <SectionBlockList
        sections={sections}
        displayedItems={displayedItems}
        totalSectionsCount={sections.length}
        references={references}
        filterType={filterType}
        setFilterType={handleFilterChange}
        newlyAddedId={newlyAddedId}
        scrollRequest={scrollRequest}
        deletingIds={deletingIds}
        activeEditingParaId={activeEditingParaId}
        setActiveEditingParaId={setActiveEditingParaId}
        onStartEdit={handleStartEdit}
        onEndEdit={handleEndEdit}
        activeSettings={inspectors.activeSettings}
        scrollContainerRef={scrollContainerRef}
        initialScrollOffset={initialSnapshot.scrollOffset}
        initialMeasurementsCache={initialSnapshot.measurementsCache}
        virtualizerPaperId={paperId}
        getSavedScrollOffset={getSavedScrollOffset}
        onSaveVirtualSnapshot={saveVirtualSnapshot}
        onUpdateSection={handleUpdateSection}
        onRemoveSection={handleRemoveSection}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onConvertToHeading={handleConvertToHeading}
        onConvertToParagraph={handleConvertToParagraph}
        onOpenTableZoom={inspectors.handleOpenTableZoom}
        onOpenFigureSettings={inspectors.handleOpenFigureSettings}
        onOpenTableSettings={inspectors.handleOpenTableSettings}
        onCloseSettings={inspectors.handleCloseSettings}
        onSaveFigureSettings={inspectors.handleSaveFigureSettings}
        onSaveTableSettings={inspectors.handleSaveTableSettings}
        onOpenLightbox={handleOpenLightbox}
        onDetachFigureSource={handleDetachFigureSource}
        onMergeParagraphIntoPrevFigure={handleMergeParagraphIntoPrevFigure}
        onPasteFigureImage={mediaHandlers.handlePasteFigureImage}
        onDropFigureImage={mediaHandlers.handleDropFigureImage}
        onFileInputChange={mediaHandlers.handleFileInputChange}
        onPasteImageFromClipboardButton={mediaHandlers.handlePasteImageFromClipboardButton}
        onTriggerFileInput={mediaHandlers.handleTriggerFileInput}
        onPasteTableData={mediaHandlers.handlePasteTableData}
        onPasteTableFromClipboardButton={mediaHandlers.handlePasteTableFromClipboardButton}
        onAddHeading={handleAddHeading}
        onAddParagraph={handleAddParagraph}
        onAddTable={handleAddTable}
        onAddFigure={handleAddFigure}
        onAddEquation={handleAddEquation}
        setFileInputRef={mediaHandlers.setFileInputRef}
      />

      {/* Smooth Fullscreen Image Lightbox Modal */}
      {mounted && (
        <FigureLightboxModal
          isOpen={Boolean(lightboxFigure)}
          figure={lightboxFigure}
          isClosing={isClosingLightbox}
          onClose={handleCloseLightbox}
        />
      )}

      {/* Fullscreen Excel Spreadsheet Table Modal */}
      {inspectors.zoomTableInfo && (
        <TableSpreadsheetModal
          isOpen={Boolean(inspectors.zoomTableInfo)}
          table={inspectors.zoomTableInfo.table}
          onSave={inspectors.handleSaveZoomTable}
          onClose={handleCloseTableZoom}
        />
      )}
    </div>
  );
};
