'use client';

import React from 'react';
import { CssDisplayMode } from '@/types/template-engine/layout';
import { LayoutGrid, Columns, Rows3, AlignVerticalSpaceAround } from 'lucide-react';

interface DisplayModeSwitcherProps {
  currentMode: CssDisplayMode;
  onChange: (mode: CssDisplayMode) => void;
}

const MODES: Array<{
  id: CssDisplayMode;
  label: string;
  sublabel: string;
  typstChip: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'grid',
    label: 'CSS Grid',
    sublabel: 'Lưới đa chiều (Sidebar + Nội dung)',
    typstChip: '#grid',
    icon: <LayoutGrid className="w-4 h-4" />,
  },
  {
    id: 'flex',
    label: 'CSS Flexbox',
    sublabel: 'Hàng/Cột linh hoạt phân bố tự động',
    typstChip: '#stack',
    icon: <AlignVerticalSpaceAround className="w-4 h-4" />,
  },
  {
    id: 'columns',
    label: 'Multi-Column',
    sublabel: 'Đa cột báo chí khoa học (2-3 cột)',
    typstChip: '#columns',
    icon: <Columns className="w-4 h-4" />,
  },
  {
    id: 'block',
    label: 'Block Flow',
    sublabel: 'Khối dòng chảy đơn 100% chiều rộng',
    typstChip: '#block',
    icon: <Rows3 className="w-4 h-4" />,
  },
];

export const DisplayModeSwitcher: React.FC<DisplayModeSwitcherProps> = ({
  currentMode,
  onChange,
}) => {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold text-zinc-600 uppercase tracking-wider block">
          Chế độ Bố cục (Layout Engine)
        </label>
        <span className="text-[10px] font-mono font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200/60">
          Typst Target
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {MODES.map((mode) => {
          const isActive = currentMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onChange(mode.id)}
              className={`p-2.5 rounded-2xl text-left transition-all duration-150 flex flex-col gap-1.5 border select-none cursor-pointer ${
                isActive
                  ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-2 ring-[#78C841]/50'
                  : 'bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 border-zinc-200/80 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5 font-extrabold text-xs">
                  <span className={isActive ? 'text-[#78C841]' : 'text-zinc-600'}>
                    {mode.icon}
                  </span>
                  <span>{mode.label}</span>
                </div>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded ${
                    isActive
                      ? 'bg-zinc-800 text-[#78C841]'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  {mode.typstChip}
                </span>
              </div>
              <span
                className={`text-[10px] leading-snug line-clamp-2 ${
                  isActive ? 'text-zinc-300' : 'text-zinc-500'
                }`}
              >
                {mode.sublabel}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
