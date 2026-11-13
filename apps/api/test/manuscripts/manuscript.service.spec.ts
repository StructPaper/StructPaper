import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  PreconditionFailedException,
  ForbiddenException,
} from '@nestjs/common';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { ManuscriptService } from '../../src/modules/manuscripts/application/manuscript.service';
import type { CreateManuscript, ManuscriptQuery } from '@structpaper/contracts';

describe('Manuscripts CRUD, ACL & Concurrency Control (ManuscriptService)', () => {
  let manuscriptService: ManuscriptService;
  let abilityFactory: AbilityFactory;
  let mockDb: any;
  let dbData: {
    manuscripts: any[];
    manuscriptMembers: any[];
    manuscriptDocs: any[];
  };

  const mockJournalId = '11111111-1111-1111-1111-111111111111';
  const authorUserId = '22222222-2222-2222-2222-222222222222';
  const otherUserId = '33333333-3333-3333-3333-333333333333';
  const superAdminId = '99999999-9999-9999-9999-999999999999';

  function matchesRow(cond: any, row: any): boolean {
    if (!cond) return true;
    if (!cond.toQuery) return true;

    const { sql } = cond.toQuery({
      escapeName: (n: any) => n,
      escapeParam: (i: any, p: any) => String(p),
      casing: { getColumnCasing: (c: any) => c.name },
    });

    // Check ID in array: manuscripts.id in (m-1, m-2)
    const inMatch = sql.match(/manuscripts\.id in \(([^)]+)\)/);
    if (inMatch) {
      const ids = inMatch[1].split(',').map((s: string) => s.trim());
      if (!ids.includes(row.id)) return false;
    }

    // Check ID eq: manuscripts.id = xxx
    const idMatch = sql.match(/manuscripts\.id = ([^\s\)]+)/);
    if (idMatch) {
      if (row.id !== idMatch[1]) return false;
    }

    // Check Version eq: manuscripts.version = xxx
    const verMatch = sql.match(/manuscripts\.version = ([0-9]+)/);
    if (verMatch) {
      if (row.version !== Number(verMatch[1])) return false;
    }

    // Check search term in title or abstract
    const searchMatch = sql.match(/ilike %([^%]+)%/);
    if (searchMatch) {
      const term = searchMatch[1].toLowerCase();
      const titleMatch = row.title && row.title.toLowerCase().includes(term);
      const absMatch = row.abstract && row.abstract.toLowerCase().includes(term);
      if (!titleMatch && !absMatch) return false;
    }

    // Check cursor: manuscripts.updated_at < or >
    const cursorLtMatch = sql.match(/manuscripts\.updated_at < ([^\s\)]+)/);
    if (cursorLtMatch) {
      const cursorTime = new Date(cursorLtMatch[1]).getTime();
      const rowTime = new Date(row.updatedAt).getTime();
      if (rowTime >= cursorTime) return false;
    }

    return true;
  }

  beforeEach(() => {
    abilityFactory = new AbilityFactory();

    dbData = {
      manuscripts: [
        {
          id: 'm-1',
          journalId: mockJournalId,
          title: 'Paper on Quantum Physics',
          abstract: 'Exploring entanglement',
          status: 'DRAFT',
          createdBy: authorUserId,
          currentServerRev: 0,
          version: 1,
          metadata: {},
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
        {
          id: 'm-2',
          journalId: mockJournalId,
          title: 'Machine Learning in Neuroscience',
          abstract: 'Deep learning for fMRI',
          status: 'DRAFT',
          createdBy: otherUserId,
          currentServerRev: 0,
          version: 2,
          metadata: {},
          createdAt: new Date('2026-01-02T00:00:00Z'),
          updatedAt: new Date('2026-01-02T00:00:00Z'),
        },
        {
          id: 'm-3',
          journalId: mockJournalId,
          title: 'Astrophysics and Dark Matter',
          abstract: 'Galaxy rotational curves',
          status: 'SUBMITTED',
          createdBy: otherUserId,
          currentServerRev: 0,
          version: 1,
          metadata: {},
          createdAt: new Date('2026-01-03T00:00:00Z'),
          updatedAt: new Date('2026-01-03T00:00:00Z'),
        },
      ],
      manuscriptMembers: [
        { manuscriptId: 'm-1', userId: authorUserId, role: 'OWNER', createdAt: new Date() },
        { manuscriptId: 'm-2', userId: otherUserId, role: 'OWNER', createdAt: new Date() },
        { manuscriptId: 'm-2', userId: authorUserId, role: 'COAUTHOR', createdAt: new Date() },
        { manuscriptId: 'm-3', userId: otherUserId, role: 'OWNER', createdAt: new Date() },
      ],
      manuscriptDocs: [
        { manuscriptId: 'm-1', docTree: { type: 'doc', content: [] }, serverRev: 0, updatedAt: new Date() },
        { manuscriptId: 'm-2', docTree: { type: 'doc', content: [] }, serverRev: 0, updatedAt: new Date() },
        { manuscriptId: 'm-3', docTree: { type: 'doc', content: [] }, serverRev: 0, updatedAt: new Date() },
      ],
    };

    mockDb = {
      transaction: vi.fn().mockImplementation(async (callback: any) => {
        return callback(mockDb);
      }),
      insert: vi.fn().mockImplementation((table: any) => ({
        values: vi.fn().mockImplementation((val: any) => {
          const row = {
            ...val,
            id: val.id || `m-gen-${Date.now()}`,
            createdAt: val.createdAt || new Date(),
            updatedAt: val.updatedAt || new Date(),
          };
          if (val.currentServerRev !== undefined) {
            dbData.manuscripts.push(row);
          } else if (val.role !== undefined) {
            dbData.manuscriptMembers.push(row);
          } else if (val.docTree !== undefined) {
            dbData.manuscriptDocs.push(row);
          }
          return {
            returning: vi.fn().mockResolvedValue([row]),
            onConflictDoNothing: vi.fn().mockResolvedValue([row]),
          };
        }),
      })),
      select: vi.fn().mockImplementation((fields?: any) => {
        let whereCond: any = null;
        let limitVal: number | undefined;
        let offsetVal: number | undefined;

        const builder: any = {
          from: vi.fn().mockImplementation(() => builder),
          where: vi.fn().mockImplementation((cond: any) => {
            whereCond = cond;
            return builder;
          }),
          orderBy: vi.fn().mockImplementation(() => builder),
          limit: vi.fn().mockImplementation((n: number) => {
            limitVal = n;
            return builder;
          }),
          offset: vi.fn().mockImplementation((n: number) => {
            offsetVal = n;
            return builder;
          }),
          then: (resolve: any, reject?: any) => {
            try {
              let rows = [...dbData.manuscripts];
              if (whereCond) {
                rows = rows.filter((r) => matchesRow(whereCond, r));
              }
              if (fields && fields.count) {
                return resolve([{ count: rows.length }]);
              }
              rows.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
              if (offsetVal) {
                rows = rows.slice(offsetVal);
              }
              if (limitVal !== undefined) {
                rows = rows.slice(0, limitVal);
              }
              return resolve(rows);
            } catch (err) {
              if (reject) return reject(err);
              throw err;
            }
          },
        };
        return builder;
      }),
      update: vi.fn().mockImplementation((table: any) => ({
        set: vi.fn().mockImplementation((updates: any) => ({
          where: vi.fn().mockImplementation((cond: any) => ({
            returning: vi.fn().mockImplementation(async () => {
              const matched = dbData.manuscripts.filter((r) => matchesRow(cond, r));
              if (matched.length === 0) {
                return [];
              }
              matched.forEach((r) => Object.assign(r, updates));
              return matched;
            }),
          })),
        })),
      })),
      delete: vi.fn().mockImplementation((table: any) => ({
        where: vi.fn().mockImplementation(async (cond: any) => {
          dbData.manuscripts = dbData.manuscripts.filter((r) => !matchesRow(cond, r));
          return [];
        }),
      })),
      query: {
        manuscripts: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return dbData.manuscripts.find((r) => matchesRow(where, r)) || null;
          }),
          findMany: vi.fn().mockImplementation(async () => dbData.manuscripts),
        },
        manuscriptMembers: {
          findMany: vi.fn().mockImplementation(async () => dbData.manuscriptMembers),
        },
      },
    };

    manuscriptService = new ManuscriptService(mockDb);
  });

  describe('createManuscript', () => {
    it('creates manuscript within a transaction, assigns OWNER member, and initializes doc_tree', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
      });

      const dto: CreateManuscript = {
        journalId: mockJournalId,
        title: 'New Breakthrough Paper',
        abstract: 'An abstract of breakthroughs',
        metadata: { field: 'Physics' },
      };

      const result = await manuscriptService.createManuscript(dto, authorUserId, authorAbility);

      expect(result).toBeDefined();
      expect(result.title).toBe(dto.title);
      expect(result.journalId).toBe(mockJournalId);
      expect(result.createdBy).toBe(authorUserId);
      expect(result.currentServerRev).toBe(0);
      expect(result.version).toBe(1);
      expect(result.status).toBe('DRAFT');

      // Verify db.transaction was called to wrap all 3 inserts
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalledTimes(3);
    });

    it('rejects with 403 ForbiddenException when CASL ability denies manuscript creation', async () => {
      // Reviewer cannot create manuscripts
      const reviewerAbility = await abilityFactory.createForUser('reviewer-1', {
        roles: [{ name: 'Reviewer' }],
      });

      const dto: CreateManuscript = {
        journalId: mockJournalId,
        title: 'Unauthorized Paper',
      };

      await expect(
        manuscriptService.createManuscript(dto, 'reviewer-1', reviewerAbility),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('listManuscripts (Pagination & CASL Ability Scoping in SQL)', () => {
    it('filters manuscripts according to Author CASL ability (only owned/coauthored)', async () => {
      // Author only has m-1 (OWNER) and m-2 (COAUTHOR)
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [
          { manuscriptId: 'm-1', role: 'OWNER' },
          { manuscriptId: 'm-2', role: 'COAUTHOR' },
        ],
      });

      const query: ManuscriptQuery = {
        page: 1,
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      };

      const result = await manuscriptService.listManuscripts(query, authorAbility, authorUserId);

      expect(result.items).toHaveLength(2);
      expect(result.items.map((m: any) => m.id)).toEqual(expect.arrayContaining(['m-1', 'm-2']));
      expect(result.items.some((m: any) => m.id === 'm-3')).toBe(false);
      expect(result.total).toBe(2);
    });

    it('SuperAdmin can view all manuscripts regardless of membership', async () => {
      const superAdminAbility = await abilityFactory.createForUser(superAdminId, {
        roles: [{ name: 'SuperAdmin' }],
      });

      const query: ManuscriptQuery = {
        page: 1,
        limit: 10,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      };

      const result = await manuscriptService.listManuscripts(query, superAdminAbility, superAdminId);

      expect(result.items.length).toBe(3);
      expect(result.total).toBe(3);
    });

    it('supports offset pagination (page and limit)', async () => {
      const superAdminAbility = await abilityFactory.createForUser(superAdminId, {
        roles: [{ name: 'SuperAdmin' }],
      });

      const page1 = await manuscriptService.listManuscripts(
        { page: 1, limit: 2, sortBy: 'updatedAt', sortOrder: 'desc' },
        superAdminAbility,
        superAdminId,
      );
      expect(page1.items.length).toBe(2);
      expect(page1.total).toBe(3);

      const page2 = await manuscriptService.listManuscripts(
        { page: 2, limit: 2, sortBy: 'updatedAt', sortOrder: 'desc' },
        superAdminAbility,
        superAdminId,
      );
      expect(page2.items.length).toBe(1);
    });

    it('supports cursor pagination with nextCursor', async () => {
      const superAdminAbility = await abilityFactory.createForUser(superAdminId, {
        roles: [{ name: 'SuperAdmin' }],
      });

      const res = await manuscriptService.listManuscripts(
        { limit: 2, sortBy: 'updatedAt', sortOrder: 'desc' },
        superAdminAbility,
        superAdminId,
      );

      expect(res.items.length).toBe(2);
      expect(res.nextCursor).toBeDefined();

      // Query next cursor
      const nextRes = await manuscriptService.listManuscripts(
        { limit: 2, cursor: res.nextCursor, sortBy: 'updatedAt', sortOrder: 'desc' },
        superAdminAbility,
        superAdminId,
      );
      expect(nextRes.items.length).toBe(1);
    });

    it('filters manuscripts by title/abstract search query', async () => {
      const superAdminAbility = await abilityFactory.createForUser(superAdminId, {
        roles: [{ name: 'SuperAdmin' }],
      });

      const res = await manuscriptService.listManuscripts(
        { search: 'Quantum', page: 1, limit: 10, sortBy: 'updatedAt', sortOrder: 'desc' },
        superAdminAbility,
        superAdminId,
      );

      expect(res.items.length).toBe(1);
      expect(res.items[0].title).toContain('Quantum');
    });
  });

  describe('getManuscript', () => {
    it('returns manuscript with members for authorized user', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId: 'm-1', role: 'OWNER' }],
      });

      const result = await manuscriptService.getManuscript('m-1', authorAbility);

      expect(result).toBeDefined();
      expect(result.id).toBe('m-1');
      expect(result.version).toBe(1);
      expect(result.members).toBeDefined();
      expect(result.members.length).toBeGreaterThanOrEqual(1);
    });

    it('throws ForbiddenException when user lacks CASL ability to read', async () => {
      const unauthorizedAbility = await abilityFactory.createForUser(otherUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [],
      });

      await expect(
        manuscriptService.getManuscript('m-1', unauthorizedAbility),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when manuscript does not exist', async () => {
      const superAdminAbility = await abilityFactory.createForUser(superAdminId, {
        roles: [{ name: 'SuperAdmin' }],
      });

      await expect(
        manuscriptService.getManuscript('non-existent-id', superAdminAbility),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateManuscript & Atomic Concurrency Control (If-Match)', () => {
    it('updates manuscript and increments version when If-Match matches current version', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId: 'm-1', role: 'OWNER' }],
      });

      // m-1 has version 1
      const updateDto = { title: 'Updated Quantum Paper' };
      const updated = await manuscriptService.updateManuscript(
        'm-1',
        updateDto,
        '"1"',
        authorAbility,
      );

      expect(updated.title).toBe('Updated Quantum Paper');
      expect(updated.version).toBe(2);
    });

    it('rejects with 412 PreconditionFailedException when If-Match does not match version', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId: 'm-1', role: 'OWNER' }],
      });

      // m-1 has version 1, but client supplies "99"
      await expect(
        manuscriptService.updateManuscript(
          'm-1',
          { title: 'Conflicting update' },
          '"99"',
          authorAbility,
        ),
      ).rejects.toThrow(PreconditionFailedException);
    });

    it('rejects with 412 PreconditionFailedException when atomic SQL update detects version conflict (0 rows)', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId: 'm-1', role: 'OWNER' }],
      });

      // Mock update returning empty array (as if concurrent write bumped version between read and write)
      mockDb.update.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        manuscriptService.updateManuscript(
          'm-1',
          { title: 'Race condition update' },
          undefined,
          authorAbility,
        ),
      ).rejects.toThrow(PreconditionFailedException);
    });

    it('rejects with 403 ForbiddenException when user lacks CASL update permission', async () => {
      // Reviewer can only read, cannot update
      const reviewerAbility = await abilityFactory.createForUser('reviewer-1', {
        roles: [{ name: 'Reviewer' }],
        manuscriptMemberships: [{ manuscriptId: 'm-1', role: 'REVIEWER' }],
      });

      await expect(
        manuscriptService.updateManuscript(
          'm-1',
          { title: 'Reviewer edit' },
          '"1"',
          reviewerAbility,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Manuscript Members (ACL management)', () => {
    it('allows OWNER to add member with specified role', async () => {
      const ownerAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId: 'm-1', role: 'OWNER' }],
      });

      const member = await manuscriptService.addMember(
        'm-1',
        { userId: 'new-user-1', role: 'COAUTHOR' },
        ownerAbility,
      );

      expect(member).toBeDefined();
      expect(member.manuscriptId).toBe('m-1');
      expect(member.userId).toBe('new-user-1');
      expect(member.role).toBe('COAUTHOR');
    });

    it('allows OWNER to remove member', async () => {
      const ownerAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId: 'm-1', role: 'OWNER' }],
      });

      const result = await manuscriptService.removeMember('m-1', 'new-user-1', ownerAbility);
      expect(result.success).toBe(true);
    });
  });
});
