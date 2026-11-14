'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { EditorTabKey } from '../components/types';
import {
  applyScrollTopInstantly,
  createEditorTabStateStore,
  createSmoothTopResetGuard,
  isElementHiddenByCss,
  observeContainerReveal,
  scheduleClampedScrollRetry,
  type EditorTabStateStore,
  type SectionFilterType,
  type SectionsTabViewState,
  type SmoothTopResetGuard,
} from './tab-view-state-store';

export { isElementHiddenByCss };

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect;

const DEFAULT_SECTIONS_STATE: SectionsTabViewState = {
  filterType: 'all',
  scrollOffset: 0,
  measurementsCache: [],
};

export interface EditorTabStateContextValue {
  store: EditorTabStateStore;
  paperId: string;
  markTabPendingReset: (tabKey: EditorTabKey) => void;
}

const EditorTabStateContext = createContext<EditorTabStateContextValue | null>(null);

export interface EditorTabStateProviderProps {
  paperId: string;
  store?: EditorTabStateStore;
  children: React.ReactNode;
}

/**
 * Creates and synchronizes an EditorTabStateStore instance keyed by paperId.
 */
export function useCreateEditorTabStateStore(paperId: string) {
  const storeRef = useRef<EditorTabStateStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createEditorTabStateStore(paperId);
  }
  const store = storeRef.current;

  useIsomorphicLayoutEffect(() => {
    store.syncPaperId(paperId);
  }, [store, paperId]);

  const markTabPendingReset = useCallback(
    (tabKey: EditorTabKey) => {
      store.markTabPendingReset(tabKey);
    },
    [store]
  );

  return { store, markTabPendingReset };
}

export const EditorTabStateProvider: React.FC<EditorTabStateProviderProps> = ({
  paperId,
  store: externalStore,
  children,
}) => {
  const internalStoreRef = useRef<EditorTabStateStore | null>(null);
  if (!externalStore && !internalStoreRef.current) {
    internalStoreRef.current = createEditorTabStateStore(paperId);
  }
  const store = externalStore ?? internalStoreRef.current!;

  useIsomorphicLayoutEffect(() => {
    store.syncPaperId(paperId);
  }, [store, paperId]);

  const markTabPendingReset = useCallback(
    (tabKey: EditorTabKey) => {
      store.markTabPendingReset(tabKey);
    },
    [store]
  );

  const value = useMemo<EditorTabStateContextValue>(
    () => ({
      store,
      paperId,
      markTabPendingReset,
    }),
    [store, paperId, markTabPendingReset]
  );

  return (
    <EditorTabStateContext.Provider value={value}>
      {children}
    </EditorTabStateContext.Provider>
  );
};

export function useEditorTabState(): EditorTabStateContextValue | null {
  return useContext(EditorTabStateContext);
}

export interface UseTabScrollRestorationResult {
  commitScrollTop: (top: number) => void;
}

/**
 * Saves and restores scrollTop for a scrollable editor sub-tab container.
 * Gracefully no-ops when rendered standalone outside EditorTabStateProvider.
 */
