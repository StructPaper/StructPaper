'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { setAccessToken } from '@structpaper/api-client';

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
  isAuthenticated: boolean;
  setLogin: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;
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
      logout: () => {
        setAccessToken(null);
        set({ token: null, user: null, isAuthenticated: false });
        if (typeof window !== 'undefined') {
          window.localStorage.removeItem('auth_expired');
          window.location.href = '/login';
        }
      },
    }),
    {
      name: 'structpaper_auth_storage',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : ({} as any))),
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
