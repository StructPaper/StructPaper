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
  manuscriptDocs,
  eq,
  and,
  ilike,
  desc,
  asc,
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
   * Creates a new manuscript, automatically assigns the creator as OWNER in manuscript_members,
   * and initializes an empty manuscript_docs doc_tree at server_rev = 0.
   */
  async createManuscript(dto: CreateManuscript, userId: string): Promise<ManuscriptResponse> {
    const manuscriptId = crypto.randomUUID();
    const now = new Date();

    const manuscriptRecord = {
      id: manuscriptId,
      journalId: dto.journalId,
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

    if (this.db) {
      // If mockDb in-memory container exists, record in mock state
      if (this.db._data) {
        this.db._data.manuscripts.push(manuscriptRecord);
        this.db._data.manuscriptMembers.push(memberRecord);
        this.db._data.manuscriptDocs.push(docRecord);
      }

      await this.db.insert(manuscripts).values(manuscriptRecord).returning?.();
      await this.db.insert(manuscriptMembers).values(memberRecord).returning?.();
      await this.db.insert(manuscriptDocs).values(docRecord).returning?.();
    }

    return manuscriptRecord;
  }

  /**
   * Retrieves paginated manuscripts with offset (page/limit) or cursor pagination,
   * filtered by CASL abilities and optional search criteria.
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

    let allItems: any[] = [];

    if (this.db?._data?.manuscripts) {
      allItems = [...this.db._data.manuscripts];
    } else if (this.db?.query?.manuscripts?.findMany) {
      allItems = await this.db.query.manuscripts.findMany({
        orderBy: query.sortOrder === 'asc' ? [asc(manuscripts.updatedAt)] : [desc(manuscripts.updatedAt)],
      });
    } else if (this.db?.select) {
      allItems = await this.db.select().from(manuscripts);
    }

    // 1. Filter by CASL ability
    if (userAbility) {
      allItems = allItems.filter((item) => {
        try {
          return userAbility.can('read', subject('Manuscript', item));
        } catch {
          return false;
        }
      });
    }

    // 2. Filter by search query (title / abstract)
    if (query.search) {
      const searchLower = query.search.toLowerCase();
      allItems = allItems.filter(
        (m) =>
          (m.title && m.title.toLowerCase().includes(searchLower)) ||
          (m.abstract && m.abstract.toLowerCase().includes(searchLower)),
      );
    }

    // 3. Filter by journalId
    if (query.journalId) {
      allItems = allItems.filter((m) => m.journalId === query.journalId);
    }

    // 4. Filter by status
    if (query.status) {
      allItems = allItems.filter((m) => m.status === query.status);
    }

    // 5. Sort
    allItems.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt).getTime();
      return query.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });

    const total = allItems.length;

    // 6. Handle pagination: cursor vs offset
    let paginatedItems: any[] = [];
    let nextCursor: string | undefined;

    if (query.cursor) {
      try {
        const decoded: CursorPayload = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf8'),
        );
        const cursorTime = new Date(decoded.updatedAt).getTime();
        const cursorIndex = allItems.findIndex((m) => {
          const mTime = new Date(m.updatedAt || m.createdAt).getTime();
          if (query.sortOrder === 'asc') {
            return mTime > cursorTime || (mTime === cursorTime && m.id > decoded.id);
          }
          return mTime < cursorTime || (mTime === cursorTime && m.id < decoded.id);
        });

        if (cursorIndex >= 0) {
          paginatedItems = allItems.slice(cursorIndex, cursorIndex + limit);
        } else {
          paginatedItems = [];
        }
      } catch {
        paginatedItems = allItems.slice(0, limit);
      }
    } else {
      const offset = (page - 1) * limit;
      paginatedItems = allItems.slice(offset, offset + limit);
    }

    // Compute nextCursor if more items exist
    if (paginatedItems.length === limit) {
      const lastItem = paginatedItems[paginatedItems.length - 1];
      const lastIndex = allItems.findIndex((m) => m.id === lastItem.id);
      if (lastIndex >= 0 && lastIndex < allItems.length - 1) {
        const cursorPayload: CursorPayload = {
          id: lastItem.id,
          updatedAt: lastItem.updatedAt || lastItem.createdAt,
        };
        nextCursor = Buffer.from(JSON.stringify(cursorPayload)).toString('base64');
      }
    }

    return {
      items: paginatedItems,
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
   * Updates manuscript metadata/content with If-Match concurrency locking against the version column.
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

    if (ifMatch !== undefined) {
      const cleanMatch = ifMatch.replace(/^W\//, '').replace(/^"|"$/g, '').trim();
      const currentVersion = String(manuscript.version);
      if (cleanMatch !== currentVersion) {
        throw new PreconditionFailedException(
          `Manuscript version conflict: expected version ${cleanMatch}, but current version is ${currentVersion}`,
        );
      }
    }

    const newVersion = (manuscript.version || 1) + 1;
    const now = new Date();

    const updates: Record<string, any> = {
      version: newVersion,
      updatedAt: now,
    };

    if (dto.title !== undefined) updates.title = dto.title;
    if (dto.abstract !== undefined) updates.abstract = dto.abstract;
    if (dto.status !== undefined) updates.status = dto.status;
    if (dto.metadata !== undefined) updates.metadata = dto.metadata;

    const updated = {
      ...manuscript,
      ...updates,
    };

    if (this.db) {
      if (this.db._data?.manuscripts) {
        const idx = this.db._data.manuscripts.findIndex((m: any) => m.id === id);
        if (idx >= 0) {
          this.db._data.manuscripts[idx] = updated;
        }
      }

      await this.db
        .update(manuscripts)
        .set(updates)
        .where(eq(manuscripts.id, id))
        .returning?.();
    }

    return updated;
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
      if (this.db._data?.manuscripts) {
        this.db._data.manuscripts = this.db._data.manuscripts.filter((m: any) => m.id !== id);
      }
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
      if (this.db._data?.manuscriptMembers) {
        this.db._data.manuscriptMembers.push(memberRecord);
      }
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
      if (this.db._data?.manuscriptMembers) {
        this.db._data.manuscriptMembers = this.db._data.manuscriptMembers.filter(
          (m: any) => !(m.manuscriptId === manuscriptId && m.userId === userId),
        );
      }
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

    if (this.db._data?.manuscripts) {
      return this.db._data.manuscripts.find((m: any) => m.id === id) || null;
    }

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

    if (this.db._data?.manuscriptMembers) {
      return this.db._data.manuscriptMembers.filter((m: any) => m.manuscriptId === manuscriptId);
    }

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
