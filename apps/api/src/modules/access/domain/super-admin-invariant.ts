import { ConflictException, ForbiddenException } from '@nestjs/common';
import { users, userRoles, roles, eq, and } from '@structpaper/db';

export const SUPER_ADMIN_ROLE = 'SuperAdmin';

export const SELF_CHANGE_ROLE_MESSAGE =
  'You cannot change your own roles. Ask another administrator to do it.';
export const SELF_CHANGE_STATUS_MESSAGE =
  'You cannot change your own account status. Ask another administrator to do it.';
export const LAST_SUPER_ADMIN_MESSAGE =
  'At least one active SuperAdmin must remain. Make another user SuperAdmin first.';

export const isSuperAdminRole = (name?: string | null): boolean =>
  !!name && name.toLowerCase() === SUPER_ADMIN_ROLE.toLowerCase();

/** Nobody changes their own roles or status (not even SuperAdmin): another administrator must. */
export function assertNotSelf(callerId: string | undefined | null, targetUserId: string, message: string): void {
  if (callerId && callerId === targetUserId) {
    throw new ForbiddenException(message);
  }
}

/**
 * Invariant: the system always keeps at least one ACTIVE SuperAdmin.
 *
 * Call it INSIDE a transaction, right before an operation that would remove SuperAdmin power from
 * `targetUserId` (revoking the SuperAdmin role, suspending the account). The active SuperAdmin
 * rows are locked (`FOR UPDATE`), so two administrators demoting each other at the same moment
 * are serialised: the second one re-counts after the first committed and is refused.
 */
export async function assertNotLastActiveSuperAdmin(executor: any, targetUserId: string): Promise<void> {
  const rows: Array<{ id: string }> = await executor
    .select({ id: users.id })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .innerJoin(roles, eq(roles.id, userRoles.roleId))
    .where(and(eq(roles.name, SUPER_ADMIN_ROLE), eq(users.status, 'ACTIVE')))
    .for('update', { of: users });

  const activeSuperAdmins = new Set(rows.map((row) => row.id));
  if (activeSuperAdmins.has(targetUserId) && activeSuperAdmins.size === 1) {
    throw new ConflictException(LAST_SUPER_ADMIN_MESSAGE);
  }
}
