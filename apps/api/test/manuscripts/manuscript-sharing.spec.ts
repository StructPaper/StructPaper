import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { users } from '@structpaper/db';
import { AbilityFactory, subject } from '../../src/modules/access/domain/ability.factory';
import { ManuscriptSharingService } from '../../src/modules/manuscripts/application/manuscript-sharing.service';
import { accessOf } from '../../src/modules/manuscripts/domain/manuscript-access';

const factory = new AbilityFactory();
const M = 'm-1';
const paper = (o: Record<string, any> = {}) =>
  subject('Manuscript', { id: M, journalId: 'j-1', createdBy: 'owner', status: 'DRAFT', generalAccess: 'RESTRICTED', ...o });

const as = (roles: any[], role?: string) =>
  factory.createForUser('u-1', {
    roles,
    manuscriptMemberships: role ? [{ manuscriptId: M, role }] : [],
  });

describe('Per-manuscript access (personas)', () => {
  it('Editor / Author without any membership see nothing of other people manuscripts', async () => {
    for (const role of ['Editor', 'Author']) {
      const a = await as([{ name: role }]);
      expect(a.can('read', paper())).toBe(false);
      expect(a.can('update', paper())).toBe(false);
      expect(a.can('share', paper())).toBe(false);
      expect(a.can('delete', paper())).toBe(false);
    }
  });

  it('owner reads, edits, shares and deletes (while the paper is still deletable)', async () => {
    const a = await as([{ name: 'Editor' }], 'OWNER');
    expect(accessOf(a, paper())).toEqual({ canEdit: true, canShare: true, canDelete: true });
    for (const status of ['SUBMITTED', 'REJECTED', 'ARCHIVED']) {
      expect(a.can('delete', paper({ status }))).toBe(true);
    }
  });

  it('owner can not delete once the paper is in review / production / published', async () => {
    const a = await as([{ name: 'Author' }], 'OWNER');
    for (const status of ['IN_REVIEW', 'PROOFING', 'READY', 'ACCEPTED', 'PUBLISHED']) {
      expect(accessOf(a, paper({ status })).canDelete).toBe(false);
    }
  });

  it('co-author and editor members can edit but not share or delete', async () => {
    for (const role of ['COAUTHOR', 'EDITOR']) {
      const a = await as([{ name: 'Editor' }], role);
      expect(accessOf(a, paper())).toEqual({ canEdit: true, canShare: false, canDelete: false });
    }
  });

  it('reviewer and viewer members can only read', async () => {
    for (const role of ['REVIEWER', 'VIEWER']) {
      const a = await as([{ name: 'Editor' }], role);
      expect(a.can('read', paper())).toBe(true);
      expect(accessOf(a, paper())).toEqual({ canEdit: false, canShare: false, canDelete: false });
    }
  });

  it('membership of one paper does not leak to another', async () => {
    const a = await as([{ name: 'Editor' }], 'OWNER');
    expect(a.can('read', paper({ id: 'other' }))).toBe(false);
  });

  it('general access VIEWER: everyone reads, nobody edits', async () => {
    const a = await as([{ name: 'Author' }]);
    expect(a.can('read', paper({ generalAccess: 'VIEWER' }))).toBe(true);
    expect(a.can('update', paper({ generalAccess: 'VIEWER' }))).toBe(false);
  });

  it('general access EDITOR: everyone reads and edits, but never shares or deletes', async () => {
    const a = await as([{ name: 'Author' }]);
    expect(accessOf(a, paper({ generalAccess: 'EDITOR' }))).toEqual({ canEdit: true, canShare: false, canDelete: false });
  });

  it('a guest (no account) reads only what is shared with anyone, and never edits', async () => {
    const guest = await factory.createForUser({ roles: [], manuscriptMemberships: [] });
    expect(guest.can('read', paper())).toBe(false);
    expect(guest.can('read', paper({ generalAccess: 'VIEWER' }))).toBe(true);
    expect(accessOf(guest, paper({ generalAccess: 'EDITOR' }))).toEqual({ canEdit: false, canShare: false, canDelete: false });
  });

  it('JournalManager and SuperAdmin oversee everything', async () => {
    for (const roles of [[{ name: 'JournalManager' }], [{ name: 'SuperAdmin' }]]) {
      const a = await as(roles);
      expect(accessOf(a, paper({ status: 'PUBLISHED' }))).toEqual({ canEdit: true, canShare: true, canDelete: true });
    }
  });
});

