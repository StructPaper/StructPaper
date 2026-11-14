'use client';

import { useState, useRef, useCallback } from 'react';
import { PaperSection, PaperTable, PaperFigure } from '@/types/paper';

export function useSectionInspectors(
  sections: PaperSection[],
  onUpdateSection: (index: number, updated: PaperSection) => void
) {
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;
  const onUpdateSectionRef = useRef(onUpdateSection);
  onUpdateSectionRef.current = onUpdateSection;

  // Table Zoom / Spreadsheet Modal State
  const [zoomTableInfo, setZoomTableInfo] = useState<{
    secIndex: number;
    table: PaperTable;
  } | null>(null);

  const zoomTableInfoRef = useRef(zoomTableInfo);
  zoomTableInfoRef.current = zoomTableInfo;

  const handleOpenTableZoom = useCallback((secIndex: number, table: PaperTable) => {
    setZoomTableInfo({ secIndex, table });
  }, []);

  const handleSaveZoomTable = useCallback((updatedTable: PaperTable) => {
    const info = zoomTableInfoRef.current;
    if (!info) return;
    const sec = sectionsRef.current[info.secIndex];
    if (!sec) return;
    onUpdateSectionRef.current(info.secIndex, {
      ...sec,
      content: updatedTable.caption,
      table: updatedTable,
    });
    setZoomTableInfo(null);
  }, []);

  // Contextual Inspector Settings State
  const [activeSettings, setActiveSettings] = useState<{
    secIndex: number;
    type: 'figure' | 'table';
    triggerRect?: DOMRect;
  } | null>(null);

  const handleOpenFigureSettings = useCallback((secIndex: number, rect?: DOMRect) => {
    setActiveSettings({ secIndex, type: 'figure', triggerRect: rect });
  }, []);

  const handleOpenTableSettings = useCallback((secIndex: number, rect?: DOMRect) => {
    setActiveSettings({ secIndex, type: 'table', triggerRect: rect });
  }, []);

  const handleCloseSettings = useCallback(() => {
    setActiveSettings(null);
  }, []);

  const handleSaveFigureSettings = useCallback((secIndex: number, updatedFigure: PaperFigure) => {
    const sec = sectionsRef.current[secIndex];
    if (!sec) return;
    onUpdateSectionRef.current(secIndex, {
      ...sec,
      content: updatedFigure.caption,
      figure: updatedFigure,
    });
    setActiveSettings(null);
  }, []);

  const handleSaveTableSettings = useCallback((secIndex: number, updatedTable: PaperTable) => {
    const sec = sectionsRef.current[secIndex];
    if (!sec) return;
    onUpdateSectionRef.current(secIndex, {
      ...sec,
      content: updatedTable.caption,
      table: updatedTable,
    });
    setActiveSettings(null);
  }, []);

  return {
    zoomTableInfo,
    setZoomTableInfo,
    handleOpenTableZoom,
    handleSaveZoomTable,
    activeSettings,
    handleOpenFigureSettings,
    handleOpenTableSettings,
    handleCloseSettings,
    handleSaveFigureSettings,
    handleSaveTableSettings,
  };
}
