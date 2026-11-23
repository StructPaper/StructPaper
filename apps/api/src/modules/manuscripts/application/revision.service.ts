import { Injectable, Inject, Optional, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { manuscripts, manuscriptRevisions, users, eq, and, desc, lt, ne, inArray, isNull, sql } from '@structpaper/db';
import { diffDocs, contentFingerprintSource, docFromStored, storedFromDoc, EMPTY_STATS, type DocLike } from '@structpaper/doc-diff';
import type {
  CreateRevision,
  UpdateRevision,
  ListRevisionsQuery,
  RevisionDto,
  RevisionSummaryDto,
  RevisionListDto,
  RevisionKindValue,
  RevisionStatsDto,
} from '@structpaper/contracts';
import { subject, type AppAbility } from '../../access/domain/ability.factory';

/** The numbers behind the history; tuned in one place (the design doc calls this HistoryConfig). */
export const HISTORY_CONFIG = {
  /** Nobody saved for this long, and the text changed since the last revision: the finished burst becomes a revision. */
  idleRevisionMs: 5 * 60_000,
  /** Editing without a pause this long: take a revision anyway. */
  activeRevisionMs: 30 * 60_000,
  /** Named versions per paper. */
  namedLimit: 100,
  /** Beyond this many versions that are not pinned, the oldest are dropped first. */
  budgetRevisions: 300,
  /** Safety copies and upgrade copies are kept this long (the latest few are always kept). */
  safetyRetentionMs: 90 * 24 * 3600_000,
  safetyKeepLatest: 5,
} as const;

const DAY = 24 * 3600_000;

/** What a revision of each kind is called when nobody named it. */
const DEFAULT_LABEL: Record<string, string> = {
  auto: 'Phiên bản tự động',
  'pre-risk': 'Trước thao tác rủi ro',
  'profile-upgrade': 'Trước khi nâng cấp quy tắc',
  restore: 'Khôi phục',
  import: 'Nhập từ tệp',
};

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: 'Gửi duyệt',
  IN_REVIEW: 'Đang phản biện',
  PROOFING: 'Biên tập và dàn trang',
  READY: 'Sẵn sàng xuất bản',
  ACCEPTED: 'Được chấp nhận',
  REJECTED: 'Bị từ chối',
  PUBLISHED: 'Đã xuất bản',
};

const fingerprint = (doc: DocLike | null | undefined) => crypto.createHash('sha256').update(contentFingerprintSource(doc)).digest('hex');
/** The paper a manuscript row holds, whichever shape it is stored in (wrapped in `doc`, or flat). */
const docOf = (m: { metadata?: any }): DocLike | undefined => (m.metadata && typeof m.metadata === 'object' ? docFromStored(m.metadata) : undefined);
const hasContent = (doc?: DocLike) => !!doc && (((doc.sections?.length ?? 0) > 0) || !!doc.metadata?.title);

/**
 * The history of a paper's content: revisions the system takes at the right moments (a finished editing burst, before a
 * risky step, when the workflow moves on), the ones an author names, and what it takes to look at, restore and tidy them.
 *
 * A revision is a whole copy of the paper (the database compresses it); what changed is worked out when it is written
 * and kept as numbers for the list. Nothing here ever rewrites a revision, and restoring adds one instead of replacing.
 */
@Injectable()
export class RevisionService {
  private readonly log = new Logger(RevisionService.name);

  constructor(@Optional() @Inject('DRIZZLE') private readonly db?: any) {}

  // ---------------------------------------------------------------- taking revisions (called by the paper service)

