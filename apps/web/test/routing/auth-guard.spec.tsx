// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const nav = vi.hoisted(() => ({ replace: vi.fn(), pathname: '/papers' }));
const authHook = vi.hoisted(() => ({ useAuth: vi.fn() }));

vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ replace: nav.replace, push: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/features/auth', () => ({ useAuth: authHook.useAuth }));

import { AuthGuard } from '@/components/layout/AuthGuard';
import { useAuthStore } from '@/lib/auth-store';

describe('AuthGuard ((authenticate) layout)', () => {
  beforeEach(() => {
    nav.replace.mockReset();
    authHook.useAuth.mockReset();
    nav.pathname = '/papers';
    window.localStorage.clear();
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('hydrates the session once (useAuth) and renders the page', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c' }, isAuthenticated: true } as any);

    render(
      <AuthGuard>
        <div>secret page</div>
      </AuthGuard>,
    );

    expect(authHook.useAuth).toHaveBeenCalled();
    expect(screen.getByText('secret page')).toBeDefined();
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('sends a visitor without a session to /login and remembers the page they wanted', () => {
    nav.pathname = '/permissions';

    render(
      <AuthGuard>
        <div>secret page</div>
      </AuthGuard>,
    );

    expect(nav.replace).toHaveBeenCalledWith('/login?redirect=%2Fpermissions');
  });

  it('accepts a persisted session even before the store has hydrated', () => {
    window.localStorage.setItem(
      'structpaper_auth_storage',
      JSON.stringify({ state: { user: { id: 'u1', email: 'a@b.c' } } }),
    );

    render(
      <AuthGuard>
        <div>secret page</div>
      </AuthGuard>,
    );

    expect(nav.replace).not.toHaveBeenCalled();
  });
});
