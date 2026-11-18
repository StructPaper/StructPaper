/**
 * Article types and profile pinning against a REAL Postgres (the squashed migration applied).
 * Skipped unless TEST_DATABASE_URL points at a throwaway database on localhost (see journal-management.integration.spec.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDbClient, seedDatabase, journals, users, articleTypes, profileVersions, manuscripts, manuscriptProfileSnapshots, auditLogs, sql, eq, asc } from '@structpaper/db';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { JournalService } from '../../src/modules/journals/application/journal.service';
import { ProfileService } from '../../src/modules/journals/application/profile.service';
import { ArticleTypeService } from '../../src/modules/journals/application/article-type.service';
import { ProfileResolveService, parsePin } from '../../src/modules/journals/application/profile-resolve.service';
import { ManuscriptService } from '../../src/modules/manuscripts/application/manuscript.service';
import { ProfileBulkService } from '../../src/modules/journals/application/profile-bulk.service';
import { PasswordService } from '../../src/modules/identity/domain/password.service';
import { lockTestDatabase } from './db-lock';

const url = process.env.TEST_DATABASE_URL;
/** These specs TRUNCATE tables: never let TEST_DATABASE_URL point anywhere but this machine. */
const assertThrowaway = (u?: string) => {
  if (u && !/^postgres(ql)?:\/\/[^/]*@(localhost|127\.0\.0\.1)[:/]/.test(u)) {
    throw new Error('TEST_DATABASE_URL must point at a throwaway database on localhost');
  }
};
assertThrowaway(url);

