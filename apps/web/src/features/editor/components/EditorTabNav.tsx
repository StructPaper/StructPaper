'use client';

import React, { useRef, useEffect } from 'react';
import { EditorTabKey } from './types';
import { PreflightCheck } from '@/types/paper';

interface EditorTabNavProps {
  activeTab: EditorTabKey;
  onTabChange: (tab: EditorTabKey) => void;
  authorsCount: number;
  sectionsCount?: number;
  referencesCount: number;
  preflight: PreflightCheck;
}

export const EditorTabNav: React.FC<EditorTabNavProps> = ({
  activeTab,
  onTabChange,
  authorsCount,
  sectionsCount = 0,
  referencesCount,
  preflight,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);
  const hasErrors = preflight.issues?.some((i) => i.severity === 'error');

  const tabs: {
    key: EditorTabKey;
    label: string;
    badge?: React.ReactNode;
  }[] = [
      {
        key: 'metadata',
        label: 'Tựa đề',
      },
      {
        key: 'authors',
        label: 'Tác giả',
        badge: (
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-300 text-zinc-700 font-bold">
            {authorsCount}
          </span>
        ),
      },
      {
        key: 'abstract',
        label: 'Tóm tắt',
      },
      {
        key: 'sections',
        label: 'Nội dung',
        badge: (
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-300 text-zinc-700 font-bold">
            {sectionsCount}
          </span>
        ),
      },
      {
        key: 'refs',
        label: 'Tài liệu tham khảo',
        badge: (
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-300 text-zinc-700 font-bold">
            {referencesCount}
          </span>
        ),
      },
      {
        key: 'citation',
        label: 'Trích dẫn',
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
  }, [activeTab]);

  return (
    <div className="relative w-full">
      {/* Scrollable pill tabs container without any default browser scrollbars */}
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1 overflow-x-auto p-1 bg-zinc-200/70 rounded-2xl no-scrollbar scrollbar-none w-full select-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              ref={isActive ? activeTabRef : null}
              type="button"
              onClick={() => onTabChange(tab.key)}
              title={tab.label}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none flex-1 min-w-fit ${isActive
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60 font-extrabold'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60'
                }`}
            >
              <span>{tab.label}</span>
              {tab.badge}
            </button>
          );
        })}
      </div>
    </div>
  );
};
