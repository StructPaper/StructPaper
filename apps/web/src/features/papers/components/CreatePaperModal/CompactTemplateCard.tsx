'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, BookOpen } from 'lucide-react';
import { ManagedJournalProfile } from '@/lib/templates/journal-storage';

interface CompactTemplateCardProps {
  managed: ManagedJournalProfile;
  isSelected?: boolean;
  onSelect: (managed: ManagedJournalProfile) => void;
}

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

export const CompactTemplateCard: React.FC<CompactTemplateCardProps> = ({
  managed,
  isSelected = false,
  onSelect,
}) => {
  const { id, profile } = managed;
  const brandColor = profile.color || '#000099';
  const nameVi = profile.names?.vi || 'Tạp chí ĐHQG-HCM';
  const shortCode = profile.names?.short || id.toUpperCase();

  return (
    <motion.div
      data-testid={`compact-template-${id}`}
      onClick={() => onSelect(managed)}
      whileHover={isTest ? undefined : { scale: 1.015 }}
      whileTap={isTest ? undefined : { scale: 0.985 }}
      transition={isTest ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
      className={`w-full text-left p-3.5 sm:p-4 rounded-[24px] sm:rounded-[26px] transition-all duration-200 cursor-pointer flex flex-col justify-between relative overflow-hidden select-none group min-h-[92px] ${
        isSelected
          ? 'bg-white ring-4 ring-blue-300 shadow-[0_8px_30px_rgba(120,200,65,0.18)]'
          : 'bg-gray-200/60 hover:bg-white hover:border-gray-300 hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)]'
      }`}
    >

      {/* Top Badges row */}
      <div className="flex items-center justify-between mb-2 relative z-10">
        <span
          className="px-2.5 py-0.5 rounded-full text-[10.5px] font-black text-white shadow-2xs"
          style={{ backgroundColor: brandColor }}
        >
          {shortCode}
        </span>

        {isSelected && (
          <span
            data-testid={`selected-tick-${id}`}
            className="w-5 h-5 rounded-full bg-[#78C841] text-zinc-950 flex items-center justify-center shadow-xs"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </span>
        )}
      </div>

      {/* Template Name (Only the template name on card as requested) */}
      <h4 className="font-bold text-xs sm:text-[13px] text-[#1A1A1A] line-clamp-2 leading-snug group-hover:text-black relative z-10">
        {nameVi}
      </h4>
    </motion.div>
  );
};
