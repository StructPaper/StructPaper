'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GridAreaCoords } from '@/types/template-builder';

interface UseGridMarqueeProps {
  columns: number;
  rows: number;
  isCellOccupied?: (row: number, col: number) => boolean;
  onCommitArea?: (area: GridAreaCoords) => void;
}

export interface MarqueeArea extends GridAreaCoords {
  colEnd: number;
  rowEnd: number;
}

/**
 * Reusable Drag Marquee hook for both Paper Grid and Nested Sub-Grids.
 * Tracks continuous cell-by-cell rectangular marquee dragging with collision detection.
 */
export function useGridMarquee({
  columns,
  rows,
  isCellOccupied,
  onCommitArea,
}: UseGridMarqueeProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startCell, setStartCell] = useState<{ row: number; col: number } | null>(null);
  const [currentCell, setCurrentCell] = useState<{ row: number; col: number } | null>(null);

  const startDrag = useCallback(
    (row: number, col: number, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (isCellOccupied?.(row, col)) return;
      setIsDragging(true);
      setStartCell({ row, col });
      setCurrentCell({ row, col });
    },
    [isCellOccupied]
  );

  const updateDrag = useCallback(
    (row: number, col: number) => {
      if (!isDragging) return;
      setCurrentCell((prev) => {
        if (prev?.row === row && prev?.col === col) return prev;
        return { row, col };
      });
    },
    [isDragging]
  );

  const cancelDrag = useCallback(() => {
    setIsDragging(false);
    setStartCell(null);
    setCurrentCell(null);
  }, []);

  // Compute normalized bounding box
  const marqueeArea: MarqueeArea | null =
    isDragging && startCell && currentCell
      ? {
          rowStart: Math.min(startCell.row, currentCell.row),
          colStart: Math.min(startCell.col, currentCell.col),
          rowSpan: Math.abs(currentCell.row - startCell.row) + 1,
          colSpan: Math.abs(currentCell.col - startCell.col) + 1,
          rowEnd: Math.max(startCell.row, currentCell.row),
          colEnd: Math.max(startCell.col, currentCell.col),
        }
      : null;

  const marqueeRef = useRef(marqueeArea);
  marqueeRef.current = marqueeArea;

  const onCommitRef = useRef(onCommitArea);
  onCommitRef.current = onCommitArea;

  // Window mouseup listener to guarantee clean drop even if released outside
  useEffect(() => {
    const handleWindowMouseUp = () => {
      if (!isDragging) return;
      const area = marqueeRef.current;
      if (area) {
        onCommitRef.current?.({
          rowStart: area.rowStart,
          colStart: area.colStart,
          rowSpan: area.rowSpan,
          colSpan: area.colSpan,
        });
      }
      setIsDragging(false);
      setStartCell(null);
      setCurrentCell(null);
    };

    if (isDragging) {
      window.addEventListener('mouseup', handleWindowMouseUp);
      return () => window.removeEventListener('mouseup', handleWindowMouseUp);
    }
  }, [isDragging]);

  return {
    isDragging,
    startCell,
    currentCell,
    marqueeArea,
    startDrag,
    updateDrag,
    cancelDrag,
  };
}
