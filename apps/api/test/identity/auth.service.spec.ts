import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  UnauthorizedException,
  BadRequestException,
  PreconditionFailedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PasswordService } from '../../src/modules/identity/domain/password.service';
import { TokenService } from '../../src/modules/identity/domain/token.service';
import { AuthService } from '../../src/modules/identity/application/auth.service';
import { DevMailDriver } from '../../src/modules/identity/infrastructure/mail.service';
import { AuthController } from '../../src/modules/identity/presentation/auth.controller';
import { UserService } from '../../src/modules/users/application/user.service';
import { UserController } from '../../src/modules/users/presentation/user.controller';
import crypto from 'crypto';

describe('Identity & User Management', () => {
  let passwordService: PasswordService;
  let tokenService: TokenService;
  let jwtService: JwtService;
  let mailService: DevMailDriver;

  beforeEach(() => {
    jwtService = new JwtService({ secret: 'test-secret-key-1234567890-test' });
    passwordService = new PasswordService();
    tokenService = new TokenService(jwtService);
    mailService = new DevMailDriver();
  });

  describe('PasswordService (Argon2id & legacy scrypt)', () => {
    it('hashes passwords using Argon2id with memoryCost 65536 and timeCost 3', async () => {
      const plain = 'StrongP@ssw0rd!';
      const hash = await passwordService.hash(plain);

      expect(hash).toMatch(/^\$argon2id\$v=19\$m=65536,t=3/);
      const isValid = await passwordService.verify(hash, plain);
      expect(isValid).toBe(true);

      const isInvalid = await passwordService.verify(hash, 'WrongPassword!');
      expect(isInvalid).toBe(false);
    });

    it('verifies legacy scrypt passwords from seed/legacy systems', async () => {
      const plain = 'SeedAdmin123!';
      const salt = crypto.randomBytes(16).toString('hex');
      const derivedKey = crypto.scryptSync(plain, salt, 64).toString('hex');
      const legacyHash = `scrypt:${salt}:${derivedKey}`;

      const isValid = await passwordService.verify(legacyHash, plain);
      expect(isValid).toBe(true);

      const isInvalid = await passwordService.verify(legacyHash, 'WrongPassword!');
      expect(isInvalid).toBe(false);
    });

    it('returns false for empty, malformed or invalid hash formats', async () => {
      expect(await passwordService.verify('', 'pwd')).toBe(false);
      expect(await passwordService.verify('invalid-hash', 'pwd')).toBe(false);
      expect(await passwordService.verify('scrypt:short', 'pwd')).toBe(false);
    });
  });

  describe('TokenService', () => {
    it('signs access token with sub and pv only, strictly without roles', async () => {
      const userId = '11111111-1111-1111-1111-111111111111';
      const pv = 3;

      const token = await tokenService.signAccessToken({ sub: userId, pv });
      expect(typeof token).toBe('string');

      const decoded = await tokenService.verifyAccessToken(token);
      expect(decoded.sub).toBe(userId);
      expect(decoded.pv).toBe(pv);
      expect((decoded as any).roles).toBeUndefined();
    });

    it('generates 32-byte opaque refresh token and SHA-256 hash with 30-day lifetime', () => {
      const { rawToken, tokenHash, expiresAt } = tokenService.generateRefreshToken();

      expect(rawToken).toHaveLength(64); // 32 bytes in hex = 64 characters
      const expectedHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      expect(tokenHash).toBe(expectedHash);

      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      const diff = expiresAt.getTime() - now;
      expect(diff).toBeGreaterThan(thirtyDaysMs - 10000);
      expect(diff).toBeLessThanOrEqual(thirtyDaysMs + 10000);
    });

    it('generates 32-byte one-time token for activation/reset', () => {
      const { rawToken, tokenHash, expiresAt } = tokenService.generateOneTimeToken(24);
      expect(rawToken).toHaveLength(64);
      expect(tokenHash).toBe(tokenService.hashToken(rawToken));
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('AuthService', () => {
    let mockDb: any;
    let authService: AuthService;
    let usersStore: any[];
    let refreshTokensStore: any[];
    let userTokensStore: any[];

    beforeEach(async () => {
      const hashedPw = await passwordService.hash('Password123!');
      usersStore = [
        {
          id: 'user-active-1',
          email: 'active@structpaper.org',
          passwordHash: hashedPw,
          displayName: 'Active User',
          avatarUrl: null,
          status: 'ACTIVE',
          permissionsVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user-suspended-2',
          email: 'suspended@structpaper.org',
          passwordHash: hashedPw,
          displayName: 'Suspended User',
          avatarUrl: null,
          status: 'SUSPENDED',
          permissionsVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'user-invited-3',
          email: 'invited@structpaper.org',
          passwordHash: null,
          displayName: 'Invited User',
          avatarUrl: null,
          status: 'INVITED',
          permissionsVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      refreshTokensStore = [];
      userTokensStore = [];

      mockDb = {
        query: {
          users: {
            findFirst: vi.fn().mockImplementation(async () => usersStore[0]),
          },
          refreshTokens: {
            findFirst: vi.fn().mockImplementation(async () => refreshTokensStore[0] || null),
          },
          userTokens: {
            findFirst: vi.fn().mockImplementation(async () => userTokensStore[0] || null),
          },
        },
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue(usersStore),
            })),
          }),
        }),
        insert: vi.fn().mockImplementation((table: any) => ({
          values: vi.fn().mockImplementation((values: any) => {
            const row = { id: `id-${Date.now()}-${Math.random()}`, ...values };
            if (values.tokenHash && values.expiresAt && values.userId) {
              refreshTokensStore.push(row);
            }
            return {
              returning: vi.fn().mockResolvedValue([row]),
            };
          }),
        })),
        update: vi.fn().mockImplementation((table: any) => ({
          set: vi.fn().mockImplementation((setValues: any) => ({
            where: vi.fn().mockImplementation(() => {
              return {
                returning: vi.fn().mockResolvedValue([setValues]),
              };
            }),
          })),
        })),
      };

      authService = new AuthService(passwordService, tokenService, mockDb, mailService);
    });

    it('login succeeds with valid credentials and sets rotating refresh token', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(usersStore[0]);

      const result = await authService.login({
        email: 'active@structpaper.org',
        password: 'Password123!',
      });

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900);
      expect(result.tokenType).toBe('Bearer');
      expect(result.user?.email).toBe('active@structpaper.org');
      expect(refreshTokensStore.length).toBe(1);
      expect(refreshTokensStore[0].userId).toBe('user-active-1');
    });

    it('login rejects invalid password with UnauthorizedException', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(usersStore[0]);

      await expect(
        authService.login({
          email: 'active@structpaper.org',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('login rejects suspended user with UnauthorizedException', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(usersStore[1]);

      await expect(
        authService.login({
          email: 'suspended@structpaper.org',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('login rejects unactivated user (no password) with UnauthorizedException', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(usersStore[2]);

      await expect(
        authService.login({
          email: 'invited@structpaper.org',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('refresh rotates refresh token and issues new access token', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(usersStore[0]);
      const initialLogin = await authService.login({
        email: 'active@structpaper.org',
        password: 'Password123!',
      });

      const oldRefreshToken = initialLogin.refreshToken!;
      const oldHash = tokenService.hashToken(oldRefreshToken);

      mockDb.query.refreshTokens.findFirst.mockResolvedValue({
        id: 'rt-1',
        userId: 'user-active-1',
        tokenHash: oldHash,
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
      });

      const refreshResult = await authService.refresh(oldRefreshToken);

      expect(refreshResult.accessToken).toBeDefined();
      expect(refreshResult.refreshToken).toBeDefined();
      expect(refreshResult.refreshToken).not.toBe(oldRefreshToken);
    });

    it('refresh rejects revoked refresh token', async () => {
      mockDb.query.refreshTokens.findFirst.mockResolvedValue({
        id: 'rt-revoked',
        userId: 'user-active-1',
        tokenHash: 'somehash',
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: new Date(),
      });

      await expect(authService.refresh('some-revoked-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('refresh rejects expired refresh token', async () => {
      mockDb.query.refreshTokens.findFirst.mockResolvedValue({
        id: 'rt-expired',
        userId: 'user-active-1',
        tokenHash: 'somehash',
        expiresAt: new Date(Date.now() - 100000),
        revokedAt: null,
      });

      await expect(authService.refresh('some-expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('logout revokes refresh token in database', async () => {
      const res = await authService.logout('raw-refresh-token');
      expect(res.success).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('activate activates user with valid invitation token and sets password', async () => {
      const rawToken = 'valid-activation-token-raw';
      const tokenHash = tokenService.hashToken(rawToken);

      mockDb.query.userTokens.findFirst.mockResolvedValue({
        id: 'token-uuid-1',
        userId: 'user-invited-3',
        type: 'INVITATION',
        tokenHash,
        expiresAt: new Date(Date.now() + 100000),
        consumedAt: null,
      });

      const result = await authService.activate({
        token: rawToken,
        password: 'NewStrongPassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Account activated');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('activate rejects expired or already consumed token', async () => {
      mockDb.query.userTokens.findFirst.mockResolvedValue({
        id: 'token-uuid-consumed',
        userId: 'user-invited-3',
        type: 'INVITATION',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 100000),
        consumedAt: new Date(),
      });

      await expect(
        authService.activate({
          token: 'consumed-token',
          password: 'Password123!',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('resetPassword consumes token, hashes new password, and increments permissionsVersion', async () => {
      const rawToken = 'valid-reset-token-raw';
      const tokenHash = tokenService.hashToken(rawToken);

      mockDb.query.userTokens.findFirst.mockResolvedValue({
        id: 'reset-token-1',
        userId: 'user-active-1',
        type: 'PASSWORD_RESET',
        tokenHash,
        expiresAt: new Date(Date.now() + 100000),
        consumedAt: null,
      });
      mockDb.query.users.findFirst.mockResolvedValue(usersStore[0]);

      const result = await authService.resetPassword({
        token: rawToken,
        newPassword: 'BrandNewPassword123!',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Password reset successfully');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('me returns user profile stripped of passwordHash', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(usersStore[0]);

      const profile = await authService.me('user-active-1');
      expect(profile.id).toBe('user-active-1');
      expect(profile.email).toBe('active@structpaper.org');
      expect(profile.passwordHash).toBeUndefined();
    });
  });

  describe('UserService & If-Match Optimistic Locking', () => {
    let mockDb: any;
    let userService: UserService;
    let currentUser: any;

    beforeEach(() => {
      currentUser = {
        id: 'user-uuid-123',
        email: 'editor@structpaper.org',
        displayName: 'Old Name',
        avatarUrl: null,
        status: 'ACTIVE',
        permissionsVersion: 2,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb = {
        query: {
          users: {
            findFirst: vi.fn().mockImplementation(async () => currentUser),
            findMany: vi.fn().mockResolvedValue([currentUser]),
          },
          roles: {
            findFirst: vi.fn().mockResolvedValue({ id: 'role-author-uuid', name: 'Author' }),
          },
        },
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockImplementation((updates: any) => ({
            where: vi.fn().mockImplementation(() => ({
              returning: vi.fn().mockResolvedValue([{ ...currentUser, ...updates }]),
            })),
          })),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val: any) => ({
            returning: vi.fn().mockResolvedValue([{ id: 'new-id', ...val }]),
            onConflictDoNothing: vi.fn().mockResolvedValue([]),
          })),
        })),
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue([currentUser]),
            }),
          }),
        }),
      };

      userService = new UserService(mockDb, tokenService, mailService);
    });

    it('inviteUser creates user in INVITED state, creates user_tokens, logs and returns activationUrl', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      const res = await userService.inviteUser({
        email: 'newauthor@structpaper.org',
        displayName: 'New Author',
        role: 'Author',
      });

      expect(res.user.email).toBe('newauthor@structpaper.org');
      expect(res.user.status).toBe('INVITED');
      expect(res.activationUrl).toBeDefined();
      expect(res.token).toBeDefined();
      expect(mailService.getSentMails()).toHaveLength(1);
      expect(mailService.getLatestMail()?.email).toBe('newauthor@structpaper.org');
    });

    it('listUsers returns paginated items and total', async () => {
      const list = await userService.listUsers({ limit: 10, offset: 0 });
      expect(list.items).toHaveLength(1);
      expect(list.items[0].displayName).toBe('Old Name');
      expect(list.items[0].passwordHash).toBeUndefined();
    });

    it('updates user when If-Match matches current version', async () => {
      const updated = await userService.updateUser('user-uuid-123', { displayName: 'New Name' }, '2');

      expect(updated.displayName).toBe('New Name');
    });

    it('supports quoted and weak ETag format in If-Match (e.g. W/"2" or "2")', async () => {
      const updatedQuoted = await userService.updateUser(
        'user-uuid-123',
        { displayName: 'Quoted Match' },
        '"2"',
      );
      expect(updatedQuoted.displayName).toBe('Quoted Match');

      const updatedWeak = await userService.updateUser(
        'user-uuid-123',
        { displayName: 'Weak Match' },
        'W/"2"',
      );
      expect(updatedWeak.displayName).toBe('Weak Match');
    });

    it('rejects update with HTTP 412 Precondition Failed when If-Match is mismatched', async () => {
      await expect(
        userService.updateUser('user-uuid-123', { displayName: 'New Name' }, '1'),
      ).rejects.toThrow(PreconditionFailedException);
    });

    it('rejects update with 404 when user does not exist', async () => {
      mockDb.query.users.findFirst.mockResolvedValue(null);

      await expect(
        userService.updateUser('nonexistent-id', { displayName: 'Name' }, '1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Controllers presentation layer', () => {
    let authService: any;
    let userService: any;
    let authController: AuthController;
    let userController: UserController;

    beforeEach(() => {
      authService = {
        login: vi.fn().mockResolvedValue({ accessToken: 'access', expiresIn: 900 }),
        refresh: vi.fn().mockResolvedValue({ accessToken: 'new-access' }),
        logout: vi.fn().mockResolvedValue({ success: true }),
        activate: vi.fn().mockResolvedValue({ success: true, message: 'Activated' }),
        resetPassword: vi.fn().mockResolvedValue({ success: true, message: 'Reset' }),
        verifyTokenWithPermissions: vi.fn().mockResolvedValue({ id: 'user-123' }),
        me: vi.fn().mockResolvedValue({ id: 'user-123', email: 'user@structpaper.org' }),
      };

      userService = {
        listUsers: vi.fn().mockResolvedValue({ items: [], total: 0 }),
        inviteUser: vi.fn().mockResolvedValue({ user: {}, activationUrl: 'url' }),
        getUserById: vi.fn().mockResolvedValue({ id: 'user-123', permissionsVersion: 1 }),
        updateUser: vi.fn().mockResolvedValue({ id: 'user-123', permissionsVersion: 2 }),
      };

      authController = new AuthController(authService);
      userController = new UserController(userService);
    });

    it('authController delegates to authService', async () => {
      const loginRes = await authController.login({ email: 'test@structpaper.org', password: 'password123' });
      expect(loginRes.accessToken).toBe('access');

      const refreshRes = await authController.refresh({ refreshToken: 'ref-tok' });
      expect(refreshRes.accessToken).toBe('new-access');

      const meRes = await authController.me('Bearer my-jwt-token');
      expect(meRes.id).toBe('user-123');
    });

    it('userController handles ETag header on getById and update', async () => {
      const mockRes = {
        headers: {} as Record<string, string>,
        header(k: string, v: string) {
          this.headers[k] = v;
        },
      };

      await userController.getById('user-123', mockRes as any);
      expect(mockRes.headers['ETag']).toBe('"1"');

      await userController.update('user-123', { displayName: 'Updated' }, '"1"', mockRes as any);
      expect(mockRes.headers['ETag']).toBe('"2"');
    });
  });
});
