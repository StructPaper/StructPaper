import { useMemo } from 'react';
import type { LayoutSettings } from '@/types/paper';

/** What a section without its own page layout follows (document layout settings); stable while unchanged. */
export function usePageLayoutDefaults(settings?: LayoutSettings) {
  const oneColumn = settings?.columnLayout === '1-column';
  const landscape = settings?.orientation === 'landscape';
  return useMemo(() => ({ oneColumn, landscape }), [oneColumn, landscape]);
}
