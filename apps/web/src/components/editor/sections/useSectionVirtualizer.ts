'use client';

import React, { useRef, useCallback } from 'react';
import {
  useVirtualizer,
  observeElementRect,
  observeElementOffset,
  elementScroll,
  measureElement as defaultMeasureElement,
  type Virtualizer,
  type VirtualItem,
  type Rect,
} from '@tanstack/react-virtual';
import type { PaperSection } from '@/types/paper';
import { isElementHiddenByCss } from '../hooks/EditorTabStateContext';
import {
  useVirtualizerScrollCapture,
  useVirtualizerScrollRestore,
  type SectionVirtualizerSnapshot,
} from './useVirtualizerScrollSync';

export type { SectionVirtualizerSnapshot };

export interface VirtualizableSectionItem {
  sec: PaperSection;
  secId: string;
}

export interface UseSectionVirtualizerOptions<T extends VirtualizableSectionItem> {
  items: T[];
  scrollContainerRef?: React.RefObject<HTMLDivElement>;
  initialOffset?: number;
  initialMeasurementsCache?: VirtualItem[];
  filterKey?: string;
  paperId?: string | null;
  getSavedScrollOffset?: () => number;
  onSaveSnapshot?: (
    snapshot: SectionVirtualizerSnapshot,
    paperId?: string | null,
    scrollEl?: HTMLElement | null
  ) => void;
}

export interface UseSectionVirtualizerResult {
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  virtualizer: Virtualizer<HTMLDivElement, HTMLDivElement>;
  virtualItems: VirtualItem[];
  totalSize: number;
  scrollToSectionId: (id: string) => boolean;
  notifyScrollResetToTop: () => void;
}

const DEFAULT_VIEWPORT_WIDTH = 800;
const DEFAULT_VIEWPORT_HEIGHT = 900;

/**
 * Estimates the vertical pixel height of a paper section card by type
 * so @tanstack/react-virtual maintains smooth scroll offsets before dynamic measurement.
 */
export function estimateSectionHeight(sec?: PaperSection): number {
  if (!sec) return 180;
  switch (sec.type) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'citation':
      return 120;
    case 'paragraph':
      return 180;
    case 'table':
      return 260;
    case 'equation':
      return 220;
    case 'figure':
      return 300;
    default:
      return 180;
  }
}

export function getSectionId(sec: PaperSection, index: number): string {
  return sec.id || `sec_${index}`;
}