  /**
   * Called before a save is written, with the paper as it is now and the content about to replace it. Takes revisions
   * of the *old* content when the save ends a burst of editing (nobody saved for a while, or it has gone on for long),
   * and a safety copy before the paper moves to another journal. Never throws: a failure here must not lose a save.
   */
  async beforeSave(
    manuscript: any,
    next: { doc?: DocLike; status?: string },
    userId?: string,
    now: Date = new Date(),
  ): Promise<void> {
    if (!this.db) return;
    try {
      const prev = docOf(manuscript);
      const prevHas = hasContent(prev);
      const nextDoc = next.doc;

      if (nextDoc && prevHas) {
        const changed = fingerprint(prev) !== fingerprint(nextDoc);
        const latest = await this.latest(manuscript.id);
        const prevFp = fingerprint(prev);

        if (changed) {
          const journalChanged = (prev!.metadata?.journalId ?? null) !== (nextDoc.metadata?.journalId ?? null);
          if (journalChanged) {
            // another journal means other rules: keep the paper as it was, whatever else is in the history
            await this.snapshotDoc(manuscript, prev!, 'pre-risk', 'Trước khi đổi tạp chí', userId, now);
          } else if (!latest) {
            // the first time anything is saved after history began: keep what was there
            await this.insert(manuscript, prev!, 'auto', { label: 'Phiên bản đầu', userId, now, latest });
          } else if (latest.checksum !== prevFp) {
            const idleFor = now.getTime() - new Date(manuscript.updatedAt ?? now).getTime();
            const sinceLast = now.getTime() - new Date(latest.createdAt).getTime();
            if (idleFor >= HISTORY_CONFIG.idleRevisionMs || sinceLast >= HISTORY_CONFIG.activeRevisionMs) {
              await this.insert(manuscript, prev!, 'auto', { userId, now, latest });
            }
          }
        }
      }

      // the workflow moved on: a named version of the paper as it goes (kept for good)
      if (next.status && next.status !== manuscript.status && STATUS_LABEL[next.status]) {
        const doc = nextDoc ?? prev;
        if (hasContent(doc)) {
          await this.insert(manuscript, doc!, 'named', {
            label: `${STATUS_LABEL[next.status]}`,
            description: 'Tự tạo khi bài chuyển trạng thái.',
            pinned: true,
            userId,
            now,
            force: true,
          });
        }
      }
    } catch (err) {
      this.log.warn(`Could not take a revision for ${manuscript?.id}: ${(err as Error).message}`);
    }
  }

  /**
   * The safety copy before a step that cannot easily be undone (another article type, newer rules, a restore...).
   * If the newest revision already holds this very content it is relabelled instead of duplicated.
   */
  async snapshotCurrent(manuscript: any, kind: 'pre-risk' | 'profile-upgrade', label: string, userId?: string): Promise<void> {
    if (!this.db) return;
    try {
      const doc = docOf(manuscript);
      if (!hasContent(doc)) return;
      await this.snapshotDoc(manuscript, doc!, kind, label, userId, new Date());
    } catch (err) {
      this.log.warn(`Could not take a safety copy for ${manuscript?.id}: ${(err as Error).message}`);
    }
  }

  private async snapshotDoc(manuscript: any, doc: DocLike, kind: RevisionKindValue, label: string, userId: string | undefined, now: Date) {
    const latest = await this.latest(manuscript.id);
    if (latest && latest.checksum === fingerprint(doc)) {
      // same text as the newest revision: promote an automatic one to a safety copy, leave anything else alone
      if (latest.kind === 'auto') {
        await this.db.update(manuscriptRevisions).set({ kind, tagName: label }).where(eq(manuscriptRevisions.id, latest.id));
      }
      return;
    }
    await this.insert(manuscript, doc, kind, { label, userId, now, latest });
  }

  // ---------------------------------------------------------------- the author's side

  async createNamed(manuscriptId: string, dto: CreateRevision, userId: string, ability?: AppAbility): Promise<RevisionSummaryDto> {
    const manuscript = await this.requireManuscript(manuscriptId, ability, 'update');
    const doc = docOf(manuscript);
    if (!hasContent(doc)) throw new BadRequestException('The paper has nothing to keep yet');

    if (dto.kind === 'named') {
      const [{ n }] = await this.db
        .select({ n: sql<number>`count(*)::int` })
        .from(manuscriptRevisions)
        .where(and(eq(manuscriptRevisions.manuscriptId, manuscriptId), eq(manuscriptRevisions.kind, 'named')));
      if (n >= HISTORY_CONFIG.namedLimit) {
        throw new BadRequestException(`A paper can have at most ${HISTORY_CONFIG.namedLimit} named versions`);
      }
    }
    const row = await this.insert(manuscript, doc!, dto.kind, {
      label: dto.name,
      description: dto.description,
      pinned: dto.kind === 'named',
      userId,
      now: new Date(),
      force: true,
    });
    return this.summary(row, await this.authors([row]));
  }

