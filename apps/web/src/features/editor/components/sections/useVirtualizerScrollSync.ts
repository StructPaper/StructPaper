'use client';

import React, { useRef, useLayoutEffect, useEffect, useCallback, useMemo } from 'react';
import type { Virtualizer, VirtualItem } from '@tanstack/react-virtual';
import {
  applyScrollTopInstantly,
  createSmoothTopResetGuard,
  isElementHiddenByCss,
  observeContainerReveal,
  scheduleClampedScrollRetry,
  type SmoothTopResetGuard,
} from '../../hooks/tab-view-state-store';

const useIsomorphicLayoutEffect =
  typeof document !== 'undefined' ? useLayoutEffect : useEffect;

export interface SectionVirtualizerSnapshot {
  scrollOffset: number;
  measurementsCache?: VirtualItem[];
}

export interface VirtualizerScrollSyncRefs {
  hasScrolledRef: React.MutableRefObject<boolean>;
  appliedOffsetRef: React.MutableRefObject<number>;
  latestScrollTopRef: React.MutableRefObject<number>;
  resetGuard: SmoothTopResetGuard;
  notifyScrollResetToTop: () => void;
}

export interface UseVirtualizerScrollCaptureOptions {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  virtualizerRef: React.MutableRefObject<Virtualizer<HTMLDivElement, HTMLDivElement> | null>;
  initialOffset: number;
  paperId: string | null;
  getSavedScrollOffset?: () => number;
  onSaveSnapshot?: (
    snapshot: SectionVirtualizerSnapshot,
    paperId?: string | null,
    scrollEl?: HTMLElement | null
  ) => void;
}

/**
 * Attaches passive scroll tracking and persists virtualizer snapshot on unmount.
 * MUST be invoked BEFORE `useVirtualizer(...)` so unmount cleanup runs while
 * `scrollContainerRef.current` and `virtualizer.takeSnapshot()` are both active.
 */
export function useVirtualizerScrollCapture({
  scrollContainerRef,
  virtualizerRef,
  initialOffset,
  paperId,
  getSavedScrollOffset,
  onSaveSnapshot,
}: UseVirtualizerScrollCaptureOptions): VirtualizerScrollSyncRefs {
  const hasScrolledRef = useRef(false);
  const appliedOffsetRef = useRef(0);
  const latestScrollTopRef = useRef(initialOffset > 0 ? initialOffset : 0);
  const resetGuardRef = useRef<SmoothTopResetGuard | null>(null);
  if (!resetGuardRef.current) {
    resetGuardRef.current = createSmoothTopResetGuard();
  }
  const resetGuard = resetGuardRef.current;

  const paperIdRef = useRef(paperId);
  paperIdRef.current = paperId;
  const onSaveSnapshotRef = useRef(onSaveSnapshot);
  onSaveSnapshotRef.current = onSaveSnapshot;
  const getSavedScrollOffsetRef = useRef(getSavedScrollOffset);
  getSavedScrollOffsetRef.current = getSavedScrollOffset;

  const notifyScrollResetToTop = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el || isElementHiddenByCss(el)) return;
    appliedOffsetRef.current = 0;
    hasScrolledRef.current = true;
    latestScrollTopRef.current = 0;
    resetGuard.begin(el);

    const v = virtualizerRef.current;
    onSaveSnapshotRef.current?.(
      {
        scrollOffset: 0,
        ...(v ? { measurementsCache: v.takeSnapshot() } : {}),
      },
      paperIdRef.current,
      el
    );
  }, [scrollContainerRef, virtualizerRef, resetGuard]);

  useIsomorphicLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    hasScrolledRef.current = false;
    resetGuard.cancel();
    const currentPaperId = paperId ?? null;

    const handleScroll = () => {
      if (isElementHiddenByCss(el)) return;
      const nextTop = el.scrollTop;
      if (resetGuard.shouldIgnoreScroll(nextTop)) return;
      if (!hasScrolledRef.current && nextTop === appliedOffsetRef.current) return;
      hasScrolledRef.current = true;
      latestScrollTopRef.current = nextTop;
      onSaveSnapshotRef.current?.({ scrollOffset: nextTop }, currentPaperId, el);
    };

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      const currentTop = el.scrollTop;
      const isResettingToTop = resetGuard.isActiveAtTop(currentTop);
      resetGuard.cancel();
      el.removeEventListener('scroll', handleScroll);
      if (isElementHiddenByCss(el)) return;

      const v = virtualizerRef.current;
      const saveFn = onSaveSnapshotRef.current;
      if (!v || !saveFn) return;

      if (isResettingToTop) {
        saveFn({ scrollOffset: 0, measurementsCache: v.takeSnapshot() }, currentPaperId, el);
        return;
      }

      const savedTop = getSavedScrollOffsetRef.current?.() ?? 0;
      const changedSinceRestore = currentTop !== appliedOffsetRef.current;
      const shouldPersist =
        hasScrolledRef.current ||
        (changedSinceRestore && (currentTop > 0 || savedTop === 0));

      if (!shouldPersist) return;

      saveFn({ scrollOffset: currentTop, measurementsCache: v.takeSnapshot() }, currentPaperId, el);
    };
  }, [scrollContainerRef, virtualizerRef, paperId, resetGuard]);

  return useMemo(
    () => ({
      hasScrolledRef,
      appliedOffsetRef,
      latestScrollTopRef,
      resetGuard,
      notifyScrollResetToTop,
    }),
    [resetGuard, notifyScrollResetToTop]
  );
}