export function useTabScrollRestoration(
  tabKey: EditorTabKey,
  containerRef: React.RefObject<HTMLElement | null>
): UseTabScrollRestorationResult {
  const ctx = useContext(EditorTabStateContext);
  const hasScrolledRef = useRef(false);
  const appliedOffsetRef = useRef(0);
  const resetGuardRef = useRef<SmoothTopResetGuard | null>(null);
  if (!resetGuardRef.current) {
    resetGuardRef.current = createSmoothTopResetGuard();
  }
  const resetGuard = resetGuardRef.current;

  const commitScrollTop = useCallback(
    (top: number) => {
      if (!ctx) return;
      const el = containerRef.current;
      if (!el || isElementHiddenByCss(el)) return;
      if (ctx.store.getPaperId() !== ctx.paperId) return;

      const target = Number.isFinite(top) && top > 0 ? top : 0;
      ctx.store.setScrollTop(tabKey, target);
      appliedOffsetRef.current = target;
      hasScrolledRef.current = true;
      if (target === 0) {
        resetGuard.begin(el);
      } else {
        resetGuard.cancel();
      }
    },
    [ctx, tabKey, containerRef, resetGuard]
  );

  useIsomorphicLayoutEffect(() => {
    if (!ctx) return;
    const el = containerRef.current;
    if (!el) return;

    const { store, paperId } = ctx;
    store.syncPaperId(paperId);
    hasScrolledRef.current = false;
    appliedOffsetRef.current = 0;
    resetGuard.cancel();

    let cancelPendingRaf = () => {};
    const applyWithClampRetry = (targetOffset: number) => {
      cancelPendingRaf();
      if (targetOffset <= 0) {
        if (!isElementHiddenByCss(el) && el.scrollTop !== 0) {
          applyScrollTopInstantly(el, 0);
        }
        appliedOffsetRef.current = el.scrollTop;
        return;
      }
      if (isElementHiddenByCss(el)) {
        appliedOffsetRef.current = el.scrollTop;
        return;
      }
      const applied = applyScrollTopInstantly(el, targetOffset);
      appliedOffsetRef.current = applied;
      if (applied < targetOffset - 1) {
        cancelPendingRaf = scheduleClampedScrollRetry(
          el,
          targetOffset,
          () => store.getPaperId() === paperId && !hasScrolledRef.current,
          (nextApplied) => {
            appliedOffsetRef.current = nextApplied;
          }
        );
      }
    };

    if (store.consumeTabPendingReset(tabKey)) {
      applyWithClampRetry(0);
    } else {
      applyWithClampRetry(store.getScrollTop(tabKey, paperId));
    }

    const handleScroll = () => {
      if (store.getPaperId() !== paperId || isElementHiddenByCss(el)) return;
      const nextTop = el.scrollTop;
      if (resetGuard.shouldIgnoreScroll(nextTop)) return;
      // Ignore synthetic/browser scroll echo matching the programmatic initial restore
      if (!hasScrolledRef.current && nextTop === appliedOffsetRef.current) return;
      hasScrolledRef.current = true;
      store.setScrollTop(tabKey, nextTop);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });
    const stopRevealObserver = observeContainerReveal(el, () => {
      if (store.getPaperId() !== paperId) return;
      resetGuard.cancel();
      hasScrolledRef.current = false;
      applyWithClampRetry(store.getScrollTop(tabKey, paperId));
    });

    return () => {
      const currentTop = el.scrollTop;
      const isResettingToTop = resetGuard.isActiveAtTop(currentTop);
      resetGuard.cancel();
      cancelPendingRaf();
      stopRevealObserver();
      el.removeEventListener('scroll', handleScroll);
      if (store.getPaperId() !== paperId || isElementHiddenByCss(el) || isResettingToTop) return;

      const changedSinceRestore = currentTop !== appliedOffsetRef.current;
      if (
        hasScrolledRef.current ||
        (changedSinceRestore && (currentTop > 0 || store.getScrollTop(tabKey, paperId) === 0))
      ) {
        store.setScrollTop(tabKey, currentTop);
      }
    };
  }, [ctx, tabKey, containerRef, resetGuard]);

  return useMemo(() => ({ commitScrollTop }), [commitScrollTop]);
}

export interface UseSectionsTabViewStateResult {
  paperId: string | null;
  peekInitialSectionsState: () => SectionsTabViewState;
  consumeInitialSectionsState: () => SectionsTabViewState;
  consumePendingSectionsReset: () => boolean;
  getSectionsState: () => SectionsTabViewState;
  updateSectionsFilter: (filterType: SectionFilterType) => void;
  subscribeSectionsFilter: (listener: (filterType: SectionFilterType) => void) => () => void;
  saveVirtualSnapshot: (
    snapshot: { scrollOffset: number; measurementsCache?: VirtualItem[] },
    expectedPaperId?: string | null,
    scrollEl?: HTMLElement | null
  ) => void;
}