  async list(manuscriptId: string, query: ListRevisionsQuery, ability?: AppAbility): Promise<RevisionListDto> {
    await this.requireManuscript(manuscriptId, ability, 'read');
    if (!this.db) return { items: [], nextBefore: null };

    const conds = [eq(manuscriptRevisions.manuscriptId, manuscriptId), ne(manuscriptRevisions.kind, 'sync')];
    if (query.kind) conds.push(eq(manuscriptRevisions.kind, query.kind));
    if (query.before) {
      const t = new Date(query.before);
      if (!Number.isNaN(t.getTime())) conds.push(lt(manuscriptRevisions.createdAt, t));
    }
    const rows = await this.db
      .select({
        id: manuscriptRevisions.id,
        manuscriptId: manuscriptRevisions.manuscriptId,
        serverRev: manuscriptRevisions.serverRev,
        tagName: manuscriptRevisions.tagName,
        description: manuscriptRevisions.description,
        kind: manuscriptRevisions.kind,
        stats: manuscriptRevisions.stats,
        pinned: manuscriptRevisions.pinned,
        sizeBytes: manuscriptRevisions.sizeBytes,
        createdBy: manuscriptRevisions.createdBy,
        createdAt: manuscriptRevisions.createdAt,
      })
      .from(manuscriptRevisions)
      .where(and(...conds))
      .orderBy(desc(manuscriptRevisions.createdAt))
      .limit(query.limit + 1);

    const page = rows.slice(0, query.limit);
    const names = await this.authors(page);
    return {
      items: page.map((r: any) => this.summary(r, names)),
      nextBefore: rows.length > query.limit ? new Date(page[page.length - 1].createdAt).toISOString() : null,
    };
  }

  async get(manuscriptId: string, revisionId: string, ability?: AppAbility): Promise<RevisionDto> {
    await this.requireManuscript(manuscriptId, ability, 'read');
    const row = await this.findRevision(manuscriptId, revisionId);
    const names = await this.authors([row]);
    return { ...this.summary(row, names), doc: row.snapshot };
  }

  async update(manuscriptId: string, revisionId: string, dto: UpdateRevision, ability?: AppAbility): Promise<RevisionSummaryDto> {
    await this.requireManuscript(manuscriptId, ability, 'update');
    const row = await this.findRevision(manuscriptId, revisionId);
    if (row.kind === 'sync') throw new NotFoundException('Revision not found');
    const set: Record<string, unknown> = {};
    if (dto.name !== undefined) set.tagName = dto.name;
    if (dto.description !== undefined) set.description = dto.description;
    // naming an automatic version turns it into a named one (and so keeps it for good)
    if (dto.name !== undefined && row.kind === 'auto') {
      set.kind = 'named';
      set.pinned = true;
    }
    const [updated] = await this.db.update(manuscriptRevisions).set(set).where(eq(manuscriptRevisions.id, revisionId)).returning();
    return this.summary(updated, await this.authors([updated]));
  }

  /** Only named versions can be deleted; the system's own copies are tidied by the pruning rules. */
  async remove(manuscriptId: string, revisionId: string, ability?: AppAbility): Promise<{ success: boolean }> {
    await this.requireManuscript(manuscriptId, ability, 'update');
    const row = await this.findRevision(manuscriptId, revisionId);
    if (row.kind !== 'named') throw new BadRequestException('Only a named version can be deleted');
    await this.db.delete(manuscriptRevisions).where(eq(manuscriptRevisions.id, revisionId));
    return { success: true };
  }

