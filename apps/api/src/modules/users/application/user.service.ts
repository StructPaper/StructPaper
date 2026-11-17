import {
  Injectable,
  Inject,
  Optional,
  Logger,
  NotFoundException,
  PreconditionFailedException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  users,
  userTokens,
  userRoles,
  roles,
  journals,
  GLOBAL_SCOPE_ID,
  eq,
  and,
  or,
  isNull,
  inArray,
  ilike,
  sql,
  desc,
} from '@structpaper/db';
import type { InviteUser } from '@structpaper/contracts';
import { TokenService } from '../../identity/domain/token.service';
import { MailService } from '../../identity/domain/mail.service';
import { subject, type AppAbility } from '../../access/domain/ability.factory';
import {
  assertNotLastActiveSuperAdmin,
  assertNotSelf,
  isSuperAdminRole,
  SELF_CHANGE_STATUS_MESSAGE,
} from '../../access/domain/super-admin-invariant';

/** Invitation links stay valid for 72 hours (shorter window = smaller exposure of a leaked link). */
export const INVITATION_TTL_HOURS = 72;

export interface UserQueryOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface UpdateUserDto {
  displayName?: string;
  avatarUrl?: string | null;
  status?: string;
}

/** Who is performing the action. Absent for trusted internal callers (seed, scripts). */
export interface InviteActor {
  user?: { id?: string } | null;
  ability?: AppAbility | null;
}

/** Why a user's roles/status can not be edited by the current viewer (null = editable). */
export type LockReason = 'SELF' | 'REQUIRES_SUPERADMIN';

export interface UserRoleView {
  roleName: string;
  scopeJournalId: string | null;
  scopeJournalName: string | null;
}

export interface InviteResult {
  user: Record<string, any>;
  activationUrl: string;
  token: string;
  expiresAt: string;
}

