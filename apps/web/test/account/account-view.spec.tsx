// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next/navigation', () => ({
  usePathname: () => '/account',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { authApi } from '@structpaper/api-client';
import { AccountView } from '@/features/account';
import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAuthStore } from '@/lib/auth-store';

const PROFILE = {
  id: '6b48e092-fe6d-460e-a1d9-e901295eee14',
  email: 'admin@structpaper.org',
  displayName: 'System SuperAdmin',
  avatarUrl: null,
  status: 'ACTIVE',
  permissionsVersion: 5,
  createdAt: '2026-11-01T08:30:00.000Z',
  updatedAt: '2026-11-17T09:45:00.000Z',
  roles: [
    { roleName: 'SuperAdmin', scopeJournalId: null, scopeJournalName: null },
    { roleName: 'Editor', scopeJournalId: 'j-std', scopeJournalName: 'Tạp chí Phát triển KH&CN' },
  ],
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Account page', () => {
  const logoutFromStore = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    logoutFromStore.mockReset();
    useAuthStore.setState({ logout: logoutFromStore } as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the shimmer while the profile is loading (no text placeholder)', () => {
    vi.spyOn(authApi, 'getAccount').mockReturnValue(new Promise(() => {}) as any);

    renderWithClient(<AccountView />);

    expect(screen.getByTestId('account-loading')).toBeDefined();
    expect(screen.queryByTestId('account-profile')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Tài khoản' })).toBeDefined();
  });

  it('renders the REAL profile: name, email, status, roles with journal scope, version and dates', async () => {
    vi.spyOn(authApi, 'getAccount').mockResolvedValue(PROFILE as any);

    renderWithClient(<AccountView />);

    const profile = await screen.findByTestId('account-profile');
    expect(profile.textContent).toContain('System SuperAdmin');
    expect(profile.textContent).toContain('admin@structpaper.org');
    expect(profile.textContent).toContain('ACTIVE');
    expect(profile.textContent).toContain('v5');

    const roles = screen.getAllByTestId('account-role').map((el) => el.textContent);
    expect(roles).toEqual(['SuperAdmin· Toàn hệ thống', 'Editor· Tạp chí Phát triển KH&CN']);

    // no leftover mock person from the old static page
    expect(screen.queryByText(/Nguyễn Hoàng Nam/)).toBeNull();
    expect(screen.queryByText(/ORCID/i)).toBeNull();
  });

  it('shows an error with a working retry when the profile can not be loaded', async () => {
    const getAccount = vi
      .spyOn(authApi, 'getAccount')
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(PROFILE as any);

    renderWithClient(<AccountView />);

    await screen.findByTestId('account-error');
    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));

    await screen.findByTestId('account-profile');
    expect(getAccount).toHaveBeenCalledTimes(2);
  });

  describe('logout lives here (and needs a second click to confirm)', () => {
    it('the first click only arms the button; nothing is logged out yet', async () => {
      vi.spyOn(authApi, 'getAccount').mockResolvedValue(PROFILE as any);
      const logout = vi.spyOn(authApi, 'logout').mockResolvedValue({ success: true } as any);
      renderWithClient(<AccountView />);
      const button = await screen.findByTestId('logout-button');

      fireEvent.click(button);

      expect(button.textContent).toMatch(/bấm lần nữa/i);
      expect(logout).not.toHaveBeenCalled();
      expect(logoutFromStore).not.toHaveBeenCalled();
    });

    it('the second click ends the session on the server and clears the local session', async () => {
      vi.spyOn(authApi, 'getAccount').mockResolvedValue(PROFILE as any);
      const logout = vi.spyOn(authApi, 'logout').mockResolvedValue({ success: true } as any);
      renderWithClient(<AccountView />);
      const button = await screen.findByTestId('logout-button');

      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => {
        expect(logout).toHaveBeenCalledTimes(1);
        expect(logoutFromStore).toHaveBeenCalledTimes(1);
      });
    });

    it('still clears the local session when the server can not be reached', async () => {
      vi.spyOn(authApi, 'getAccount').mockResolvedValue(PROFILE as any);
      vi.spyOn(authApi, 'logout').mockRejectedValue(new Error('offline'));
      renderWithClient(<AccountView />);
      const button = await screen.findByTestId('logout-button');

      fireEvent.click(button);
      fireEvent.click(button);

      await waitFor(() => expect(logoutFromStore).toHaveBeenCalledTimes(1));
    });
  });
});

describe('Dock: the account icon replaces logout', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: { id: 'u1', email: 'admin@structpaper.org', displayName: 'System SuperAdmin' } } as any);
  });

  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null } as any);
  });

  it('desktop dock links to /account and has NO logout button', () => {
    render(<Sidebar />);

    const accountLinks = screen.getAllByRole('link').filter((a) => a.getAttribute('href') === '/account');
    expect(accountLinks.length).toBeGreaterThan(0);
    expect(screen.queryByText(/đăng xuất/i)).toBeNull();
    expect(screen.queryByTitle(/đăng xuất/i)).toBeNull();
  });

  it('the dock never shows a made-up person when the user is unknown', () => {
    useAuthStore.setState({ user: null } as any);
    render(<Sidebar />);

    expect(screen.queryByText(/Nguyễn Hoàng Nam/)).toBeNull();
    expect(screen.queryByText(/nam\.nh@/)).toBeNull();
  });

  it('mobile bottom navigation has an account tab', () => {
    render(<BottomNav />);

    const tab = screen.getAllByRole('link').find((a) => a.getAttribute('href') === '/account');
    expect(tab?.textContent).toContain('Tài khoản');
  });
});