  /**
   * Puts the paper back to a revision. History is not rewritten: the present state is kept first (so the restore can
   * itself be undone), then the content becomes the revision's, then a "restore" revision records it.
   */
  async restore(manuscriptId: string, revisionId: string, userId: string, ability?: AppAbility) {
    const manuscript = await this.requireManuscript(manuscriptId, ability, 'update');
    const target = await this.findRevision(manuscriptId, revisionId);
    if (target.kind === 'sync') throw new NotFoundException('Revision not found');
    const targetDoc = target.snapshot as DocLike;
    if (!targetDoc || typeof targetDoc !== 'object') throw new BadRequestException('This revision cannot be restored');

    const label = target.tagName || `${DEFAULT_LABEL[target.kind] ?? 'Phiên bản'} ${new Date(target.createdAt).toLocaleString('vi-VN')}`;
    await this.snapshotCurrent(manuscript, 'pre-risk', 'Trước khi khôi phục', userId);

    const now = new Date();
    const version = (manuscript.version || 1) + 1;
    const meta = storedFromDoc(targetDoc, manuscript.metadata);
    const title = typeof (targetDoc as any).metadata?.title === 'string' && (targetDoc as any).metadata.title ? (targetDoc as any).metadata.title : manuscript.title;
    const [updated] = await this.db
      .update(manuscripts)
      .set({ metadata: meta, title, abstract: (targetDoc as any).metadata?.abstract ?? manuscript.abstract, version, updatedAt: now })
      .where(and(eq(manuscripts.id, manuscriptId), eq(manuscripts.version, manuscript.version || 1)))
      .returning();
    if (!updated) throw new BadRequestException('The paper was saved by someone else while restoring; try again');

    const row = await this.insert({ ...manuscript, metadata: meta, version }, targetDoc, 'restore', {
      label: `Khôi phục từ "${label}"`,
      userId,
      now,
      force: true,
      diffAgainst: docOf(manuscript),
    });
    return { version, restoredAs: this.summary(row, await this.authors([row])) };
  }

  /** The paper as a revision held it, for making a copy from it. */
  async docOfRevision(manuscriptId: string, revisionId: string, ability?: AppAbility): Promise<{ doc: DocLike; label: string }> {
    await this.requireManuscript(manuscriptId, ability, 'read');
    const row = await this.findRevision(manuscriptId, revisionId);
    const label = row.tagName || new Date(row.createdAt).toLocaleString('vi-VN');
    return { doc: row.snapshot as DocLike, label };
  }

  // ---------------------------------------------------------------- writing and tidying

  private async insert(
    manuscript: any,
    doc: DocLike,
    kind: RevisionKindValue,
    opts: {
      label?: string;
      description?: string;
      pinned?: boolean;
      userId?: string;
      now: Date;
      latest?: any;
      /** Write it even when the newest revision has the same content (named versions, restores). */
      force?: boolean;
      /** Compare with this instead of the previous revision (a restore is measured against what it replaced). */
      diffAgainst?: DocLike;
    },
  ) {
    const checksum = fingerprint(doc);
    const latest = opts.latest !== undefined ? opts.latest : await this.latest(manuscript.id);
    if (!opts.force && latest && latest.checksum === checksum) return latest;

    const before = opts.diffAgainst ?? (latest ? (latest.snapshot as DocLike) : undefined);
    const stats: RevisionStatsDto = before ? diffDocs(before, doc).stats : { ...EMPTY_STATS };
    const size = Buffer.byteLength(JSON.stringify(doc));
    const [row] = await this.db
      .insert(manuscriptRevisions)
      .values({
        manuscriptId: manuscript.id,
        serverRev: manuscript.version ?? 1,
        tagName: opts.label ?? null,
        description: opts.description ?? null,
        kind,
        snapshot: doc,
        checksum,
        stats,
        pinned: !!opts.pinned,
        sizeBytes: size,
        createdBy: opts.userId ?? null,
        createdAt: opts.now,
      })
      .returning();
    await this.prune(manuscript.id, opts.now);
    return row;
  }

  /**
   * Keeps the history from growing without end. Pinned (named) versions are never touched. Automatic ones thin out with
   * age: all of the last day, then one a day for a week, one a week for a month, one a month for a year. Safety copies
   * live 90 days (the newest few always stay). A paper keeps at most `budgetRevisions` unpinned versions.
   */
  async prune(manuscriptId: string, now: Date = new Date()): Promise<number> {
    if (!this.db) return 0;
    const rows: any[] = await this.db
      .select({ id: manuscriptRevisions.id, kind: manuscriptRevisions.kind, pinned: manuscriptRevisions.pinned, createdAt: manuscriptRevisions.createdAt })
      .from(manuscriptRevisions)
      .where(and(eq(manuscriptRevisions.manuscriptId, manuscriptId), ne(manuscriptRevisions.kind, 'sync')))
      .orderBy(desc(manuscriptRevisions.createdAt));
    const drop = revisionsToDrop(rows, now);
    if (drop.length === 0) return 0;
    await this.db.delete(manuscriptRevisions).where(inArray(manuscriptRevisions.id, drop));
    return drop.length;
  }

  // ---------------------------------------------------------------- helpers

