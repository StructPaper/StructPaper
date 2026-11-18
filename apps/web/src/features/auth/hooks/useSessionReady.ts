import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@structpaper/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { idleQueryClient, useOptionalQueryClient } from '@/lib/optional-query-client';

/** Whether this browser kept a session from an earlier visit (read from storage, not from the store). */
export const hasStoredSession = (): boolean => {
  try {
    return Boolean(JSON.parse(window.localStorage.getItem('structpaper_auth_storage') || 'null')?.state?.user);
  } catch {
    return false;
  }
};

/**
 * True once the browser's session has been restored. After a reload the access token is only in memory,
 * so a request sent before `/auth/me` settles goes out as a guest (a private paper then looks "not found").
 * A visitor with no stored session has nothing to restore and is ready at once.
 *
 * It is not ready during the first render: while React hydrates, the auth store still shows the state the server
 * rendered (no user), so "no session" would be wrong exactly when the first requests are sent. From the first
 * effect on it reads the browser's storage directly.
 *
 * It watches the same `['auth','me']` query `AuthGuard` runs; this observer never fetches on its own.
 */
export const useSessionReady = (): boolean => {
  const inStore = useAuthStore((state) => Boolean(state.user));
  const client = useOptionalQueryClient();
  const me = useQuery(
    { queryKey: ['auth', 'me'], queryFn: () => authApi.getAccount(), enabled: false },
    client ?? idleQueryClient,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return false;
  const hasSession = inStore || hasStoredSession();
  return !client || !hasSession || me.status !== 'pending';
};