function fakeDb({ manuscript, targetUser }: { manuscript?: any; targetUser?: any }) {
  const upsert = vi.fn().mockResolvedValue(undefined);
  const del = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
  const db: any = {
    select: vi.fn(() => ({
      from: (table: any) => ({
        where: () => ({
          limit: async () => {
            const found = table === users ? targetUser : manuscript;
            return found ? [found] : [];
          },
        }),
      }),
    })),
    insert: () => ({ values: () => ({ onConflictDoUpdate: upsert }) }),
    delete: () => ({ where: del }),
    update: () => ({ set }),
  };
  return { db, upsert, del, set };
}

const row = { id: M, createdBy: 'owner', status: 'DRAFT', generalAccess: 'RESTRICTED', journalId: 'j-1' };

describe('ManuscriptSharingService', () => {
  it('a non-owner can not add members', async () => {
    const { db } = fakeDb({ manuscript: row });
    const svc = new ManuscriptSharingService(db);
    const coauthor = await as([{ name: 'Author' }], 'COAUTHOR');

    await expect(svc.addMember(M, { userId: 'x', role: 'VIEWER' }, coauthor)).rejects.toThrow(ForbiddenException);
  });

  it('the owner adds a member and the member ability cache is refreshed', async () => {
    const { db, upsert } = fakeDb({ manuscript: row, targetUser: { id: 'u-2', status: 'ACTIVE' } });
    const cache = { invalidate: vi.fn() } as any;
    const svc = new ManuscriptSharingService(db, cache);
    const owner = await as([{ name: 'Editor' }], 'OWNER');

    const res = await svc.addMember(M, { userId: 'u-2', role: 'COAUTHOR' }, owner);

    expect(res).toMatchObject({ manuscriptId: M, userId: 'u-2', role: 'COAUTHOR' });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(cache.invalidate).toHaveBeenCalledWith('u-2');
  });

  it('refuses to add an owner, the creator or a non-active user', async () => {
    const owner = await as([{ name: 'Editor' }], 'OWNER');
    const svc = new ManuscriptSharingService(fakeDb({ manuscript: row, targetUser: { id: 'u-2', status: 'ACTIVE' } }).db);
    await expect(svc.addMember(M, { userId: 'u-2', role: 'OWNER' }, owner)).rejects.toThrow(BadRequestException);
    await expect(svc.addMember(M, { userId: 'owner', role: 'VIEWER' }, owner)).rejects.toThrow(BadRequestException);

    const inactive = new ManuscriptSharingService(fakeDb({ manuscript: row, targetUser: { id: 'u-3', status: 'INVITED' } }).db);
    await expect(inactive.addMember(M, { userId: 'u-3', role: 'VIEWER' }, owner)).rejects.toThrow(NotFoundException);
  });

  it('the creator can not be removed; others can, by the owner only', async () => {
    const owner = await as([{ name: 'Editor' }], 'OWNER');
    const { db, del } = fakeDb({ manuscript: row });
    const svc = new ManuscriptSharingService(db);

    await expect(svc.removeMember(M, 'owner', owner)).rejects.toThrow(BadRequestException);
    await expect(svc.removeMember(M, 'u-2', await as([{ name: 'Author' }], 'EDITOR'))).rejects.toThrow(ForbiddenException);
    await expect(svc.removeMember(M, 'u-2', owner)).resolves.toEqual({ success: true });
    expect(del).toHaveBeenCalledTimes(1);
  });

  it('only the owner changes general access', async () => {
    const { db, set } = fakeDb({ manuscript: row });
    const svc = new ManuscriptSharingService(db);

    await expect(svc.setGeneralAccess(M, 'EDITOR', await as([{ name: 'Author' }], 'COAUTHOR'))).rejects.toThrow(ForbiddenException);
    await expect(svc.setGeneralAccess(M, 'VIEWER', await as([{ name: 'Author' }], 'OWNER'))).resolves.toEqual({ generalAccess: 'VIEWER' });
    expect(set).toHaveBeenCalledWith({ generalAccess: 'VIEWER' });
  });

  it('404 for an unknown manuscript', async () => {
    const svc = new ManuscriptSharingService(fakeDb({}).db);
    await expect(svc.getMembers('nope', await as([{ name: 'SuperAdmin' }]))).rejects.toThrow(NotFoundException);
  });
});
