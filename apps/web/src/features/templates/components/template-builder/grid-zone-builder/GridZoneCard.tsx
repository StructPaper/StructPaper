'use client';

import React, { useState } from 'react';
import { LayoutZoneConfig, GridAreaCoords } from '@/types/template-builder';
import { X, Move, Layers } from 'lucide-react';
import { ZoneSubGridOverlay } from '../nested-zones/ZoneSubGridOverlay';

interface GridZoneCardProps {
  zone: LayoutZoneConfig;
  index: number;
  isSelected: boolean;
  isFocused?: boolean;
  onSelect: (zoneId: string) => void;
  onDelete: (zoneId: string) => void;
  onUpdateName?: (zoneId: string, name: string) => void;
  onStartResize: (
    e: React.MouseEvent,
    zoneId: string,
    handle: 'se' | 'nw',
    blockType?: 'primary' | 'secondary'
  ) => void;
  onStartMove?: (
    e: React.MouseEvent,
    zoneId: string,
    blockType?: 'primary' | 'secondary'
  ) => void;
  isMoving?: boolean;
  isSecondary?: boolean;
  onUnlinkSecondary?: (zoneId: string) => void;
  onDrillDown?: (zoneId: string) => void;
  onAddSubZoneWithArea?: (parentId: string, area: GridAreaCoords) => void;
  onUpdateSubZone?: (subZoneId: string, updated: Partial<LayoutZoneConfig>) => void;
  onDeleteSubZone?: (subZoneId: string) => void;
  selectedSubZoneId?: string | null;
  onSelectSubZone?: (subZoneId: string) => void;
  onAssignElementToZone?: (elementId: string, zoneId: string) => void;
}

const ZONE_TINTS = [
  {
    base: 'bg-emerald-500/15 border-emerald-600/70',
    selected: 'bg-emerald-500/25 border-emerald-600 ring-2 ring-emerald-500/50 shadow-md',
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200/60',
    indexBg: 'bg-emerald-800',
  },
  {
    base: 'bg-blue-500/15 border-blue-600/70',
    selected: 'bg-blue-500/25 border-blue-600 ring-2 ring-blue-500/50 shadow-md',
    badge: 'bg-blue-50 text-blue-800 border-blue-200/60',
    indexBg: 'bg-blue-800',
  },
  {
    base: 'bg-amber-500/15 border-amber-600/70',
    selected: 'bg-amber-500/25 border-amber-600 ring-2 ring-amber-500/50 shadow-md',
    badge: 'bg-amber-50 text-amber-800 border-amber-200/60',
    indexBg: 'bg-amber-800',
  },
  {
    base: 'bg-purple-500/15 border-purple-600/70',
    selected: 'bg-purple-500/25 border-purple-600 ring-2 ring-purple-500/50 shadow-md',
    badge: 'bg-purple-50 text-purple-800 border-purple-200/60',
    indexBg: 'bg-purple-800',
  },
  {
    base: 'bg-rose-500/15 border-rose-600/70',
    selected: 'bg-rose-500/25 border-rose-600 ring-2 ring-rose-500/50 shadow-md',
    badge: 'bg-rose-50 text-rose-800 border-rose-200/60',
    indexBg: 'bg-rose-800',
  },
];

