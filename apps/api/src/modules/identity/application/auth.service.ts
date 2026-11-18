import {
  Injectable,
  Inject,
  Optional,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { users, refreshTokens, userTokens, eq, and, isNull, gt, sql } from '@structpaper/db';
import type { LoginRequest, TokenResponse, ResetPassword } from '@structpaper/contracts';
import { PasswordService } from '../domain/password.service';
import { TokenService } from '../domain/token.service';
import { MailService } from '../domain/mail.service';
import { loadUserRoleViews } from '../../access/domain/user-role-views';
import { capabilitiesForRoles } from '../../access/domain/capabilities';

@Injectable()
export class AuthService {
  constructor(
    @Inject(PasswordService)
    private readonly passwordService: PasswordService,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Optional()
    @Inject('DRIZZLE')
    private readonly db?: any,
    @Optional()
    @Inject(MailService)
    private readonly mailService?: MailService,
  ) {}

  /**
   * Validates user credentials and issues short-lived access token + rotating refresh token.
   */
  async login(dto: LoginRequest): Promise<TokenResponse> {
    const user = await this.findUserByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Account has been suspended');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Account not activated yet. Please activate your account.');
    }

    const isMatch = await this.passwordService.verify(user.passwordHash, dto.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const accessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      pv: user.permissionsVersion,
    });

    const refresh = this.tokenService.generateRefreshToken();

    if (this.db) {
      await this.db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: refresh.tokenHash,
        expiresAt: refresh.expiresAt,
      });
    }

    return {
      accessToken,
      refreshToken: refresh.rawToken,
      expiresIn: 900,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status as any,
      },
    };
  }

  /**
   * Rotates refresh token: revokes the incoming token and issues a new access + refresh pair.
   */
  async refresh(rawRefreshToken: string): Promise<TokenResponse> {
    if (!rawRefreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokenHash = this.tokenService.hashToken(rawRefreshToken);
    const existing = await this.findRefreshToken(tokenHash);

    if (!existing) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (existing.revokedAt) {
      throw new UnauthorizedException('Refresh token has already been revoked');
    }

    if (new Date(existing.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Revoke old refresh token
    if (this.db) {
      await this.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.id, existing.id));
    }

    const user = await this.findUserById(existing.userId);
    if (!user || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User account is invalid or suspended');
    }

    const newAccessToken = await this.tokenService.signAccessToken({
      sub: user.id,
      pv: user.permissionsVersion,
    });

    const newRefresh = this.tokenService.generateRefreshToken();

    if (this.db) {
      await this.db.insert(refreshTokens).values({
        userId: user.id,
        tokenHash: newRefresh.tokenHash,
        expiresAt: newRefresh.expiresAt,
      });
    }

    return {
      accessToken: newAccessToken,
      refreshToken: newRefresh.rawToken,
      expiresIn: 900,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        status: user.status as any,
      },
    };
  }

  /**
   * Revokes the provided refresh token.
   */
  async logout(rawRefreshToken: string): Promise<{ success: boolean }> {
    if (rawRefreshToken && this.db) {
      const tokenHash = this.tokenService.hashToken(rawRefreshToken);
      await this.db
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(eq(refreshTokens.tokenHash, tokenHash));
    }
    return { success: true };
  }

  /**
   * Activates an invited user using a one-time invitation token.
   */
  async activate(dto: { token: string; password: string }): Promise<{ success: boolean; message: string }> {
    if (!dto.token || !dto.password) {
      throw new BadRequestException('Token and password are required');
    }

    const tokenHash = this.tokenService.hashToken(dto.token);

    // Cheap pre-check so junk tokens never trigger the (expensive) password hashing.
    // Missing, already used and expired tokens share one message: no oracle for the caller.
    const tokenRecord = await this.findUserToken(tokenHash, 'INVITATION');
    if (!tokenRecord || tokenRecord.consumedAt || new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired activation token');
    }

    const passwordHash = await this.passwordService.hash(dto.password);

    if (this.db) {
      // Claim the token and activate the user in ONE transaction. The claim is a single
      // conditional UPDATE, so two concurrent requests can never both consume the same token.
      await this.db.transaction(async (tx: any) => {
        const claimed = await this.claimToken(tx, tokenHash, 'INVITATION');
        if (!claimed) {
          throw new BadRequestException('Invalid or expired activation token');
        }

        const activated = await tx
          .update(users)
          .set({ passwordHash, status: 'ACTIVE', updatedAt: new Date() })
          .where(and(eq(users.id, claimed.userId), eq(users.status, 'INVITED')))
          .returning({ id: users.id });

        if (!activated?.length) {
          // User is no longer INVITED (already active / suspended): roll the claim back.
          throw new BadRequestException('Invalid or expired activation token');
        }
      });
    }

    return {
      success: true,
      message: 'Account activated successfully',
    };
  }

  /**
   * Atomically marks a one-time token as consumed. Returns the token row only if it was
   * valid (right type, not consumed, not expired) at the moment of the UPDATE, else null.
   */
  private async claimToken(
    executor: any,
    tokenHash: string,
    type: 'INVITATION' | 'PASSWORD_RESET',
  ): Promise<any | null> {
    const now = new Date();
    const rows = await executor
      .update(userTokens)
      .set({ consumedAt: now })
      .where(
        and(
          eq(userTokens.tokenHash, tokenHash),
          eq(userTokens.type, type),
          isNull(userTokens.consumedAt),
          gt(userTokens.expiresAt, now),
        ),
      )
      .returning();
    return rows?.[0] ?? null;
  }

  /**
   * Resets password using a one-time reset token and increments permissions_version to revoke active sessions.
   */
  async resetPassword(dto: ResetPassword): Promise<{ success: boolean; message: string }> {
    const tokenHash = this.tokenService.hashToken(dto.token);
    const tokenRecord = await this.findUserToken(tokenHash, 'PASSWORD_RESET');

    if (!tokenRecord || tokenRecord.consumedAt || new Date(tokenRecord.expiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const user = await this.findUserById(tokenRecord.userId);
    if (!user) {
      throw new BadRequestException('Invalid or expired password reset token');
    }

    const passwordHash = await this.passwordService.hash(dto.newPassword);

    if (this.db) {
      await this.db.transaction(async (tx: any) => {
        const claimed = await this.claimToken(tx, tokenHash, 'PASSWORD_RESET');
        if (!claimed) {
          throw new BadRequestException('Invalid or expired password reset token');
        }

        await tx
          .update(users)
          .set({
            passwordHash,
            permissionsVersion: sql`${users.permissionsVersion} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id));

        // Sign the account out everywhere: revoke every refresh token still alive.
        await tx
          .update(refreshTokens)
          .set({ revokedAt: new Date() })
          .where(and(eq(refreshTokens.userId, user.id), isNull(refreshTokens.revokedAt)));
      });
    }

    return {
      success: true,
      message: 'Password reset successfully',
    };
  }

  /**
   * Verifies access token and ensures user permissions_version matches DB version (instant revocation check).
   */
  async verifyTokenWithPermissions(token: string): Promise<any> {
    const payload = await this.tokenService.verifyAccessToken(token);

    const user = await this.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('User account has been suspended');
    }

    if (user.permissionsVersion !== payload.pv) {
      throw new UnauthorizedException('Permissions revoked or outdated');
    }

    return user;
  }

  /**
   * Retrieves user profile by id.
   */
  async me(userId: string): Promise<any> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { passwordHash, ...profile } = user;
    const roleViews = (await loadUserRoleViews(this.db, [userId])).get(userId) ?? [];
    return { ...profile, roles: roleViews, capabilities: await capabilitiesForRoles(roleViews) };
  }

  private async findUserByEmail(email: string): Promise<any> {
    if (!this.db) return null;
    const normalizedEmail = email.trim().toLowerCase();
    if (this.db.query?.users?.findFirst) {
      return this.db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
      });
    }
    const rows = await this.db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    return rows[0] || null;
  }

  private async findUserById(id: string): Promise<any> {
    if (!this.db) return null;
    if (this.db.query?.users?.findFirst) {
      return this.db.query.users.findFirst({
        where: eq(users.id, id),
      });
    }
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] || null;
  }

  private async findRefreshToken(tokenHash: string): Promise<any> {
    if (!this.db) return null;
    if (this.db.query?.refreshTokens?.findFirst) {
      return this.db.query.refreshTokens.findFirst({
        where: eq(refreshTokens.tokenHash, tokenHash),
      });
    }
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .limit(1);
    return rows[0] || null;
  }

  private async findUserToken(tokenHash: string, type: 'INVITATION' | 'PASSWORD_RESET'): Promise<any> {
    if (!this.db) return null;
    if (this.db.query?.userTokens?.findFirst) {
      return this.db.query.userTokens.findFirst({
        where: and(eq(userTokens.tokenHash, tokenHash), eq(userTokens.type, type)),
      });
    }
    const rows = await this.db
      .select()
      .from(userTokens)
      .where(and(eq(userTokens.tokenHash, tokenHash), eq(userTokens.type, type)))
      .limit(1);
    return rows[0] || null;
  }
}
