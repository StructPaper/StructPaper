// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import type { Capability } from '@structpaper/contracts';
import { createAccess, denyMessage, Gate, useAccess } from '@/lib/access';
import { MAIN_NAV, ACCOUNT_NAV, bottomBarNav, visibleNav, isNavItemActive, type NavItem } from '@/components/layout/navigation';
import { useAuthStore } from '@/lib/auth-store';

const withCaps = (...capabilities: Capability[]) => createAccess({ capabilities });

describe('createAccess (pure rules)', () => {
  it('anonymous: nothing is allowed', () => {
    const access = createAccess(null);
    expect(access.status).toBe('anonymous');
    expect(access.can('member:manage')).toBe(false);
  });

  it('loading (logged in, capabilities not received yet): default deny, reason LOADING', () => {
    const access = createAccess({ capabilities: undefined });
    expect(access.status).toBe('loading');
    expect(access.can('member:manage')).toBe(false);
    expect(access.explain('member:manage')).toEqual({ allowed: false, reason: 'LOADING' });
  });

  it('ready: only the granted capabilities are allowed, the rest NO_PERMISSION', () => {
    const access = withCaps('member:manage');
    expect(access.status).toBe('ready');
    expect(access.can('member:manage')).toBe(true);
    expect(access.explain('member:manage')).toEqual({ allowed: true });
    expect(access.explain('role:assign')).toEqual({ allowed: false, reason: 'NO_PERMISSION' });
  });

  it('an empty list is a known state (ready), not a loading one', () => {
    expect(createAccess({ capabilities: [] }).status).toBe('ready');
  });

  it('canAll / canAny combine capabilities', () => {
    const access = withCaps('member:manage', 'role:assign');
    expect(access.canAll('member:manage', 'role:assign')).toBe(true);
    expect(access.canAll('member:manage', 'role:grant_superadmin')).toBe(false);
    expect(access.canAny('role:grant_superadmin', 'role:assign')).toBe(true);
    expect(access.canAny('role:grant_superadmin')).toBe(false);
    expect(access.canAll()).toBe(true); // nothing required
  });

  it('denyMessage gives one wording per reason', () => {
    expect(denyMessage({ allowed: true })).toBeUndefined();
    expect(denyMessage({ allowed: false, reason: 'NO_PERMISSION' })).toMatch(/không có quyền/i);
    expect(denyMessage({ allowed: false, reason: 'LOADING' })).toMatch(/kiểm tra quyền/i);
  });
});

describe('<Gate>', () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false } as any);
  });

  const login = (capabilities?: Capability[]) =>
    useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', capabilities }, isAuthenticated: true } as any);

  it('renders the children when the capability is granted', () => {
    login(['member:manage']);
    render(<Gate capability="member:manage"><button>Mời</button></Gate>);
    expect(screen.getByRole('button', { name: 'Mời' })).toBeDefined();
  });

  it('hides the children (and shows the fallback) when it is not', () => {
    login([]);
    render(
      <Gate capability="member:manage" fallback={<span>Không có quyền</span>}>
        <button>Mời</button>
      </Gate>,
    );
    expect(screen.queryByRole('button', { name: 'Mời' })).toBeNull();
    expect(screen.getByText('Không có quyền')).toBeDefined();
  });

  it('shows loadingFallback (not the content, not the denial) while capabilities load', () => {
    login(undefined);
    render(
      <Gate capability="member:manage" fallback={<span>denied</span>} loadingFallback={<span>đang tải</span>}>
        <button>Mời</button>
      </Gate>,
    );
    expect(screen.getByText('đang tải')).toBeDefined();
    expect(screen.queryByText('denied')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mời' })).toBeNull();
  });

  it('a list needs ALL capabilities by default, ANY with the `any` prop', () => {
    login(['role:assign']);
    const { rerender } = render(
      <Gate capability={['member:manage', 'role:assign']}><span>both</span></Gate>,
    );
    expect(screen.queryByText('both')).toBeNull();

    rerender(
      <Gate capability={['member:manage', 'role:assign']} any><span>both</span></Gate>,
    );
    expect(screen.getByText('both')).toBeDefined();
  });

  it("mode 'disable' always renders and passes the decision, so the child can explain itself", () => {
    login([]);
    render(
      <Gate capability="member:manage" mode="disable">
        {(decision) => (
          <button disabled={!decision.allowed} title={denyMessage(decision)}>
            Mời
          </button>
        )}
      </Gate>,
    );
    const button = screen.getByRole('button', { name: 'Mời' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.title).toMatch(/không có quyền/i);
  });

  it('reacts live when the capabilities change (no page reload)', () => {
    login([]);
    render(<Gate capability="member:manage"><span>admin zone</span></Gate>);
    expect(screen.queryByText('admin zone')).toBeNull();

    act(() => login(['member:manage']));
    expect(screen.getByText('admin zone')).toBeDefined();

    act(() => login([]));
    expect(screen.queryByText('admin zone')).toBeNull();
  });

  it('useAccess keeps the same object while nothing changed (cheap to use in lists)', () => {
    login(['member:manage']);
    const seen: unknown[] = [];
    const Probe = () => {
      seen.push(useAccess());
      return null;
    };
    const { rerender } = render(<Probe />);
    rerender(<Probe />);
    expect(seen[0]).toBe(seen[seen.length - 1]);
  });
});

describe('declarative navigation table', () => {
  const secret: NavItem = { ...MAIN_NAV[0], path: '/secret', label: 'Secret', access: 'member:manage', bottomBarLabel: 'Secret' };
  const open: NavItem = { ...MAIN_NAV[0], path: '/open', label: 'Open', activeOn: ['/open'] };

  it('items without `access` are visible to every logged-in user, even while loading', () => {
    expect(visibleNav([open], createAccess({ capabilities: undefined }))).toEqual([open]);
  });

  it('items with `access` need that capability (default deny while loading)', () => {
    expect(visibleNav([open, secret], createAccess({ capabilities: undefined })).map((i) => i.path)).toEqual(['/open']);
    expect(visibleNav([open, secret], withCaps()).map((i) => i.path)).toEqual(['/open']);
    expect(visibleNav([open, secret], withCaps('member:manage')).map((i) => i.path)).toEqual(['/open', '/secret']);
  });

  it('a list of capabilities on one item requires all of them', () => {
    const both: NavItem = { ...secret, access: ['member:manage', 'role:assign'] };
    expect(visibleNav([both], withCaps('member:manage'))).toEqual([]);
    expect(visibleNav([both], withCaps('member:manage', 'role:assign'))).toEqual([both]);
  });

  it('active state covers the page and its sub pages only', () => {
    const papers = MAIN_NAV.find((i) => i.path === '/papers')!;
    expect(isNavItemActive(papers, '/papers')).toBe(true);
    expect(isNavItemActive(papers, '/papers/abc')).toBe(true);
    expect(isNavItemActive(papers, '/history')).toBe(true);
    expect(isNavItemActive(papers, '/permissions')).toBe(false);
    expect(isNavItemActive(ACCOUNT_NAV, '/account')).toBe(true);
  });

  it('the bottom bar is generated from the same table (same order, only flagged items)', () => {
    expect(bottomBarNav([...MAIN_NAV, ACCOUNT_NAV]).map((i) => i.path)).toEqual(['/papers', '/templates', '/settings', '/account']);
  });

  it('every item has a unique path', () => {
    const paths = [...MAIN_NAV, ACCOUNT_NAV].map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