export interface PendingInvitationView {
  id: string;
  email: string;
  displayName: string | null;
  roles: UserRoleView[];
  invitedAt: string;
  expiresAt: string;
  status: 'PENDING' | 'EXPIRED';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @Optional()
    @Inject('DRIZZLE')
    private readonly db: any,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
    @Optional()
    @Inject(MailService)
    private readonly mailService?: MailService,
  ) {}

  // ---------------------------------------------------------------------------
  // Listing
  // ---------------------------------------------------------------------------

  /**
   * Lists users (with their role assignments) using pagination and an optional search filter.
   */
  async listUsers(options: UserQueryOptions = {}, actor?: InviteActor) {
    const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);

    if (!this.db) {
      return { items: [], total: 0, limit, offset };
    }

    const term = options.search?.trim();
    const pattern = term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
    const where = pattern
      ? or(ilike(users.email, pattern), ilike(users.displayName, pattern))
      : undefined;

    const rows: any[] = await this.db
      .select()
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);

    const countRows: any[] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(where);
    const total = Number(countRows[0]?.count ?? 0);

    const rolesByUser = await this.loadRoles(rows.map((r) => r.id));

    return {
      items: rows.map(({ passwordHash, ...u }) => {
        const userRolesView = rolesByUser.get(u.id) ?? [];
        return { ...u, roles: userRolesView, lockReason: this.lockReasonFor(u.id, userRolesView, actor) };
      }),
      total,
      limit,
      offset,
    };
  }

  /**
   * Pending (not yet activated) invitations, newest first. Raw tokens are never returned:
   * only their hash is stored, so a link can be re-issued but never recovered.
   */
  async listPendingInvitations(): Promise<PendingInvitationView[]> {
    if (!this.db) return [];

    const rows: any[] = await this.db
      .select({
        userId: users.id,
        email: users.email,
        displayName: users.displayName,
        invitedAt: userTokens.createdAt,
        expiresAt: userTokens.expiresAt,
      })
      .from(userTokens)
      .innerJoin(users, eq(userTokens.userId, users.id))
      .where(
        and(
          eq(userTokens.type, 'INVITATION'),
          isNull(userTokens.consumedAt),
          eq(users.status, 'INVITED'),
        ),
      )
      .orderBy(desc(userTokens.createdAt));

    // Keep only the most recent outstanding token per user.
    const latest = new Map<string, any>();
    for (const row of rows) {
      if (!latest.has(row.userId)) latest.set(row.userId, row);
    }

    const rolesByUser = await this.loadRoles([...latest.keys()]);
    const now = Date.now();

    return [...latest.values()].map((row) => ({
      id: row.userId,
      email: row.email,
      displayName: row.displayName ?? null,
      roles: rolesByUser.get(row.userId) ?? [],
      invitedAt: new Date(row.invitedAt).toISOString(),
      expiresAt: new Date(row.expiresAt).toISOString(),
      status: new Date(row.expiresAt).getTime() < now ? 'EXPIRED' : 'PENDING',
    }));
  }

  // ---------------------------------------------------------------------------
  // Invitations
  // ---------------------------------------------------------------------------

  /**
   * Invites a user: creates (or reuses) the INVITED account, assigns the initial role and issues
   * a fresh one-time activation link. Any earlier unused link for the same user is revoked.
   * Everything happens in one transaction, so a failure never leaves a half-invited user behind.
   */
  async inviteUser(dto: InviteUser, actor?: InviteActor): Promise<InviteResult> {
    const db = this.requireDb();
    const email = dto.email.trim().toLowerCase();

    const role = await this.resolveRole(dto.role);
    this.assertCanAssign(actor, role.name, dto.journalId);
    if (dto.journalId) {
      await this.assertJournalExists(dto.journalId);
    }
    const scopeJournalId = dto.journalId || GLOBAL_SCOPE_ID;

    const { user, token } = await db.transaction(async (tx: any) => {
      const existing = (await tx.select().from(users).where(eq(users.email, email)).limit(1))[0];

      if (existing && existing.status !== 'INVITED') {
        throw new ConflictException(
          existing.status === 'ACTIVE'
            ? 'User with this email already exists and is active'
            : 'User with this email exists and cannot be invited',
        );
      }

      let user = existing;
      if (!user) {
        user = (
          await tx
            .insert(users)
            .values({
              email,
              displayName: dto.displayName || null,
              status: 'INVITED',
              permissionsVersion: 1,
            })
            .returning()
        )[0];
      } else if (dto.displayName) {
        user = (
          await tx
            .update(users)
            .set({ displayName: dto.displayName, updatedAt: new Date() })
            .where(eq(users.id, user.id))
            .returning()
        )[0] ?? user;
      }

      // A re-invite replaces whatever the previous (never activated) invitation granted.
      await tx.delete(userRoles).where(eq(userRoles.userId, user.id));
      await tx.insert(userRoles).values({ userId: user.id, roleId: role.id, scopeJournalId });

      const token = await this.issueInvitationToken(tx, user.id);
      return { user, token };
    });

    return this.deliverInvitation(user, token);
  }

  /**
   * Issues a NEW link for a pending invitation (the previous one stops working).
   * The old raw token cannot be recovered, which is why "copy link" must always mint a new one.
   */
  async resendInvite(userId: string, actor?: InviteActor): Promise<InviteResult> {
    const db = this.requireDb();
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    if (user.status !== 'INVITED') {
      throw new ConflictException('This user is not pending activation; there is no invitation to resend');
    }
    await this.assertCanManageUserRoles(actor, userId);

    const token = await db.transaction((tx: any) => this.issueInvitationToken(tx, user.id));
    return this.deliverInvitation(user, token);
  }

  /**
   * Cancels a pending invitation: removes the never-activated account together with its
   * role assignments and tokens (cascade), so the link can no longer be used.
   */
  async revokeInvitation(userId: string, actor?: InviteActor): Promise<{ success: boolean; message: string }> {
    const db = this.requireDb();
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    if (user.status !== 'INVITED' || user.passwordHash) {
      throw new ConflictException('Only pending invitations can be revoked');
    }
    await this.assertCanManageUserRoles(actor, userId);

    await db
      .delete(users)
      .where(and(eq(users.id, userId), eq(users.status, 'INVITED'), isNull(users.passwordHash)));

    return { success: true, message: 'Invitation revoked' };
  }

  // ---------------------------------------------------------------------------
  // Profile
  // ---------------------------------------------------------------------------

  /**
   * Updates user profile with If-Match optimistic concurrency locking against permissionsVersion.
   */
  async updateUser(userId: string, updates: UpdateUserDto, ifMatch?: string, actor?: InviteActor) {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    await this.assertCanModifyUser(actor, user, updates);

    if (ifMatch !== undefined) {
      const cleanMatch = ifMatch.replace(/^W\//, '').replace(/^"|"$/g, '').trim();
      const currentVersion = String(user.permissionsVersion);
      if (cleanMatch !== currentVersion) {
        throw new PreconditionFailedException(
          `User version conflict: expected version ${cleanMatch}, but current version is ${currentVersion}`,
        );
      }
    }

    const setFields: Record<string, any> = {
      updatedAt: new Date(),
    };
    if (updates.displayName !== undefined) {
      setFields.displayName = updates.displayName;
    }
    if (updates.avatarUrl !== undefined) {
      setFields.avatarUrl = updates.avatarUrl;
    }
    if (updates.status !== undefined) {
      setFields.status = updates.status;
      setFields.permissionsVersion = user.permissionsVersion + 1;
    }

    if (this.db) {
      const persist = (executor: any) =>
        executor.update(users).set(setFields).where(eq(users.id, userId)).returning();

      // Deactivating an ACTIVE account must never remove the last active SuperAdmin: check and
      // update in ONE transaction (SuperAdmin rows locked) so concurrent suspensions cannot race.
      const deactivating = updates.status !== undefined && updates.status !== 'ACTIVE' && user.status === 'ACTIVE';
      const result = deactivating
        ? await this.db.transaction(async (tx: any) => {
            await assertNotLastActiveSuperAdmin(tx, userId);
            return persist(tx);
          })
        : await persist(this.db);
      const updated = result[0] || { ...user, ...setFields };
      const { passwordHash, ...cleanUser } = updated;
      return cleanUser;
    }

    const updated = { ...user, ...setFields };
    const { passwordHash, ...cleanUser } = updated;
    return cleanUser;
  }

  /**
   * Retrieves single user by id.
   */
  async getUserById(userId: string) {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }
    const { passwordHash, ...cleanUser } = user;
    return cleanUser;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private requireDb(): any {
    if (!this.db) {
      throw new ServiceUnavailableException('Database is not configured');
    }
    return this.db;
  }

  private activationUrlFor(rawToken: string): string {
    const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
    // Token goes in the URL fragment: it is never sent to servers, proxies or access logs,
    // and never leaks through the Referer header.
    return `${appUrl}/activate#token=${rawToken}`;
  }

  /** Revokes every unused invitation token of the user, then issues a new one. */
  private async issueInvitationToken(executor: any, userId: string) {
    await executor
      .update(userTokens)
      .set({ consumedAt: new Date() })
      .where(
        and(
          eq(userTokens.userId, userId),
          eq(userTokens.type, 'INVITATION'),
          isNull(userTokens.consumedAt),
        ),
      );

    const token = this.tokenService.generateOneTimeToken(INVITATION_TTL_HOURS);
    await executor.insert(userTokens).values({
      userId,
      type: 'INVITATION',
      tokenHash: token.tokenHash,
      expiresAt: token.expiresAt,
    });
    return token;
  }

  private async deliverInvitation(
    user: any,
    token: { rawToken: string; expiresAt: Date },
  ): Promise<InviteResult> {
    const activationUrl = this.activationUrlFor(token.rawToken);

    if (this.mailService) {
      try {
        await this.mailService.sendInvitation(user.email, token.rawToken, activationUrl);
      } catch (err: any) {
        // The link is still returned to the inviter, so a mail failure must not fail the invite.
        this.logger.warn(`Could not send invitation mail to ${user.email}: ${err?.message}`);
      }
    }

    const { passwordHash, ...userSummary } = user;
    return {
      user: userSummary,
      activationUrl,
      token: token.rawToken,
      expiresAt: token.expiresAt.toISOString(),
    };
  }

  /** Resolves a role by id or by name. Unknown roles are rejected (never silently ignored). */
  private async resolveRole(nameOrId: string): Promise<{ id: string; name: string }> {
    const db = this.requireDb();
    const value = nameOrId.trim();
    const rows = await db
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(UUID_RE.test(value) ? eq(roles.id, value) : eq(roles.name, value))
      .limit(1);

    if (!rows[0]) {
      throw new BadRequestException(`Unknown role "${nameOrId}"`);
    }
    return rows[0];
  }

  private async assertJournalExists(journalId: string): Promise<void> {
    const rows = await this.requireDb()
      .select({ id: journals.id })
      .from(journals)
      .where(eq(journals.id, journalId))
      .limit(1);
    if (!rows[0]) {
      throw new BadRequestException('Unknown journal');
    }
  }

  /**
   * Anti privilege-escalation rules (same policy as role assignment):
   *  - SuperAdmin ("manage all") may grant anything;
   *  - nobody else may grant SuperAdmin;
   *  - otherwise the actor must be able to manage roles in the target scope.
   */
  private assertCanAssign(actor: InviteActor | undefined, roleName: string, journalId?: string | null): void {
    const ability = actor?.ability;
    if (!ability) return;
    if (ability.can('manage', 'all')) return;

    if (roleName.toLowerCase() === 'superadmin') {
      throw new ForbiddenException('Privilege escalation denied: only SuperAdmin can grant the SuperAdmin role');
    }
    if (!ability.can('manage', subject('Role', { journalId: journalId || GLOBAL_SCOPE_ID }))) {
      throw new ForbiddenException('You do not have permission to manage roles in this scope');
    }
  }

  /**
   * Single source of truth for the UI: can the viewer edit this user's roles/status?
   * The same rules are enforced again by the write endpoints, this only lets the screen
   * explain WHY a row is locked instead of failing after the click.
   */
  private lockReasonFor(userId: string, roleViews: UserRoleView[], actor?: InviteActor): LockReason | null {
    if (!actor?.user?.id && !actor?.ability) return null;
    if (actor.user?.id === userId) return 'SELF';
    const holdsSuperAdmin = roleViews.some((r) => isSuperAdminRole(r.roleName));
    if (holdsSuperAdmin && actor.ability && !actor.ability.can('manage', 'all')) return 'REQUIRES_SUPERADMIN';
    return null;
  }

  /**
   * A role manager must not be able to take over or lock out accounts above their level:
   * only SuperAdmin may change a SuperAdmin, and nobody changes their own status.
   */
  private async assertCanModifyUser(
    actor: InviteActor | undefined,
    target: any,
    updates: UpdateUserDto,
  ): Promise<void> {
    // Nobody (SuperAdmin included) changes their own account status.
    if (updates.status !== undefined) {
      assertNotSelf(actor?.user?.id, target.id, SELF_CHANGE_STATUS_MESSAGE);
    }

    const ability = actor?.ability;
    if (!ability || ability.can('manage', 'all')) return;

    const assigned = (await this.loadRoles([target.id])).get(target.id) ?? [];
    if (assigned.some((r) => r.roleName.toLowerCase() === 'superadmin')) {
      throw new ForbiddenException('Only SuperAdmin can modify a SuperAdmin account');
    }
  }

  private async assertCanManageUserRoles(actor: InviteActor | undefined, userId: string): Promise<void> {
    if (!actor?.ability) return;
    const assigned = (await this.loadRoles([userId])).get(userId) ?? [];
    for (const r of assigned) {
      this.assertCanAssign(actor, r.roleName, r.scopeJournalId);
    }
  }

  /** Role assignments (with journal names) for a batch of users. */
  private async loadRoles(userIds: string[]): Promise<Map<string, UserRoleView[]>> {
    const result = new Map<string, UserRoleView[]>();
    if (!this.db || userIds.length === 0) return result;

    const rows: any[] = await this.db
      .select({
        userId: userRoles.userId,
        roleName: roles.name,
        scopeJournalId: userRoles.scopeJournalId,
        journalName: journals.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .leftJoin(journals, eq(userRoles.scopeJournalId, journals.id))
      .where(inArray(userRoles.userId, userIds));

    for (const row of rows) {
      const isGlobal = !row.scopeJournalId || row.scopeJournalId === GLOBAL_SCOPE_ID;
      const view: UserRoleView = {
        roleName: row.roleName,
        scopeJournalId: isGlobal ? null : row.scopeJournalId,
        scopeJournalName: isGlobal ? null : row.journalName ?? null,
      };
      const list = result.get(row.userId);
      if (list) list.push(view);
      else result.set(row.userId, [view]);
    }
    return result;
  }

  private async findUserById(id: string): Promise<any> {
    if (!this.db) return null;
    if (this.db.query?.users?.findFirst) {
      return this.db.query.users.findFirst({
        where: eq(users.id, id),
      });
    }
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0] || null;
  }
}
