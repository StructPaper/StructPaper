'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutZoneConfig, GridAreaCoords } from '@/types/template-builder';
import { ChildSubZoneCard } from './ChildSubZoneCard';
import { useGridMarquee } from '../grid-zone-builder/hooks/useGridMarquee';
import { Plus } from 'lucide-react';

interface ZoneSubGridOverlayProps {
  parentZone: LayoutZoneConfig;
  selectedSubZoneId?: string | null;
  onSelectSubZone?: (id: string) => void;
  onDrillDown?: (id: string) => void;
  onAddSubZoneWithArea?: (parentId: string, area: GridAreaCoords) => void;
  onUpdateSubZone?: (subZoneId: string, updated: Partial<LayoutZoneConfig>) => void;
  onDeleteSubZone?: (subZoneId: string) => void;
  onAssignElementToZone?: (elementId: string, zoneId: string) => void;
}

export const ZoneSubGridOverlay: React.FC<ZoneSubGridOverlayProps> = ({
  parentZone,
  selectedSubZoneId,
  onSelectSubZone,
  onDrillDown,
  onAddSubZoneWithArea,
  onUpdateSubZone,
  onDeleteSubZone,
  onAssignElementToZone,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const subCols = parentZone.subGridConfig?.columns || 2;
  const subRows = parentZone.subGridConfig?.rows || 2;
  const subZones = parentZone.subZones || [];

  // Live state for corner resizing and card moving
  const [liveResize, setLiveResize] = useState<{
    subZoneId: string;
    area: GridAreaCoords;
    hasCollision: boolean;
  } | null>(null);

  const [liveMove, setLiveMove] = useState<{
    subZoneId: string;
    area: GridAreaCoords;
    hasCollision: boolean;
  } | null>(null);

  // Keep mirror refs for instantaneous window event listener access
  const liveResizeRef = useRef(liveResize);
  liveResizeRef.current = liveResize;

  const liveMoveRef = useRef(liveMove);
  liveMoveRef.current = liveMove;

  // Refs for tracking active gestures
  const resizeRef = useRef<{
    isResizing: boolean;
    subZoneId: string | null;
    handle: 'se' | 'nw';
    initialArea: GridAreaCoords;
    startMouseX: number;
    startMouseY: number;
  }>({
    isResizing: false,
    subZoneId: null,
    handle: 'se',
    initialArea: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
    startMouseX: 0,
    startMouseY: 0,
  });

  const moveRef = useRef<{
    isMoving: boolean;
    hasDragged: boolean;
    subZoneId: string | null;
    initialArea: GridAreaCoords;
    startMouseX: number;
    startMouseY: number;
  }>({
    isMoving: false,
    hasDragged: false,
    subZoneId: null,
    initialArea: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
    startMouseX: 0,
    startMouseY: 0,
  });

  // Collision check against other sub-zones
  const checkSubZoneCollision = useCallback(
    (candidate: GridAreaCoords, ignoreId: string): boolean => {
      return subZones.some((other) => {
        if (other.id === ignoreId) return false;
        const oArea = other.gridArea || { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 };
        return !(
          candidate.colStart + candidate.colSpan <= oArea.colStart ||
          candidate.colStart >= oArea.colStart + oArea.colSpan ||
          candidate.rowStart + candidate.rowSpan <= oArea.rowStart ||
          candidate.rowStart >= oArea.rowStart + oArea.rowSpan
        );
      });
    },
    [subZones]
  );

  const isCellOccupied = (r: number, c: number) => {
    return subZones.some((sz) => {
      const a = sz.gridArea || { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 };
      return (
        r >= a.rowStart &&
        r < a.rowStart + a.rowSpan &&
        c >= a.colStart &&
        c < a.colStart + a.colSpan
      );
    });
  };

  const handleCommitMarquee = (area: GridAreaCoords) => {
    const hasCollision = checkSubZoneCollision(area, '');
    if (!hasCollision) {
      onAddSubZoneWithArea?.(parentZone.id, area);
    }
  };

  const { isDragging, marqueeArea, startDrag, updateDrag } = useGridMarquee({
    columns: subCols,
    rows: subRows,
    isCellOccupied,
    onCommitArea: handleCommitMarquee,
  });

  // Start Corner Resizing ('se' or 'nw')
  const handleStartResize = (subZoneId: string, handle: 'se' | 'nw', e: React.MouseEvent) => {
    const targetSz = subZones.find((sz) => sz.id === subZoneId);
    if (!targetSz) return;
    const initialArea = targetSz.gridArea || { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 };

    resizeRef.current = {
      isResizing: true,
      subZoneId,
      handle,
      initialArea: { ...initialArea },
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    };

    setLiveResize({
      subZoneId,
      area: { ...initialArea },
      hasCollision: false,
    });
  };

  // Start Drag-to-Move
  const handleStartMove = (subZoneId: string, e: React.MouseEvent) => {
    const targetSz = subZones.find((sz) => sz.id === subZoneId);
    if (!targetSz) return;
    const initialArea = targetSz.gridArea || { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 };

    moveRef.current = {
      isMoving: true,
      hasDragged: false,
      subZoneId,
      initialArea: { ...initialArea },
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    };

    setLiveMove({
      subZoneId,
      area: { ...initialArea },
      hasCollision: false,
    });
  };

  // Window-level mousemove and mouseup listeners for continuous 60fps tracking
  useEffect(() => {
    const onWindowMouseMove = (e: MouseEvent) => {
      // 1. Continuous Corner Resizing
      if (resizeRef.current.isResizing && resizeRef.current.subZoneId && containerRef.current) {
        const { subZoneId, handle, initialArea, startMouseX, startMouseY } = resizeRef.current;
        const rect = containerRef.current.getBoundingClientRect();
        const cellW = rect.width / subCols;
        const cellH = rect.height / subRows;

        const deltaX = e.clientX - startMouseX;
        const deltaY = e.clientY - startMouseY;
        const colShift = Math.round(deltaX / cellW);
        const rowShift = Math.round(deltaY / cellH);

        let candidate: GridAreaCoords;
        if (handle === 'se') {
          const newColSpan = Math.max(
            1,
            Math.min(subCols - initialArea.colStart + 1, initialArea.colSpan + colShift)
          );
          const newRowSpan = Math.max(
            1,
            Math.min(subRows - initialArea.rowStart + 1, initialArea.rowSpan + rowShift)
          );
          candidate = {
            ...initialArea,
            colSpan: newColSpan,
            rowSpan: newRowSpan,
          };
        } else {
          // 'nw' top-left corner
          const initRowEnd = initialArea.rowStart + initialArea.rowSpan - 1;
          const initColEnd = initialArea.colStart + initialArea.colSpan - 1;
          const newRowStart = Math.max(1, Math.min(initRowEnd, initialArea.rowStart + rowShift));
          const newColStart = Math.max(1, Math.min(initColEnd, initialArea.colStart + colShift));
          candidate = {
            rowStart: newRowStart,
            colStart: newColStart,
            rowSpan: initRowEnd - newRowStart + 1,
            colSpan: initColEnd - newColStart + 1,
          };
        }

        const collides = checkSubZoneCollision(candidate, subZoneId);
        setLiveResize({
          subZoneId,
          area: candidate,
          hasCollision: collides,
        });
      }

      // 2. Continuous Drag-to-Move
      if (moveRef.current.isMoving && moveRef.current.subZoneId && containerRef.current) {
        moveRef.current.hasDragged = true;
        const { subZoneId, initialArea, startMouseX, startMouseY } = moveRef.current;
        const rect = containerRef.current.getBoundingClientRect();
        const cellW = rect.width / subCols;
        const cellH = rect.height / subRows;

        const deltaX = e.clientX - startMouseX;
        const deltaY = e.clientY - startMouseY;
        const colShift = Math.round(deltaX / cellW);
        const rowShift = Math.round(deltaY / cellH);

        const newColStart = Math.max(
          1,
          Math.min(subCols - initialArea.colSpan + 1, initialArea.colStart + colShift)
        );
        const newRowStart = Math.max(
          1,
          Math.min(subRows - initialArea.rowSpan + 1, initialArea.rowStart + rowShift)
        );

        const candidate: GridAreaCoords = {
          ...initialArea,
          rowStart: newRowStart,
          colStart: newColStart,
        };

        const collides = checkSubZoneCollision(candidate, subZoneId);
        setLiveMove({
          subZoneId,
          area: candidate,
          hasCollision: collides,
        });
      }
    };

    const onWindowMouseUp = () => {
      // 1. Commit Resize
      if (resizeRef.current.isResizing) {
        if (
          liveResizeRef.current &&
          !liveResizeRef.current.hasCollision &&
          resizeRef.current.subZoneId
        ) {
          onUpdateSubZone?.(resizeRef.current.subZoneId, {
            gridArea: liveResizeRef.current.area,
          });
        }
        resizeRef.current.isResizing = false;
        setLiveResize(null);
      }

      // 2. Commit Move
      if (moveRef.current.isMoving) {
        if (
          moveRef.current.hasDragged &&
          liveMoveRef.current &&
          !liveMoveRef.current.hasCollision &&
          moveRef.current.subZoneId
        ) {
          onUpdateSubZone?.(moveRef.current.subZoneId, {
            gridArea: liveMoveRef.current.area,
          });
        }
        moveRef.current.isMoving = false;
        setLiveMove(null);
      }
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [subCols, subRows, checkSubZoneCollision, onUpdateSubZone]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${subCols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${subRows}, minmax(0, 1fr))`,
        gap: '4px',
      }}
      className="absolute inset-2.5 z-20 pointer-events-auto"
    >
      {/* 1. Live Drag-to-Create Marquee Ghost */}
      {isDragging && marqueeArea && (
        <div
          style={{
            gridRow: `${marqueeArea.rowStart} / span ${marqueeArea.rowSpan}`,
            gridColumn: `${marqueeArea.colStart} / span ${marqueeArea.colSpan}`,
          }}
          className="pointer-events-none z-30 rounded-xl border-2 border-dashed border-[#78C841] bg-[#78C841]/35 flex items-center justify-center shadow-lg animate-pulse"
        >
          <span className="bg-zinc-950/95 text-white text-[9px] font-bold font-mono px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#78C841] animate-ping" />
            {marqueeArea.colSpan}c × {marqueeArea.rowSpan}r
          </span>
        </div>
      )}

      {/* 2. Live Resize Ghost */}
      {liveResize && (
        <div
          style={{
            gridRow: `${liveResize.area.rowStart} / span ${liveResize.area.rowSpan}`,
            gridColumn: `${liveResize.area.colStart} / span ${liveResize.area.colSpan}`,
          }}
          className={`pointer-events-none z-40 rounded-xl border-2 border-dashed flex items-center justify-center shadow-lg transition-all ${
            liveResize.hasCollision
              ? 'border-red-500 bg-red-500/25 text-red-700'
              : 'border-[#78C841] bg-[#78C841]/30 text-[#14532D]'
          }`}
        >
          <span className="bg-zinc-950/95 text-white text-[8px] font-bold font-mono px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
            {liveResize.hasCollision ? (
              '⚠️ Trùng ô'
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-[#78C841] animate-ping" />
                {liveResize.area.colSpan}c × {liveResize.area.rowSpan}r
              </>
            )}
          </span>
        </div>
      )}

      {/* 3. Live Move Ghost */}
      {liveMove && (
        <div
          style={{
            gridRow: `${liveMove.area.rowStart} / span ${liveMove.area.rowSpan}`,
            gridColumn: `${liveMove.area.colStart} / span ${liveMove.area.colSpan}`,
          }}
          className={`pointer-events-none z-40 rounded-xl border-2 border-dashed flex items-center justify-center shadow-lg transition-all ${
            liveMove.hasCollision
              ? 'border-red-500 bg-red-500/25 text-red-700'
              : 'border-blue-500 bg-blue-500/25 text-blue-900'
          }`}
        >
          <span className="bg-zinc-950/95 text-white text-[8px] font-bold font-mono px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
            {liveMove.hasCollision ? (
              '⚠️ Trùng ô'
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                C{liveMove.area.colStart} × R{liveMove.area.rowStart}
              </>
            )}
          </span>
        </div>
      )}

      {/* 4. Empty Sub-Grid Cells */}
      {Array.from({ length: subRows }).map((_, rIdx) =>
        Array.from({ length: subCols }).map((_, cIdx) => {
          const r = rIdx + 1;
          const c = cIdx + 1;
          if (isCellOccupied(r, c)) return null;

          return (
            <div
              key={`sub-empty-${r}-${c}`}
              style={{ gridRow: r, gridColumn: c }}
              onMouseDown={(e) => startDrag(r, c, e)}
              onMouseEnter={() => {
                if (isDragging) updateDrag(r, c);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAddSubZoneWithArea?.(parentZone.id, {
                  rowStart: r,
                  colStart: c,
                  rowSpan: 1,
                  colSpan: 1,
                });
              }}
              className="rounded-lg border border-dashed border-[#78C841]/35 hover:border-[#78C841] bg-[#78C841]/5 hover:bg-[#78C841]/20 transition-all cursor-crosshair flex flex-col items-center justify-center group/subcell select-none"
              title={`Ô con [Dòng ${r}, Cột ${c}]. Kéo chuột để quét ô hoặc bấm để tạo phân vùng con`}
            >
              <Plus className="w-3 h-3 text-zinc-500 group-hover/subcell:text-[#14532D] transition-colors" />
              <span className="text-[7px] font-mono text-zinc-500 group-hover/subcell:text-[#14532D] font-bold select-none">
                {c}×{r}
              </span>
            </div>
          );
        })
      )}

      {/* 5. Existing Child Sub-Zone Cards */}
      {subZones.map((sz, szIdx) => (
        <ChildSubZoneCard
          key={sz.id}
          subZone={sz}
          index={szIdx}
          isSelected={selectedSubZoneId === sz.id}
          isMoving={liveMove?.subZoneId === sz.id}
          isResizing={liveResize?.subZoneId === sz.id}
          maxCols={subCols}
          onSelect={(id) => onSelectSubZone?.(id)}
          onDrillDown={(id) => onDrillDown?.(id)}
          onDelete={(id) => onDeleteSubZone?.(id)}
          onUpdateSubZone={onUpdateSubZone}
          onStartMove={handleStartMove}
          onStartResize={handleStartResize}
          onAssignElementToZone={onAssignElementToZone}
        />
      ))}
    </div>
  );
};
