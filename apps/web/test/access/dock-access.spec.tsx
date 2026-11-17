// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/papers',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

// The real navigation plus one item that needs a capability, to prove the dock filters by it
vi.mock('@/components/layout/navigation', async () => {
  const actual = await vi.importActual<typeof import('@/components/layout/navigation')>('@/components/layout/navigation');
  return {
    ...actual,
    MAIN_NAV: [
      ...actual.MAIN_NAV,
      {
        ...actual.MAIN_NAV[0],
        path: '/members-only',
        label: 'Khu quản trị',
        description: 'chỉ người quản lý',
        activeOn: ['/members-only'],
        access: 'member:manage',
        bottomBarLabel: 'Quản trị',
      },
    ],
  };
});

import { Sidebar } from '@/components/layout/Sidebar';
import { BottomNav } from '@/components/layout/BottomNav';
import { useAuthStore } from '@/lib/auth-store';

const loginWith = (capabilities?: string[]) =>
  useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', capabilities }, isAuthenticated: true } as any);

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

describe('dock and bottom bar follow the capabilities', () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false } as any);
  });

  it('a user without the capability does not see the gated item (dock)', () => {
    loginWith([]);
    render(<Sidebar />);

    expect(hrefs()).not.toContain('/members-only');
    expect(hrefs()).toContain('/papers'); // open items stay
    expect(hrefs()).toContain('/permissions');
    expect(hrefs()).toContain('/account');
  });

  it('a user with the capability sees it (dock)', () => {
    loginWith(['member:manage']);
    render(<Sidebar />);

    expect(hrefs()).toContain('/members-only');
  });

  it('nothing gated is shown while the capabilities are still loading (default deny)', () => {
    loginWith(undefined);
    render(<Sidebar />);

    expect(hrefs()).not.toContain('/members-only');
    expect(hrefs()).toContain('/papers');
  });

  it('the mobile bottom bar uses the same rule', () => {
    loginWith([]);
    const { unmount } = render(<BottomNav />);
    expect(hrefs()).not.toContain('/members-only');
    unmount();

    loginWith(['member:manage']);
    render(<BottomNav />);
    expect(hrefs()).toContain('/members-only');
  });
});
