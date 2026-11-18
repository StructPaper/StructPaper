import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { AccessService } from '../../src/modules/access/application/access.service';
import { AccessController } from '../../src/modules/access/presentation/access.controller';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { InMemoryAbilityCacheService } from '../../src/modules/access/infrastructure/ability-cache.service';

describe('Privilege Escalation Protection & Role Revocation', () => {
  let mockDb: any;
  let cacheService: InMemoryAbilityCacheService;
  let abilityFactory: AbilityFactory;
  let accessService: AccessService;
  let accessController: AccessController;

  const adminUserId = '00000000-0000-0000-0000-000000000001';
  const editorUserId = '00000000-0000-0000-0000-000000000002';
  const targetUserId = '00000000-0000-0000-0000-000000000003';

  const superAdminRoleId = '11111111-1111-1111-1111-111111111111';
  const editorRoleId = '22222222-2222-2222-2222-222222222222';
  const authorRoleId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    cacheService = new InMemoryAbilityCacheService(60_000, 100);
    abilityFactory = new AbilityFactory();
    accessService = new AccessService(cacheService, mockDb);
    accessController = new AccessController(accessService, abilityFactory, cacheService);
  });

  const setupMockRoleSelect = (roleId: string, roleName: string) => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ id: roleId, name: roleName }]),
        }),
      }),
    });
  };

  describe('1. Privilege Escalation Prevention on Role Assignment', () => {
    it('SuperAdmin can assign SuperAdmin role successfully', async () => {
      const superAdminAbility = await abilityFactory.createForUser(adminUserId, {
        roles: [{ name: 'SuperAdmin' }],
      });

      setupMockRoleSelect(superAdminRoleId, 'SuperAdmin');

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue([{}]),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: targetUserId, permissionsVersion: 2 }]),
          }),
        }),
      });

      const result = await accessService.assignRole(
        { userId: targetUserId, roleId: superAdminRoleId },
        { id: adminUserId },
        superAdminAbility,
      );

      expect(result.success).toBe(true);
      expect(result.permissionsVersion).toBe(2);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('Non-SuperAdmin (JournalManager/Editor) is strictly blocked from assigning SuperAdmin', async () => {
      const editorAbility = await abilityFactory.createForUser(editorUserId, {
        roles: [{ name: 'JournalManager' }],
      });

      setupMockRoleSelect(superAdminRoleId, 'SuperAdmin');

      await expect(
        accessService.assignRole(
          { userId: targetUserId, roleId: superAdminRoleId },
          { id: editorUserId },
          editorAbility,
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        accessService.assignRole(
          { userId: targetUserId, roleId: superAdminRoleId },
          { id: editorUserId },
          editorAbility,
        ),
      ).rejects.toThrow(/Privilege escalation denied/i);
    });

    it('Users cannot assign elevated roles to themselves (self-escalation blocked)', async () => {
      const journalManagerAbility = await abilityFactory.createForUser(editorUserId, {
        roles: [{ name: 'JournalManager' }],
      });

      setupMockRoleSelect(editorRoleId, 'Editor');

      await expect(
        accessService.assignRole(
          { userId: editorUserId, roleId: editorRoleId }, // Assigning to oneself!
          { id: editorUserId },
          journalManagerAbility,
        ),
      ).rejects.toThrow(/You cannot change your own roles/i);
    });

    it('User without role management permissions cannot assign any roles', async () => {
      const authorAbility = await abilityFactory.createForUser(targetUserId, {
        roles: [{ name: 'Author' }],
      });

      setupMockRoleSelect(authorRoleId, 'Author');

      await expect(
        accessService.assignRole(
          { userId: targetUserId, roleId: authorRoleId },
          { id: targetUserId },
          authorAbility,
        ),
      ).rejects.toThrow(/You do not have permission to assign roles/i);
    });
  });

  describe('2. Role Revocation (DELETE /admin/users/:id/roles/:roleId)', () => {
    it('SuperAdmin can revoke role, invalidating cache and incrementing permissionsVersion', async () => {
      const superAdminAbility = await abilityFactory.createForUser(adminUserId, {
        roles: [{ name: 'SuperAdmin' }],
      });

      setupMockRoleSelect(editorRoleId, 'Editor');

      const cacheSpy = vi.spyOn(cacheService, 'invalidate');

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([{}]),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: targetUserId, permissionsVersion: 5 }]),
          }),
        }),
      });

      const result = await accessService.revokeRole(
        { userId: targetUserId, roleId: editorRoleId },
        { id: adminUserId },
        superAdminAbility,
      );

      expect(result.success).toBe(true);
      expect(result.permissionsVersion).toBe(5);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(cacheSpy).toHaveBeenCalledWith(targetUserId);
    });

    it('Non-SuperAdmin cannot revoke SuperAdmin role', async () => {
      const jmAbility = await abilityFactory.createForUser(editorUserId, {
        roles: [{ name: 'JournalManager' }],
      });

      setupMockRoleSelect(superAdminRoleId, 'SuperAdmin');

      await expect(
        accessService.revokeRole(
          { userId: targetUserId, roleId: superAdminRoleId },
          { id: editorUserId },
          jmAbility,
        ),
      ).rejects.toThrow(/Privilege escalation denied: Only SuperAdmin can revoke the SuperAdmin role/i);
    });

    it('AccessController delegates DELETE /admin/users/:id/roles/:roleId with parameter extraction', async () => {
      const superAdminAbility = await abilityFactory.createForUser(adminUserId, {
        roles: [{ name: 'SuperAdmin' }],
      });
      cacheService.set(adminUserId, 1, superAdminAbility);

      setupMockRoleSelect(editorRoleId, 'Editor');

      mockDb.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue([{}]),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: targetUserId, permissionsVersion: 6 }]),
          }),
        }),
      });

      const mockReq = {
        user: { id: adminUserId, permissionsVersion: 1 },
      };

      const result = await accessController.revokeRole(targetUserId, editorRoleId, undefined, mockReq);
      expect(result.success).toBe(true);
      expect(result.permissionsVersion).toBe(6);
    });
  });

  describe('3. Self-protection and "always keep a SuperAdmin"', () => {
    /** select() #1 resolves the role; select() #2 is the locked "active SuperAdmins" query. */
    const mockSuperAdminRevocation = (activeSuperAdminIds: string[]) => {
      const forUpdate = vi.fn().mockResolvedValue(activeSuperAdminIds.map((id) => ({ id })));
      mockDb.select
        .mockReturnValueOnce({
          from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: superAdminRoleId, name: 'SuperAdmin' }]) }) }),
        })
        .mockReturnValueOnce({
          from: () => ({ innerJoin: () => ({ innerJoin: () => ({ where: () => ({ for: forUpdate }) }) }) }),
        });
      mockDb.transaction = vi.fn(async (fn: any) => fn(mockDb));
      mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue([{}]) });
      mockDb.update.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: targetUserId, permissionsVersion: 9 }]) }) }),
      });
      return forUpdate;
    };

    const superAdminAbility = () => abilityFactory.createForUser(adminUserId, { roles: [{ name: 'SuperAdmin' }] });

    it('a SuperAdmin can NOT remove their own SuperAdmin role', async () => {
      setupMockRoleSelect(superAdminRoleId, 'SuperAdmin');

      await expect(
        accessService.revokeRole(
          { userId: adminUserId, roleId: superAdminRoleId },
          { id: adminUserId },
          await superAdminAbility(),
        ),
      ).rejects.toThrow(/You cannot change your own roles/i);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('a SuperAdmin can NOT change their own roles at all (assign is blocked too)', async () => {
      setupMockRoleSelect(editorRoleId, 'Editor');

      await expect(
        accessService.assignRole(
          { userId: adminUserId, roleId: editorRoleId },
          { id: adminUserId },
          await superAdminAbility(),
        ),
      ).rejects.toThrow(ForbiddenException);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('revoking SuperAdmin from the ONLY active SuperAdmin is refused (409) and nothing is deleted', async () => {
      mockSuperAdminRevocation([targetUserId]);

      await expect(
        accessService.revokeRole(
          { userId: targetUserId, roleId: superAdminRoleId },
          { id: adminUserId },
          await superAdminAbility(),
        ),
      ).rejects.toThrow(/At least one active SuperAdmin must remain/i);
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it('revoking SuperAdmin is allowed when another active SuperAdmin remains', async () => {
      mockSuperAdminRevocation([targetUserId, adminUserId]);

      const result = await accessService.revokeRole(
        { userId: targetUserId, roleId: superAdminRoleId },
        { id: adminUserId },
        await superAdminAbility(),
      );

      expect(result.success).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
    });

    it('the check and the delete run in ONE transaction with the SuperAdmin rows locked (FOR UPDATE)', async () => {
      const forUpdate = mockSuperAdminRevocation([targetUserId, adminUserId]);

      await accessService.revokeRole(
        { userId: targetUserId, roleId: superAdminRoleId },
        { id: adminUserId },
        await superAdminAbility(),
      );

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(forUpdate).toHaveBeenCalledWith('update', expect.anything());
    });

    it('revoking an ordinary role does not need the lock or a transaction', async () => {
      setupMockRoleSelect(editorRoleId, 'Editor');
      mockDb.transaction = vi.fn();
      mockDb.delete.mockReturnValue({ where: vi.fn().mockResolvedValue([{}]) });
      mockDb.update.mockReturnValue({
        set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: targetUserId, permissionsVersion: 3 }]) }) }),
      });

      await accessService.revokeRole(
        { userId: targetUserId, roleId: editorRoleId },
        { id: adminUserId },
        await superAdminAbility(),
      );

      expect(mockDb.transaction).not.toHaveBeenCalled();
    });
  });
});
