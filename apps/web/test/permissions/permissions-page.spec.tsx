// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/permissions',
}));

// Mock navigator.clipboard
const mockWriteText = vi.fn().mockResolvedValue(undefined);
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText,
  },
  configurable: true,
  writable: true,
});

import PermissionsPage from '@/app/(authenticate)/(main)/permissions/page';
import {
  UserRoleAssignmentTab,
  PermissionMatrixTab,
  InviteMemberModal,
  InvitationsTab,
} from '@/features/permissions';
import { sileo } from '@/components/toast';
import { ProblemDetailsError } from '@structpaper/api-client';
import { useAuthStore } from '@/lib/auth-store';

// ---------------------------------------------------------------------------
// Fixtures & API mocks (the components load everything through the generated hooks)
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => {
  const iso = (offsetHours: number) => new Date(Date.now() + offsetHours * 3_600_000).toISOString();
  return {
    assignRole: vi.fn(),
    revokeRole: vi.fn(),
    invite: vi.fn(),
    resend: vi.fn(),
    revokeInvitation: vi.fn(),
    refetchUsers: vi.fn(),
    refetchInvitations: vi.fn(),
    state: {
      usersLoading: false,
      usersError: false,
      invitationsLoading: false,
      invitationsError: false,
    },
    users: [
      {
        id: 'u-admin',
        email: 'admin@structpaper.org',
        displayName: 'GS. TSKH. Nguyễn Hoàng Nam',
        status: 'ACTIVE',
        permissionsVersion: 5,
        roles: [{ roleName: 'SuperAdmin', scopeJournalId: null, scopeJournalName: null }],
      },
      {
        id: 'u-manager',
        email: 'manager.stdj@vnuhcm.edu.vn',
        displayName: 'PGS. TS. Trần Minh Tuấn',
        status: 'ACTIVE',
        permissionsVersion: 3,
        roles: [
          { roleName: 'JournalManager', scopeJournalId: 'j-std', scopeJournalName: 'Tạp chí Phát triển KH&CN' },
          { roleName: 'Reviewer', scopeJournalId: 'j-ssh', scopeJournalName: 'Tạp chí KHXH&NV' },
        ],
      },
      {
        id: 'u-guest',
        email: 'collaborator.guest@vnu.edu.vn',
        displayName: 'Cộng tác viên ĐHQG',
        status: 'INVITED',
        permissionsVersion: 1,
        roles: [],
      },
      {
        // the logged-in viewer: the API marks the row as SELF
        id: 'u-self',
        email: 'me@structpaper.org',
        displayName: 'Chính tôi',
        status: 'ACTIVE',
        permissionsVersion: 2,
        lockReason: 'SELF',
        roles: [{ roleName: 'JournalManager', scopeJournalId: 'j-std', scopeJournalName: 'Tạp chí Phát triển KH&CN' }],
      },
      {
        // a SuperAdmin seen by a non-SuperAdmin viewer
        id: 'u-root',
        email: 'root@structpaper.org',
        displayName: 'Quản trị gốc',
        status: 'ACTIVE',
        permissionsVersion: 4,
        lockReason: 'REQUIRES_SUPERADMIN',
        roles: [{ roleName: 'SuperAdmin', scopeJournalId: null, scopeJournalName: null }],
      },
    ],
    invitations: [
      {
        id: 'inv-1',
        email: 'collaborator.guest@vnu.edu.vn',
        displayName: 'Độc giả / Cộng tác viên ĐHQG',
        roles: [{ roleName: 'Reviewer', scopeJournalId: null, scopeJournalName: null }],
        invitedAt: iso(-24),
        expiresAt: iso(48),
        status: 'PENDING',
      },
      {
        id: 'inv-2',
        email: 'reviewer.le@hcmus.edu.vn',
        displayName: 'TS. Lê Hải Đăng',
        roles: [{ roleName: 'Reviewer', scopeJournalId: 'j-nat', scopeJournalName: 'Tạp chí KHTN' }],
        invitedAt: iso(-48),
        expiresAt: iso(24),
        status: 'PENDING',
      },
      {
        id: 'inv-3',
        email: 'editor.tran@medvnu.edu.vn',
        displayName: 'ThS. Trần Thị Kim Cương',
        roles: [{ roleName: 'Editor', scopeJournalId: 'j-med', scopeJournalName: 'Tạp chí Sức khỏe' }],
        invitedAt: iso(-100),
        expiresAt: iso(-2),
        status: 'EXPIRED',
      },
    ],
  };
});

