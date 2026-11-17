import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UseGuards,
  UsePipes,
  ParseUUIDPipe,
  Inject,
} from '@nestjs/common';
import {
  InviteUserSchema,
  UpdateUserSchema,
  type InviteUser,
  type UpdateUser,
} from '@structpaper/contracts';
import { UserService, type InviteActor } from '../application/user.service';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';
import { PoliciesGuard } from '../../access/presentation/guards/policies.guard';
import { CheckPolicies } from '../../access/presentation/decorators/check-policies.decorator';
import type { AppAbility } from '../../access/domain/ability.factory';

/** Member administration is reserved for people who can manage roles (SuperAdmin / JournalManager). */
const canManageMembers = (ability: AppAbility) =>
  ability.can('manage', 'all') || ability.can('manage', 'Role');

const toInt = (value?: string): number | undefined => {
  if (value === undefined || value === '') return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
};

const actorOf = (req: any): InviteActor => ({ user: req?.user, ability: req?.ability });

@Controller('users')
@UseGuards(PoliciesGuard)
@CheckPolicies(canManageMembers)
export class UserController {
  constructor(@Inject(UserService) private readonly userService: UserService) {}

  @Get()
  async list(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    return this.userService.listUsers(
      {
        limit: toInt(limit),
        offset: toInt(offset),
        search,
      },
      actorOf(req),
    );
  }

  // NOTE: declared before ':id' so "invitations" is not parsed as a user id.
  @Get('invitations')
  async listInvitations() {
    return this.userService.listPendingInvitations();
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(InviteUserSchema))
  async invite(@Body() body: InviteUser, @Req() req: any) {
    return this.userService.inviteUser(body, actorOf(req));
  }

  @Post(':id/resend-invite')
  @HttpCode(HttpStatus.OK)
  async resendInvite(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: any) {
    return this.userService.resendInvite(id, actorOf(req));
  }

  @Delete(':id/invitation')
  @HttpCode(HttpStatus.OK)
  async revokeInvitation(@Param('id', new ParseUUIDPipe()) id: string, @Req() req: any) {
    return this.userService.revokeInvitation(id, actorOf(req));
  }

  @Get(':id')
  async getById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res({ passthrough: true }) res: any,
  ) {
    const user = await this.userService.getUserById(id);
    if (user?.permissionsVersion !== undefined) {
      res.header('ETag', `"${user.permissionsVersion}"`);
    }
    return user;
  }

  @Patch(':id')
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(UpdateUserSchema)) body: UpdateUser,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const updated = await this.userService.updateUser(id, body, ifMatch, actorOf(req));
    if (updated?.permissionsVersion !== undefined) {
      res.header('ETag', `"${updated.permissionsVersion}"`);
    }
    return updated;
  }
}
