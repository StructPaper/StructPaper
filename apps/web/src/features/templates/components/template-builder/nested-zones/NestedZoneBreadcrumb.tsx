'use client';

import React from 'react';
import { ZonePathItem } from './types';
import { ChevronRight, ArrowLeft, Layers, CornerDownRight, Home } from 'lucide-react';

interface NestedZoneBreadcrumbProps {
  path: ZonePathItem[];
  onNavigateToLevel: (zoneId: string | null) => void;
  currentPageNumber?: number;
}

export const NestedZoneBreadcrumb: React.FC<NestedZoneBreadcrumbProps> = ({
  path,
  onNavigateToLevel,
  currentPageNumber = 1,
}) => {
  if (path.length === 0) return null;

  const currentZone = path[path.length - 1];
  const parentZone = path.length > 1 ? path[path.length - 2] : null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-zinc-900 text-white rounded-2xl shadow-sm border border-zinc-800">
      {/* Path Crumbs */}
      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
        <button
          type="button"
          onClick={() => onNavigateToLevel(null)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
          title="Quay về xem toàn bộ trang giấy"
        >
          <Home className="w-3.5 h-3.5 text-[#78C841]" />
          <span>Trang {currentPageNumber}</span>
        </button>

        {path.map((item, idx) => {
          const isLast = idx === path.length - 1;
          return (
            <React.Fragment key={item.id}>
              <ChevronRight className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <button
                type="button"
                disabled={isLast}
                onClick={() => onNavigateToLevel(item.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                  isLast
                    ? 'bg-[#78C841] text-zinc-950 font-extrabold shadow-2xs'
                    : 'bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white cursor-pointer'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{item.name}</span>
                <span className="text-[10px] opacity-75 font-mono">L{item.level}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Quick Action: Back to Parent or Exit */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onNavigateToLevel(parentZone ? parentZone.id : null)}
          className="flex items-center gap-1 px-3 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-[#78C841]" />
          <span>{parentZone ? `Về ${parentZone.name}` : 'Thoát Focus'}</span>
        </button>
      </div>
    </div>
  );
};
