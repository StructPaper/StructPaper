import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { UserController } from '../../src/modules/users/presentation/user.controller';
import { AccessController } from '../../src/modules/access/presentation/access.controller';
import { AuthController } from '../../src/modules/identity/presentation/auth.controller';
import { JwtAuthGuard } from '../../src/modules/access/presentation/guards/jwt-auth.guard';
import { PoliciesGuard } from '../../src/modules/access/presentation/guards/policies.guard';
import { CHECK_POLICIES_KEY } from '../../src/modules/access/presentation/decorators/check-policies.decorator';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';

/**
 * Regression tests for a real incident: /users and /roles/assign used to have NO guard, so anyone
 * (without a token) could list users, invite people with any role and grant themselves SuperAdmin.
 * Authentication is now global (see route-audit.spec.ts); these tests cover the layers on top.
 */
describe('Access control on member / role administration endpoints', () => {
  const guardsOf = (target: any): any[] => Reflect.getMetadata('__guards__', target) ?? [];
  const policiesOf = (target: any, key?: string): any[] =>
    (key ? Reflect.getMetadata(CHECK_POLICIES_KEY, (target as any).prototype[key]) : Reflect.getMetadata(CHECK_POLICIES_KEY, target)) ?? [];

  it('UserController enforces a role-management policy on every route', () => {
    expect(guardsOf(UserController)).toContain(PoliciesGuard);
    expect(policiesOf(UserController).length).toBeGreaterThan(0);
  });

  it('AccessController enforces policies, and role changes need role-management rights', () => {
    expect(guardsOf(AccessController)).toContain(PoliciesGuard);
    expect(policiesOf(AccessController, 'assignRole').length).toBeGreaterThan(0);
    expect(policiesOf(AccessController, 'revokeRoleBody').length).toBeGreaterThan(0);
    expect(policiesOf(AccessController, 'revokeRole').length).toBeGreaterThan(0);
  });

  it('only SuperAdmin and JournalManager pass the member-management policy', async () => {
    const factory = new AbilityFactory();
    const [policy] = policiesOf(UserController);

    const allowed = async (roles: any[]) => policy(await factory.createForUser({ roles }));

    expect(await allowed(['SuperAdmin'])).toBe(true);
    expect(await allowed([{ name: 'JournalManager', scopeJournalId: 'j-std' }])).toBe(true);
    expect(await allowed(['Editor'])).toBe(false);
    expect(await allowed(['Reviewer'])).toBe(false);
    expect(await allowed(['Author'])).toBe(false);
    expect(await allowed([])).toBe(false);
  });
});

describe('JwtAuthGuard (global) and @Public()', () => {
  const contextFor = (controller: any, handlerName: string, headers: Record<string, string> = {}) => {
    const request: any = { headers };
    const context: any = {
      getHandler: () => controller.prototype[handlerName],
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => request }),
    };
    return { context, request };
  };

  const makeGuard = () => {
    const authService = { verifyTokenWithPermissions: vi.fn().mockResolvedValue({ id: 'u1', permissionsVersion: 1 }) };
    return { guard: new JwtAuthGuard(authService as any, new Reflector()), authService };
  };

  it('lets @Public() routes through without looking at any token', async () => {
    const { guard, authService } = makeGuard();
    const { context } = contextFor(AuthController, 'login');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.verifyTokenWithPermissions).not.toHaveBeenCalled();
  });

  it('blocks a protected route without a token (401)', async () => {
    const { guard, authService } = makeGuard();
    const { context } = contextFor(UserController, 'list');

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(authService.verifyTokenWithPermissions).not.toHaveBeenCalled();
  });

  it('accepts a protected route with a valid token and exposes the user to later guards', async () => {
    const { guard, authService } = makeGuard();
    const { context, request } = contextFor(UserController, 'list', { authorization: 'Bearer good-token' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(authService.verifyTokenWithPermissions).toHaveBeenCalledWith('good-token');
    expect(request.user).toEqual({ id: 'u1', permissionsVersion: 1 });
  });

  it('a revoked/invalid token is rejected', async () => {
    const { guard, authService } = makeGuard();
    authService.verifyTokenWithPermissions.mockRejectedValueOnce(new UnauthorizedException('Permissions revoked or outdated'));
    const { context } = contextFor(AccessController, 'getRoles', { authorization: 'Bearer stale' });

    await expect(guard.canActivate(context)).rejects.toThrow('Permissions revoked or outdated');
  });
});
