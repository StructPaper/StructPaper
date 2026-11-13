import { Injectable, Optional, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import crypto from 'crypto';

export interface AccessTokenPayload {
  sub: string;
  pv: number;
}

export interface GeneratedToken {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly jwt: JwtService;

  constructor(
    @Optional() jwtService?: JwtService,
  ) {
    this.jwt = jwtService ?? new JwtService({
      secret: process.env.JWT_SECRET || 'dev-secret-structpaper-change-in-production',
    });
  }

  /**
   * Signs a short-lived (15m) access token.
   * CRITICAL: payload strictly contains only sub and pv, never roles.
   */
  async signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(
      {
        sub: payload.sub,
        pv: payload.pv,
      },
      {
        expiresIn: '15m',
      },
    );
  }

  /**
   * Verifies access token signature and expiration, returning decoded sub and pv.
   */
  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    try {
      const decoded = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (!decoded.sub || typeof decoded.pv !== 'number') {
        throw new UnauthorizedException('Invalid access token payload');
      }
      return {
        sub: decoded.sub,
        pv: decoded.pv,
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
  }

  /**
   * Generates a cryptographically secure 32-byte opaque refresh token,
   * hashed with SHA-256 for DB persistence, with 30-day lifetime.
   */
  generateRefreshToken(): GeneratedToken {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    return {
      rawToken,
      tokenHash,
      expiresAt,
    };
  }

  /**
   * Generates a 32-byte one-time token for invitations or password resets.
   */
  generateOneTimeToken(expiresInHours = 168): GeneratedToken {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    return {
      rawToken,
      tokenHash,
      expiresAt,
    };
  }

  /**
   * Computes SHA-256 hash of an opaque token string.
   */
  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
