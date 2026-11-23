import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ForbiddenException,
  PreconditionFailedException,
  BadRequestException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import {
  manuscripts,
  manuscriptMembers,
  manuscriptVisits,
  manuscriptDocs,
  journals,
  articleTypes,
  manuscriptProfileSnapshots,
  outboxEvents,
  auditLogs,
  eq,
  and,
  or,
  ilike,
  inArray,
  isNull,
  desc,
  asc,
  gt,
  lt,
  sql,
} from '@structpaper/db';
import { NON_DELETABLE_STATUSES } from '@structpaper/contracts';
import type {
  CreateManuscript,
  UpdateManuscript,
  ChangeManuscriptStatus,
  ManuscriptStatus,
  ManuscriptQuery,
  ManuscriptResponse,
} from '@structpaper/contracts';
import { subject, type AppAbility } from '../../access/domain/ability.factory';
import { accessOf } from '../domain/manuscript-access';
import { journalSummary } from '../domain/journal-summary';
import { ProfileResolveService } from '../../journals/application/profile-resolve.service';
import { RevisionService } from './revision.service';
import { docFromStored, storedFromDoc } from '@structpaper/doc-diff';

export interface CursorPayload {
  id: string;
  updatedAt: string | Date;
}

@Injectable()
export class ManuscriptService {
  constructor(
    @Optional()
    @Inject('DRIZZLE')
    private readonly db: any,
    @Optional()
    @Inject(ProfileResolveService)
    private readonly profiles?: ProfileResolveService,
    @Optional()
    @Inject(RevisionService)
    private readonly revisions?: RevisionService,
  ) {}

  /**
   * Creates a new manuscript within an atomic database transaction,
   * automatically assigns the creator as OWNER in manuscript_members,
   * and initializes an empty manuscript_docs doc_tree at server_rev = 0.
   */
  async createManuscript(
    dto: CreateManuscript,
    userId: string,
    userAbility?: AppAbility,
  ): Promise<ManuscriptResponse> {
    if (userAbility && !userAbility.can('create', 'Manuscript')) {
      throw new ForbiddenException('You do not have permission to create manuscripts');
    }

    const manuscriptId = crypto.randomUUID();
    const now = new Date();

    let journalId = dto.journalId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(journalId || '');
    if (journalId && !isUuid && this.db) {
      try {
        const clean = journalId.toLowerCase().replace(/_/g, '-');
        const shortClean = clean.replace(/^vnuhcm-/, '');
        if (this.db.query?.journals?.findFirst) {
          const found = await this.db.query.journals.findFirst({
            where: or(
              eq(journals.slug, clean),
              eq(journals.slug, `vnuhcm-${shortClean}`),
            ),
          });
          if (found?.id) {
            journalId = found.id;
          }
        }
      } catch {
        // Fallback
      }
    }

    if (!journalId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(journalId)) {
      if (this.db?.query?.journals?.findFirst) {
        try {
          const defaultJournal = await this.db.query.journals.findFirst();
          if (defaultJournal?.id) {
            journalId = defaultJournal.id;
          }
        } catch {
          // Fallback gracefully
        }
      }
    }
    if (!journalId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(journalId)) {
      journalId = '00000000-0000-0000-0000-000000000000';
    }

    // the profile versions this paper is written under, and the rules resolved from them
    let pinned: Awaited<ReturnType<ProfileResolveService['pinFor']>> | undefined;
    if (this.db && this.profiles && /^[0-9a-f]{8}-/i.test(journalId)) {
      const [journalRow] = await this.db.select().from(journals).where(eq(journals.id, journalId)).limit(1);
      if (journalRow) pinned = await this.profiles.pinFor(journalRow, dto.articleType, dto.profilePin);
    }

    const manuscriptRecord = {
      id: manuscriptId,
      journalId,
      articleTypeId: pinned?.articleTypeId ?? null,
      profilePin: pinned?.pin ?? {},
      title: dto.title,
      abstract: dto.abstract || null,
      status: 'DRAFT' as const,
      createdBy: userId,
      currentServerRev: 0,
      version: 1,
      metadata: dto.metadata || {},
      createdAt: now,
      updatedAt: now,
    };

    const memberRecord = {
      manuscriptId,
      userId,
      role: 'OWNER',
      createdAt: now,
    };

    const docRecord = {
      manuscriptId,
      docTree: { type: 'doc', content: [] },
      serverRev: 0,
      updatedAt: now,
    };

    const runInserts = async (tx: any) => {
      await tx.insert(manuscripts).values(manuscriptRecord);
      await tx.insert(manuscriptMembers).values(memberRecord);
      await tx.insert(manuscriptDocs).values(docRecord);
      if (pinned) {
        await tx.insert(manuscriptProfileSnapshots).values({
          manuscriptId,
          pin: pinned.pin,
          resolved: pinned.resolved,
          hash: crypto.createHash('sha256').update(JSON.stringify(pinned.resolved)).digest('hex'),
          reason: 'create',
        });
      }
    };

    if (this.db) {
      if (typeof this.db.transaction === 'function') {
        await this.db.transaction(runInserts);
      } else {
        await runInserts(this.db);
      }
    }

    return { ...manuscriptRecord, articleType: pinned?.articleType ?? null };
  }

