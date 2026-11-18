// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Capability } from '@structpaper/contracts';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/permissions',
}));

vi.mock('@structpaper/api-client', async () => {
  const actual = await vi.importActual<any>('@structpaper/api-client');
  const idle = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    ...actual,
    useListUsers: () => ({
      data: {
        items: [
          { id: 'u-1', email: 'author@x.org', displayName: 'Tác giả', status: 'ACTIVE', permissionsVersion: 1, lockReason: null, roles: [{ roleName: 'Author', scopeJournalId: null, scopeJournalName: null }] },
        ],
        total: 1,
        limit: 100,
        offset: 0,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    }),
    useListInvitations: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
    useGetRoles: () => ({
      data: ['SuperAdmin', 'JournalManager', 'Editor', 'Reviewer', 'Author'].map((name) => ({ id: `role-${name}`, name })),
      isLoading: false,
    }),
    useListJournals: () => ({ data: [], isLoading: false }),
    useGetPermissions: () => ({ data: [], isLoading: false }),
    useAssignRole: idle,
    useRevokeRole: idle,
    useInviteUser: idle,
    useResendInvite: idle,
    useRevokeInvitation: idle,
  };
});

import PermissionsPage from '@/app/(authenticate)/(main)/permissions/page';
import { PermissionMatrixTab, UserRoleAssignmentTab } from '@/features/permissions';
import { useAuthStore } from '@/lib/auth-store';

type Role = { roleName: string; scopeJournalId: string | null; scopeJournalName: string | null };
const role = (roleName: string): Role => ({ roleName, scopeJournalId: null, scopeJournalName: null });

/** Personas: the capabilities the SERVER would send for each kind of user. */
const PERSONAS = {
  superAdmin: { roles: [role('SuperAdmin')], capabilities: ['member:manage', 'role:assign', 'role:grant_superadmin'] as Capability[] },
  journalManager: { roles: [role('JournalManager')], capabilities: ['member:manage', 'role:assign'] as Capability[] },
  editor: { roles: [role('Editor')], capabilities: [] as Capability[] },
  author: { roles: [role('Author')], capabilities: [] as Capability[] },
};

const loginAs = (persona: { roles: Role[]; capabilities?: Capability[] }) =>
  useAuthStore.setState({
    user: { id: 'u-viewer', email: 'viewer@x.org', roles: persona.roles, capabilities: persona.capabilities },
    isAuthenticated: true,
  } as any);

function renderPage(ui: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Permissions page shows only what the user can do', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false } as any);
  });
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false } as any);
  });

  describe.each([
    ['SuperAdmin', PERSONAS.superAdmin],
    ['JournalManager', PERSONAS.journalManager],
  ])('%s (can manage members)', (_name, persona) => {
    it('sees the three tabs and the invite button', () => {
      loginAs(persona);
      renderPage(<PermissionsPage />);

      expect(screen.getByRole('tab', { name: /Người dùng & Vai trò/ })).toBeDefined();
      expect(screen.getByRole('tab', { name: /Ma trận Phân quyền/ })).toBeDefined();
      expect(screen.getByRole('tab', { name: /Lời mời tham gia/ })).toBeDefined();
      expect(screen.getByRole('button', { name: /Mời thành viên mới/ })).toBeDefined();
      expect(screen.queryByTestId('permissions-readonly-note')).toBeNull();
    });

    it('opens on the members table', () => {
      loginAs(persona);
      renderPage(<PermissionsPage />);

      expect(screen.getByText('author@x.org')).toBeDefined();
    });
  });

  describe.each([
    ['Editor', PERSONAS.editor],
    ['Author', PERSONAS.author],
  ])('%s (no management rights)', (_name, persona) => {
    it('sees ONLY the permission matrix: no tabs, no invite button, no member data', () => {
      loginAs(persona);
      renderPage(<PermissionsPage />);

      // the matrix is there
      expect(screen.getAllByText(/Manuscript/).length).toBeGreaterThan(0);
      // nothing that manages people
      expect(screen.queryByRole('tablist')).toBeNull();
      expect(screen.queryByRole('tab')).toBeNull();
      expect(screen.queryByRole('button', { name: /Mời thành viên/ })).toBeNull();
      expect(screen.queryByText('author@x.org')).toBeNull();
      expect(screen.queryByTestId('invite-member-modal')).toBeNull();
      expect(screen.getByTestId('permissions-readonly-note').textContent).toMatch(/chỉ đọc/i);
    });
  });

  it('shows placeholders (not the admin screens, not a guess) while the capabilities are loading', () => {
    loginAs({ roles: [role('SuperAdmin')], capabilities: undefined });
    renderPage(<PermissionsPage />);

    expect(screen.getByTestId('permissions-toolbar-loading')).toBeDefined();
    expect(screen.getByTestId('permissions-content-loading')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Mời thành viên/ })).toBeNull();
    expect(screen.queryByText('author@x.org')).toBeNull();
  });

  it('falls back to the matrix when the capabilities disappear (e.g. the role was removed)', () => {
    loginAs(PERSONAS.journalManager);
    const { rerender } = renderPage(<PermissionsPage />);
    expect(screen.getByText('author@x.org')).toBeDefined();

    loginAs(PERSONAS.author);
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <PermissionsPage />
      </QueryClientProvider>,
    );

    expect(screen.queryByText('author@x.org')).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
  });
});

