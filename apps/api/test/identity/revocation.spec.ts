import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PasswordService } from '../../src/modules/identity/domain/password.service';
import { TokenService } from '../../src/modules/identity/domain/token.service';
import { AuthService } from '../../src/modules/identity/application/auth.service';
import { DevMailDriver } from '../../src/modules/identity/infrastructure/mail.service';

describe('Instant Permission Revocation via permissions_version', () => {
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let jwtService: JwtService;
  let mailService: DevMailDriver;
  let authService: AuthService;
  let mockDb: any;
  let userInDb: any;

  beforeEach(() => {
    jwtService = new JwtService({ secret: 'super-secret-revocation-test-key' });
    passwordService = new PasswordService();
    tokenService = new TokenService(jwtService);
    mailService = new DevMailDriver();

    userInDb = {
      id: 'author-user-uuid',
      email: 'author@structpaper.org',
      displayName: 'Author User',
      status: 'ACTIVE',
      permissionsVersion: 1,
    };

    mockDb = {
      query: {
        users: {
          findFirst: vi.fn().mockImplementation(async () => userInDb),
        },
      },
    };

    authService = new AuthService(passwordService, tokenService, mockDb, mailService);
  });

  it('allows access when access token pv matches user permissionsVersion in DB', async () => {
    const token = await tokenService.signAccessToken({
      sub: userInDb.id,
      pv: userInDb.permissionsVersion,
    });

    const verifiedUser = await authService.verifyTokenWithPermissions(token);
    expect(verifiedUser).toBeDefined();
    expect(verifiedUser.id).toBe(userInDb.id);
  });

  it('instantly revokes access when permissions_version is bumped in DB', async () => {
    // 1. Issue access token with pv = 1
    const tokenPv1 = await tokenService.signAccessToken({
      sub: userInDb.id,
      pv: 1,
    });

    // Initial check passes
    const initialCheck = await authService.verifyTokenWithPermissions(tokenPv1);
    expect(initialCheck.id).toBe(userInDb.id);

    // 2. Admin modifies user permissions or roles -> permissions_version in DB is bumped to 2
    userInDb.permissionsVersion = 2;

    // 3. Subsequent verification of the old tokenPv1 MUST immediately fail with UnauthorizedException
    await expect(authService.verifyTokenWithPermissions(tokenPv1)).rejects.toThrow(
      UnauthorizedException,
    );

    // 4. A newly issued token with pv = 2 succeeds
    const tokenPv2 = await tokenService.signAccessToken({
      sub: userInDb.id,
      pv: 2,
    });
    const verifiedUser2 = await authService.verifyTokenWithPermissions(tokenPv2);
    expect(verifiedUser2.id).toBe(userInDb.id);
  });

  it('rejects tampered or forged tokens with UnauthorizedException', async () => {
    await expect(authService.verifyTokenWithPermissions('invalid.jwt.token')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