  /**
   * Moves a paper to the rules now published for its journal and article type. The paper never moves on its
   * own: publishing new rules leaves it as it was until the author asks for this. The pin is the server's, not
   * part of what a client saves, so it leaves the paper's version (its ETag) alone: a save in flight stays valid.
   */
  async upgradeProfile(id: string, userAbility?: AppAbility): Promise<{ upgraded: boolean; profilePin: Record<string, number | undefined>; version: number }> {
    const manuscript = await this.findManuscriptById(id);
    if (!manuscript) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    if (userAbility && !userAbility.can('update', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to change this manuscript');
    }
    if (!this.db || !this.profiles) throw new BadRequestException('Profile upgrade needs the database');

    const [journalRow] = await this.db.select().from(journals).where(eq(journals.id, manuscript.journalId)).limit(1);
    if (!journalRow) throw new NotFoundException('The journal of this manuscript no longer exists');
    const latest = await this.profiles.pinFor(journalRow, manuscript.articleType ?? undefined);
    const current = manuscript.profilePin || {};
    const same = ['base', 'journal', 'articleType'].every((k) => (current as any)[k] === (latest.pin as any)[k]);
    if (same) return { upgraded: false, profilePin: current, version: manuscript.version || 1 };

    await this.revisions?.snapshotCurrent(manuscript, 'profile-upgrade', 'Trước khi nâng cấp quy tắc');
    await this.db.transaction(async (tx: any) => {
      await tx.update(manuscripts).set({ profilePin: latest.pin, updatedAt: new Date() }).where(eq(manuscripts.id, id));
      await tx.insert(manuscriptProfileSnapshots).values({
        manuscriptId: id,
        pin: latest.pin,
        resolved: latest.resolved,
        hash: crypto.createHash('sha256').update(JSON.stringify(latest.resolved)).digest('hex'),
        reason: 'profile_upgrade',
      });
    });
    return { upgraded: true, profilePin: latest.pin, version: manuscript.version || 1 };
  }

  /**
   * Moves a paper to another article type of its journal, or to none. The paper keeps the base and journal rules it is
   * pinned to; the new type brings its own published rules, which is what the author asked for by choosing it.
   */
  async changeArticleType(
    id: string,
    articleTypeCode: string | null,
    userAbility?: AppAbility,
  ): Promise<{ changed: boolean; articleType: string | null; profilePin: Record<string, number | undefined>; version: number }> {
    const manuscript = await this.findManuscriptById(id);
    if (!manuscript) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    if (userAbility && !userAbility.can('update', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to change this manuscript');
    }
    if (!this.db || !this.profiles) throw new BadRequestException('Changing the article type needs the database');

    const [journalRow] = await this.db.select().from(journals).where(eq(journals.id, manuscript.journalId)).limit(1);
    if (!journalRow) throw new NotFoundException('The journal of this manuscript no longer exists');

    let typeId: string | null = null;
    if (articleTypeCode) {
      const [type] = await this.db.select().from(articleTypes)
        .where(and(eq(articleTypes.journalId, journalRow.id), eq(articleTypes.code, articleTypeCode))).limit(1);
      if (!type) throw new BadRequestException(`Journal '${journalRow.slug}' has no article type '${articleTypeCode}'`);
      // an archived type is no longer offered, but a paper that already has it may keep it
      if (type.status !== 'active' && type.id !== manuscript.articleTypeId) {
        throw new BadRequestException(`Article type '${articleTypeCode}' is no longer offered by this journal`);
      }
      typeId = type.id;
    }
    const current = manuscript.profilePin || {};
    if ((manuscript.articleTypeId ?? null) === typeId) {
      return { changed: false, articleType: manuscript.articleType ?? null, profilePin: current, version: manuscript.version || 1 };
    }

    const next = await this.profiles.pinFor(journalRow, articleTypeCode ?? undefined, { base: current.base, journal: current.journal });
    await this.revisions?.snapshotCurrent(manuscript, 'pre-risk', 'Trước khi đổi loại bài');
    await this.db.transaction(async (tx: any) => {
      await tx.update(manuscripts).set({ articleTypeId: typeId, profilePin: next.pin, updatedAt: new Date() }).where(eq(manuscripts.id, id));
      await tx.insert(manuscriptProfileSnapshots).values({
        manuscriptId: id,
        pin: next.pin,
        resolved: next.resolved,
        hash: crypto.createHash('sha256').update(JSON.stringify(next.resolved)).digest('hex'),
        reason: 'article_type_change',
      });
    });
    return { changed: true, articleType: articleTypeCode, profilePin: next.pin, version: manuscript.version || 1 };
  }

  /**
   * Retrieves paginated manuscripts with offset (page/limit) or cursor pagination,
   * with filtering, sorting, and CASL scoping pushed entirely to SQL via Drizzle.
   */
  async listManuscripts(
    query: ManuscriptQuery,
    userAbility?: AppAbility,
    userId?: string,
  ): Promise<{
    items: ManuscriptResponse[];
    total: number;
    page?: number;
    limit: number;
    nextCursor?: string;
  }> {
    const limit = Math.min(query.limit ?? 20, 100);
    const page = query.page ?? 1;
    const offset = Math.max((page - 1) * limit, 0);

    // a paper in the trash is not in anybody's list
    const whereConditions: any[] = [isNull(manuscripts.deletedAt)];

    // 0. Library scopes: every paper shared with anyone ("public"), or the public ones I opened
    //    through a link ("shared"). Everything else is limited by what the user's rules allow.
    const scope = query.scope ?? 'mine';
    if (scope !== 'mine') {
      whereConditions.push(inArray(manuscripts.generalAccess, ['VIEWER', 'EDITOR']));
      if (scope === 'shared') {
        if (!userId) return { items: [], total: 0, page: query.cursor ? undefined : page, limit, nextCursor: undefined };
        whereConditions.push(
          inArray(
            manuscripts.id,
            this.db.select({ id: manuscriptVisits.manuscriptId }).from(manuscriptVisits).where(eq(manuscriptVisits.userId, userId)),
          ),
        );
      }
    }

    // 1. CASL Ability Scoping pushed to SQL
    if (userAbility && scope === 'mine') {
      const isSuperAdmin = userAbility.can('manage', 'all');
      if (!isSuperAdmin) {
        const allowedJournals: string[] = [];
        const allowedManuscriptIds: string[] = [];
        let canReadAll = false;

        for (const rule of userAbility.rules || []) {
          const isManuscriptSubject = rule.subject === 'Manuscript' || rule.subject === 'all';
          const isReadOrManage =
            rule.action === 'manage' ||
            rule.action === 'read' ||
            (Array.isArray(rule.action) &&
              (rule.action.includes('read') || rule.action.includes('manage')));

          if (isManuscriptSubject && isReadOrManage && !rule.inverted) {
            const conditions = rule.conditions as Record<string, any> | undefined;
            if (!conditions || Object.keys(conditions).length === 0) {
              canReadAll = true;
              break;
            }
            if (conditions.journalId) {
              allowedJournals.push(String(conditions.journalId));
            }
            if (conditions.id) {
              if (conditions.id.$in && Array.isArray(conditions.id.$in)) {
                allowedManuscriptIds.push(...conditions.id.$in.map(String));
              } else if (typeof conditions.id === 'string') {
                allowedManuscriptIds.push(conditions.id);
              }
            }
          }
        }

        if (!canReadAll) {
          if (allowedJournals.length === 0 && allowedManuscriptIds.length === 0) {
            return {
              items: [],
              total: 0,
              page: query.cursor ? undefined : page,
              limit,
              nextCursor: undefined,
            };
          }

          const aclOrConditions: any[] = [];
          if (allowedJournals.length > 0) {
            aclOrConditions.push(inArray(manuscripts.journalId, allowedJournals));
          }
          if (allowedManuscriptIds.length > 0) {
            aclOrConditions.push(inArray(manuscripts.id, allowedManuscriptIds));
          }

          if (aclOrConditions.length === 1) {
            whereConditions.push(aclOrConditions[0]);
          } else if (aclOrConditions.length > 1) {
            whereConditions.push(or(...aclOrConditions));
          }
        }
      }
    }

    // 2. Search filter (title / abstract)
    if (query.search) {
      const searchPattern = `%${query.search.trim()}%`;
      whereConditions.push(
        or(
          ilike(manuscripts.title, searchPattern),
          ilike(manuscripts.abstract, searchPattern),
        ),
      );
    }

    // 3. Journal filter
    if (query.journalId) {
      whereConditions.push(eq(manuscripts.journalId, query.journalId));
    }

    // 4. Status filter
    if (query.status) {
      whereConditions.push(eq(manuscripts.status, query.status));
    }

    // 5. Cursor filter
    if (query.cursor) {
      try {
        const decoded: CursorPayload = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf8'),
        );
        const cursorDate = new Date(decoded.updatedAt);
        if (query.sortOrder === 'asc') {
          whereConditions.push(
            or(
              gt(manuscripts.updatedAt, cursorDate),
              and(eq(manuscripts.updatedAt, cursorDate), gt(manuscripts.id, decoded.id)),
            ),
          );
        } else {
          whereConditions.push(
            or(
              lt(manuscripts.updatedAt, cursorDate),
              and(eq(manuscripts.updatedAt, cursorDate), lt(manuscripts.id, decoded.id)),
            ),
          );
        }
      } catch {
        // Fallback for malformed cursor
      }
    }

    const combinedWhere = whereConditions.length > 0 ? and(...whereConditions) : undefined;
    const orderDirection = query.sortOrder === 'asc' ? asc : desc;
    const sortColumn = query.sortBy === 'title' ? manuscripts.title : manuscripts.updatedAt;
    const orderByClauses = [orderDirection(sortColumn), orderDirection(manuscripts.id)];

    if (!this.db) {
      return {
        items: [],
        total: 0,
        page: query.cursor ? undefined : page,
        limit,
        nextCursor: undefined,
      };
    }

    // Execute total count query directly in SQL
    let countQuery = this.db.select({ count: sql`count(*)` }).from(manuscripts);
    if (combinedWhere) {
      countQuery = countQuery.where(combinedWhere);
    }
    const countResult = await countQuery;
    const total = Number(countResult?.[0]?.count ?? 0);

    // Execute items query with sorting and pagination directly in SQL, joining journals
    let itemsQuery = this.db
      .select({
        manuscript: manuscripts,
        journal: journals,
        articleType: articleTypes.code,
      })
      .from(manuscripts)
      .leftJoin(journals, eq(manuscripts.journalId, journals.id))
      .leftJoin(articleTypes, eq(manuscripts.articleTypeId, articleTypes.id));

    if (combinedWhere) {
      itemsQuery = itemsQuery.where(combinedWhere) as any;
    }
    itemsQuery = itemsQuery.orderBy(...orderByClauses).limit(limit) as any;
    if (!query.cursor && offset > 0) {
      itemsQuery = itemsQuery.offset(offset) as any;
    }

    const rows = (await itemsQuery) || [];
    const items = rows.map((r: any) => {
      const ms = r.manuscript || r;
      const j = r.journal;
      const journalDto = journalSummary(j);

      return {
        ...ms,
        articleType: r.articleType ?? null,
        journal: journalDto,
        access: accessOf(userAbility, ms),
      };
    });

    // Compute next cursor
    let nextCursor: string | undefined;
    if (items.length === limit) {
      const lastItem = items[items.length - 1];
      const cursorPayload: CursorPayload = {
        id: lastItem.id,
        updatedAt: lastItem.updatedAt || lastItem.createdAt,
      };
      nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString('base64');
    }

    return {
      items,
      total,
      page: query.cursor ? undefined : page,
      limit,
      nextCursor,
    };
  }

  /**
   * Retrieves a single manuscript by ID along with its members, enforcing read ability.
   */
  async getManuscript(id: string, userAbility?: AppAbility): Promise<any> {
    const manuscript = await this.findManuscriptById(id);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${id} not found`);
    }

    if (userAbility && !userAbility.can('read', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to view this manuscript');
    }

    const members = await this.findMembersByManuscriptId(id);

    return {
      ...manuscript,
      members,
      access: accessOf(userAbility, manuscript),
    };
  }

  /**
   * Updates manuscript metadata/content with atomic optimistic concurrency locking against the version column.
   */
  async updateManuscript(
    id: string,
    dto: UpdateManuscript,
    ifMatch?: string,
    userAbility?: AppAbility,
    userId?: string,
  ): Promise<ManuscriptResponse> {
    const manuscript = await this.findManuscriptById(id);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${id} not found`);
    }

