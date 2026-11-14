'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setAccessToken, setRefreshTokenGetter, setOnTokenRefreshed } from '@structpaper/api-client';

export interface AuthUser {
  id: string;
  email: string;
  displayName?: string | null;
  status: 'ACTIVE' | 'INVITED' | 'SUSPENDED';
  roles?: string[];
  permissionsVersion?: number;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setLogin: (token: string, user: AuthUser, refreshToken?: string | null) => void;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      setLogin: (token: string, user: AuthUser, refreshToken?: string | null) => {
        setAccessToken(token);
        set({ token, refreshToken: refreshToken || null, user, isAuthenticated: true });
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('auth_expired');
        }
      },
      setUser: (user: AuthUser | null) => set({ user, isAuthenticated: !!user }),
      setToken: (token: string | null) => {
        setAccessToken(token);
        set({ token, isAuthenticated: !!token });
      },
      logout: () => {
        setAccessToken(null);
        set({ token: null, refreshToken: null, user: null, isAuthenticated: false });
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('auth_expired');
          window.location.href = '/login';
        }
      },
    }),
    {
      name: 'structpaper_auth_storage',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : ({} as any))),
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          setAccessToken(state.token);
          useAuthStore.setState({ isAuthenticated: true });
        }
      },
    },
  ),
);

// Register token refresh delegate with api-client
if (typeof window !== 'undefined') {
  setRefreshTokenGetter(() => useAuthStore.getState().refreshToken);
  setOnTokenRefreshed((newToken) => useAuthStore.getState().setToken(newToken));
}
