import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { journals } from './schema/journals';
import { users, userTokens } from './schema/users';
import { roles, permissions, rolePermissions, userRoles, GLOBAL_SCOPE_ID } from './schema/access';

export interface SeedResult {
  journal: any;
  roles: any[];
  adminUser: any;
  activationToken?: string;
}

export const SYSTEM_ROLES = [
  {
    name: 'SuperAdmin',
    description: 'Global Super Administrator with full system control',
    isSystem: true,
  },
  {
    name: 'JournalManager',
    description: 'Journal Manager with control over journal operations',
    isSystem: true,
  },
  {
    name: 'Editor',
    description: 'Journal Editor overseeing submissions and peer review',
    isSystem: true,
  },
  {
    name: 'Author',
    description: 'Manuscript Author and contributor',
    isSystem: true,
  },
  {
    name: 'Reviewer',
    description: 'Peer Reviewer evaluating assigned manuscripts',
    isSystem: true,
  },
] as const;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derivedKey}`;
}

export async function seedDatabase(db: any): Promise<SeedResult> {
  // 1. Default Journal: vnu-jst
  const defaultSlug = 'vnu-jst';
  let defaultJournal = await db.query.journals?.findFirst({
    where: eq(journals.slug, defaultSlug),
  });

  if (!defaultJournal) {
    const inserted = await db
      .insert(journals)
      .values({
        slug: defaultSlug,
        name: 'Tạp chí Phát triển Khoa học và Công nghệ ĐHQG-HCM',
        issn: '1859-0128',
        settings: {
          code: 'VNUHCM-JST',
          language: 'vi',
          openAccess: true,
          publisher: 'Đại học Quốc gia TP.HCM',
        },
        version: 1,
      })
      .returning();
    defaultJournal = inserted[0];
  }

  // 2. System Roles
  const seededRoles: any[] = [];
  for (const roleDef of SYSTEM_ROLES) {
    let role = await db.query.roles?.findFirst({
      where: eq(roles.name, roleDef.name),
    });

    if (!role) {
      const inserted = await db
        .insert(roles)
        .values({
          name: roleDef.name,
          description: roleDef.description,
          isSystem: true,
          journalId: null,
        })
        .returning();
      role = inserted[0];
    }
    seededRoles.push(role);
  }

  // 3. SuperAdmin Wildcard Permission
  const superAdminRole = seededRoles.find((r) => r.name === 'SuperAdmin');
  if (superAdminRole) {
    let wildcardPerm = await db.query.permissions?.findFirst({
      where: and(eq(permissions.action, 'manage'), eq(permissions.subject, 'all')),
    });

    if (!wildcardPerm) {
      const insertedPerm = await db
        .insert(permissions)
        .values({
          action: 'manage',
          subject: 'all',
          conditions: null,
        })
        .returning();
      wildcardPerm = insertedPerm[0];
    }

    // Link SuperAdmin to wildcard permission
    const existingLink = await db.query.rolePermissions?.findFirst({
      where: and(
        eq(rolePermissions.roleId, superAdminRole.id),
        eq(rolePermissions.permissionId, wildcardPerm.id),
      ),
    });

    if (!existingLink) {
      await db
        .insert(rolePermissions)
        .values({
          roleId: superAdminRole.id,
          permissionId: wildcardPerm.id,
        })
        .onConflictDoNothing();
    }
  }

  // 4. Default Admin User
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'admin@structpaper.org').trim().toLowerCase();
  const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;

  let adminUser = await db.query.users?.findFirst({
    where: eq(users.email, adminEmail),
  });

  let activationToken: string | undefined;

  if (!adminUser) {
    if (initialPassword && initialPassword.length >= 8) {
      const passwordHash = hashPassword(initialPassword);
      const insertedUser = await db
        .insert(users)
        .values({
          email: adminEmail,
          passwordHash,
          displayName: 'System SuperAdmin',
          status: 'ACTIVE',
          permissionsVersion: 1,
        })
        .returning();
      adminUser = insertedUser[0];
      // eslint-disable-next-line no-console
      console.log(`[SEED] Initial SuperAdmin active: ${adminEmail} (password: ${initialPassword})`);
    } else {
      // Create in INVITED status with activation token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const insertedUser = await db
        .insert(users)
        .values({
          email: adminEmail,
          passwordHash: null,
          displayName: 'System SuperAdmin',
          status: 'INVITED',
          permissionsVersion: 1,
        })
        .returning();
      adminUser = insertedUser[0];

      await db.insert(userTokens).values({
        userId: adminUser.id,
        type: 'INVITATION',
        tokenHash,
        expiresAt,
      });

      activationToken = rawToken;
      // eslint-disable-next-line no-console
      console.log(`[SEED] Initial SuperAdmin invited: ${adminEmail}`);
      // eslint-disable-next-line no-console
      console.log(`[SEED] One-time activation link: http://localhost:3000/auth/activate?token=${rawToken}`);
    }
  }

  // 5. Assign SuperAdmin role to admin user
  if (superAdminRole && adminUser) {
    const existingRoleAssign = await db.query.userRoles?.findFirst({
      where: and(
        eq(userRoles.userId, adminUser.id),
        eq(userRoles.roleId, superAdminRole.id),
        eq(userRoles.scopeJournalId, GLOBAL_SCOPE_ID),
      ),
    });

    if (!existingRoleAssign) {
      await db
        .insert(userRoles)
        .values({
          userId: adminUser.id,
          roleId: superAdminRole.id,
          scopeJournalId: GLOBAL_SCOPE_ID,
        })
        .onConflictDoNothing();
    }
  }

  return {
    journal: defaultJournal,
    roles: seededRoles,
    adminUser,
    activationToken,
  };
}

if (
  (typeof require !== 'undefined' && require.main === module) ||
  (typeof process !== 'undefined' && process.argv[1]?.replace(/\\/g, '/').endsWith('seed.ts'))
) {
  const { createDbClient } = require('./client');
  const { db, client } = createDbClient();
  seedDatabase(db)
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('[SEED] Completed successfully.');
      client.end?.();
      process.exit(0);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[SEED] Error during seeding:', err);
      client.end?.();
      process.exit(1);
    });
}
