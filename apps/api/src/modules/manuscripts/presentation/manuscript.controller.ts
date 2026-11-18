import {
  Controller,
  StreamableFile,
  NotFoundException,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Query,
  Body,
  Headers,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UsePipes,
  Optional,
  Inject,
} from '@nestjs/common';
import {
  CreateManuscriptSchema,
  UpdateManuscriptSchema,
  ChangeManuscriptStatusSchema,
  ManuscriptQuerySchema,
  ChangeArticleTypeSchema,
  type ChangeArticleType,
  AddManuscriptMemberSchema,
  UpdateGeneralAccessSchema,
  PeopleSearchQuerySchema,
  DuplicateQuerySchema,
  type CreateManuscript,
  type UpdateManuscript,
  type ChangeManuscriptStatus,
  type ManuscriptQuery,
  type AddManuscriptMember,
  type UpdateGeneralAccess,
} from '@structpaper/contracts';
import { AbilityFactory, type AppAbility } from '../../access/domain/ability.factory';
import { AbilityCacheService } from '../../access/domain/ability-cache.service';
import { OptionalAuth } from '../../access/presentation/decorators/optional-auth.decorator';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';
import { ManuscriptService } from '../application/manuscript.service';
import { ManuscriptSharingService } from '../application/manuscript-sharing.service';
import { ManuscriptPreviewService } from '../application/manuscript-preview.service';
import { ManuscriptDuplicatesService } from '../application/manuscript-duplicates.service';

/** Ids of papers that only exist on the user's machine (paper_123) are not UUIDs: answer 404, never a database error. */
const ManuscriptIdPipe = {
  transform(value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new NotFoundException(`Manuscript with ID ${value} not found`);
    }
    return value;
  },
};

@Controller('manuscripts')
export class ManuscriptController {
  constructor(
    @Inject(ManuscriptService)
    private readonly manuscriptService: ManuscriptService,
    @Inject(AbilityFactory)
    private readonly abilityFactory: AbilityFactory,
    @Optional()
    @Inject(AbilityCacheService)
    private readonly abilityCache?: AbilityCacheService,
    @Inject(ManuscriptSharingService)
    private readonly sharing?: ManuscriptSharingService,
    @Inject(ManuscriptPreviewService)
    private readonly previews?: ManuscriptPreviewService,
    @Inject(ManuscriptDuplicatesService)
    private readonly duplicates?: ManuscriptDuplicatesService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(CreateManuscriptSchema))
  async create(@Body() body: CreateManuscript, @Req() req: any) {
    const ability = await this.getAbility(req);
    const created = await this.manuscriptService.createManuscript(body, req.user?.id, ability);
    // The creator just became OWNER: their cached ability does not know this manuscript yet.
    if (req.user?.id) this.abilityCache?.invalidate(req.user.id);
    return created;
  }

  @Get()
  @UsePipes(new ZodValidationPipe(ManuscriptQuerySchema))
  async list(@Query() query: ManuscriptQuery, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.listManuscripts(query, ability, req.user?.id);
  }

  /** Look members up by email/name to share a manuscript with (any signed-in user). */
  @Get('people')
  @UsePipes(new ZodValidationPipe(PeopleSearchQuerySchema))
  async searchPeople(@Query() query: { q: string }, @Req() req: any) {
    return this.sharing!.searchPeople(query.q, req.user?.id);
  }

  /** Papers already uploaded with this title, and by whom (names and dates only). */
  @Get('duplicates')
  @UsePipes(new ZodValidationPipe(DuplicateQuerySchema))
  async findDuplicates(@Query() query: { title: string }, @Req() req: any) {
    return this.duplicates!.findByTitle(query.title, req.user?.id);
  }

  /** Readable by guests when the owner shared it with "anyone with the link". */
  @Get(':id')
  @OptionalAuth()
  async getById(
    @Param('id', ManuscriptIdPipe) id: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const ability = await this.getAbility(req);
    const manuscript = await this.manuscriptService.getManuscript(id, ability);
    if (req.user?.id) void this.sharing?.recordVisit(manuscript, req.user.id);
    if (!req.user) delete manuscript.members; // guests never see who else has access
    if (manuscript?.version !== undefined) {
      res.header('ETag', `"${manuscript.version}"`);
    }
    return manuscript;
  }

  @Patch(':id')
  @UsePipes(new ZodValidationPipe(UpdateManuscriptSchema))
  async update(
    @Param('id', ManuscriptIdPipe) id: string,
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
  async delete(@Param('id', ManuscriptIdPipe) id: string, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.deleteManuscript(id, ability);
  }

  /** Latest compiled PDF: readable by everybody who may read the paper, guests included. */
  @Get(':id/preview')
  @OptionalAuth()
  async getPreview(@Param('id', ManuscriptIdPipe) id: string, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const ability = await this.getAbility(req);
    const pdf = await this.previews!.read(id, ability);
    res.header('Content-Type', 'application/pdf');
    res.header('Cache-Control', 'private, no-store');
    return new StreamableFile(pdf);
  }

  /** Stores the PDF an editor has just compiled so that readers can see it. */
  @Put(':id/preview')
  @HttpCode(HttpStatus.OK)
  async putPreview(@Param('id', ManuscriptIdPipe) id: string, @Body() body: unknown, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.previews!.save(id, body, ability);
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(AddManuscriptMemberSchema))
  async addMember(
    @Param('id', ManuscriptIdPipe) id: string,
    @Body() body: AddManuscriptMember,
    @Req() req: any,
  ) {
    const ability = await this.getAbility(req);
    return this.sharing!.addMember(id, body, ability);
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.OK)
  async removeMember(
    @Param('id', ManuscriptIdPipe) id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    const ability = await this.getAbility(req);
    return this.sharing!.removeMember(id, userId, ability);
  }

  @Get(':id/members')
  @HttpCode(HttpStatus.OK)
  async getMembers(@Param('id', ManuscriptIdPipe) id: string, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.sharing!.getMembers(id, ability);
  }

  @Put(':id/general-access')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(UpdateGeneralAccessSchema))
  async setGeneralAccess(
    @Param('id', ManuscriptIdPipe) id: string,
    @Body() body: UpdateGeneralAccess,
    @Req() req: any,
  ) {
    const ability = await this.getAbility(req);
    return this.sharing!.setGeneralAccess(id, body.generalAccess, ability);
  }

  /** Moves the paper to the rules now published for its journal and article type (it never moves on its own). */
  @Post(':id/profile/upgrade')
  @HttpCode(HttpStatus.OK)
  async upgradeProfile(@Param('id', ManuscriptIdPipe) id: string, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.upgradeProfile(id, ability);
  }

  /** Moves the paper to another article type of its journal (null: none); the new type's rules apply. */
  @Put(':id/article-type')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(ChangeArticleTypeSchema))
  async changeArticleType(@Param('id', ManuscriptIdPipe) id: string, @Body() body: ChangeArticleType, @Req() req: any) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.changeArticleType(id, body.articleType, ability);
  }

  @Post(':id/status')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(ChangeManuscriptStatusSchema))
  async changeStatus(
    @Param('id', ManuscriptIdPipe) id: string,
    @Body() body: ChangeManuscriptStatus,
    @Req() req: any,
  ) {
    const ability = await this.getAbility(req);
    return this.manuscriptService.changeStatus(id, body, req.user?.id, ability);
  }

  private async getAbility(req: any): Promise<AppAbility | undefined> {
    const user = req.user;
    // Guest (only possible on @OptionalAuth routes): an ability without any role or membership.
    if (!user) return this.abilityFactory.createForUser({ roles: [], manuscriptMemberships: [] });

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
