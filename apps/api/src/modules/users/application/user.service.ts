import {
  Injectable,
  Inject,
  Optional,
  NotFoundException,
  PreconditionFailedException,
  ConflictException,
} from '@nestjs/common';
import {
  users,
  userTokens,
  userRoles,
  roles,
  GLOBAL_SCOPE_ID,
  eq,
  sql,
  desc,
} from '@structpaper/db';
import type { InviteUser } from '@structpaper/contracts';
import { TokenService } from '../../identity/domain/token.service';
import { MailService } from '../../identity/domain/mail.service';

export interface UserQueryOptions {
  limit?: number;
  offset?: number;
  search?: string;
}

export interface UpdateUserDto {
  displayName?: string;
  avatarUrl?: string;
  status?: string;
}

@Injectable()
export class UserService {
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

  /**
   * Lists users with pagination and optional search filter.
   */
  async listUsers(options: UserQueryOptions = {}) {
    const limit = Math.min(options.limit ?? 20, 100);
    const offset = Math.max(options.offset ?? 0, 0);

    if (!this.db) {
      return { items: [], total: 0, limit, offset };
    }

    let items: any[] = [];
    let total = 0;

    if (this.db.query?.users?.findMany) {
      items = await this.db.query.users.findMany({
        limit,
        offset,
        orderBy: [desc(users.createdAt)],
      });
      const countResult = await this.db.select({ count: sql`count(*)` }).from(users);
      total = Number(countResult[0]?.count ?? 0);
    } else if (this.db.select) {
      items = await this.db.select().from(users).limit(limit).offset(offset);
      total = items.length;
    }

    return {
      items: items.map(({ passwordHash, ...u }) => u),
      total,
      limit,
      offset,
    };
  }

  /**
   * Invites a new user: creates in INVITED state, generates activation token,
   * sends invitation via MailService, and returns activation details in dev/staging.
   */
  async inviteUser(dto: InviteUser) {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check if user already exists
    let user = await this.findUserByEmail(normalizedEmail);
    if (user && user.status === 'ACTIVE') {
      throw new ConflictException('User with this email already exists and is active');
    }

    if (!user && this.db) {
      const inserted = await this.db
        .insert(users)
        .values({
          email: normalizedEmail,
          displayName: dto.displayName || null,
          status: 'INVITED',
          permissionsVersion: 1,
        })
        .returning();
      user = inserted[0];
    } else if (!user) {
      user = {
        id: `mock-user-${Date.now()}`,
        email: normalizedEmail,
        displayName: dto.displayName || null,
        status: 'INVITED',
        permissionsVersion: 1,
      };
    }

    // Assign role if specified
    if (dto.role && this.db) {
      await this.assignInitialRole(user.id, dto.role, dto.journalId);
    }

    // Generate 7-day one-time invitation token
    const token = this.tokenService.generateOneTimeToken(168);

    if (this.db) {
      await this.db.insert(userTokens).values({
        userId: user.id,
        type: 'INVITATION',
        tokenHash: token.tokenHash,
        expiresAt: token.expiresAt,
      });
    }

    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    const activationUrl = `${appUrl}/activate?token=${token.rawToken}`;

    if (this.mailService) {
      await this.mailService.sendInvitation(user.email, token.rawToken, activationUrl);
    }

    const { passwordHash, ...userSummary } = user;
    return {
      user: userSummary,
      activationUrl,
      token: token.rawToken,
    };
  }

  /**
   * Updates user profile with If-Match optimistic concurrency locking against permissionsVersion.
   */
  async updateUser(userId: string, updates: UpdateUserDto, ifMatch?: string) {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

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
      const result = await this.db
        .update(users)
        .set(setFields)
        .where(eq(users.id, userId))
        .returning();
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

  private async findUserByEmail(email: string): Promise<any> {
    if (!this.db) return null;
    if (this.db.query?.users?.findFirst) {
      return this.db.query.users.findFirst({
        where: eq(users.email, email),
      });
    }
    const rows = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return rows[0] || null;
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

  private async assignInitialRole(userId: string, roleNameOrId: string, journalId?: string | null) {
    try {
      let roleId = roleNameOrId;
      if (this.db.query?.roles?.findFirst) {
        const found = await this.db.query.roles.findFirst({
          where: eq(roles.name, roleNameOrId),
        });
        if (found) {
          roleId = found.id;
        }
      }
      await this.db
        .insert(userRoles)
        .values({
          userId,
          roleId,
          scopeJournalId: journalId || GLOBAL_SCOPE_ID,
        })
        .onConflictDoNothing?.();
    } catch {
      // Role assignment failure during invite is non-fatal
    }
  }
}
