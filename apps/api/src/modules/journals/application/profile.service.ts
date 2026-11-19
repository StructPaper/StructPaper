import {
  Injectable,
  Inject,
  Optional,
  Logger,
  OnModuleInit,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { subject } from '@casl/ability';
import {
  profileVersions,
  articleTypes,
  journals,
  auditLogs,
  eq,
  and,
  desc,
  isNull,
  inArray,
  sql,
  type DbClient,
  type Journal,
  type ArticleType,
  type ProfileVersion,
} from '@structpaper/db';
import type {
  CreateProfileDraft,
  UpdateProfileDraft,
  PublishProfile,
  RollbackProfile,
  ProfileScopeValue,
  ProfileVersionDto,
  ProfileValidationDto,
} from '@structpaper/contracts';
import type { AppAbility } from '../../access/domain/ability.factory';
import { JournalService } from './journal.service';
import {
  builtInArticleTier,
  builtInBase,
  builtInTier,
  journalKey,
  validateTier,
  withIdentity,
  type ValidationContext,
} from '../domain/profile-tiers';

const SCHEMA_VERSION = 1;

/** What a profile version belongs to: the base, a journal, or one article type of a journal. */
export type ProfileTarget =
  | { scope: 'base' }
  | { scope: 'journal'; journal: Journal }
  | { scope: 'article_type'; journal: Journal; type: ArticleType };

/**
 * The life of a profile version: draft -> validated -> published -> archived. A published version is
 * history that papers are pinned to, so it is never edited (the database refuses it too); a rollback
 * publishes a copy of an earlier version as a new one.
 */
@Injectable()
export class ProfileService implements OnModuleInit {
  private readonly log = new Logger(ProfileService.name);

  constructor(
    @Inject(JournalService) private readonly journals_: JournalService,
    @Optional() @Inject('DRIZZLE') private readonly db?: DbClient,
  ) {}

  /** First start on a database without profile versions: publish version 1 from the rules the code ships with. */
  async onModuleInit(): Promise<void> {
    if (!this.db) return;
    try {
      await this.ensureBaseBaseline();
      for (const journal of await this.db.select().from(journals)) await this.ensureJournalBaseline(journal);
      for (const type of await this.db.select().from(articleTypes)) await this.ensureArticleTypeBaseline(type);
    } catch (err) {
      this.log.warn(`Could not seed the profile baseline: ${(err as Error).message}`);
    }
  }

  async ensureBaseBaseline(): Promise<void> {
    const db = this.requireDb();
    const [existing] = await db.select({ id: profileVersions.id }).from(profileVersions).where(eq(profileVersions.scopeType, 'base')).limit(1);
    if (existing) return;
    await db.insert(profileVersions).values({
      scopeType: 'base', version: 1, state: 'published', config: builtInBase(),
      schemaVersion: SCHEMA_VERSION, changeNote: 'Initial rules', publishedAt: new Date(),
    });
  }

  /** A journal always has a published version 1, so it resolves from the moment it exists. */
  async ensureJournalBaseline(journal: Journal, userId?: string): Promise<void> {
    const db = this.requireDb();
    const [existing] = await db.select({ id: profileVersions.id }).from(profileVersions).where(eq(profileVersions.journalId, journal.id)).limit(1);
    if (existing) return;
    await db.insert(profileVersions).values({
      scopeType: 'journal', journalId: journal.id, version: 1, state: 'published',
      config: builtInTier(journalKey(journal), journal), schemaVersion: SCHEMA_VERSION,
      changeNote: 'Initial rules', createdBy: userId ?? null, publishedAt: new Date(),
    });
  }

  /** Likewise for an article type of a journal. */
  async ensureArticleTypeBaseline(type: ArticleType, userId?: string): Promise<void> {
    const db = this.requireDb();
    const [existing] = await db.select({ id: profileVersions.id }).from(profileVersions).where(eq(profileVersions.articleTypeId, type.id)).limit(1);
    if (existing) return;
    await db.insert(profileVersions).values({
      scopeType: 'article_type', articleTypeId: type.id, version: 1, state: 'published',
      config: builtInArticleTier(type.code, type.labels), schemaVersion: SCHEMA_VERSION,
      changeNote: 'Initial rules', createdBy: userId ?? null, publishedAt: new Date(),
    });
  }

  async listVersions(scope: ProfileScopeValue, id: string): Promise<ProfileVersionDto[]> {
    const target = await this.target(scope, id);
    const rows = await this.requireDb().select().from(profileVersions).where(this.where(target)).orderBy(desc(profileVersions.version));
    return rows.map(toDto);
  }

  async createDraft(scope: ProfileScopeValue, id: string, dto: CreateProfileDraft, ability: AppAbility, userId?: string): Promise<ProfileVersionDto> {
    const target = await this.target(scope, id);
    this.assertMayWrite(target, ability);
    const created = await this.requireDb().transaction(async (tx) => {
      // the next number is taken inside the insert, so two drafts made at once never collide on it
      const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${profileVersions.version}), 0) + 1` })
        .from(profileVersions).where(this.where(target));
      const [row] = await tx.insert(profileVersions).values({
        ...this.owner(target), version: Number(next), state: 'draft',
        config: dto.config, schemaVersion: SCHEMA_VERSION, changeNote: dto.changeNote ?? null, createdBy: userId ?? null,
      }).returning();
      return row;
    });
    return toDto(created);
  }

  async updateDraft(scope: ProfileScopeValue, id: string, version: number, dto: UpdateProfileDraft, ability: AppAbility): Promise<ProfileVersionDto> {
    const target = await this.target(scope, id);
    this.assertMayWrite(target, ability);
    const row = await this.getVersionRow(target, version);
    if (row.state !== 'draft' && row.state !== 'validated') {
      throw new ConflictException(`Version ${version} is ${row.state} and can no longer be edited; make a new draft`);
    }
    const [updated] = await this.requireDb().update(profileVersions).set({
      ...(dto.config !== undefined && { config: dto.config, state: 'draft' as const }), // new rules must be validated again
      ...(dto.changeNote !== undefined && { changeNote: dto.changeNote }),
    }).where(eq(profileVersions.id, row.id)).returning();
    return toDto(updated);
  }

  async validate(scope: ProfileScopeValue, id: string, version: number, ability: AppAbility): Promise<ProfileValidationDto> {
    const target = await this.target(scope, id);
    this.assertMayWrite(target, ability);
    const row = await this.getVersionRow(target, version);
    if (row.state !== 'draft' && row.state !== 'validated') {
      throw new ConflictException(`Version ${version} is ${row.state}: only drafts are validated`);
    }
    const issues = validateTier(scope, row.config, await this.validationContext(target));
    const ok = issues.length === 0;
    const [updated] = ok
      ? await this.requireDb().update(profileVersions).set({ state: 'validated' }).where(eq(profileVersions.id, row.id)).returning()
      : [row];
    return { ok, issues, version: toDto(updated) };
  }

  async publish(scope: ProfileScopeValue, id: string, version: number, dto: PublishProfile, ability: AppAbility, userId?: string): Promise<ProfileVersionDto> {
    const target = await this.target(scope, id);
    this.assertMayWrite(target, ability);
    const row = await this.getVersionRow(target, version);
    if (row.state !== 'validated') {
      throw new ConflictException(`Version ${version} is ${row.state}: validate the draft before publishing it`);
    }
    return this.publishRow(target, row, dto.changeNote, userId, 'profile.publish');
  }

  /** Publishes a copy of an earlier version as a brand-new version: history is never rewritten. */
  async rollback(scope: ProfileScopeValue, id: string, dto: RollbackProfile, ability: AppAbility, userId?: string): Promise<ProfileVersionDto> {
    const target = await this.target(scope, id);
    this.assertMayWrite(target, ability);
    const old = await this.getVersionRow(target, dto.toVersion);
    if (old.state === 'draft' || old.state === 'validated') {
      throw new BadRequestException(`Version ${dto.toVersion} was never published, so it cannot be rolled back to`);
    }
    const copy = await this.requireDb().transaction(async (tx) => {
      const [{ next }] = await tx.select({ next: sql<number>`coalesce(max(${profileVersions.version}), 0) + 1` })
        .from(profileVersions).where(this.where(target));
      const [row] = await tx.insert(profileVersions).values({
        ...this.owner(target), version: Number(next), state: 'validated',
        config: old.config, schemaVersion: old.schemaVersion,
        changeNote: dto.changeNote ?? `Rollback to version ${dto.toVersion}`, createdBy: userId ?? null,
      }).returning();
      return row;
    });
    return this.publishRow(target, copy, copy.changeNote ?? undefined, userId, 'profile.rollback');
  }

  /** The config of the currently published base version (the code's base when the database has none). */
  async publishedBaseConfig(): Promise<Record<string, any>> {
    if (!this.db) return builtInBase();
    const [row] = await this.db.select().from(profileVersions)
      .where(and(eq(profileVersions.scopeType, 'base'), eq(profileVersions.state, 'published'))).limit(1);
    return row?.config ?? builtInBase();
  }

  /** The published rules of a journal as stored (without identity); the code's own when none is published. */
  async publishedJournalConfig(journal: Journal): Promise<Record<string, any>> {
    if (!this.db) return builtInTier(journalKey(journal), journal);
    const [row] = await this.db.select().from(profileVersions)
      .where(and(eq(profileVersions.journalId, journal.id), eq(profileVersions.state, 'published'))).limit(1);
    return row?.config ?? builtInTier(journalKey(journal), journal);
  }

  /** article type id -> its published rules. */
  async publishedTypeConfigs(typeIds: string[]): Promise<Map<string, Record<string, any>>> {
    const out = new Map<string, Record<string, any>>();
    if (!this.db || typeIds.length === 0) return out;
    const rows = await this.db.select().from(profileVersions)
      .where(and(inArray(profileVersions.articleTypeId, typeIds), eq(profileVersions.state, 'published')));
    for (const r of rows) if (r.articleTypeId) out.set(r.articleTypeId, r.config);
    return out;
  }

  private async validationContext(target: ProfileTarget): Promise<ValidationContext> {
    const base = await this.publishedBaseConfig();
    if (target.scope === 'base') return { base };
    if (target.scope === 'journal') return { base, journal: target.journal };
    const journalTier = withIdentity(await this.publishedJournalConfig(target.journal), target.journal);
    return { base, journal: target.journal, journalTier, type: target.type };
  }

  private async publishRow(target: ProfileTarget, row: ProfileVersion, note: string | undefined, userId: string | undefined, action: string) {
    const published = await this.requireDb().transaction(async (tx) => {
      // 1 published version per scope: the current one steps down first
      await tx.update(profileVersions).set({ state: 'archived' })
        .where(and(this.where(target), eq(profileVersions.state, 'published')));
      const [updated] = await tx.update(profileVersions).set({
        state: 'published', publishedAt: new Date(), ...(note !== undefined && { changeNote: note }),
      }).where(eq(profileVersions.id, row.id)).returning();
      await tx.insert(auditLogs).values({
        userId: userId ?? null, action, resourceType: 'profile', resourceId: updated.id,
        payload: { scope: target.scope, ...this.describe(target), version: updated.version },
      });
      return updated;
    });
    return toDto(published);
  }

  /**
   * Resolves what a request names: "base" (the id is ignored), a journal ("hs"), or an article type of a
   * journal ("hs:research").
   */
  async target(scope: ProfileScopeValue, id: string): Promise<ProfileTarget> {
    const db = this.requireDb();
    if (scope === 'base') return { scope: 'base' };
    const [journalRef, typeCode] = scope === 'article_type' ? id.split(':') : [id, undefined];
    const journal = await this.journals_.findRow(journalRef);
    if (!journal) throw new NotFoundException(`Journal '${journalRef}' not found`);
    if (scope === 'journal') return { scope: 'journal', journal };
    if (!typeCode) throw new BadRequestException("An article type is addressed as '<journal>:<code>', e.g. 'hs:research'");
    const [type] = await db.select().from(articleTypes)
      .where(and(eq(articleTypes.journalId, journal.id), eq(articleTypes.code, typeCode.toLowerCase()))).limit(1);
    if (!type) throw new NotFoundException(`Journal '${journalRef}' has no article type '${typeCode}'`);
    return { scope: 'article_type', journal, type };
  }

  private assertMayWrite(target: ProfileTarget, ability: AppAbility): void {
    const allowed = target.scope === 'base'
      ? ability.can('create', 'Journal')
      : ability.can('update', subject('Journal', target.journal as any));
    if (!allowed) throw new ForbiddenException('You may not change these profile rules');
  }

  private describe(target: ProfileTarget): Record<string, string | null> {
    if (target.scope === 'base') return {};
    return target.scope === 'journal'
      ? { journal: target.journal.slug }
      : { journal: target.journal.slug, articleType: target.type.code };
  }

  /** The columns that say which scope a row belongs to. */
  private owner(target: ProfileTarget) {
    return {
      scopeType: target.scope,
      journalId: target.scope === 'journal' ? target.journal.id : null,
      articleTypeId: target.scope === 'article_type' ? target.type.id : null,
    };
  }

  private where(target: ProfileTarget) {
    if (target.scope === 'base') return and(eq(profileVersions.scopeType, 'base'), isNull(profileVersions.journalId));
    if (target.scope === 'journal') return and(eq(profileVersions.scopeType, 'journal'), eq(profileVersions.journalId, target.journal.id));
    return and(eq(profileVersions.scopeType, 'article_type'), eq(profileVersions.articleTypeId, target.type.id));
  }

  private async getVersionRow(target: ProfileTarget, version: number): Promise<ProfileVersion> {
    const [row] = await this.requireDb().select().from(profileVersions)
      .where(and(this.where(target), eq(profileVersions.version, version))).limit(1);
    if (!row) throw new NotFoundException(`Profile version ${version} not found`);
    return row;
  }

  private requireDb(): DbClient {
    if (!this.db) throw new ServiceUnavailableException('Profile versions need a database');
    return this.db;
  }
}

export function toDto(row: ProfileVersion): ProfileVersionDto {
  return {
    id: row.id,
    scope: row.scopeType,
    journalId: row.journalId,
    version: row.version,
    state: row.state,
    config: row.config,
    schemaVersion: row.schemaVersion,
    changeNote: row.changeNote,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
  };
}
