'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CompletePaper } from '@/lib/sample-papers';
import { computePreflightCheck } from '@/lib/docx-extractor';
import { PreflightCheck, normalizeCompletePaper, createEmptyPaper } from '@/types/paper';

interface PaperContextType {
  paper: CompletePaper;
  setPaper: (paper: CompletePaper) => void;
  updatePaper: (paper: CompletePaper) => void;
  currentJournal: string;
  setCurrentJournal: (journalId: string) => void;
  preflight: PreflightCheck;
}

const PaperContext = createContext<PaperContextType | undefined>(undefined);

export function PaperProvider({ children }: { children: React.ReactNode }) {
  const [paper, setPaperState] = useState<CompletePaper>(() =>
    normalizeCompletePaper(createEmptyPaper('VNUHCM-HS'))
  );
  const [currentJournal, setCurrentJournalState] = useState<string>('VNUHCM-HS');

  // Restore state from sessionStorage if available with automatic multi-tier table normalization
  useEffect(() => {
    try {
      const savedPaper = sessionStorage.getItem('structpaper_current_paper');
      if (savedPaper) {
        const parsed = JSON.parse(savedPaper);
        const normalized = normalizeCompletePaper(parsed);
        setPaperState(normalized);
        sessionStorage.setItem('structpaper_current_paper', JSON.stringify(normalized));
      }
      const savedJournal = sessionStorage.getItem('structpaper_current_journal');
      if (savedJournal) {
        setCurrentJournalState(savedJournal);
      }
    } catch {}
  }, []);

  // The setters must keep their identity across renders: effects list them as dependencies
  // (e.g. the /papers/[id] page loads a paper by id), and a changing identity re-runs them forever.
  const setPaper = useCallback((newPaper: CompletePaper) => {
    const normalized = normalizeCompletePaper(newPaper);
    setPaperState(normalized);
    try {
      sessionStorage.setItem('structpaper_current_paper', JSON.stringify(normalized));
    } catch {}
  }, []);

  const updatePaper = useCallback((updated: CompletePaper) => {
    setPaper(updated);
  }, [setPaper]);

  const setCurrentJournal = useCallback((journalId: string) => {
    setCurrentJournalState(journalId);
    try {
      sessionStorage.setItem('structpaper_current_journal', journalId);
    } catch {}
    setPaperState((prev) => {
      const next = normalizeCompletePaper({
        ...prev,
        metadata: {
          ...prev.metadata,
          journalId,
        },
      });
      try {
        sessionStorage.setItem('structpaper_current_paper', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const preflight = computePreflightCheck(paper);

  return (
    <PaperContext.Provider
      value={{
        paper,
        setPaper,
        updatePaper,
        currentJournal,
        setCurrentJournal,
        preflight,
      }}
    >
      {children}
    </PaperContext.Provider>
  );
}

export function usePaper() {
  const context = useContext(PaperContext);
  if (!context) {
    return {
      paper: normalizeCompletePaper(createEmptyPaper('VNUHCM-STD')),
      setPaper: (p: CompletePaper) => {
        try {
          sessionStorage.setItem('structpaper_current_paper', JSON.stringify(p));
        } catch {}
      },
      updatePaper: () => {},
      currentJournal: 'VNUHCM-STD',
      setCurrentJournal: (j: string) => {
        try {
          sessionStorage.setItem('structpaper_current_journal', j);
        } catch {}
      },
      preflight: computePreflightCheck(normalizeCompletePaper(createEmptyPaper('VNUHCM-STD'))),
    };
  }
  return context;
}
