'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutZoneConfig, TemplateGridConfig, GridAreaCoords } from '@/types/template-builder';
import {
  GridCellCoord,
  GridDragSelection,
  normalizeSelectionToArea,
  doGridAreasOverlap,
} from '@/types/grid-zones';
import { SubGridZoneCard } from './SubGridZoneCard';
import { LayoutGrid, Plus } from 'lucide-react';
import { getDefaultSubGridConfig } from './nestedZoneUtils';
import { toast } from '@/components/DynamicIslandToast';

interface NestedSubGridOverlayProps {
  parentZone: LayoutZoneConfig;
  selectedSubZoneId: string | null;
  onSelectSubZone: (id: string) => void;
  onAddSubZoneWithArea: (area: GridAreaCoords) => void;
  onUpdateSubZone: (id: string, updated: Partial<LayoutZoneConfig>) => void;
  onDeleteSubZone: (id: string) => void;
  onDrillDown: (id: string) => void;
  onUpdateSubGridConfig: (config: TemplateGridConfig) => void;
}

export const NestedSubGridOverlay: React.FC<NestedSubGridOverlayProps> = ({
  parentZone,
  selectedSubZoneId,
  onSelectSubZone,
  onAddSubZoneWithArea,
  onUpdateSubZone,
  onDeleteSubZone,
  onDrillDown,
  onUpdateSubGridConfig,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const subGrid = parentZone.subGridConfig || getDefaultSubGridConfig();
  const subZones = parentZone.subZones || [];

  const { columns, rows, colGap = 6, rowGap = 6 } = subGrid;

  // 1. Drag-to-create state (Quét chuột chọn nhiều ô)
  const [dragState, setDragState] = useState<GridDragSelection>({
    isDragging: false,
    startCell: null,
    currentCell: null,
    mode: 'create',
  });
  const dragStateRef = useRef(dragState);
  dragStateRef.current = dragState;

  // 2. Drag-to-resize state (Co giãn 2 góc)
  const resizeRef = useRef<{
    isResizing: boolean;
    subZoneId: string | null;
    handle: 'se' | 'nw';
    initialArea: GridAreaCoords | null;
    startMouseX: number;
    startMouseY: number;
  }>({
    isResizing: false,
    subZoneId: null,
    handle: 'se',
    initialArea: null,
    startMouseX: 0,
    startMouseY: 0,
  });

  const [liveResize, setLiveResize] = useState<{
    subZoneId: string;
    area: GridAreaCoords;
  } | null>(null);
  const liveResizeRef = useRef(liveResize);
  liveResizeRef.current = liveResize;

  // 3. Drag-to-move state (Kéo di chuyển vùng con)
  const moveRef = useRef<{
    isMoving: boolean;
    subZoneId: string | null;
    initialArea: GridAreaCoords | null;
    startMouseX: number;
    startMouseY: number;
  }>({
    isMoving: false,
    subZoneId: null,
    initialArea: null,
    startMouseX: 0,
    startMouseY: 0,
  });

  const [liveMove, setLiveMove] = useState<{
    subZoneId: string;
    area: GridAreaCoords;
    isValid: boolean;
  } | null>(null);
  const liveMoveRef = useRef(liveMove);
  liveMoveRef.current = liveMove;

  // Helper to check if a cell is occupied
  const getSubZoneAtCell = useCallback(
    (r: number, c: number, excludeId?: string): LayoutZoneConfig | undefined => {
      return subZones.find((sz) => {
        if (excludeId && sz.id === excludeId) return false;
        const area = sz.gridArea;
        if (!area) return false;
        return (
          r >= area.rowStart &&
          r < area.rowStart + area.rowSpan &&
          c >= area.colStart &&
          c < area.colStart + area.colSpan
        );
      });
    },
    [subZones]
  );

  // Start drag-to-create on empty cell
  const handleCellMouseDown = (row: number, col: number) => {
    if (getSubZoneAtCell(row, col)) return;
    setDragState({
      isDragging: true,
      startCell: { row, col },
      currentCell: { row, col },
      mode: 'create',
    });
  };

  // Start resize handle
  const handleStartResize = (e: React.MouseEvent, subZoneId: string, handle: 'se' | 'nw') => {
    e.stopPropagation();
    const target = subZones.find((sz) => sz.id === subZoneId);
    if (!target || !target.gridArea) return;

    resizeRef.current = {
      isResizing: true,
      subZoneId,
      handle,
      initialArea: { ...target.gridArea },
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    };

    setLiveResize({
      subZoneId,
      area: { ...target.gridArea },
    });
  };

  // Start move sub-zone
  const handleStartMove = (e: React.MouseEvent, subZoneId: string) => {
    const target = subZones.find((sz) => sz.id === subZoneId);
    if (!target || !target.gridArea) return;

    moveRef.current = {
      isMoving: true,
      subZoneId,
      initialArea: { ...target.gridArea },
      startMouseX: e.clientX,
      startMouseY: e.clientY,
    };

    setLiveMove({
      subZoneId,
      area: { ...target.gridArea },
      isValid: true,
    });
  };

  // Global mousemove and mouseup listeners
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const localX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const localY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const cellW = (rect.width - (columns - 1) * colGap) / columns;
      const cellH = (rect.height - (rows - 1) * rowGap) / rows;

      const hoverCol = Math.max(
        1,
        Math.min(columns, Math.floor((localX + colGap * 0.5) / (cellW + colGap)) + 1)
      );
      const hoverRow = Math.max(
        1,
        Math.min(rows, Math.floor((localY + rowGap * 0.5) / (cellH + rowGap)) + 1)
      );

      // 1. Drag Creation update
      if (dragStateRef.current.isDragging && dragStateRef.current.startCell) {
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

      // 2. Drag Resize update
      if (resizeRef.current.isResizing && resizeRef.current.initialArea) {
        const init = resizeRef.current.initialArea;
        const deltaCol = Math.round((e.clientX - resizeRef.current.startMouseX) / (cellW + colGap));
        const deltaRow = Math.round((e.clientY - resizeRef.current.startMouseY) / (cellH + rowGap));

        let newArea: GridAreaCoords = { ...init };

        if (resizeRef.current.handle === 'se') {
          const newColSpan = Math.max(1, Math.min(columns - init.colStart + 1, init.colSpan + deltaCol));
          const newRowSpan = Math.max(1, Math.min(rows - init.rowStart + 1, init.rowSpan + deltaRow));
          newArea = {
            ...init,
            colSpan: newColSpan,
            rowSpan: newRowSpan,
          };
        } else {
          // 'nw'
          const newColStart = Math.max(1, Math.min(init.colStart + init.colSpan - 1, init.colStart + deltaCol));
          const newRowStart = Math.max(1, Math.min(init.rowStart + init.rowSpan - 1, init.rowStart + deltaRow));
          newArea = {
            colStart: newColStart,
            rowStart: newRowStart,
            colSpan: init.colStart + init.colSpan - newColStart,
            rowSpan: init.rowStart + init.rowSpan - newRowStart,
          };
        }

        // Check collision
        const hasCollision = subZones.some((sz) => {
          if (sz.id === resizeRef.current.subZoneId || !sz.gridArea) return false;
          return doGridAreasOverlap(newArea, sz.gridArea);
        });

        if (!hasCollision && resizeRef.current.subZoneId) {
          setLiveResize({
            subZoneId: resizeRef.current.subZoneId,
            area: newArea,
          });
        }
      }

      // 3. Drag Move update
      if (moveRef.current.isMoving && moveRef.current.initialArea) {
        const init = moveRef.current.initialArea;
        const deltaCol = Math.round((e.clientX - moveRef.current.startMouseX) / (cellW + colGap));
        const deltaRow = Math.round((e.clientY - moveRef.current.startMouseY) / (cellH + rowGap));

        const targetColStart = Math.max(1, Math.min(columns - init.colSpan + 1, init.colStart + deltaCol));
        const targetRowStart = Math.max(1, Math.min(rows - init.rowSpan + 1, init.rowStart + deltaRow));

        const newArea: GridAreaCoords = {
          ...init,
          colStart: targetColStart,
          rowStart: targetRowStart,
        };

        const hasCollision = subZones.some((sz) => {
          if (sz.id === moveRef.current.subZoneId || !sz.gridArea) return false;
          return doGridAreasOverlap(newArea, sz.gridArea);
        });

        if (moveRef.current.subZoneId) {
          setLiveMove({
            subZoneId: moveRef.current.subZoneId,
            area: newArea,
            isValid: !hasCollision,
          });
        }
      }
    };

    const onMouseUp = () => {
      // 1. Commit Drag Creation
      if (dragStateRef.current.isDragging && dragStateRef.current.startCell && dragStateRef.current.currentCell) {
        const area = normalizeSelectionToArea(
          dragStateRef.current.startCell,
          dragStateRef.current.currentCell
        );

        const hasCollision = subZones.some((sz) => {
          if (!sz.gridArea) return false;
          return doGridAreasOverlap(area, sz.gridArea);
        });

        if (hasCollision) {
          toast.error('Bị trùng ô', 'Vùng con bạn chọn bị đè lên vùng con khác');
        } else {
          onAddSubZoneWithArea(area);
        }

        setDragState({
          isDragging: false,
          startCell: null,
          currentCell: null,
          mode: 'create',
        });
      }

      // 2. Commit Resize
      if (resizeRef.current.isResizing) {
        const activeLiveResize = liveResizeRef.current;
        if (activeLiveResize && resizeRef.current.subZoneId) {
          onUpdateSubZone(resizeRef.current.subZoneId, {
            gridArea: activeLiveResize.area,
          });
          toast.success(
            'Đã co giãn vùng con',
            `Kích thước mới: ${activeLiveResize.area.colSpan} cột × ${activeLiveResize.area.rowSpan} dòng`
          );
        }
        resizeRef.current = {
          isResizing: false,
          subZoneId: null,
          handle: 'se',
          initialArea: null,
          startMouseX: 0,
          startMouseY: 0,
        };
        setLiveResize(null);
      }

      // 3. Commit Move
      if (moveRef.current.isMoving) {
        const activeLiveMove = liveMoveRef.current;
        if (activeLiveMove && activeLiveMove.isValid && moveRef.current.subZoneId) {
          onUpdateSubZone(moveRef.current.subZoneId, {
            gridArea: activeLiveMove.area,
          });
          toast.success(
            'Đã di chuyển vùng con',
            `Vị trí mới: Cột ${activeLiveMove.area.colStart}, Dòng ${activeLiveMove.area.rowStart}`
          );
        } else if (activeLiveMove && !activeLiveMove.isValid) {
          toast.error('Không thể đặt tại đây', 'Vị trí này đã bị chiếm chỗ bởi vùng con khác');
        }
        moveRef.current = {
          isMoving: false,
          subZoneId: null,
          initialArea: null,
          startMouseX: 0,
          startMouseY: 0,
        };
        setLiveMove(null);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [columns, rows, colGap, rowGap, subZones, onAddSubZoneWithArea, onUpdateSubZone]);

  // Compute live selection area
  const dragSelectionArea =
    dragState.isDragging && dragState.startCell && dragState.currentCell
      ? normalizeSelectionToArea(dragState.startCell, dragState.currentCell)
      : null;

  // Preset division helpers
  const handleApplyPreset = (type: '2-cols' | '3-cols' | '2-rows' | 'sidebar-split') => {
    if (type === '2-cols') {
      onUpdateSubGridConfig({ ...subGrid, columns: 2, rows: 1 });
      onAddSubZoneWithArea({ rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 });
      onAddSubZoneWithArea({ rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 });
    } else if (type === '3-cols') {
      onUpdateSubGridConfig({ ...subGrid, columns: 3, rows: 1 });
      onAddSubZoneWithArea({ rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 });
      onAddSubZoneWithArea({ rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 });
      onAddSubZoneWithArea({ rowStart: 1, colStart: 3, rowSpan: 1, colSpan: 1 });
    } else if (type === '2-rows') {
      onUpdateSubGridConfig({ ...subGrid, columns: 1, rows: 2 });
      onAddSubZoneWithArea({ rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 });
      onAddSubZoneWithArea({ rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 });
    } else if (type === 'sidebar-split') {
      onUpdateSubGridConfig({ ...subGrid, columns: 4, rows: 1 });
      onAddSubZoneWithArea({ rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 }); // 25%
      onAddSubZoneWithArea({ rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 3 }); // 75%
    }
  };

  return (
    <div className="space-y-3">
      {/* 1. Sub-grid Configuration Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-[#78C841]" />
          <span className="text-xs font-extrabold text-zinc-900">
            Lưới con của &ldquo;{parentZone.name}&rdquo;:
          </span>
          <span className="px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-800 text-xs font-mono font-bold">
            {columns} Cột × {rows} Hàng
          </span>
        </div>

        {/* Stepper for Columns & Rows */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span>Cột:</span>
            <div className="flex gap-1 bg-zinc-100 p-0.5 rounded-lg">
              {[1, 2, 3, 4, 6].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => onUpdateSubGridConfig({ ...subGrid, columns: c })}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                    columns === c
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-zinc-600">
            <span>Hàng:</span>
            <div className="flex gap-1 bg-zinc-100 p-0.5 rounded-lg">
              {[1, 2, 3, 4].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onUpdateSubGridConfig({ ...subGrid, rows: r })}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                    rows === r
                      ? 'bg-zinc-900 text-white shadow-2xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Quick Division Presets if empty */}
      {subZones.length === 0 && (
        <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200/70 space-y-2">
          <p className="text-xs font-bold text-zinc-700">
            Gợi ý chia nhanh phân vùng &ldquo;{parentZone.name}&rdquo;:
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleApplyPreset('2-cols')}
              className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-400 text-xs font-bold text-zinc-800 shadow-2xs cursor-pointer hover:bg-zinc-50 transition-all"
            >
              Chia 2 cột đều nhau (50% / 50%)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('3-cols')}
              className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-400 text-xs font-bold text-zinc-800 shadow-2xs cursor-pointer hover:bg-zinc-50 transition-all"
            >
              Chia 3 cột đều (33% / 33% / 33%)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('sidebar-split')}
              className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-400 text-xs font-bold text-zinc-800 shadow-2xs cursor-pointer hover:bg-zinc-50 transition-all"
            >
              Cột trái Logo/Info (25%) + Cột phải (75%)
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('2-rows')}
              className="px-3 py-1.5 rounded-xl bg-white border border-zinc-200 hover:border-zinc-400 text-xs font-bold text-zinc-800 shadow-2xs cursor-pointer hover:bg-zinc-50 transition-all"
            >
              Chia 2 hàng trên / dưới
            </button>
          </div>
        </div>
      )}

      {/* 3. Interactive Sub-Grid Canvas with Drag to Select, Move & Resize */}
      <div className="p-4 rounded-3xl bg-zinc-100/70 border border-zinc-200/90 shadow-inner">
        <div className="mb-2 flex items-center justify-between text-[11px] text-zinc-500">
          <span>✨ Thao tác: Kéo chuột quét ô để tạo vùng con • Kéo 2 góc để co giãn • Kéo giữa ô để di chuyển</span>
          <span className="font-mono font-bold text-zinc-700">{subZones.length} vùng con</span>
        </div>

        <div
          ref={containerRef}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${rows}, minmax(95px, auto))`,
            gap: `${colGap}px`,
          }}
          className="relative w-full select-none"
        >
          {/* Background Grid Cells with Click/Drag Listener */}
          {Array.from({ length: rows }).map((_, rIdx) => {
            const row = rIdx + 1;
            return Array.from({ length: columns }).map((__, cIdx) => {
              const col = cIdx + 1;
              const occupied = Boolean(getSubZoneAtCell(row, col));

              return (
                <div
                  key={`subgrid-cell-${row}-${col}`}
                  style={{
                    gridRow: `${row} / span 1`,
                    gridColumn: `${col} / span 1`,
                  }}
                  onMouseDown={() => handleCellMouseDown(row, col)}
                  className={`rounded-2xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-2 select-none ${
                    occupied
                      ? 'border-transparent bg-transparent pointer-events-none'
                      : 'border-zinc-300 hover:border-[#78C841] bg-white/60 hover:bg-white cursor-crosshair group shadow-2xs'
                  }`}
                  title={occupied ? '' : `Nhấp hoặc kéo chuột từ Ô (${col}, ${row})`}
                >
                  {!occupied && (
                    <>
                      <Plus className="w-5 h-5 text-zinc-400 group-hover:text-[#78C841] group-hover:scale-110 transition-transform" />
                      <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-700 mt-1">
                        + Quét tạo ô
                      </span>
                    </>
                  )}
                </div>
              );
            });
          })}

          {/* Render Actual Sub-Zones */}
          {subZones.map((sz, idx) => {
            const isMovingThis = liveMove?.subZoneId === sz.id;
            const isResizingThis = liveResize?.subZoneId === sz.id;
            const effectiveArea = isResizingThis
              ? liveResize.area
              : isMovingThis
                ? liveMove.area
                : sz.gridArea;

            return (
              <SubGridZoneCard
                key={sz.id}
                subZone={{ ...sz, gridArea: effectiveArea }}
                index={idx}
                isSelected={selectedSubZoneId === sz.id}
                onSelect={onSelectSubZone}
                onDelete={onDeleteSubZone}
                onUpdateName={(id, name) => onUpdateSubZone(id, { name })}
                onDrillDown={onDrillDown}
                onStartResize={handleStartResize}
                onStartMove={handleStartMove}
                isMoving={isMovingThis}
              />
            );
          })}

          {/* Smooth Drag-to-Create Snapped Selection Box */}
          {dragSelectionArea && (
            <div
              style={{
                gridRow: `${dragSelectionArea.rowStart} / span ${dragSelectionArea.rowSpan}`,
                gridColumn: `${dragSelectionArea.colStart} / span ${dragSelectionArea.colSpan}`,
              }}
              className="rounded-2xl border-2 border-[#78C841] bg-[#78C841]/20 shadow-md flex items-center justify-center pointer-events-none z-30 transition-all"
            >
              <span className="text-[10px] font-extrabold text-[#14532D] bg-white/95 px-2.5 py-1 rounded-full shadow-xs border border-[#78C841]/50 font-mono">
                Tạo vùng con {dragSelectionArea.colSpan}c × {dragSelectionArea.rowSpan}r
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