    if (userAbility && !userAbility.can('update', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to update this manuscript');
    }

    const currentVersion = manuscript.version || 1;

    if (ifMatch !== undefined) {
      const cleanMatch = ifMatch.replace(/^W\//, '').replace(/^"|"$/g, '').trim();
      if (cleanMatch !== String(currentVersion)) {
        throw new PreconditionFailedException({
          title: 'Xung đột phiên bản máy chủ',
          detail: `Phiên bản bản thảo trên máy chủ (${currentVersion}) không khớp với phiên bản máy bạn (${cleanMatch}). Vui lòng tải lại hoặc chọn "Ghi đè".`,
        });
      }
    }

    const newVersion = currentVersion + 1;
    const now = new Date();

    // history: the content about to be replaced may end a burst of editing; the workflow may be moving on
    // (the save merges its metadata into what is stored, so the paper after the save is that merge)
    const afterSave = dto.metadata !== undefined ? docFromStored({ ...(typeof manuscript.metadata === 'object' && manuscript.metadata ? manuscript.metadata : {}), ...dto.metadata }) : undefined;
    await this.revisions?.beforeSave(manuscript, { doc: afterSave, status: dto.status }, userId, now);

    const updates: Record<string, any> = {
      version: newVersion,
      updatedAt: now,
    };

    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.abstract !== undefined) updates.abstract = dto.abstract;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.metadata !== undefined) {
      updates.metadata = {
        ...(typeof manuscript.metadata === 'object' && manuscript.metadata !== null ? manuscript.metadata : {}),
        ...dto.metadata,
      };
    }

