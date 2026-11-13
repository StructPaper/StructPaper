import { SetMetadata } from '@nestjs/common';
import type { AppAbility } from '../../domain/ability.factory';

export type PolicyHandlerFn = (
  ability: AppAbility,
  request?: any,
  context?: any,
) => boolean | Promise<boolean>;

export interface IPolicyHandler {
  handle(ability: AppAbility, request?: any, context?: any): boolean | Promise<boolean>;
}

export type PolicyHandler = PolicyHandlerFn | IPolicyHandler;

export const CHECK_POLICIES_KEY = 'check_policies';

export const CheckPolicies = (...handlers: PolicyHandler[]) =>
  SetMetadata(CHECK_POLICIES_KEY, handlers);
