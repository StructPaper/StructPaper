import { useEffect, useRef } from 'react';
import type { CompletePaper } from '@/types/paper';

/**
 * A different paper was opened: show a copy of it. Not on mount, where the editor's copy already exists;
 * a second copy would look like an edit and trigger a needless save.
 */
export function useShowPaperOnSwitch(paper: CompletePaper, show: (copy: CompletePaper) => void, markClean: () => void): void {
  const shown = useRef(paper.id);
  const latest = useRef({ paper, show, markClean });
  latest.current = { paper, show, markClean };
  useEffect(() => {
    if (shown.current === paper.id) return;
    shown.current = paper.id;
    latest.current.show(JSON.parse(JSON.stringify(latest.current.paper)));
    latest.current.markClean();
  }, [paper.id]);
}
