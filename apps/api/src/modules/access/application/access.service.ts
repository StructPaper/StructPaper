import { Injectable, Inject, Optional } from '@nestjs/common';
import {
  users,
  userRoles,
  roles,
  permissions,
  eq,
  sql,
  GLOBAL_SCOPE_ID,
} from '@structpaper/db';
import type { AssignRole, Role, Permission } from '@structpaper/contracts';
import { AbilityCacheService } from '../domain/ability-cache.service';

@Injectable()
export class AccessService {
  constructor(
    @Optional()
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
   * increments users.permissions_version for instant session revocation,
   * and invalidates ability cache entries for the user.
   */
  async assignRole(dto: AssignRole): Promise<{ success: boolean; permissionsVersion?: number }> {
    const scopeJournalId = dto.journalId || GLOBAL_SCOPE_ID;

    if (this.db) {
      // 1. Upsert role assignment
      await this.db
        .insert(userRoles)
        .values({
          userId: dto.userId,
          roleId: dto.roleId,
          scopeJournalId,
        })
        .onConflictDoNothing();

      // 2. Increment permissions_version to enforce instant revocation of existing tokens
      const updatedUsers = await this.db
        .update(users)
        .set({
          permissionsVersion: sql`${users.permissionsVersion} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, dto.userId))
        .returning();

      // 3. Invalidate ability cache
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
}
