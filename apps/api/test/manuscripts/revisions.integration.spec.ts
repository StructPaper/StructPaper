/**
 * The history of a paper's content against a REAL Postgres (all migrations applied).
 * Skipped unless TEST_DATABASE_URL points at a throwaway database on localhost (see journal-management.integration.spec.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDbClient, seedDatabase, users, manuscripts, manuscriptRevisions, sql, eq, asc } from '@structpaper/db';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { JournalService } from '../../src/modules/journals/application/journal.service';
import { ProfileService } from '../../src/modules/journals/application/profile.service';
import { ProfileResolveService } from '../../src/modules/journals/application/profile-resolve.service';
import { ManuscriptService } from '../../src/modules/manuscripts/application/manuscript.service';
import { RevisionService, HISTORY_CONFIG, revisionsToDrop } from '../../src/modules/manuscripts/application/revision.service';
import { lockTestDatabase } from '../journals/db-lock';

const url = process.env.TEST_DATABASE_URL;
const assertThrowaway = (u?: string) => {
  if (u && !/^postgres(ql)?:\/\/[^/]*@(localhost|127\.0\.0\.1)[:/]/.test(u)) {
    throw new Error('TEST_DATABASE_URL must point at a throwaway database on localhost');
  }
};
assertThrowaway(url);

const MIN = 60_000;
const DAY = 24 * 3600_000;

const makeDoc = (text: string, extra: Record<string, any> = {}) => ({
  metadata: { title: 'Bài báo thử', journalId: 'VNUHCM-HS', authors: [], affiliations: [], keywords: [], dates: {}, ...(extra.metadata ?? {}) },
  sections: [
    { id: 's1', type: 'h1', title: 'Mở đầu', content: '' },
    { id: 's2', type: 'paragraph', content: text },
  ],
  references: [],
});

describe('revisionsToDrop (the pruning rules)', () => {
  const now = new Date('2026-11-19T12:00:00Z');
  const at = (ms: number) => new Date(now.getTime() - ms);
  const rev = (id: string, kind: string, age: number, pinned = false) => ({ id, kind, pinned, createdAt: at(age) });

  it('keeps everything from the last day and never touches pinned versions', () => {
    const rows = [rev('a', 'auto', 1 * MIN), rev('b', 'auto', 5 * 3600_000), rev('n', 'named', 400 * DAY, true)];
    expect(revisionsToDrop(rows, now)).toEqual([]);
  });

  it('thins automatic versions: one a day for a week, one a week for a month, one a month after', () => {
    const rows = [
      rev('d1a', 'auto', 2 * DAY + 1 * 3600_000),
      rev('d1b', 'auto', 2 * DAY + 3 * 3600_000), // same day as d1a: older one goes
      rev('w1', 'auto', 15 * DAY),
      rev('w2', 'auto', 16 * DAY), // same week as w1 (or the next): at least one of them stays
      rev('m1', 'auto', 100 * DAY),
      rev('m2', 'auto', 101 * DAY),
    ].sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime());
    const dropped = revisionsToDrop(rows, now);
    expect(dropped).toContain('d1b');
    expect(dropped).not.toContain('d1a');
    expect(dropped.filter((id) => id.startsWith('m'))).toHaveLength(1);
  });

  it('safety copies live 90 days, except the newest few', () => {
    const rows = Array.from({ length: 8 }, (_, i) => rev(`p${i}`, 'pre-risk', (100 + i) * DAY));
    const dropped = revisionsToDrop(rows, now);
    expect(dropped).toHaveLength(8 - HISTORY_CONFIG.safetyKeepLatest);
    expect(dropped).not.toContain('p0');
    expect(revisionsToDrop([rev('x', 'pre-risk', 10 * DAY)], now)).toEqual([]);
  });

  it('a paper keeps at most its budget of unpinned versions, dropping the oldest', () => {
    const rows = Array.from({ length: HISTORY_CONFIG.budgetRevisions + 5 }, (_, i) => rev(`r${i}`, 'restore', i * 1000));
    const dropped = revisionsToDrop(rows, now);
    expect(dropped).toHaveLength(5);
    expect(dropped).toContain(`r${HISTORY_CONFIG.budgetRevisions + 4}`);
  });
});

describe.skipIf(!url)('history of a paper (real database)', () => {
  let client: ReturnType<typeof createDbClient>['client'];
  let db: ReturnType<typeof createDbClient>['db'];
  let release: () => Promise<void>;
  let papers: ManuscriptService;
  let revisions: RevisionService;
  let superAdmin: any;
  let author: any;
  let ownerId: string;

  beforeAll(async () => {
    release = await lockTestDatabase(url!);
    ({ db, client } = createDbClient(url!, { max: 4, onnotice: () => undefined }));
    await db.execute(sql`TRUNCATE profile_versions, article_types, journals, users RESTART IDENTITY CASCADE`);
    await seedDatabase(db);
    const reads = new JournalService(db as any);
    const profiles = new ProfileService(reads, db as any);
    const resolver = new ProfileResolveService(reads, db as any);
    revisions = new RevisionService(db as any);
    papers = new ManuscriptService(db as any, resolver, revisions);
    await profiles.onModuleInit();
    const factory = new AbilityFactory();
    superAdmin = await factory.createForUser({ roles: ['SuperAdmin'] });
    author = await factory.createForUser({ roles: ['Author'] });
    const [owner] = await db.insert(users).values({ email: 'owner@test.dev', displayName: 'Chủ bài', status: 'ACTIVE', passwordHash: 'x', permissionsVersion: 1 }).returning();
    ownerId = owner.id;
  });

  afterAll(async () => {
    await client?.end();
    await release?.();
  });

  const newPaper = async (doc = makeDoc('Đoạn đầu tiên.')) => {
    const created = await papers.createManuscript({ journalId: 'vnuhcm-hs', title: 'Bài báo thử', metadata: { doc }, articleType: 'research' } as any, ownerId, superAdmin);
    return created.id as string;
  };
  const row = async (id: string) => (await db.select().from(manuscripts).where(eq(manuscripts.id, id)))[0];
  const revs = async (id: string) =>
    (await db.select().from(manuscriptRevisions).where(eq(manuscriptRevisions.manuscriptId, id)).orderBy(asc(manuscriptRevisions.createdAt))).filter((r) => r.kind !== 'sync');

  describe('automatic versions', () => {
    it('the first save after history began keeps what was there; quick saves in a row add nothing', async () => {
      const id = await newPaper();
      const t0 = new Date();
      await revisions.beforeSave(await row(id), { doc: makeDoc('Đoạn đầu tiên đã sửa.') }, ownerId, t0);
      let list = await revs(id);
      expect(list.map((r) => [r.kind, r.tagName])).toEqual([['auto', 'Phiên bản đầu']]);
      expect((list[0].snapshot as any).sections[1].content).toBe('Đoạn đầu tiên.');

      // the same content saved again, or another edit a moment later, is not a new version
      await revisions.beforeSave(await row(id), { doc: makeDoc('Đoạn đầu tiên.') }, ownerId, new Date(t0.getTime() + 1000));
      await revisions.beforeSave(await row(id), { doc: makeDoc('Sửa tiếp.') }, ownerId, new Date(t0.getTime() + 2000));
      expect(await revs(id)).toHaveLength(1);
    });

    it('a pause of five minutes ends a burst: the content before the new edit becomes a version', async () => {
      const id = await newPaper(makeDoc('Bản A.'));
      const t0 = new Date();
      await revisions.beforeSave(await row(id), { doc: makeDoc('Bản B.') }, ownerId, t0);
      // the saved content is now B (as the paper service would have written)
      await db.update(manuscripts).set({ metadata: { doc: makeDoc('Bản B.') }, updatedAt: t0 }).where(eq(manuscripts.id, id));
      await revisions.beforeSave(await row(id), { doc: makeDoc('Bản C.') }, ownerId, new Date(t0.getTime() + HISTORY_CONFIG.idleRevisionMs + 1000));
      const list = await revs(id);
      expect(list).toHaveLength(2);
      expect((list[1].snapshot as any).sections[1].content).toBe('Bản B.');
      expect(list[1].kind).toBe('auto');
      expect(list[1].stats).toMatchObject({ blocksModified: 1 });
    });

    it('long uninterrupted editing still takes a version every half hour', async () => {
      const id = await newPaper(makeDoc('v0'));
      const t0 = new Date();
      await revisions.beforeSave(await row(id), { doc: makeDoc('v1') }, ownerId, t0);
      await db.update(manuscripts).set({ metadata: { doc: makeDoc('v1') }, updatedAt: new Date(t0.getTime() + 30 * 60_000 - 1000) }).where(eq(manuscripts.id, id));
      await revisions.beforeSave(await row(id), { doc: makeDoc('v2') }, ownerId, new Date(t0.getTime() + 30 * 60_000 + 1000));
      expect(await revs(id)).toHaveLength(2);
    });

    it('moving the paper to another journal keeps a safety copy first', async () => {
      const id = await newPaper(makeDoc('Trước.'));
      const t0 = new Date();
      await revisions.beforeSave(await row(id), { doc: makeDoc('Trước.') }, ownerId, t0); // nothing changed: nothing taken
      expect(await revs(id)).toHaveLength(0);
      await revisions.beforeSave(await row(id), { doc: makeDoc('Trước.', { metadata: { journalId: 'VNUHCM-ET' } }) }, ownerId, new Date(t0.getTime() + 1000));
      const list = await revs(id);
      expect(list.map((r) => [r.kind, r.tagName])).toEqual(expect.arrayContaining([['pre-risk', 'Trước khi đổi tạp chí']]));
    });

    it('a status change keeps a named version for good, called after the stage', async () => {
      const id = await newPaper(makeDoc('Nộp bài.'));
      await papers.changeStatus(id, { status: 'SUBMITTED' } as any, ownerId, superAdmin);
      const list = await revs(id);
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ kind: 'named', tagName: 'Gửi duyệt', pinned: true });
    });
  });

  describe('safety copies', () => {
    it('another article type: a copy of the paper first, once, and relabelled when the newest version is the same text', async () => {
      const id = await newPaper(makeDoc('Loại bài.'));
      await papers.changeArticleType(id, 'case-report', superAdmin);
      let list = await revs(id);
      expect(list.map((r) => [r.kind, r.tagName])).toEqual([['pre-risk', 'Trước khi đổi loại bài']]);
      await papers.changeArticleType(id, 'research', superAdmin);
      list = await revs(id);
      expect(list).toHaveLength(1); // same content: not duplicated
    });

    it('newer rules for the paper: a copy labelled as an upgrade', async () => {
      const id = await newPaper(makeDoc('Nâng cấp.'));
      // a paper pinned before its article type had rules: the upgrade adds them, and keeps the paper first
      await db.update(manuscripts).set({ profilePin: { base: 1, journal: 1 } as any }).where(eq(manuscripts.id, id));
      expect(await papers.upgradeProfile(id, superAdmin)).toMatchObject({ upgraded: true });
      expect((await revs(id)).map((r) => [r.kind, r.tagName])).toEqual([['profile-upgrade', 'Trước khi nâng cấp quy tắc']]);
      // already on the newest rules: nothing is taken again
      expect(await papers.upgradeProfile(id, superAdmin)).toMatchObject({ upgraded: false });
      expect(await revs(id)).toHaveLength(1);
    });
  });

  describe('named versions, the list, and tidying', () => {
    it('keeps the paper under a name; lists, filters and pages the versions', async () => {
      const id = await newPaper(makeDoc('Bản gửi.'));
      const named = await revisions.createNamed(id, { name: 'Gửi lần 1', description: 'cho tòa soạn', kind: 'named' }, ownerId, superAdmin);
      expect(named).toMatchObject({ kind: 'named', name: 'Gửi lần 1', pinned: true, description: 'cho tòa soạn', author: { displayName: 'Chủ bài' } });
      await revisions.createNamed(id, { name: 'Trước khi nhập đè', kind: 'pre-risk' }, ownerId, superAdmin);

      const all = await revisions.list(id, { limit: 50 } as any, superAdmin);
      expect(all.items.map((i) => i.kind)).toEqual(['pre-risk', 'named']); // newest first
      expect((await revisions.list(id, { kind: 'named', limit: 50 } as any, superAdmin)).items).toHaveLength(1);

      const page1 = await revisions.list(id, { limit: 1 } as any, superAdmin);
      expect(page1.items).toHaveLength(1);
      expect(page1.nextBefore).toBeTruthy();
      const page2 = await revisions.list(id, { limit: 1, before: page1.nextBefore! } as any, superAdmin);
      expect(page2.items[0].id).toBe(named.id);
      expect(page2.nextBefore).toBeNull();
    });

    it('opens one version with the content it held', async () => {
      const id = await newPaper(makeDoc('Nội dung lúc đó.'));
      const created = await revisions.createNamed(id, { name: 'Mốc', kind: 'named' }, ownerId, superAdmin);
      const full = await revisions.get(id, created.id, superAdmin);
      expect((full.doc as any).sections[1].content).toBe('Nội dung lúc đó.');
    });

    it('naming an automatic version keeps it for good; only a named one can be deleted', async () => {
      const id = await newPaper(makeDoc('Tên.'));
      await revisions.beforeSave(await row(id), { doc: makeDoc('Tên khác.') }, ownerId, new Date());
      const [auto] = await revs(id);
      expect(auto.pinned).toBe(false);
      await expect(revisions.remove(id, auto.id, superAdmin)).rejects.toThrow(/Only a named/);
      const renamed = await revisions.update(id, auto.id, { name: 'Bản đầu của tôi' }, superAdmin);
      expect(renamed).toMatchObject({ kind: 'named', pinned: true, name: 'Bản đầu của tôi' });
      expect(await revisions.remove(id, auto.id, superAdmin)).toEqual({ success: true });
      expect(await revs(id)).toHaveLength(0);
    });

    it('limits named versions, and refuses someone who may not see or change the paper', async () => {
      const id = await newPaper(makeDoc('Quyền.'));
      await expect(revisions.createNamed(id, { name: 'x', kind: 'named' }, ownerId, author)).rejects.toThrow(/may not change/);
      await expect(revisions.list(id, { limit: 10 } as any, author)).rejects.toThrow(/may not see/);
    });

    it('pruning removes what the rules say and keeps pinned versions', async () => {
      const id = await newPaper(makeDoc('Dọn.'));
      const old = new Date(Date.now() - 200 * DAY);
      for (let i = 0; i < 3; i++) {
        await db.insert(manuscriptRevisions).values({ manuscriptId: id, serverRev: 1, kind: 'auto', snapshot: makeDoc(`old ${i}`), checksum: `c${i}`, stats: {}, pinned: false, sizeBytes: 1, createdAt: new Date(old.getTime() + i * 3600_000) });
      }
      await db.insert(manuscriptRevisions).values({ manuscriptId: id, serverRev: 1, kind: 'named', tagName: 'giữ', snapshot: makeDoc('named'), checksum: 'n', stats: {}, pinned: true, sizeBytes: 1, createdAt: old });
      const dropped = await revisions.prune(id);
      expect(dropped).toBe(2); // three automatic ones in the same month bucket: one stays
      const left = await revs(id);
      expect(left.filter((r) => r.kind === 'named')).toHaveLength(1);
      expect(left.filter((r) => r.kind === 'auto')).toHaveLength(1);
    });
  });

  describe('restoring and copying', () => {
    it('puts the paper back, keeps the present state first, and records the restore as a version', async () => {
      const id = await newPaper(makeDoc('Bản cũ.'));
      const mark = await revisions.createNamed(id, { name: 'Bản tốt', kind: 'named' }, ownerId, superAdmin);
      // the author keeps writing
      await db.update(manuscripts).set({ metadata: { doc: makeDoc('Bản hỏng.') } }).where(eq(manuscripts.id, id));
      const before = await row(id);

      const result = await revisions.restore(id, mark.id, ownerId, superAdmin);
      expect(result.version).toBe(before.version + 1);
      expect(result.restoredAs).toMatchObject({ kind: 'restore', name: 'Khôi phục từ "Bản tốt"' });

      const after = await row(id);
      expect((after.metadata as any).doc.sections[1].content).toBe('Bản cũ.');
      expect(after.version).toBe(before.version + 1);

      const list = await revs(id);
      const safety = list.find((r) => r.kind === 'pre-risk')!;
      expect(safety.tagName).toBe('Trước khi khôi phục');
      expect((safety.snapshot as any).sections[1].content).toBe('Bản hỏng.'); // the restore can itself be undone
      expect(list.map((r) => r.kind)).toEqual(expect.arrayContaining(['named', 'pre-risk', 'restore']));
      // what the restore changed is measured against what it replaced
      expect(result.restoredAs.stats.blocksModified).toBe(1);
    });

    it('only someone who may change the paper can restore it', async () => {
      const id = await newPaper(makeDoc('x'));
      const mark = await revisions.createNamed(id, { name: 'm', kind: 'named' }, ownerId, superAdmin);
      await expect(revisions.restore(id, mark.id, ownerId, author)).rejects.toThrow(/may not change/);
    });

    it('a copy from a version is a new paper with that content; the original is untouched', async () => {
      const id = await newPaper(makeDoc('Nội dung gốc.'));
      const mark = await revisions.createNamed(id, { name: 'Mốc', kind: 'named' }, ownerId, superAdmin);
      await db.update(manuscripts).set({ metadata: { doc: makeDoc('Đã đổi.') } }).where(eq(manuscripts.id, id));

      const copy = await papers.duplicateFromRevision(id, mark.id, ownerId, superAdmin);
      expect(copy.id).not.toBe(id);
      expect(copy.title).toContain('bản sao từ Mốc');
      const copyRow = await row(copy.id as string);
      expect((copyRow.metadata as any).doc.sections[1].content).toBe('Nội dung gốc.');
      expect(((await row(id)).metadata as any).doc.sections[1].content).toBe('Đã đổi.');
    });
  });

  // what the app really writes when it saves straight to the server: the paper's fields flat in metadata, no "doc" wrapper
  describe('a paper stored flat (the way the app saves it)', () => {
    const flat = (text: string, over: Record<string, any> = {}) => ({
      title: 'Bài báo phẳng', journalId: 'VNUHCM-HS', authors: [], affiliations: [], keywords: [], dates: {},
      displayName: 'Bản thảo phẳng', templateId: 'hs', templateName: 'HS',
      sections: [{ id: 's1', type: 'paragraph', content: text }],
      references: [],
      ...over,
    });
    const newFlat = async (text = 'Gốc.') => {
      const created = await papers.createManuscript({ journalId: 'vnuhcm-hs', title: 'Bài báo phẳng', metadata: flat(text), articleType: 'research' } as any, ownerId, superAdmin);
      return created.id as string;
    };

    it('can keep it under a name (it is not "empty")', async () => {
      const id = await newFlat('Nội dung phẳng.');
      const named = await revisions.createNamed(id, { name: 'Mốc phẳng', kind: 'named' }, ownerId, superAdmin);
      const full = await revisions.get(id, named.id, superAdmin);
      expect((full.doc as any).sections[0].content).toBe('Nội dung phẳng.');
      expect((full.doc as any).metadata.title).toBe('Bài báo phẳng');
      expect((full.doc as any).displayName).toBe('Bản thảo phẳng');
    });

    it('a save through the paper service takes the revisions: the first save, and a save after a pause', async () => {
      const id = await newFlat('A.');
      await papers.updateManuscript(id, { metadata: flat('B.') } as any, undefined, superAdmin, ownerId);
      let list = await revs(id);
      expect(list.map((r) => r.tagName)).toEqual(['Phiên bản đầu']);
      expect((list[0].snapshot as any).sections[0].content).toBe('A.');

      // the paper has been idle for ten minutes
      await db.update(manuscripts).set({ updatedAt: new Date(Date.now() - 10 * MIN) }).where(eq(manuscripts.id, id));
      await papers.updateManuscript(id, { metadata: flat('C.') } as any, undefined, superAdmin, ownerId);
      list = await revs(id);
      expect(list).toHaveLength(2);
      expect((list[1].snapshot as any).sections[0].content).toBe('B.');
    });

    it('restores in the same flat shape, so the app reads the restored paper', async () => {
      const id = await newFlat('Bản cũ.');
      const mark = await revisions.createNamed(id, { name: 'Bản tốt', kind: 'named' }, ownerId, superAdmin);
      await papers.updateManuscript(id, { metadata: flat('Bản hỏng.') } as any, undefined, superAdmin, ownerId);

      await revisions.restore(id, mark.id, ownerId, superAdmin);
      const stored = (await row(id)).metadata as any;
      expect(stored.doc).toBeUndefined();
      expect(stored.sections[0].content).toBe('Bản cũ.');
      expect(stored.title).toBe('Bài báo phẳng');
      expect(stored.templateId).toBe('hs');
      const safety = (await revs(id)).find((r) => r.tagName === 'Trước khi khôi phục')!;
      expect((safety.snapshot as any).sections[0].content).toBe('Bản hỏng.');
    });

    it('a copy of a flat paper is flat too', async () => {
      const id = await newFlat('Gốc để sao.');
      const mark = await revisions.createNamed(id, { name: 'Mốc', kind: 'named' }, ownerId, superAdmin);
      const copy = await papers.duplicateFromRevision(id, mark.id, ownerId, superAdmin);
      const stored = (await row(copy.id as string)).metadata as any;
      expect(stored.doc).toBeUndefined();
      expect(stored.sections[0].content).toBe('Gốc để sao.');
      expect(stored.title).toContain('bản sao từ Mốc');
    });
  });
});
