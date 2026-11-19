/**
 * The trash of deleted manuscripts against a REAL Postgres (all migrations applied).
 * Skipped unless TEST_DATABASE_URL points at a throwaway database on localhost (see journal-management.integration.spec.ts).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDbClient, seedDatabase, users, journals, manuscripts, manuscriptRevisions, auditLogs, sql, eq } from '@structpaper/db';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { JournalService } from '../../src/modules/journals/application/journal.service';
import { ProfileService } from '../../src/modules/journals/application/profile.service';
import { ProfileResolveService } from '../../src/modules/journals/application/profile-resolve.service';
import { ManuscriptService } from '../../src/modules/manuscripts/application/manuscript.service';
import { RevisionService } from '../../src/modules/manuscripts/application/revision.service';
import { TrashService, daysLeftInTrash, trashRetentionDays, mayRestore, mayPurge } from '../../src/modules/manuscripts/application/trash.service';
import { lockTestDatabase } from '../journals/db-lock';

const url = process.env.TEST_DATABASE_URL;
const assertThrowaway = (u?: string) => {
  if (u && !/^postgres(ql)?:\/\/[^/]*@(localhost|127\.0\.0\.1)[:/]/.test(u)) {
    throw new Error('TEST_DATABASE_URL must point at a throwaway database on localhost');
  }
};
assertThrowaway(url);

const DAY = 24 * 3600_000;

describe('how long a paper stays in the trash', () => {
  it('is 30 days unless configured, and counts whole days left', () => {
    expect(trashRetentionDays({} as any)).toBe(30);
    expect(trashRetentionDays({ TRASH_RETENTION_DAYS: '7' } as any)).toBe(7);
    expect(trashRetentionDays({ TRASH_RETENTION_DAYS: 'abc' } as any)).toBe(30);
    expect(trashRetentionDays({ TRASH_RETENTION_DAYS: '0' } as any)).toBe(30);
    const now = new Date('2026-11-19T12:00:00Z');
    expect(daysLeftInTrash(new Date(now.getTime() - 1 * DAY), now, 30)).toBe(29);
    expect(daysLeftInTrash(new Date(now.getTime() - 29.5 * DAY), now, 30)).toBe(1);
    expect(daysLeftInTrash(new Date(now.getTime() - 40 * DAY), now, 30)).toBe(0);
    expect(daysLeftInTrash(now, now, 30)).toBe(30);
  });
});

describe.skipIf(!url)('the trash (real database)', () => {
  let client: ReturnType<typeof createDbClient>['client'];
  let db: ReturnType<typeof createDbClient>['db'];
  let release: () => Promise<void>;
  let papers: ManuscriptService;
  let revisions: RevisionService;
  let trash: TrashService;
  let superAdmin: any;
  let hsManager: any;
  let etManager: any;
  let ownerAbility: any;
  let ownerId: string;
  let otherAbility: any;
  let otherId: string;

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
    trash = new TrashService(db as any);
    await profiles.onModuleInit();

    const factory = new AbilityFactory();
    const [hs] = await db.select().from(journals).where(eq(journals.slug, 'vnuhcm-hs'));
    const [et] = await db.select().from(journals).where(eq(journals.slug, 'vnuhcm-et'));
    superAdmin = await factory.createForUser({ roles: ['SuperAdmin'] });
    hsManager = await factory.createForUser({ roles: [{ name: 'JournalManager', scopeJournalId: hs.id }] });
    etManager = await factory.createForUser({ roles: [{ name: 'JournalManager', scopeJournalId: et.id }] });
    const [owner] = await db.insert(users).values({ email: 'owner@test.dev', displayName: 'Chủ bài', status: 'ACTIVE', passwordHash: 'x', permissionsVersion: 1 }).returning();
    ownerId = owner.id;
    ownerAbility = await factory.createForUser({ roles: ['Author'], userId: ownerId });
    const [other] = await db.insert(users).values({ email: 'other@test.dev', displayName: 'Người khác', status: 'ACTIVE', passwordHash: 'x', permissionsVersion: 1 }).returning();
    otherId = other.id;
    otherAbility = await factory.createForUser({ roles: ['Author'], userId: otherId });
  });

  afterAll(async () => {
    await client?.end();
    await release?.();
  });

  const newPaper = async (title = 'Bài sẽ xóa') => {
    const doc = { metadata: { title, journalId: 'VNUHCM-HS', authors: [], affiliations: [], keywords: [], dates: {} }, sections: [{ id: 's1', type: 'paragraph', content: 'Nội dung.' }], references: [] };
    const created = await papers.createManuscript({ journalId: 'vnuhcm-hs', title, metadata: { doc }, articleType: 'research' } as any, ownerId, superAdmin);
    return created.id as string;
  };
  const row = async (id: string) => (await db.select().from(manuscripts).where(eq(manuscripts.id, id)))[0];
  const listIds = async () => (await papers.listManuscripts({ limit: 100, sortBy: 'updatedAt', sortOrder: 'desc' } as any, superAdmin, ownerId)).items.map((i: any) => i.id);

  describe('deleting', () => {
    it('sends the paper to the trash: it is not deleted, but it is gone from every list and lookup', async () => {
      const id = await newPaper();
      expect(await listIds()).toContain(id);

      const result = await papers.deleteManuscript(id, ownerAbility, ownerId);
      expect(result).toEqual({ success: true, movedToTrash: true });

      const stored = await row(id);
      expect(stored).toBeTruthy();
      expect(stored.deletedAt).toBeInstanceOf(Date);
      expect(stored.deletedBy).toBe(ownerId);

      expect(await listIds()).not.toContain(id);
      await expect(papers.getManuscript(id, superAdmin)).rejects.toMatchObject({ status: 404 });
      await expect(papers.updateManuscript(id, { title: 'x' } as any, undefined, superAdmin, ownerId)).rejects.toMatchObject({ status: 404 });
      await expect(revisions.list(id, { limit: 10 } as any, superAdmin)).rejects.toMatchObject({ status: 404 });
      const audit = await db.select().from(auditLogs).where(eq(auditLogs.resourceId, id));
      expect(audit.map((a) => a.action)).toContain('manuscript.trash');
    });

    it('keeps the rules about who may delete: a paper already in review cannot be deleted by its owner', async () => {
      const id = await newPaper('Đang phản biện');
      await db.update(manuscripts).set({ status: 'IN_REVIEW' }).where(eq(manuscripts.id, id));
      await expect(papers.deleteManuscript(id, ownerAbility, ownerId)).rejects.toThrow(/không thể xóa/);
      expect((await row(id)).deletedAt).toBeNull();
    });
  });

  describe('who sees what in the trash', () => {
    it('everybody has a trash: a person sees the papers they deleted themselves, and restores them', async () => {
      const id = await newPaper('Tự xóa tự khôi phục');
      await papers.deleteManuscript(id, ownerAbility, ownerId);

      const mine = await trash.list({ limit: 100 } as any, ownerAbility, ownerId);
      const item = mine.items.find((i) => i.id === id)!;
      expect(item).toMatchObject({ title: 'Tự xóa tự khôi phục', deletedBy: { displayName: 'Chủ bài' }, journal: { code: 'VNUHCM-HS' }, daysLeft: 30 });
      expect(item.access).toEqual({ canRestore: true, canPurge: true });
      expect(mine.retentionDays).toBe(30);

      await trash.restore(id, ownerAbility, ownerId);
      expect(await listIds()).toContain(id);
    });

    it('somebody else sees nothing of it, and cannot restore it or delete it for good', async () => {
      const id = await newPaper('Của người khác');
      await papers.deleteManuscript(id, ownerAbility, ownerId);

      expect((await trash.list({ limit: 100 } as any, otherAbility, otherId)).items.map((i) => i.id)).not.toContain(id);
      await expect(trash.restore(id, otherAbility, otherId)).rejects.toMatchObject({ status: 403 });
      await expect(trash.purge(id, otherAbility, otherId)).rejects.toMatchObject({ status: 403 });
      expect((await row(id)).deletedAt).not.toBeNull();
    });

    it('the person who deleted a paper can delete it for good; so can a manager; nobody else', async () => {
      const mine = await newPaper('Tự xóa vĩnh viễn');
      await papers.deleteManuscript(mine, ownerAbility, ownerId);
      await expect(trash.purge(mine, otherAbility, otherId)).rejects.toMatchObject({ status: 403 });
      expect(await trash.purge(mine, ownerAbility, ownerId)).toEqual({ success: true });
      expect(await row(mine)).toBeUndefined();

      const theirs = await newPaper('Quản lý xóa vĩnh viễn');
      await papers.deleteManuscript(theirs, ownerAbility, ownerId);
      expect(await trash.purge(theirs, hsManager, 'someone')).toEqual({ success: true });
    });

    it('bulk: restores or empties what the caller may, skipping the rest', async () => {
      const a = await newPaper('Hàng loạt A');
      const b = await newPaper('Hàng loạt B');
      await papers.deleteManuscript(a, ownerAbility, ownerId);
      await papers.deleteManuscript(b, ownerAbility, ownerId);
      // somebody else can do nothing with them
      expect(await trash.bulk('purge', [a, b], otherAbility, otherId)).toEqual({ done: 0, skipped: 2 });
      expect(await trash.bulk('restore', [a], ownerAbility, ownerId)).toEqual({ done: 1, skipped: 0 });
      expect(await listIds()).toContain(a);
      // without ids: everything the caller sees
      const emptied = await trash.bulk('purge', undefined, ownerAbility, ownerId);
      expect(emptied.done).toBeGreaterThanOrEqual(1);
      expect(emptied.skipped).toBe(0);
      expect(await row(b)).toBeUndefined();
      expect(await row(a)).toBeTruthy();
    });

    it('SuperAdmin and the manager of the paper\'s journal see it with the right to restore and delete for good', async () => {
      const id = await newPaper('Quản lý thấy hết');
      await papers.deleteManuscript(id, ownerAbility, ownerId);

      const asAdmin = (await trash.list({ limit: 100 } as any, superAdmin, ownerId + '-x')).items.find((i) => i.id === id)!;
      expect(asAdmin.owner).toMatchObject({ displayName: 'Chủ bài' });
      expect(asAdmin.access).toEqual({ canRestore: true, canPurge: true });
      const asManager = (await trash.list({ limit: 100 } as any, hsManager, 'someone')).items.find((i) => i.id === id)!;
      expect(asManager.access).toEqual({ canRestore: true, canPurge: true });
    });

    it('a manager of another journal sees and restores only their own deletions there', async () => {
      const id = await newPaper('Của tạp chí HS');
      await papers.deleteManuscript(id, ownerAbility, ownerId);
      expect((await trash.list({ limit: 100 } as any, etManager, 'someone')).items.map((i) => i.id)).not.toContain(id);
      await expect(trash.restore(id, etManager, 'someone')).rejects.toMatchObject({ status: 403 });
      await expect(trash.purge(id, etManager, 'someone')).rejects.toMatchObject({ status: 403 });
      expect((await row(id)).deletedAt).not.toBeNull();
    });

    it('reading a deleted paper: who deleted it or a manager may; nobody else; not a paper that is not deleted', async () => {
      const id = await newPaper('Xem trước trong thùng rác');
      await expect(trash.preview(id, ownerAbility, ownerId)).rejects.toMatchObject({ status: 409 });
      await papers.deleteManuscript(id, ownerAbility, ownerId);

      const mine = await trash.preview(id, ownerAbility, ownerId);
      expect(mine).toMatchObject({ id, title: 'Xem trước trong thùng rác', daysLeft: 30 });
      expect(typeof mine.metadata).toBe('object');
      expect((await trash.preview(id, hsManager, 'someone')).id).toBe(id);
      await expect(trash.preview(id, otherAbility, otherId)).rejects.toMatchObject({ status: 403 });
      await expect(trash.preview(id, etManager, 'someone')).rejects.toMatchObject({ status: 403 });
    });

    it('searches the trash by title', async () => {
      const id = await newPaper('Tìm thấy duy nhất xyz');
      await papers.deleteManuscript(id, ownerAbility, ownerId);
      const found = await trash.list({ limit: 100, search: 'duy nhất xyz' } as any, ownerAbility, ownerId);
      expect(found.items.map((i) => i.id)).toEqual([id]);
      expect((await trash.list({ limit: 100, search: 'không có chữ này' } as any, ownerAbility, ownerId)).items).toEqual([]);
    });

    it('the rules alone: restore for who deleted it or manages it; delete for good only for managers', async () => {
      const row0 = { id: 'x', journalId: 'j', deletedBy: ownerId };
      expect(mayRestore(ownerAbility, row0, ownerId)).toBe(true);
      expect(mayRestore(otherAbility, row0, otherId)).toBe(false);
      expect(mayRestore(superAdmin, row0, 'anyone')).toBe(true);
      expect(mayPurge(ownerAbility, row0, ownerId)).toBe(true);
      expect(mayPurge(otherAbility, row0, otherId)).toBe(false);
      expect(mayPurge(superAdmin, row0, 'anyone')).toBe(true);
    });
  });

  describe('restoring', () => {
    it('brings the paper back with everything it had, including its history', async () => {
      const id = await newPaper('Khôi phục được');
      await revisions.createNamed(id, { name: 'Mốc trước khi xóa', kind: 'named' }, ownerId, superAdmin);
      await papers.deleteManuscript(id, ownerAbility, ownerId);
      expect(await listIds()).not.toContain(id);

      const restored = await trash.restore(id, hsManager, ownerId);
      expect(restored).toEqual({ id, title: 'Khôi phục được' });
      expect(await listIds()).toContain(id);
      const stored = await row(id);
      expect(stored.deletedAt).toBeNull();
      expect(stored.deletedBy).toBeNull();
      expect((await papers.getManuscript(id, ownerAbility)).title).toBe('Khôi phục được');
      expect((await revisions.list(id, { limit: 10 } as any, superAdmin)).items.map((r) => r.name)).toContain('Mốc trước khi xóa');
      expect((await trash.list({ limit: 100 } as any, superAdmin)).items.map((i) => i.id)).not.toContain(id);
      const actions = (await db.select().from(auditLogs).where(eq(auditLogs.resourceId, id))).map((a) => a.action);
      expect(actions).toEqual(expect.arrayContaining(['manuscript.trash', 'manuscript.restore']));
    });

    it('refuses a paper that is not in the trash, and one that does not exist', async () => {
      const id = await newPaper('Chưa xóa');
      await expect(trash.restore(id, superAdmin)).rejects.toMatchObject({ status: 409 });
      await expect(trash.restore('00000000-0000-4000-8000-000000000000', superAdmin)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('deleting for good', () => {
    it('removes the paper and its history for good', async () => {
      const id = await newPaper('Xóa vĩnh viễn');
      await revisions.createNamed(id, { name: 'Sẽ mất', kind: 'named' }, ownerId, superAdmin);
      await papers.deleteManuscript(id, ownerAbility, ownerId);

      expect(await trash.purge(id, hsManager, ownerId)).toEqual({ success: true });
      expect(await row(id)).toBeUndefined();
      expect(await db.select().from(manuscriptRevisions).where(eq(manuscriptRevisions.manuscriptId, id))).toHaveLength(0);
    });

    it('only a paper in the trash can be deleted for good', async () => {
      const id = await newPaper('Còn sống');
      await expect(trash.purge(id, superAdmin)).rejects.toMatchObject({ status: 409 });
      expect(await row(id)).toBeTruthy();
    });

    it('removes by itself what has been in the trash longer than the retention period, and nothing else', async () => {
      const old = await newPaper('Quá hạn');
      const recent = await newPaper('Còn hạn');
      const alive = await newPaper('Đang sống');
      await papers.deleteManuscript(old, ownerAbility, ownerId);
      await papers.deleteManuscript(recent, ownerAbility, ownerId);
      await db.update(manuscripts).set({ deletedAt: new Date(Date.now() - 31 * DAY) }).where(eq(manuscripts.id, old));
      await db.update(manuscripts).set({ deletedAt: new Date(Date.now() - 29 * DAY) }).where(eq(manuscripts.id, recent));

      const removed = await trash.purgeExpired();
      expect(removed).toBeGreaterThanOrEqual(1);
      expect(await row(old)).toBeUndefined();
      expect(await row(recent)).toBeTruthy();
      expect(await row(alive)).toBeTruthy();
      const item = (await trash.list({ limit: 100 } as any, superAdmin)).items.find((i) => i.id === recent)!;
      expect(item.daysLeft).toBe(1);
    });
  });
});
