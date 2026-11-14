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
  Optional,
  Inject,
} from '@nestjs/common';
import {
  CreateManuscriptSchema,
  UpdateManuscriptSchema,
  ChangeManuscriptStatusSchema,
  ManuscriptQuerySchema,
  AddManuscriptMemberSchema,
  type CreateManuscript,
  type UpdateManuscript,
  type ChangeManuscriptStatus,
  type ManuscriptQuery,
  type AddManuscriptMember,
} from '@structpaper/contracts';
import { JwtAuthGuard } from '../../access/presentation/guards/jwt-auth.guard';
import { AbilityFactory, type AppAbility } from '../../access/domain/ability.factory';
import { AbilityCacheService } from '../../access/domain/ability-cache.service';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';
import { ManuscriptService } from '../application/manuscript.service';

@Controller('manuscripts')
@UseGuards(JwtAuthGuard)
export class ManuscriptController {
  constructor(
    @Inject(ManuscriptService)
    private readonly manuscriptService: ManuscriptService,
    @Inject(AbilityFactory)
    private readonly abilityFactory: AbilityFactory,
    @Optional()
    @Inject(AbilityCacheService)
    private readonly abilityCache?: AbilityCacheService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateManuscriptSchema))
  async create(@Body() body: CreateManuscript, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.createManuscript(body, req.user?.id, ability);
  }

  @Get()
  @UsePipes(new ZodValidationPipe(ManuscriptQuerySchema))
  async list(@Query() query: ManuscriptQuery, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.listManuscripts(query, ability, req.user?.id);
  }

  @Get(':id')
  async getById(
    @Param('id') id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const ability = await this.getAbility(req);
    const manuscript = await this.manuscriptService.getManuscript(id, ability);
    if (manuscript?.version !== undefined) {
      res.header('ETag', `"${manuscript.version}"`);
    }
    return manuscript;
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateManuscriptSchema))
  async update(
    @Param('id') id: string,
    @Body() body: UpdateManuscript,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const ability = await this.getAbility(req);
    const updated = await this.manuscriptService.updateManuscript(id, body, ifMatch, ability);
    if (updated?.version !== undefined) {
      res.header('ETag', `"${updated.version}"`);
    }
    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.deleteManuscript(id, ability);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(AddManuscriptMemberSchema))
  async addMember(
    @Param('id') id: string,
    @Body() body: AddManuscriptMember,
    @Req() req: any,
  ) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.addMember(id, body, ability);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  async removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.removeMember(id, userId, ability);
  }

  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  async getMembers(@Param('id') id: string, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.getMembers(id, ability);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(ChangeManuscriptStatusSchema))
  async changeStatus(
    @Param('id') id: string,
    @Body() body: ChangeManuscriptStatus,
    @Req() req: any,
  ) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.changeStatus(id, body, req.user?.id, ability);
  }

  private async getAbility(req: any): Promise<AppAbility | undefined> {
    const user = req.user;
    if (!user) return undefined;

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