describe('SuperAdmin role is only offered to those who may grant it', () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false } as any);
  });

  const superAdminOption = () =>
    Array.from((screen.getByTestId('user-role-select-u-1') as HTMLSelectElement).options).find((o) => o.value === 'SuperAdmin')!;

  it('a SuperAdmin can pick SuperAdmin', () => {
    loginAs(PERSONAS.superAdmin);
    renderPage(<UserRoleAssignmentTab />);

    expect(superAdminOption().disabled).toBe(false);
  });

  it('a JournalManager can assign roles but not SuperAdmin', () => {
    loginAs(PERSONAS.journalManager);
    renderPage(<UserRoleAssignmentTab />);

    expect((screen.getByTestId('user-role-select-u-1') as HTMLSelectElement).disabled).toBe(false);
    expect(superAdminOption().disabled).toBe(true);
  });

  it('without the role:assign capability the role selects are locked', () => {
    loginAs({ roles: [role('Editor')], capabilities: ['member:manage'] });
    renderPage(<UserRoleAssignmentTab />);

    expect((screen.getByTestId('user-role-select-u-1') as HTMLSelectElement).disabled).toBe(true);
  });
});

describe('Permission matrix points out the viewer own role', () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false } as any);
  });

  const headerFor = (name: string) => screen.getByText(name, { selector: 'span.font-black' }).closest('th') as HTMLElement;
  const markedHeaders = () => Array.from(document.querySelectorAll('th[data-mine="true"]')).map((th) => th.textContent);

  it('highlights only the column of the role the viewer holds', () => {
    loginAs({ roles: [role('Editor')], capabilities: [] });
    renderPage(<PermissionMatrixTab />);

    expect(headerFor('Editor').getAttribute('data-mine')).toBe('true');
    expect(headerFor('Author').getAttribute('data-mine')).toBeNull();
    expect(markedHeaders()).toHaveLength(1);
    expect(within(headerFor('Editor')).getByText(/Vai trò của bạn/)).toBeDefined();
  });

  it('highlights every cell of that column, and only that column', () => {
    loginAs({ roles: [role('Editor')], capabilities: [] });
    renderPage(<PermissionMatrixTab />);

    const marked = document.querySelectorAll('td[data-mine="true"]').length;
    const rows = document.querySelectorAll('tbody tr').length;
    // one marked cell per action row (the subject header rows have a single colspan cell, not marked)
    expect(marked).toBeGreaterThan(0);
    expect(marked).toBeLessThan(rows);
    // all marked cells share the same column index
    const cols = new Set(Array.from(document.querySelectorAll('td[data-mine="true"]')).map((td) => (td as HTMLTableCellElement).cellIndex));
    expect(cols.size).toBe(1);
  });

  it('highlights several columns when the user holds several roles', () => {
    loginAs({ roles: [role('Editor'), role('Reviewer')], capabilities: [] });
    renderPage(<PermissionMatrixTab />);

    expect(markedHeaders().length).toBe(2);
  });

  it('highlights nothing for a user without roles or when nobody is logged in', () => {
    loginAs({ roles: [], capabilities: [] });
    renderPage(<PermissionMatrixTab />);
    expect(markedHeaders()).toHaveLength(0);

    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false } as any);
    renderPage(<PermissionMatrixTab />);
    expect(markedHeaders()).toHaveLength(0);
  });

  it('keeps the header row aligned (every column reserves the caption line)', () => {
    loginAs({ roles: [role('Editor')], capabilities: [] });
    renderPage(<PermissionMatrixTab />);

    const captions = screen.getAllByText('Vai trò của bạn');
    expect(captions.length).toBeGreaterThan(1); // all columns have the line...
    expect(captions.filter((c) => !c.className.includes('invisible'))).toHaveLength(1); // ...only mine is visible
  });
});
