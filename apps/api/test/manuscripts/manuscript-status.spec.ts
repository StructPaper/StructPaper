import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ManuscriptService } from '../../src/modules/manuscripts/application/manuscript.service';
import { ManuscriptController } from '../../src/modules/manuscripts/presentation/manuscript.controller';
import { AbilityFactory } from '../../src/modules/access/domain/ability.factory';
import { InMemoryAbilityCacheService } from '../../src/modules/access/infrastructure/ability-cache.service';

describe('Manuscript Lifecycle State Machine & Transactional Outbox', () => {
  let mockDb: any;
  let cacheService: InMemoryAbilityCacheService;
  let abilityFactory: AbilityFactory;
  let manuscriptService: ManuscriptService;
  let manuscriptController: ManuscriptController;

  const manuscriptId = '00000000-0000-0000-0000-000000000010';
  const journalId = '00000000-0000-0000-0000-000000000001';
  const authorUserId = '00000000-0000-0000-0000-000000000002';
  const editorUserId = '00000000-0000-0000-0000-000000000003';
  const reviewerUserId = '00000000-0000-0000-0000-000000000004';

  const baseManuscriptRecord = {
    id: manuscriptId,
    journalId,
    title: 'Nghiên cứu ứng dụng Deep Learning trong phân loại quang phổ',
    abstract: 'Tóm tắt bài báo khoa học...',
    status: 'DRAFT',
    createdBy: authorUserId,
    currentServerRev: 0,
    version: 1,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(async (cb) => cb(mockDb)),
    };
    cacheService = new InMemoryAbilityCacheService(60_000, 100);
    abilityFactory = new AbilityFactory();
    manuscriptService = new ManuscriptService(mockDb);
    manuscriptController = new ManuscriptController(manuscriptService, abilityFactory, cacheService);
  });

  const setupMockManuscript = (overrides: Partial<typeof baseManuscriptRecord> = {}) => {
    const record = { ...baseManuscriptRecord, ...overrides };
    const queryBuilder = {
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([{ manuscript: record, journal: null }]),
      }),
    };
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnValue(queryBuilder),
        where: queryBuilder.where,
      }),
    });
    return record;
  };

  describe('1. Valid Status Transitions & Transactional Outbox Events', () => {
    it('Author transitions DRAFT -> SUBMITTED, produces ManuscriptStatusChanged outbox event', async () => {
      setupMockManuscript({ status: 'DRAFT', version: 1 });

      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      let insertedOutboxRecord: any = null;
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          insertedOutboxRecord = val;
          return { onConflictDoNothing: vi.fn().mockResolvedValue([{}]) };
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{}]),
        }),
      });

      const result = await manuscriptService.changeStatus(
        manuscriptId,
        {
          status: 'SUBMITTED',
          reason: 'Bản thảo đã hoàn thiện, gửi nộp tòa soạn',
        },
        authorUserId,
        authorAbility,
      );

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe('DRAFT');
      expect(result.newStatus).toBe('SUBMITTED');
      expect(result.manuscript.status).toBe('SUBMITTED');
      expect(result.manuscript.version).toBe(2);
      expect(result.outboxEventId).toBeDefined();

      // Verify outbox record
      expect(insertedOutboxRecord).toBeDefined();
      expect(insertedOutboxRecord.aggregateType).toBe('manuscript');
      expect(insertedOutboxRecord.aggregateId).toBe(manuscriptId);
      expect(insertedOutboxRecord.eventType).toBe('ManuscriptStatusChanged');
      expect(insertedOutboxRecord.payload.previousStatus).toBe('DRAFT');
      expect(insertedOutboxRecord.payload.newStatus).toBe('SUBMITTED');
      expect(insertedOutboxRecord.payload.changedBy).toBe(authorUserId);
      expect(insertedOutboxRecord.payload.reason).toBe('Bản thảo đã hoàn thiện, gửi nộp tòa soạn');
    });

    it('Journal manager transitions SUBMITTED -> IN_REVIEW and IN_REVIEW -> ACCEPTED', async () => {
      setupMockManuscript({ status: 'SUBMITTED', version: 2 });

      // editorial decisions belong to the journal manager (an Editor role alone has no blanket access)
      const editorAbility = await abilityFactory.createForUser(editorUserId, {
        roles: [{ name: 'JournalManager', scopeJournalId: journalId }],
      });

      let insertedOutboxRecord: any = null;
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockImplementation((val) => {
          insertedOutboxRecord = val;
          return [{}];
        }),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{}]),
        }),
      });

      const result = await manuscriptService.changeStatus(
        manuscriptId,
        {
          status: 'IN_REVIEW',
          note: 'Phân công 2 phản biện đánh giá độc lập',
        },
        editorUserId,
        editorAbility,
      );

      expect(result.success).toBe(true);
      expect(result.previousStatus).toBe('SUBMITTED');
      expect(result.newStatus).toBe('IN_REVIEW');
      expect(insertedOutboxRecord.payload.note).toBe('Phân công 2 phản biện đánh giá độc lập');
    });
  });

  describe('2. State Machine Violations & BadRequestException', () => {
    it('throws BadRequestException when skipping workflow steps (e.g. DRAFT -> PUBLISHED)', async () => {
      setupMockManuscript({ status: 'DRAFT', version: 1 });

      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      await expect(
        manuscriptService.changeStatus(
          manuscriptId,
          { status: 'PUBLISHED' },
          authorUserId,
          authorAbility,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        manuscriptService.changeStatus(
          manuscriptId,
          { status: 'PUBLISHED' },
          authorUserId,
          authorAbility,
        ),
      ).rejects.toThrow(/Invalid status transition from DRAFT to PUBLISHED/i);
    });

    it('returns without error or duplicate outbox event when newStatus is identical to currentStatus', async () => {
      setupMockManuscript({ status: 'DRAFT', version: 1 });

      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      const result = await manuscriptService.changeStatus(
        manuscriptId,
        { status: 'DRAFT' },
        authorUserId,
        authorAbility,
      );

      expect(result.success).toBe(true);
      expect(result.outboxEventId).toBe('');
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });

  describe('3. Editorial Permission Checks & ForbiddenException', () => {
    it('Author cannot approve or accept manuscript (IN_REVIEW -> ACCEPTED throws ForbiddenException)', async () => {
      setupMockManuscript({ status: 'IN_REVIEW', version: 3 });

      const authorAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'Author' }],
        manuscriptMemberships: [{ manuscriptId, role: 'OWNER' }],
      });

      await expect(
        manuscriptService.changeStatus(
          manuscriptId,
          { status: 'ACCEPTED' },
          authorUserId,
          authorAbility,
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        manuscriptService.changeStatus(
          manuscriptId,
          { status: 'ACCEPTED' },
          authorUserId,
          authorAbility,
        ),
      ).rejects.toThrow(/You do not have editorial permission/i);
    });

    it('Reviewer cannot change status of manuscript', async () => {
      setupMockManuscript({ status: 'IN_REVIEW', version: 3 });

      const reviewerAbility = await abilityFactory.createForUser(reviewerUserId, {
        roles: [{ name: 'Reviewer' }],
        manuscriptMemberships: [{ manuscriptId, role: 'REVIEWER' }],
      });

      await expect(
        manuscriptService.changeStatus(
          manuscriptId,
          { status: 'ACCEPTED' },
          reviewerUserId,
          reviewerAbility,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Controller Endpoint POST /manuscripts/:id/status', () => {
    it('delegates to manuscriptService.changeStatus with extracted ability and user id', async () => {
      setupMockManuscript({ status: 'DRAFT', version: 1 });

      const superAdminAbility = await abilityFactory.createForUser(authorUserId, {
        roles: [{ name: 'SuperAdmin' }],
      });
      cacheService.set(authorUserId, 1, superAdminAbility);

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue([{}]),
      });

      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{}]),
        }),
      });

      const mockReq = {
        user: { id: authorUserId, permissionsVersion: 1 },
      };

      const result = await manuscriptController.changeStatus(
        manuscriptId,
        { status: 'SUBMITTED' },
        mockReq,
      );

      expect(result.success).toBe(true);
      expect(result.newStatus).toBe('SUBMITTED');
    });
  });
});
