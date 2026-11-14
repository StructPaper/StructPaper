import {
  Injectable,
  Inject,
  Optional,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  users,
  userRoles,
  roles,
  permissions,
  eq,
  and,
  sql,
  GLOBAL_SCOPE_ID,
} from '@structpaper/db';
import type { AssignRole, RevokeRole, Role, Permission } from '@structpaper/contracts';
import { AbilityCacheService } from '../domain/ability-cache.service';
import { subject, type AppAbility } from '../domain/ability.factory';

@Injectable()
export class AccessService {
  constructor(
    @Optional()
    @Inject(AbilityCacheService)
    private readonly abilityCache?: AbilityCacheService,
    @Optional()
    @Inject('DRIZZLE')
    private readonly db?: any,
  ) {}

  /**
   * Retrieves all roles (system roles with isSystem: true, plus journal-specific custom roles).
   */
  async getRoles(): Promise<Role[]> {
    if (!this.db) {
      return [];
    }

    const rows = await this.db.select().from(roles);
    return rows;
  }

  /**
   * Retrieves all available permissions for the permission matrix.
   */
  async getPermissions(): Promise<Permission[]> {
    if (!this.db) {
      return [];
    }

    const rows = await this.db.select().from(permissions);
    return rows;
  }

  /**
   * Assigns a role to a user within a journal scope (or global),
   * strictly checks against privilege escalation,
   * increments users.permissions_version for instant session revocation,
   * and invalidates ability cache entries for the user.
   */
  async assignRole(
    dto: AssignRole,
    callerUser?: any,
    callerAbility?: AppAbility,
  ): Promise<{ success: boolean; permissionsVersion?: number }> {
    const scopeJournalId = dto.journalId || GLOBAL_SCOPE_ID;

    // 1. Resolve role from DB to verify existence and check name
    const targetRole = await this.resolveRole(dto.roleId);
    const targetRoleName = targetRole?.name || dto.roleId;
    const targetRoleId = targetRole?.id || dto.roleId;

    // 2. Strict Privilege Escalation Protection
    if (callerAbility) {
      // Caller must have role management permission or global wildcard
      if (!callerAbility.can('manage', 'Role') && !callerAbility.can('manage', 'all')) {
        throw new ForbiddenException('You do not have permission to assign roles');
      }

      // Check anti-escalation for SuperAdmin role
      if (
        (targetRoleName === 'SuperAdmin' || targetRoleName?.toLowerCase() === 'superadmin') &&
        !callerAbility.can('manage', 'all')
      ) {
        throw new ForbiddenException(
          'Privilege escalation denied: Only SuperAdmin can assign the SuperAdmin role',
        );
      }

      // Check self-escalation: users cannot assign elevated roles to themselves
      const callerId = callerUser?.id || callerUser?.userId;
      if (callerId && callerId === dto.userId && !callerAbility.can('manage', 'all')) {
        throw new ForbiddenException(
          'Privilege escalation denied: Users cannot assign elevated roles to themselves',
        );
      }

      // Check journal scope constraint
      if (dto.journalId && !callerAbility.can('manage', 'all')) {
        if (!callerAbility.can('manage', subject('Role', { journalId: dto.journalId }))) {
          throw new ForbiddenException(
            'You do not have permission to assign roles for this journal',
          );
        }
      }
    }

    if (this.db) {
      // 3. Upsert role assignment
      await this.db
        .insert(userRoles)
        .values({
          userId: dto.userId,
          roleId: targetRoleId,
          scopeJournalId,
        })
        .onConflictDoNothing();

      // 4. Increment permissions_version to enforce instant revocation of existing tokens
      const updatedUsers = await this.db
        .update(users)
        .set({
          permissionsVersion: sql`${users.permissionsVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, dto.userId))
        .returning();

      // 5. Invalidate ability cache
      if (this.abilityCache) {
        this.abilityCache.invalidate(dto.userId);
      }

      const updated = updatedUsers?.[0];
      return {
        success: true,
        permissionsVersion: updated?.permissionsVersion,
      };
    }

    if (this.abilityCache) {
      this.abilityCache.invalidate(dto.userId);
    }

    return { success: true };
  }

  /**
   * Revokes a role assignment from a user, checks privilege escalation,
   * increments users.permissions_version for instant session revocation,
   * and invalidates ability cache entries for the user.
   */
  async revokeRole(
    dto: RevokeRole,
    callerUser?: any,
    callerAbility?: AppAbility,
  ): Promise<{ success: boolean; permissionsVersion?: number }> {
    const scopeJournalId = dto.journalId || GLOBAL_SCOPE_ID;

    // 1. Resolve role
    const targetRole = await this.resolveRole(dto.roleId);
    const targetRoleName = targetRole?.name || dto.roleId;
    const targetRoleId = targetRole?.id || dto.roleId;

    // 2. Strict Privilege Escalation Protection
    if (callerAbility) {
      if (!callerAbility.can('manage', 'Role') && !callerAbility.can('manage', 'all')) {
        throw new ForbiddenException('You do not have permission to revoke roles');
      }

      if (
        (targetRoleName === 'SuperAdmin' || targetRoleName?.toLowerCase() === 'superadmin') &&
        !callerAbility.can('manage', 'all')
      ) {
        throw new ForbiddenException(
          'Privilege escalation denied: Only SuperAdmin can revoke the SuperAdmin role',
        );
      }

      if (dto.journalId && !callerAbility.can('manage', 'all')) {
        if (!callerAbility.can('manage', subject('Role', { journalId: dto.journalId }))) {
          throw new ForbiddenException(
            'You do not have permission to revoke roles for this journal',
          );
        }
      }
    }

    if (this.db) {
      // 3. Delete role assignment
      const whereClause = dto.journalId
        ? and(
            eq(userRoles.userId, dto.userId),
            eq(userRoles.roleId, targetRoleId),
            eq(userRoles.scopeJournalId, scopeJournalId),
          )
        : and(
            eq(userRoles.userId, dto.userId),
            eq(userRoles.roleId, targetRoleId),
          );

      await this.db.delete(userRoles).where(whereClause);

      // 4. Increment permissions_version for instant token revocation
      const updatedUsers = await this.db
        .update(users)
        .set({
          permissionsVersion: sql`${users.permissionsVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, dto.userId))
        .returning();

      // 5. Invalidate ability cache
      if (this.abilityCache) {
        this.abilityCache.invalidate(dto.userId);
      }

      const updated = updatedUsers?.[0];
      return {
        success: true,
        permissionsVersion: updated?.permissionsVersion,
      };
    }

    if (this.abilityCache) {
      this.abilityCache.invalidate(dto.userId);
    }

    return { success: true };
  }

  private async resolveRole(roleIdOrName: string): Promise<any | null> {
    if (!this.db) return null;

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(roleIdOrName);
      if (isUuid) {
        const rows = await this.db.select().from(roles).where(eq(roles.id, roleIdOrName)).limit(1);
        if (rows && rows.length > 0) return rows[0];
      }

      const rowsByName = await this.db.select().from(roles).where(eq(roles.name, roleIdOrName)).limit(1);
      if (rowsByName && rowsByName.length > 0) return rowsByName[0];
    } catch {
      // Fallback
    }

    return null;
  }
}
