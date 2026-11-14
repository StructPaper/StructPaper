'use client';

import React, { useState, useEffect } from 'react';
import { LayoutZoneConfig } from '@/types/template-builder';
import { X, Layers, Move } from 'lucide-react';

interface ChildSubZoneCardProps {
  subZone: LayoutZoneConfig;
  index: number;
  isSelected: boolean;
  isMoving?: boolean;
  isResizing?: boolean;
  maxCols: number;
  onSelect: (id: string) => void;
  onDrillDown?: (id: string) => void;
  onDelete?: (id: string) => void;
  onUpdateSubZone?: (id: string, updated: Partial<LayoutZoneConfig>) => void;
  onStartMove?: (id: string, e: React.MouseEvent) => void;
  onStartResize?: (id: string, handle: 'se' | 'nw', e: React.MouseEvent) => void;
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

export const ChildSubZoneCard: React.FC<ChildSubZoneCardProps> = ({
  subZone,
  index,
  isSelected,
  isMoving = false,
  isResizing = false,
  onSelect,
  onDrillDown,
  onDelete,
  onUpdateSubZone,
  onStartMove,
  onStartResize,
  onAssignElementToZone,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(subZone.name);
  const [isSubDropTarget, setIsSubDropTarget] = useState(false);

  const tint = ZONE_TINTS[index % ZONE_TINTS.length];

  useEffect(() => {
    setTempName(subZone.name);
  }, [subZone.name]);

  const handleFinishEditing = () => {
    setIsEditing(false);
    const trimmed = tempName.trim();
    if (trimmed && trimmed !== subZone.name) {
      onUpdateSubZone?.(subZone.id, { name: trimmed });
    } else {
      setTempName(subZone.name);
    }
  };

  const area = subZone.gridArea || {
    rowStart: 1,
    colStart: index + 1,
    rowSpan: 1,
    colSpan: 1,
  };

  return (
    <div
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, [data-sub-resize]')) return;
        e.stopPropagation();
        onStartMove?.(subZone.id, e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(subZone.id);
      }}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, [data-sub-resize]')) return;
        e.stopPropagation();
        onDrillDown?.(subZone.id);
      }}
      onDragOver={(e) => {
        if (
          e.dataTransfer.types.includes('application/structpaper-element-id') ||
          e.dataTransfer.types.includes('text/plain')
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = 'copy';
          if (!isSubDropTarget) setIsSubDropTarget(true);
        }
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setIsSubDropTarget(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsSubDropTarget(false);
        const elemId =
          e.dataTransfer.getData('application/structpaper-element-id') ||
          e.dataTransfer.getData('text/plain');
        if (elemId && onAssignElementToZone) {
          onAssignElementToZone(elemId, subZone.id);
        }
      }}
      style={{
        gridRow: `${area.rowStart} / span ${area.rowSpan}`,
        gridColumn: `${area.colStart} / span ${area.colSpan}`,
      }}
      className={`group/subcard relative rounded-xl border-2 border-dashed transition-all select-none cursor-grab active:cursor-grabbing ${
        isSubDropTarget
          ? 'ring-3 ring-[#78C841] bg-[#78C841]/25 border-[#78C841] z-50 shadow-lg'
          : isMoving || isResizing
            ? 'opacity-35 border-[#78C841] scale-[0.98]'
            : isSelected
              ? tint.selected
              : `${tint.base} hover:border-zinc-700`
      }`}
      title={`Phân vùng con "${subZone.name}" (${area.colSpan}c × ${area.rowSpan}r). Bấm đúp để chia vùng con tiếp theo.`}
    >
      {/* Drop Target Overlay */}
      {isSubDropTarget && (
        <div className="absolute inset-0 bg-[#78C841]/35 border-2 border-dashed border-[#78C841] rounded-lg z-50 flex items-center justify-center p-1 text-center pointer-events-none animate-fadeIn backdrop-blur-2xs shadow-xl">
          <div className="bg-white/95 text-[#14532D] text-[10px] font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-[#78C841]/50">
            <span>📥</span>
            <span>Thả vào {subZone.name}</span>
          </div>
        </div>
      )}

      {/* Floating Top Zone Badge - absolute position (identical to GridZoneCard) */}
      <div className="absolute -top-3 left-1.5 flex items-center gap-1 z-40 pointer-events-auto select-none max-w-[calc(100%-60px)]">
        {/* Numeric index pill */}
        <span
          className={`px-1.5 h-5 rounded-md ${tint.indexBg} text-white flex items-center justify-center text-[10px] font-extrabold font-mono shadow-xs shrink-0`}
          title={`Phân vùng con số ${index + 1}`}
        >
          {index + 1}
        </span>

        {/* Inline editable zone name */}
        {isEditing ? (
          <input
            type="text"
            value={tempName}
            autoFocus
            onChange={(e) => setTempName(e.target.value)}
            onBlur={handleFinishEditing}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleFinishEditing();
              if (e.key === 'Escape') {
                setTempName(subZone.name);
                setIsEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-[10px] font-extrabold text-zinc-900 bg-white border border-[#78C841] rounded px-1 py-0.5 outline-none shadow-xs max-w-[120px]"
          />
        ) : (
          <span
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="text-[10px] font-extrabold text-zinc-800 bg-white/95 backdrop-blur-xs px-1.5 py-0.5 rounded-md border border-zinc-200/80 shadow-2xs truncate max-w-[120px] hover:text-[#14532D]"
            title={`${subZone.name} (Bấm đúp để đổi tên)`}
          >
            {subZone.name}
          </span>
        )}

        {/* Grid coordinates tag */}
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded-md ${tint.badge} border font-mono shadow-2xs shrink-0 font-bold`}
        >
          {area.colSpan}c×{area.rowSpan}r
        </span>
      </div>

      {/* Center Drag to Move Grip Hint on Hover */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover/subcard:opacity-100 transition-opacity">
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-200/90 shadow-sm text-[10px] font-extrabold text-zinc-700 pointer-events-none select-none">
          <Move className="w-3 h-3 text-[#78C841]" />
          <span>Kéo thả vùng con</span>
        </div>
      </div>

      {/* Floating Drill Down Button (Layers) */}
      {onDrillDown && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDrillDown(subZone.id);
          }}
          className="absolute -top-2.5 right-7 w-5 h-5 rounded-md bg-zinc-900 hover:bg-black text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110 active:scale-95 shadow-xs z-40 pointer-events-auto shrink-0"
          title="Bấm đúp hoặc nhấn đây để phân chia vùng con cấp tiếp theo"
        >
          <Layers className="w-3 h-3 text-[#78C841]" />
        </button>
      )}

      {/* Floating Delete Button */}
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(subZone.id);
          }}
          className="absolute -top-2.5 right-1.5 w-5 h-5 rounded-md bg-[#DF4D89] hover:bg-[#c93c75] text-white flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110 active:scale-95 shadow-xs z-40 pointer-events-auto shrink-0"
          title="Xóa phân vùng con này"
        >
          <X className="w-3 h-3 stroke-[3]" />
        </button>
      )}

      {/* 1. TOP-LEFT corner resize handle (Opposite corner ⌜) */}
      <div
        data-sub-resize="nw"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartResize?.(subZone.id, 'nw', e);
        }}
        className="absolute top-1 left-1 p-1 rounded-md bg-white/90 border border-zinc-300 text-zinc-900 hover:text-[#78C841] hover:border-[#78C841] cursor-nw-resize transition-transform hover:scale-110 shadow-xs z-40 pointer-events-auto"
        title="Kéo góc trên-trái để thay đổi kích thước & vị trí"
      >
        <div className="w-3 h-3 border-l-2 border-t-2 border-current rounded-tl-[2px]" />
      </div>

      {/* 2. BOTTOM-RIGHT corner resize handle (⌟) */}
      <div
        data-sub-resize="se"
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartResize?.(subZone.id, 'se', e);
        }}
        className="absolute bottom-1 right-1 p-1 rounded-md bg-white/90 border border-zinc-300 text-zinc-900 hover:text-[#78C841] hover:border-[#78C841] cursor-se-resize transition-transform hover:scale-110 shadow-xs z-40 pointer-events-auto"
        title="Kéo góc dưới-phải để thay đổi số cột & dòng chiếm chỗ"
      >
        <div className="w-3 h-3 border-r-2 border-b-2 border-current rounded-br-[2px]" />
      </div>
    </div>
  );
};
