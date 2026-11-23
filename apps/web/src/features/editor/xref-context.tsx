'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { CompletePaper, PaperReference } from '@/types/paper';
import { crossRefTargets, type RefTarget } from '@/lib/cross-refs';

/** The tables and figures of the paper a text can point at, for every editor of it (the form and the overview page alike). */
interface XrefValue {
  targets: RefTarget[];
  lang: 'vi' | 'en';
  /** The references of the paper (what a citation can point at). */
  references: PaperReference[];
  /** How many footnotes stand before each section: the PDF letters them a, b, c… down the whole paper. */
  noteOffsets: Record<string, number>;
}

const Ctx = createContext<XrefValue>({ targets: [], lang: 'vi', references: [], noteOffsets: {} });

export const XrefProvider: React.FC<{ paper: Pick<CompletePaper, 'sections'> & Partial<Pick<CompletePaper, 'references'>>; lang: 'vi' | 'en'; children: React.ReactNode }> = ({ paper, lang, children }) => {
  const value = useMemo(() => {
    const noteOffsets: Record<string, number> = {};
    let seen = 0;
    for (const s of paper.sections) {
      noteOffsets[s.id] = seen;
      const text = [s.title, s.content, s.table?.caption, s.table?.source, s.figure?.caption, s.figure?.source].filter(Boolean).join('\n');
      seen += (text.match(/\[\[fn:/g) ?? []).length;
    }
    return { targets: crossRefTargets(paper), lang, references: paper.references ?? [], noteOffsets };
  }, [paper.sections, paper.references, lang]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useXrefTargets = (): XrefValue => useContext(Ctx);