export interface UseVirtualizerScrollRestoreOptions {
  virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  syncRefs: VirtualizerScrollSyncRefs;
  initialOffset: number;
  filterKey?: string;
  paperId: string | null;
  getSavedScrollOffset?: () => number;
}

/**
 * Restores initial DOM `scrollTop` (with a clamped-only rAF guard), syncs visibility transitions,
 * and resets scroll on active filter or paperId changes. MUST be invoked AFTER `useVirtualizer(...)`
 * so `<div style={{ height: totalSize }}>` is committed in DOM first.
 */
export function useVirtualizerScrollRestore({
  virtualizer,
  scrollContainerRef,
  syncRefs,
  initialOffset,
  filterKey,
  paperId,
  getSavedScrollOffset,
}: UseVirtualizerScrollRestoreOptions): void {
  const { hasScrolledRef, appliedOffsetRef, latestScrollTopRef, resetGuard } = syncRefs;
  const prevFilterKeyRef = useRef(filterKey);
  const prevPaperIdRef = useRef(paperId);
  const getSavedScrollOffsetRef = useRef(getSavedScrollOffset);
  getSavedScrollOffsetRef.current = getSavedScrollOffset;

  useIsomorphicLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const isPaperChange = prevPaperIdRef.current !== paperId;
    const isFilterChange = !isPaperChange && prevFilterKeyRef.current !== filterKey;

    prevFilterKeyRef.current = filterKey;
    prevPaperIdRef.current = paperId;

    if (isFilterChange) {
      hasScrolledRef.current = false;
      appliedOffsetRef.current = 0;
      latestScrollTopRef.current = 0;
      resetGuard.cancel();
      if (!isElementHiddenByCss(el)) {
        virtualizer.scrollToOffset(0);
        if (el.scrollTop !== 0) {
          applyScrollTopInstantly(el, 0);
        }
      }
      return;
    }

    const targetOffset = isPaperChange ? 0 : initialOffset;
    let cancelPendingRaf = () => {};

    if (targetOffset > 0 && !isElementHiddenByCss(el)) {
      const applied = applyScrollTopInstantly(el, targetOffset);
      appliedOffsetRef.current = applied;
      latestScrollTopRef.current = targetOffset;
      if (applied < targetOffset - 1) {
        cancelPendingRaf = scheduleClampedScrollRetry(
          el,
          targetOffset,
          () => !hasScrolledRef.current,
          (nextApplied) => {
            appliedOffsetRef.current = nextApplied;
          }
        );
      }
    } else {
      if (isPaperChange) {
        hasScrolledRef.current = false;
        latestScrollTopRef.current = 0;
        resetGuard.cancel();
        virtualizer.measure();
        if (!isElementHiddenByCss(el)) {
          virtualizer.scrollToOffset(0);
          if (el.scrollTop !== 0) {
            applyScrollTopInstantly(el, 0);
          }
        }
      }
      appliedOffsetRef.current = el.scrollTop;
    }

    return () => {
      cancelPendingRaf();
    };
  }, [
    virtualizer,
    scrollContainerRef,
    hasScrolledRef,
    appliedOffsetRef,
    latestScrollTopRef,
    resetGuard,
    initialOffset,
    filterKey,
    paperId,
  ]);

  useIsomorphicLayoutEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    let cancelRoRaf = () => {};

    const stopRevealObserver = observeContainerReveal(el, () => {
      resetGuard.cancel();
      const savedOffset = getSavedScrollOffsetRef.current?.() ?? 0;
      const applied = applyScrollTopInstantly(el, savedOffset);
      appliedOffsetRef.current = applied;
      latestScrollTopRef.current = savedOffset;
      hasScrolledRef.current = false;
      cancelRoRaf();
      if (savedOffset > 0 && applied < savedOffset - 1) {
        cancelRoRaf = scheduleClampedScrollRetry(
          el,
          savedOffset,
          () => !hasScrolledRef.current,
          (nextApplied) => {
            appliedOffsetRef.current = nextApplied;
          }
        );
      }
    });

    return () => {
      cancelRoRaf();
      stopRevealObserver();
    };
  }, [
    scrollContainerRef,
    hasScrolledRef,
    appliedOffsetRef,
    latestScrollTopRef,
    resetGuard,
    paperId,
  ]);
}
