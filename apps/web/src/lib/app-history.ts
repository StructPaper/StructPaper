'use client';

import { useCallback, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Which pages of the app the user walked through in this tab, so a "back" button can really go back one page when there is
 * a page of the app behind it, and otherwise (opened by link, reload, new tab) go to a sensible fallback instead of leaving
 * the app. Kept in sessionStorage so a reload keeps it.
 */
const KEY = 'sp:nav-stack';
const MAX = 50;

/**
 * The stack after arriving at `path`. A browser back/forward (`popped`) removes the page the user left; any other arrival (a
 * link, router.push) adds one. Only a real back counts as going back: a link that happens to lead to the previous page is a
 * new entry in the browser's history, so one more back would not land where the stack says.
 */
export function nextStack(stack: string[], path: string, popped = false): string[] {
  if (stack[stack.length - 1] === path) return stack;
  if (popped) {
    const rest = stack.slice(0, -1);
    return rest[rest.length - 1] === path ? rest : [...rest, path].slice(-MAX);
  }
  return [...stack, path].slice(-MAX);
}

/** The page behind the current one, or null when there is none inside the app. */
export function pageBehind(stack: string[]): string | null {
  return stack.length >= 2 ? stack[stack.length - 2] : null;
}

const read = (): string[] => {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === 'string') : [];
  } catch {
    return [];
  }
};

const write = (stack: string[]) => {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(stack));
  } catch {
    // private mode: back just falls back to the default page
  }
};

/** Mounted once for the signed-in part of the app. */
export function useTrackNavigation() {
  const pathname = usePathname();
  const popped = useRef(false);

  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    write(nextStack(read(), pathname, popped.current));
    popped.current = false;
  }, [pathname]);
}

/**
 * `goBack(fallback)` goes back exactly one page when a page of the app is behind this one; otherwise it goes to `fallback`.
 * `avoid` skips a page that would only bounce the user around (for example the history page the editor was opened from).
 */
export function useGoBack() {
  const router = useRouter();
  return useCallback(
    (fallback: string, avoid?: (behind: string) => boolean) => {
      const behind = typeof window === 'undefined' ? null : pageBehind(read());
      if (behind && !(avoid && avoid(behind))) router.back();
      else router.push(fallback);
    },
    [router],
  );
}

/** The history page of a paper: the editor's back button must not return there (the history page's own back leads to the editor). */
export const isHistoryPage = (path: string): boolean => path.endsWith('/history');