vi.mock('@structpaper/api-client', async () => {
  const actual = await vi.importActual<any>('@structpaper/api-client');
  return {
    ...actual,
    useListUsers: () => ({
      data: { items: h.users, total: h.users.length, limit: 100, offset: 0 },
      isLoading: h.state.usersLoading,
      isError: h.state.usersError,
      refetch: h.refetchUsers,
    }),
    useListInvitations: () => ({
      data: h.invitations,
      isLoading: h.state.invitationsLoading,
      isError: h.state.invitationsError,
      refetch: h.refetchInvitations,
    }),
    useAssignRole: () => ({ mutateAsync: h.assignRole, isPending: false }),
    useRevokeRole: () => ({ mutateAsync: h.revokeRole, isPending: false }),
    useInviteUser: () => ({ mutateAsync: h.invite, isPending: false }),
    useResendInvite: () => ({ mutateAsync: h.resend, isPending: false }),
    useRevokeInvitation: () => ({ mutateAsync: h.revokeInvitation, isPending: false }),
    useGetRoles: () => ({
      data: [
        { id: 'role-superadmin', name: 'SuperAdmin', isSystem: true },
        { id: 'role-journalmanager', name: 'JournalManager', isSystem: true },
        { id: 'role-editor', name: 'Editor', isSystem: true },
        { id: 'role-reviewer', name: 'Reviewer', isSystem: true },
        { id: 'role-author', name: 'Author', isSystem: true },
      ],
      isLoading: false,
    }),
    useListJournals: () => ({
      data: [
        { id: 'j-std', slug: 'vnuhcm-std', code: 'VNUHCM-STD', shortName: 'STD', name: 'Tạp chí Phát triển KH&CN' },
        { id: 'j-ssh', slug: 'vnuhcm-ssh', code: 'VNUHCM-SSH', shortName: 'SSH', name: 'Tạp chí KHXH&NV' },
      ],
      isLoading: false,
    }),
    useGetPermissions: () => ({
      data: [
        { id: 'p1', action: 'manage', subject: 'all' },
        { id: 'p2', action: 'create', subject: 'Manuscript' },
      ],
      isLoading: false,
    }),
  };
});

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Permissions & Role Management Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // These tests exercise the management screens: the viewer is a SuperAdmin whose capabilities
    // the server has already sent (who sees what per persona is covered in permissions-access.spec).
    useAuthStore.setState({
      user: {
        id: 'u-viewer',
        email: 'viewer@structpaper.org',
        roles: [{ roleName: 'SuperAdmin', scopeJournalId: null, scopeJournalName: null }],
        capabilities: ['member:manage', 'role:assign', 'role:grant_superadmin'],
      },
      isAuthenticated: true,
    } as any);
    mockWriteText.mockResolvedValue(undefined);
    h.assignRole.mockResolvedValue({ success: true, permissionsVersion: 6 });
    h.revokeRole.mockResolvedValue({ success: true, permissionsVersion: 7 });
    h.invite.mockResolvedValue({
      user: { id: 'user-new', email: 'newmember@vnu.edu.vn', status: 'INVITED' },
      token: 'real-token-12345',
      activationUrl: 'http://localhost:3000/activate#token=real-token-12345',
      expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    });
    h.resend.mockResolvedValue({
      user: { id: 'inv-1', email: 'collaborator.guest@vnu.edu.vn', status: 'INVITED' },
      token: 'fresh-token-999',
      activationUrl: 'http://localhost:3000/activate#token=fresh-token-999',
      expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    });
    h.revokeInvitation.mockResolvedValue({ success: true, message: 'Invitation revoked' });
    h.state.usersLoading = false;
    h.state.usersError = false;
    h.state.invitationsLoading = false;
    h.state.invitationsError = false;
  });

  afterEach(() => {
    cleanup();
  });

  // ------------------------------- page shell -------------------------------
  it('renders the header with title', () => {
    renderWithClient(<PermissionsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Quản lý phân quyền' })).toBeDefined();
    // The long subtitle (roles / RBAC / CASL) is gone: the header is just the short title
    expect(screen.queryByText(/RBAC \/ CASL/i)).toBeNull();
    expect(screen.getAllByText(/permissions_version|pv/i).length).toBeGreaterThan(0);
  });

  it('renders the sticky navigation toolbar with mask and invite member action on the same row', () => {
    renderWithClient(<PermissionsPage />);

    expect(screen.getByTestId('permissions-sticky-toolbar')).toBeDefined();
    expect(screen.getByRole('button', { name: /Mời thành viên mới/i })).toBeDefined();
  });

  it('renders three tabs: User & Role Assignment, Permission Matrix, and Invitations', () => {
    renderWithClient(<PermissionsPage />);

    expect(screen.getByRole('tab', { name: /Người dùng & Vai trò/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Ma trận Phân quyền/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Lời mời tham gia/i })).toBeDefined();
  });

  it('switches between tabs when clicking tab headers', () => {
    renderWithClient(<PermissionsPage />);

    expect(screen.getAllByText(/Mời thành viên mới/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: /Ma trận Phân quyền/i }));
    expect(screen.getAllByText(/Manuscript/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('tab', { name: /Lời mời tham gia/i }));
    expect(screen.getAllByText(/PENDING/).length).toBeGreaterThan(0);
  });

  // --------------------------- users tab (real data) ---------------------------
  it('UserRoleAssignmentTab shows the users returned by the API, with journal scope names', () => {
    renderWithClient(<UserRoleAssignmentTab />);

    expect(screen.getByText('GS. TSKH. Nguyễn Hoàng Nam')).toBeDefined();
    expect(screen.getByText('PGS. TS. Trần Minh Tuấn')).toBeDefined();
    // Scope of the primary role comes from the API (journal name), not from hard-coded data
    expect(screen.getAllByText('Tạp chí Phát triển KH&CN').length).toBeGreaterThan(0);
    // The second role assignment is surfaced
    expect(screen.getByText('+1 vai trò khác')).toBeDefined();
  });

  it('UserRoleAssignmentTab renders search bar, status chips, role filter, and end of list divider', () => {
    renderWithClient(<UserRoleAssignmentTab />);

    expect(screen.getByPlaceholderText(/Tìm theo email hoặc họ tên/i)).toBeDefined();
    expect(screen.getByTestId('status-filter-all')).toBeDefined();
    expect(screen.getByTestId('status-filter-active')).toBeDefined();
    expect(screen.getByTestId('status-filter-invited')).toBeDefined();
    expect(screen.getByTestId('status-filter-suspended')).toBeDefined();
    expect(screen.getByText(/Bạn đã xem hết danh sách thành viên/i)).toBeDefined();
  });

  it('filters users by search query and clear button resets search', () => {
    renderWithClient(<UserRoleAssignmentTab />);

    fireEvent.change(screen.getByPlaceholderText(/Tìm theo email hoặc họ tên/i), {
      target: { value: 'GS. TSKH' },
    });
    expect(screen.getByText(/GS. TSKH. Nguyễn Hoàng Nam/i)).toBeDefined();
    expect(screen.queryByText(/PGS. TS. Trần Minh Tuấn/i)).toBeNull();

    fireEvent.click(screen.getByTitle('Xóa tìm kiếm'));
    expect(screen.getByText(/PGS. TS. Trần Minh Tuấn/i)).toBeDefined();
  });

  it('filters users by status filter chips and role select', () => {
    renderWithClient(<UserRoleAssignmentTab />);

    fireEvent.click(screen.getByTestId('status-filter-invited'));
    expect(screen.getByText(/collaborator.guest@vnu.edu.vn/i)).toBeDefined();
    expect(screen.queryByText(/admin@structpaper.org/i)).toBeNull();

    fireEvent.click(screen.getByTestId('status-filter-all'));
    expect(screen.getByText(/admin@structpaper.org/i)).toBeDefined();

    fireEvent.change(screen.getByTestId('filter-role-select'), { target: { value: 'SuperAdmin' } });
    expect(screen.getByText(/admin@structpaper.org/i)).toBeDefined();
    expect(screen.queryByText(/PGS. TS. Trần Minh Tuấn/i)).toBeNull();
  });

  it('shows loading and error states for the users table, and retry refetches', () => {
    h.state.usersLoading = true;
    const { unmount } = renderWithClient(<UserRoleAssignmentTab />);
    // Shimmer rows (same look as the other pages) instead of a text line
    expect(screen.getAllByTestId('users-loading-row').length).toBeGreaterThan(0);
    expect(screen.queryByText('GS. TSKH. Nguyễn Hoàng Nam')).toBeNull();
    unmount();

    h.state.usersLoading = false;
    h.state.usersError = true;
    renderWithClient(<UserRoleAssignmentTab />);
    expect(screen.getByTestId('users-error')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));
    expect(h.refetchUsers).toHaveBeenCalled();
  });

  it('changing a role assigns the new role by id, then revokes the old one, and reports success', async () => {
    const successSpy = vi.spyOn(sileo, 'success');
    renderWithClient(<UserRoleAssignmentTab />);

    const selects = screen.getAllByLabelText(/phân vai trò cho/i);
    fireEvent.change(selects[0], { target: { value: 'Editor' } }); // admin: SuperAdmin -> Editor

    await waitFor(() => {
      expect(h.assignRole).toHaveBeenCalledWith({
        data: { userId: 'u-admin', roleId: 'role-editor', journalId: null },
      });
      expect(h.revokeRole).toHaveBeenCalledWith({
        data: { userId: 'u-admin', roleId: 'role-superadmin', journalId: null },
      });
      expect(successSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Cập nhật phân quyền tức thì',
          description: expect.stringContaining('Đã phân vai trò "Editor"'),
        }),
      );
    });
  });

  it('keeps the journal scope of the primary role when changing it', async () => {
    renderWithClient(<UserRoleAssignmentTab />);

    const selects = screen.getAllByLabelText(/phân vai trò cho/i);
    fireEvent.change(selects[1], { target: { value: 'Editor' } }); // manager: JournalManager@j-std -> Editor

    await waitFor(() => {
      expect(h.assignRole).toHaveBeenCalledWith({
        data: { userId: 'u-manager', roleId: 'role-editor', journalId: 'j-std' },
      });
    });
  });

  it('a failed role change shows an error and NEVER pretends it succeeded', async () => {
    h.assignRole.mockRejectedValueOnce(
      new ProblemDetailsError({
        title: 'Forbidden',
        status: 403,
        detail: 'Privilege escalation denied: Only SuperAdmin can assign the SuperAdmin role',
      }),
    );
    const successSpy = vi.spyOn(sileo, 'success');
    const errorSpy = vi.spyOn(sileo, 'error');
    renderWithClient(<UserRoleAssignmentTab />);

    const selects = screen.getAllByLabelText(/phân vai trò cho/i);
    fireEvent.change(selects[1], { target: { value: 'SuperAdmin' } });

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Không thể cập nhật vai trò',
          description: expect.stringContaining('Privilege escalation denied'),
        }),
      );
    });
    expect(successSpy).not.toHaveBeenCalled();
    expect(h.revokeRole).not.toHaveBeenCalled();
  });

  // ----------------------- locked rows (self / SuperAdmin protection) -----------------------
  it('your own row is labelled "Bạn", locked, and explains why', () => {
    renderWithClient(<UserRoleAssignmentTab />);

    expect(screen.getByTestId('self-badge-u-self').textContent).toBe('Bạn');
    expect((screen.getByTestId('user-role-select-u-self') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByTestId('lock-note-u-self').textContent).toMatch(/Không thể tự đổi vai trò của chính mình/);
    // only the viewer's own row carries the badge
    expect(screen.queryByTestId('self-badge-u-admin')).toBeNull();
  });

  it('a SuperAdmin row is locked for a non-SuperAdmin viewer, with the reason shown', () => {
    renderWithClient(<UserRoleAssignmentTab />);

    expect((screen.getByTestId('user-role-select-u-root') as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByTestId('lock-note-u-root').textContent).toMatch(/Chỉ SuperAdmin mới đổi được/);
    expect(screen.queryByTestId('self-badge-u-root')).toBeNull();
  });

  it('editable rows stay editable and show no lock note', () => {
    renderWithClient(<UserRoleAssignmentTab />);

    expect((screen.getByTestId('user-role-select-u-manager') as HTMLSelectElement).disabled).toBe(false);
    expect(screen.queryByTestId('lock-note-u-manager')).toBeNull();
  });

  it('never calls the API to change a locked row, even if the change is forced', async () => {
    renderWithClient(<UserRoleAssignmentTab />);

    fireEvent.change(screen.getByTestId('user-role-select-u-self'), { target: { value: 'Author' } });
    fireEvent.change(screen.getByTestId('user-role-select-u-root'), { target: { value: 'Author' } });

    await new Promise((r) => setTimeout(r, 30));
    expect(h.assignRole).not.toHaveBeenCalled();
    expect(h.revokeRole).not.toHaveBeenCalled();
  });

  it('explains the last-SuperAdmin refusal from the server in plain Vietnamese', async () => {
    h.assignRole.mockRejectedValueOnce(
      new ProblemDetailsError({
        title: 'Conflict',
        status: 409,
        detail: 'At least one active SuperAdmin must remain. Make another user SuperAdmin first.',
      }),
    );
    const errorSpy = vi.spyOn(sileo, 'error');
    renderWithClient(<UserRoleAssignmentTab />);

    fireEvent.change(screen.getAllByLabelText(/phân vai trò cho/i)[0], { target: { value: 'Editor' } });

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          description: expect.stringContaining('luôn còn ít nhất một SuperAdmin'),
        }),
      );
    });
  });

  it('permission matrix correctly shows system roles as immutable baselines and displays actions/subjects', () => {
    renderWithClient(<PermissionMatrixTab />);

    expect(screen.getAllByText(/create/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/manage/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manuscript/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Journal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Asset/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SuperAdmin/i).length).toBeGreaterThan(0);
    // The meaningless repeated "System Baseline" caption under every role was removed
    expect(screen.queryByText(/System Baseline/i)).toBeNull();
  });

  it('PermissionMatrixTab renders subject filter chips, filters matrix rows, and shows end-of-list divider', () => {
    renderWithClient(<PermissionMatrixTab />);

    const allChip = screen.getByTestId('subject-filter-all');
    const manuscriptChip = screen.getByTestId('subject-filter-manuscript');
    expect(allChip).toBeDefined();
    expect(manuscriptChip).toBeDefined();
    expect(screen.getByTestId('subject-filter-user')).toBeDefined();

    expect(screen.getByText(/Bản thảo \(Manuscript\)/i)).toBeDefined();
    expect(screen.getByText(/Người dùng \(User\)/i)).toBeDefined();
    expect(screen.getByText(/Tạp chí \(Journal\)/i)).toBeDefined();

    fireEvent.click(manuscriptChip);
    expect(screen.getByText(/Bản thảo \(Manuscript\)/i)).toBeDefined();
    expect(screen.queryByText(/Người dùng \(User\)/i)).toBeNull();

    fireEvent.click(allChip);
    expect(screen.getByText(/Người dùng \(User\)/i)).toBeDefined();
    expect(screen.getByText(/Bạn đã xem hết ma trận phân quyền hệ thống/i)).toBeDefined();
  });

  // ------------------------------ invite modal ------------------------------
  it('InviteMemberModal sends the invitation and shows the REAL activation link from the server', async () => {
    renderWithClient(<InviteMemberModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'newmember@vnu.edu.vn' } });
    fireEvent.change(screen.getByLabelText(/vai trò|role/i), { target: { value: 'Reviewer' } });
    fireEvent.click(screen.getByRole('button', { name: /tạo lời mời/i }));

    await waitFor(() => {
      expect(h.invite).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newmember@vnu.edu.vn',
          role: 'Reviewer',
          journalId: null,
        }),
      });
    });

    // The link is exactly what the server returned (token in the fragment), never a made-up one
    await waitFor(() => {
      expect(screen.getByDisplayValue('http://localhost:3000/activate#token=real-token-12345')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /sao chép link/i }));
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('http://localhost:3000/activate#token=real-token-12345');
    });
  });

  it('InviteMemberModal offers the real journals and sends the chosen journal id', async () => {
    renderWithClient(<InviteMemberModal isOpen={true} onClose={vi.fn()} />);

    const journalSelect = screen.getByLabelText(/phạm vi tạp chí/i) as HTMLSelectElement;
    const labels = Array.from(journalSelect.options).map((o) => o.textContent);
    expect(labels.some((l) => l?.includes('STD - Tạp chí Phát triển KH&CN'))).toBe(true);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'scoped@vnu.edu.vn' } });
    fireEvent.change(journalSelect, { target: { value: 'j-std' } });
    fireEvent.click(screen.getByRole('button', { name: /tạo lời mời/i }));

    await waitFor(() => {
      expect(h.invite).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: 'scoped@vnu.edu.vn', journalId: 'j-std' }),
      });
    });
  });

  it('InviteMemberModal shows the server error and never invents a fake link when the invite fails', async () => {
    h.invite.mockRejectedValueOnce(
      new ProblemDetailsError({
        title: 'Conflict',
        status: 409,
        detail: 'User with this email already exists and is active',
      }),
    );
    renderWithClient(<InviteMemberModal isOpen={true} onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'taken@vnu.edu.vn' } });
    fireEvent.click(screen.getByRole('button', { name: /tạo lời mời/i }));

    await waitFor(() => {
      expect(screen.getByTestId('invite-form-error').textContent).toContain(
        'User with this email already exists and is active',
      );
    });
    expect(screen.queryByLabelText(/link kích hoạt tài khoản/i)).toBeNull();
    expect(screen.queryByDisplayValue(/activate/)).toBeNull();
  });

  it('InviteMemberModal validates the email before calling the API', async () => {
    renderWithClient(<InviteMemberModal isOpen={true} onClose={vi.fn()} />);

    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    // Submit the form directly: the browser's native email validation would otherwise stop the
    // event before our own (second line of defence) validation runs.
    fireEvent.submit(emailInput.closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByTestId('invite-form-error').textContent).toMatch(/không đúng định dạng/i);
    });
    expect(h.invite).not.toHaveBeenCalled();
  });

  // ---------------------------- invitations tab ----------------------------
  it('InvitationsTab lists the pending invitations returned by the API (no hard-coded rows)', () => {
    renderWithClient(<InvitationsTab />);

    expect(screen.getByPlaceholderText(/Tìm theo email, tên hoặc vai trò/i)).toBeDefined();
    expect(screen.getByText('collaborator.guest@vnu.edu.vn')).toBeDefined();
    expect(screen.getByText('reviewer.le@hcmus.edu.vn')).toBeDefined();
    expect(screen.getByText('editor.tran@medvnu.edu.vn')).toBeDefined();
    // Journal scope name comes from the API
    expect(screen.getByText('Tạp chí KHTN')).toBeDefined();
    expect(screen.getByText(/Bạn đã xem hết danh sách lời mời/i)).toBeDefined();
  });

  it('InvitationsTab flags expired invitations', () => {
    renderWithClient(<InvitationsTab />);

    expect(screen.getAllByText('PENDING').length).toBe(2);
    expect(screen.getAllByText('EXPIRED').length).toBe(1);
  });

  it('filters invitations by search query and clear button resets search', () => {
    renderWithClient(<InvitationsTab />);

    fireEvent.change(screen.getByPlaceholderText(/Tìm theo email, tên hoặc vai trò/i), {
      target: { value: 'reviewer.le' },
    });
    expect(screen.getByText(/TS. Lê Hải Đăng/i)).toBeDefined();
    expect(screen.queryByText(/ThS. Trần Thị Kim Cương/i)).toBeNull();

    fireEvent.click(screen.getByTitle('Xóa tìm kiếm'));
    expect(screen.getByText(/ThS. Trần Thị Kim Cương/i)).toBeDefined();
  });

  it('"Tạo link mới & sao chép" issues a NEW link from the API and copies exactly that link', async () => {
    const successSpy = vi.spyOn(sileo, 'success');
    renderWithClient(<InvitationsTab />);

    fireEvent.click(screen.getByTestId('copy-invite-link-inv-1'));

    await waitFor(() => {
      expect(h.resend).toHaveBeenCalledWith({ id: 'inv-1' });
      expect(mockWriteText).toHaveBeenCalledWith('http://localhost:3000/activate#token=fresh-token-999');
      expect(successSpy).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Đã tạo link mới và sao chép' }),
      );
    });

    // The link is also shown, so it can be copied by hand
    const panel = await screen.findByTestId('generated-link-panel');
    expect(within(panel).getByDisplayValue('http://localhost:3000/activate#token=fresh-token-999')).toBeDefined();
    expect(within(panel).getByText(/collaborator.guest@vnu.edu.vn/)).toBeDefined();
  });

  it('when the clipboard is unavailable it still shows the new link for manual copy', async () => {
    mockWriteText.mockRejectedValueOnce(new Error('clipboard blocked'));
    const successSpy = vi.spyOn(sileo, 'success');
    renderWithClient(<InvitationsTab />);

    fireEvent.click(screen.getByTestId('copy-invite-link-inv-2'));

    const panel = await screen.findByTestId('generated-link-panel');
    expect(within(panel).getByDisplayValue(/activate#token=fresh-token-999/)).toBeDefined();
    expect(successSpy).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Đã tạo link kích hoạt mới' }),
    );
  });

  it('shows an error (and no link) when issuing a new link fails', async () => {
    h.resend.mockRejectedValueOnce(
      new ProblemDetailsError({ title: 'Conflict', status: 409, detail: 'This user is not pending activation' }),
    );
    const errorSpy = vi.spyOn(sileo, 'error');
    renderWithClient(<InvitationsTab />);

    fireEvent.click(screen.getByTestId('copy-invite-link-inv-1'));

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Không tạo được link kích hoạt',
          description: expect.stringContaining('not pending activation'),
        }),
      );
    });
    expect(screen.queryByTestId('generated-link-panel')).toBeNull();
    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it('revoking an invitation needs a second click to confirm, then calls the API', async () => {
    renderWithClient(<InvitationsTab />);

    const revokeBtn = screen.getByTestId('revoke-invite-inv-3');
    fireEvent.click(revokeBtn);
    expect(h.revokeInvitation).not.toHaveBeenCalled();
    expect(revokeBtn.textContent).toMatch(/bấm lần nữa/i);

    fireEvent.click(revokeBtn);
    await waitFor(() => {
      expect(h.revokeInvitation).toHaveBeenCalledWith({ id: 'inv-3' });
    });
  });

  it('shows loading and error states for invitations, and retry refetches', () => {
    h.state.invitationsLoading = true;
    const { unmount } = renderWithClient(<InvitationsTab />);
    expect(screen.getAllByTestId('invitations-loading-row').length).toBeGreaterThan(0);
    expect(screen.queryByText('reviewer.le@hcmus.edu.vn')).toBeNull();
    unmount();

    h.state.invitationsLoading = false;
    h.state.invitationsError = true;
    renderWithClient(<InvitationsTab />);
    expect(screen.getByTestId('invitations-error')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /thử lại/i }));
    expect(h.refetchInvitations).toHaveBeenCalled();
  });

  it('shows graceful empty state when search query matches no invitations', () => {
    renderWithClient(<InvitationsTab />);

    fireEvent.change(screen.getByPlaceholderText(/Tìm theo email, tên hoặc vai trò/i), {
      target: { value: 'nonexistent-user-query' },
    });

    expect(
      screen.getByText(/Không tìm thấy lời mời nào phù hợp với "nonexistent-user-query"/i),
    ).toBeDefined();
    expect(screen.queryByText(/Bạn đã xem hết danh sách lời mời/i)).toBeNull();
  });
});
