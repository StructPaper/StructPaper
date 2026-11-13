import type { AppAbility } from './ability.factory';

export abstract class AbilityCacheService {
  abstract get(userId: string, pv: number): AppAbility | undefined;
  abstract set(userId: string, pv: number, ability: AppAbility, ttlSeconds?: number): void;
  abstract invalidate(userId: string): void;
  abstract clear?(): void;
}
