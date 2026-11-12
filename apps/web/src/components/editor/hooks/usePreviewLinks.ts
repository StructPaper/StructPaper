'use client';

import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { CompletePaper, PaperSection } from '@/types/paper';
import { assignEquationNumbers } from '@/lib/validation/numbering';
import type { EditorTabKey } from '../types';
import { usePageLayoutDefaults } from './usePageLayoutDefaults';

interface PreviewLinksOptions {
  formData: CompletePaper;
  setFormData: Dispatch<SetStateAction<CompletePaper>>;
  setIsDirty: (dirty: boolean) => void;
  setActiveSubTab: (tab: EditorTabKey) => void;
  recompile: (paper: CompletePaper) => void;
}

/**
 * What ties the PDF preview to the editor: a click in the PDF opens the matching card in the content tab, and
 * turning a page in the preview changes the page-layout markers and recompiles so the result shows at once.
 */
export function usePreviewLinks({ formData, setFormData, setIsDirty, setActiveSubTab, recompile }: PreviewLinksOptions) {
  const layoutDefaults = usePageLayoutDefaults(formData.layoutSettings);
  const [focusRequest, setFocusRequest] = useState<{ id: string; n: number } | null>(null);

  const onFocusSection = useCallback(
    (id: string) => {
      setActiveSubTab('sections');
      setFocusRequest((r) => ({ id, n: (r?.n ?? 0) + 1 }));
    },
    [setActiveSubTab]
  );

  const onSectionsChange = useCallback(
    (sections: PaperSection[]) => {
      const next = { ...formData, sections: assignEquationNumbers(sections) };
      setFormData(next);
      setIsDirty(true);
      recompile(next);
    },
    [formData, setFormData, setIsDirty, recompile]
  );

  return { focusRequest, paneProps: { onFocusSection, onFocusTab: setActiveSubTab, onSectionsChange, layoutDefaults } };
}
