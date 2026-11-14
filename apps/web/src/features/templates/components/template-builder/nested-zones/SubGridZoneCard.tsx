'use client';

import React, { useState } from 'react';
import { LayoutZoneConfig } from '@/types/template-builder';
import { Layers, Trash2, Check, Maximize2, Move } from 'lucide-react';

interface SubGridZoneCardProps {
  subZone: LayoutZoneConfig;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdateName: (id: string, name: string) => void;
  onDrillDown: (id: string) => void;
  onStartResize?: (e: React.MouseEvent, id: string, handle: 'se' | 'nw') => void;
  onStartMove?: (e: React.MouseEvent, id: string) => void;
  isMoving?: boolean;
}

export const SubGridZoneCard: React.FC<SubGridZoneCardProps> = ({
  subZone,
  index,
  isSelected,
  onSelect,
  onDelete,
  onUpdateName,
  onDrillDown,
  onStartResize,
  onStartMove,
  isMoving = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(subZone.name);

  const area = subZone.gridArea || {
    rowStart: 1,
    colStart: 1,
    rowSpan: 1,
    colSpan: 1,
  };

  const handleSaveName = () => {
    setIsEditing(false);
    if (name.trim() && name !== subZone.name) {
      onUpdateName(subZone.id, name.trim());
    }
  };

  const hasNestedChildren = Boolean(subZone.subZones && subZone.subZones.length > 0);

  return (
    <div
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, [data-resize-handle]')) return;
        e.stopPropagation();
        onStartMove?.(e, subZone.id);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(subZone.id);
      }}
      onDoubleClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('button, input, [data-resize-handle]')) return;
        e.stopPropagation();
        onDrillDown(subZone.id);
      }}
      style={{
        gridRow: `${area.rowStart} / span ${area.rowSpan}`,
        gridColumn: `${area.colStart} / span ${area.colSpan}`,
      }}
      className={`relative p-2.5 rounded-2xl border-2 transition-all cursor-grab active:cursor-grabbing flex flex-col justify-between group select-none min-h-[92px] ${
        isMoving
          ? 'opacity-35 border-[#78C841] scale-[0.98]'
          : isSelected
            ? 'bg-[#78C841]/10 border-[#78C841] shadow-xs ring-2 ring-[#78C841]/40'
            : 'bg-white hover:bg-zinc-50 border-zinc-200/90 shadow-2xs hover:border-zinc-400'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-1 relative z-20">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <span className="w-5 h-5 rounded-lg bg-zinc-900 text-white flex items-center justify-center text-[10px] font-mono font-extrabold shrink-0 shadow-2xs">
            {index + 1}
          </span>
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                className="text-xs font-bold text-zinc-900 bg-white border border-[#78C841] rounded px-1.5 py-0.5 outline-none max-w-[100px]"
              />
              <button
                type="button"
                onClick={handleSaveName}
                className="p-1 rounded bg-[#78C841] text-zinc-950 hover:bg-[#68B237] cursor-pointer"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <span
              className="text-xs font-extrabold text-zinc-900 truncate hover:text-[#14532D] cursor-text"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="Nhấp để đổi tên vùng con"
            >
              {subZone.name}
            </span>
          )}
        </div>

        {/* Action buttons: Chia ô con + Xóa */}
        <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDrillDown(subZone.id);
            }}
            className="px-1.5 py-0.5 rounded-lg bg-zinc-100 hover:bg-[#78C841]/20 hover:text-[#14532D] text-zinc-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Chia ô / Chia tiếp vùng con bên trong vùng này (Nhấp đúp chuột)"
          >
            <Layers className="w-3 h-3 text-[#78C841]" />
            <span>Chia ô</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(subZone.id);
            }}
            className="p-1 rounded-lg hover:bg-red-50 text-zinc-400 hover:text-red-500 cursor-pointer transition-colors"
            title="Xóa vùng con này"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Center Drag to Move Grip Hint on Hover */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md px-2 py-0.5 rounded-full border border-zinc-200/90 shadow-sm text-[9px] font-extrabold text-zinc-700 pointer-events-none select-none">
          <Move className="w-2.5 h-2.5 text-[#78C841]" />
          <span>Kéo di chuyển ô</span>
        </div>
      </div>

      {/* Meta info & Nested Children badge */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500 font-mono relative z-20">
        <span className="bg-zinc-100 px-1.5 py-0.5 rounded-md font-semibold text-zinc-700">
          C{area.colStart}..{area.colStart + area.colSpan - 1} × R{area.rowStart}..{area.rowStart + area.rowSpan - 1}
        </span>
        {hasNestedChildren ? (
          <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-[#14532D] bg-[#78C841]/20 px-1.5 py-0.5 rounded-full">
            <Layers className="w-2.5 h-2.5" />
            {subZone.subZones?.length} vùng con
          </span>
        ) : (
          <span className="text-[9px] text-zinc-400">
            {subZone.columns || 1} cột • {subZone.type || 'full-width'}
          </span>
        )}
      </div>

      {/* 1. TOP-LEFT corner resize handle (nw) */}
      {onStartResize && (
        <div
          data-resize-handle="nw"
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartResize(e, subZone.id, 'nw');
          }}
          className="absolute top-1 left-1 p-0.5 rounded-md bg-white/90 border border-zinc-300 text-zinc-900 hover:text-[#78C841] hover:border-[#78C841] cursor-nw-resize transition-transform hover:scale-110 shadow-xs z-30 pointer-events-auto"
          title="Kéo góc trên-trái để thay đổi vị trí & kích thước"
        >
          <div className="w-2 h-2 border-l-2 border-t-2 border-current rounded-tl-[1px]" />
        </div>
      )}

      {/* 2. BOTTOM-RIGHT corner resize handle (se) */}
      {onStartResize && (
        <div
          data-resize-handle="se"
          onMouseDown={(e) => {
            e.stopPropagation();
            onStartResize(e, subZone.id, 'se');
          }}
          className="absolute bottom-1 right-1 p-0.5 rounded-md bg-white/90 border border-zinc-300 text-zinc-900 hover:text-[#78C841] hover:border-[#78C841] cursor-se-resize transition-transform hover:scale-110 shadow-xs z-30 pointer-events-auto"
          title="Kéo góc dưới-phải để co giãn số cột & dòng chiếm chỗ (Col / Row span)"
        >
          <div className="w-2 h-2 border-r-2 border-b-2 border-current rounded-br-[1px]" />
        </div>
      )}
    </div>
  );
};

