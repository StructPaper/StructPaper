import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  Headers,
  Res,
  HttpCode,
  HttpStatus,
  UsePipes,
  Inject,
} from '@nestjs/common';
import { InviteUserSchema, type InviteUser } from '@structpaper/contracts';
import { UserService, type UpdateUserDto } from '../application/user.service';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';

@Controller('users')
export class UserController {
  constructor(@Inject(UserService) private readonly userService: UserService) {}

  @Get()
  async list(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('search') search?: string,
  ) {
    return this.userService.listUsers({
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
      search,
    });
  }

  @Post('invite')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(InviteUserSchema))
  async invite(@Body() body: InviteUser) {
    return this.userService.inviteUser(body);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @Res({ passthrough: true }) res: any) {
    const user = await this.userService.getUserById(id);
    if (user?.permissionsVersion !== undefined) {
      res.header('ETag', `"${user.permissionsVersion}"`);
    }
    return user;
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @Headers('if-match') ifMatch: string | undefined,
    @Res({ passthrough: true }) res: any,
  ) {
    const updated = await this.userService.updateUser(id, body, ifMatch);
    if (updated?.permissionsVersion !== undefined) {
      res.header('ETag', `"${updated.permissionsVersion}"`);
    }
    return updated;
  }
}
