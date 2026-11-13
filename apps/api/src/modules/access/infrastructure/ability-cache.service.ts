import { Injectable } from '@nestjs/common';
import { AbilityCacheService } from '../domain/ability-cache.service';
import type { AppAbility } from '../domain/ability.factory';

interface CacheEntry {
  ability: AppAbility;
  expiresAt: number;
}

@Injectable()
export class InMemoryAbilityCacheService extends AbilityCacheService {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly defaultTtlMs: number;
  private readonly maxSize: number;

  constructor(ttlMs = 60_000, maxSize = 1000) {
    super();
    this.defaultTtlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get(userId: string, pv: number): AppAbility | undefined {
    const key = `${userId}:${pv}`;
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Refresh LRU order
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.ability;
  }

  set(userId: string, pv: number, ability: AppAbility, ttlSeconds?: number): void {
    const key = `${userId}:${pv}`;
    const ttlMs = ttlSeconds !== undefined ? ttlSeconds * 1000 : this.defaultTtlMs;

    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict oldest (least recently used) entry
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      ability,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(userId: string): void {
    const prefix = `${userId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export { InMemoryAbilityCacheService as AbilityCacheService };
