// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
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

// Import permissions page and components
import PermissionsPage from '../../src/app/permissions/page';
import { UserRoleAssignmentTab, PermissionMatrixTab, InviteMemberModal, InvitationsTab } from '@/features/permissions';
import { sileo } from '@/components/toast';

// Mock apiClient functions
const mockAssignRoleMutate = vi.fn();
const mockInviteUserMutate = vi.fn();

vi.mock('@structpaper/api-client', async () => {
  const actual = await vi.importActual<any>('@structpaper/api-client');
  return {
    ...actual,
    useAssignRole: () => ({
      mutate: mockAssignRoleMutate,
      mutateAsync: mockAssignRoleMutate.mockResolvedValue({ success: true, permissionsVersion: 6 }),
      isPending: false,
    }),
    useInviteUser: () => ({
      mutate: mockInviteUserMutate,
      mutateAsync: mockInviteUserMutate.mockResolvedValue({
        user: { id: 'user-new', email: 'newmember@vnu.edu.vn', status: 'INVITED' },
        token: 'mock-act-tok-12345',
        activationUrl: 'http://localhost:3000/activate?token=mock-act-tok-12345',
      }),
      isPending: false,
    }),
    useGetRoles: () => ({
      data: [
        { id: 'role-superadmin', name: 'SuperAdmin', isSystem: true },
        { id: 'role-journalmanager', name: 'JournalManager', isSystem: true },
        { id: 'role-editor', name: 'Editor', isSystem: true },
        { id: 'role-reviewer', name: 'Reviewer', isSystem: true },
        { id: 'role-author', name: 'Author', isSystem: true },
        { id: 'role-guest', name: 'Guest', isSystem: true },
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
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the header with title and subtitle explaining instant revocation', () => {
    renderWithClient(<PermissionsPage />);

    expect(screen.getByText(/Quản lý Phân quyền & Vai trò/i)).toBeDefined();
    expect(screen.getByText(/RBAC \/ CASL/i)).toBeDefined();
    expect(screen.getAllByText(/permissions_version|pv/i).length).toBeGreaterThan(0);
  });

  it('renders 4 elevated KPI metrics cards with accurate values and labels', () => {
    renderWithClient(<PermissionsPage />);

    expect(screen.getByText('Tổng thành viên')).toBeDefined();
    expect(screen.getByText('Tài khoản đã kích hoạt')).toBeDefined();
    expect(screen.getByText('6 Roles')).toBeDefined();
    expect(screen.getByText('Immutable Baseline')).toBeDefined();
    expect(screen.getByText('7 Tạp chí')).toBeDefined();
    expect(screen.getByText('ĐHQG-HCM Scoped')).toBeDefined();
    expect(screen.getByText('3 Chờ kích hoạt')).toBeDefined();
    expect(screen.getByText('Pending Invites')).toBeDefined();
  });

  it('renders the sticky header toolbar with mask and invite member action', () => {
    renderWithClient(<PermissionsPage />);

    const header = screen.getByTestId('permissions-header');
    expect(header).toBeDefined();
    expect(screen.getByRole('button', { name: /Mời thành viên mới/i })).toBeDefined();
  });

  it('renders three tabs: User & Role Assignment, Permission Matrix, and Invitations', () => {
    renderWithClient(<PermissionsPage />);

    // 3 Tab buttons
    expect(screen.getByRole('tab', { name: /Người dùng & Vai trò/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Ma trận Phân quyền/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Lời mời tham gia/i })).toBeDefined();
  });

  it('switches between tabs when clicking tab headers', () => {
    renderWithClient(<PermissionsPage />);

    // Default tab is User & Role Assignment
    expect(screen.getAllByText(/Mời thành viên mới/i).length).toBeGreaterThan(0);

    // Switch to Permission Matrix tab
    const matrixTab = screen.getByRole('tab', { name: /Ma trận Phân quyền/i });
    fireEvent.click(matrixTab);

    // Permission Matrix should display subjects and system baseline badge
    expect(screen.getAllByText(/Manuscript/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/System Baseline/i).length).toBeGreaterThan(0);

    // Switch to Invitations tab
    const invitesTab = screen.getByRole('tab', { name: /Lời mời tham gia/i });
    fireEvent.click(invitesTab);

    // Invitations tab should display pending invitations
    expect(screen.getAllByText(/Chờ kích hoạt|Pending/i).length).toBeGreaterThan(0);
  });

  it('modifying a user role calls the role assignment mutation with instant feedback', async () => {
    renderWithClient(<PermissionsPage />);

    // Find role selects for users
    const userRoleSelects = screen.getAllByLabelText(/phân vai trò cho/i);
    expect(userRoleSelects.length).toBeGreaterThan(0);

    // Change role of a user to Editor
    fireEvent.change(userRoleSelects[0], { target: { value: 'Editor' } });

    await waitFor(() => {
      expect(mockAssignRoleMutate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            roleId: 'Editor',
          }),
        })
      );
    });
  });

  it('permission matrix correctly shows system roles as immutable baselines and displays actions/subjects', () => {
    renderWithClient(<PermissionMatrixTab />);

    // Actions & Subjects
    expect(screen.getAllByText(/create/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/manage/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manuscript/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Journal/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Asset/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SuperAdmin/i).length).toBeGreaterThan(0);

    // Baseline notice
    expect(screen.getAllByText(/System Baseline/i).length).toBeGreaterThan(0);
  });

  it('PermissionMatrixTab renders subject filter chips, filters matrix rows, and shows end-of-list divider', () => {
    renderWithClient(<PermissionMatrixTab />);

    // Check subject filter pills
    const allChip = screen.getByTestId('subject-filter-all');
    const manuscriptChip = screen.getByTestId('subject-filter-manuscript');
    const userChip = screen.getByTestId('subject-filter-user');
    expect(allChip).toBeDefined();
    expect(manuscriptChip).toBeDefined();
    expect(userChip).toBeDefined();

    // Verify all subjects visible initially
    expect(screen.getByText(/Bản thảo \(Manuscript\)/i)).toBeDefined();
    expect(screen.getByText(/Người dùng \(User\)/i)).toBeDefined();
    expect(screen.getByText(/Tạp chí \(Journal\)/i)).toBeDefined();

    // Filter to only Manuscript
    fireEvent.click(manuscriptChip);
    expect(screen.getByText(/Bản thảo \(Manuscript\)/i)).toBeDefined();
    expect(screen.queryByText(/Người dùng \(User\)/i)).toBeNull();

    // Switch back to ALL
    fireEvent.click(allChip);
    expect(screen.getByText(/Bản thảo \(Manuscript\)/i)).toBeDefined();
    expect(screen.getByText(/Người dùng \(User\)/i)).toBeDefined();

    // End-of-list divider
    expect(screen.getByText(/Bạn đã xem hết ma trận phân quyền hệ thống/i)).toBeDefined();
  });

  it('opens InviteMemberModal, fills form, submits invitation, and displays activation link with copy button', async () => {
    const handleClose = vi.fn();
    renderWithClient(<InviteMemberModal isOpen={true} onClose={handleClose} />);

    // Form fields
    const emailInput = screen.getByLabelText(/email/i);
    const roleSelect = screen.getByLabelText(/vai trò|role/i);
    const submitBtn = screen.getByRole('button', { name: /gửi lời mời/i });

    fireEvent.change(emailInput, { target: { value: 'newmember@vnu.edu.vn' } });
    fireEvent.change(roleSelect, { target: { value: 'Reviewer' } });
    fireEvent.click(submitBtn);

    // Verification of mutation call
    await waitFor(() => {
      expect(mockInviteUserMutate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'newmember@vnu.edu.vn',
          role: 'Reviewer',
        }),
      });
    });

    // Activation link should be displayed in staging/dev mode
    await waitFor(() => {
      expect(screen.getByDisplayValue(/\/activate\?token=/i)).toBeDefined();
    });

    // Copy link button
    const copyBtn = screen.getByRole('button', { name: /sao chép link/i });
    fireEvent.click(copyBtn);
    expect(mockWriteText).toHaveBeenCalled();
  });

  it('UserRoleAssignmentTab renders search bar, status chips, role filter, and end of list divider', () => {
    renderWithClient(<UserRoleAssignmentTab />);

    // Search input
    expect(screen.getByPlaceholderText(/Tìm theo email hoặc họ tên/i)).toBeDefined();

    // Status filter chips
    expect(screen.getByTestId('status-filter-all')).toBeDefined();
    expect(screen.getByTestId('status-filter-active')).toBeDefined();
    expect(screen.getByTestId('status-filter-invited')).toBeDefined();
    expect(screen.getByTestId('status-filter-suspended')).toBeDefined();

    // End-of-list divider
    expect(screen.getByText(/Bạn đã xem hết danh sách thành viên/i)).toBeDefined();
  });

  it('filters users by search query and clear button resets search', () => {
    renderWithClient(<UserRoleAssignmentTab />);

    const searchInput = screen.getByPlaceholderText(/Tìm theo email hoặc họ tên/i);
    fireEvent.change(searchInput, { target: { value: 'GS. TSKH' } });

    expect(screen.getByText(/GS. TSKH. Nguyễn Hoàng Nam/i)).toBeDefined();
    expect(screen.queryByText(/PGS. TS. Trần Minh Tuấn/i)).toBeNull();

    // Clear search button
    const clearBtn = screen.getByTitle('Xóa tìm kiếm');
    fireEvent.click(clearBtn);

    expect(screen.getByText(/PGS. TS. Trần Minh Tuấn/i)).toBeDefined();
  });

  it('filters users by status filter chips and role select', () => {
    renderWithClient(<UserRoleAssignmentTab />);

    // Click INVITED chip
    const invitedChip = screen.getByTestId('status-filter-invited');
    fireEvent.click(invitedChip);

    expect(screen.getByText(/collaborator.guest@vnu.edu.vn/i)).toBeDefined();
    expect(screen.queryByText(/admin@structpaper.org/i)).toBeNull();

    // Back to ALL
    fireEvent.click(screen.getByTestId('status-filter-all'));
    expect(screen.getByText(/admin@structpaper.org/i)).toBeDefined();

    // Filter by role
    const roleSelect = screen.getByTestId('filter-role-select');
    fireEvent.change(roleSelect, { target: { value: 'SuperAdmin' } });

    expect(screen.getByText(/admin@structpaper.org/i)).toBeDefined();
    expect(screen.queryByText(/PGS. TS. Trần Minh Tuấn/i)).toBeNull();
  });

  it('changing a user role triggers sileo.success with instant revocation message', async () => {
    const sileoSpy = vi.spyOn(sileo, 'success');
    renderWithClient(<UserRoleAssignmentTab />);

    const userRoleSelects = screen.getAllByLabelText(/phân vai trò cho/i);
    fireEvent.change(userRoleSelects[0], { target: { value: 'Reviewer' } });

    await waitFor(() => {
      expect(sileoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Cập nhật phân quyền tức thì',
          description: expect.stringContaining('Đã phân vai trò "Reviewer"'),
        })
      );
    });
  });

  it('InvitationsTab renders search bar, quick action button, table rows, and end-of-list divider', () => {
    renderWithClient(<InvitationsTab />);

    // Search input
    expect(screen.getByPlaceholderText(/Tìm theo email, tên hoặc token/i)).toBeDefined();

    // Quick action button
    expect(screen.getByRole('button', { name: /Mời thành viên mới/i })).toBeDefined();

    // Table rows
    expect(screen.getByText(/collaborator.guest@vnu.edu.vn/i)).toBeDefined();
    expect(screen.getByText(/reviewer.le@hcmus.edu.vn/i)).toBeDefined();
    expect(screen.getByText(/editor.tran@medvnu.edu.vn/i)).toBeDefined();

    // End-of-list divider
    expect(screen.getByText(/Bạn đã xem hết danh sách lời mời/i)).toBeDefined();
  });

  it('filters invitations by search query and clear button resets search', () => {
    renderWithClient(<InvitationsTab />);

    const searchInput = screen.getByPlaceholderText(/Tìm theo email, tên hoặc token/i);
    fireEvent.change(searchInput, { target: { value: 'reviewer.le' } });

    expect(screen.getByText(/TS. Lê Hải Đăng/i)).toBeDefined();
    expect(screen.queryByText(/ThS. Trần Thị Kim Cương/i)).toBeNull();

    // Clear search button
    const clearBtn = screen.getByTitle('Xóa tìm kiếm');
    fireEvent.click(clearBtn);

    expect(screen.getByText(/ThS. Trần Thị Kim Cương/i)).toBeDefined();
  });

  it('clicking copy link calls clipboard.writeText and triggers sileo.success feedback', async () => {
    const sileoSpy = vi.spyOn(sileo, 'success');
    renderWithClient(<InvitationsTab />);

    const copyBtns = screen.getAllByTitle('Sao chép liên kết kích hoạt');
    expect(copyBtns.length).toBeGreaterThan(0);

    fireEvent.click(copyBtns[0]);

    expect(mockWriteText).toHaveBeenCalledWith(
      expect.stringContaining('/activate?token=tok_guest_vnuhcm_78901')
    );

    await waitFor(() => {
      expect(sileoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Đã sao chép link kích hoạt',
          description: expect.stringContaining('collaborator.guest@vnu.edu.vn'),
        })
      );
    });
  });

  it('clicking resend button triggers onResendInvite callback and triggers sileo.info feedback', async () => {
    const sileoInfoSpy = vi.spyOn(sileo, 'info');
    const mockOnResend = vi.fn();
    renderWithClient(<InvitationsTab onResendInvite={mockOnResend} />);

    const resendBtns = screen.getAllByTitle('Gửi lại email kích hoạt');
    expect(resendBtns.length).toBeGreaterThan(0);

    fireEvent.click(resendBtns[0]);

    expect(mockOnResend).toHaveBeenCalledWith('inv-1');
    await waitFor(() => {
      expect(sileoInfoSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Đã gửi lại lời mời',
          description: expect.stringContaining('collaborator.guest@vnu.edu.vn'),
        })
      );
    });
  });

  it('shows graceful empty state when search query matches no invitations', () => {
    renderWithClient(<InvitationsTab />);

    const searchInput = screen.getByPlaceholderText(/Tìm theo email, tên hoặc token/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent-user-query' } });

    expect(
      screen.getByText(/Không tìm thấy lời mời nào phù hợp với "nonexistent-user-query"/i)
    ).toBeDefined();
    expect(screen.queryByText(/Bạn đã xem hết danh sách lời mời/i)).toBeNull();
  });
});
