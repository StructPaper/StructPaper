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

/** True when some rule lets the user read EVERY manuscript (no condition), not just their own. */
export const canReadAllManuscripts = (ability: AppAbility): boolean =>
  ability.rules.some((rule: any) => {
    if (rule.inverted || rule.conditions) return false;
    const subjects = Array.isArray(rule.subject) ? rule.subject : [rule.subject];
    const actions = Array.isArray(rule.action) ? rule.action : [rule.action];
    return subjects.some((x: string) => x === 'Manuscript' || x === 'all') && actions.some((a: string) => a === 'read' || a === 'manage');
  });

export const canManageJournals = (ability: AppAbility): boolean => ability.can('create', 'Journal');

/**
 * Managing the trash of OTHER people: journal managers (of every journal, or of their own) and SuperAdmin. Both hold "manage" over
 * manuscripts. Everybody else still has a trash of their own: the papers they deleted, which they can restore.
 */
export const canManageTrash = (ability: AppAbility): boolean => ability.can('manage', 'all') || ability.can('manage', 'Manuscript');

/** One rule per capability: adding a key to CAPABILITIES without a rule does not compile. */
export const CAPABILITY_RULES: Record<Capability, (ability: AppAbility) => boolean> = {
  'member:manage': canManageMembers,
  'role:assign': canAssignRoles,
  'role:grant_superadmin': canGrantSuperAdmin,
  'journal:manage': canManageJournals,
  'manuscript:read_all': canReadAllManuscripts,
  'trash:manage': canManageTrash,
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
