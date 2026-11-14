// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePaperStorage } from '@/hooks/usePaperStorage';
import type { CompletePaper } from '@/types/paper';

const mockSavePaperToIndexedDb = vi.fn().mockResolvedValue(true);
const mockLoadPaperFromIndexedDb = vi.fn();
vi.mock('@/lib/storage/paper-sync', () => ({
  savePaperToIndexedDb: (...args: any[]) => mockSavePaperToIndexedDb(...args),
  loadPaperFromIndexedDb: (...args: any[]) => mockLoadPaperFromIndexedDb(...args),
}));

const mockUpdatePaper = vi.fn();
const mockCreatePaper = vi.fn();
vi.mock('@/hooks/useUpdatePaper', () => ({
  useUpdatePaper: () => ({
    updatePaper: mockUpdatePaper,
    isPending: false,
  }),
}));
vi.mock('@/hooks/useCreatePaper', () => ({
  useCreatePaper: () => ({
    createPaper: mockCreatePaper,
    isPending: false,
  }),
}));

const mockGetManuscript = vi.fn();
vi.mock('@structpaper/api-client', async () => {
  const actual = await vi.importActual<any>('@structpaper/api-client');
  return {
    ...actual,
    isMockModeEnabled: () => false,
    getManuscript: (...args: any[]) => mockGetManuscript(...args),
  };
});

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

describe('usePaperStorage Custom Hook (Task 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const samplePaper: CompletePaper = {
    id: '12345678-1234-1234-1234-123456789abc',
    displayName: 'Quantum Machine Learning',
    metadata: {
      title: 'Quantum Machine Learning',
      journalId: '00000000-0000-0000-0000-000000000000',
      articleType: 'Research Article',
      journalName: 'VNU J. Sci.',
      journalAbbv: 'VNU J. Sci.',
      authors: [],
      affiliations: [],
      corresponding: { name: '', email: '', affiliation: '' },
      abstract: 'Sample abstract',
      keywords: ['QML'],
      dates: { received: '', revised: '', accepted: '', published: '' },
      doi: '',
      volume: '',
      issue: '',
      year: '2026',
      firstPage: 1,
      lastPage: 10,
    },
    sections: [],
    references: [],
    version: 1,
  };

  it('saves paper to IndexedDB and syncs to API via updatePaper', async () => {
    mockUpdatePaper.mockResolvedValueOnce({
      id: '12345678-1234-1234-1234-123456789abc',
      title: 'Quantum Machine Learning',
      version: 2,
    });

    const { result } = renderHook(() => usePaperStorage(), {
      wrapper: createWrapper(),
    });

    let success = false;
    await act(async () => {
      success = await result.current.savePaper(samplePaper);
    });

    expect(success).toBe(true);
    expect(mockSavePaperToIndexedDb).toHaveBeenCalledWith(samplePaper);
    expect(mockUpdatePaper).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '12345678-1234-1234-1234-123456789abc',
        data: expect.objectContaining({
          title: 'Quantum Machine Learning',
        }),
      }),
    );
  });

  it('calls createPaper when paper has local non-UUID id', async () => {
    const localPaper = { ...samplePaper, id: 'temp-local-id' };
    mockCreatePaper.mockResolvedValueOnce({
      id: 'server-assigned-uuid',
      title: 'Quantum Machine Learning',
    });

    const { result } = renderHook(() => usePaperStorage(), {
      wrapper: createWrapper(),
    });

    let success = false;
    await act(async () => {
      success = await result.current.savePaper(localPaper);
    });

    expect(success).toBe(true);
    expect(mockCreatePaper).toHaveBeenCalledWith(localPaper);
  });

  it('persists locally even if cloud sync fails', async () => {
    mockUpdatePaper.mockRejectedValueOnce(new Error('Cloud sync error'));

    const { result } = renderHook(() => usePaperStorage(), {
      wrapper: createWrapper(),
    });

    let success = false;
    await act(async () => {
      success = await result.current.savePaper(samplePaper);
    });

    expect(success).toBe(true);
    expect(mockSavePaperToIndexedDb).toHaveBeenCalledWith(samplePaper);
  });

  it('loads paper from IndexedDB if available', async () => {
    mockLoadPaperFromIndexedDb.mockResolvedValueOnce(samplePaper);

    const { result } = renderHook(() => usePaperStorage(), {
      wrapper: createWrapper(),
    });

    let loaded: CompletePaper | null = null;
    await act(async () => {
      loaded = await result.current.loadPaper('ms-1234');
    });

    expect(loaded).toEqual(samplePaper);
    expect(mockLoadPaperFromIndexedDb).toHaveBeenCalledWith('ms-1234');
  });
});
