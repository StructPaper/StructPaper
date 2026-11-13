import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { SyncService } from '../../src/modules/sync/application/sync.service';
import type { SseManagerService } from '../../src/modules/sync/domain/sse-manager.service';
import type { SubmitOps } from '@structpaper/contracts';

describe('SyncService (Op-Log Patch Sync, 409 Conflict Rebase & SSE Streaming)', () => {
  let syncService: SyncService;
  let abilityFactory: AbilityFactory;
  let mockSseManager: SseManagerService;
  let mockDb: any;
  let dbData: {
    manuscripts: any[];
    manuscriptDocs: any[];
    manuscriptOps: any[];
    manuscriptRevisions: any[];
    outboxEvents: any[];
  };

  const manuscriptId = '11111111-1111-1111-1111-111111111111';
  const authorUserId = '22222222-2222-2222-2222-222222222222';
  const unauthorizedUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(() => {
    abilityFactory = new AbilityFactory();

    dbData = {
      manuscripts: [
        {
          id: manuscriptId,
          journalId: 'journal-1',
          title: 'Paper on Superconductors',
          status: 'DRAFT',
          createdBy: authorUserId,
          currentServerRev: 0,
          version: 1,
          createdAt: new Date('2026-01-01'),
          updatedAt: new Date('2026-01-01'),
        },
      ],
      manuscriptDocs: [
        {
          manuscriptId,
          docTree: { type: 'doc', content: [] },
          serverRev: 0,
          updatedAt: new Date('2026-01-01'),
        },
      ],
      manuscriptOps: [],
      manuscriptRevisions: [],
      outboxEvents: [],
    };

    mockSseManager = {
      addClient: vi.fn(),
      removeClient: vi.fn(),
      broadcast: vi.fn(),
      getConnectedCount: vi.fn().mockReturnValue(1),
    } as any;

    mockDb = {
      transaction: vi.fn().mockImplementation(async (callback: any) => {
        return callback(mockDb);
      }),
      insert: vi.fn().mockImplementation((table: any) => ({
        values: vi.fn().mockImplementation((val: any) => {
          const row = {
            ...val,
            id: val.id || `gen-${Date.now()}-${Math.random()}`,
            createdAt: val.createdAt || new Date(),
          };
          if (val.patches !== undefined) {
            dbData.manuscriptOps.push(row);
          } else if (val.aggregateType !== undefined) {
            dbData.outboxEvents.push(row);
          } else if (val.snapshot !== undefined) {
            dbData.manuscriptRevisions.push(row);
          } else if (val.docTree !== undefined) {
            dbData.manuscriptDocs.push(row);
          }
          return {
            returning: vi.fn().mockResolvedValue([row]),
          };
        }),
      })),
      select: vi.fn().mockImplementation(() => {
        let whereCond: any = null;
        let orderDir: any = null;
        const builder: any = {
          from: vi.fn().mockImplementation(() => builder),
          where: vi.fn().mockImplementation((cond: any) => {
            whereCond = cond;
            return builder;
          }),
          orderBy: vi.fn().mockImplementation((ord: any) => {
            orderDir = ord;
            return builder;
          }),
          then: (resolve: any) => {
            return resolve(dbData.manuscriptOps);
          },
        };
        return builder;
      }),
      update: vi.fn().mockImplementation((table: any) => ({
        set: vi.fn().mockImplementation((updates: any) => ({
          where: vi.fn().mockImplementation((cond: any) => {
            // Apply updates to manuscripts or manuscriptDocs
            if (updates.currentServerRev !== undefined) {
              const m = dbData.manuscripts.find((r) => r.id === manuscriptId);
              if (m) Object.assign(m, updates);
            }
            if (updates.docTree !== undefined) {
              const d = dbData.manuscriptDocs.find((r) => r.manuscriptId === manuscriptId);
              if (d) Object.assign(d, updates);
            }
            return {
              returning: vi.fn().mockResolvedValue([]),
            };
          }),
        })),
      })),
      query: {
        manuscripts: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return dbData.manuscripts.find((m) => m.id === manuscriptId) || null;
          }),
        },
        manuscriptDocs: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return dbData.manuscriptDocs.find((d) => d.manuscriptId === manuscriptId) || null;
          }),
        },
        manuscriptOps: {
          findFirst: vi.fn().mockImplementation(async ({ where }: any) => {
            return dbData.manuscriptOps[0] || null;
          }),
          findMany: vi.fn().mockImplementation(async ({ where, orderBy }: any) => {
            return dbData.manuscriptOps;
          }),
        },
        manuscriptRevisions: {
          findMany: vi.fn().mockImplementation(async () => dbData.manuscriptRevisions),
        },
      },
    };

    syncService = new SyncService(mockDb, mockSseManager);
  });

  describe('submitOps', () => {
    it('applies patches, increments serverRev, writes op-log and outbox, and broadcasts via SSE', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      const dto: SubmitOps = {
        opId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        baseServerRev: 0,
        clientRev: 1,
        patches: [
          {
            op: 'add',
            path: ['content', 0],
            value: { type: 'paragraph', text: 'Section 1' },
          },
        ],
      };

      const result = await syncService.submitOps(manuscriptId, dto, authorUserId, authorAbility);

      expect(result).toBeDefined();
      expect(result.serverRev).toBe(1);
      expect(result.opId).toBe(dto.opId);
      expect(result.checksum).toBeDefined();

      // Verify DB transaction
      expect(mockDb.transaction).toHaveBeenCalled();

      // Verify op inserted
      expect(dbData.manuscriptOps).toHaveLength(1);
      expect(dbData.manuscriptOps[0].serverRev).toBe(1);
      expect(dbData.manuscriptOps[0].opId).toBe(dto.opId);

      // Verify manuscript currentServerRev updated
      expect(dbData.manuscripts[0].currentServerRev).toBe(1);

      // Verify docTree updated
      expect(dbData.manuscriptDocs[0].serverRev).toBe(1);
      expect(dbData.manuscriptDocs[0].docTree.content).toHaveLength(1);

      // Verify outbox event emitted
      expect(dbData.outboxEvents).toHaveLength(1);
      expect(dbData.outboxEvents[0].eventType).toBe('OP_APPLIED');

      // Verify SSE broadcast called
      expect(mockSseManager.broadcast).toHaveBeenCalledWith(
        manuscriptId,
        'op',
        expect.objectContaining({
          opId: dto.opId,
          serverRev: 1,
        }),
      );
    });

    it('returns existing serverRev and checksum on idempotent duplicate opId', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      const opId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      // Pre-seed an existing op
      dbData.manuscriptOps.push({
        id: 'op-1',
        manuscriptId,
        serverRev: 1,
        clientRev: 1,
        opId,
        patches: [{ op: 'add', path: ['content', 0], value: 'Old' }],
        checksum: 'existing-checksum-hash',
        createdBy: authorUserId,
      });
      dbData.manuscripts[0].currentServerRev = 1;

      // Mock query findFirst for manuscriptOps to find this existing op
      mockDb.query.manuscriptOps.findFirst = vi.fn().mockResolvedValue(dbData.manuscriptOps[0]);

      const dto: SubmitOps = {
        opId,
        baseServerRev: 0,
        clientRev: 1,
        patches: [{ op: 'add', path: ['content', 0], value: 'Duplicate' }],
      };

      const result = await syncService.submitOps(manuscriptId, dto, authorUserId, authorAbility);

      expect(result.serverRev).toBe(1);
      expect(result.opId).toBe(opId);
      expect(result.checksum).toBe('existing-checksum-hash');
      // Should NOT have run a transaction or inserted duplicate
      expect(mockDb.transaction).not.toHaveBeenCalled();
      expect(dbData.manuscriptOps).toHaveLength(1);
    });

    it('throws 409 ConflictException with OUT_OF_SYNC and missingOps delta when baseServerRev < currentServerRev', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      // Server is at rev 3 with ops 1, 2, 3
      dbData.manuscripts[0].currentServerRev = 3;
      const op1 = { id: '1', manuscriptId, serverRev: 1, clientRev: 1, opId: 'op-1', patches: [] };
      const op2 = { id: '2', manuscriptId, serverRev: 2, clientRev: 1, opId: 'op-2', patches: [] };
      const op3 = { id: '3', manuscriptId, serverRev: 3, clientRev: 2, opId: 'op-3', patches: [] };
      dbData.manuscriptOps = [op1, op2, op3];

      mockDb.query.manuscriptOps.findFirst = vi.fn().mockResolvedValue(null);
      mockDb.query.manuscriptOps.findMany = vi.fn().mockResolvedValue([op2, op3]);

      // Client submits with baseServerRev = 1 (behind rev 3)
      const dto: SubmitOps = {
        opId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        baseServerRev: 1,
        clientRev: 2,
        patches: [{ op: 'replace', path: ['title'], value: 'Conflicted' }],
      };

      try {
        await syncService.submitOps(manuscriptId, dto, authorUserId, authorAbility);
        expect.fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = err.getResponse();
        expect(res.code).toBe('OUT_OF_SYNC');
        expect(res.serverRev).toBe(3);
        expect(res.missingOps).toHaveLength(2);
      }
    });

    it('rejects with 403 ForbiddenException when user lacks edit permissions', async () => {
      const unauthorizedAbility = await abilityFactory.createForUser(unauthorizedUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [], // Not a member of this manuscript
      });

      const dto: SubmitOps = {
        opId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        baseServerRev: 0,
        clientRev: 1,
        patches: [{ op: 'add', path: ['content', 0], value: 'Hack' }],
      };

      await expect(
        syncService.submitOps(manuscriptId, dto, unauthorizedUserId, unauthorizedAbility),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates milestone revision checkpoint every 20 ops', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      // Current rev is 19, next will be 20 -> trigger checkpoint
      dbData.manuscripts[0].currentServerRev = 19;
      dbData.manuscriptDocs[0].serverRev = 19;
      mockDb.query.manuscriptOps.findFirst = vi.fn().mockResolvedValue(null);

      const dto: SubmitOps = {
        opId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
        baseServerRev: 19,
        clientRev: 5,
        patches: [{ op: 'replace', path: ['type'], value: 'doc' }],
      };

      const result = await syncService.submitOps(manuscriptId, dto, authorUserId, authorAbility);

      expect(result.serverRev).toBe(20);
      expect(dbData.manuscriptRevisions).toHaveLength(1);
      expect(dbData.manuscriptRevisions[0].serverRev).toBe(20);
    });
  });

  describe('createRevision & listRevisions', () => {
    it('creates named milestone revision and broadcasts revision event via SSE', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      const revision = await syncService.createRevision(
        manuscriptId,
        'v1.0-submission',
        authorUserId,
        authorAbility,
      );

      expect(revision).toBeDefined();
      expect(revision.tagName).toBe('v1.0-submission');
      expect(dbData.manuscriptRevisions).toHaveLength(1);
      expect(mockSseManager.broadcast).toHaveBeenCalledWith(
        manuscriptId,
        'revision',
        expect.objectContaining({
          tagName: 'v1.0-submission',
        }),
      );
    });

    it('lists all revisions for a manuscript', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      dbData.manuscriptRevisions.push({
        id: 'rev-1',
        manuscriptId,
        serverRev: 10,
        tagName: 'v0.1',
        snapshot: {},
        checksum: 'abc',
        createdAt: new Date(),
      });

      const list = await syncService.listRevisions(manuscriptId, authorAbility);
      expect(list).toHaveLength(1);
      expect(list[0].tagName).toBe('v0.1');
    });
  });

  describe('getDoc & getMissingOps', () => {
    it('returns document tree and calculated checksum', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      const doc = await syncService.getDoc(manuscriptId, authorAbility);
      expect(doc).toBeDefined();
      expect(doc.serverRev).toBe(0);
      expect(doc.checksum).toBeDefined();
    });

    it('returns missing ops ordered by serverRev', async () => {
      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      const missing = await syncService.getMissingOps(manuscriptId, 0, authorAbility);
      expect(Array.isArray(missing)).toBe(true);
    });
  });
});

