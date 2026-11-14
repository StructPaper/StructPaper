import type { PaperSection } from '@/types/paper';
import type { SectionFilterType } from '@/features/editor';

/** Which sections the content tab shows for a filter chip (citations are never listed). */
export function matchesSectionFilter(sec: PaperSection, filter: SectionFilterType): boolean {
  if (sec.type === 'citation') return false;
  switch (filter) {
    case 'heading':
      return sec.type === 'h1' || sec.type === 'h2' || sec.type === 'h3';
    case 'paragraph':
      return sec.type === 'paragraph';
    case 'table':
      return sec.type === 'table';
    case 'figure':
      return sec.type === 'figure';
    case 'equation':
      return sec.type === 'equation';
    default:
      return true;
  }
}