/**
 * Exposes SectionsTab filter + virtualizer snapshot helpers bound to EditorTabStateProvider.
 * Gracefully returns safe defaults/no-ops when rendered outside the provider.
 */
export function useSectionsTabViewState(): UseSectionsTabViewStateResult {
  const ctx = useContext(EditorTabStateContext);

  useIsomorphicLayoutEffect(() => {
    if (ctx) {
      ctx.store.syncPaperId(ctx.paperId);
    }
  }, [ctx]);

  const peekInitialSectionsState = useCallback((): SectionsTabViewState => {
    if (!ctx || ctx.store.getPaperId() !== ctx.paperId) {
      return { ...DEFAULT_SECTIONS_STATE, measurementsCache: [] };
    }
    if (ctx.store.hasPendingReset('sections', ctx.paperId)) {
      return { ...DEFAULT_SECTIONS_STATE, measurementsCache: [] };
    }
    return ctx.store.getSectionsState(ctx.paperId);
  }, [ctx]);

  const consumeInitialSectionsState = useCallback((): SectionsTabViewState => {
    if (!ctx) return { ...DEFAULT_SECTIONS_STATE, measurementsCache: [] };
    ctx.store.syncPaperId(ctx.paperId);
    ctx.store.consumeTabPendingReset('sections');
    return ctx.store.getSectionsState(ctx.paperId);
  }, [ctx]);

  const consumePendingSectionsReset = useCallback((): boolean => {
    if (!ctx) return false;
    ctx.store.syncPaperId(ctx.paperId);
    return ctx.store.consumeTabPendingReset('sections');
  }, [ctx]);

  const getSectionsState = useCallback((): SectionsTabViewState => {
    if (!ctx || ctx.store.getPaperId() !== ctx.paperId) {
      return { ...DEFAULT_SECTIONS_STATE, measurementsCache: [] };
    }
    return ctx.store.getSectionsState(ctx.paperId);
  }, [ctx]);

  const updateSectionsFilter = useCallback(
    (filterType: SectionFilterType) => {
      if (!ctx) return;
      ctx.store.syncPaperId(ctx.paperId);
      ctx.store.setSectionsState({
        filterType,
        scrollOffset: 0,
        measurementsCache: [],
      });
    },
    [ctx]
  );

  const subscribeSectionsFilter = useCallback(
    (listener: (filterType: SectionFilterType) => void) => {
      if (!ctx) return () => {};
      return ctx.store.subscribeSectionsFilter(listener);
    },
    [ctx]
  );

  const saveVirtualSnapshot = useCallback(
    (
      snapshot: { scrollOffset: number; measurementsCache?: VirtualItem[] },
      expectedPaperId?: string | null,
      scrollEl?: HTMLElement | null
    ) => {
      if (!ctx) return;
      if (
        expectedPaperId !== undefined &&
        expectedPaperId !== null &&
        ctx.store.getPaperId() !== expectedPaperId
      ) {
        return;
      }
      if (scrollEl && isElementHiddenByCss(scrollEl)) return;
      ctx.store.setSectionsState({
        scrollOffset: snapshot.scrollOffset,
        ...(snapshot.measurementsCache !== undefined
          ? { measurementsCache: snapshot.measurementsCache }
          : {}),
      });
    },
    [ctx]
  );

  return useMemo(
    () => ({
      paperId: ctx?.paperId ?? null,
      peekInitialSectionsState,
      consumeInitialSectionsState,
      consumePendingSectionsReset,
      getSectionsState,
      updateSectionsFilter,
      subscribeSectionsFilter,
      saveVirtualSnapshot,
    }),
    [
      ctx?.paperId,
      peekInitialSectionsState,
      consumeInitialSectionsState,
      consumePendingSectionsReset,
      getSectionsState,
      updateSectionsFilter,
      subscribeSectionsFilter,
      saveVirtualSnapshot,
    ]
  );
}
