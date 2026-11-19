'use client';

import { useTrackNavigation } from '@/lib/app-history';

/** Remembers the pages visited in this tab so "back" buttons can go back one page (see lib/app-history). */
export function NavigationTracker() {
  useTrackNavigation();
  return null;
}
