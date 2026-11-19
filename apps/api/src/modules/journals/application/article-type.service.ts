import {
  Injectable,
  Inject,
  Optional,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { subject } from '@casl/ability';
import { articleTypes, auditLogs, eq, and, asc, sql, type DbClient, type Journal, type ArticleType } from '@structpaper/db';
import { ARTICLE_TYPE_DEFINITIONS } from '@structpaper/journal-profiles';
import type { ArticleTypeDto, CreateArticleType, UpdateArticleType } from '@structpaper/contracts';
import type { AppAbility } from '../../access/domain/ability.factory';
import { JournalService } from './journal.service';
import { ProfileService } from './profile.service';

export function toArticleTypeDto(row: ArticleType): ArticleTypeDto {
  return { id: row.id, code: row.code, labels: row.labels, status: row.status, sortOrder: row.sortOrder };
}

/** The article types (research, review, ...) a journal accepts. Their layout rules are versioned like the journal's. */
@Injectable()
export class ArticleTypeService {
  constructor(
    @Inject(JournalService) private readonly journals: JournalService,
    @Inject(ProfileService) private readonly profiles: ProfileService,
    @Optional() @Inject('DRIZZLE') private readonly db?: DbClient,
  ) {}

  /** Types of a journal, in order. Archived ones are only listed on request (old papers may still use them). */
  async list(journalRef: string, includeArchived = false): Promise<(ArticleTypeDto & { label: { vi: string; en: string }; requiredSections: string[] })[]> {
    const journal = await this.journals.findRow(journalRef);
    if (!journal) return this.builtInList(journalRef);
    const rows = await this.requireDb().select().from(articleTypes).where(eq(articleTypes.journalId, journal.id)).orderBy(asc(articleTypes.sortOrder), asc(articleTypes.code));
    const visible = rows.filter((r) => includeArchived || r.status === 'active');
    const published = await this.profiles.publishedTypeConfigs(visible.map((r) => r.id));
    return visible.map((r) => ({
      ...toArticleTypeDto(r),
      label: r.labels,
      requiredSections: (published.get(r.id)?.requiredSections as string[] | undefined) ?? [],
    }));
  }

  async create(journalRef: string, dto: CreateArticleType, ability: AppAbility, userId?: string): Promise<ArticleTypeDto> {
    const journal = await this.writableJournal(journalRef, ability);
    const db = this.requireDb();
    const existing = await this.findByCode(journal, dto.code);
    if (existing) throw new ConflictException(`The journal already has an article type '${dto.code}'`);

    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${articleTypes.sortOrder}), 0) + 10` })
      .from(articleTypes)
      .where(eq(articleTypes.journalId, journal.id));
    const [row] = await db
      .insert(articleTypes)
      .values({ journalId: journal.id, code: dto.code, labels: dto.labels, sortOrder: dto.sortOrder ?? Number(next) })
      .returning();
    await this.profiles.ensureArticleTypeBaseline(row, userId);
    await this.audit(db, userId, 'article_type.create', row.id, { journal: journal.slug, code: dto.code });
    return toArticleTypeDto(row);
  }

  async update(journalRef: string, code: string, dto: UpdateArticleType, ability: AppAbility, userId?: string): Promise<ArticleTypeDto> {
    const journal = await this.writableJournal(journalRef, ability);
    const row = await this.findByCode(journal, code);
    if (!row) throw new NotFoundException(`Journal '${journalRef}' has no article type '${code}'`);
    const [updated] = await this.requireDb()
      .update(articleTypes)
      .set({
        ...(dto.labels !== undefined && { labels: dto.labels }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      })
      .where(eq(articleTypes.id, row.id))
      .returning();
    await this.audit(this.requireDb(), userId, 'article_type.update', row.id, { journal: journal.slug, code, fields: Object.keys(dto) });
    return toArticleTypeDto(updated);
  }

  async findByCode(journal: Journal, code: string): Promise<ArticleType | undefined> {
    if (!this.db) return undefined;
    const [row] = await this.db
      .select()
      .from(articleTypes)
      .where(and(eq(articleTypes.journalId, journal.id), eq(articleTypes.code, code.trim().toLowerCase())))
      .limit(1);
    return row;
  }

  private async writableJournal(journalRef: string, ability: AppAbility): Promise<Journal> {
    this.requireDb();
    const journal = await this.journals.findRow(journalRef);
    if (!journal) throw new NotFoundException(`Journal '${journalRef}' not found`);
    if (!ability.can('update', subject('Journal', journal as any))) throw new ForbiddenException('You may not edit this journal');
    return journal;
  }

  /** Without a database: the types the seed lists for the journal, with the code's own definitions. */
  private async builtInList(journalRef: string) {
    const journal = await this.journals.getJournalById(journalRef);
    return journal.articleTypes.map((code, i) => {
      const def = ARTICLE_TYPE_DEFINITIONS[code];
      const label = def?.label ?? { vi: code, en: code };
      return {
        id: code,
        code,
        labels: label as { vi: string; en: string },
        label: label as { vi: string; en: string },
        status: 'active' as const,
        sortOrder: (i + 1) * 10,
        requiredSections: def?.requiredSections ?? [],
      };
    });
  }

  private requireDb(): DbClient {
    if (!this.db) throw new ServiceUnavailableException('Article types cannot be edited without a database');
    return this.db;
  }

  private async audit(db: DbClient, userId: string | undefined, action: string, resourceId: string, payload: Record<string, unknown>) {
    try {
      await db.insert(auditLogs).values({ userId: userId ?? null, action, resourceType: 'article_type', resourceId, payload });
    } catch {
      // the audit trail must never block the change it describes
    }
  }
}
