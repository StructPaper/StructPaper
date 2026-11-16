'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setAccessToken, setOnTokenRefreshed } from '@structpaper/api-client';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  status?: 'ACTIVE' | 'INVITED' | 'SUSPENDED' | string;
  roles?: string[];
  permissionsVersion?: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  setLogin: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  clearAuth: () => void;
  logout: () => void;
}

// Clean any stale legacy token/refreshToken from localStorage on startup (Eatzy standard)
if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem('structpaper_auth_storage');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.state?.token || parsed?.state?.refreshToken) {
        delete parsed.state.token;
        delete parsed.state.refreshToken;
        window.localStorage.setItem('structpaper_auth_storage', JSON.stringify(parsed));
      }
    }
  } catch {}
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      setLogin: (token: string, user: AuthUser) => {
        setAccessToken(token);
        set({ token, user, isAuthenticated: true });
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('auth_expired');
        }
      },
      setUser: (user: AuthUser | null) => set({ user, isAuthenticated: !!user }),
      setToken: (token: string | null) => {
        setAccessToken(token);
        set({ token, isAuthenticated: !!token });
      },
      clearAuth: () => {
        setAccessToken(null);
        set({ token: null, user: null, isAuthenticated: false });
      },
      logout: () => {
        setAccessToken(null);
        set({ token: null, user: null, isAuthenticated: false });
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('auth_expired');
          try {
            window.location.href = '/login';
          } catch {
            // safe navigation fallback in non-browser/test environments
          }
        }
      },
    }),
    {
      name: 'structpaper_auth_storage',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : ({} as any))),
      // SECURITY (Eatzy pattern): Only persist user info, NEVER persist tokens in localStorage
      partialize: (state) => ({
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          useAuthStore.setState({ isAuthenticated: true });
        }
      },
    },
  ),
);

// Register token refresh delegate with api-client
setOnTokenRefreshed((newToken) => useAuthStore.getState().setToken(newToken));

// Ensure store syncs cleanly: when token changes, update setAccessToken in api-client
useAuthStore.subscribe((state, prevState) => {
  if (state.token !== prevState.token) {
    setAccessToken(state.token);
  }
});
