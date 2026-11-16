import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NoopManuscriptStorageAdapter,
  ServerManuscriptStorageAdapter,
  UnifiedManuscriptRepository,
  createManuscriptStorage,
} from '@/lib/storage';
import { manuscriptApi } from '@structpaper/api-client';
import type { CompletePaper } from '@/types/paper';
import type { ManuscriptRecord } from '@structpaper/doc-model';

vi.mock('@structpaper/api-client', () => ({
  manuscriptApi: {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  getAccessToken: vi.fn(() => 'mock-token'),
}));

describe('Storage Layer Architecture (Composite + Null Object Pattern)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('NoopManuscriptStorageAdapter (Null Object Pattern)', () => {
    const noop = new NoopManuscriptStorageAdapter();

    it('has isLocalAvailable set to false', () => {
      expect(noop.isLocalAvailable).toBe(false);
    });

    it('returns null on loadPaper', async () => {
      const res = await noop.loadPaper('paper-123');
      expect(res).toBeNull();
    });

    it('returns empty array on listRecords', async () => {
      const res = await noop.listRecords();
      expect(res).toEqual([]);
    });

    it('resolves cleanly without errors on savePaper, delete, and updateInfo', async () => {
      const saveRes = await noop.savePaper({ id: 'doc-1', metadata: { title: 'Test' } } as any);
      expect(saveRes).toEqual({ id: 'doc-1', version: undefined });

      await expect(noop.delete('doc-1')).resolves.not.toThrow();
      await expect(noop.updateInfo('doc-1', { pinned: true })).resolves.not.toThrow();
    });
  });

  describe('ServerManuscriptStorageAdapter', () => {
    const server = new ServerManuscriptStorageAdapter();

    it('delegates listRecords to manuscriptApi.list and maps to ManuscriptRecord format', async () => {
      vi.mocked(manuscriptApi.list).mockResolvedValueOnce({
        items: [
          {
            id: '34f1cb08-71e7-4dbe-a8b6-5289822f25e9',
            title: 'Digital Social Responsibility',
            status: 'DRAFT',
            journalId: 'ab18f9e4-5cb2-4e16-96eb-6d7014626307',
            journal: {
              code: 'VNUHCM-EBL',
              name: 'Tạp chí Phát triển KH&CN',
              color: '#8F0B97',
              shortName: 'EBL',
            },
            metadata: {},
            createdAt: '2026-11-16T00:00:00Z',
            updatedAt: '2026-11-16T01:00:00Z',
          },
        ],
      } as any);

      const records = await server.listRecords();
      expect(records).toHaveLength(1);
      expect(records[0].info.id).toBe('34f1cb08-71e7-4dbe-a8b6-5289822f25e9');
      expect(records[0].info.displayName).toBe('Digital Social Responsibility');
      expect((records[0].doc as any).journal?.code).toBe('VNUHCM-EBL');
      expect((records[0].doc as any).journal?.color).toBe('#8F0B97');
      expect(records[0].syncState).toBe('synced');
    });

    it('delegates savePaper to manuscriptApi.create when paper has no UUID', async () => {
      vi.mocked(manuscriptApi.create).mockResolvedValueOnce({
        id: 'new-uuid-1234-5678-90ab',
        version: 1,
      } as any);

      const paper: CompletePaper = {
        id: 'temp-id',
        displayName: 'New Study',
        metadata: { title: 'New Study' } as any,
        sections: [],
        references: [],
      } as any;

      const res = await server.savePaper(paper);
      expect(manuscriptApi.create).toHaveBeenCalledTimes(1);
      expect(res.id).toBe('new-uuid-1234-5678-90ab');
      expect(res.version).toBe(1);
    });

    it('delegates savePaper to manuscriptApi.update when paper has a valid UUID', async () => {
      const validUuid = '11111111-2222-3333-4444-555555555555';
      vi.mocked(manuscriptApi.update).mockResolvedValueOnce({
        id: validUuid,
        version: 2,
      } as any);

      const paper: CompletePaper = {
        id: validUuid,
        displayName: 'Existing Study',
        metadata: { title: 'Existing Study' } as any,
        sections: [],
        references: [],
      } as any;
      (paper as any).version = 1;

      const res = await server.savePaper(paper);
      expect(manuscriptApi.update).toHaveBeenCalledWith(
        validUuid,
        expect.objectContaining({ title: 'Existing Study' }),
        { 'If-Match': '"1"' }
      );
      expect(res.id).toBe(validUuid);
      expect(res.version).toBe(2);
    });
  });

  describe('UnifiedManuscriptRepository (Composite Coordinator)', () => {
    it('operates in pure Server-Only mode when local adapter is Noop', async () => {
      const noop = new NoopManuscriptStorageAdapter();
      const server = new ServerManuscriptStorageAdapter();
      const unified = new UnifiedManuscriptRepository(noop, server);

      expect(unified.isLocalAvailable).toBe(false);

      // 1. listRecords falls directly through to server
      vi.mocked(manuscriptApi.list).mockResolvedValueOnce({
        items: [
          {
            id: 'server-paper-1',
            title: 'Server Only Paper',
            journal: { code: 'VNUHCM-STD', color: '#000099' },
          },
        ],
      } as any);

      const records = await unified.listRecords();
      expect(records).toHaveLength(1);
      expect(records[0].info.id).toBe('server-paper-1');

      // 2. loadPaper falls directly through to server
      vi.mocked(manuscriptApi.get).mockResolvedValueOnce({
        id: 'server-paper-1',
        title: 'Server Only Paper',
        metadata: {},
      } as any);

      const loaded = await unified.loadPaper('server-paper-1');
      expect(loaded).not.toBeNull();
      expect(loaded?.displayName).toBe('Server Only Paper');
    });

    it('operates in Local-First mode when local adapter is active', async () => {
      const mockLocal = {
        isLocalAvailable: true,
        savePaper: vi.fn().mockResolvedValue({ id: 'local-1' }),
        saveRecord: vi.fn().mockResolvedValue(undefined),
        loadPaper: vi.fn().mockResolvedValue({ id: 'local-1', displayName: 'Cached Paper' } as any),
        listRecords: vi.fn().mockResolvedValue([{ info: { id: 'local-1' } }] as any),
        getRecord: vi.fn().mockResolvedValue({ info: { id: 'local-1' } } as any),
        delete: vi.fn().mockResolvedValue(undefined),
        updateInfo: vi.fn().mockResolvedValue(undefined),
        duplicate: vi.fn().mockResolvedValue({ id: 'local-dup' }),
      };

      const server = new ServerManuscriptStorageAdapter();
      const unified = new UnifiedManuscriptRepository(mockLocal, server);

      expect(unified.isLocalAvailable).toBe(true);

      // loadPaper should return from local without calling server API
      const loaded = await unified.loadPaper('local-1');
      expect(loaded?.displayName).toBe('Cached Paper');
      expect(manuscriptApi.get).not.toHaveBeenCalled();

      // listRecords should merge local and remote records
      vi.mocked(manuscriptApi.list).mockResolvedValueOnce({ items: [] } as any);
      const records = await unified.listRecords();
      expect(records).toHaveLength(1);
      expect(manuscriptApi.list).toHaveBeenCalledTimes(1);
    });

    it('factory creates Noop local adapter when enableLocal is false', () => {
      const storage = createManuscriptStorage(false);
      expect(storage.isLocalAvailable).toBe(false);
    });

    it('factory creates Active local adapter when enableLocal is true', () => {
      const storage = createManuscriptStorage(true);
      expect(storage.isLocalAvailable).toBe(true);
    });
  });
});
