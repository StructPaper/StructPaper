import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { journals, articleTypes } from './schema/journals';
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

/** What every article type is called. A journal accepts a subset of these; the rules of each type are versioned separately. */
export const ARTICLE_TYPE_LABELS: Record<string, { vi: string; en: string }> = {
  research: { vi: 'Bài báo nghiên cứu', en: 'Research Article' },
  review: { vi: 'Bài tổng quan', en: 'Review' },
  editorial: { vi: 'Bài xã luận', en: 'Editorial' },
  commentary: { vi: 'Bình luận & Ý kiến', en: 'Commentary' },
  letter: { vi: 'Thư gửi tòa soạn', en: 'Letter' },
  correction: { vi: 'Đính chính', en: 'Correction' },
  methodology: { vi: 'Phương pháp luận', en: 'Methodology' },
  'case-report': { vi: 'Báo cáo ca lâm sàng', en: 'Case Report' },
  'special-topic': { vi: 'Chuyên đề đặc biệt', en: 'Special Topic' },
};

export interface DefaultJournal {
  slug: string;
  code: string;
  name: string;
  nameEn: string;
  shortName: string;
  issn: string;
  color: string;
  latexCls: string;
  sortOrder: number;
  status: 'draft' | 'published';
  articleTypes: string[];
}

export const VNUHCM_DEFAULT_JOURNALS: DefaultJournal[] = [
  {
    slug: 'vnuhcm-std',
    code: 'VNUHCM-STD',
    name: 'Tạp chí Phát triển Khoa học và Công nghệ',
    nameEn: 'Science and Technology Development Journal',
    shortName: 'STD',
    issn: '1859-0128',
    color: '#000099',
    latexCls: 'structpaper-std.cls',
    sortOrder: 10,
    status: 'published',
    articleTypes: ['research', 'review', 'commentary'],
  },
  {
    slug: 'vnuhcm-hs',
    code: 'VNUHCM-HS',
    name: 'Tạp chí Phát triển KH&CN - Khoa học Sức khỏe',
    nameEn: 'Science & Technology Development Journal - Health Sciences',
    shortName: 'HS',
    issn: '2734-9276',
    color: '#2B74B7',
    latexCls: 'structpaper-hs.cls',
    sortOrder: 20,
    status: 'published',
    articleTypes: ['research', 'review', 'case-report'],
  },
  {
    slug: 'vnuhcm-ssh',
    code: 'VNUHCM-SSH',
    name: 'Tạp chí Phát triển KH&CN - Khoa học Xã hội và Nhân văn',
    nameEn: 'Science & Technology Development Journal - Social Sciences and Humanities',
    shortName: 'SSH',
    issn: '2588-1043',
    color: '#0000FF',
    latexCls: 'structpaper-ssh.cls',
    sortOrder: 30,
    status: 'published',
    articleTypes: ['research', 'review', 'editorial'],
  },
  {
    slug: 'vnuhcm-ebl',
    code: 'VNUHCM-EBL',
    name: 'Tạp chí Phát triển KH&CN - Kinh tế, Luật và Quản lý',
    nameEn: 'Science & Technology Development Journal - Economics, Business and Law',
    shortName: 'EBL',
    issn: '2588-1108',
    color: '#8F0B97',
    latexCls: 'structpaper-ebl.cls',
    sortOrder: 40,
    status: 'published',
    articleTypes: ['research', 'review', 'commentary'],
  },
  {
    slug: 'vnuhcm-et',
    code: 'VNUHCM-ET',
    name: 'Tạp chí Phát triển KH&CN - Kỹ thuật và Công nghệ',
    nameEn: 'Science & Technology Development Journal - Engineering and Technology',
    shortName: 'ET',
    issn: '2588-1205',
    // the ET sample PDF has no brand colour: title, headings and rules are plain black
    color: '#000000',
    latexCls: 'structpaper-et.cls',
    sortOrder: 50,
    status: 'published',
    articleTypes: ['research', 'review', 'methodology'],
  },
  {
    slug: 'vnuhcm-ees',
    code: 'VNUHCM-EES',
    name: 'Tạp chí Phát triển KH&CN - Môi trường & Khoa học Trái đất',
    nameEn: 'Science & Technology Development Journal - Environment and Earth Sciences',
    shortName: 'EES',
    issn: '2588-1329',
    color: '#0C712F',
    latexCls: 'structpaper-ees.cls',
    sortOrder: 60,
    status: 'published',
    articleTypes: ['research', 'review', 'special-topic'],
  },
  {
    slug: 'vnuhcm-arns',
    code: 'VNUHCM-ARNS',
    name: 'Tạp chí Phát triển KH&CN - Khoa học Tự nhiên',
    nameEn: 'Science & Technology Development Journal - Advanced Research in Natural Sciences',
    shortName: 'ARNS',
    issn: '2588-140X',
    color: '#FF0000',
    latexCls: 'structpaper-arns.cls',
    sortOrder: 70,
    // not offered to authors yet
    status: 'draft',
    articleTypes: ['research', 'review', 'letter'],
  },
];

export async function seedDatabase(db: any): Promise<SeedResult> {
  // 1. Seed the 7 canonical VNUHCM journals, each with the article types it accepts
  let defaultJournal: any = null;
  for (const jDef of VNUHCM_DEFAULT_JOURNALS) {
    let existing = await db.query.journals?.findFirst({
      where: eq(journals.slug, jDef.slug),
    });

    if (!existing) {
      const inserted = await db
        .insert(journals)
        .values({
          slug: jDef.slug,
          code: jDef.code,
          name: jDef.name,
          nameEn: jDef.nameEn,
          shortName: jDef.shortName,
          issn: jDef.issn,
          color: jDef.color,
          latexCls: jDef.latexCls,
          status: jDef.status,
          sortOrder: jDef.sortOrder,
          version: 1,
        })
        .returning();
      existing = inserted[0];
    }

    for (const [index, code] of jDef.articleTypes.entries()) {
      await db
        .insert(articleTypes)
        .values({ journalId: existing.id, code, labels: ARTICLE_TYPE_LABELS[code], sortOrder: (index + 1) * 10 })
        .onConflictDoNothing();
    }

    if (!defaultJournal || jDef.slug === 'vnuhcm-std') {
      defaultJournal = existing;
    }
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
