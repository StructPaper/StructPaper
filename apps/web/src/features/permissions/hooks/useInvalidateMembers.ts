import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getListUsersQueryKey, getListInvitationsQueryKey } from '@structpaper/api-client';

/**
 * Returns a function that refreshes everything showing members: the users table
 * (every pagination/search variant) and the pending-invitations table.
 */
export function useInvalidateMembers() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await Promise.all([
      // `getListUsersQueryKey()` is the shared prefix of every list-users query.
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey() }),
    ]);
  }, [queryClient]);
}
