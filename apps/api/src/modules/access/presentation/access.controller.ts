import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UsePipes,
  Inject,
} from '@nestjs/common';
import { AssignRoleSchema, type AssignRole } from '@structpaper/contracts';
import { AccessService } from '../application/access.service';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';

@Controller()
export class AccessController {
  constructor(@Inject(AccessService) private readonly accessService: AccessService) {}

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
  @UsePipes(new ZodValidationPipe(AssignRoleSchema))
  async assignRole(@Body() body: AssignRole) {
    return this.accessService.assignRole(body);
  }
}
