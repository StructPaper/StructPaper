'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Sliders, ArrowRight } from 'lucide-react';
import { ManagedJournalProfile } from '@/lib/templates/journal-storage';

interface JournalProfileCardProps {
  managed: ManagedJournalProfile;
  onCreatePaper: (managed: ManagedJournalProfile) => void;
}

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export const JournalProfileCard: React.FC<JournalProfileCardProps> = ({
  managed,
  onCreatePaper,
}) => {
  const router = useRouter();
  const { id, status, profile } = managed;
  const brandColor = profile.color || '#000099';
  const nameVi = profile.names?.vi || 'Tạp chí ĐHQG-HCM';
  const nameEn = profile.names?.en || 'Science and Technology Development Journal';
  const shortCode = profile.names?.short || id.toUpperCase();
  const articleTypesCount = profile.articleTypes?.length || 8;
  const abstractMin = profile.frontMatter?.abstract?.minWords ?? 275;
  const abstractMax = profile.frontMatter?.abstract?.maxWords ?? 500;
  const citationStyle = profile.citation?.style ?? 'vancouver';
  const columns = profile.layout?.columns ?? 2;

  const isPublished = status === 'published';

  return (
    <motion.div
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a')) return;
        router.push(`/templates/journal/${id}`);
      }}
      whileHover={isTest ? undefined : { scale: 1.02 }}
      whileTap={isTest ? undefined : { scale: 0.98 }}
      transition={isTest ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
      className="w-full bg-gray-200/40 border-8 border-gray-200 p-5 rounded-[38px] transition-all duration-300 cursor-pointer flex flex-col justify-between hover:bg-white hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] group select-none min-h-[252px]"
    >
      <div>
        {/* Top Badges matching UploadView */}
        <div className="flex items-center justify-between mb-2.5">
          <span
            className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white shadow-2xs"
            style={{ backgroundColor: brandColor }}
          >
            {shortCode}
          </span>
          <span className="text-[10px] font-extrabold text-[#14532D] bg-[#D9F99D] px-2.5 py-0.5 rounded-full">
            {isPublished ? 'Đang phát hành' : 'Bản nháp'}
          </span>
        </div>

        {/* Bilingual Journal Names */}
        <h4 className="font-bold text-xs sm:text-sm text-[#1A1A1A] line-clamp-2 mb-1 leading-snug">
          {nameVi}
        </h4>
        <p className="text-[11px] text-zinc-500 line-clamp-1 mb-2.5 italic">
          {nameEn}
        </p>

        {/* Specification Stats matching UploadView */}
        <div className="flex items-center gap-2 text-[10px] text-zinc-400 font-semibold mb-2 flex-wrap">
          <span>{articleTypesCount} Loại bài báo</span>
          <span>• Tóm tắt: {abstractMin}-{abstractMax} từ</span>
          <span>• Trích dẫn: <strong className="capitalize font-semibold text-zinc-600">{citationStyle}</strong></span>
          <span>• Bố cục: {columns} cột</span>
        </div>
      </div>

      {/* Action Footer matching UploadView exactly */}
      <div className="mt-3 pt-2.5 border-t border-gray-300/50 flex items-center justify-between text-xs font-bold text-zinc-800">
        <Link
          href={`/templates/journal/${id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 text-zinc-500 hover:text-zinc-900 font-semibold transition-colors"
          title="Tùy chỉnh thông số tạp chí"
        >
          <Sliders className="w-3.5 h-3.5 text-zinc-400" />
          <span>Tùy chỉnh</span>
        </Link>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onCreatePaper(managed);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 hover:text-zinc-950 transition-colors cursor-pointer"
        >
          <span>Tạo bài báo từ mẫu</span>
          <ArrowRight className="w-3.5 h-3.5 text-[#78C841]" />
        </button>
      </div>
    </motion.div>
  );
};
