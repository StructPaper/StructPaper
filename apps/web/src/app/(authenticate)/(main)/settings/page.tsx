'use client';

import React from 'react';
import { Settings } from 'lucide-react';
import { Slot } from '@/platform';

export default function SettingsPage() {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-16 px-4 sm:px-6 pt-2">
      {/* 1. Header Minimalist matching Templates & Papers Page */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#78C841]" strokeWidth={3} />
            <span>Cài Đặt Hệ Thống</span>
          </h1>
        </div>
      </div>

      {/* 2. App Distribution Slot (Web: DownloadDesktopCard; Desktop: CheckForUpdateCard) */}
      <Slot id="app-distribution" />
    </div>
  );
}
