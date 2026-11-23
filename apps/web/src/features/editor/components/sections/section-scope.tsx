'use client';

import { createContext, useContext } from 'react';
import type { SectionScope } from '@/lib/appendix';

/** Which list of blocks the cards below belong to: the text of the paper, or its appendices (where only tables and figures can be added). */
export const SectionScopeContext = createContext<SectionScope>('content');
export const useSectionScope = (): SectionScope => useContext(SectionScopeContext);
