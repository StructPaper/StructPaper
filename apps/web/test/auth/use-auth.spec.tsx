// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, cleanup, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/lib/auth-store';
import { authApi, getAccessToken, setAccessToken } from '@structpaper/api-client';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAuth Hook and Session Hydration (Eatzy Alignment)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setAccessToken(null);
    useAuthStore.getState().clearAuth();
    // Default mock window path
    Object.defineProperty(window, 'location', {
      writable: true,
      value: {
        pathname: '/papers',
        href: 'http://localhost/papers',
        search: '',
        assign: vi.fn(),
        replace: vi.fn(),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('performs initial hydration calling authApi.getAccount() on mount', async () => {
    const mockUser = {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'scientist@vnuhcm.edu.vn',
      displayName: 'Nguyen Van A',
      status: 'ACTIVE',
    };

    const getAccountSpy = vi.spyOn(authApi, 'getAccount').mockResolvedValueOnce(mockUser as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    // Initially loading
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getAccountSpy).toHaveBeenCalledTimes(1);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(expect.objectContaining({
      id: '11111111-1111-1111-1111-111111111111',
      email: 'scientist@vnuhcm.edu.vn',
      displayName: 'Nguyen Van A',
    }));
    expect(result.current.isError).toBe(false);
  });

  it('populates useAuthStore and calls setAccessToken when session data returns with access token', async () => {
    const responsePayload = {
      accessToken: 'jwt-access-token-999',
      user: {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'author@vnuhcm.edu.vn',
        displayName: 'Tran Thi B',
        status: 'ACTIVE',
      },
    };

    vi.spyOn(authApi, 'getAccount').mockResolvedValueOnce(responsePayload as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    // Verify useAuthStore was synced
    const storeState = useAuthStore.getState();
    expect(storeState.user?.id).toBe('22222222-2222-2222-2222-222222222222');
    expect(storeState.isAuthenticated).toBe(true);

    // Verify setAccessToken was called and api-client has active token
    expect(getAccessToken()).toBe('jwt-access-token-999');
  });

  it('syncs existing store token when session returns nested data.data.user', async () => {
    // Pre-populate store token
    act(() => {
      useAuthStore.getState().setToken('pre-existing-store-token');
    });
    expect(getAccessToken()).toBe('pre-existing-store-token');

    const nestedPayload = {
      data: {
        user: {
          id: '33333333-3333-3333-3333-333333333333',
          email: 'editor@vnuhcm.edu.vn',
          displayName: 'Le Van C',
          status: 'ACTIVE',
        },
      },
    };

    vi.spyOn(authApi, 'getAccount').mockResolvedValueOnce(nestedPayload as any);

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(useAuthStore.getState().user?.displayName).toBe('Le Van C');
    expect(getAccessToken()).toBe('pre-existing-store-token');
  });

  it('handles 401 unauthenticated response: calls clearAuth and sets auth_expired flag when not on /login', async () => {
    // Pre-populate store with logged-in user
    act(() => {
      useAuthStore.getState().setLogin(
        'stale-token',
        {
          id: 'old-user-1',
          email: 'expired@vnuhcm.edu.vn',
          displayName: 'Expired Session User',
        },
        'stale-refresh-token',
      );
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(getAccessToken()).toBe('stale-token');

    // Mock 401 unauthorized error
    vi.spyOn(authApi, 'getAccount').mockRejectedValueOnce({
      status: 401,
      detail: 'Phiên đăng nhập đã hết hạn',
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Store must be cleared
    const storeState = useAuthStore.getState();
    expect(storeState.user).toBeNull();
    expect(storeState.token).toBeNull();
    expect(storeState.isAuthenticated).toBe(false);

    // api-client access token must be cleared
    expect(getAccessToken()).toBeNull();

    // Session expired alert flag should be set for LoginPage banner
    expect(localStorage.getItem('auth_expired')).toBe('true');
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('does not set auth_expired banner when 401 error occurs while already on /login', async () => {
    // Simulate user browsing /login
    window.location.pathname = '/login';

    vi.spyOn(authApi, 'getAccount').mockRejectedValueOnce({
      statusCode: 401,
      detail: 'Unauthorized',
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    // Should clear auth cleanly without setting session expired flag
    expect(useAuthStore.getState().user).toBeNull();
    expect(localStorage.getItem('auth_expired')).toBeNull();
  });

  it('auth-store syncs token changes to api-client and clears state on clearAuth', () => {
    act(() => {
      useAuthStore.getState().setToken('manual-test-token-456');
    });
    expect(getAccessToken()).toBe('manual-test-token-456');

    act(() => {
      useAuthStore.getState().clearAuth();
    });
    expect(getAccessToken()).toBeNull();
    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
