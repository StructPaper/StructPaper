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
import { UserRoleAssignmentTab, PermissionMatrixTab, InviteMemberModal } from '@/features/permissions';
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
    expect(screen.getAllByText(/bất biến|immutable/i).length).toBeGreaterThan(0);

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
    expect(screen.getAllByText(/bất biến|immutable/i).length).toBeGreaterThan(0);
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
});
