import { Injectable, Inject, Optional } from '@nestjs/common';
import {
  AbilityBuilder,
  createMongoAbility,
  MongoAbility,
  subject,
} from '@casl/ability';
import { NON_DELETABLE_STATUSES } from '@structpaper/contracts';
import {
  userRoles,
  roles,
  manuscriptMembers,
  eq,
  GLOBAL_SCOPE_ID,
} from '@structpaper/db';

export type Action = 'manage' | 'create' | 'read' | 'update' | 'delete' | string;
export type Subject = 'all' | 'Manuscript' | 'User' | 'Role' | 'Journal' | 'Permission' | any;

export type AppAbility = MongoAbility<[Action, any]>;


export { subject };

export interface UserRoleAssignment {
  name: string;
  scopeJournalId?: string | null;
}

export interface UserManuscriptMember {
  manuscriptId: string;
  role: string;
}

export interface CustomPermission {
  action: string;
  subject: string;
  conditions?: Record<string, any> | null;
}

export interface UserAbilityContext {
  userId?: string;
  roles?: (UserRoleAssignment | string)[];
  manuscriptMemberships?: UserManuscriptMember[];
  permissions?: CustomPermission[];
}

@Injectable()
export class AbilityFactory {
  constructor(
    @Optional()
    @Inject('DRIZZLE')
    private readonly db?: any,
  ) {}

  /**
   * Constructs CASL MongoAbility based on user roles, scoped journals, and manuscript memberships.
   */
  async createForUser(
    userIdOrContext: string | UserAbilityContext,
    explicitContext?: UserAbilityContext,
  ): Promise<AppAbility> {
    let context: UserAbilityContext;

    if (typeof userIdOrContext === 'string') {
      if (explicitContext) {
        context = { ...explicitContext, userId: userIdOrContext };
      } else {
        context = await this.loadContextFromDatabase(userIdOrContext);
      }
    } else {
      context = userIdOrContext;
    }

    return this.buildAbility(context);
  }

  private buildAbility(context: UserAbilityContext): AppAbility {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    const userRolesList = context.roles || [];
    const normalizedRoles: UserRoleAssignment[] = userRolesList.map((r) =>
      typeof r === 'string' ? { name: r } : r,
    );

    const memberships = context.manuscriptMemberships || [];

    // 1. Check SuperAdmin -> Global wildcard ability
    const isSuperAdmin = normalizedRoles.some((r) => r.name === 'SuperAdmin');
    if (isSuperAdmin) {
      can('manage', 'all');
      return build({
        detectSubjectType: (item: any) =>
          typeof item === 'string'
            ? item
            : item?.__caslSubjectType__ || item?.type || (item?.constructor as any)?.name || 'all',
      });
    }

    // 2. Journal Scope (JournalManager & Editor)
    for (const r of normalizedRoles) {
      const scopeJournalId = r.scopeJournalId;

      if (r.name === 'JournalManager') {
        if (!scopeJournalId || scopeJournalId === GLOBAL_SCOPE_ID) {
          can('manage', 'Manuscript');
          can('manage', 'Journal');
          can('manage', 'Role');
        } else {
          can('manage', 'Manuscript', { journalId: scopeJournalId });
          can(['read', 'update'], 'Journal', { id: scopeJournalId });
          can('manage', 'Role', { journalId: scopeJournalId });
        }
      }

      // Editors only get journal visibility; manuscripts are reached through
      // ownership / sharing (manuscript_members, general access), never by role alone.
      if (r.name === 'Editor') {
        if (!scopeJournalId || scopeJournalId === GLOBAL_SCOPE_ID) {
          can('read', 'Journal');
        } else {
          can('read', 'Journal', { id: scopeJournalId });
        }
        can('create', 'Manuscript');
      }

      if (r.name === 'Author') {
        can('create', 'Manuscript');
      }
    }

    // 3. Manuscript ACL (Author & Reviewer evaluated via manuscript_members)
    const idsFor = (...roles: string[]) =>
      memberships.filter((m) => roles.includes(m.role)).map((m) => m.manuscriptId);

    const ownerIds = idsFor('OWNER');
    const writerIds = idsFor('OWNER', 'COAUTHOR', 'EDITOR');
    const readerIds = idsFor('OWNER', 'COAUTHOR', 'EDITOR', 'REVIEWER', 'VIEWER');

    if (readerIds.length > 0) can('read', 'Manuscript', { id: { $in: readerIds } });
    if (writerIds.length > 0) can('update', 'Manuscript', { id: { $in: writerIds } });
    if (ownerIds.length > 0) {
      can('share', 'Manuscript', { id: { $in: ownerIds } });
      can('delete', 'Manuscript', { id: { $in: ownerIds }, status: { $nin: NON_DELETABLE_STATUSES } });
    }

    // Whoever created a manuscript owns it, even before the membership row is in their cached ability.
    if (context.userId) {
      can(['read', 'update', 'share'], 'Manuscript', { createdBy: context.userId });
      can('delete', 'Manuscript', { createdBy: context.userId, status: { $nin: NON_DELETABLE_STATUSES } });
    }

    // General access ("anyone in the system"): evaluated on the manuscript row itself.
    // Not used by the list query, so shared-with-everyone papers do not flood everybody's list.
    can('read', 'Manuscript', { generalAccess: { $in: ['VIEWER', 'EDITOR'] } });
    if (context.userId) can('update', 'Manuscript', { generalAccess: 'EDITOR' }); // guests only read

    // Custom Permissions (from DB or matrix if provided)
    if (context.permissions) {
      for (const p of context.permissions) {
        if (p.conditions) {
          can(p.action as Action, p.subject as Subject, p.conditions);
        } else {
          can(p.action as Action, p.subject as Subject);
        }
      }
    }

    return build({
      detectSubjectType: (item: any) =>
        typeof item === 'string'
          ? item
          : item?.__caslSubjectType__ || item?.type || (item?.constructor as any)?.name || 'all',
    });
  }

  private async loadContextFromDatabase(userId: string): Promise<UserAbilityContext> {
    if (!this.db) {
      return { userId, roles: [], manuscriptMemberships: [], permissions: [] };
    }

    let loadedRoles: UserRoleAssignment[] = [];
    try {
      const roleRows = await this.db
        .select({
          roleName: roles.name,
          scopeJournalId: userRoles.scopeJournalId,
        })
        .from(userRoles)
        .leftJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, userId));

      loadedRoles = (roleRows || []).map((row: any) => ({
        name: row.roleName,
        scopeJournalId: row.scopeJournalId,
      }));
    } catch {
      loadedRoles = [];
    }

    let loadedMembers: UserManuscriptMember[] = [];
    try {
      const memberRows = await this.db
        .select({
          manuscriptId: manuscriptMembers.manuscriptId,
          role: manuscriptMembers.role,
        })
        .from(manuscriptMembers)
        .where(eq(manuscriptMembers.userId, userId));

      loadedMembers = (memberRows || []).map((row: any) => ({
        manuscriptId: row.manuscriptId,
        role: row.role,
      }));
    } catch {
      loadedMembers = [];
    }

    return {
      userId,
      roles: loadedRoles,
      manuscriptMemberships: loadedMembers,
    };
  }
}
