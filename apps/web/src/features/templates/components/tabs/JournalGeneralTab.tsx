'use client';

import React from 'react';
import { JournalProfile } from '@structpaper/journal-profiles';
import { VNUHCM_COLOR_PALETTE } from '@/lib/templates/journal-storage';
import { Palette, Globe, BookMarked, Check } from 'lucide-react';

interface JournalGeneralTabProps {
  profile: JournalProfile;
  onChange: (updated: Partial<JournalProfile>) => void;
  isNew?: boolean;
}

export const JournalGeneralTab: React.FC<JournalGeneralTabProps> = ({
  profile,
  onChange,
  isNew,
}) => {
  const brandColor = profile.color || '#000099';
  const names = profile.names || { vi: '', en: '', short: '' };

  const handleNameChange = (field: 'vi' | 'en' | 'short', val: string) => {
    onChange({
      names: {
        ...names,
        [field]: val,
      },
    });
  };

  return (
    <div className="space-y-5 w-full">
      {/* 1. Basic Identifiers */}
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <BookMarked className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-md text-zinc-900">
            Tên &amp; Mã Tạp chí
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Tên tiếng Việt <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={names.vi}
              onChange={(e) => handleNameChange('vi', e.target.value)}
              placeholder="VD: Tạp chí Phát triển KH&CN - Khoa học Sức khỏe"
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Tên tiếng Anh (International Name) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={names.en}
              onChange={(e) => handleNameChange('en', e.target.value)}
              placeholder="VD: Science & Technology Development Journal - Health Sciences"
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Mã viết tắt (Short Code) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={names.short}
              onChange={(e) => handleNameChange('short', e.target.value)}
              placeholder="VD: VNUHCM-HS hoặc STDJ-HS"
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-900 focus:bg-white focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/20 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Mã định danh hệ thống (Profile ID)
            </label>
            <input
              type="text"
              disabled={!isNew}
              value={profile.id}
              onChange={(e) => isNew && onChange({ id: e.target.value.toLowerCase().trim() })}
              placeholder="VD: hs hoặc ees"
              className="w-full bg-zinc-100 disabled:opacity-70 border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono text-zinc-600 outline-none"
            />
            {!isNew && (
              <span className="text-[10px] text-zinc-400 mt-1 block">
                Mã định danh hệ thống cố định cho các tạp chí chuẩn ĐHQG.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Brand Palette & Color Swatch with HERO PREVIEW AT TOP */}
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <Palette className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-md text-zinc-900">
            Màu Sắc Nhận Diện Thương Hiệu
          </h3>
        </div>

        {/* HERO PREVIEW BLOCK AT TOP */}
        <div className="p-4 rounded-[36px] bg-gray-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-14 h-14 rounded-3xl shadow-sm border-2 border-white shrink-0 transition-all duration-300 flex items-center justify-center text-white"
              style={{ backgroundColor: brandColor }}
            >
              <Check className="w-6 h-6 drop-shadow-sm" strokeWidth={3} />
            </div>
            <div>
              <span className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider block">
                Màu thương hiệu đang áp dụng:
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono font-black text-base text-zinc-900 uppercase">
                  {brandColor}
                </span>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white"
                  style={{ backgroundColor: brandColor }}
                >
                  {names.short || 'BRAND'}
                </span>
              </div>
            </div>
          </div>

          {/* Direct Picker and Hex input */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-600">Chọn tùy biến:</span>
            <div className="flex items-center gap-1.5 p-1 bg-white border border-zinc-200 rounded-xl shadow-2xs">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => onChange({ color: e.target.value })}
                className="w-7 h-7 rounded-full cursor-pointer border-0 p-0 bg-transparent"
                title="Bấm để chọn màu"
              />
              <input
                type="text"
                value={brandColor}
                onChange={(e) => onChange({ color: e.target.value })}
                placeholder="#000099"
                className="w-20 px-1.5 py-0.5 text-xs font-mono font-extrabold text-zinc-800 outline-none uppercase"
              />
            </div>
          </div>
        </div>

        {/* Standard Palette Grid */}
        <div className="space-y-2 pt-1">
          <label className="block text-xs font-bold text-zinc-700">
            Bảng màu chuẩn 7 Tạp chí ĐHQG TP.HCM:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {VNUHCM_COLOR_PALETTE.map((pal) => {
              const isSelected = brandColor.toLowerCase() === pal.hex.toLowerCase();
              return (
                <button
                  key={pal.id}
                  type="button"
                  onClick={() => onChange({ color: pal.hex })}
                  className={`p-2.5 rounded-2xl flex flex-col items-center gap-1.5 transition-all cursor-pointer outline-none ${
                    isSelected
                      ? 'bg-white ring-4 ring-blue-300 shadow-sm scale-102 outline-none'
                      : 'hover:border-zinc-300 bg-zinc-50/60'
                  }`}
                >
                  <span
                    className="w-7 h-7 rounded-xl shadow-2xs border border-white flex items-center justify-center text-white"
                    style={{ backgroundColor: pal.hex }}
                  >
                    {isSelected && <Check className="w-4 h-4" strokeWidth={3} />}
                  </span>
                  <span className="text-[11px] font-bold text-zinc-800 text-center leading-tight truncate w-full">
                    {pal.id.toUpperCase()}
                  </span>
                  <span className="text-[9.5px] font-mono text-zinc-400">
                    {pal.hex}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Supported Languages */}
      <div className="p-5 space-y-4 pb-16">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <Globe className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-mds text-zinc-900">
            Ngôn Ngữ Bài Viết Chấp Nhận
          </h3>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-700">
            <input
              type="checkbox"
              checked={profile.languages?.includes('vi')}
              onChange={(e) => {
                const current = profile.languages || ['vi', 'en'];
                const next = e.target.checked
                  ? Array.from(new Set([...current, 'vi']))
                  : current.filter((l) => l !== 'vi');
                onChange({ languages: next as ('vi' | 'en')[] });
              }}
              className="rounded text-[#78C841] focus:ring-[#78C841]"
            />
            <span>Tiếng Việt (vi)</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-700">
            <input
              type="checkbox"
              checked={profile.languages?.includes('en')}
              onChange={(e) => {
                const current = profile.languages || ['vi', 'en'];
                const next = e.target.checked
                  ? Array.from(new Set([...current, 'en']))
                  : current.filter((l) => l !== 'en');
                onChange({ languages: next as ('vi' | 'en')[] });
              }}
              className="rounded text-[#78C841] focus:ring-[#78C841]"
            />
            <span>Tiếng Anh (en)</span>
          </label>
        </div>
      </div>
    </div>
  );
};
