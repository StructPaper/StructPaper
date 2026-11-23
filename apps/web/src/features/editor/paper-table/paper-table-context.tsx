'use client';

import React, { createContext, useContext } from 'react';
import type { CompletePaper, LayoutSettings } from '@/types/paper';

/** What the paper view of a table needs to know of the paper it is in: the running head, the page numbers, the theme, the paper size, the columns. */
export interface PaperTableContextValue {
  paper: CompletePaper;
  layout: LayoutSettings;
  lang: 'vi' | 'en';
}

const PaperTableContext = createContext<PaperTableContextValue | null>(null);

export const PaperTableProvider: React.FC<{ value: PaperTableContextValue | null; children: React.ReactNode }> = ({ value, children }) => (
  <PaperTableContext.Provider value={value}>{children}</PaperTableContext.Provider>
);

/** null outside an editor that provides it (the paper view of a table is then not offered). */
export const usePaperTableContext = (): PaperTableContextValue | null => useContext(PaperTableContext);
