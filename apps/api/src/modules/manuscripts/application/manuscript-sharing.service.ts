import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { manuscripts, manuscriptMembers, manuscriptVisits, users, eq, and, ne, or, ilike, asc } from '@structpaper/db';
import type { AddManuscriptMember, GeneralAccess } from '@structpaper/contracts';
import { subject, type AppAbility } from '../../access/domain/ability.factory';
import { AbilityCacheService } from '../../access/domain/ability-cache.service';

export interface PersonResult {
  id: string;
  email: string;
  displayName: string | null;
}

/**
 * Per-manuscript sharing (Google-Docs style): named members with a role, plus a
 * "general access" level for everybody in the system. Only users who may `share`
 * the manuscript (its owner, JournalManagers, SuperAdmins) can change any of it.
 */
@Injectable()
export class ManuscriptSharingService {
  constructor(
    @Optional()
    @Inject('DRIZZLE')
    private readonly db: any,
    @Optional()
    @Inject(AbilityCacheService)
    private readonly abilityCache?: AbilityCacheService,
  ) {}

  async getMembers(manuscriptId: string, ability?: AppAbility) {
    const manuscript = await this.find(manuscriptId);
    if (ability && !ability.can('read', subject('Manuscript', manuscript))) {
      throw new ForbiddenException('You do not have permission to view members of this manuscript');
    }

    const rows = await this.db
      .select({
        manuscriptId: manuscriptMembers.manuscriptId,
        userId: manuscriptMembers.userId,
        role: manuscriptMembers.role,
        createdAt: manuscriptMembers.createdAt,
        email: users.email,
        displayName: users.displayName,
      })
      .from(manuscriptMembers)
      .leftJoin(users, eq(manuscriptMembers.userId, users.id))
      .where(eq(manuscriptMembers.manuscriptId, manuscriptId))
      .orderBy(asc(manuscriptMembers.createdAt));

    return { generalAccess: manuscript.generalAccess ?? 'RESTRICTED', members: rows };
  }

  /** Adds a member, or changes the role of an existing one. */
  async addMember(manuscriptId: string, dto: AddManuscriptMember, ability?: AppAbility) {
    const manuscript = await this.find(manuscriptId);
    this.assertCanShare(ability, manuscript);

    if (dto.role === 'OWNER') {
      throw new BadRequestException('Không thể chỉ định thêm chủ sở hữu cho bản thảo');
    }
    if (dto.userId === manuscript.createdBy) {
      throw new BadRequestException('Chủ sở hữu luôn có toàn quyền, không cần thêm vai trò');
    }

    const [target] = await this.db
      .select({ id: users.id, status: users.status })
      .from(users)
      .where(eq(users.id, dto.userId))
      .limit(1);
    if (!target || target.status !== 'ACTIVE') {
      throw new NotFoundException('Người dùng không tồn tại hoặc chưa kích hoạt');
    }

    const record = { manuscriptId, userId: dto.userId, role: dto.role, createdAt: new Date() };
    await this.db
      .insert(manuscriptMembers)
      .values(record)
      .onConflictDoUpdate({
        target: [manuscriptMembers.manuscriptId, manuscriptMembers.userId],
        set: { role: dto.role },
      });
    this.abilityCache?.invalidate(dto.userId); // memberships are part of the cached ability
    return record;
  }

  async removeMember(manuscriptId: string, userId: string, ability?: AppAbility) {
    const manuscript = await this.find(manuscriptId);
    this.assertCanShare(ability, manuscript);

    if (userId === manuscript.createdBy) {
      throw new BadRequestException('Không thể gỡ chủ sở hữu khỏi bản thảo');
    }

    await this.db
      .delete(manuscriptMembers)
      .where(and(eq(manuscriptMembers.manuscriptId, manuscriptId), eq(manuscriptMembers.userId, userId)));
    this.abilityCache?.invalidate(userId);
    return { success: true };
  }

  async setGeneralAccess(manuscriptId: string, generalAccess: GeneralAccess, ability?: AppAbility) {
    const manuscript = await this.find(manuscriptId);
    this.assertCanShare(ability, manuscript);

    await this.db.update(manuscripts).set({ generalAccess }).where(eq(manuscripts.id, manuscriptId));
    return { generalAccess };
  }

  /** Looks active members up by email (or name) so the owner can add them. */
  async searchPeople(query: string, currentUserId?: string): Promise<PersonResult[]> {
    const escaped = query.trim().replace(/[%_\\]/g, (ch) => `\\${ch}`);
    const pattern = `%${escaped}%`;
    const match = or(ilike(users.email, pattern), ilike(users.displayName, pattern));
    const where = currentUserId
      ? and(eq(users.status, 'ACTIVE'), ne(users.id, currentUserId), match)
      : and(eq(users.status, 'ACTIVE'), match);

    return this.db
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users)
      .where(where)
      .orderBy(asc(users.email))
      .limit(8);
  }

  /**
   * Remembers that a signed-in user opened a paper that was shared with anyone, so it shows up in
   * their "shared with me" list. Best effort: never fails the request.
   */
  async recordVisit(manuscript: any, userId: string): Promise<void> {
    try {
      const isMember = (manuscript.members ?? []).some((m: any) => m.userId === userId);
      if (!manuscript.generalAccess || manuscript.generalAccess === 'RESTRICTED') return;
      if (manuscript.createdBy === userId || isMember) return;
      await this.db
        .insert(manuscriptVisits)
        .values({ userId, manuscriptId: manuscript.id, lastOpenedAt: new Date() })
        .onConflictDoUpdate({ target: [manuscriptVisits.userId, manuscriptVisits.manuscriptId], set: { lastOpenedAt: new Date() } });
    } catch {
      // the list is a convenience
    }
  }

  private assertCanShare(ability: AppAbility | undefined, manuscript: any) {
    if (!ability) return;
    const target = subject('Manuscript', manuscript);
    if (!ability.can('share', target) && !ability.can('manage', target)) {
      throw new ForbiddenException('Chỉ chủ sở hữu mới được chia sẻ bản thảo này');
    }
  }

  private async find(id: string) {
    const [row] = await this.db.select().from(manuscripts).where(eq(manuscripts.id, id)).limit(1);
    if (!row) throw new NotFoundException(`Manuscript with ID ${id} not found`);
    return row;
  }
}
