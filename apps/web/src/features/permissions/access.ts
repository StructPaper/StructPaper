import { useMemo } from 'react';
import { useAccess, type Access } from '@/lib/access';

export type PermissionsTabKey = 'users' | 'matrix' | 'invitations';

/**
 * What the permissions page lets the current user see and do, named by business meaning.
 * The page and its tabs ask THIS, never "is the user an admin?" (see docs/Architecture, RBAC on
 * the frontend). Combined rules live here once instead of being repeated as `if`s in the JSX.
 *
 * Everybody can open the page and read the permission matrix. Everything that manages people
 * needs a capability that the server decides with the same rules as its API guards.
 */
export function permissionsPolicy(access: Access) {
  const canManageMembers = access.can('member:manage');
  const canAssignRoles = access.can('role:assign');
  const canGrantSuperAdmin = access.can('role:grant_superadmin');

  const visibleTabs: PermissionsTabKey[] = canManageMembers
    ? ['users', 'matrix', 'invitations']
    : ['matrix'];

  return {
    /** Capabilities still loading: show placeholders instead of guessing. */
    loading: access.status === 'loading',
    canManageMembers,
    /** Change roles of other users (the role select in the members table). */
    canAssignRoles,
    /** Offer the SuperAdmin role (only SuperAdmin may grant it). */
    canGrantSuperAdmin,
    /** Tabs of the page: managers get all three, everybody else only the matrix. */
    visibleTabs,
  };
}

export type PermissionsPolicy = ReturnType<typeof permissionsPolicy>;

export function usePermissionsPolicy(): PermissionsPolicy {
  const access = useAccess();
  return useMemo(() => permissionsPolicy(access), [access]);
}
