'use client';

import React, { useRef, useEffect } from 'react';
import { AuthoringTabKey } from './types';
import {
  FileText,
  Users,
  AlignLeft,
  Layers,
  Table as TableIcon,
  Image as ImageIcon,
  BookMarked,
  Code2,
} from 'lucide-react';

interface PaperEditorTabNavProps {
  activeTab: AuthoringTabKey;
  onTabChange: (tab: AuthoringTabKey) => void;
  authorsCount: number;
  sectionsCount: number;
  tablesCount: number;
  figuresCount: number;
  referencesCount: number;
}

export const PaperEditorTabNav: React.FC<PaperEditorTabNavProps> = ({
  activeTab,
  onTabChange,
  authorsCount,
  sectionsCount,
  tablesCount,
  figuresCount,
  referencesCount,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const tabs: {
    key: AuthoringTabKey;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }[] = [
    {
      key: 'metadata',
      label: 'Thông tin',
      icon: <FileText className="w-3.5 h-3.5" />,
    },
    {
      key: 'authors',
      label: 'Tác giả',
      icon: <Users className="w-3.5 h-3.5" />,
      count: authorsCount,
    },
    {
      key: 'abstract',
      label: 'Tóm tắt',
      icon: <AlignLeft className="w-3.5 h-3.5" />,
    },
    {
      key: 'sections',
      label: 'Nội dung',
      icon: <Layers className="w-3.5 h-3.5" />,
      count: sectionsCount,
    },
    {
      key: 'tables',
      label: 'Bảng biểu',
      icon: <TableIcon className="w-3.5 h-3.5" />,
      count: tablesCount,
    },
    {
      key: 'figures',
      label: 'Hình ảnh',
      icon: <ImageIcon className="w-3.5 h-3.5" />,
      count: figuresCount,
    },
    {
      key: 'references',
      label: 'Tham khảo',
      icon: <BookMarked className="w-3.5 h-3.5" />,
      count: referencesCount,
    },
    {
      key: 'typst',
      label: 'Mã Typst',
      icon: <Code2 className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <div className="relative w-full">
      <div
        ref={scrollContainerRef}
        className="flex items-center gap-1 overflow-x-auto p-1 bg-slate-200/70 rounded-2xl no-scrollbar scrollbar-none w-full select-none"
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => onTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-150 cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
              }`}
            >
              <span className={isActive ? 'text-[#78C841]' : 'text-slate-400'}>
                {tab.icon}
              </span>
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isActive
                      ? 'bg-emerald-100 text-[#14532D]'
                      : 'bg-slate-300/80 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
