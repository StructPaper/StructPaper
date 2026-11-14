'use client';

import React, { useRef, useEffect } from 'react';
import { BuilderStudioStep } from '@/types/template-builder';
import { Sliders, Layers, Type, Eye, LayoutGrid, Sparkles } from 'lucide-react';

interface TemplateBuilderTabNavProps {
  activeStep: BuilderStudioStep;
  onStepChange: (step: BuilderStudioStep) => void;
  zonesCount: number;
  elementsCount: number;
}

export const TemplateBuilderTabNav: React.FC<TemplateBuilderTabNavProps> = ({
  activeStep,
  onStepChange,
  zonesCount,
  elementsCount,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const tabs: {
    key: BuilderStudioStep;
    label: string;
    icon: React.ReactNode;
    badge?: React.ReactNode;
  }[] = [
    {
      key: 'page-zones',
      label: '1. Khổ giấy & Lề',
      icon: <Sliders className="w-3.5 h-3.5" />,
    },
    {
      key: 'grid-zones',
      label: '2. Bố cục Phân vùng',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      badge: (
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-300 text-zinc-700 font-bold">
          {zonesCount}
        </span>
      ),
    },
    {
      key: 'elements-tree',
      label: '3. Cấu trúc Thành phần',
      icon: <Layers className="w-3.5 h-3.5" />,
      badge: (
        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-300 text-zinc-700 font-bold">
          {elementsCount}
        </span>
      ),
    },
    {
      key: 'deep-styling',
      label: '4. Định dạng Sâu',
      icon: <Type className="w-3.5 h-3.5" />,
    },
    {
      key: 'special-elements',
      label: '5. Thành phần Nổi',
      icon: <Sparkles className="w-3.5 h-3.5" />,
    },
  ];

  // Auto-scroll active tab into center view if overflow occurs
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [activeStep]);

  return (
    <div className="relative w-full">
      {/* Scrollable pill tabs container matching EditorTabNav */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1 overflow-x-auto p-1 bg-zinc-200/70 rounded-2xl no-scrollbar scrollbar-none w-full select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive = activeStep === tab.key;
          return (
            <button
              key={tab.key}
              ref={isActive ? activeTabRef : null}
              type="button"
              onClick={() => onStepChange(tab.key)}
              title={tab.label}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none flex-1 min-w-fit ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60 font-extrabold'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60'
              }`}
            >
              <span className={isActive ? 'text-[#78C841]' : 'text-zinc-400'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
      </div>
    </div>
  );
};
