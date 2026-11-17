import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { users, userTokens, userRoles } from '@structpaper/db';
import { TokenService } from '../../src/modules/identity/domain/token.service';
import { DevMailDriver } from '../../src/modules/identity/infrastructure/mail.service';
import { UserService, INVITATION_TTL_HOURS } from '../../src/modules/users/application/user.service';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';

/**
 * A chainable, awaitable stand-in for a drizzle query builder: any method returns the chain
 * itself and awaiting it resolves to `result`.
 */
function chain(result: any): any {
  const c: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (res: any, rej: any) => Promise.resolve(result).then(res, rej);
      return () => c;
    },
    apply: () => c,
  });
  return c;
}

interface Call {
  op: 'insert' | 'update' | 'delete';
  table: any;
  values?: any;
}

const ROLE_REVIEWER = { id: 'role-reviewer', name: 'Reviewer' };
const ROLE_SUPERADMIN = { id: 'role-superadmin', name: 'SuperAdmin' };

describe('UserService: invitations & user administration', () => {
  let tokenService: TokenService;
  let mailService: DevMailDriver;
  let abilityFactory: AbilityFactory;
  let service: UserService;
  let db: any;
  let selects: any[][];
  let calls: Call[];
  let findFirst: ReturnType<typeof vi.fn>;

  const superAdmin = async () => ({ ability: await abilityFactory.createForUser({ roles: ['SuperAdmin'] }) });
  const stdManager = async () => ({
    user: { id: 'manager-1' },
    ability: await abilityFactory.createForUser({
      roles: [{ name: 'JournalManager', scopeJournalId: 'j-std' }],
    }),
  });

  beforeEach(() => {
    tokenService = new TokenService(new JwtService({ secret: 'test-secret-key-1234567890-test' }));
    mailService = new DevMailDriver();
    abilityFactory = new AbilityFactory();
    selects = [];
    calls = [];
    findFirst = vi.fn().mockResolvedValue(null);

    db = {
      query: { users: { findFirst } },
      select: vi.fn(() => chain(selects.shift() ?? [])),
      insert: vi.fn((table: any) => ({
        values: (values: any) => {
          calls.push({ op: 'insert', table, values });
          return chain(table === users ? [{ id: 'new-user-id', ...values }] : []);
        },
      })),
      update: vi.fn((table: any) => ({
        set: (values: any) => {
          calls.push({ op: 'update', table, values });
          return chain([]);
        },
      })),
      delete: vi.fn((table: any) => {
        calls.push({ op: 'delete', table });
        return chain([]);
      }),
      transaction: vi.fn(async (fn: any) => fn(db)),
    };

    service = new UserService(db, tokenService, mailService);
    process.env.APP_URL = 'https://cheban.example.com/';
  });

  // ------------------------------ listing ------------------------------
  describe('listUsers', () => {
    it('returns users with their role assignments (journal names) and never a password hash', async () => {
      selects.push(
        [{ id: 'u1', email: 'a@x.org', passwordHash: 'secret-hash', status: 'ACTIVE', permissionsVersion: 2 }], // users
        [{ count: '1' }], // total
        [
          { userId: 'u1', roleName: 'JournalManager', scopeJournalId: 'j-std', journalName: 'Tạp chí STD' },
          { userId: 'u1', roleName: 'Author', scopeJournalId: '00000000-0000-0000-0000-000000000000', journalName: null },
        ], // roles
      );

      const res = await service.listUsers({ limit: 10, offset: 0 });

      expect(res.total).toBe(1);
      expect(res.items).toHaveLength(1);
      expect(res.items[0].passwordHash).toBeUndefined();
      expect(res.items[0].roles).toEqual([
        { roleName: 'JournalManager', scopeJournalId: 'j-std', scopeJournalName: 'Tạp chí STD' },
        // the GLOBAL scope id is reported as null (= whole system)
        { roleName: 'Author', scopeJournalId: null, scopeJournalName: null },
      ]);
    });

    it('clamps limit to 1..100 and offset to >= 0', async () => {
      selects.push([], [{ count: 0 }]);
      const res = await service.listUsers({ limit: 100000, offset: -5 });
      expect(res.limit).toBe(100);
      expect(res.offset).toBe(0);
    });

    it('returns an empty page when there is no database', async () => {
      const noDb = new UserService(undefined, tokenService, mailService);
      expect(await noDb.listUsers()).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
    });
  });

  // ------------------------------ inviteUser ------------------------------
  describe('inviteUser', () => {
    it('creates an INVITED user with the role, a hashed 72h token, and returns a fragment-based link', async () => {
      selects.push([ROLE_REVIEWER], []); // role lookup, no existing user

      const before = Date.now();
      const res = await service.inviteUser({ email: ' New.Person@Example.org ', role: 'Reviewer', displayName: 'New Person' });

      // user
      expect(res.user.email).toBe('new.person@example.org');
      expect(res.user.status).toBe('INVITED');
      expect(res.user.passwordHash).toBeUndefined();
      // role assignment (global scope)
      const roleInsert = calls.find((c) => c.op === 'insert' && c.table === userRoles);
      expect(roleInsert?.values).toMatchObject({ roleId: 'role-reviewer', scopeJournalId: '00000000-0000-0000-0000-000000000000' });
      // token is stored hashed, never raw
      const tokenInsert = calls.find((c) => c.op === 'insert' && c.table === userTokens)!;
      expect(tokenInsert.values.type).toBe('INVITATION');
      expect(tokenInsert.values.tokenHash).toBe(tokenService.hashToken(res.token));
      expect(JSON.stringify(tokenInsert.values)).not.toContain(res.token);
      // 72h expiry
      const ttlMs = new Date(res.expiresAt).getTime() - before;
      expect(ttlMs).toBeGreaterThan((INVITATION_TTL_HOURS - 0.01) * 3_600_000);
      expect(ttlMs).toBeLessThanOrEqual(INVITATION_TTL_HOURS * 3_600_000 + 5000);
      // link: token in the URL fragment, base URL normalised (no double slash)
      expect(res.activationUrl).toBe(`https://cheban.example.com/activate#token=${res.token}`);
      expect(res.activationUrl).not.toContain('?token=');
      // everything ran in one transaction
      expect(db.transaction).toHaveBeenCalledTimes(1);
      expect(mailService.getSentMails()).toHaveLength(1);
    });

    it('rejects an unknown role instead of silently inviting without one', async () => {
      selects.push([]); // role not found

      await expect(service.inviteUser({ email: 'a@x.org', role: 'Guest' })).rejects.toThrow(BadRequestException);
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('rejects an unknown journal', async () => {
      selects.push([ROLE_REVIEWER], []); // role ok, journal not found

      await expect(
        service.inviteUser({ email: 'a@x.org', role: 'Reviewer', journalId: 'no-such-journal' }),
      ).rejects.toThrow('Unknown journal');
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('rejects inviting someone who is already active', async () => {
      selects.push([ROLE_REVIEWER], [{ id: 'u1', email: 'a@x.org', status: 'ACTIVE' }]);

      await expect(service.inviteUser({ email: 'a@x.org', role: 'Reviewer' })).rejects.toThrow(ConflictException);
      expect(calls.some((c) => c.op === 'insert' && c.table === userTokens)).toBe(false);
    });

    it('a re-invite replaces the old roles and revokes the previous unused link', async () => {
      selects.push([ROLE_REVIEWER], [{ id: 'u-invited', email: 'a@x.org', status: 'INVITED' }]);

      await service.inviteUser({ email: 'a@x.org', role: 'Reviewer' });

      expect(calls.some((c) => c.op === 'delete' && c.table === userRoles)).toBe(true);
      const revoke = calls.find((c) => c.op === 'update' && c.table === userTokens);
      expect(revoke?.values.consumedAt).toBeInstanceOf(Date);
      // revoked BEFORE the new token is inserted
      expect(calls.indexOf(revoke!)).toBeLessThan(
        calls.findIndex((c) => c.op === 'insert' && c.table === userTokens),
      );
    });

    it('does not fail the invitation when sending the mail fails (the link is still returned)', async () => {
      selects.push([ROLE_REVIEWER], []);
      vi.spyOn(mailService, 'sendInvitation').mockRejectedValueOnce(new Error('smtp down'));

      const res = await service.inviteUser({ email: 'a@x.org', role: 'Reviewer' });
      expect(res.activationUrl).toContain('/activate#token=');
    });

    describe('anti privilege-escalation', () => {
      it('SuperAdmin may invite a SuperAdmin', async () => {
        selects.push([ROLE_SUPERADMIN], []);
        await expect(
          service.inviteUser({ email: 'root@x.org', role: 'SuperAdmin' }, await superAdmin()),
        ).resolves.toBeDefined();
      });

      it('a journal manager can NOT grant SuperAdmin', async () => {
        selects.push([ROLE_SUPERADMIN]);
        await expect(
          service.inviteUser({ email: 'root@x.org', role: 'SuperAdmin', journalId: 'j-std' }, await stdManager()),
        ).rejects.toThrow(ForbiddenException);
        expect(db.transaction).not.toHaveBeenCalled();
      });

      it('a journal manager can invite into THEIR journal', async () => {
        selects.push([ROLE_REVIEWER], [{ id: 'j-std' }], []); // role, journal, no existing user
        await expect(
          service.inviteUser({ email: 'r@x.org', role: 'Reviewer', journalId: 'j-std' }, await stdManager()),
        ).resolves.toBeDefined();
      });

      it('a journal manager can NOT invite into another journal', async () => {
        selects.push([ROLE_REVIEWER]);
        await expect(
          service.inviteUser({ email: 'r@x.org', role: 'Reviewer', journalId: 'j-other' }, await stdManager()),
        ).rejects.toThrow(ForbiddenException);
      });

      it('a journal-scoped manager can NOT grant a global (no journal) role', async () => {
        selects.push([ROLE_REVIEWER]);
        await expect(
          service.inviteUser({ email: 'r@x.org', role: 'Reviewer' }, await stdManager()),
        ).rejects.toThrow(ForbiddenException);
      });

      it('someone without role-management rights can not invite at all', async () => {
        selects.push([ROLE_REVIEWER]);
        const author = {
          user: { id: 'author-1' },
          ability: await abilityFactory.createForUser({ roles: ['Author'] }),
        };
        await expect(
          service.inviteUser({ email: 'r@x.org', role: 'Reviewer', journalId: 'j-std' }, author),
        ).rejects.toThrow(ForbiddenException);
      });
    });
  });

  // ------------------------- pending invitations -------------------------
  describe('listPendingInvitations', () => {
    it('lists the latest outstanding invitation per user, flags expired ones, and exposes no token', async () => {
      const now = Date.now();
      selects.push(
        [
          // newest first (the service orders by created_at desc)
          { userId: 'u1', email: 'a@x.org', displayName: 'A', invitedAt: new Date(now - 1000), expiresAt: new Date(now + 3_600_000) },
          { userId: 'u1', email: 'a@x.org', displayName: 'A', invitedAt: new Date(now - 9999), expiresAt: new Date(now - 5000) },
          { userId: 'u2', email: 'b@x.org', displayName: null, invitedAt: new Date(now - 90_000_000), expiresAt: new Date(now - 1000) },
        ],
        [{ userId: 'u1', roleName: 'Reviewer', scopeJournalId: 'j-std', journalName: 'Tạp chí STD' }],
      );

      const list = await service.listPendingInvitations();

      expect(list).toHaveLength(2); // u1 is not duplicated
      const u1 = list.find((i) => i.id === 'u1')!;
      expect(u1.status).toBe('PENDING'); // judged by the NEWEST token, not the older expired one
      expect(u1.roles).toEqual([{ roleName: 'Reviewer', scopeJournalId: 'j-std', scopeJournalName: 'Tạp chí STD' }]);
      expect(list.find((i) => i.id === 'u2')!.status).toBe('EXPIRED');
      expect(JSON.stringify(list)).not.toMatch(/token/i);
    });
  });

  // ------------------------------ resend / revoke ------------------------------
  describe('resendInvite', () => {
    it('issues a NEW link and revokes the previous one', async () => {
      findFirst.mockResolvedValue({ id: 'u1', email: 'a@x.org', status: 'INVITED', passwordHash: null });

      const res = await service.resendInvite('u1');

      expect(res.activationUrl).toContain('/activate#token=');
      const revoke = calls.find((c) => c.op === 'update' && c.table === userTokens);
      expect(revoke?.values.consumedAt).toBeInstanceOf(Date);
      const insert = calls.find((c) => c.op === 'insert' && c.table === userTokens)!;
      expect(insert.values.tokenHash).toBe(tokenService.hashToken(res.token));
    });

    it('refuses to resend for an already active user', async () => {
      findFirst.mockResolvedValue({ id: 'u1', email: 'a@x.org', status: 'ACTIVE' });
      await expect(service.resendInvite('u1')).rejects.toThrow(ConflictException);
    });

    it('404 for an unknown user', async () => {
      await expect(service.resendInvite('nope')).rejects.toThrow(NotFoundException);
    });

    it('a journal manager can not re-issue a link for an invitation outside their journal', async () => {
      findFirst.mockResolvedValue({ id: 'u1', email: 'a@x.org', status: 'INVITED' });
      selects.push([{ userId: 'u1', roleName: 'Reviewer', scopeJournalId: 'j-other', journalName: 'Other' }]);

      await expect(service.resendInvite('u1', await stdManager())).rejects.toThrow(ForbiddenException);
      expect(calls.some((c) => c.op === 'insert' && c.table === userTokens)).toBe(false);
    });
  });

  describe('revokeInvitation', () => {
    it('deletes the never-activated account (cascade removes its roles and tokens)', async () => {
      findFirst.mockResolvedValue({ id: 'u1', email: 'a@x.org', status: 'INVITED', passwordHash: null });

      const res = await service.revokeInvitation('u1');

      expect(res.success).toBe(true);
      expect(calls.some((c) => c.op === 'delete' && c.table === users)).toBe(true);
    });

    it('never deletes an active account', async () => {
      findFirst.mockResolvedValue({ id: 'u1', email: 'a@x.org', status: 'ACTIVE', passwordHash: 'hash' });

      await expect(service.revokeInvitation('u1')).rejects.toThrow(ConflictException);
      expect(calls.some((c) => c.op === 'delete')).toBe(false);
    });
  });

  // ------------------------------ updateUser guards ------------------------------
  describe('updateUser authorization', () => {
    beforeEach(() => {
      db.update = vi.fn(() => ({
        set: (values: any) => ({ where: () => ({ returning: () => Promise.resolve([{ id: 'target', ...values }]) }) }),
      }));
    });

    it('a journal manager can not suspend a SuperAdmin', async () => {
      findFirst.mockResolvedValue({ id: 'target', status: 'ACTIVE', permissionsVersion: 1 });
      selects.push([{ userId: 'target', roleName: 'SuperAdmin', scopeJournalId: null, journalName: null }]);

      await expect(
        service.updateUser('target', { status: 'SUSPENDED' }, undefined, await stdManager()),
      ).rejects.toThrow('Only SuperAdmin can modify a SuperAdmin account');
    });

    it('a journal manager can not change their own status', async () => {
      findFirst.mockResolvedValue({ id: 'manager-1', status: 'ACTIVE', permissionsVersion: 1 });

      await expect(
        service.updateUser('manager-1', { status: 'SUSPENDED' }, undefined, await stdManager()),
      ).rejects.toThrow('You cannot change your own account status');
    });

    it('even a SuperAdmin can NOT change their own status', async () => {
      findFirst.mockResolvedValue({ id: 'root-1', status: 'ACTIVE', permissionsVersion: 1 });
      const actor = { user: { id: 'root-1' }, ...(await superAdmin()) };

      await expect(service.updateUser('root-1', { status: 'SUSPENDED' }, undefined, actor)).rejects.toThrow(
        /cannot change your own account status/i,
      );
    });

    it('suspending the ONLY active SuperAdmin is refused (409) and nothing is updated', async () => {
      findFirst.mockResolvedValue({ id: 'root-2', status: 'ACTIVE', permissionsVersion: 1 });
      // the locked "active SuperAdmins" query: root-2 is the only one
      selects.push([{ id: 'root-2' }]);
      const updateSpy = vi.fn();
      db.update = vi.fn(() => ({
        set: (v: any) => {
          updateSpy(v);
          return { where: () => ({ returning: () => Promise.resolve([]) }) };
        },
      }));
      const actor = { user: { id: 'root-1' }, ...(await superAdmin()) };

      await expect(service.updateUser('root-2', { status: 'SUSPENDED' }, undefined, actor)).rejects.toThrow(
        /At least one active SuperAdmin must remain/i,
      );
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('suspending a SuperAdmin is allowed while another active SuperAdmin remains, inside one transaction', async () => {
      findFirst.mockResolvedValue({ id: 'root-2', status: 'ACTIVE', permissionsVersion: 1 });
      selects.push([{ id: 'root-2' }, { id: 'root-1' }]);
      const actor = { user: { id: 'root-1' }, ...(await superAdmin()) };

      const updated = await service.updateUser('root-2', { status: 'SUSPENDED' }, undefined, actor);

      expect(updated.status).toBe('SUSPENDED');
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('reactivating or renaming never triggers the last-SuperAdmin lock', async () => {
      findFirst.mockResolvedValue({ id: 'u-9', status: 'SUSPENDED', permissionsVersion: 1 });
      const actor = { user: { id: 'root-1' }, ...(await superAdmin()) };

      await service.updateUser('u-9', { status: 'ACTIVE' }, undefined, actor);
      await service.updateUser('u-9', { displayName: 'New' }, undefined, actor);

      expect(db.transaction).not.toHaveBeenCalled();
    });

    it('a journal manager can still rename a normal user', async () => {
      findFirst.mockResolvedValue({ id: 'target', status: 'ACTIVE', permissionsVersion: 1 });
      selects.push([{ userId: 'target', roleName: 'Author', scopeJournalId: null, journalName: null }]);

      const updated = await service.updateUser('target', { displayName: 'Renamed' }, undefined, await stdManager());
      expect(updated.displayName).toBe('Renamed');
    });
  });

  // ------------------------------ lockReason (UI hints) ------------------------------
  describe('listUsers lockReason', () => {
    const rowsFor = () => {
      selects.push(
        [
          { id: 'me', email: 'me@x.org', status: 'ACTIVE', passwordHash: 'h' },
          { id: 'boss', email: 'boss@x.org', status: 'ACTIVE', passwordHash: 'h' },
          { id: 'plain', email: 'plain@x.org', status: 'ACTIVE', passwordHash: 'h' },
        ],
        [{ count: 3 }],
        [
          { userId: 'me', roleName: 'JournalManager', scopeJournalId: 'j-std', journalName: 'STD' },
          { userId: 'boss', roleName: 'SuperAdmin', scopeJournalId: '00000000-0000-0000-0000-000000000000', journalName: null },
          { userId: 'plain', roleName: 'Author', scopeJournalId: '00000000-0000-0000-0000-000000000000', journalName: null },
        ],
      );
    };
    const byId = (items: any[], id: string) => items.find((u) => u.id === id);

    it('marks the viewer as SELF and SuperAdmin rows as REQUIRES_SUPERADMIN for a role manager', async () => {
      rowsFor();
      const manager = { user: { id: 'me' }, ability: (await stdManager()).ability };

      const { items } = await service.listUsers({}, manager);

      expect(byId(items, 'me').lockReason).toBe('SELF');
      expect(byId(items, 'boss').lockReason).toBe('REQUIRES_SUPERADMIN');
      expect(byId(items, 'plain').lockReason).toBeNull();
    });

    it('a SuperAdmin can edit everybody except themselves', async () => {
      rowsFor();
      const root = { user: { id: 'boss' }, ability: (await superAdmin()).ability };

      const { items } = await service.listUsers({}, root);

      expect(byId(items, 'boss').lockReason).toBe('SELF');
      expect(byId(items, 'me').lockReason).toBeNull();
      expect(byId(items, 'plain').lockReason).toBeNull();
    });

    it('SELF wins over REQUIRES_SUPERADMIN on the viewer own row', async () => {
      rowsFor();
      const manager = { user: { id: 'boss' }, ability: (await stdManager()).ability };

      const { items } = await service.listUsers({}, manager);

      expect(byId(items, 'boss').lockReason).toBe('SELF');
    });

    it('reports no lock when there is no viewer context (internal call)', async () => {
      rowsFor();

      const { items } = await service.listUsers({});

      expect(items.every((u) => u.lockReason === null)).toBe(true);
    });
  });
});
