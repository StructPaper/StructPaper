// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useManuscriptMembers } from '@/hooks/useManuscriptMembers';

const mockAddMemberMutate = vi.fn();
const mockRemoveMemberMutate = vi.fn();

let mockGetMembersReturn = {
  data: [
    {
      userId: 'user-owner',
      role: 'OWNER',
      user: { id: 'user-owner', email: 'owner@vnu.edu.vn', name: 'GS. Nguyen' },
    },
  ],
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

vi.mock('@structpaper/api-client', async () => {
  const actual = await vi.importActual<any>('@structpaper/api-client');
  return {
    ...actual,
    useGetManuscriptMembers: () => mockGetMembersReturn,
    useAddManuscriptMember: () => ({
      mutateAsync: mockAddMemberMutate,
      isPending: false,
    }),
    useRemoveManuscriptMember: () => ({
      mutateAsync: mockRemoveMemberMutate,
      isPending: false,
    }),
  };
});

vi.mock('@/components/DynamicIslandToast', () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useManuscriptMembers Custom Hook (Task 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists manuscript members', () => {
    const { result } = renderHook(() => useManuscriptMembers('ms-123', { showToast: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.members).toHaveLength(1);
    expect(result.current.members[0].role).toBe('OWNER');
    expect(result.current.members[0].user?.email).toBe('owner@vnu.edu.vn');
  });

  it('adds a new member with role', async () => {
    mockAddMemberMutate.mockResolvedValueOnce({
      id: 'member-new',
      manuscriptId: 'ms-123',
      userId: 'user-editor',
      role: 'EDITOR',
    });

    const { result } = renderHook(() => useManuscriptMembers('ms-123', { showToast: false }), {
      wrapper: createWrapper(),
    });

    let res: any = null;
    await act(async () => {
      res = await result.current.addMember({
        userId: 'user-editor',
        role: 'EDITOR',
      });
    });

    expect(mockAddMemberMutate).toHaveBeenCalledWith({
      id: 'ms-123',
      data: expect.objectContaining({
        userId: 'user-editor',
        role: 'EDITOR',
      }),
    });
    expect(res).toBeDefined();
    expect(res?.role).toBe('EDITOR');
  });

  it('removes a member', async () => {
    mockRemoveMemberMutate.mockResolvedValueOnce({ success: true });

    const { result } = renderHook(() => useManuscriptMembers('ms-123', { showToast: false }), {
      wrapper: createWrapper(),
    });

    let success = false;
    await act(async () => {
      success = await result.current.removeMember('user-editor');
    });

    expect(mockRemoveMemberMutate).toHaveBeenCalledWith({
      id: 'ms-123',
      userId: 'user-editor',
    });
    expect(success).toBe(true);
  });
});