export function useSectionVirtualizer<T extends VirtualizableSectionItem>({
  items,
  scrollContainerRef: externalScrollContainerRef,
  initialOffset = 0,
  initialMeasurementsCache,
  filterKey,
  paperId = null,
  getSavedScrollOffset,
  onSaveSnapshot,
}: UseSectionVirtualizerOptions<T>): UseSectionVirtualizerResult {
  const internalScrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = externalScrollContainerRef ?? internalScrollContainerRef;
  const itemsRef = useRef<T[]>(items);
  itemsRef.current = items;

  const offsetObserverCbRef = useRef<
    ((offset: number, isScrolling: boolean) => void) | null
  >(null);
  const patchedVirtualizersRef = useRef<WeakSet<object>>(new WeakSet());
  const virtualizerRef = useRef<Virtualizer<HTMLDivElement, HTMLDivElement> | null>(null);

  // Invoked BEFORE useVirtualizer so unmount cleanup runs while scrollContainerRef and takeSnapshot() are active.
  const syncRefs = useVirtualizerScrollCapture({
    scrollContainerRef,
    virtualizerRef,
    initialOffset,
    paperId,
    getSavedScrollOffset,
    onSaveSnapshot,
  });

  const getScrollElement = useCallback(
    () => scrollContainerRef.current,
    [scrollContainerRef]
  );

  const estimateSize = useCallback(
    (index: number) => estimateSectionHeight(itemsRef.current[index]?.sec),
    []
  );

  const getItemKey = useCallback(
    (index: number) => itemsRef.current[index]?.secId ?? `sec-idx-${index}`,
    []
  );

  const observeElementRectWithGuard = useCallback(
    (
      instance: Virtualizer<HTMLDivElement, HTMLDivElement>,
      cb: (rect: Rect) => void
    ) => {
      return observeElementRect(instance, (rect) => {
        cb(
          rect.height > 0
            ? rect
            : {
                width: rect.width || DEFAULT_VIEWPORT_WIDTH,
                height: DEFAULT_VIEWPORT_HEIGHT,
              }
        );
      });
    },
    []
  );

  const observeElementOffsetWithHeadlessSupport = useCallback(
    (
      instance: Virtualizer<HTMLDivElement, HTMLDivElement>,
      cb: (offset: number, isScrolling: boolean) => void
    ) => {
      offsetObserverCbRef.current = cb;
      const unsub = observeElementOffset(instance, cb);
      return () => {
        if (offsetObserverCbRef.current === cb) {
          offsetObserverCbRef.current = null;
        }
        unsub?.();
      };
    },
    []
  );

  const scrollToFnWithHeadlessSupport = useCallback(
    (
      offset: number,
      options: { adjustments?: number; behavior?: 'auto' | 'smooth' | 'instant' },
      instance: Virtualizer<HTMLDivElement, HTMLDivElement>
    ) => {
      const el = instance.scrollElement;
      if (el && isElementHiddenByCss(el)) return;
      elementScroll(offset, options, instance);
      // In headless happy-dom (no CSS layout), clientHeight is 0 and scrollTo does not emit scroll events.
      if (el && el.clientHeight === 0 && !isElementHiddenByCss(el) && offsetObserverCbRef.current) {
        const clamped = Math.max(0, offset);
        el.scrollTop = clamped;
        offsetObserverCbRef.current(clamped, false);
      }
    },
    []
  );

  const measureElementWithZeroGuard = useCallback(
    (
      element: HTMLDivElement,
      entry: ResizeObserverEntry | undefined,
      instance: Virtualizer<HTMLDivElement, HTMLDivElement>
    ) => {
      const measured = defaultMeasureElement(element, entry, instance);
      if (measured > 0) return measured;
      const scrollEl = instance.scrollElement;
      // Fallback to cached/estimated size only before parent ref attaches or in zero-height headless/hidden containers
      if (!scrollEl || scrollEl.clientHeight === 0) {
        const index = instance.indexFromElement(element);
        const key = instance.options.getItemKey(index);
        return instance.itemSizeCache.get(key) ?? instance.options.estimateSize(index);
      }
      return measured;
    },
    []
  );

  const virtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: items.length,
    getScrollElement,
    estimateSize,
    overscan: 5,
    initialRect: { width: DEFAULT_VIEWPORT_WIDTH, height: DEFAULT_VIEWPORT_HEIGHT },
    initialOffset: initialOffset > 0 ? initialOffset : 0,
    initialMeasurementsCache:
      initialMeasurementsCache && initialMeasurementsCache.length > 0
        ? initialMeasurementsCache
        : undefined,
    getItemKey,
    observeElementRect: observeElementRectWithGuard,
    observeElementOffset: observeElementOffsetWithHeadlessSupport,
    scrollToFn: scrollToFnWithHeadlessSupport,
    measureElement: measureElementWithZeroGuard,
  });
  virtualizerRef.current = virtualizer;

  // In headless happy-dom where scrollHeight === 0 && clientHeight === 0, prevent
  // getMaxScrollOffset() from clamping scrollToIndex targets down to 0.
  if (!patchedVirtualizersRef.current.has(virtualizer)) {
    patchedVirtualizersRef.current.add(virtualizer);
    const internal = virtualizer as unknown as {
      getMaxScrollOffset: () => number;
    };
    const baseGetMaxScrollOffset = internal.getMaxScrollOffset;
    internal.getMaxScrollOffset = () => {
      const el = virtualizer.scrollElement;
      if (el && el.clientHeight === 0 && el.scrollHeight === 0) {
        const viewportHeight =
          virtualizer.scrollRect?.height ||
          virtualizer.options.initialRect?.height ||
          DEFAULT_VIEWPORT_HEIGHT;
        return Math.max(virtualizer.getTotalSize() - viewportHeight, 0);
      }
      return baseGetMaxScrollOffset();
    };
  }

  // Invoked AFTER useVirtualizer so <div style={{ height: totalSize }}> is rendered in DOM.
  useVirtualizerScrollRestore({
    virtualizer,
    scrollContainerRef,
    syncRefs,
    initialOffset,
    filterKey,
    paperId,
    getSavedScrollOffset,
  });

  const scrollToSectionId = useCallback(
    (id: string): boolean => {
      const index = itemsRef.current.findIndex(
        (item) => item.secId === id || item.sec.id === id
      );
      if (index === -1) return false;
      virtualizer.scrollToIndex(index, { align: 'center', behavior: 'auto' });
      return true;
    },
    [virtualizer]
  );

  return {
    scrollContainerRef,
    virtualizer,
    virtualItems: virtualizer.getVirtualItems(),
    totalSize: virtualizer.getTotalSize(),
    scrollToSectionId,
    notifyScrollResetToTop: syncRefs.notifyScrollResetToTop,
  };
}
