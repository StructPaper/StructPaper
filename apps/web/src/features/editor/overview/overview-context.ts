'use client';

import { createContext, useContext } from 'react';
import type { CompletePaper } from '@/types/paper';
import type { ResolvedTheme } from '@/lib/theme-config';
import type { OverviewLang } from './overview-doc';
import type { OverviewActions } from './overview-actions';

/** What the blocks of the overview page need to know about the paper around them. */
export interface OverviewCtx {
  paper: CompletePaper;
  lang: OverviewLang;
  theme: ResolvedTheme;
  /** One column for the whole body (the journal's setting). */
  isOneColumn: boolean;
  /** The "how to cite" line. */
  citationText: string;
  /** Takes the author to the form tab that edits something the page only shows (authors, citation). */
  openTab: (tab: string) => void;
  actions: OverviewActions;
}

export const OverviewContext = createContext<OverviewCtx | null>(null);

export function useOverview(): OverviewCtx {
  const ctx = useContext(OverviewContext);
  if (!ctx) throw new Error('OverviewContext is missing');
  return ctx;
}
