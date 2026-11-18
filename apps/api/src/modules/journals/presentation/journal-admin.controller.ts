import {
  Controller, Get, Post, Patch, Param, Body, Headers, Req, Res, Inject,
  HttpCode, HttpStatus, UsePipes, UseGuards, ParseIntPipe,
} from '@nestjs/common';
import {
  CreateJournalSchema,
  UpdateJournalSchema,
  CreateArticleTypeSchema,
  UpdateArticleTypeSchema,
  CreateProfileDraftSchema,
  UpdateProfileDraftSchema,
  PublishProfileSchema,
  RollbackProfileSchema,
  ProfileScopeEnum,
  type CreateArticleType,
  type UpdateArticleType,
  type CreateJournal,
  type UpdateJournal,
  type CreateProfileDraft,
  type UpdateProfileDraft,
  type PublishProfile,
  type RollbackProfile,
  type ProfileScopeValue,
} from '@structpaper/contracts';
import { ZodValidationPipe } from '../../platform/pipes/zod-validation.pipe';
import { PoliciesGuard } from '../../access/presentation/guards/policies.guard';
import { CheckPolicies } from '../../access/presentation/decorators/check-policies.decorator';
import { canManageJournals } from '../../access/domain/capabilities';
import type { AppAbility } from '../../access/domain/ability.factory';
import { JournalAdminService } from '../application/journal-admin.service';
import { ProfileService } from '../application/profile.service';
import { ArticleTypeService } from '../application/article-type.service';

const mayRead = (a: AppAbility) => a.can('read', 'Journal');
const mayEdit = (a: AppAbility) => a.can('update', 'Journal');

/** `base`, `journal` or `article_type`: anything else is a 400, not a 500. */
const ScopePipe = { transform: (v: string): ProfileScopeValue => ProfileScopeEnum.parse(v) };

// The global JwtAuthGuard authenticates; PoliciesGuard puts the caller's ability on the request.
// Who may change *which* journal is checked again in the services, per journal.
@Controller()
@UseGuards(PoliciesGuard)
@CheckPolicies(mayRead)
export class JournalAdminController {
  constructor(
    @Inject(JournalAdminService) private readonly admin: JournalAdminService,
    @Inject(ProfileService) private readonly profiles: ProfileService,
    @Inject(ArticleTypeService) private readonly articleTypes: ArticleTypeService,
  ) {}

  @Post('journals')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies(canManageJournals)
  @UsePipes(new ZodValidationPipe(CreateJournalSchema))
  async create(@Body() body: CreateJournal, @Req() req: any) {
    return this.admin.create(body, req.ability, req.user?.id);
  }

  @Patch('journals/:id')
  @CheckPolicies(mayEdit)
  @UsePipes(new ZodValidationPipe(UpdateJournalSchema))
  async update(
    @Param('id') id: string,
    @Body() body: UpdateJournal,
    @Headers('if-match') ifMatch: string | undefined,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    const updated = await this.admin.update(id, body, ifMatch, req.ability, req.user?.id);
    res.header('ETag', `"${updated.version}"`);
    return updated;
  }

  /** Whether the caller may edit this journal (scoped managers may edit theirs only). */
  @Get('journals/:id/access')
  async access(@Param('id') id: string, @Req() req: any) {
    return this.admin.accessFor(id, req.ability);
  }

  @Post('journals/:id/article-types')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies(mayEdit)
  @UsePipes(new ZodValidationPipe(CreateArticleTypeSchema))
  async createArticleType(@Param('id') id: string, @Body() body: CreateArticleType, @Req() req: any) {
    return this.articleTypes.create(id, body, req.ability, req.user?.id);
  }

  @Patch('journals/:id/article-types/:code')
  @CheckPolicies(mayEdit)
  @UsePipes(new ZodValidationPipe(UpdateArticleTypeSchema))
  async updateArticleType(@Param('id') id: string, @Param('code') code: string, @Body() body: UpdateArticleType, @Req() req: any) {
    return this.articleTypes.update(id, code, body, req.ability, req.user?.id);
  }

  @Get('profiles/:scope/:id/versions')
  async versions(@Param('scope', ScopePipe) scope: ProfileScopeValue, @Param('id') id: string) {
    return this.profiles.listVersions(scope, id);
  }

  @Post('profiles/:scope/:id/drafts')
  @HttpCode(HttpStatus.CREATED)
  @CheckPolicies(mayEdit)
  @UsePipes(new ZodValidationPipe(CreateProfileDraftSchema))
  async createDraft(
    @Param('scope', ScopePipe) scope: ProfileScopeValue,
    @Param('id') id: string,
    @Body() body: CreateProfileDraft,
    @Req() req: any,
  ) {
    return this.profiles.createDraft(scope, id, body, req.ability, req.user?.id);
  }

  @Patch('profiles/:scope/:id/drafts/:version')
  @CheckPolicies(mayEdit)
  @UsePipes(new ZodValidationPipe(UpdateProfileDraftSchema))
  async updateDraft(
    @Param('scope', ScopePipe) scope: ProfileScopeValue,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() body: UpdateProfileDraft,
    @Req() req: any,
  ) {
    return this.profiles.updateDraft(scope, id, version, body, req.ability);
  }

  @Post('profiles/:scope/:id/drafts/:version/validate')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies(mayEdit)
  async validate(
    @Param('scope', ScopePipe) scope: ProfileScopeValue,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Req() req: any,
  ) {
    return this.profiles.validate(scope, id, version, req.ability);
  }

  @Post('profiles/:scope/:id/drafts/:version/publish')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies(mayEdit)
  @UsePipes(new ZodValidationPipe(PublishProfileSchema))
  async publish(
    @Param('scope', ScopePipe) scope: ProfileScopeValue,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @Body() body: PublishProfile,
    @Req() req: any,
  ) {
    return this.profiles.publish(scope, id, version, body, req.ability, req.user?.id);
  }

  @Post('profiles/:scope/:id/rollback')
  @HttpCode(HttpStatus.OK)
  @CheckPolicies(mayEdit)
  @UsePipes(new ZodValidationPipe(RollbackProfileSchema))
  async rollback(
    @Param('scope', ScopePipe) scope: ProfileScopeValue,
    @Param('id') id: string,
    @Body() body: RollbackProfile,
    @Req() req: any,
  ) {
    return this.profiles.rollback(scope, id, body, req.ability, req.user?.id);
  }
}