describe('FastifySseManagerService (Infrastructure)', () => {
  it('manages client connections, sets SSE headers, and sends keepalive & broadcast messages', async () => {
    const { FastifySseManagerService } = await import(
      '../../src/modules/sync/infrastructure/sse-manager.service'
    );
    const sseManager = new FastifySseManagerService();

    const mId = 'manuscript-test-sse';
    const writtenData: string[] = [];
    const headersSent: Record<string, string> = {};

    const mockReply = {
      hijack: vi.fn(),
      raw: {
        headersSent: false,
        writeHead: vi.fn().mockImplementation((status: number, headers: any) => {
          Object.assign(headersSent, headers);
        }),
        write: vi.fn().mockImplementation((chunk: string) => {
          writtenData.push(chunk);
        }),
        end: vi.fn(),
        on: vi.fn(),
      },
    };

    // 1. Add client
    sseManager.addClient(mId, mockReply);

    expect(sseManager.getConnectedCount(mId)).toBe(1);
    expect(mockReply.hijack).toHaveBeenCalled();
    expect(mockReply.raw.writeHead).toHaveBeenCalledWith(
      200,
      expect.objectContaining({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }),
    );
    expect(writtenData).toContain(': connected\n\n');

    // 2. Broadcast event
    sseManager.broadcast(mId, 'op', { serverRev: 2 });
    expect(writtenData).toContain('event: op\ndata: {"serverRev":2}\n\n');

    // 3. Keepalive ping
    sseManager.sendPing(mId);
    expect(writtenData).toContain(': ping\n\n');

    // 4. Remove client
    sseManager.removeClient(mId, mockReply);
    expect(sseManager.getConnectedCount(mId)).toBe(0);

    // 5. Cleanup on module destroy
    sseManager.onModuleDestroy();
  });
});


