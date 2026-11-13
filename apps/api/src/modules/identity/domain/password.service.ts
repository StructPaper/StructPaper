import { Injectable } from '@nestjs/common';
import * as argon2 from '@node-rs/argon2';
import crypto from 'crypto';

@Injectable()
export class PasswordService {
  /**
   * Hashes a plain password using Argon2id with memoryCost: 65536 (64MB) and timeCost: 3
   */
  async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      memoryCost: 65536,
      timeCost: 3,
    });
  }

  /**
   * Verifies a plain password against an Argon2id or legacy scrypt hash
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    if (!hash || !plain) {
      return false;
    }

    if (hash.startsWith('scrypt:')) {
      return this.verifyLegacyScrypt(hash, plain);
    }

    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  private verifyLegacyScrypt(hash: string, plain: string): boolean {
    try {
      const parts = hash.split(':');
      if (parts.length !== 3) {
        return false;
      }
      const [, salt, derivedKey] = parts;
      const key = crypto.scryptSync(plain, salt, 64).toString('hex');
      const keyBuffer = Buffer.from(key, 'utf-8');
      const expectedBuffer = Buffer.from(derivedKey, 'utf-8');
      if (keyBuffer.length !== expectedBuffer.length) {
        return false;
      }
      return crypto.timingSafeEqual(keyBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }
}