  private async latest(manuscriptId: string): Promise<any | undefined> {
    const [row] = await this.db
      .select()
      .from(manuscriptRevisions)
      .where(and(eq(manuscriptRevisions.manuscriptId, manuscriptId), ne(manuscriptRevisions.kind, 'sync')))
      .orderBy(desc(manuscriptRevisions.createdAt))
      .limit(1);
    return row;
  }

  private async findRevision(manuscriptId: string, revisionId: string): Promise<any> {
    if (!this.db) throw new NotFoundException('Revision not found');
    const [row] = await this.db
      .select()
      .from(manuscriptRevisions)
      .where(and(eq(manuscriptRevisions.id, revisionId), eq(manuscriptRevisions.manuscriptId, manuscriptId)))
      .limit(1);
    if (!row || row.kind === 'sync') throw new NotFoundException('Revision not found');
    return row;
  }

  private async requireManuscript(id: string, ability: AppAbility | undefined, action: 'read' | 'update'): Promise<any> {
    if (!this.db) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    const [manuscript] = await this.db.select().from(manuscripts).where(and(eq(manuscripts.id, id), isNull(manuscripts.deletedAt))).limit(1);
    if (!manuscript) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    if (ability && !ability.can(action, subject('Manuscript', manuscript))) {
      throw new ForbiddenException(action === 'read' ? 'You may not see the history of this manuscript' : 'You may not change this manuscript');
    }
    return manuscript;
  }

  private async authors(rows: any[]): Promise<Map<string, string>> {
    const ids = [...new Set(rows.map((r) => r.createdBy).filter(Boolean))] as string[];
    if (ids.length === 0 || !this.db) return new Map();
    const found = await this.db.select({ id: users.id, displayName: users.displayName }).from(users).where(inArray(users.id, ids));
    return new Map(found.map((u: any) => [u.id, u.displayName]));
  }

  private summary(r: any, names: Map<string, string>): RevisionSummaryDto {
    return {
      id: r.id,
      manuscriptId: r.manuscriptId,
      kind: r.kind,
      name: r.tagName ?? null,
      description: r.description ?? null,
      pinned: !!r.pinned,
      createdAt: new Date(r.createdAt).toISOString(),
      author: r.createdBy ? { id: r.createdBy, displayName: names.get(r.createdBy) ?? '' } : null,
      stats: { ...EMPTY_STATS, ...(r.stats ?? {}) },
      sizeBytes: r.sizeBytes ?? 0,
    };
  }
}

/**
 * Which revisions the pruning rules remove. `rows` is every revision of one paper, newest first. Pure, so the rules can
 * be tested without a database.
 */
export function revisionsToDrop(rows: { id: string; kind: string; pinned: boolean; createdAt: Date | string }[], now: Date): string[] {
  const drop = new Set<string>();
  const t = (r: { createdAt: Date | string }) => new Date(r.createdAt).getTime();

  // safety and upgrade copies: 90 days, but the newest few stay whatever their age
  const safety = rows.filter((r) => !r.pinned && (r.kind === 'pre-risk' || r.kind === 'profile-upgrade'));
  safety.forEach((r, i) => {
    if (i >= HISTORY_CONFIG.safetyKeepLatest && now.getTime() - t(r) > HISTORY_CONFIG.safetyRetentionMs) drop.add(r.id);
  });

  // automatic (and imported) ones thin out by age: keep the newest of each day / week / month bucket
  const seen = new Set<string>();
  for (const r of rows) {
    if (r.pinned || r.kind === 'pre-risk' || r.kind === 'profile-upgrade' || r.kind === 'named' || r.kind === 'restore') continue;
    const age = now.getTime() - t(r);
    if (age <= DAY) continue;
    const day = Math.floor(t(r) / DAY);
    const bucket = age <= 7 * DAY ? `d${day}` : age <= 30 * DAY ? `w${Math.floor(day / 7)}` : `m${Math.floor(day / 30)}`;
    if (seen.has(bucket)) drop.add(r.id);
    else seen.add(bucket);
  }

  // a paper's budget: the oldest unpinned ones go first
  const keepable = rows.filter((r) => !r.pinned && !drop.has(r.id));
  if (keepable.length > HISTORY_CONFIG.budgetRevisions) {
    for (const r of keepable.slice(HISTORY_CONFIG.budgetRevisions)) drop.add(r.id);
  }
  return [...drop];
}
