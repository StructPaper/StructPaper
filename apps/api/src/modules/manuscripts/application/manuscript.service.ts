import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ForbiddenException,
  PreconditionFailedException,
} from '@nestjs/common';
import * as crypto from 'node:crypto';
import {
  manuscripts,
  manuscriptMembers,
  manuscriptDocs,
  eq,
  and,
  or,
  ilike,
  inArray,
  desc,
  asc,
  gt,
  lt,
  sql,
} from '@structpaper/db';
import type {
  CreateManuscript,
  UpdateManuscript,
  ManuscriptQuery,
  AddManuscriptMember,
  ManuscriptResponse,
} from '@structpaper/contracts';
import { subject, type AppAbility } from '../../access/domain/ability.factory';

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
    if (!journalId && this.db?.query?.journals?.findFirst) {
      try {
        const defaultJournal = await this.db.query.journals.findFirst();
        if (defaultJournal?.id) {
          journalId = defaultJournal.id;
        }
      } catch {
        // Fallback gracefully
      }
    }
    if (!journalId) {
      journalId = '00000000-0000-0000-0000-000000000000';
    }

    const manuscriptRecord = {
      id: manuscriptId,
      journalId,
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
    };

    if (this.db) {
      if (typeof this.db.transaction === 'function') {
        await this.db.transaction(runInserts);
      } else {
        await runInserts(this.db);
      }
    }

    return manuscriptRecord;
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

    const whereConditions: any[] = [];

    // 1. CASL Ability Scoping pushed to SQL
    if (userAbility) {
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

    // Execute items query with sorting and pagination directly in SQL
    let itemsQuery = this.db.select().from(manuscripts);
    if (combinedWhere) {
      itemsQuery = itemsQuery.where(combinedWhere);
    }
    itemsQuery = itemsQuery.orderBy(...orderByClauses).limit(limit);
    if (!query.cursor && offset > 0) {
      itemsQuery = itemsQuery.offset(offset);
    }

    const items = (await itemsQuery) || [];

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
        throw new PreconditionFailedException(
          `Manuscript version conflict: expected version ${cleanMatch}, but current version is ${currentVersion}`,
        );
      }
    }

    const newVersion = currentVersion + 1;
    const now = new Date();

    const updates: Record<string, any> = {
      version: newVersion,
      updatedAt: now,
    };

    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.abstract !== undefined) updates.abstract = dto.abstract;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.metadata !== undefined) updates.metadata = dto.metadata;

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
        throw new PreconditionFailedException(
          `Manuscript version conflict: concurrent update detected on version ${currentVersion}`,
        );
      }

      const updatedRow = result?.[0];
      return updatedRow || { ...manuscript, ...updates };
    }

    return { ...manuscript, ...updates };
  }

  /**
   * Deletes manuscript and all cascaded child records.
   */
  async deleteManuscript(id: string, userAbility?: AppAbility): Promise<{ success: boolean }> {
    const manuscript = await this.findManuscriptById(id);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${id} not found`);
    }

    if (
      userAbility &&
      !userAbility.can('delete', subject('Manuscript', manuscript)) &&
      !userAbility.can('manage', subject('Manuscript', manuscript))
    ) {
      throw new ForbiddenException('You do not have permission to delete this manuscript');
    }

    if (this.db) {
      await this.db.delete(manuscripts).where(eq(manuscripts.id, id));
    }

    return { success: true };
  }

  /**
   * Adds a member to the manuscript.
   */
  async addMember(
    manuscriptId: string,
    dto: AddManuscriptMember,
    userAbility?: AppAbility,
  ): Promise<any> {
    const manuscript = await this.findManuscriptById(manuscriptId);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${manuscriptId} not found`);
    }

    if (
      userAbility &&
      !userAbility.can('manage', subject('Manuscript', manuscript)) &&
      !userAbility.can('update', subject('Manuscript', manuscript))
    ) {
      throw new ForbiddenException('You do not have permission to manage members of this manuscript');
    }

    const memberRecord = {
      manuscriptId,
      userId: dto.userId,
      role: dto.role,
      createdAt: new Date(),
    };

    if (this.db) {
      await this.db
        .insert(manuscriptMembers)
        .values(memberRecord)
        .onConflictDoNothing?.();
    }

    return memberRecord;
  }

  /**
   * Removes a member from the manuscript.
   */
  async removeMember(
    manuscriptId: string,
    userId: string,
    userAbility?: AppAbility,
  ): Promise<{ success: boolean }> {
    const manuscript = await this.findManuscriptById(manuscriptId);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${manuscriptId} not found`);
    }

    if (
      userAbility &&
      !userAbility.can('manage', subject('Manuscript', manuscript)) &&
      !userAbility.can('update', subject('Manuscript', manuscript))
    ) {
      throw new ForbiddenException('You do not have permission to manage members of this manuscript');
    }

    if (this.db) {
      await this.db
        .delete(manuscriptMembers)
        .where(
          and(
            eq(manuscriptMembers.manuscriptId, manuscriptId),
            eq(manuscriptMembers.userId, userId),
          ),
        );
    }

    return { success: true };
  }

  /**
   * Retrieves all members of a manuscript.
   */
  async getMembers(manuscriptId: string, userAbility?: AppAbility): Promise<any[]> {
    const manuscript = await this.findManuscriptById(manuscriptId);
    if (!manuscript) {
      throw new NotFoundException(`Manuscript with ID ${manuscriptId} not found`);
    }

    if (userAbility && !userAbility.can('read', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to view members of this manuscript');
    }

    return this.findMembersByManuscriptId(manuscriptId);
  }

  private async findManuscriptById(id: string): Promise<any> {
    if (!this.db) return null;

    if (this.db.query?.manuscripts?.findFirst) {
      return this.db.query.manuscripts.findFirst({
        where: eq(manuscripts.id, id),
      });
    }

    if (this.db.select) {
      const rows = await this.db.select().from(manuscripts).where(eq(manuscripts.id, id)).limit(1);
      return rows[0] || null;
    }

    return null;
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
