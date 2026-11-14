'use client';

import React from 'react';
import { JournalProfile } from '@structpaper/journal-profiles';
import { JournalStatus } from '@/lib/templates/journal-storage';

interface JournalEditorTopBarProps {
  profile: JournalProfile;
  status: JournalStatus;
  isNew?: boolean;
}

export const JournalEditorTopBar: React.FC<JournalEditorTopBarProps> = ({
  profile,
  status,
  isNew = false,
}) => {
  const brandColor = profile.color || '#000099';
  const nameVi = profile.names?.vi || (isNew ? 'Hồ sơ Tạp chí Mới' : 'Tạp chí');
  const nameEn = profile.names?.en || 'Academic Scientific Journal';
  const shortCode = profile.names?.short || profile.id?.toUpperCase() || 'JOURNAL';

  return (
    <div className="w-full flex flex-col gap-0 pb-2 border-b border-zinc-200/80 px-0.5">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-tight">
          {nameVi}
        </h1>
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white shadow-2xs tracking-wide shrink-0"
          style={{ backgroundColor: brandColor }}
        >
          {shortCode}
        </span>
      </div>
      <p className="text-[11px] text-slate-600 font-semibold not-italic truncate">
        {nameEn}
      </p>
    </div>
  );
};
