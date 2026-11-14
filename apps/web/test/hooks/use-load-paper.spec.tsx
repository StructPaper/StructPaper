// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLoadPaper } from '@/hooks/useLoadPaper';

// Mock IndexedDB
const mockLoadPaperFromIndexedDb = vi.fn();
const mockSavePaperToIndexedDb = vi.fn().mockResolvedValue(true);
vi.mock('@/lib/storage/paper-sync', () => ({
  loadPaperFromIndexedDb: (...args: any[]) => mockLoadPaperFromIndexedDb(...args),
  savePaperToIndexedDb: (...args: any[]) => mockSavePaperToIndexedDb(...args),
}));

// Mock @structpaper/api-client useGetManuscript
let mockGetManuscriptReturn: any = {
  data: undefined,
  isLoading: false,
  isError: false,
  error: null,
  refetch: vi.fn(),
};

vi.mock('@structpaper/api-client', async () => {
  const actual = await vi.importActual<any>('@structpaper/api-client');
  return {
    ...actual,
    isMockModeEnabled: () => false,
    useGetManuscript: () => mockGetManuscriptReturn,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useLoadPaper Custom Hook (Task 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetManuscriptReturn = {
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };
  });

  it('loads paper from IndexedDB if available', async () => {
    const cachedPaper = {
      id: 'paper-1',
      metadata: { title: 'Cached Local Paper', journalId: 'vnu-jst' },
      sections: [{ id: 'sec-1', title: 'Intro', content: 'Cached content' }],
      references: [],
      version: 1,
    };
    mockLoadPaperFromIndexedDb.mockResolvedValueOnce(cachedPaper);

    const { result } = renderHook(() => useLoadPaper('paper-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.paper).toBeDefined();
    });

    expect(result.current.paper?.metadata.title).toBe('Cached Local Paper');
    expect(mockLoadPaperFromIndexedDb).toHaveBeenCalledWith('paper-1');
  });

  it('transforms server manuscript to CompletePaper if not in IndexedDB', async () => {
    mockLoadPaperFromIndexedDb.mockResolvedValueOnce(null);

    mockGetManuscriptReturn = {
      data: {
        id: 'server-ms-1',
        title: 'Deep Learning on Edge Devices',
        journalId: '00000000-0000-0000-0000-000000000000',
        status: 'DRAFT',
        version: 2,
        currentServerRev: 1,
        createdBy: 'user-1',
        createdAt: '2026-11-14T00:00:00Z',
        updatedAt: '2026-11-14T01:00:00Z',
        metadata: {
          articleType: 'Research Article',
          authors: [{ id: 'a1', name: 'Dr. Nguyen' }],
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    };

    const { result } = renderHook(() => useLoadPaper('server-ms-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.paper).toBeDefined();
    });

    expect(result.current.paper?.id).toBe('server-ms-1');
    expect(result.current.paper?.metadata.title).toBe('Deep Learning on Edge Devices');
    expect(mockSavePaperToIndexedDb).toHaveBeenCalled();
  });

  it('handles offline / network failure gracefully when local paper exists', async () => {
    const cachedPaper = {
      id: 'offline-paper',
      metadata: { title: 'Offline Preserved Paper' },
      sections: [],
      references: [],
    };
    mockLoadPaperFromIndexedDb.mockResolvedValueOnce(cachedPaper);

    mockGetManuscriptReturn = {
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Network timeout'),
      refetch: vi.fn(),
    };

    const { result } = renderHook(() => useLoadPaper('offline-paper'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.paper).toBeDefined();
    });

    expect(result.current.paper?.metadata.title).toBe('Offline Preserved Paper');
    expect(result.current.isOffline).toBe(true);
  });
});
