import { userRoles, roles, journals, eq, inArray, GLOBAL_SCOPE_ID } from '@structpaper/db';

/** A role held by a user; `scopeJournalId = null` means "whole system". */
export interface UserRoleView {
  roleName: string;
  scopeJournalId: string | null;
  scopeJournalName: string | null;
}

/** Role assignments (with journal names) for a batch of users, keyed by user id. */
export async function loadUserRoleViews(db: any, userIds: string[]): Promise<Map<string, UserRoleView[]>> {
  const result = new Map<string, UserRoleView[]>();
  if (!db || userIds.length === 0) return result;

  const rows: any[] = await db
    .select({
      userId: userRoles.userId,
      roleName: roles.name,
      scopeJournalId: userRoles.scopeJournalId,
      journalName: journals.name,
    })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .leftJoin(journals, eq(userRoles.scopeJournalId, journals.id))
    .where(inArray(userRoles.userId, userIds));

  for (const row of rows) {
    const isGlobal = !row.scopeJournalId || row.scopeJournalId === GLOBAL_SCOPE_ID;
    const view: UserRoleView = {
      roleName: row.roleName,
      scopeJournalId: isGlobal ? null : row.scopeJournalId,
      scopeJournalName: isGlobal ? null : row.journalName ?? null,
    };
    const list = result.get(row.userId);
    if (list) list.push(view);
    else result.set(row.userId, [view]);
  }
  return result;
}
