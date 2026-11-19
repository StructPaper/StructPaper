/**
 * Journal management against a REAL Postgres (migrations 0000-0004 applied).
 * Skipped unless TEST_DATABASE_URL points at a throwaway database, e.g.
 *   docker run -d --name sp-journal-test -e POSTGRES_USER=structpaper -e POSTGRES_PASSWORD=structpaper \
 *     -e POSTGRES_DB=structpaper -p 55432:5432 postgres:16-alpine   (+ citext, then `pnpm --filter @structpaper/db migrate`)
 *   TEST_DATABASE_URL=postgresql://structpaper:structpaper@localhost:55432/structpaper pnpm --filter api test journal-management
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDbClient, seedDatabase, profileVersions, journals, sql, eq } from '@structpaper/db';
import { resolveProfile } from '@structpaper/journal-profiles';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { JournalService } from '../../src/modules/journals/application/journal.service';
import { JournalAdminService } from '../../src/modules/journals/application/journal-admin.service';
import { ProfileService } from '../../src/modules/journals/application/profile.service';
import { lockTestDatabase } from './db-lock';
import { ProfileResolveService, parsePin } from '../../src/modules/journals/application/profile-resolve.service';

const url = process.env.TEST_DATABASE_URL;
/** These specs TRUNCATE tables: never let TEST_DATABASE_URL point anywhere but this machine. */
const assertThrowaway = (u?: string) => {
  if (u && !/^postgres(ql)?:\/\/[^/]*@(localhost|127\.0\.0\.1)[:/]/.test(u)) {
    throw new Error('TEST_DATABASE_URL must point at a throwaway database on localhost');
  }
};
assertThrowaway(url);

