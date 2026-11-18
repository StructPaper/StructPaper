'use client';

import { useState, useCallback, useEffect, useLayoutEffect } from 'react';
import type { RefObject } from 'react';

const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const POPOVER_GAP = 6; // px between the trigger and the popover
const VIEWPORT_MARGIN = 12; // px kept free at the screen edge
export const LIST_MAX_HEIGHT = 240; // px, same as the previous max-h-60
export const SEARCH_BOX_HEIGHT = 52; // px

export interface PopoverPlacement {
  /** true = the popover opens above the trigger */
  openUp: boolean;
  /** Maximum height available on the chosen side */
  maxHeight: number;
  left: number;
  width: number;
  top?: number;
  bottom?: number;
}


export interface UseDropdownPlacementOptions {
  isOpen: boolean;
  triggerRef: RefObject<HTMLElement>;
  align: 'left' | 'right';
  optionCount: number;
  searchable: boolean;
}

/**
 * The popover is rendered in a portal with fixed coordinates, so no scroll container or
 * `overflow-hidden` ancestor (e.g. a modal) can clip it. Smart placement: it opens downwards
 * unless it does not fit there AND there is more room above, in which case it flips upwards.
 * Its height is capped to the room available on the chosen side, and it keeps following the
 * trigger while the page scrolls or resizes.
 */
export function useDropdownPlacement({
  isOpen,
  triggerRef,
  align,
  optionCount,
  searchable,
}: UseDropdownPlacementOptions): PopoverPlacement | null {
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);

  const updatePlacement = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger || typeof window === 'undefined') return;

    const rect = trigger.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const searchHeight = searchable ? SEARCH_BOX_HEIGHT : 0;

    const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_MARGIN - POPOVER_GAP;
    const spaceAbove = rect.top - VIEWPORT_MARGIN - POPOVER_GAP;
    const wantedHeight = Math.min(Math.max(optionCount, 1) * 40 + 8, LIST_MAX_HEIGHT) + searchHeight;

    const openUp = spaceBelow < wantedHeight && spaceAbove > spaceBelow;
    const available = Math.max(openUp ? spaceAbove : spaceBelow, 96);

    const width = Math.max(rect.width, 180);
    let left = align === 'right' ? rect.right - width : rect.left;
    left = Math.min(Math.max(left, 8), Math.max(viewportWidth - width - 8, 8));

    const next: PopoverPlacement = {
      openUp,
      maxHeight: Math.min(available, LIST_MAX_HEIGHT + searchHeight),
      left,
      width,
      top: openUp ? undefined : rect.bottom + POPOVER_GAP,
      bottom: openUp ? viewportHeight - rect.top + POPOVER_GAP : undefined,
    };

    setPlacement((prev) =>
      prev &&
      prev.openUp === next.openUp &&
      prev.maxHeight === next.maxHeight &&
      prev.left === next.left &&
      prev.width === next.width &&
      prev.top === next.top &&
      prev.bottom === next.bottom
        ? prev
        : next,
    );
  }, [triggerRef, align, optionCount, searchable]);

  // Place before paint, and keep following the trigger
  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;
    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
    };
  }, [isOpen, updatePlacement]);

  return placement;
}
