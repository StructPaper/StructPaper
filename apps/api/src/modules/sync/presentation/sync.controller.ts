import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UsePipes,
  Optional,
  Inject,
} from '@nestjs/common';
import { SubmitOpsSchema, type SubmitOps } from '@structpaper/contracts';
import { AbilityFactory, type AppAbility } from '../../access/domain/ability.factory';
import { AbilityCacheService } from '../../access/domain/ability-cache.service';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';
import { SyncService } from '../application/sync.service';

@Controller('manuscripts')
export class SyncController {
  constructor(
    @Inject(SyncService)
    private readonly syncService: SyncService,
    @Inject(AbilityFactory)
    private readonly abilityFactory: AbilityFactory,
    @Optional()
    @Inject(AbilityCacheService)
    private readonly abilityCache?: AbilityCacheService,
  ) {}

  @Post(':id/sync/patches')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(SubmitOpsSchema))
  async submitPatches(
    @Param('id') id: string,
    @Body() body: SubmitOps,
    @Req() req: any,
  ) {
    const ability = await this.getAbility(req);
    return this.syncService.submitOps(id, body, req.user?.id, ability);
  }

  @Get(':id/sync/stream')
  async streamEvents(
    @Param('id') id: string,
    @Req() req: any,
    @Res() reply: any,
  ) {
    const ability = await this.getAbility(req);
    await this.syncService.subscribeStream(id, reply, req, ability);
  }

  @Get(':id/sync/missing-ops')
  async getMissingOps(
    @Param('id') id: string,
    @Query('sinceRev') sinceRev: string | undefined,
    @Req() req: any,
  ) {
    const ability = await this.getAbility(req);
    const parsedRev = sinceRev !== undefined ? parseInt(sinceRev, 10) : 0;
    const ops = await this.syncService.getMissingOps(id, Number.isNaN(parsedRev) ? 0 : parsedRev, ability);
    const doc = await this.syncService.getDoc(id, ability);
    return {
      serverRev: doc?.serverRev ?? 0,
      ops,
      missingOps: ops,
    };
  }

  @Get(':id/doc')
  async getDoc(@Param('id') id: string, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.syncService.getDoc(id, ability);
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
