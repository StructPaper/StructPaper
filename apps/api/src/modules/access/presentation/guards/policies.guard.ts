import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Optional,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AbilityFactory, type AppAbility } from '../../domain/ability.factory';
import { AbilityCacheService } from '../../domain/ability-cache.service';
import { CHECK_POLICIES_KEY, type PolicyHandler } from '../decorators/check-policies.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AbilityFactory)
    private readonly abilityFactory: AbilityFactory,
    @Optional()
    @Inject(AbilityCacheService)
    private readonly abilityCache?: AbilityCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers =
      this.reflector.get<PolicyHandler[]>(CHECK_POLICIES_KEY, context.getHandler()) ||
      this.reflector.get<PolicyHandler[]>(CHECK_POLICIES_KEY, context.getClass()) ||
      [];

    if (!policyHandlers || policyHandlers.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    if (!user) {
      throw new ForbiddenException('User is not authenticated');
    }

    const userId = user.id;
    const pv = user.permissionsVersion;

    let ability: AppAbility | undefined;
    if (this.abilityCache && userId && pv !== undefined) {
      ability = this.abilityCache.get(userId, pv);
    }

    if (!ability) {
      ability = await this.abilityFactory.createForUser(userId ?? user);
      if (this.abilityCache && userId && pv !== undefined) {
        this.abilityCache.set(userId, pv, ability);
      }
    }

    // Expose the resolved ability so controllers/services can run finer-grained checks.
    request.ability = ability;

    for (const handler of policyHandlers) {
      let isAllowed = false;

      if (typeof handler === 'function') {
        isAllowed = await handler(ability, request, context);
      } else if (handler && typeof handler.handle === 'function') {
        isAllowed = await handler.handle(ability, request, context);
      }

      if (!isAllowed) {
        throw new ForbiddenException('Access denied: You do not have permission to perform this action');
      }
    }

    return true;
  }
}
