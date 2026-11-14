'use client';

import React from 'react';
import { Affiliation } from '@/types/paper';
import { Trash2, Globe } from 'lucide-react';

interface AffiliationItemCardProps {
  aff: Affiliation;
  idx: number;
  authorUsageCount: number;
  isDeleting: boolean;
  isNewlyAdded: boolean;
  onUpdateAff: (updated: Affiliation) => void;
  onRemoveAff: () => void;
}

export const AffiliationItemCard: React.FC<AffiliationItemCardProps> = ({
  aff,
  idx,
  authorUsageCount,
  isDeleting,
  isNewlyAdded,
  onUpdateAff,
  onRemoveAff,
}) => {
  const affKey = `aff_${aff.id}`;

  return (
    <div
      id={`aff-item-${affKey}`}
      className={`grid transition-all duration-300 ease-in-out ${
        isDeleting
          ? 'grid-rows-[0fr] opacity-0 scale-95 -translate-y-2 pointer-events-none'
          : 'grid-rows-[1fr] opacity-100 scale-100 translate-y-0'
      } ${isNewlyAdded ? 'animate-section-enter' : ''}`}
    >
      <div>
        <div
          className={`p-3.5 rounded-3xl bg-gray-200/50 flex flex-col sm:flex-row items-start sm:items-center gap-3 transition-all duration-300 ${
            isNewlyAdded ? 'section-highlight-glow ring-2 ring-blue-300' : ''
          }`}
        >
          {/* ID Indicator */}
          <div className="flex sm:flex-col items-center gap-1 flex-shrink-0">
            <span className="w-8 h-8 rounded-2xl bg-[#1A1A1A] text-white flex items-center justify-center text-xs font-black shadow-2xs">
              {aff.id}
            </span>
          </div>

          {/* Dual-language Inputs */}
          <div className="flex-1 w-full space-y-1">
            {/* Vietnamese Version */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-gray-50 text-gray-700 flex-shrink-0 select-none">
                Tiếng Việt
              </span>
              <input
                type="text"
                value={aff.name}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                onChange={(e) => {
                  onUpdateAff({ ...aff, name: e.target.value });
                }}
                className="flex-1 p-2 rounded-xl text-xs font-medium text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs"
                placeholder="Tên viện / Trường đại học bằng Tiếng Việt..."
              />
            </div>

            {/* English Version */}
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-gray-50 text-gray-800 flex-shrink-0 select-none flex items-center gap-1">
                <Globe className="w-2.5 h-2.5" /> English
              </span>
              <input
                type="text"
                value={aff.nameEn || ''}
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                onChange={(e) => {
                  onUpdateAff({ ...aff, nameEn: e.target.value });
                }}
                className="flex-1 p-2 rounded-xl text-xs font-medium text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300"
                placeholder="Tên cơ quan bằng Tiếng Anh (tùy chọn)..."
              />
            </div>
          </div>

          {/* Actions and Usage info */}
          <div className="flex sm:flex-col items-center justify-between sm:justify-center w-full sm:w-auto gap-2 self-stretch pt-1 sm:pt-0 border-t sm:border-t-0 border-zinc-100 flex-shrink-0">
            <span className="text-[10px] font-semibold text-zinc-500">
              {authorUsageCount > 0 ? `${authorUsageCount} tác giả chọn` : 'Chưa gán tác giả'}
            </span>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onRemoveAff}
              className="p-2 rounded-xl text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              title={
                authorUsageCount > 0
                  ? `Xóa cơ quan này sẽ tự động gỡ khỏi ${authorUsageCount} tác giả và đánh số lại 1..N`
                  : 'Xóa cơ quan này'
              }
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
