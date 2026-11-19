import { Controller, Get, Param, Query, Headers, Res, Inject, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../../access/presentation/decorators/public.decorator';
import { JournalService, type JournalDto } from '../application/journal.service';
import { ArticleTypeService } from '../application/article-type.service';
import { ProfileResolveService, parsePin, type PublishedProfiles, type ResolvedProfileResponse } from '../application/profile-resolve.service';

// Read-only reference data (journals, article types, profiles): visible without logging in.
@Public()
@Controller()
export class JournalController {
  constructor(
    @Inject(JournalService) private readonly journalService: JournalService,
    @Inject(ArticleTypeService) private readonly articleTypeService: ArticleTypeService,
    @Inject(ProfileResolveService) private readonly resolver: ProfileResolveService,
  ) {}

  @Get('journals')
  @HttpCode(HttpStatus.OK)
  async listJournals(): Promise<JournalDto[]> {
    return this.journalService.listJournals();
  }

  @Get('journals/:id')
  @HttpCode(HttpStatus.OK)
  async getJournalById(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: any,
  ): Promise<JournalDto> {
    const journal = await this.journalService.getJournalById(id);
    res.header('ETag', `"${journal.version}"`);
    return journal;
  }

  @Get('journals/:id/article-types')
  @HttpCode(HttpStatus.OK)
  async getArticleTypes(@Param('id') id: string, @Query('includeArchived') includeArchived?: string): Promise<any[]> {
    return this.articleTypeService.list(id, includeArchived === 'true' || includeArchived === '1');
  }

  /** The rules the app lays papers out by: the published tiers of every journal (one request, cacheable by ETag). */
  @Get('profiles/published')
  @HttpCode(HttpStatus.OK)
  async published(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) res: any,
  ): Promise<PublishedProfiles | undefined> {
    const published = await this.resolver.getPublished();
    res.header('ETag', published.etag);
    if (ifNoneMatch && ifNoneMatch === published.etag) {
      res.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }
    return published;
  }

  /** `pin=base:1,journal:3,type:2` resolves the exact versions a paper was written under instead of the published ones. */
  @Get('profiles/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveProfile(
    @Query('journal') journal: string,
    @Query('type') type: string | undefined,
    @Query('pin') pin: string | undefined,
    @Res({ passthrough: true }) res: any,
  ): Promise<ResolvedProfileResponse['profile']> {
    const result = await this.resolver.resolve(journal || 'std', type, parsePin(pin));
    res.header('ETag', result.etag);
    res.header('X-Profile-Versions', `base:${result.versions.base},journal:${result.versions.journal}${result.versions.articleType !== undefined ? `,type:${result.versions.articleType}` : ''}`);
    return result.profile;
  }
}
