import { Injectable, Inject, Optional, Logger, NotFoundException, ForbiddenException, ConflictException, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { manuscripts, journals, users, auditLogs, eq, and, or, isNotNull, isNull, lt, inArray, desc, ilike, sql } from '@structpaper/db';
import type { TrashQuery, TrashListDto, TrashedManuscriptDto, TrashPreviewDto } from '@structpaper/contracts';
import { subject, type AppAbility } from '../../access/domain/ability.factory';
import { journalSummary } from '../domain/journal-summary';

const DAY = 24 * 3600_000;

/** Days a deleted paper stays in the trash (TRASH_RETENTION_DAYS, default 30). */
export const trashRetentionDays = (env: NodeJS.ProcessEnv = process.env): number => {
  const n = Number(env.TRASH_RETENTION_DAYS);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 30;
};

/** Whole days left (never negative) before a paper deleted at `deletedAt` is purged. */
export const daysLeftInTrash = (deletedAt: Date | string, now: Date = new Date(), retentionDays = trashRetentionDays()): number => {
  const purgeAt = new Date(deletedAt).getTime() + retentionDays * DAY;
  return Math.max(0, Math.ceil((purgeAt - now.getTime()) / DAY));
};

/** Journal managers (of some or every journal) and SuperAdmin: the people who manage other people's papers. */
export const isTrashManager = (ability: AppAbility): boolean => ability.can('manage', 'all') || ability.can('manage', 'Manuscript');

/** Brings back what the user deleted, and (for a manager) any paper of a journal they manage. */
export const mayRestore = (ability: AppAbility, row: { deletedBy?: string | null }, userId?: string): boolean =>
  (!!userId && row.deletedBy === userId) || ability.can('manage', subject('Manuscript', row));

/** Deleting for good: whoever deleted the paper, or a manager of its journal. */
export const mayPurge = (ability: AppAbility, row: { deletedBy?: string | null }, userId?: string): boolean =>
  (!!userId && row.deletedBy === userId) || ability.can('manage', subject('Manuscript', row));

/**
 * The trash of deleted manuscripts. Deleting a paper only sets `deleted_at` (see ManuscriptService.deleteManuscript): the
 * paper keeps its history, members and sharing, and is invisible everywhere else.
 *
 * Everybody has a trash. Whoever deleted a paper sees it here and can bring it back. Journal managers (and SuperAdmin) also see and
 * restore the papers of their journals that others deleted, and are the only ones who can delete a paper for good. Whatever is still
 * here after the retention period is purged by itself.
 */
@Injectable()
export class TrashService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(TrashService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(@Optional() @Inject('DRIZZLE') private readonly db?: any) {}

  onModuleInit() {
    if (!this.db) return;
    // purge what is past retention now and then; the timer must not keep the process alive
    void this.purgeExpired();
    this.timer = setInterval(() => void this.purgeExpired(), 6 * 3600_000);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async list(query: TrashQuery, ability?: AppAbility, userId?: string): Promise<TrashListDto> {
    const retentionDays = trashRetentionDays();
    if (!this.db) return { items: [], retentionDays };

    const conds = [isNotNull(manuscripts.deletedAt)];
    // somebody who cannot manage papers only ever sees what they deleted themselves: do not even read the rest
    if (ability && !isTrashManager(ability)) {
      if (!userId) return { items: [], retentionDays };
      conds.push(eq(manuscripts.deletedBy, userId));
    }
    if (query.search) {
      const escaped = query.search.replace(/[%_\\]/g, (c) => `\\${c}`);
      conds.push(ilike(manuscripts.title, `%${escaped}%`));
    }
    const rows: any[] = await this.db
      .select({ manuscript: manuscripts, journal: journals })
      .from(manuscripts)
      .leftJoin(journals, eq(manuscripts.journalId, journals.id))
      .where(and(...conds))
      .orderBy(desc(manuscripts.deletedAt))
      .limit(500);

    // what the user deleted, plus (for a journal manager) every paper of the journals they manage; SuperAdmin sees all
    const visible = rows.filter((r) => !ability || mayRestore(ability, r.manuscript, userId)).slice(0, query.limit);
    const userIds = [...new Set(visible.flatMap((r) => [r.manuscript.createdBy, r.manuscript.deletedBy]).filter(Boolean))] as string[];
    const names = await this.names(userIds);
    const now = new Date();

    const items = visible.map((r) => this.toDto(r.manuscript, r.journal, names, now, retentionDays, ability, userId));
    return { items, retentionDays };
  }

  /**
   * One paper in the trash with its content, to read it before deciding. Read-only: same people as restore (whoever deleted it,
   * or a manager of its journal). The content is in the stored shape; the web reads it with docFromStored.
   */
  async preview(id: string, ability?: AppAbility, userId?: string): Promise<TrashPreviewDto> {
    const [found] = this.db
      ? await this.db.select({ manuscript: manuscripts, journal: journals }).from(manuscripts).leftJoin(journals, eq(manuscripts.journalId, journals.id)).where(eq(manuscripts.id, id)).limit(1)
      : [];
    if (!found) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    const m = found.manuscript;
    if (!m.deletedAt) throw new ConflictException('This manuscript is not in the trash');
    if (ability && !mayRestore(ability, m, userId)) throw new ForbiddenException('You may only view manuscripts you deleted yourself');
    const names = await this.names([m.createdBy, m.deletedBy].filter(Boolean) as string[]);
    const dto = this.toDto(m, found.journal, names, new Date(), trashRetentionDays(), ability, userId);
    return { ...dto, metadata: (m.metadata ?? {}) as Record<string, unknown> };
  }

  /** Brings a paper back: it is in its owner's list again, with everything it had. */
  async restore(id: string, ability?: AppAbility, userId?: string): Promise<{ id: string; title: string }> {
    const row = await this.findTrashed(id);
    // the one who deleted it, or a manager of its journal
    if (ability && !mayRestore(ability, row, userId)) {
      throw new ForbiddenException('You may only restore manuscripts you deleted yourself');
    }
    await this.db.update(manuscripts).set({ deletedAt: null, deletedBy: null, updatedAt: new Date() }).where(eq(manuscripts.id, id));
    await this.audit(userId, 'manuscript.restore', id, { title: row.title });
    return { id, title: row.title };
  }

  /** Deletes a paper in the trash for good (with its history, members and sharing). Cannot be undone. */
  async purge(id: string, ability?: AppAbility, userId?: string): Promise<{ success: boolean }> {
    const row = await this.findTrashed(id);
    // whoever deleted it, or a manager of its journal
    if (ability && !mayPurge(ability, row, userId)) {
      throw new ForbiddenException('You may only delete manuscripts you deleted yourself for good');
    }
    await this.db.delete(manuscripts).where(and(eq(manuscripts.id, id), isNotNull(manuscripts.deletedAt)));
    await this.audit(userId, 'manuscript.purge', id, { title: row.title });
    return { success: true };
  }

  /**
   * Restores or deletes for good many papers at once: the ones in `ids`, or (without ids) everything the caller can see in the
   * trash. Papers the caller may not act on are skipped, not an error. "Empty the trash" is purge without ids.
   */
  async bulk(action: 'restore' | 'purge', ids: string[] | undefined, ability?: AppAbility, userId?: string): Promise<{ done: number; skipped: number }> {
    if (!this.db) return { done: 0, skipped: 0 };
    const conds = [isNotNull(manuscripts.deletedAt)];
    if (ids) {
      if (ids.length === 0) return { done: 0, skipped: 0 };
      conds.push(inArray(manuscripts.id, ids));
    }
    if (ability && !isTrashManager(ability)) {
      if (!userId) return { done: 0, skipped: ids?.length ?? 0 };
      conds.push(eq(manuscripts.deletedBy, userId));
    }
    const rows: any[] = await this.db.select().from(manuscripts).where(and(...conds));
    const allowed = rows.filter((r) => !ability || (action === 'restore' ? mayRestore(ability, r, userId) : mayPurge(ability, r, userId)));
    const allowedIds = allowed.map((r) => r.id);
    if (allowedIds.length > 0) {
      if (action === 'restore') {
        await this.db.update(manuscripts).set({ deletedAt: null, deletedBy: null, updatedAt: new Date() }).where(and(inArray(manuscripts.id, allowedIds), isNotNull(manuscripts.deletedAt)));
      } else {
        await this.db.delete(manuscripts).where(and(inArray(manuscripts.id, allowedIds), isNotNull(manuscripts.deletedAt)));
      }
      for (const r of allowed) await this.audit(userId, action === 'restore' ? 'manuscript.restore' : 'manuscript.purge', r.id, { title: r.title, bulk: true });
    }
    return { done: allowed.length, skipped: (ids ? ids.length : rows.length) - allowed.length };
  }

  /** Removes for good what has been in the trash longer than the retention period. Returns how many. */
  async purgeExpired(now: Date = new Date()): Promise<number> {
    if (!this.db) return 0;
    try {
      const cutoff = new Date(now.getTime() - trashRetentionDays() * DAY);
      const gone: any[] = await this.db.delete(manuscripts).where(and(isNotNull(manuscripts.deletedAt), lt(manuscripts.deletedAt, cutoff))).returning({ id: manuscripts.id, title: manuscripts.title });
      for (const m of gone ?? []) await this.audit(undefined, 'manuscript.purge_expired', m.id, { title: m.title });
      if (gone?.length) this.log.log(`Purged ${gone.length} manuscript(s) past the trash retention.`);
      return gone?.length ?? 0;
    } catch (err) {
      this.log.warn(`Could not purge the trash: ${(err as Error).message}`);
      return 0;
    }
  }

  // ----------------------------------------------------------------------------------------------

  private toDto(m: any, journal: any, names: Map<string, string>, now: Date, retentionDays: number, ability?: AppAbility, userId?: string): TrashedManuscriptDto {
    const j = journalSummary(journal);
    const purgeAt = new Date(new Date(m.deletedAt).getTime() + retentionDays * DAY);
    return {
      id: m.id,
      title: m.title,
      status: m.status,
      journal: j ? { id: j.id, slug: j.slug, code: j.code, name: j.name, color: j.color, shortName: j.shortName } : null,
      owner: m.createdBy ? { id: m.createdBy, displayName: names.get(m.createdBy) ?? '' } : null,
      deletedAt: new Date(m.deletedAt).toISOString(),
      deletedBy: m.deletedBy ? { id: m.deletedBy, displayName: names.get(m.deletedBy) ?? '' } : null,
      purgeAt: purgeAt.toISOString(),
      daysLeft: daysLeftInTrash(m.deletedAt, now, retentionDays),
      access: { canRestore: true, canPurge: !ability || mayPurge(ability, m, userId) },
    };
  }

  private async findTrashed(id: string) {
    if (!this.db) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    const [row] = await this.db.select().from(manuscripts).where(eq(manuscripts.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    if (!row.deletedAt) throw new ConflictException('This manuscript is not in the trash');
    return row;
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const found = await this.db.select({ id: users.id, displayName: users.displayName, email: users.email }).from(users).where(or(...ids.map((i) => eq(users.id, i))));
    return new Map(found.map((u: any) => [u.id, String(u.displayName ?? '').trim() || String(u.email ?? '').split('@')[0] || '']));
  }

  private async audit(userId: string | undefined, action: string, resourceId: string, payload: Record<string, unknown>) {
    try {
      await this.db.insert(auditLogs).values({ userId: userId ?? null, action, resourceType: 'manuscript', resourceId, payload });
    } catch {
      // the audit trail must never block the change it describes
    }
  }
}
