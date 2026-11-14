import type { VirtualItem } from '@tanstack/react-virtual';
import type { EditorTabKey } from '../components/types';

export type SectionFilterType = 'all' | 'heading' | 'paragraph' | 'table' | 'figure' | 'equation';

export interface SectionsTabViewState {
  filterType: SectionFilterType;
  scrollOffset: number;
  measurementsCache: VirtualItem[];
}

export interface TabScrollSnapshot {
  scrollTop: number;
}

export interface EditorTabStateStore {
  getPaperId: () => string;
  syncPaperId: (nextPaperId: string) => void;
  getScrollTop: (tabKey: EditorTabKey, expectedPaperId?: string) => number;
  setScrollTop: (tabKey: EditorTabKey, scrollTop: number) => void;
  getSectionsState: (expectedPaperId?: string) => SectionsTabViewState;
  setSectionsState: (partial: Partial<SectionsTabViewState>) => void;
  subscribeSectionsFilter: (listener: (filterType: SectionFilterType) => void) => () => void;
  markTabPendingReset: (tabKey: EditorTabKey) => void;
  hasPendingReset: (tabKey: EditorTabKey, expectedPaperId?: string) => boolean;
  consumeTabPendingReset: (tabKey: EditorTabKey) => boolean;
}

function createDefaultSectionsState(): SectionsTabViewState {
  return {
    filterType: 'all',
    scrollOffset: 0,
    measurementsCache: [],
  };
}

function normalizeOffset(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value;
}

/**
 * Checks whether an element or any ancestor up to document.body is hidden via CSS `display: none`.
 * Safe in SSR or environments without `window.getComputedStyle`.
 */
export function isElementHiddenByCss(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (typeof window === 'undefined' || typeof window.getComputedStyle !== 'function') {
    return false;
  }

  let cur: HTMLElement | null = el;
  while (cur) {
    if (cur.style?.display === 'none') return true;
    try {
      if (window.getComputedStyle(cur).display === 'none') return true;
    } catch {
      return false;
    }
    if (typeof document !== 'undefined' && cur === document.body) break;
    cur = cur.parentElement;
  }
  return false;
}

/**
 * Programmatically applies `scrollTop` without smooth-scroll animation interference
 * (e.g. Tailwind `.scroll-smooth` on ReferencesTab) and returns the resulting `scrollTop`.
 */
export function applyScrollTopInstantly(el: HTMLElement, top: number): number {
  const target = normalizeOffset(top);
  const prevBehavior = el.style.scrollBehavior;
  el.style.scrollBehavior = 'auto';
  try {
    el.scrollTop = target;
    if (Math.abs(el.scrollTop - target) > 1 && typeof el.scrollTo === 'function') {
      try {
        el.scrollTo({ top: target, behavior: 'instant' as ScrollBehavior });
      } catch {
        el.scrollTop = target;
      }
    }
    return el.scrollTop;
  } finally {
    el.style.scrollBehavior = prevBehavior;
  }
}

/**
 * Schedules a single requestAnimationFrame retry only when initial restore was clamped.
 */
export function scheduleClampedScrollRetry(
  el: HTMLElement,
  targetOffset: number,
  shouldContinue: () => boolean,
  onApplied: (applied: number) => void
): () => void {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    return () => {};
  }
  let rafId: number | null = window.requestAnimationFrame(() => {
    rafId = null;
    if (!shouldContinue()) return;
    if (!isElementHiddenByCss(el) && Math.abs(el.scrollTop - targetOffset) > 1) {
      onApplied(applyScrollTopInstantly(el, targetOffset));
    }
  });
  return () => {
    if (rafId !== null && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  };
}

/**
 * Observes a scrollable container and invokes `onReveal` on `hidden -> visible` transitions.
 */
export function observeContainerReveal(el: HTMLElement, onReveal: () => void): () => void {
  if (typeof ResizeObserver === 'undefined') return () => {};
  let wasHidden = isElementHiddenByCss(el);
  const ro = new ResizeObserver(() => {
    if (isElementHiddenByCss(el)) {
      wasHidden = true;
      return;
    }
    if (wasHidden && el.clientHeight > 0) {
      wasHidden = false;
      onReveal();
    }
  });
  ro.observe(el);
  return () => {
    ro.disconnect();
  };
}

export interface SmoothTopResetGuard {
  begin: (el: HTMLElement) => void;
  cancel: () => void;
  shouldIgnoreScroll: (nextTop: number) => boolean;
  isActiveAtTop: (currentTop: number) => boolean;
}

