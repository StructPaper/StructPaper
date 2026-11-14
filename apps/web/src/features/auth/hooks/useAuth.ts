import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authApi, setAccessToken } from '@structpaper/api-client';
import { useAuthStore, AuthUser } from '@/lib/auth-store';

export interface UseAuthOptions {
  enabled?: boolean;
}

function extractUser(data: any): AuthUser | null {
  if (!data) return null;
  if (data.user && typeof data.user === 'object') return data.user as AuthUser;
  if (data.data?.user && typeof data.data.user === 'object') return data.data.user as AuthUser;
  if (data.id && (data.email || data.displayName)) return data as AuthUser;
  return null;
}

function extractToken(data: any): string | null {
  if (!data) return null;
  return data.accessToken || data.token || data.data?.accessToken || data.data?.token || null;
}

export const useAuth = (options?: UseAuthOptions) => {
  const { user: storeUser, setUser, clearAuth } = useAuthStore();

  const { data, isLoading, error, isError, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const res = await authApi.getAccount();
      return res;
    },
    enabled: options?.enabled ?? true,
    // Don't retry if it's an auth error (handled by interceptor)
    retry: (failureCount, err: any) => {
      const status = err?.status ?? err?.statusCode ?? err?.response?.status;
      if (status === 401) return false;
      return failureCount < 1;
    },
    // Stale time: User profile doesn't change often, keep for 5 mins
    staleTime: 5 * 60 * 1000,
    // Refetch on window focus to ensure checking session
    refetchOnWindowFocus: true,
  });

  // Sync with global store and api-client
  useEffect(() => {
    if (data) {
      const user = extractUser(data);
      if (user) {
        setUser(user);

        // When session data is returned, sync token if present, and call setAccessToken
        const sessionToken = extractToken(data) || useAuthStore.getState().token;
        if (sessionToken) {
          setAccessToken(sessionToken);
        }
      }
    } else if (isError) {
      const status =
        (error as any)?.status ??
        (error as any)?.statusCode ??
        (error as any)?.response?.status;

      if (status === 401) {
        clearAuth();
        if (typeof window !== 'undefined') {
          const isLoginPage = window.location.pathname.startsWith('/login');
          if (!isLoginPage) {
            window.localStorage.setItem('auth_expired', 'true');
            try {
              window.location.href = '/login';
            } catch {
              // Safe navigation fallback in non-browser/test environments
            }
          }
        }
      }
    }
  }, [data, isError, error, setUser, clearAuth]);

  const currentUser = extractUser(data) ?? storeUser ?? null;
  const isAuthenticated = Boolean(currentUser);

  return {
    user: currentUser,
    isAuthenticated,
    isLoading,
    isError,
    error,
    refetch,
  };
};
