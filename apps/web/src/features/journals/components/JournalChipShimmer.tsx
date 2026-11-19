'use client';

import React from 'react';
import { Shimmer } from '@/components/ui/Shimmer';

/** Placeholder for a journal chip ("● VNUHCM-HS") while the journal list is loading. */
export const JournalChipShimmer: React.FC<{ className?: string }> = ({ className = 'h-4 w-16 rounded-full' }) => (
  <Shimmer className={className} />
);
