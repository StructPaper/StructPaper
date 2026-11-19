'use client';

import React from 'react';
import type { ManuscriptRecord } from '@structpaper/doc-model';
import { useJournalBadge } from '../hooks/useJournals';
import { JournalChipShimmer } from './JournalChipShimmer';

const VARIANT_CLASS = {
  /** coloured pill on a card */
  pill: 'px-2.5 py-0.5 rounded-full text-[11px] font-extrabold text-white shadow-2xs',
  /** coloured tile in a confirm dialog */
  tile: 'shrink-0 px-2.5 py-1 rounded-xl text-[10.5px] font-extrabold text-white shadow-2xs',
  /** coloured text in a table cell */
  text: 'font-extrabold text-[11px]',
} as const;

const SHIMMER_CLASS = {
  pill: 'h-5 w-16 rounded-full',
  tile: 'h-6 w-16 rounded-xl shrink-0',
  text: 'h-3.5 w-14 rounded-md',
} as const;

export interface JournalCodeBadgeProps {
  journalId?: string;
  /** The paper record: a journal the server joined onto it is used first. */
  record?: ManuscriptRecord;
  variant?: keyof typeof VARIANT_CLASS;
}

/** The journal code ("VNUHCM-HS") in the journal's colour, read from the server's journal list. */
export const JournalCodeBadge: React.FC<JournalCodeBadgeProps> = ({ journalId, record, variant = 'pill' }) => {
  const badge = useJournalBadge(journalId, record);
  if (badge.isLoading) return <JournalChipShimmer className={SHIMMER_CLASS[variant]} />;
  const style = variant === 'text' ? { color: badge.color } : { backgroundColor: badge.color };
  return (
    <span className={VARIANT_CLASS[variant]} style={style} title={badge.name}>
      {badge.code}
    </span>
  );
};
