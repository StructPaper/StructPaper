'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUnsavedChangesWarning } from '@/features/editor/hooks/useUnsavedChangesWarning';
import { useGoBack } from '@/lib/app-history';

/** A click that stays inside the app and leaves this page: the only kind worth stopping. */
function internalHrefOf(event: MouseEvent): string | null {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null;
  const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (!anchor || (anchor.target && anchor.target !== '_self') || anchor.hasAttribute('download')) return null;
  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return null;
  const here = window.location;
  if (url.pathname === here.pathname && url.search === here.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Stops the author from walking away from edits that were not saved. The browser asks when the tab closes or reloads; a
 * link or button that would navigate inside the app opens the app's own dialog instead (`isOpen`), and the author either
 * stays or leaves without saving.
 */
export function useUnsavedNavigationGuard(isDirty: boolean) {
  const router = useRouter();
  const goBack = useGoBack();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  // a pending "back" button (as opposed to a link): leaving goes back one page, or to the fallback
  const pendingBack = useRef(false);
  const dirty = useRef(isDirty);
  dirty.current = isDirty;

  useUnsavedChangesWarning(isDirty);

  useEffect(() => {
    if (!isDirty) return;
    const onClick = (event: MouseEvent) => {
      if (!dirty.current) return;
      const href = internalHrefOf(event);
      if (!href) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingHref(href);
    };
    // capture phase: before the router's own link handling
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [isDirty]);

  /** For buttons that navigate in code: go now when nothing is unsaved, else ask. */
  const guardedPush = useCallback(
    (href: string) => {
      if (dirty.current) setPendingHref(href);
      else router.push(href);
    },
    [router],
  );

  /** For the back button: one page back when there is one in the app, else `fallback`; asks first when something is unsaved. */
  const guardedBack = useCallback(
    (fallback: string) => {
      if (dirty.current) {
        pendingBack.current = true;
        setPendingHref(fallback);
      } else goBack(fallback);
    },
    [goBack],
  );

  const stay = useCallback(() => {
    pendingBack.current = false;
    setPendingHref(null);
  }, []);
  const leave = useCallback(() => {
    const href = pendingHref;
    setPendingHref(null);
    // the edits are being thrown away on purpose: do not ask again on the way out
    dirty.current = false;
    const back = pendingBack.current;
    pendingBack.current = false;
    if (href) {
      if (back) goBack(href);
      else router.push(href);
    }
  }, [pendingHref, router, goBack]);

  return { isOpen: pendingHref !== null, stay, leave, guardedPush, guardedBack };
}
