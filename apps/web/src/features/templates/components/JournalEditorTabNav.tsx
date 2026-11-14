'use client';

import React, { useRef, useEffect } from 'react';

export type JournalEditorTabKey = 'general' | 'frontmatter' | 'article-types' | 'layout';

interface JournalEditorTabNavProps {
  activeTab: JournalEditorTabKey;
  onTabChange: (tab: JournalEditorTabKey) => void;
  articleTypesCount?: number;
}

export const JournalEditorTabNav: React.FC<JournalEditorTabNavProps> = ({
  activeTab,
  onTabChange,
  articleTypesCount,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  const tabs: {
    key: JournalEditorTabKey;
    label: string;
    badge?: React.ReactNode;
  }[] = [
    { key: 'general', label: 'Nhận diện & Thương hiệu' },
    { key: 'frontmatter', label: 'Tóm tắt & Từ khóa' },
    {
      key: 'article-types',
      label: 'Chuyên mục & Loại bài',
      badge:
        typeof articleTypesCount === 'number' ? (
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-300 text-zinc-700 font-bold">
            {articleTypesCount}
          </span>
        ) : null,
    },
    { key: 'layout', label: 'Dàn trang' },
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
    <div className="relative w-full select-none">
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 whitespace-nowrap cursor-pointer select-none ${
                isActive
                  ? 'bg-white text-zinc-900 shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
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