describe.skipIf(!url)('article types and profile pinning (real database)', () => {
  let client: ReturnType<typeof createDbClient>['client'];
  let db: ReturnType<typeof createDbClient>['db'];
  let release: () => Promise<void>;
  let reads: JournalService;
  let profiles: ProfileService;
  let types: ArticleTypeService;
  let resolver: ProfileResolveService;
  let papers: ManuscriptService;
  let bulk: ProfileBulkService;
  let adminId: string;
  let superAdmin: any;
  let author: any;
  let hsManager: any;
  let ownerId: string;

  beforeAll(async () => {
    release = await lockTestDatabase(url!);
    ({ db, client } = createDbClient(url!, { max: 4, onnotice: () => undefined }));
    await db.execute(sql`TRUNCATE profile_versions, article_types, journals, users RESTART IDENTITY CASCADE`);
    await seedDatabase(db);
    reads = new JournalService(db as any);
    profiles = new ProfileService(reads, db as any);
    types = new ArticleTypeService(reads, profiles, db as any);
    resolver = new ProfileResolveService(reads, db as any);
    papers = new ManuscriptService(db as any, resolver);
    const passwords = new PasswordService();
    bulk = new ProfileBulkService(reads, resolver, passwords, db as any);
    await profiles.onModuleInit();

    const factory = new AbilityFactory();
    superAdmin = await factory.createForUser({ roles: ['SuperAdmin'] });
    author = await factory.createForUser({ roles: ['Author'] });
    const [hs] = await db.select().from(journals).where(eq(journals.slug, 'vnuhcm-hs'));
    hsManager = await factory.createForUser({ roles: [{ name: 'JournalManager', scopeJournalId: hs.id }] });
    const [owner] = await db.insert(users).values({ email: 'owner@test.dev', displayName: 'Owner', status: 'ACTIVE', passwordHash: 'x', permissionsVersion: 1 }).returning();
    ownerId = owner.id;
    const [admin] = await db.insert(users).values({ email: 'admin@test.dev', displayName: 'Admin', status: 'ACTIVE', passwordHash: await passwords.hash('right-pass'), permissionsVersion: 1 }).returning();
    adminId = admin.id;
  });

  afterAll(async () => {
    await client?.end();
    await release?.();
  });

  const typeVersions = async (code: string, journal = 'hs') => profiles.listVersions('article_type', `${journal}:${code}`);

  describe('article types', () => {
    it('are seeded per journal, each with published rules (version 1)', async () => {
      const hs = await types.list('hs');
      expect(hs.map((t) => t.code)).toEqual(['research', 'review', 'case-report']);
      expect(hs[0]).toMatchObject({ labels: { vi: 'Bài báo nghiên cứu', en: 'Research Article' } });
      expect(hs[0].requiredSections).toContain('heading.abstract');
      const all = await db.select().from(articleTypes);
      expect(all).toHaveLength(21);
      const published = await db.select().from(profileVersions).where(eq(profileVersions.scopeType, 'article_type'));
      expect(published.filter((v) => v.state === 'published')).toHaveLength(21);
    });

    it('the journal lists the codes it accepts, and the resolved profile lists them with their labels', async () => {
      expect((await reads.getJournalById('ssh')).articleTypes).toEqual(['research', 'review', 'editorial']);
      const { profile } = await resolver.resolve('ssh');
      expect(profile.articleTypes.map((t: any) => t.id)).toEqual(['research', 'review', 'editorial']);
      expect(profile.articleTypes[2].label.vi).toBe('Bài xã luận');
    });

    it('apply their own rules when a paper is of that type (an editorial has no abstract)', async () => {
      expect((await resolver.resolve('ssh', 'editorial')).profile.frontMatter.abstract).toBeNull();
      expect((await resolver.resolve('ssh', 'research')).profile.frontMatter.abstract).not.toBeNull();
    });

    it('a journal only accepts the types it has: others are a 400', async () => {
      await expect(resolver.resolve('hs', 'editorial')).rejects.toMatchObject({ status: 400 });
    });

    it('can be added by a manager of that journal, and start with published rules', async () => {
      const created = await types.create('hs', { code: 'letter', labels: { vi: 'Thư gửi tòa soạn', en: 'Letter' } }, hsManager);
      expect(created).toMatchObject({ code: 'letter', status: 'active', sortOrder: 40 });
      expect((await typeVersions('letter')).map((v) => [v.version, v.state])).toEqual([[1, 'published']]);
      expect((await resolver.resolve('hs', 'letter')).profile.frontMatter.abstract).toBeNull(); // the code's rules for a letter
      expect((await reads.getJournalById('hs')).articleTypes).toContain('letter');
    });

    it('refuses a duplicate code, a stranger, and a manager of another journal', async () => {
      await expect(types.create('hs', { code: 'letter', labels: { vi: 'x', en: 'x' } }, superAdmin)).rejects.toThrow(/already has/);
      await expect(types.create('hs', { code: 'zzz', labels: { vi: 'x', en: 'x' } }, author)).rejects.toThrow(/may not edit/);
      await expect(types.create('et', { code: 'zzz', labels: { vi: 'x', en: 'x' } }, hsManager)).rejects.toThrow(/may not edit/);
    });

    it('a type nobody wrote rules for starts from generic ones (abstract, body, references)', async () => {
      await types.create('hs', { code: 'protocol', labels: { vi: 'Đề cương', en: 'Protocol' } }, superAdmin);
      const [v1] = await typeVersions('protocol');
      expect(v1.config.requiredSections).toEqual(['heading.abstract', 'h1', 'heading.references']);
    });

    it('renaming or archiving needs no new rules version; an archived type still resolves for old papers', async () => {
      const before = (await typeVersions('review')).length;
      await types.update('hs', 'review', { labels: { vi: 'Tổng quan', en: 'Overview' } }, superAdmin);
      expect((await typeVersions('review')).length).toBe(before);
      expect((await resolver.resolve('hs', 'review')).profile.articleTypes.find((t: any) => t.id === 'review').label.en).toBe('Overview');

      await types.update('hs', 'review', { status: 'archived' }, superAdmin);
      expect((await reads.getJournalById('hs')).articleTypes).not.toContain('review');
      expect((await types.list('hs')).map((t) => t.code)).not.toContain('review');
      expect((await types.list('hs', true)).map((t) => t.code)).toContain('review');
      expect((await resolver.resolve('hs', 'review')).profile.articleType).toBe('review'); // old papers keep resolving
      await types.update('hs', 'review', { status: 'active', labels: { vi: 'Bài tổng quan', en: 'Review' } }, superAdmin);
    });

    it('their rules go through the same draft -> validate -> publish life, addressed as <journal>:<code>', async () => {
      const [pub] = await typeVersions('research');
      const draft = await profiles.createDraft('article_type', 'hs:research', { config: { ...pub.config, requiredSections: ['h1'] }, changeNote: 'lighter' }, superAdmin);
      expect(draft).toMatchObject({ version: 2, state: 'draft' });
      expect((await profiles.validate('article_type', 'hs:research', 2, superAdmin)).ok).toBe(true);
      await profiles.publish('article_type', 'hs:research', 2, {}, superAdmin);
      expect((await typeVersions('research')).map((v) => [v.version, v.state])).toEqual([[2, 'published'], [1, 'archived']]);
      expect((await resolver.resolve('hs', 'research')).versions.articleType).toBe(2);
      expect((await resolver.resolve('hs', 'research', parsePin('type:1'))).profile.requiredSections).toEqual(pub.config.requiredSections);
      await profiles.rollback('article_type', 'hs:research', { toVersion: 1 }, superAdmin);
    });

    it('an article type is addressed as <journal>:<code>; anything else is refused', async () => {
      await expect(profiles.listVersions('article_type', 'hs')).rejects.toThrow(/<journal>:<code>/);
      await expect(profiles.listVersions('article_type', 'hs:nope')).rejects.toThrow(/no article type/);
    });

    it('are part of what the server publishes, for every journal', async () => {
      const published = await resolver.getPublished();
      expect(Object.keys(published.articleTypes.hs)).toEqual(expect.arrayContaining(['research', 'review', 'case-report', 'letter']));
      expect(published.journals.hs.config.articleTypes.map((t: any) => t.id)).toContain('letter');
    });

    it('a journal created with article types gets rules for each', async () => {
      const { JournalAdminService } = await import('../../src/modules/journals/application/journal-admin.service');
      const admin = new JournalAdminService(reads, profiles, db as any);
      const created = await admin.create({ key: 'agr', name: 'Nông nghiệp', color: '#228B22', status: 'published', articleTypes: ['research', 'letter'] }, superAdmin);
      expect(created.articleTypes).toEqual(['research', 'letter']);
      expect((await typeVersions('letter', 'agr')).map((v) => v.state)).toEqual(['published']);
    });
  });

  describe('pinning a paper to the profile versions it was written under', () => {
    const newPaper = (extra: Record<string, unknown> = {}) =>
      papers.createManuscript({ journalId: 'vnuhcm-hs', title: 'A paper', metadata: {}, articleType: 'research', ...extra } as any, ownerId, superAdmin);

    it('a new paper is pinned to the published versions and keeps the rules it was resolved with', async () => {
      const paper = await newPaper();
      const [row] = await db.select().from(manuscripts).where(eq(manuscripts.id, paper.id));
      const pubJournal = (await profiles.listVersions('journal', 'hs')).find((v) => v.state === 'published')!;
      const pubType = (await typeVersions('research')).find((v) => v.state === 'published')!;
      expect(row.profilePin).toEqual({ base: 1, journal: pubJournal.version, articleType: pubType.version });
      expect(paper.articleType).toBe('research');

      const snapshots = await db.select().from(manuscriptProfileSnapshots).where(eq(manuscriptProfileSnapshots.manuscriptId, paper.id));
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]).toMatchObject({ reason: 'create', pin: row.profilePin });
      expect(snapshots[0].resolved.color).toBe('#2B74B7');
      expect(snapshots[0].hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('publishing new rules leaves an existing paper on the old version; the pin still resolves to the old rules', async () => {
      const paper = await newPaper();
      const pinned = (await db.select().from(manuscripts).where(eq(manuscripts.id, paper.id)))[0].profilePin as any;

      const current = (await profiles.listVersions('journal', 'hs')).find((v) => v.state === 'published')!;
      const draft = await profiles.createDraft('journal', 'hs', { config: { ...current.config, layout: { ...(current.config.layout || {}), columns: 1 } }, changeNote: 'one column' }, superAdmin);
      await profiles.validate('journal', 'hs', draft.version, superAdmin);
      await profiles.publish('journal', 'hs', draft.version, {}, superAdmin);

      const [after] = await db.select().from(manuscripts).where(eq(manuscripts.id, paper.id));
      expect(after.profilePin).toEqual(pinned); // unchanged: the paper does not move on its own
      expect((await resolver.resolve('hs', 'research')).profile.layout.columns).toBe(1);
      const old = await resolver.resolve('hs', 'research', { base: pinned.base, journal: pinned.journal, articleType: pinned.articleType });
      expect(old.profile.layout.columns).toBe(2);
      expect(old.versions.journal).toBe(pinned.journal);
    });

    it('a paper written now is pinned to the new version', async () => {
      const paper = await newPaper();
      const [row] = await db.select().from(manuscripts).where(eq(manuscripts.id, paper.id));
      expect((row.profilePin as any).journal).toBe(2);
    });

    it('upgrading moves a paper to the published versions, keeps a snapshot, and does nothing the second time', async () => {
      const old = (await db.select().from(manuscripts).orderBy(asc(manuscripts.createdAt)).limit(1))[0];
      expect((old.profilePin as any).journal).toBe(1);

      const result = await papers.upgradeProfile(old.id, superAdmin);
      expect(result).toMatchObject({ upgraded: true, profilePin: { journal: 2 } });
      const [after] = await db.select().from(manuscripts).where(eq(manuscripts.id, old.id));
      expect((after.profilePin as any).journal).toBe(2);
      expect(after.version).toBe(old.version); // the pin is the server's: a client's save in flight stays valid

      const snapshots = await db.select().from(manuscriptProfileSnapshots).where(eq(manuscriptProfileSnapshots.manuscriptId, old.id)).orderBy(asc(manuscriptProfileSnapshots.createdAt));
      expect(snapshots.map((s) => s.reason)).toEqual(['create', 'profile_upgrade']);
      expect(snapshots[1].resolved.layout.columns).toBe(1);

      expect(await papers.upgradeProfile(old.id, superAdmin)).toMatchObject({ upgraded: false });
      expect(await db.select().from(manuscriptProfileSnapshots).where(eq(manuscriptProfileSnapshots.manuscriptId, old.id))).toHaveLength(2);
    });

    it('only someone who may edit the paper can upgrade it', async () => {
      const paper = await newPaper();
      await expect(papers.upgradeProfile(paper.id, author)).rejects.toThrow(/permission/);
    });

    it('a client that laid the paper out with version 1 is honoured, and a version that does not exist is refused', async () => {
      const paper = await newPaper({ profilePin: { base: 1, journal: 1, articleType: 1 } });
      const [row] = await db.select().from(manuscripts).where(eq(manuscripts.id, paper.id));
      expect(row.profilePin).toEqual({ base: 1, journal: 1, articleType: 1 });
      await expect(newPaper({ profilePin: { base: 1, journal: 99 } })).rejects.toMatchObject({ status: 404 });
    });

    it('an article type the journal does not have is ignored: the paper is pinned without one', async () => {
      const paper = await newPaper({ articleType: 'galaxy' });
      const [row] = await db.select().from(manuscripts).where(eq(manuscripts.id, paper.id));
      expect(row.articleTypeId).toBeNull();
      expect(Object.keys(row.profilePin as object).sort()).toEqual(['base', 'journal']);
    });

    describe('changing the article type of a paper', () => {
      it('moves it to the new type\'s rules, keeps the base and journal pins, and keeps a snapshot', async () => {
        const paper = await newPaper({ articleType: 'research' });
        const [before] = await db.select().from(manuscripts).where(eq(manuscripts.id, paper.id));

        const result = await papers.changeArticleType(paper.id, 'case-report', superAdmin);
        expect(result).toMatchObject({ changed: true, articleType: 'case-report', version: before.version });
        expect(result.profilePin).toMatchObject({ base: (before.profilePin as any).base, journal: (before.profilePin as any).journal });
        const [after] = await db.select().from(manuscripts).where(eq(manuscripts.id, paper.id));
        expect(after.articleTypeId).not.toBe(before.articleTypeId);
        const type = (await db.select().from(articleTypes).where(eq(articleTypes.id, after.articleTypeId!)))[0];
        expect(type.code).toBe('case-report');

        const snapshots = await db.select().from(manuscriptProfileSnapshots).where(eq(manuscriptProfileSnapshots.manuscriptId, paper.id)).orderBy(asc(manuscriptProfileSnapshots.createdAt));
        expect(snapshots.map((s) => s.reason)).toEqual(['create', 'article_type_change']);
        expect(snapshots[1].resolved.articleType).toBe('case-report');
      });

      it('choosing the same type does nothing; choosing none removes the type but keeps the other pins', async () => {
        const paper = await newPaper({ articleType: 'research' });
        expect(await papers.changeArticleType(paper.id, 'research', superAdmin)).toMatchObject({ changed: false });
        const result = await papers.changeArticleType(paper.id, null, superAdmin);
        expect(result).toMatchObject({ changed: true, articleType: null });
        expect(Object.keys(result.profilePin).sort()).toEqual(['base', 'journal']);
        const [row] = await db.select().from(manuscripts).where(eq(manuscripts.id, paper.id));
        expect(row.articleTypeId).toBeNull();
      });

      it('refuses a type the journal does not have, an archived one, and someone who may not edit the paper', async () => {
        const paper = await newPaper({ articleType: 'research' });
        await expect(papers.changeArticleType(paper.id, 'galaxy', superAdmin)).rejects.toMatchObject({ status: 400 });
        await types.update('hs', 'case-report', { status: 'archived' }, superAdmin);
        await expect(papers.changeArticleType(paper.id, 'case-report', superAdmin)).rejects.toThrow(/no longer offered/);
        await types.update('hs', 'case-report', { status: 'active' }, superAdmin);
        await expect(papers.changeArticleType(paper.id, 'review', author)).rejects.toThrow(/permission/);
      });

      it('a paper that already has an archived type may keep it', async () => {
        const paper = await newPaper({ articleType: 'review' });
        await types.update('hs', 'review', { status: 'archived' }, superAdmin);
        expect(await papers.changeArticleType(paper.id, 'review', superAdmin)).toMatchObject({ changed: false });
        await types.update('hs', 'review', { status: 'active' }, superAdmin);
      });
    });

    it('listing and reading a paper carry its pin, article type and journal summary', async () => {
      const paper = await newPaper();
      const one = await papers.getManuscript(paper.id, superAdmin);
      expect(one).toMatchObject({ articleType: 'research', journal: { slug: 'vnuhcm-hs', code: 'VNUHCM-HS', color: '#2B74B7', shortName: 'HS' } });
      expect((one as any).profilePin.journal).toBeGreaterThan(0);
      const list = await papers.listManuscripts({ limit: 50 } as any, superAdmin, ownerId);
      expect(list.items.find((i: any) => i.id === paper.id)).toMatchObject({ articleType: 'research', journal: { code: 'VNUHCM-HS' } });
    });

    describe('moving every paper of the journal to the rules in force', () => {
      const hsPins = async () => (await db.select().from(manuscripts).where(sql`journal_id = (select id from journals where slug = 'vnuhcm-hs')`)).map((m) => ({ id: m.id, pin: m.profilePin as any, version: m.version }));

      it('refuses a wrong password and someone who may not edit the journal, and changes nothing', async () => {
        const old = await newPaper();
        const current = (await profiles.listVersions('journal', 'hs')).find((v) => v.state === 'published')!;
        const draft = await profiles.createDraft('journal', 'hs', { config: { ...current.config, layout: { ...(current.config.layout || {}), columns: 2 } }, changeNote: 'two columns again' }, superAdmin);
        await profiles.validate('journal', 'hs', draft.version, superAdmin);
        await profiles.publish('journal', 'hs', draft.version, {}, superAdmin);

        const before = await hsPins();
        await expect(bulk.applyToAllPapers('hs', 'wrong', superAdmin, adminId)).rejects.toMatchObject({ status: 403 });
        await expect(bulk.applyToAllPapers('hs', 'right-pass', author, adminId)).rejects.toThrow(/may not change/);
        await expect(bulk.applyToAllPapers('hs', 'right-pass', superAdmin, undefined)).rejects.toMatchObject({ status: 403 });
        expect(await hsPins()).toEqual(before);
        expect(before.find((p) => p.id === old.id)!.pin.journal).toBeLessThan(draft.version);
      });

      it('moves all of them with the right password, keeps a snapshot and an audit entry, and leaves the paper version alone', async () => {
        const before = await hsPins();
        const result = await bulk.applyToAllPapers('hs', 'right-pass', superAdmin, adminId);
        expect(result.updated).toBeGreaterThan(0);
        expect(result.updated + result.unchanged).toBe(before.length);

        const published = (await profiles.listVersions('journal', 'hs')).find((v) => v.state === 'published')!;
        const after = await hsPins();
        for (const paper of after) expect(paper.pin.journal).toBe(published.version);
        expect(after.map((p) => p.version)).toEqual(before.map((p) => p.version)); // a save in flight stays valid

        const reasons = (await db.select().from(manuscriptProfileSnapshots)).map((s) => s.reason);
        expect(reasons.filter((r) => r === 'profile_upgrade_all')).toHaveLength(result.updated);
        const audit = await db.select().from(auditLogs).where(eq(auditLogs.action, 'journal.apply_profile_to_papers'));
        expect(audit).toHaveLength(1);
        expect(audit[0]).toMatchObject({ userId: adminId, payload: { updated: result.updated } });
      });

      it('does nothing the second time, and a manager of another journal may not do it', async () => {
        expect(await bulk.applyToAllPapers('hs', 'right-pass', superAdmin, adminId)).toMatchObject({ updated: 0 });
        await expect(bulk.applyToAllPapers('hs', 'right-pass', await new AbilityFactory().createForUser({ roles: [{ name: 'JournalManager', scopeJournalId: (await db.select().from(journals).where(eq(journals.slug, 'vnuhcm-et')))[0].id }] }), adminId)).rejects.toThrow(/may not change/);
      });
    });
  });
});
