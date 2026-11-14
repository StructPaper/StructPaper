'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutZoneConfig, TemplateGridConfig, GridAreaCoords } from '@/types/template-builder';
import {
  GridCellCoord,
  GridDragSelection,
  normalizeSelectionToArea,
  doGridAreasOverlap,
  getZoneAtCell,
} from '@/types/grid-zones';
import { GridZoneCard } from './GridZoneCard';
import { findZoneDeep } from '../nested-zones/nestedZoneUtils';
import { Plus, Move } from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';

export interface PaperGridOverlayProps {
  gridConfig: TemplateGridConfig;
  zones: LayoutZoneConfig[];
  allZones?: LayoutZoneConfig[];
  selectedZoneId: string | null;
  focusedZoneId?: string | null;
  onSelectZone: (zoneId: string) => void;
  onAddZoneWithArea: (area: GridAreaCoords) => void;
  onUpdateZoneArea: (zoneId: string, area: GridAreaCoords) => void;
  onUpdateZoneSecondaryArea?: (zoneId: string, area: GridAreaCoords | null) => void;
  onDeleteZone: (zoneId: string) => void;
  onUpdateZoneName?: (zoneId: string, name: string) => void;
  onDrillDownZone?: (zoneId: string) => void;
  onAddSubZoneWithArea?: (parentId: string, area: GridAreaCoords) => void;
  onUpdateSubZone?: (subZoneId: string, updated: Partial<LayoutZoneConfig>) => void;
  onDeleteSubZone?: (subZoneId: string) => void;
  selectedSubZoneId?: string | null;
  onSelectSubZone?: (subZoneId: string) => void;
  onAssignElementToZone?: (elementId: string, zoneId: string) => void;
  bounds: {
    top: number;
    left: number;
    width: number;
    height: number;
  };
}

