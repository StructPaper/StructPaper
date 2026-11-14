// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCreatePaper } from '@/hooks/useCreatePaper';
import { useUpdatePaper } from '@/hooks/useUpdatePaper';
import { useDeletePaper } from '@/hooks/useDeletePaper';

// Mock mutation functions
const mockCreateMutateAsync = vi.fn();
const mockUpdateMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();

vi.mock('@structpaper/api-client', async () => {
  const actual = await vi.importActual<any>('@structpaper/api-client');
  return {
    ...actual,
    useCreateManuscript: () => ({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    }),
    useUpdateManuscript: () => ({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    }),
    useDeleteManuscript: () => ({
      mutateAsync: mockDeleteMutateAsync,
      isPending: false,
    }),
  };
});

// Mock IndexedDB sync & storage
const mockSavePaperToIndexedDb = vi.fn().mockResolvedValue(true);
const mockLoadPaperFromIndexedDb = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/storage/paper-sync', () => ({
  savePaperToIndexedDb: (...args: any[]) => mockSavePaperToIndexedDb(...args),
  loadPaperFromIndexedDb: (...args: any[]) => mockLoadPaperFromIndexedDb(...args),
}));

const mockRepoDelete = vi.fn().mockResolvedValue(true);
vi.mock('@structpaper/storage', () => ({
  IndexedDbManuscriptRepo: class {
    delete = mockRepoDelete;
  },
}));

vi.mock('@/components/DynamicIslandToast', () => ({
  sileo: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Manuscript CRUD Custom Hooks (Task 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCreatePaper', () => {
    it('calls useCreateManuscript mutateAsync and caches paper locally', async () => {
      mockCreateMutateAsync.mockResolvedValueOnce({
        id: 'new-ms-123',
        title: 'Quantum Computing in 2026',
        journalId: '00000000-0000-0000-0000-000000000000',
        status: 'DRAFT',
        version: 1,
        currentServerRev: 0,
        createdBy: 'user-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const { result } = renderHook(() => useCreatePaper({ showToast: false }), {
        wrapper: createWrapper(),
      });

      let created: any = null;
      await act(async () => {
        created = await result.current.createPaper({
          title: 'Quantum Computing in 2026',
          metadata: { field: 'Physics' },
        });
      });

      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Quantum Computing in 2026',
        }),
      });
      expect(mockSavePaperToIndexedDb).toHaveBeenCalled();
      expect(created).toBeDefined();
      expect(created?.id).toBe('new-ms-123');
      expect(created?.title).toBe('Quantum Computing in 2026');
    });

    it('falls back to offline IndexedDB paper if server call fails', async () => {
      mockCreateMutateAsync.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => useCreatePaper({ showToast: false }), {
        wrapper: createWrapper(),
      });

      let created: any = null;
      await act(async () => {
        created = await result.current.createPaper({
          title: 'Offline Draft Paper',
        });
      });

      expect(created).toBeDefined();
      expect(created?.title).toBe('Offline Draft Paper');
      expect(mockSavePaperToIndexedDb).toHaveBeenCalled();
    });
  });

  describe('useUpdatePaper', () => {
    it('calls useUpdateManuscript mutateAsync with ETag header', async () => {
      mockUpdateMutateAsync.mockResolvedValueOnce({
        id: 'ms-123',
        title: 'Updated Title',
        status: 'DRAFT',
        version: 2,
        updatedAt: new Date().toISOString(),
      });

      const { result } = renderHook(() => useUpdatePaper({ showToast: false }), {
        wrapper: createWrapper(),
      });

      mockLoadPaperFromIndexedDb.mockResolvedValueOnce({
        id: 'ms-123',
        metadata: { title: 'Old Title' },
        sections: [],
        version: 1,
      });

      let updated: any = null;
      await act(async () => {
        updated = await result.current.updatePaper({
          id: 'ms-123',
          data: { title: 'Updated Title' },
          version: 1,
        });
      });

      expect(mockUpdateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'ms-123',
          data: { title: 'Updated Title' },
          params: {
            ifMatch: '"1"',
          },
        }),
      );
      expect(mockSavePaperToIndexedDb).toHaveBeenCalled();
      expect(updated?.version).toBe(2);
    });
  });

  describe('useDeletePaper', () => {
    it('calls useDeleteManuscript mutateAsync and removes from local storage', async () => {
      mockDeleteMutateAsync.mockResolvedValueOnce({
        success: true,
      });

      const { result } = renderHook(() => useDeletePaper({ showToast: false }), {
        wrapper: createWrapper(),
      });

      let success = false;
      await act(async () => {
        success = await result.current.deletePaper('ms-123');
      });

      expect(mockDeleteMutateAsync).toHaveBeenCalledWith({
        id: 'ms-123',
      });
      expect(mockRepoDelete).toHaveBeenCalledWith('ms-123');
      expect(success).toBe(true);
    });
  });
});
