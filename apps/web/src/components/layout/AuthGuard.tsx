'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { useAuth } from '@/features/auth';
import { isMockModeEnabled } from '@structpaper/api-client';

/**
 * Wraps every page of the `(authenticate)` route group:
 *  - hydrates the session (loads the current user, redirects to /login when the session is gone);
 *  - sends visitors without a session to /login, remembering where they wanted to go.
 *
 * Pages in the `(public)` group (login, activate, invite) are NOT wrapped, so they never trigger
 * a session check and are reachable without being logged in.
 */
export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();

  useAuth();

  useEffect(() => {
    const redirectToLogin = () => {
      if (!isMockModeEnabled()) {
        router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
    };

    const checkAuth = () => {
      try {
        const { isAuthenticated, user } = useAuthStore.getState();
        let hasAuth = Boolean(isAuthenticated || user);

        if (!hasAuth && typeof window !== 'undefined') {
          const raw = window.localStorage.getItem('structpaper_auth_storage');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.state?.user) {
              hasAuth = true;
            }
          }
        }

        if (!hasAuth) redirectToLogin();
      } catch {
        redirectToLogin();
      }
    };

    checkAuth();

    if (useAuthStore.persist?.hasHydrated?.()) {
      checkAuth();
    } else if (useAuthStore.persist?.onFinishHydration) {
      const unsub = useAuthStore.persist?.onFinishHydration?.(() => {
        checkAuth();
      });
      return () => unsub?.();
    }
  }, [pathname, router]);

  return <>{children}</>;
};