describe.skipIf(!url)('journal management (real database)', () => {
  let client: ReturnType<typeof createDbClient>['client'];
  let db: ReturnType<typeof createDbClient>['db'];
  let reads: JournalService;
  let profiles: ProfileService;
  let resolver: ProfileResolveService;
  let admin: JournalAdminService;
  let superAdmin: any;
  let author: any;
  let hsManager: any;

  let release: () => Promise<void>;

  beforeAll(async () => {
    release = await lockTestDatabase(url!);
    ({ db, client } = createDbClient(url!, { max: 4, onnotice: () => undefined }));
    await db.execute(sql`TRUNCATE profile_versions, journals RESTART IDENTITY CASCADE`);
    await seedDatabase(db);
    reads = new JournalService(db as any);
    profiles = new ProfileService(reads, db as any);
    resolver = new ProfileResolveService(reads, db as any);
    admin = new JournalAdminService(reads, profiles, db as any);
    await profiles.onModuleInit();
    const factory = new AbilityFactory();
    superAdmin = await factory.createForUser({ roles: ['SuperAdmin'] });
    author = await factory.createForUser({ roles: ['Author'] });
    const [hs] = await db.select().from(journals).where(eq(journals.slug, 'vnuhcm-hs'));
    hsManager = await factory.createForUser({ roles: [{ name: 'JournalManager', scopeJournalId: hs.id }] });
  });

  afterAll(async () => {
    await client?.end();
    await release?.();
  });

  it('gives every journal and the base a published version 1 on first start', async () => {
    const rows = await db.select().from(profileVersions);
    const journalCount = (await db.select().from(journals)).length;
    expect(rows.filter((r) => r.scopeType === 'base' && r.state === 'published')).toHaveLength(1);
    expect(rows.filter((r) => r.scopeType === 'journal' && r.state === 'published')).toHaveLength(journalCount);
    await profiles.onModuleInit(); // a second start adds nothing
    expect(await db.select().from(profileVersions)).toHaveLength(rows.length);
  });

  it('lists journals in the admins order, ARNS still a draft', async () => {
    const list = await reads.listJournals();
    expect(list.filter((j) => j.status !== 'archived').slice(0, 7).map((j) => j.slug)).toEqual(
      ['std', 'hs', 'ssh', 'ebl', 'et', 'ees', 'arns'].map((k) => `vnuhcm-${k}`),
    );
    expect(list.find((j) => j.slug === 'vnuhcm-arns')?.status).toBe('draft');
    expect(list.find((j) => j.slug === 'vnuhcm-et')?.color).toBe('#000000');
  });

  it('publishes every journal\'s rules with the journals table laid over them', async () => {
    const published = await resolver.getPublished();
    expect(Object.keys(published.base.config).length).toBeGreaterThan(5);
    expect(published.journals.hs.config.color).toBe('#2B74B7');
    expect(published.journals.et.config.names?.short).toBe('VNUHCM-ET');
  });

  describe('creating a journal', () => {
    it('only for those who may manage journals', async () => {
      await expect(admin.create({ key: 'nope', name: 'Không được', color: '#112233', status: 'draft' }, author)).rejects.toThrow(/may not create/);
      await expect(admin.create({ key: 'nope', name: 'Không được', color: '#112233', status: 'draft' }, hsManager)).rejects.toThrow(/may not create/);
    });

    it('creates it, publishes version 1 of its rules, and resolves it like any other journal', async () => {
      const created = await admin.create(
        { key: 'agr', name: 'Tạp chí Nông nghiệp', nameEn: 'Agriculture', shortName: 'AGR', issn: '2734-0001', color: '#228B22', status: 'published' },
        superAdmin,
      );
      expect(created.slug).toBe('vnuhcm-agr');
      expect(created.code).toBe('VNUHCM-AGR');
      expect(created.sortOrder).toBeGreaterThan(70);
      const versions = await profiles.listVersions('journal', 'agr');
      expect(versions.map((v) => [v.version, v.state])).toEqual([[1, 'published']]);

      const { profile, versions: used } = await resolver.resolve('agr', 'research');
      expect(profile.id).toBe('agr');
      expect(profile.color).toBe('#228B22');
      expect(profile.names.short).toBe('VNUHCM-AGR');
      expect(profile.layout.columns).toBe(resolveProfile('std').layout.columns); // base rules still apply
      expect(used.journal).toBe(1);
    });

    it('refuses a second journal with the same key', async () => {
      await expect(admin.create({ key: 'agr', name: 'Trùng khoá', color: '#112233', status: 'draft' }, superAdmin)).rejects.toThrow(/already exists/);
    });
  });

  describe('editing a journal', () => {
    it('a scoped manager edits their own journal, not another', async () => {
      const ok = await admin.update('hs', { name: 'Khoa học Sức khỏe (đổi tên)' }, undefined, hsManager);
      expect(ok.name).toBe('Khoa học Sức khỏe (đổi tên)');
      await expect(admin.update('et', { name: 'Sửa lén' }, undefined, hsManager)).rejects.toThrow(/may not edit/);
      await admin.update('hs', { name: 'Tạp chí Phát triển KH&CN - Khoa học Sức khỏe' }, undefined, superAdmin);
    });

    it('answers 412 when the version held is stale, and bumps the version when it matches', async () => {
      const current = await reads.getJournalById('ssh');
      await expect(admin.update('ssh', { color: '#0000EE' }, '"999"', superAdmin)).rejects.toMatchObject({ status: 412 });
      const saved = await admin.update('ssh', { color: '#0000EE' }, `"${current.version}"`, superAdmin);
      expect(saved.version).toBe(current.version + 1);
      await admin.update('ssh', { color: '#0000FF' }, undefined, superAdmin);
    });

    it('a new colour reaches the resolved profile without a new profile version', async () => {
      const before = await profiles.listVersions('journal', 'ees');
      await admin.update('ees', { color: '#123456' }, undefined, superAdmin);
      expect((await resolver.resolve('ees')).profile.color).toBe('#123456');
      expect(await profiles.listVersions('journal', 'ees')).toHaveLength(before.length);
      await admin.update('ees', { color: '#0C712F' }, undefined, superAdmin);
    });
  });

  describe('the life of a profile version', () => {
    const tweak = async () => {
      const pub = (await profiles.listVersions('journal', 'ebl')).find((v) => v.state === 'published')!;
      return { ...pub.config, layout: { ...(pub.config.layout || {}), columns: 3 } };
    };

    it('draft -> validate -> publish: the old one is archived and resolve follows', async () => {
      const draft = await profiles.createDraft('journal', 'ebl', { config: await tweak(), changeNote: 'three columns' }, superAdmin);
      expect(draft).toMatchObject({ version: 2, state: 'draft' });

      await expect(profiles.publish('journal', 'ebl', 2, {}, superAdmin)).rejects.toThrow(/validate the draft/);

      const result = await profiles.validate('journal', 'ebl', 2, superAdmin);
      expect(result.ok).toBe(true);
      expect(result.version.state).toBe('validated');

      const published = await profiles.publish('journal', 'ebl', 2, {}, superAdmin);
      expect(published.state).toBe('published');
      expect(published.publishedAt).toBeTruthy();

      const list = await profiles.listVersions('journal', 'ebl');
      expect(list.map((v) => [v.version, v.state])).toEqual([[2, 'published'], [1, 'archived']]);
      expect((await resolver.resolve('ebl')).profile.layout.columns).toBe(3);
    });

    it('a pinned paper keeps resolving to the version it was written under', async () => {
      const pinned = await resolver.resolve('ebl', undefined, parsePin('journal:1'));
      expect(pinned.profile.layout.columns).toBe(resolveProfile('ebl').layout.columns);
      expect(pinned.versions.journal).toBe(1);
      await expect(resolver.resolve('ebl', undefined, parsePin('journal:9'))).rejects.toMatchObject({ status: 404 });
    });

    it('an invalid draft stays a draft and says what is wrong', async () => {
      await profiles.createDraft('journal', 'ebl', { config: { id: 'ebl', typography: { fontSizes: 'big' } } }, superAdmin);
      const result = await profiles.validate('journal', 'ebl', 3, superAdmin);
      expect(result.ok).toBe(false);
      expect(result.issues.some((i) => i.path.startsWith('typography'))).toBe(true);
      expect(result.version.state).toBe('draft');
    });

    it('editing a validated draft sends it back to draft; a published one cannot be edited', async () => {
      await profiles.updateDraft('journal', 'ebl', 3, { config: await tweak() }, superAdmin);
      expect((await profiles.validate('journal', 'ebl', 3, superAdmin)).version.state).toBe('validated');
      const edited = await profiles.updateDraft('journal', 'ebl', 3, { changeNote: 'x', config: await tweak() }, superAdmin);
      expect(edited.state).toBe('draft');
      await expect(profiles.updateDraft('journal', 'ebl', 2, { changeNote: 'no' }, superAdmin)).rejects.toThrow(/can no longer be edited/);
    });

    it('rollback publishes a copy of an earlier version as a new one', async () => {
      const rolled = await profiles.rollback('journal', 'ebl', { toVersion: 1 }, superAdmin);
      expect(rolled.state).toBe('published');
      expect(rolled.version).toBe(4);
      expect(rolled.changeNote).toBe('Rollback to version 1');
      const list = await profiles.listVersions('journal', 'ebl');
      expect(list.find((v) => v.version === 2)?.state).toBe('archived');
      expect((await resolver.resolve('ebl')).profile.layout.columns).toBe(resolveProfile('ebl').layout.columns);
      await expect(profiles.rollback('journal', 'ebl', { toVersion: 3 }, superAdmin)).rejects.toThrow(/never published/);
    });

    it('is refused to those who may not edit that journal, and to non-admins on the base rules', async () => {
      await expect(profiles.createDraft('journal', 'ebl', { config: {} }, hsManager)).rejects.toThrow(/may not change/);
      await expect(profiles.createDraft('base', 'base', { config: {} }, hsManager)).rejects.toThrow(/may not change/);
      await expect(profiles.createDraft('journal', 'hs', { config: {} }, author)).rejects.toThrow(/may not change/);
    });
  });

  describe('the base rules', () => {
    it('go through the same life, and every journal follows the new base', async () => {
      const [pub] = await profiles.listVersions('base', 'base');
      const config = { ...pub.config, citation: { ...pub.config.citation, style: 'apa' } };
      await profiles.createDraft('base', 'base', { config }, superAdmin);
      expect((await profiles.validate('base', 'base', 2, superAdmin)).ok).toBe(true);
      await profiles.publish('base', 'base', 2, {}, superAdmin);
      expect((await resolver.resolve('std')).profile.citation.style).toBe('apa');
      expect((await resolver.resolve('hs')).profile.citation.style).toBe('apa');
      await profiles.rollback('base', 'base', { toVersion: 1 }, superAdmin);
    });
  });

  describe('the database keeps published history intact', () => {
    it('refuses to change the rules of a published or archived version, or to delete it', async () => {
      await expect(db.update(profileVersions).set({ config: { hacked: true } }).where(eq(profileVersions.state, 'published'))).rejects.toThrow();
      await expect(db.update(profileVersions).set({ config: { hacked: true } }).where(eq(profileVersions.state, 'archived'))).rejects.toThrow();
      await expect(db.delete(profileVersions).where(eq(profileVersions.state, 'published'))).rejects.toThrow();
    });

    it('allows only one published version per journal', async () => {
      const [row] = await db.select().from(profileVersions).where(eq(profileVersions.state, 'draft')).limit(1);
      await expect(db.update(profileVersions).set({ state: 'published' }).where(eq(profileVersions.id, row.id))).rejects.toThrow();
    });
  });
});