export const GridZoneCard: React.FC<GridZoneCardProps> = ({
  zone,
  index,
  isSelected,
  isFocused = false,
  onSelect,
  onDelete,
  onUpdateName,
  onStartResize,
  onStartMove,
  isMoving = false,
  isSecondary = false,
  onUnlinkSecondary,
  onDrillDown,
  onAddSubZoneWithArea,
  onUpdateSubZone,
  onDeleteSubZone,
  selectedSubZoneId,
  onSelectSubZone,
  onAssignElementToZone,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(zone.name);
  const [isCardDropTarget, setIsCardDropTarget] = useState(false);

  const blockType = isSecondary ? 'secondary' : 'primary';
  const gridArea = (isSecondary ? zone.secondaryGridArea : zone.gridArea) || {
    rowStart: 1,
    colStart: 1,
    rowSpan: 1,
    colSpan: 1,
  };

  const tint = ZONE_TINTS[index % ZONE_TINTS.length];
  const hasLinkedSecondary = Boolean(zone.secondaryGridArea);

  const handleFinishEditing = () => {
    setIsEditing(false);
    if (tempName.trim() && tempName !== zone.name) {
      onUpdateName?.(zone.id, tempName.trim());
    }
  };

  const subCols = zone.subGridConfig?.columns || 2;
  const subRows = zone.subGridConfig?.rows || 2;

  return (
    <div
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, [data-resize-handle], [data-sub-resize]')) return;
        e.stopPropagation();
        onStartMove?.(e, zone.id, blockType);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(zone.id);
      }}
      onDoubleClick={(e) => {
        if (isSecondary) return;
        const target = e.target as HTMLElement;
        if (target.closest('button, input, [data-resize-handle], [data-sub-resize]')) return;
        e.stopPropagation();
        onDrillDown?.(zone.id);
      }}
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes('application/structpaper-element-id') ||
          e.dataTransfer.types.includes('text/plain')
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          if (!isCardDropTarget) setIsCardDropTarget(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsCardDropTarget(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsCardDropTarget(false);
        const elemId =
          e.dataTransfer.getData('application/structpaper-element-id') ||
          e.dataTransfer.getData('text/plain');
        if (elemId && onAssignElementToZone) {
          onAssignElementToZone(elemId, zone.id);
        }
      }}
      style={{
        gridRow: `${gridArea.rowStart} / span ${gridArea.rowSpan}`,
        gridColumn: `${gridArea.colStart} / span ${gridArea.colSpan}`,
      }}
      className={`group relative rounded-xl select-none cursor-grab active:cursor-grabbing border-2 border-dashed transition-all ${
        isCardDropTarget
          ? 'ring-3 ring-[#78C841] bg-[#78C841]/20 border-[#78C841] z-50 shadow-xl'
          : isFocused
            ? 'ring-3 ring-[#78C841] shadow-[0_0_20px_rgba(120,200,65,0.25)] border-[#78C841] bg-emerald-500/5 z-30'
            : isMoving
              ? 'opacity-35 border-[#78C841] scale-[0.98]'
              : isSelected
                ? tint.selected
                : `${tint.base} hover:border-zinc-700`
      }`}
    >
      {/* Center Drag & Drop Target Overlay */}
      {isCardDropTarget && (
        <div className="absolute inset-0 bg-[#78C841]/25 border-2 border-dashed border-[#78C841] rounded-xl z-50 flex items-center justify-center p-2 text-center pointer-events-none animate-fadeIn backdrop-blur-2xs shadow-xl">
          <div className="bg-white/95 text-[#14532D] text-xs font-black px-3.5 py-1.5 rounded-full shadow-md flex items-center gap-1.5 border border-[#78C841]/50">
            <span className="text-sm">📥</span>
            <span>Thả vào {zone.name}</span>
          </div>
        </div>
      )}
      {/* Floating Top Zone Badge - absolute position */}
      <div className="absolute -top-3 left-1.5 flex items-center gap-1 z-40 pointer-events-auto select-none max-w-[calc(100%-60px)]">
        {/* Numeric index pill */}
        <span
          className={`px-1.5 h-5 rounded-md ${tint.indexBg} text-white flex items-center justify-center text-[10px] font-extrabold font-mono shadow-xs shrink-0`}
          title={
            isSecondary
              ? 'Khối tiếp nối (Khối B)'
              : hasLinkedSecondary
                ? 'Khối chính (Khối A)'
                : `Phân vùng số ${index + 1}`
          }
        >
          {isSecondary
            ? `${index + 1}B`
            : hasLinkedSecondary
              ? `${index + 1}A`
              : index + 1}
        </span>

        {/* Inline editable zone name or secondary indicator */}
        {isEditing && !isSecondary ? (
          <input
            type="text"
            value={tempName}
            autoFocus
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleFinishEditing}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishEditing();
              if (e.key === 'Escape') {
                setTempName(zone.name);
                setIsEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-extrabold text-zinc-900 bg-white border border-[#78C841] rounded px-1 py-0.5 outline-none shadow-xs max-w-[130px]"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              if (isSecondary) return;
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="text-[10px] font-extrabold text-zinc-800 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-zinc-200/80 shadow-2xs truncate max-w-[130px] hover:text-[#14532D]"
            title={
              isSecondary
                ? `${zone.name} (Khối tiếp nối B)`
                : `${zone.name} (Bấm đúp để đổi tên)`
            }
          >
            {zone.name}
          </span>
        )}

        {/* Grid coordinates tag */}
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded-md ${tint.badge} border font-mono shadow-2xs shrink-0 font-bold`}
        >
          {gridArea.colSpan}c×{gridArea.rowSpan}r
        </span>
      </div>

      {/* Center Drag to Move Grip Hint on Hover */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-200/90 shadow-sm text-[10px] font-extrabold text-zinc-700 pointer-events-none select-none">
          <Move className="w-3 h-3 text-[#78C841]" />
          <span>{isSecondary ? 'Kéo thả Khối tiếp nối (2)' : 'Kéo thả khối'}</span>
        </div>
      </div>

      {/* Drill-down / Focus into sub-zones button */}
      {!isSecondary && onDrillDown && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDrillDown(zone.id);
          }}
          className="absolute -top-2.5 right-7 w-5 h-5 rounded-md bg-zinc-900 hover:bg-black text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110 active:scale-95 shadow-xs z-40 pointer-events-auto shrink-0"
          title="Nhấp đúp hoặc bấm đây để phân chia vùng con đa cấp (Lưới con)"
        >
          <Layers className="w-3 h-3 text-[#78C841]" />
        </button>
      )}

      {/* Floating Delete / Unlink "X" button - absolute position */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (isSecondary && onUnlinkSecondary) {
            onUnlinkSecondary(zone.id);
          } else {
            onDelete(zone.id);
          }
        }}
        className="absolute -top-2.5 right-1.5 w-5 h-5 rounded-md bg-[#DF4D89] hover:bg-[#c93c75] text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110 active:scale-95 shadow-xs z-40 pointer-events-auto shrink-0"
        title={isSecondary ? 'Gỡ bỏ Khối tiếp nối (Khối 2) này' : 'Xóa phân vùng này'}
      >
        <X className="w-3 h-3 stroke-[3]" />
      </button>

      {/* Interactive Sub-grid Matrix directly inside parent zone card on paper */}
      {(zone.subGridConfig || (zone.subZones && zone.subZones.length > 0)) && (
        <>
          <ZoneSubGridOverlay
            parentZone={zone}
            selectedSubZoneId={selectedSubZoneId}
            onSelectSubZone={onSelectSubZone}
            onDrillDown={onDrillDown}
            onAddSubZoneWithArea={onAddSubZoneWithArea}
            onUpdateSubZone={onUpdateSubZone}
            onDeleteSubZone={onDeleteSubZone}
            onAssignElementToZone={onAssignElementToZone}
          />
        </>
      )}

      {/* 1. TOP-LEFT corner resize handle (Opposite corner ⌜) */}
      <div
        data-resize-handle="nw"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartResize(e, zone.id, 'nw', blockType);
        }}
        className="absolute top-1 left-1 p-1 rounded-md bg-white/90 border border-zinc-300 text-zinc-900 hover:text-[#78C841] hover:border-[#78C841] cursor-nw-resize transition-transform hover:scale-110 shadow-xs z-40 pointer-events-auto"
        title="Kéo góc trên-trái (đối diện) để thay đổi kích thước & vị trí"
      >
        <div className="w-3 h-3 border-l-2 border-t-2 border-current rounded-tl-[2px]" />
      </div>

      {/* 2. BOTTOM-RIGHT corner resize handle (⌟) */}
      <div
        data-resize-handle="se"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartResize(e, zone.id, 'se', blockType);
        }}
        className="absolute bottom-1 right-1 p-1 rounded-md bg-white/90 border border-zinc-300 text-zinc-900 hover:text-[#78C841] hover:border-[#78C841] cursor-se-resize transition-transform hover:scale-110 shadow-xs z-40 pointer-events-auto"
        title="Kéo góc dưới-phải để thay đổi số cột & dòng chiếm chỗ (Col / Row span)"
      >
        <div className="w-3 h-3 border-r-2 border-b-2 border-current rounded-br-[2px]" />
      </div>
    </div>
  );
};