export function createSmoothTopResetGuard(): SmoothTopResetGuard {
  let active = false;
  let lastTop = 0;
  let timerId: number | null = null;

  const cancel = () => {
    active = false;
    lastTop = 0;
    if (timerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(timerId);
      timerId = null;
    }
  };

  return {
    begin: (el: HTMLElement) => {
      cancel();
      if (el.scrollTop > 1) {
        active = true;
        lastTop = el.scrollTop;
        if (typeof window !== 'undefined') {
          timerId = window.setTimeout(() => {
            timerId = null;
            if (el.scrollTop <= 1) {
              active = false;
              lastTop = 0;
            }
          }, 0);
        }
      }
    },
    cancel,
    shouldIgnoreScroll: (nextTop: number) => {
      if (!active) return false;
      if (nextTop <= 1 || nextTop > lastTop + 1) {
        cancel();
        return false;
      }
      lastTop = nextTop;
      return true;
    },
    isActiveAtTop: (currentTop: number) => active && currentTop <= lastTop + 1,
  };
}

/**
 * Framework-agnostic in-memory store for editor sub-tab scroll positions
 * and SectionsTab filter/virtualizer state, isolated per paperId.
 */
export function createEditorTabStateStore(initialPaperId: string): EditorTabStateStore {
  let currentPaperId = initialPaperId;
  const scrollTops = new Map<EditorTabKey, number>();
  let sectionsState: SectionsTabViewState = createDefaultSectionsState();
  const pendingResets = new Set<EditorTabKey>();
  const sectionsFilterListeners = new Set<(filterType: SectionFilterType) => void>();

  const notifySectionsFilter = (nextFilter: SectionFilterType) => {
    Array.from(sectionsFilterListeners).forEach((listener) => {
      listener(nextFilter);
    });
  };

  return {
    getPaperId: () => currentPaperId,

    syncPaperId: (nextPaperId: string) => {
      if (nextPaperId === currentPaperId) return;
      const prevFilter = sectionsState.filterType;
      currentPaperId = nextPaperId;
      scrollTops.clear();
      sectionsState = createDefaultSectionsState();
      pendingResets.clear();
      if (prevFilter !== 'all') {
        notifySectionsFilter('all');
      }
    },

    getScrollTop: (tabKey: EditorTabKey, expectedPaperId?: string) => {
      if (expectedPaperId !== undefined && expectedPaperId !== currentPaperId) {
        return 0;
      }
      return scrollTops.get(tabKey) ?? 0;
    },

    setScrollTop: (tabKey: EditorTabKey, scrollTop: number) => {
      scrollTops.set(tabKey, normalizeOffset(scrollTop));
    },

    getSectionsState: (expectedPaperId?: string) => {
      if (expectedPaperId !== undefined && expectedPaperId !== currentPaperId) {
        return createDefaultSectionsState();
      }
      return {
        filterType: sectionsState.filterType,
        scrollOffset: sectionsState.scrollOffset,
        measurementsCache: [...sectionsState.measurementsCache],
      };
    },

    setSectionsState: (partial: Partial<SectionsTabViewState>) => {
      const prevFilter = sectionsState.filterType;
      if (partial.filterType !== undefined) {
        sectionsState.filterType = partial.filterType;
      }
      if (partial.scrollOffset !== undefined) {
        sectionsState.scrollOffset = normalizeOffset(partial.scrollOffset);
      }
      if (partial.measurementsCache !== undefined) {
        sectionsState.measurementsCache = [...partial.measurementsCache];
      }
      if (sectionsState.filterType !== prevFilter) {
        notifySectionsFilter(sectionsState.filterType);
      }
    },

    subscribeSectionsFilter: (listener: (filterType: SectionFilterType) => void) => {
      sectionsFilterListeners.add(listener);
      return () => {
        sectionsFilterListeners.delete(listener);
      };
    },

    markTabPendingReset: (tabKey: EditorTabKey) => {
      pendingResets.add(tabKey);
    },

    hasPendingReset: (tabKey: EditorTabKey, expectedPaperId?: string) => {
      if (expectedPaperId !== undefined && expectedPaperId !== currentPaperId) {
        return false;
      }
      return pendingResets.has(tabKey);
    },

    consumeTabPendingReset: (tabKey: EditorTabKey) => {
      if (!pendingResets.has(tabKey)) return false;
      pendingResets.delete(tabKey);
      scrollTops.set(tabKey, 0);
      if (tabKey === 'sections') {
        const prevFilter = sectionsState.filterType;
        sectionsState = createDefaultSectionsState();
        if (prevFilter !== 'all') {
          notifySectionsFilter('all');
        }
      }
      return true;
    },
  };
}
