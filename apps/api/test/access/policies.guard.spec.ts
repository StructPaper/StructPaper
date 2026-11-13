import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PoliciesGuard } from '../../src/modules/access/presentation/guards/policies.guard';
import { JwtAuthGuard } from '../../src/modules/access/presentation/guards/jwt-auth.guard';
import { CheckPolicies, CHECK_POLICIES_KEY } from '../../src/modules/access/presentation/decorators/check-policies.decorator';
import { AbilityFactory, subject } from '../../src/modules/access/domain/ability.factory';
import { AbilityCacheService } from '../../src/modules/access/domain/ability-cache.service';
import { InMemoryAbilityCacheService } from '../../src/modules/access/infrastructure/ability-cache.service';
import { AccessService } from '../../src/modules/access/application/access.service';
import { AccessController } from '../../src/modules/access/presentation/access.controller';

describe('RBAC & Manuscript ACL with CASL (Guards & Services)', () => {
  let reflector: Reflector;
  let abilityFactory: AbilityFactory;
  let cacheService: InMemoryAbilityCacheService;
  let guard: PoliciesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    abilityFactory = new AbilityFactory();
    cacheService = new InMemoryAbilityCacheService(60_000, 100);
    guard = new PoliciesGuard(reflector, abilityFactory, cacheService);
  });

  const createMockContext = (request: any, handler?: Function): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => handler || (() => {}),
      getClass: () => class TestController {},
    } as unknown as ExecutionContext;
  };

  describe('PoliciesGuard & @CheckPolicies', () => {
    it('allows access when no policy is set on handler or class', async () => {
      const request = { user: { id: 'user-1', permissionsVersion: 1 } };
      const context = createMockContext(request);

      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('rejects with 403 ForbiddenException when request has no authenticated user', async () => {
      const handler = () => {};
      reflector.get = vi.fn().mockReturnValue([(ability: any) => ability.can('manage', 'all')]);

      const request = { user: null };
      const context = createMockContext(request, handler);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('allows access when policy evaluates to true for SuperAdmin', async () => {
      const handler = () => {};
      const policyHandler = (ability: any) => ability.can('manage', 'all');
      reflector.get = vi.fn().mockReturnValue([policyHandler]);

      // Mock user who is SuperAdmin
      vi.spyOn(abilityFactory, 'createForUser').mockResolvedValue(
        await abilityFactory.createForUser('admin-1', {
          roles: [{ name: 'SuperAdmin' }],
        }),
      );

      const request = {
        user: { id: 'admin-1', permissionsVersion: 1 },
        params: {},
        body: {},
      };
      const context = createMockContext(request, handler);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('rejects with 403 ForbiddenException when policy handler returns false', async () => {
      const handler = () => {};
      const policyHandler = (ability: any, req: any) =>
        ability.can('update', subject('Manuscript', { id: req.params.id }));
      reflector.get = vi.fn().mockReturnValue([policyHandler]);

      // Author user who only owns m-1
      vi.spyOn(abilityFactory, 'createForUser').mockResolvedValue(
        await abilityFactory.createForUser('author-1', {
          roles: [{ name: 'Author' }],
          manuscriptMemberships: [{ manuscriptId: 'm-1', role: 'OWNER' }],
        }),
      );

      const request = {
        user: { id: 'author-1', permissionsVersion: 1 },
        params: { id: 'm-2' }, // Not m-1!
        body: {},
      };
      const context = createMockContext(request, handler);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('allows access when author updates owned manuscript via request.params', async () => {
      const handler = () => {};
      const policyHandler = (ability: any, req: any) =>
        ability.can('update', subject('Manuscript', { id: req.params.id }));
      reflector.get = vi.fn().mockReturnValue([policyHandler]);

      vi.spyOn(abilityFactory, 'createForUser').mockResolvedValue(
        await abilityFactory.createForUser('author-1', {
          roles: [{ name: 'Author' }],
          manuscriptMemberships: [{ manuscriptId: 'm-1', role: 'OWNER' }],
        }),
      );

      const request = {
        user: { id: 'author-1', permissionsVersion: 1 },
        params: { id: 'm-1' },
        body: {},
      };
      const context = createMockContext(request, handler);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('AbilityCacheService caching behavior in PoliciesGuard', () => {
    it('uses cached ability on cache hit and avoids re-querying abilityFactory', async () => {
      const handler = () => {};
      reflector.get = vi.fn().mockReturnValue([(ability: any) => ability.can('manage', 'all')]);

      const factorySpy = vi.spyOn(abilityFactory, 'createForUser');

      const adminAbility = await abilityFactory.createForUser('admin-cached', {
        roles: [{ name: 'SuperAdmin' }],
      });
      cacheService.set('admin-cached', 1, adminAbility);

      const request = {
        user: { id: 'admin-cached', permissionsVersion: 1 },
      };
      const context = createMockContext(request, handler);

      factorySpy.mockClear();

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(factorySpy).not.toHaveBeenCalled();
    });

    it('populates cache on cache miss', async () => {
      const handler = () => {};
      reflector.get = vi.fn().mockReturnValue([(ability: any) => ability.can('manage', 'all')]);

      vi.spyOn(abilityFactory, 'createForUser').mockResolvedValue(
        await abilityFactory.createForUser('admin-miss', {
          roles: [{ name: 'SuperAdmin' }],
        }),
      );

      const request = {
        user: { id: 'admin-miss', permissionsVersion: 2 },
      };
      const context = createMockContext(request, handler);

      expect(cacheService.get('admin-miss', 2)).toBeUndefined();

      await guard.canActivate(context);

      const cached = cacheService.get('admin-miss', 2);
      expect(cached).toBeDefined();
      expect(cached?.can('manage', 'all')).toBe(true);
    });

    it('cache invalidation removes all user cached abilities', async () => {
      const ability = await abilityFactory.createForUser('user-inv', {
        roles: [{ name: 'SuperAdmin' }],
      });
      cacheService.set('user-inv', 1, ability);
      cacheService.set('user-inv', 2, ability);

      expect(cacheService.get('user-inv', 1)).toBeDefined();
      expect(cacheService.get('user-inv', 2)).toBeDefined();

      cacheService.invalidate('user-inv');

      expect(cacheService.get('user-inv', 1)).toBeUndefined();
      expect(cacheService.get('user-inv', 2)).toBeUndefined();
    });
  });

  describe('JwtAuthGuard instant revocation & token extraction', () => {
    let mockAuthService: any;
    let jwtGuard: JwtAuthGuard;

    beforeEach(() => {
      mockAuthService = {
        verifyTokenWithPermissions: vi.fn(),
      };
      jwtGuard = new JwtAuthGuard(mockAuthService);
    });

    it('rejects when Authorization header is missing', async () => {
      const request = { headers: {} };
      const context = createMockContext(request);

      await expect(jwtGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('extracts token, verifies via AuthService, and injects user onto request', async () => {
      const fakeUser = { id: 'user-123', email: 'u@test.org', permissionsVersion: 3 };
      mockAuthService.verifyTokenWithPermissions.mockResolvedValue(fakeUser);

      const request: any = {
        headers: { authorization: 'Bearer valid.jwt.token' },
      };
      const context = createMockContext(request);

      const result = await jwtGuard.canActivate(context);
      expect(result).toBe(true);
      expect(mockAuthService.verifyTokenWithPermissions).toHaveBeenCalledWith('valid.jwt.token');
      expect(request.user).toEqual(fakeUser);
    });

    it('rejects when token pv is outdated (verifyTokenWithPermissions throws UnauthorizedException)', async () => {
      mockAuthService.verifyTokenWithPermissions.mockRejectedValue(
        new UnauthorizedException('Permissions revoked or outdated'),
      );

      const request = {
        headers: { authorization: 'Bearer outdated.jwt.token' },
      };
      const context = createMockContext(request);

      await expect(jwtGuard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('AccessService & AccessController', () => {
    let mockDb: any;
    let accessService: AccessService;
    let accessController: AccessController;

    beforeEach(() => {
      mockDb = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
      };
      accessService = new AccessService(cacheService, mockDb);
      accessController = new AccessController(accessService);
    });

    it('GET /roles returns system roles with immutable baseline flag', async () => {
      const mockRoles = [
        { id: 'r-1', name: 'SuperAdmin', isSystem: true, journalId: null },
        { id: 'r-2', name: 'JournalManager', isSystem: true, journalId: null },
      ];
      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue(mockRoles),
      });

      const roles = await accessController.getRoles();
      expect(roles).toEqual(mockRoles);
      expect(roles[0].isSystem).toBe(true);
    });

    it('GET /permissions returns permissions list', async () => {
      const mockPerms = [
        { id: 'p-1', action: 'manage', subject: 'all' },
        { id: 'p-2', action: 'read', subject: 'Manuscript' },
      ];
      mockDb.select.mockReturnValue({
        from: vi.fn().mockResolvedValue(mockPerms),
      });

      const perms = await accessController.getPermissions();
      expect(perms).toEqual(mockPerms);
    });

    it('POST /roles/assign assigns role, increments users.permissions_version and invalidates ability cache', async () => {
      const cacheSpy = vi.spyOn(cacheService, 'invalidate');

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoNothing: vi.fn().mockResolvedValue([{}]),
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'user-to-assign', permissionsVersion: 4 }]),
          }),
        }),
      });

      const result = await accessController.assignRole({
        userId: '00000000-0000-0000-0000-000000000001',
        roleId: '00000000-0000-0000-0000-000000000002',
        journalId: '00000000-0000-0000-0000-000000000003',
      });

      expect(result.success).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(cacheSpy).toHaveBeenCalledWith('00000000-0000-0000-0000-000000000001');
    });
  });
});
