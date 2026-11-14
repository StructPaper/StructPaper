'use client';

import React from 'react';
import { LayoutZoneConfig } from '@/types/template-builder';
import { Layers, Trash2, ChevronRight, Layers3 } from 'lucide-react';

interface SubZoneTreeListProps {
  subZones: LayoutZoneConfig[];
  selectedSubZoneId: string | null;
  onSelectSubZone: (id: string) => void;
  onDrillDown: (id: string) => void;
  onDeleteSubZone: (id: string) => void;
}

export const SubZoneTreeList: React.FC<SubZoneTreeListProps> = ({
  subZones,
  selectedSubZoneId,
  onSelectSubZone,
  onDrillDown,
  onDeleteSubZone,
}) => {
  return (
    <div className="bg-white border border-zinc-200/80 rounded-2xl p-3.5 space-y-2.5 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers3 className="w-4 h-4 text-[#14532D]" />
          <h4 className="text-xs font-extrabold text-zinc-900">
            Danh sách phân vùng con ({subZones.length})
          </h4>
        </div>
        <span className="text-[10px] text-zinc-500 font-semibold">Chọn vùng để cấu hình</span>
      </div>

      {subZones.length === 0 ? (
        <div className="p-4 text-center rounded-xl bg-zinc-50 border border-dashed border-zinc-200 text-zinc-500">
          <p className="text-xs font-bold text-zinc-700">Chưa có phân vùng con nào</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Kéo chuột quét ô trên giấy ở khung bên phải hoặc chọn &quot;Gợi ý chia nhanh&quot; ở trên.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {subZones.map((sz, idx) => {
            const isSelected = selectedSubZoneId === sz.id;
            const area = sz.gridArea || {
              rowStart: 1,
              colStart: idx + 1,
              rowSpan: 1,
              colSpan: 1,
            };

            return (
              <div
                key={sz.id}
                onClick={() => onSelectSubZone(sz.id)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 select-none ${
                  isSelected
                    ? 'border-[#78C841] bg-[#78C841]/10 ring-2 ring-[#78C841]/40 shadow-xs'
                    : 'border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-md bg-zinc-900 text-white flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-zinc-900 truncate">{sz.name}</p>
                    <p className="text-[10px] font-mono text-zinc-500">
                      Cột {area.colStart}..{area.colStart + area.colSpan - 1} × Dòng {area.rowStart}..{area.rowStart + area.rowSpan - 1}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDrillDown(sz.id);
                    }}
                    className="h-6 px-2 rounded-lg bg-zinc-100 hover:bg-zinc-900 text-zinc-700 hover:text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Đi sâu vào chia ô phân cấp L3"
                  >
                    <Layers className="w-3 h-3 text-[#78C841]" />
                    <span>L3</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteSubZone(sz.id);
                    }}
                    className="p-1 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors"
                    title="Xóa vùng con này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
