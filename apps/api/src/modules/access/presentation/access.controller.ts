import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UsePipes,
  UseGuards,
  Inject,
  Optional,
} from '@nestjs/common';
import {
  AssignRoleSchema,
  RevokeRoleSchema,
  type AssignRole,
  type RevokeRole,
} from '@structpaper/contracts';
import { AccessService } from '../application/access.service';
import { AbilityFactory, type AppAbility } from '../domain/ability.factory';
import { AbilityCacheService } from '../domain/ability-cache.service';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';
import { PoliciesGuard } from './guards/policies.guard';
import { CheckPolicies } from './decorators/check-policies.decorator';

/** Only people able to manage roles (SuperAdmin / JournalManager) may change role assignments. */
const canManageRoles = (ability: AppAbility) =>
  ability.can('manage', 'all') || ability.can('manage', 'Role');

// The global JwtAuthGuard authenticates every route; PoliciesGuard enforces the @CheckPolicies rules.
@Controller()
@UseGuards(PoliciesGuard)
export class AccessController {
  constructor(
    @Inject(AccessService) private readonly accessService: AccessService,
    @Optional()
    @Inject(AbilityFactory)
    private readonly abilityFactory?: AbilityFactory,
    @Optional()
    @Inject(AbilityCacheService)
    private readonly abilityCache?: AbilityCacheService,
  ) {}

  @Get('roles')
  async getRoles() {
    return this.accessService.getRoles();
  }

  @Get('permissions')
  async getPermissions() {
    return this.accessService.getPermissions();
  }

  @Post('roles/assign')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies(canManageRoles)
  @UsePipes(new ZodValidationPipe(AssignRoleSchema))
  async assignRole(@Body() body: AssignRole, @Req() req?: any) {
    const ability = await this.getAbility(req);
    return this.accessService.assignRole(body, req?.user, ability);
  }

  @Delete('roles/assign')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies(canManageRoles)
  @UsePipes(new ZodValidationPipe(RevokeRoleSchema))
  async revokeRoleBody(@Body() body: RevokeRole, @Req() req?: any) {
    const ability = await this.getAbility(req);
    return this.accessService.revokeRole(body, req?.user, ability);
  }

  @Delete('admin/users/:id/roles/:roleId')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies(canManageRoles)
  async revokeRole(
    @Param('id') userId: string,
    @Param('roleId') roleId: string,
    @Query('journalId') journalId: string | undefined,
    @Req() req?: any,
  ) {
    const ability = await this.getAbility(req);
    return this.accessService.revokeRole(
      {
        userId,
        roleId,
        journalId: journalId || null,
      },
      req?.user,
      ability,
    );
  }

  private async getAbility(req?: any): Promise<AppAbility | undefined> {
    const user = req?.user;
    if (!user || !this.abilityFactory) return undefined;

    const userId = user.id;
    const pv = user.permissionsVersion;

    if (this.abilityCache && userId && pv !== undefined) {
      const cached = this.abilityCache.get(userId, pv);
      if (cached) return cached;
    }

    const ability = await this.abilityFactory.createForUser(userId ?? user);
    if (this.abilityCache && userId && pv !== undefined) {
      this.abilityCache.set(userId, pv, ability);
    }
    return ability;
  }
}