    if (this.db) {
      const result = await this.db
        .update(manuscripts)
        .set(updates)
        .where(
          and(
            eq(manuscripts.id, id),
            eq(manuscripts.version, currentVersion),
          ),
        )
        .returning?.();

      if (result && Array.isArray(result) && result.length === 0) {
        throw new PreconditionFailedException({
          title: 'Xung đột phiên bản máy chủ',
          detail: `Phát hiện phiên làm việc khác vừa lưu trên máy chủ (phiên bản ${currentVersion}). Vui lòng chọn "Ghi đè" nếu bạn muốn giữ thay đổi của mình.`,
        });
      }

      const updatedRow = result?.[0];
      return updatedRow || { ...manuscript, ...updates };
    }

    return { ...manuscript, ...updates };
  }

  /**
   * Deletes manuscript and all cascaded child records.
   */
  async deleteManuscript(id: string, userAbility?: AppAbility, userId?: string): Promise<{ success: boolean; movedToTrash: boolean }> {
    const manuscript = await this.findManuscriptById(id);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${id} not found`);
    }

    if (
      userAbility &&
      !userAbility.can('delete', subject('Manuscript', manuscript)) &&
      !userAbility.can('manage', subject('Manuscript', manuscript))
    ) {
      const locked = NON_DELETABLE_STATUSES.includes(manuscript.status);
      throw new ForbiddenException(
        locked
          ? 'Bản thảo đã vào quy trình biên tập/xuất bản nên không thể xóa'
          : 'You do not have permission to delete this manuscript',
      );
    }

    // Not deleted for good: the paper goes to the trash (with its history, members and sharing), where a journal manager
    // can bring it back until the retention period ends. It is already invisible everywhere else.
    if (this.db) {
      await this.db
        .update(manuscripts)
        .set({ deletedAt: new Date(), deletedBy: userId ?? null })
        .where(and(eq(manuscripts.id, id), isNull(manuscripts.deletedAt)));
      await this.audit(userId, 'manuscript.trash', id, { title: manuscript.title, journalId: manuscript.journalId });
    }

    return { success: true, movedToTrash: true };
  }

  /**
   * Transitions manuscript lifecycle status following a finite state machine,
   * validates role permissions, increments manuscript version,
   * and atomically produces a ManuscriptStatusChanged event into outbox_events.
   */
  async changeStatus(
    manuscriptId: string,
    dto: ChangeManuscriptStatus,
    userId?: string,
    userAbility?: AppAbility,
  ): Promise<{
    success: boolean;
    manuscript: ManuscriptResponse;
    outboxEventId: string;
    previousStatus: ManuscriptStatus;
    newStatus: ManuscriptStatus;
  }> {
    const manuscript = await this.findManuscriptById(manuscriptId);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${manuscriptId} not found`);
    }

    const currentStatus = manuscript.status as ManuscriptStatus;
    const newStatus = dto.status;

    // 1. Check if status is identical
    if (currentStatus === newStatus) {
      return {
        success: true,
        manuscript,
        outboxEventId: '',
        previousStatus: currentStatus,
        newStatus,
      };
    }

    // 2. Finite State Machine Validation
    const VALID_TRANSITIONS: Record<ManuscriptStatus, ManuscriptStatus[]> = {
      DRAFT: ['SUBMITTED'],
      SUBMITTED: ['IN_REVIEW', 'REJECTED', 'DRAFT'],
      IN_REVIEW: ['PROOFING', 'READY', 'ACCEPTED', 'REJECTED', 'DRAFT'],
      PROOFING: ['READY', 'PUBLISHED', 'IN_REVIEW', 'DRAFT'],
      READY: ['PUBLISHED', 'PROOFING', 'DRAFT'],
      ACCEPTED: ['READY', 'PUBLISHED', 'DRAFT'],
      REJECTED: ['DRAFT'],
      PUBLISHED: ['DRAFT', 'ARCHIVED'],
      ARCHIVED: ['DRAFT'],
    };

    const allowedNextStatuses = VALID_TRANSITIONS[currentStatus] || [];
    const isSuperAdmin = userAbility?.can('manage', 'all');

    if (!allowedNextStatuses.includes(newStatus) && !isSuperAdmin) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed next states: [${allowedNextStatuses.join(', ')}]`,
      );
    }

    // 3. Permission Checks per Transition
    if (userAbility && !isSuperAdmin) {
      if (newStatus === 'SUBMITTED' || (currentStatus === 'SUBMITTED' && newStatus === 'DRAFT')) {
        // Author or Editor can submit or withdraw
        if (
          !userAbility.can('update', subject('Manuscript', manuscript)) &&
          !userAbility.can('manage', subject('Manuscript', manuscript))
        ) {
          throw new ForbiddenException(
            `You do not have permission to transition manuscript to ${newStatus}`,
          );
        }
      } else {
        // Editorial decisions (IN_REVIEW, ACCEPTED, REJECTED, PUBLISHED) are made by managers only:
        // an Editor role alone no longer reaches other people's manuscripts.
        const canManageManuscript =
          userAbility.can('manage', 'Manuscript') ||
          userAbility.can('manage', subject('Manuscript', manuscript));

        if (!canManageManuscript) {
          throw new ForbiddenException(
            `You do not have editorial permission to transition manuscript to ${newStatus}`,
          );
        }
      }
    }

    // the paper as it goes into its next stage is kept as a named version
    await this.revisions?.beforeSave(manuscript, { status: newStatus }, userId);

    const currentVersion = manuscript.version || 1;
    const newVersion = currentVersion + 1;
    const now = new Date();
    const eventId = crypto.randomUUID();

    const outboxRecord = {
      id: eventId,
      aggregateType: 'manuscript',
      aggregateId: manuscriptId,
      eventType: 'ManuscriptStatusChanged',
      payload: {
        manuscriptId,
        previousStatus: currentStatus,
        newStatus,
        changedBy: userId || null,
        reason: dto.reason || null,
        note: dto.note || null,
        timestamp: now.toISOString(),
      },
      status: 'PENDING',
      retryCount: 0,
      createdAt: now,
    };

    const runTransaction = async (tx: any) => {
      // 1. Update manuscript status and version
      await tx
        .update(manuscripts)
        .set({
          status: newStatus,
          version: newVersion,
          updatedAt: now,
        })
        .where(
          and(
            eq(manuscripts.id, manuscriptId),
            eq(manuscripts.version, currentVersion),
          ),
        );

      // 2. Insert transactional outbox event
      await tx.insert(outboxEvents).values(outboxRecord);
    };

    if (this.db) {
      if (typeof this.db.transaction === 'function') {
        await this.db.transaction(runTransaction);
      } else {
        await runTransaction(this.db);
      }
    }

    const updatedManuscript: ManuscriptResponse = {
      ...manuscript,
      status: newStatus,
      version: newVersion,
      updatedAt: now,
    };

    return {
      success: true,
      manuscript: updatedManuscript,
      outboxEventId: eventId,
      previousStatus: currentStatus,
      newStatus,
    };
  }

  /**
   * A new paper made from a version of this one: the same content under a new title, the original untouched.
   * The copy belongs to the caller and starts with the original's journal and article type.
   */
  async duplicateFromRevision(
    id: string,
    revisionId: string,
    userId: string,
    userAbility?: AppAbility,
  ): Promise<ManuscriptResponse> {
    if (!this.revisions) throw new BadRequestException('History is not available');
    const original = await this.findManuscriptById(id);
    if (!original) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    const { doc, label } = await this.revisions.docOfRevision(id, revisionId, userAbility);
    const baseTitle = original.title || (doc as any)?.metadata?.title || 'Bản thảo';
    const title = `${baseTitle} (bản sao từ ${label})`.slice(0, 500);
    const copyDoc = { ...(doc as any), id: undefined, metadata: { ...((doc as any)?.metadata ?? {}), title } };
    delete (copyDoc as any).id;
    return this.createManuscript(
      {
        title,
        journalId: original.journal?.slug ?? original.journalId,
        // stored the way the original is, so the app reads the copy the way it reads any paper
        metadata: storedFromDoc(copyDoc, original.metadata),
        articleType: original.articleType ?? undefined,
      } as CreateManuscript,
      userId,
      userAbility,
    );
  }

  private async findManuscriptById(id: string): Promise<any> {
    if (!this.db) return null;

    if (this.db.select) {
      const rows = await this.db
        .select({
          manuscript: manuscripts,
          journal: journals,
          articleType: articleTypes.code,
        })
        .from(manuscripts)
        .leftJoin(journals, eq(manuscripts.journalId, journals.id))
        .leftJoin(articleTypes, eq(manuscripts.articleTypeId, articleTypes.id))
        .where(and(eq(manuscripts.id, id), isNull(manuscripts.deletedAt)))
        .limit(1);

      if (rows && rows.length > 0) {
        const ms = rows[0].manuscript;
        const j = rows[0].journal;
        const journalDto = journalSummary(j);

        return {
          ...ms,
          articleType: rows[0].articleType ?? null,
          journal: journalDto,
        };
      }
      return null;
    }

    if (this.db.query?.manuscripts?.findFirst) {
      return this.db.query.manuscripts.findFirst({
        where: and(eq(manuscripts.id, id), isNull(manuscripts.deletedAt)),
      });
    }

    return null;
  }

  private async audit(userId: string | undefined, action: string, resourceId: string, payload: Record<string, unknown>) {
    try {
      await this.db.insert(auditLogs).values({ userId: userId ?? null, action, resourceType: 'manuscript', resourceId, payload });
    } catch {
      // the audit trail must never block the change it describes
    }
  }

  private async findMembersByManuscriptId(manuscriptId: string): Promise<any[]> {
    if (!this.db) return [];

    if (this.db.query?.manuscriptMembers?.findMany) {
      return this.db.query.manuscriptMembers.findMany({
        where: eq(manuscriptMembers.manuscriptId, manuscriptId),
      });
    }

    if (this.db.select) {
      return this.db
        .select()
        .from(manuscriptMembers)
        .where(eq(manuscriptMembers.manuscriptId, manuscriptId));
    }

    return [];
  }
}