export const PaperGridOverlay: React.FC<PaperGridOverlayProps> = ({
  gridConfig,
  zones,
  allZones,
  selectedZoneId,
  focusedZoneId = null,
  onSelectZone,
  onAddZoneWithArea,
  onUpdateZoneArea,
  onUpdateZoneSecondaryArea,
  onDeleteZone,
  onUpdateZoneName,
  onDrillDownZone,
  onAddSubZoneWithArea,
  onUpdateSubZone,
  onDeleteSubZone,
  selectedSubZoneId,
  onSelectSubZone,
  onAssignElementToZone,
  bounds,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<GridDragSelection>({
    isDragging: false,
    startCell: null,
    currentCell: null,
    mode: 'create',
  });

  // Continuous mouse position tracker during drag-to-create (in unscaled container px)
  const [liveDrag, setLiveDrag] = useState<{
    startPos: { x: number; y: number } | null;
    currentPos: { x: number; y: number } | null;
  }>({
    startPos: null,
    currentPos: null,
  });

  // Continuous ghost box tracker during zone resizing
  const [liveResize, setLiveResize] = useState<{
    zoneId: string;
    left: number;
    top: number;
    width: number;
    height: number;
    colSpan: number;
    rowSpan: number;
  } | null>(null);

  // Continuous ghost box tracker during zone moving
  const [liveMove, setLiveMove] = useState<{
    zoneId: string;
    floatingLeft: number;
    floatingTop: number;
    snapLeft: number;
    snapTop: number;
    width: number;
    height: number;
    colStart: number;
    rowStart: number;
    colSpan: number;
    rowSpan: number;
    isValid: boolean;
  } | null>(null);

  const liveMoveRef = useRef(liveMove);
  liveMoveRef.current = liveMove;

  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  const { columns, rows, rowGap, colGap, unit = 'px' } = gridConfig;

  // Convert mm to px if unit is mm (1mm ~= 3.78px for screen display)
  const effectiveColGap = unit === 'mm' ? Math.round(colGap * 3.78) : colGap;
  const effectiveRowGap = unit === 'mm' ? Math.round(rowGap * 3.78) : rowGap;

  // Helper to compute exact unscaled pixel bounds of any grid area
  const getAreaRect = useCallback((area: GridAreaCoords) => {
    const cellW = (bounds.width - (columns - 1) * effectiveColGap) / columns;
    const cellH = (bounds.height - (rows - 1) * effectiveRowGap) / rows;
    const left = (area.colStart - 1) * (cellW + effectiveColGap);
    const top = (area.rowStart - 1) * (cellH + effectiveRowGap);
    const width = area.colSpan * cellW + (area.colSpan - 1) * effectiveColGap;
    const height = area.rowSpan * cellH + (area.rowSpan - 1) * effectiveRowGap;
    return { left, top, width, height };
  }, [bounds.width, bounds.height, columns, rows, effectiveColGap, effectiveRowGap]);

  // Track resizing state (supporting both 'se' bottom-right and 'nw' top-left opposite corners, and primary/secondary blocks)
  const resizeRef = useRef<{
    isResizing: boolean;
    zoneId: string | null;
    blockType: 'primary' | 'secondary';
    handle: 'se' | 'nw';
    initialArea: GridAreaCoords | null;
    initialRect: { left: number; top: number; width: number; height: number };
    startMouseX: number;
    startMouseY: number;
    cellWidth: number;
    cellHeight: number;
  }>({
    isResizing: false,
    zoneId: null,
    blockType: 'primary',
    handle: 'se',
    initialArea: null,
    initialRect: { left: 0, top: 0, width: 0, height: 0 },
    startMouseX: 0,
    startMouseY: 0,
    cellWidth: 80,
    cellHeight: 80,
  });

  // Track moving state (drag whole block into empty cells, supporting primary/secondary blocks)
  const moveRef = useRef<{
    isMoving: boolean;
    hasDragged: boolean;
    zoneId: string | null;
    blockType: 'primary' | 'secondary';
    initialArea: GridAreaCoords | null;
    initialRect: { left: number; top: number; width: number; height: number };
    startMouseX: number;
    startMouseY: number;
    cellWidth: number;
    cellHeight: number;
  }>({
    isMoving: false,
    hasDragged: false,
    zoneId: null,
    blockType: 'primary',
    initialArea: null,
    initialRect: { left: 0, top: 0, width: 0, height: 0 },
    startMouseX: 0,
    startMouseY: 0,
    cellWidth: 80,
    cellHeight: 80,
  });

  // Handle start dragging on an empty cell
  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    const occupied = getZoneAtCell(row, col, zones);
    if (occupied) return;

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scale = rect.width / (bounds.width || 1);
    const localX = (e.clientX - rect.left) / scale;
    const localY = (e.clientY - rect.top) / scale;

    const cellW = (bounds.width - (columns - 1) * effectiveColGap) / columns;
    const cellH = (bounds.height - (rows - 1) * effectiveRowGap) / rows;
    const cellOriginX = (col - 1) * (cellW + effectiveColGap);
    const cellOriginY = (row - 1) * (cellH + effectiveRowGap);

    setDragState({
      isDragging: true,
      startCell: { row, col },
      currentCell: { row, col },
      mode: 'create',
    });

    setLiveDrag({
      startPos: { x: cellOriginX + cellW / 2, y: cellOriginY + cellH / 2 },
      currentPos: { x: localX, y: localY },
    });
  };

  // Handle mouse up on canvas (finish drag creation)
  const handleMouseUp = useCallback(() => {
    const currentDrag = dragStateRef.current;
    if (currentDrag.isDragging && currentDrag.startCell && currentDrag.currentCell) {
      const area = normalizeSelectionToArea(currentDrag.startCell, currentDrag.currentCell);

      // Check collision with any existing zones
      const hasCollision = zones.some((z) => {
        if (!z.gridArea) return false;
        return doGridAreasOverlap(area, z.gridArea);
      });

      if (hasCollision) {
        toast.error('Bị trùng ô', 'Vùng bạn vừa chọn bị trùng với phân vùng đã có');
      } else {
        onAddZoneWithArea(area);
      }
    }

    setDragState({
      isDragging: false,
      startCell: null,
      currentCell: null,
      mode: 'create',
    });
    setLiveDrag({ startPos: null, currentPos: null });
  }, [zones, onAddZoneWithArea]);

  // Window mousemove and mouseup listeners to ensure smooth, continuous 60fps tracking
  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      // 1. Smooth Continuous Drag Creation
      if (dragStateRef.current.isDragging && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const scale = rect.width / (bounds.width || 1);
        const localX = Math.max(0, Math.min(bounds.width, (e.clientX - rect.left) / scale));
        const localY = Math.max(0, Math.min(bounds.height, (e.clientY - rect.top) / scale));

        setLiveDrag((prev) => ({
          ...prev,
          currentPos: { x: localX, y: localY },
        }));

        const cellW = (bounds.width - (columns - 1) * effectiveColGap) / columns;
        const cellH = (bounds.height - (rows - 1) * effectiveRowGap) / rows;
        const hoverCol = Math.max(
          1,
          Math.min(columns, Math.floor((localX + effectiveColGap * 0.5) / (cellW + effectiveColGap)) + 1)
        );
        const hoverRow = Math.max(
          1,
          Math.min(rows, Math.floor((localY + effectiveRowGap * 0.5) / (cellH + effectiveRowGap)) + 1)
        );

        if (
          !dragStateRef.current.currentCell ||
          dragStateRef.current.currentCell.row !== hoverRow ||
          dragStateRef.current.currentCell.col !== hoverCol
        ) {
          setDragState((prev) => ({
            ...prev,
            currentCell: { row: hoverRow, col: hoverCol },
          }));
        }
      }

      // 2. Smooth Continuous Zone Resizing (Both Top-Left 'nw' and Bottom-Right 'se')
      if (
        resizeRef.current.isResizing &&
        resizeRef.current.zoneId &&
        resizeRef.current.initialArea &&
        containerRef.current
      ) {
        const {
          zoneId,
          blockType,
          handle,
          initialArea,
          initialRect,
          startMouseX,
          startMouseY,
          cellWidth,
          cellHeight,
        } = resizeRef.current;
        const rect = containerRef.current.getBoundingClientRect();
        const scale = rect.width / (bounds.width || 1);

        const deltaX = (e.clientX - startMouseX) / scale;
        const deltaY = (e.clientY - startMouseY) / scale;

        const colShift = Math.round(deltaX / (cellWidth + effectiveColGap));
        const rowShift = Math.round(deltaY / (cellHeight + effectiveRowGap));

        const initialRowEnd = initialArea.rowStart + initialArea.rowSpan - 1;
        const initialColEnd = initialArea.colStart + initialArea.colSpan - 1;

        let newRowStart = initialArea.rowStart;
        let newColStart = initialArea.colStart;
        let newRowSpan = initialArea.rowSpan;
        let newColSpan = initialArea.colSpan;

        let liveLeft = initialRect.left;
        let liveTop = initialRect.top;
        let liveW = initialRect.width;
        let liveH = initialRect.height;

        if (handle === 'nw') {
          // Top-Left (Opposite corner)
          const fixedRight = initialRect.left + initialRect.width;
          const fixedBottom = initialRect.top + initialRect.height;
          const rawLeft = initialRect.left + deltaX;
          const rawTop = initialRect.top + deltaY;

          // Continuous pixel tracking (smooth 60fps rubber-band without snapping jank)
          liveLeft = Math.max(0, Math.min(fixedRight - cellWidth * 0.4, rawLeft));
          liveTop = Math.max(0, Math.min(fixedBottom - cellHeight * 0.4, rawTop));
          liveW = fixedRight - liveLeft;
          liveH = fixedBottom - liveTop;

          // Grid cell snapping
          newRowStart = Math.max(1, Math.min(initialRowEnd, initialArea.rowStart + rowShift));
          newColStart = Math.max(1, Math.min(initialColEnd, initialArea.colStart + colShift));
          newRowSpan = initialRowEnd - newRowStart + 1;
          newColSpan = initialColEnd - newColStart + 1;
        } else {
          // Bottom-Right ('se')
          // Continuous pixel tracking (smooth 60fps rubber-band without snapping jank)
          liveLeft = initialRect.left;
          liveTop = initialRect.top;
          liveW = Math.max(
            cellWidth * 0.4,
            Math.min(bounds.width - initialRect.left, initialRect.width + deltaX)
          );
          liveH = Math.max(
            cellHeight * 0.4,
            Math.min(bounds.height - initialRect.top, initialRect.height + deltaY)
          );

          // Grid cell snapping
          newColSpan = Math.max(
            1,
            Math.min(columns - initialArea.colStart + 1, initialArea.colSpan + colShift)
          );
          newRowSpan = Math.max(
            1,
            Math.min(rows - initialArea.rowStart + 1, initialArea.rowSpan + rowShift)
          );
        }

        const candidateArea: GridAreaCoords = {
          rowStart: newRowStart,
          colStart: newColStart,
          rowSpan: newRowSpan,
          colSpan: newColSpan,
        };

        // Check collision with all other zone rectangles
        const otherRectangles: GridAreaCoords[] = [];
        zones.forEach((z) => {
          if (z.id === zoneId) {
            if (blockType === 'primary' && z.secondaryGridArea) otherRectangles.push(z.secondaryGridArea);
            if (blockType === 'secondary' && z.gridArea) otherRectangles.push(z.gridArea);
          } else {
            if (z.gridArea) otherRectangles.push(z.gridArea);
            if (z.secondaryGridArea) otherRectangles.push(z.secondaryGridArea);
          }
        });
        const collides = otherRectangles.some((r) => doGridAreasOverlap(candidateArea, r));

        // Set live ghost box stretching smoothly with cursor continuously
        setLiveResize({
          zoneId,
          left: liveLeft,
          top: liveTop,
          width: liveW,
          height: liveH,
          colSpan: newColSpan,
          rowSpan: newRowSpan,
        });

        // Only commit area change if cell coordinates actually changed and does not collide
        if (!collides) {
          const currentZone = zones.find((z) => z.id === zoneId);
          const currentArea = blockType === 'secondary' ? currentZone?.secondaryGridArea : currentZone?.gridArea;
          if (
            !currentArea ||
            currentArea.rowStart !== candidateArea.rowStart ||
            currentArea.colStart !== candidateArea.colStart ||
            currentArea.rowSpan !== candidateArea.rowSpan ||
            currentArea.colSpan !== candidateArea.colSpan
          ) {
            if (blockType === 'secondary' && onUpdateZoneSecondaryArea) {
              onUpdateZoneSecondaryArea(zoneId, candidateArea);
            } else {
              onUpdateZoneArea(zoneId, candidateArea);
            }
          }
        }
      }

      // 3. Smooth Continuous Zone Drag-and-Drop Moving
      if (
        moveRef.current.isMoving &&
        moveRef.current.zoneId &&
        moveRef.current.initialArea &&
        containerRef.current
      ) {
        const { zoneId, blockType, initialArea, initialRect, startMouseX, startMouseY, cellWidth, cellHeight } =
          moveRef.current;
        const rect = containerRef.current.getBoundingClientRect();
        const scale = rect.width / (bounds.width || 1);

        const deltaX = (e.clientX - startMouseX) / scale;
        const deltaY = (e.clientY - startMouseY) / scale;

        if (!moveRef.current.hasDragged && Math.hypot(deltaX, deltaY) > 5) {
          moveRef.current.hasDragged = true;
        }

        if (moveRef.current.hasDragged) {
          const colShift = Math.round(deltaX / (cellWidth + effectiveColGap));
          const rowShift = Math.round(deltaY / (cellHeight + effectiveRowGap));

          const targetColStart = Math.max(
            1,
            Math.min(columns - initialArea.colSpan + 1, initialArea.colStart + colShift)
          );
          const targetRowStart = Math.max(
            1,
            Math.min(rows - initialArea.rowSpan + 1, initialArea.rowStart + rowShift)
          );

          const targetArea: GridAreaCoords = {
            rowStart: targetRowStart,
            colStart: targetColStart,
            rowSpan: initialArea.rowSpan,
            colSpan: initialArea.colSpan,
          };

          const otherRectangles: GridAreaCoords[] = [];
          zones.forEach((z) => {
            if (z.id === zoneId) {
              if (blockType === 'primary' && z.secondaryGridArea) otherRectangles.push(z.secondaryGridArea);
              if (blockType === 'secondary' && z.gridArea) otherRectangles.push(z.gridArea);
            } else {
              if (z.gridArea) otherRectangles.push(z.gridArea);
              if (z.secondaryGridArea) otherRectangles.push(z.secondaryGridArea);
            }
          });
          const collides = otherRectangles.some((r) => doGridAreasOverlap(targetArea, r));

          const targetRect = getAreaRect(targetArea);

          setLiveMove({
            zoneId,
            floatingLeft: initialRect.left + deltaX,
            floatingTop: initialRect.top + deltaY,
            snapLeft: targetRect.left,
            snapTop: targetRect.top,
            width: targetRect.width,
            height: targetRect.height,
            colStart: targetColStart,
            rowStart: targetRowStart,
            colSpan: initialArea.colSpan,
            rowSpan: initialArea.rowSpan,
            isValid: !collides,
          });
        }
      }
    };

    const onWindowMouseUp = () => {
      if (dragStateRef.current.isDragging) {
        handleMouseUp();
      }
      if (resizeRef.current.isResizing) {
        resizeRef.current.isResizing = false;
        resizeRef.current.zoneId = null;
        resizeRef.current.initialArea = null;
      }
      setLiveResize(null);

      // Finish zone drag-and-drop moving
      if (moveRef.current.isMoving) {
        const { zoneId, blockType, initialArea, hasDragged } = moveRef.current;
        if (hasDragged && liveMoveRef.current && zoneId && initialArea) {
          const currentLive = liveMoveRef.current;
          if (currentLive.isValid) {
            if (
              currentLive.colStart !== initialArea.colStart ||
              currentLive.rowStart !== initialArea.rowStart
            ) {
              const newArea: GridAreaCoords = {
                colStart: currentLive.colStart,
                rowStart: currentLive.rowStart,
                colSpan: currentLive.colSpan,
                rowSpan: currentLive.rowSpan,
              };
              if (blockType === 'secondary' && onUpdateZoneSecondaryArea) {
                onUpdateZoneSecondaryArea(zoneId, newArea);
              } else {
                onUpdateZoneArea(zoneId, newArea);
              }
              toast.success(
                'Đã di chuyển khối',
                `Đã chuyển ${blockType === 'secondary' ? 'Khối tiếp nối' : 'Khối chính'} đến Cột ${currentLive.colStart}, Dòng ${currentLive.rowStart}`
              );
            }
          } else {
            toast.error('Không thể di chuyển', 'Vị trí thả bị trùng lặp với phân vùng khác');
          }
        } else if (!hasDragged && zoneId) {
          onSelectZone(zoneId);
        }

        moveRef.current.isMoving = false;
        moveRef.current.zoneId = null;
        moveRef.current.initialArea = null;
        moveRef.current.hasDragged = false;
        setLiveMove(null);
      }
    };

    window.addEventListener('mouseup', onWindowMouseUp);
    window.addEventListener('mousemove', onWindowMouseMove);

    return () => {
      window.removeEventListener('mouseup', onWindowMouseUp);
      window.removeEventListener('mousemove', onWindowMouseMove);
    };
  }, [
    handleMouseUp,
    columns,
    rows,
    effectiveColGap,
    effectiveRowGap,
    bounds.width,
    bounds.height,
    zones,
    onUpdateZoneArea,
    onUpdateZoneSecondaryArea,
    onSelectZone,
  ]);

  // Start resizing a zone from its corner handle ('se' or 'nw')
  const handleStartResize = (
    e: React.MouseEvent,
    zoneId: string,
    handle: 'se' | 'nw' = 'se',
    blockType: 'primary' | 'secondary' = 'primary'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    const targetZone = zones.find((z) => z.id === zoneId);
    if (!targetZone) return;
    const targetArea = blockType === 'secondary' ? targetZone.secondaryGridArea : targetZone.gridArea;
    if (!targetArea || !containerRef.current) return;

    const avgCellWidth = (bounds.width - (columns - 1) * effectiveColGap) / columns;
    const avgCellHeight = (bounds.height - (rows - 1) * effectiveRowGap) / rows;
    const initialRect = getAreaRect(targetArea);

    resizeRef.current = {
      isResizing: true,
      zoneId,
      blockType,
      handle,
      initialArea: { ...targetArea },
      initialRect,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      cellWidth: avgCellWidth,
      cellHeight: avgCellHeight,
    };

    setLiveResize({
      zoneId,
      left: initialRect.left,
      top: initialRect.top,
      width: initialRect.width,
      height: initialRect.height,
      colSpan: targetArea.colSpan,
      rowSpan: targetArea.rowSpan,
    });
  };

  // Start dragging the entire zone block to an empty spot
  const handleStartMove = (
    e: React.MouseEvent,
    zoneId: string,
    blockType: 'primary' | 'secondary' = 'primary'
  ) => {
    e.stopPropagation();
    const targetZone = zones.find((z) => z.id === zoneId);
    if (!targetZone || !containerRef.current) return;
    const targetArea = blockType === 'secondary' ? targetZone.secondaryGridArea : targetZone.gridArea;
    if (!targetArea) return;

    const avgCellWidth = (bounds.width - (columns - 1) * effectiveColGap) / columns;
    const avgCellHeight = (bounds.height - (rows - 1) * effectiveRowGap) / rows;
    const initialRect = getAreaRect(targetArea);

    moveRef.current = {
      isMoving: true,
      hasDragged: false,
      zoneId,
      blockType,
      initialArea: { ...targetArea },
      initialRect,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      cellWidth: avgCellWidth,
      cellHeight: avgCellHeight,
    };
  };

  // Build list of empty cell coordinates
  const emptyCells: GridCellCoord[] = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= columns; c++) {
      if (!getZoneAtCell(r, c, zones)) {
        emptyCells.push({ row: r, col: c });
      }
    }
  }

  // Active selection rectangle for live drag feedback
  const dragSelectionArea =
    dragState.isDragging && dragState.startCell && dragState.currentCell
      ? normalizeSelectionToArea(dragState.startCell, dragState.currentCell)
      : null;

  const dragPreviewRect = dragSelectionArea ? getAreaRect(dragSelectionArea) : null;

  return (
    <div
      style={{
        position: 'absolute',
        top: `${bounds.top}px`,
        left: `${bounds.left}px`,
        width: `${bounds.width}px`,
        height: `${bounds.height}px`,
        pointerEvents: 'auto',
        zIndex: 40,
      }}
      className="p-1 select-none"
    >
      {/* Visual margin boundary highlight */}
      <div className="absolute inset-0 border-2 border-dashed border-[#78C841]/50 pointer-events-none rounded-lg" />

      <div
        ref={containerRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
          columnGap: `${effectiveColGap}px`,
          rowGap: `${effectiveRowGap}px`,
          width: '100%',
          height: '100%',
        }}
        className="relative"
      >
        {/* 1. Empty Grid Cells with '+' button */}
        {emptyCells.map((cell) => {
          const isCellInDrag =
            dragSelectionArea &&
            cell.row >= dragSelectionArea.rowStart &&
            cell.row < dragSelectionArea.rowStart + dragSelectionArea.rowSpan &&
            cell.col >= dragSelectionArea.colStart &&
            cell.col < dragSelectionArea.colStart + dragSelectionArea.colSpan;

          return (
            <div
              key={`paper-cell-${cell.row}-${cell.col}`}
              onMouseDown={(e) => handleCellMouseDown(cell.row, cell.col, e)}
              style={{
                gridRow: cell.row,
                gridColumn: cell.col,
              }}
              className={`rounded-xl flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                isCellInDrag
                  ? 'bg-[#78C841]/35 border-2 border-dashed border-[#78C841]'
                  : 'bg-slate-200/50 hover:bg-[#78C841]/25 hover:border hover:border-[#78C841]/60 active:scale-95'
              }`}
              title={`Ô trống [Dòng ${cell.row}, Cột ${cell.col}]. Nhấp để thêm phân vùng hoặc kéo chuột qua các ô lân cận.`}
            >
              <Plus className="w-3.5 h-3.5 text-slate-500 hover:text-[#78C841]" />
            </div>
          );
        })}

        {/* 2. Positioned Active Zone Blocks (Primary & Secondary) */}
        {zones.map((zone, idx) => {
          if (!zone.gridArea) return null;
          const containsFocused = Boolean(
            focusedZoneId && zone.subZones && findZoneDeep(zone.subZones, focusedZoneId)
          );
          const isFocused = focusedZoneId === zone.id || containsFocused;
          const globalIndex = allZones ? allZones.findIndex((z) => z.id === zone.id) : idx;
          const effectiveIndex = globalIndex >= 0 ? globalIndex : idx;

          return (
            <React.Fragment key={zone.id}>
              {/* Primary Block (Khối 1A) */}
              <GridZoneCard
                zone={zone}
                index={effectiveIndex}
                isSecondary={false}
                isSelected={selectedZoneId === zone.id}
                isFocused={isFocused}
                isMoving={liveMove?.zoneId === zone.id && moveRef.current.blockType === 'primary'}
                onSelect={onSelectZone}
                onDelete={onDeleteZone}
                onUpdateName={onUpdateZoneName}
                onStartResize={handleStartResize}
                onStartMove={handleStartMove}
                onDrillDown={onDrillDownZone}
                onAddSubZoneWithArea={onAddSubZoneWithArea}
                onUpdateSubZone={onUpdateSubZone}
                onDeleteSubZone={onDeleteSubZone}
                selectedSubZoneId={selectedSubZoneId}
                onSelectSubZone={onSelectSubZone}
                onAssignElementToZone={onAssignElementToZone}
              />

              {/* Secondary Block (Khối 1B - Tiếp nối) */}
              {zone.secondaryGridArea && (
                <GridZoneCard
                  key={`${zone.id}-secondary`}
                  zone={zone}
                  index={effectiveIndex}
                  isSecondary={true}
                  isSelected={selectedZoneId === zone.id}
                  isFocused={isFocused}
                  isMoving={liveMove?.zoneId === zone.id && moveRef.current.blockType === 'secondary'}
                  onSelect={onSelectZone}
                  onDelete={onDeleteZone}
                  onUnlinkSecondary={(id) => {
                    onUpdateZoneSecondaryArea?.(id, null);
                    toast.success('Đã gỡ khối tiếp nối', 'Phân vùng đã trở lại dạng đơn khối');
                  }}
                  onStartResize={handleStartResize}
                  onStartMove={handleStartMove}
                  onAssignElementToZone={onAssignElementToZone}
                />
              )}
            </React.Fragment>
          );
        })}

        {/* 3. Smooth Snapped Drag Selection Box (Glides smoothly between cell changes) */}
        {dragSelectionArea && dragPreviewRect && (
          <div
            style={{
              position: 'absolute',
              left: `${dragPreviewRect.left}px`,
              top: `${dragPreviewRect.top}px`,
              width: `${dragPreviewRect.width}px`,
              height: `${dragPreviewRect.height}px`,
              transition:
                'left 0.12s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.12s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.12s cubic-bezier(0.2, 0.8, 0.2, 1), height 0.12s cubic-bezier(0.2, 0.8, 0.2, 1)',
              pointerEvents: 'none',
              zIndex: 35,
            }}
            className="rounded-xl border-2 border-[#78C841] bg-[#78C841]/25 shadow-md flex items-center justify-center overflow-hidden"
          >
            <span className="text-[10px] font-extrabold text-[#14532D] bg-white/95 px-2.5 py-1 rounded-full shadow-xs border border-[#78C841]/40">
              Tạo vùng {dragSelectionArea.colSpan}c × {dragSelectionArea.rowSpan}r
            </span>
          </div>
        )}

        {/* 4. Continuous Live Drag Marquee (Tracks mouse pixel-by-pixel continuously) */}
        {dragState.isDragging && liveDrag.startPos && liveDrag.currentPos && (
          <div
            style={{
              position: 'absolute',
              left: `${Math.min(liveDrag.startPos.x, liveDrag.currentPos.x)}px`,
              top: `${Math.min(liveDrag.startPos.y, liveDrag.currentPos.y)}px`,
              width: `${Math.max(4, Math.abs(liveDrag.currentPos.x - liveDrag.startPos.x))}px`,
              height: `${Math.max(4, Math.abs(liveDrag.currentPos.y - liveDrag.startPos.y))}px`,
              pointerEvents: 'none',
              zIndex: 45,
            }}
            className="rounded-xl border-2 border-dashed border-[#78C841] bg-[#78C841]/10 shadow-[0_0_14px_rgba(120,200,65,0.35)] transition-none"
          />
        )}

        {/* 5. Continuous Live Resize Ghost Box (Tracks mouse pixel-by-pixel continuously) */}
        {liveResize && (
          <div
            style={{
              position: 'absolute',
              left: `${liveResize.left}px`,
              top: `${liveResize.top}px`,
              width: `${liveResize.width}px`,
              height: `${liveResize.height}px`,
              pointerEvents: 'none',
              zIndex: 50,
            }}
            className="rounded-xl border-2 border-dashed border-[#78C841] bg-[#78C841]/20 shadow-[0_0_18px_rgba(120,200,65,0.4)] flex items-end justify-end p-2 transition-none"
          >
            <span className="text-[10px] font-extrabold text-[#14532D] bg-white/95 px-2 py-0.5 rounded-md shadow-md border border-[#78C841]/40 mb-1 mr-1">
              {liveResize.colSpan}c × {liveResize.rowSpan}r
            </span>
          </div>
        )}

        {/* 6. Continuous Live Move Ghost and Target Slot */}
        {liveMove && (
          <>
            {/* Snapped Target Slot Preview on Grid */}
            <div
              style={{
                position: 'absolute',
                left: `${liveMove.snapLeft}px`,
                top: `${liveMove.snapTop}px`,
                width: `${liveMove.width}px`,
                transition:
                  'left 0.12s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.12s cubic-bezier(0.2, 0.8, 0.2, 1), width 0.12s cubic-bezier(0.2, 0.8, 0.2, 1), height 0.12s cubic-bezier(0.2, 0.8, 0.2, 1)',
                pointerEvents: 'none',
                zIndex: 48,
              }}
              className={`rounded-xl border-2 border-dashed flex items-center justify-center ${
                liveMove.isValid
                  ? 'border-[#78C841] bg-[#78C841]/20 shadow-[0_0_18px_rgba(120,200,65,0.35)]'
                  : 'border-rose-500 bg-rose-500/20 shadow-[0_0_18px_rgba(244,63,94,0.35)]'
              }`}
            >
              <span
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full shadow-md border ${
                  liveMove.isValid
                    ? 'bg-[#14532D] text-white border-[#78C841]'
                    : 'bg-rose-800 text-white border-rose-400'
                }`}
              >
                {liveMove.isValid
                  ? `Đặt vào Cột ${liveMove.colStart}, Dòng ${liveMove.rowStart}`
                  : 'Bị trùng ô - Không thể thả'}
              </span>
            </div>

            {/* Floating Zone Ghost Box following cursor */}
            <div
              style={{
                position: 'absolute',
                left: `${liveMove.floatingLeft}px`,
                top: `${liveMove.floatingTop}px`,
                width: `${liveMove.width}px`,
                height: `${liveMove.height}px`,
                pointerEvents: 'none',
                zIndex: 55,
                transform: 'scale(1.02) rotate(-0.5deg)',
                opacity: 0.92,
              }}
              className={`rounded-xl border-2 shadow-2xl p-2.5 backdrop-blur-md transition-none ${
                liveMove.isValid
                  ? 'bg-white/95 border-[#78C841] ring-4 ring-[#78C841]/20'
                  : 'bg-white/95 border-rose-500 ring-4 ring-rose-500/20'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Move className="w-3.5 h-3.5 text-[#78C841] shrink-0" />
                  <span className="text-xs font-extrabold text-zinc-900 truncate">
                    {zones.find((z) => z.id === liveMove.zoneId)?.name}
                  </span>
                </div>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 shrink-0">
                  {liveMove.colSpan}c × {liveMove.rowSpan}r
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
