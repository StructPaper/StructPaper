import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetManuscriptMembers,
  useAddManuscriptMember,
  useRemoveManuscriptMember,
  useSetManuscriptGeneralAccess,
  useSearchManuscriptPeople,
  getGetManuscriptMembersQueryKey,
  getGetManuscriptQueryKey,
  getListManuscriptsQueryKey,
  type GeneralAccess,
  type PersonResult,
} from '@structpaper/api-client';
import { apiErrorMessage } from '@/features/permissions/utils';
import type { ShareRole } from '../labels';

/** Wait until the user stops typing before asking the server. */
export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/** Everything the share dialog needs for ONE manuscript: who has access, and how to change it. */
export function useManuscriptSharing(manuscriptId: string, enabled: boolean) {
  const queryClient = useQueryClient();
  const sharing = useGetManuscriptMembers(manuscriptId, { query: { enabled: enabled && !!manuscriptId } });

  // The dialog shows its own errors, so skip the generic network toast.
  const add = useAddManuscriptMember({ request: { skipGlobalToast: true } });
  const remove = useRemoveManuscriptMember({ request: { skipGlobalToast: true } });
  const setGeneral = useSetManuscriptGeneralAccess({ request: { skipGlobalToast: true } });

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetManuscriptMembersQueryKey(manuscriptId) }),
      queryClient.invalidateQueries({ queryKey: getGetManuscriptQueryKey(manuscriptId) }),
      queryClient.invalidateQueries({ queryKey: getListManuscriptsQueryKey() }),
    ]);
  }, [queryClient, manuscriptId]);

  return {
    generalAccess: (sharing.data?.generalAccess ?? 'RESTRICTED') as GeneralAccess,
    members: sharing.data?.members ?? [],
    isLoading: sharing.isLoading,
    isError: sharing.isError,
    reload: sharing.refetch,
    isBusy: add.isPending || remove.isPending || setGeneral.isPending,
    errorMessage: (err: unknown) => apiErrorMessage(err, 'Không thể cập nhật quyền truy cập. Vui lòng thử lại.'),

    addOrChangeRole: async (userId: string, role: ShareRole) => {
      await add.mutateAsync({ id: manuscriptId, data: { userId, role } });
      await refresh();
    },
    removeMember: async (userId: string) => {
      await remove.mutateAsync({ id: manuscriptId, userId });
      await refresh();
    },
    changeGeneralAccess: async (generalAccess: GeneralAccess) => {
      await setGeneral.mutateAsync({ id: manuscriptId, data: { generalAccess } });
      await refresh();
    },
  };
}

/** Finds active members by email (min. 2 characters), already debounced. */
export function usePeopleSearch(text: string): { results: PersonResult[]; isSearching: boolean } {
  const q = useDebouncedValue(text.trim());
  const enabled = q.length >= 2;
  const query = useSearchManuscriptPeople({ q }, { query: { enabled, staleTime: 15_000 } });
  return {
    results: enabled ? (query.data ?? []) : [],
    isSearching: enabled && query.isFetching,
  };
}
