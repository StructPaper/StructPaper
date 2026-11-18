// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSessionReady } from '@/features/auth/hooks/useSessionReady';
import { useAuthStore } from '@/lib/auth-store';

const wrapperWith = (client: QueryClient) =>
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null, isAuthenticated: false, token: null });
});

describe('waiting for the restored session after a reload', () => {
  it('a visitor without a stored session is ready at once', () => {
    const { result } = renderHook(() => useSessionReady(), { wrapper: wrapperWith(new QueryClient()) });
    expect(result.current).toBe(true);
  });

  it('a signed-in visitor is not ready until /auth/me has settled', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c' } as any, isAuthenticated: true });
    const client = new QueryClient();
    const { result, rerender } = renderHook(() => useSessionReady(), { wrapper: wrapperWith(client) });
    expect(result.current).toBe(false); // the paper must not be asked for as a guest yet

    client.setQueryData(['auth', 'me'], { id: 'u1' });
    rerender();
    expect(result.current).toBe(true);
  });

  it('is ready where there is no QueryClientProvider at all', () => {
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c' } as any, isAuthenticated: true });
    const { result } = renderHook(() => useSessionReady());
    expect(result.current).toBe(true);
  });
});
