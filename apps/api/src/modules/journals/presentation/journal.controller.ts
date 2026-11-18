import { Controller, Get, Param, Query, Inject, HttpCode, HttpStatus } from '@nestjs/common';
import { Public } from '../../access/presentation/decorators/public.decorator';
import { JournalService, type JournalDto } from '../application/journal.service';

// Read-only reference data (journals, article types, profiles): visible without logging in.
@Public()
@Controller()
export class JournalController {
  constructor(
    @Inject(JournalService)
    private readonly journalService: JournalService,
  ) {}

  @Get('journals')
  @HttpCode(HttpStatus.OK)
  async listJournals(): Promise<JournalDto[]> {
    return this.journalService.listJournals();
  }

  @Get('journals/:id')
  @HttpCode(HttpStatus.OK)
  async getJournalById(@Param('id') id: string): Promise<JournalDto> {
    return this.journalService.getJournalById(id);
  }

  @Get('journals/:id/article-types')
  @HttpCode(HttpStatus.OK)
  async getArticleTypes(@Param('id') id: string): Promise<any[]> {
    return this.journalService.getArticleTypes(id);
  }

  @Get('profiles/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveProfile(
    @Query('journal') journal: string,
    @Query('type') type?: string,
  ): Promise<any> {
    return this.journalService.resolveProfile(journal || 'std', type);
  }
}
