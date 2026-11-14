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
import { Plus } from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';

interface GridZoneCanvasProps {
  gridConfig: TemplateGridConfig;
  zones: LayoutZoneConfig[];
  selectedZoneId: string | null;
  onSelectZone: (zoneId: string) => void;
  onAddZoneWithArea: (area: GridAreaCoords) => void;
  onUpdateZoneArea: (zoneId: string, area: GridAreaCoords) => void;
  onDeleteZone: (zoneId: string) => void;
  onUpdateZoneName?: (zoneId: string, name: string) => void;
}

export const GridZoneCanvas: React.FC<GridZoneCanvasProps> = ({
  gridConfig,
  zones,
  selectedZoneId,
  onSelectZone,
  onAddZoneWithArea,
  onUpdateZoneArea,
  onDeleteZone,
  onUpdateZoneName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<GridDragSelection>({
    isDragging: false,
    startCell: null,
    currentCell: null,
    mode: 'create',
  });

  const { columns, rows, rowGap, colGap, unit = 'px' } = gridConfig;

  // Convert mm to px if unit is mm (1mm ~= 3.78px for screen display)
  const effectiveColGap = unit === 'mm' ? Math.round(colGap * 3.78) : colGap;
  const effectiveRowGap = unit === 'mm' ? Math.round(rowGap * 3.78) : rowGap;

  // Track resizing state
  const resizeRef = useRef<{
    isResizing: boolean;
    zoneId: string | null;
    initialArea: GridAreaCoords | null;
    startMouseX: number;
    startMouseY: number;
    cellWidth: number;
    cellHeight: number;
  }>({
    isResizing: false,
    zoneId: null,
    initialArea: null,
    startMouseX: 0,
    startMouseY: 0,
    cellWidth: 80,
    cellHeight: 80,
  });

  // Handle start dragging on an empty cell
  const handleCellMouseDown = (row: number, col: number) => {
    // Check if cell is occupied
    const occupied = getZoneAtCell(row, col, zones);
    if (occupied) return;

    setDragState({
      isDragging: true,
      startCell: { row, col },
      currentCell: { row, col },
      mode: 'create',
    });
  };

  // Handle cell mouse enter during drag
  const handleCellMouseEnter = (row: number, col: number) => {
    if (dragState.isDragging && dragState.mode === 'create') {
      setDragState((prev) => ({
        ...prev,
        currentCell: { row, col },
      }));
    }
  };

  // Handle mouse up on canvas (finish drag creation)
  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging && dragState.startCell && dragState.currentCell) {
      const area = normalizeSelectionToArea(dragState.startCell, dragState.currentCell);

      // Check collision with any existing zones
      const hasCollision = zones.some(
        (z) => z.gridArea && doGridAreasOverlap(area, z.gridArea)
      );

      if (hasCollision) {
        toast.error('Vùng chọn bị trùng', 'Phân vùng không thể đè lên phân vùng đã có sẵn');
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
  }, [dragState, zones, onAddZoneWithArea]);

  // Global mouse up to terminate any dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState.isDragging) {
        handleMouseUp();
      }
      if (resizeRef.current.isResizing) {
        resizeRef.current.isResizing = false;
        resizeRef.current.zoneId = null;
        resizeRef.current.initialArea = null;
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragState.isDragging, handleMouseUp]);

  // Handle start resize from corner handle of a zone
  const handleStartResize = (e: React.MouseEvent, zoneId: string) => {
    const targetZone = zones.find((z) => z.id === zoneId);
    if (!targetZone?.gridArea || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const cellWidth = (rect.width - effectiveColGap * (columns - 1)) / columns;
    const cellHeight = (rect.height - effectiveRowGap * (rows - 1)) / rows;

    resizeRef.current = {
      isResizing: true,
      zoneId,
      initialArea: { ...targetZone.gridArea },
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      cellWidth: Math.max(20, cellWidth),
      cellHeight: Math.max(20, cellHeight),
    };

    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      if (!resizeRef.current.isResizing || !resizeRef.current.initialArea) return;

      const deltaX = moveEvent.clientX - resizeRef.current.startMouseX;
      const deltaY = moveEvent.clientY - resizeRef.current.startMouseY;

      const addCols = Math.round(deltaX / (resizeRef.current.cellWidth + effectiveColGap));
      const addRows = Math.round(deltaY / (resizeRef.current.cellHeight + effectiveRowGap));

      const { rowStart, colStart, rowSpan: initRowSpan, colSpan: initColSpan } =
        resizeRef.current.initialArea;

      const newColSpan = Math.max(1, Math.min(columns - colStart + 1, initColSpan + addCols));
      const newRowSpan = Math.max(1, Math.min(rows - rowStart + 1, initRowSpan + addRows));

      const newArea: GridAreaCoords = {
        rowStart,
        colStart,
        rowSpan: newRowSpan,
        colSpan: newColSpan,
      };

      // Check collision with other zones
      const collision = zones.some((z) => {
        if (z.id === zoneId) return false;
        if (!z.gridArea) return false;
        return doGridAreasOverlap(newArea, z.gridArea);
      });

      if (!collision) {
        onUpdateZoneArea(zoneId, newArea);
      }
    };

    const handleWindowMouseUp = () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
      resizeRef.current.isResizing = false;
      resizeRef.current.zoneId = null;
      resizeRef.current.initialArea = null;
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
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

  return (
    <div className="relative w-full overflow-hidden p-4 sm:p-6 bg-[#F5F2EB] rounded-3xl border border-zinc-300 shadow-inner flex flex-col justify-center min-h-[420px]">
      <div
        ref={containerRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(68px, 1fr))`,
          columnGap: `${effectiveColGap}px`,
          rowGap: `${effectiveRowGap}px`,
        }}
        className="w-full relative select-none"
      >
        {/* 1. Empty Grid Cells with '+' button matching reference image */}
        {emptyCells.map((cell) => {
          const isCellInDrag =
            dragSelectionArea &&
            cell.row >= dragSelectionArea.rowStart &&
            cell.row < dragSelectionArea.rowStart + dragSelectionArea.rowSpan &&
            cell.col >= dragSelectionArea.colStart &&
            cell.col < dragSelectionArea.colStart + dragSelectionArea.colSpan;

          return (
            <div
              key={`cell-${cell.row}-${cell.col}`}
              onMouseDown={() => handleCellMouseDown(cell.row, cell.col)}
              onMouseEnter={() => handleCellMouseEnter(cell.row, cell.col)}
              style={{
                gridRow: cell.row,
                gridColumn: cell.col,
              }}
              className={`min-h-[68px] rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                isCellInDrag
                  ? 'bg-[#78C841]/30 border-2 border-dashed border-[#78C841]'
                  : 'bg-[#C6C2B8]/60 hover:bg-[#B3ADA1]/80 active:scale-95'
              }`}
              title={`Ô trống [Dòng ${cell.row}, Cột ${cell.col}]. Bấm để tạo phân vùng hoặc kéo thả để mở rộng.`}
            >
              <Plus className="w-4 h-4 text-white/90 drop-shadow-xs" />
            </div>
          );
        })}

        {/* 2. Positioned Active Zone Blocks */}
        {zones.map((zone, idx) => {
          if (!zone.gridArea) return null;
          return (
            <GridZoneCard
              key={zone.id}
              zone={zone}
              index={idx}
              isSelected={selectedZoneId === zone.id}
              onSelect={onSelectZone}
              onDelete={onDeleteZone}
              onUpdateName={onUpdateZoneName}
              onStartResize={handleStartResize}
            />
          );
        })}

        {/* 3. Drag Selection Preview Overlay */}
        {dragSelectionArea && (
          <div
            style={{
              gridRow: `${dragSelectionArea.rowStart} / span ${dragSelectionArea.rowSpan}`,
              gridColumn: `${dragSelectionArea.colStart} / span ${dragSelectionArea.colSpan}`,
            }}
            className="pointer-events-none rounded-2xl border-2 border-[#78C841] bg-[#78C841]/20 shadow-[0_0_16px_rgba(120,200,65,0.3)] z-30 flex items-center justify-center animate-pulse"
          >
            <span className="text-xs font-extrabold text-[#14532D] bg-white/90 px-2 py-0.5 rounded-full shadow-xs">
              Tạo vùng {dragSelectionArea.colSpan}c × {dragSelectionArea.rowSpan}r
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
