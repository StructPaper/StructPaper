'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UploadCloud, FolderArchive, BookOpen, User, Settings } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const tabs = [
    { path: '/papers', label: 'Bài báo', icon: FolderArchive },
    { path: '/upload', label: 'Tải bài', icon: UploadCloud },
    { path: '/templates', label: 'Mẫu Tạp chí', icon: BookOpen },
    { path: '/settings', label: 'Cài đặt', icon: Settings },
  ];

  const isNavActive = (path: string) => {
    if (path === '/upload' && (pathname === '/' || pathname === '/upload')) return true;
    if (path === '/papers' && (pathname.startsWith('/papers') || pathname === '/history')) return true;
    if (path === '/templates' && pathname.startsWith('/templates')) return true;
    if (path === '/account' && pathname.startsWith('/account')) return true;
    if (path === '/settings' && pathname.startsWith('/settings')) return true;
    return pathname === path;
  };

  return (
    <nav className="sm:hidden fixed bottom-3 left-3 right-3 z-40 pointer-events-none">
      <div className="pointer-events-auto bg-white/85 backdrop-blur-xl border border-white/60 rounded-[32px] px-2 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.12)] flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = isNavActive(tab.path);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className="flex flex-col items-center justify-center flex-1 h-[56px] focus:outline-none transition-all select-none"
            >
              <div
                className={`flex items-center justify-center rounded-full transition-all duration-300 ${
                  isActive
                    ? 'w-11 h-11 bg-[#1A1A1A] text-[#78C841] shadow-md scale-105'
                    : 'w-10 h-10 text-zinc-400 active:scale-95'
                }`}
              >
                <Icon className="w-5 h-5" strokeWidth={2.3} />
              </div>
              <span
                className={`text-[10px] font-bold tracking-tight transition-all duration-200 ${
                  isActive ? 'text-[#1A1A1A] font-extrabold mt-0.5' : 'text-zinc-400'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
