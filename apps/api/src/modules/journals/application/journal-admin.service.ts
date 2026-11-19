import {
  Injectable,
  Inject,
  Optional,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { subject } from '@casl/ability';
import { journals, articleTypes, auditLogs, eq, and, sql, ARTICLE_TYPE_LABELS, type DbClient } from '@structpaper/db';
import { ARTICLE_TYPE_DEFINITIONS } from '@structpaper/journal-profiles';
import type { CreateJournal, UpdateJournal } from '@structpaper/contracts';
import type { AppAbility } from '../../access/domain/ability.factory';
import { JournalService, type JournalDto } from './journal.service';
import { ProfileService } from './profile.service';

/** Creating and editing journals: who they are (name, code, colour, status), not how their papers are laid out. */
@Injectable()
export class JournalAdminService {
  constructor(
    @Inject(JournalService) private readonly reads: JournalService,
    @Inject(ProfileService) private readonly profiles: ProfileService,
    @Optional() @Inject('DRIZZLE') private readonly db?: DbClient,
  ) {}

  /** What the caller may do with a journal: the screens show editing only where the API would allow it. */
  async accessFor(idOrSlug: string, ability: AppAbility): Promise<{ canEdit: boolean; canCreate: boolean }> {
    const row = await this.reads.findRow(idOrSlug);
    return {
      canCreate: ability.can('create', 'Journal'),
      canEdit: row ? ability.can('update', subject('Journal', row as any)) : false,
    };
  }

  async create(dto: CreateJournal, ability: AppAbility, userId?: string): Promise<JournalDto> {
    if (!ability.can('create', 'Journal')) throw new ForbiddenException('You may not create journals');
    const db = this.requireDb();

    const slug = `vnuhcm-${dto.key}`;
    if (await this.reads.findRow(slug)) throw new ConflictException(`A journal with the key '${dto.key}' already exists`);
    const code = dto.code ?? `VNUHCM-${dto.key.toUpperCase()}`;
    const [sameCode] = await db.select({ id: journals.id }).from(journals).where(eq(journals.code, code)).limit(1);
    if (sameCode) throw new ConflictException(`A journal with the code '${code}' already exists`);

    const [{ next }] = await db
      .select({ next: sql<number>`coalesce(max(${journals.sortOrder}), 0) + 10` })
      .from(journals);

    const [row] = await db
      .insert(journals)
      .values({
        slug,
        code,
        name: dto.name,
        nameEn: dto.nameEn ?? null,
        shortName: dto.shortName ?? dto.key.toUpperCase().slice(0, 20),
        issn: dto.issn ?? null,
        color: dto.color,
        status: dto.status,
        sortOrder: Number(next),
        // a new journal prints with the standard class until its own is available
        latexCls: 'structpaper-std.cls',
      })
      .returning();

    const codes = dto.articleTypes ?? ['research', 'review'];
    const types = await db
      .insert(articleTypes)
      .values(
        codes.map((c, i) => ({
          journalId: row.id,
          code: c,
          labels: ARTICLE_TYPE_LABELS[c] ?? ARTICLE_TYPE_DEFINITIONS[c]?.label ?? { vi: c, en: c },
          sortOrder: (i + 1) * 10,
        })),
      )
      .returning();

    await this.profiles.ensureJournalBaseline(row, userId);
    for (const type of types) await this.profiles.ensureArticleTypeBaseline(type, userId);
    await this.audit(db, userId, 'journal.create', row.id, { key: dto.key });
    return this.reads.mapToDto(row, types.map((t) => t.code));
  }

  async update(
    idOrSlug: string,
    dto: UpdateJournal,
    ifMatch: string | undefined,
    ability: AppAbility,
    userId?: string,
  ): Promise<JournalDto> {
    const db = this.requireDb();
    const row = await this.reads.findRow(idOrSlug);
    if (!row) throw new NotFoundException(`Journal '${idOrSlug}' not found`);
    if (!ability.can('update', subject('Journal', row as any))) throw new ForbiddenException('You may not edit this journal');

    const current = row.version || 1;
    if (ifMatch !== undefined) {
      const wanted = ifMatch.replace(/^W\//, '').replace(/^"|"$/g, '').trim();
      if (wanted !== String(current)) {
        throw new PreconditionFailedException({
          title: 'Xung đột phiên bản máy chủ',
          detail: `Tạp chí đã được người khác sửa (phiên bản ${current}, bạn đang giữ ${wanted}). Hãy tải lại.`,
        });
      }
    }

    if (dto.code !== undefined && dto.code !== row.code) {
      const [sameCode] = await db.select({ id: journals.id }).from(journals).where(eq(journals.code, dto.code)).limit(1);
      if (sameCode) throw new ConflictException(`A journal with the code '${dto.code}' already exists`);
    }

    const updated = await db
      .update(journals)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.nameEn !== undefined && { nameEn: dto.nameEn }),
        ...(dto.code !== undefined && { code: dto.code }),
        ...(dto.shortName !== undefined && { shortName: dto.shortName }),
        ...(dto.issn !== undefined && { issn: dto.issn }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
        version: current + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(journals.id, row.id), eq(journals.version, current)))
      .returning();

    if (updated.length === 0) {
      throw new PreconditionFailedException({
        title: 'Xung đột phiên bản máy chủ',
        detail: 'Một phiên làm việc khác vừa lưu tạp chí này. Hãy tải lại.',
      });
    }
    await this.audit(db, userId, 'journal.update', row.id, { fields: Object.keys(dto) });
    return this.reads.getJournalById(updated[0].id);
  }

  private requireDb(): DbClient {
    if (!this.db) throw new ServiceUnavailableException('The journal catalogue cannot be edited without a database');
    return this.db;
  }

  private async audit(db: DbClient, userId: string | undefined, action: string, resourceId: string, payload: Record<string, unknown>) {
    try {
      await db.insert(auditLogs).values({ userId: userId ?? null, action, resourceType: 'journal', resourceId, payload });
    } catch {
      // the audit trail must never block the change it describes
    }
  }
}
