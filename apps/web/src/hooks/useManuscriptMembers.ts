import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetManuscriptMembers,
  useAddManuscriptMember,
  useRemoveManuscriptMember,
  isMockModeEnabled,
  type AddManuscriptMemberRequest,
  type ManuscriptMember,
} from '@structpaper/api-client';
import { sileo } from '@/components/DynamicIslandToast';

export interface UseManuscriptMembersOptions {
  showToast?: boolean;
}

export interface UseManuscriptMembersReturn {
  members: ManuscriptMember[];
  isLoading: boolean;
  isError: boolean;
  error: any;
  refetch: () => void;
  addMember: (data: AddManuscriptMemberRequest) => Promise<ManuscriptMember | null>;
  removeMember: (userId: string) => Promise<boolean>;
  isAdding: boolean;
  isRemoving: boolean;
}

export function useManuscriptMembers(
  manuscriptId: string,
  options: UseManuscriptMembersOptions = {},
): UseManuscriptMembersReturn {
  const queryClient = useQueryClient();
  const isMock = isMockModeEnabled();
  const validId = Boolean(manuscriptId && manuscriptId.trim().length > 0);

  const queryKey = [`/api/v1/manuscripts/${manuscriptId}/members`];

  const {
    data: members = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useGetManuscriptMembers(manuscriptId, {
    query: {
      enabled: validId && !isMock,
    },
  });

  const addMutation = useAddManuscriptMember();
  const removeMutation = useRemoveManuscriptMember();

  const addMember = useCallback(
    async (data: AddManuscriptMemberRequest): Promise<ManuscriptMember | null> => {
      try {
        const result = await addMutation.mutateAsync({
          id: manuscriptId,
          data,
        });

        queryClient.invalidateQueries({ queryKey });

        if (options.showToast !== false) {
          sileo.success({
            title: 'Thêm thành viên thành công',
            description: `Đã phân quyền ${data.role} cho thành viên.`,
          });
        }
        return result;
      } catch (err: any) {
        const msg =
          err?.detail ||
          err?.response?.data?.detail ||
          err?.message ||
          'Không thể thêm thành viên vào bài báo.';
        if (options.showToast !== false) {
          sileo.error({
            title: 'Lỗi thêm thành viên',
            description: msg,
          });
        }
        throw err;
      }
    },
    [manuscriptId, addMutation, queryClient, queryKey, options],
  );

  const removeMember = useCallback(
    async (userId: string): Promise<boolean> => {
      try {
        await removeMutation.mutateAsync({
          id: manuscriptId,
          userId,
        });

        queryClient.invalidateQueries({ queryKey });

        if (options.showToast !== false) {
          sileo.success({
            title: 'Gỡ thành viên thành công',
            description: 'Đã hủy quyền truy cập của thành viên.',
          });
        }
        return true;
      } catch (err: any) {
        const msg =
          err?.detail ||
          err?.response?.data?.detail ||
          err?.message ||
          'Không thể gỡ thành viên khỏi bài báo.';
        if (options.showToast !== false) {
          sileo.error({
            title: 'Lỗi gỡ thành viên',
            description: msg,
          });
        }
        throw err;
      }
    },
    [manuscriptId, removeMutation, queryClient, queryKey, options],
  );

  return {
    members: Array.isArray(members) ? members : [],
    isLoading,
    isError,
    error,
    refetch,
    addMember,
    removeMember,
    isAdding: addMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
