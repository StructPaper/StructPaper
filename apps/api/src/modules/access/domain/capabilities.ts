import { CAPABILITY_KEYS, type Capability } from '@structpaper/contracts';
import { AbilityFactory, type AppAbility } from './ability.factory';
import type { UserRoleView } from './user-role-views';

/**
 * Single source of truth for "who may do what" at the level the UI cares about.
 *
 * The very same predicates are used by the controllers' @CheckPolicies guards AND to tell the
 * frontend which capabilities the logged-in user has (GET /auth/me), so a button is shown exactly
 * when the API would accept the action.
 */
export const canManageMembers = (ability: AppAbility): boolean =>
  ability.can('manage', 'all') || ability.can('manage', 'Role');

export const canAssignRoles = (ability: AppAbility): boolean =>
  ability.can('manage', 'all') || ability.can('manage', 'Role');

export const canGrantSuperAdmin = (ability: AppAbility): boolean => ability.can('manage', 'all');

/** One rule per capability: adding a key to CAPABILITIES without a rule does not compile. */
export const CAPABILITY_RULES: Record<Capability, (ability: AppAbility) => boolean> = {
  'member:manage': canManageMembers,
  'role:assign': canAssignRoles,
  'role:grant_superadmin': canGrantSuperAdmin,
};

/** The capabilities an ability grants (stable order, same as the catalogue). */
export function evaluateCapabilities(ability: AppAbility): Capability[] {
  return CAPABILITY_KEYS.filter((key) => CAPABILITY_RULES[key](ability));
}

/** Capabilities for a user described only by the roles they hold (no database needed). */
export async function capabilitiesForRoles(roleViews: UserRoleView[]): Promise<Capability[]> {
  const ability = await new AbilityFactory().createForUser({
    roles: roleViews.map((r) => ({ name: r.roleName, scopeJournalId: r.scopeJournalId })),
  });
  return evaluateCapabilities(ability);
}
