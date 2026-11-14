// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePaperStorage } from '@/features/editor';
import type { CompletePaper } from '@/types/paper';

const mockSavePaperToIndexedDb = vi.fn().mockResolvedValue(true);
const mockLoadPaperFromIndexedDb = vi.fn().mockResolvedValue(null);
vi.mock('@/lib/storage/paper-sync', () => ({
  savePaperToIndexedDb: (...args: any[]) => mockSavePaperToIndexedDb(...args),
  loadPaperFromIndexedDb: (...args: any[]) => mockLoadPaperFromIndexedDb(...args),
}));

const mockUpdateManuscript = vi.fn();
const mockCreateManuscript = vi.fn();
const mockGetManuscript = vi.fn();

vi.mock('@structpaper/api-client', async () => {
  const actual = await vi.importActual<any>('@structpaper/api-client');
  return {
    ...actual,
    isMockModeEnabled: () => false,
    updateManuscript: (...args: any[]) => mockUpdateManuscript(...args),
    createManuscript: (...args: any[]) => mockCreateManuscript(...args),
    getManuscript: (...args: any[]) => mockGetManuscript(...args),
  };
});

describe('usePaperStorage ID Synchronization & Query Invalidation (Task 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createPaperFixture = (id: string): CompletePaper => ({
    id,
    displayName: 'Quantum Machine Learning Paper',
    metadata: {
      title: 'Quantum Machine Learning Paper',
      journalId: 'vnu-journal-id',
      articleType: 'Research Article',
      journalName: 'VNU Journal of Science',
      journalAbbv: 'VNU J. Sci.',
      authors: [],
      affiliations: [],
      corresponding: { name: '', email: '', affiliation: '' },
      abstract: 'Abstract about QML algorithms.',
      keywords: ['Quantum', 'ML'],
      dates: { received: '', revised: '', accepted: '', published: '' },
      doi: '',
      volume: '',
      issue: '',
      year: '2026',
      firstPage: 1,
      lastPage: 12,
    },
    sections: [],
    references: [],
    version: 1,
  });

  function createTestQueryClient() {
    return new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  }

  it('saves new paper with local ID paper-123, updates paper.id to returned UUID, re-saves to IndexedDB, and invalidates queries', async () => {
    const serverAssignedUuid = '550e8400-e29b-41d4-a716-446655440000';
    mockCreateManuscript.mockResolvedValueOnce({
      id: serverAssignedUuid,
      title: 'Quantum Machine Learning Paper',
      version: 1,
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => usePaperStorage(), { wrapper });

    const localPaper = createPaperFixture('paper-123');

    let success = false;
    await act(async () => {
      success = await result.current.savePaper(localPaper);
    });

    expect(success).toBe(true);

    // 1. Verify createManuscript was called with expected payload
    expect(mockCreateManuscript).toHaveBeenCalledTimes(1);
    expect(mockCreateManuscript).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Quantum Machine Learning Paper',
        journalId: 'vnu-journal-id',
      }),
    );

    // 2. Verify paper.id was synchronized to the returned server UUID
    expect(localPaper.id).toBe(serverAssignedUuid);
    expect((localPaper as any).version).toBe(1);

    // 3. Verify IndexedDB save was called both initially and updated with the server UUID
    expect(mockSavePaperToIndexedDb).toHaveBeenCalledTimes(2);
    expect(mockSavePaperToIndexedDb).toHaveBeenLastCalledWith(
      expect.objectContaining({
        id: serverAssignedUuid,
        displayName: 'Quantum Machine Learning Paper',
      }),
    );

    // 4. Verify React Query cache invalidation
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['/api/v1/manuscripts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['manuscripts'] });
  });

  it('updates existing paper with UUID and invalidates react-query cache', async () => {
    const existingUuid = '550e8400-e29b-41d4-a716-446655440000';
    mockUpdateManuscript.mockResolvedValueOnce({
      id: existingUuid,
      title: 'Quantum Machine Learning Paper',
      version: 2,
    });

    const queryClient = createTestQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => usePaperStorage(), { wrapper });

    const existingPaper = createPaperFixture(existingUuid);

    let success = false;
    await act(async () => {
      success = await result.current.savePaper(existingPaper);
    });

    expect(success).toBe(true);
    expect(mockUpdateManuscript).toHaveBeenCalledWith(
      existingUuid,
      expect.objectContaining({
        title: 'Quantum Machine Learning Paper',
      }),
      { ifMatch: '"1"' },
    );

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['/api/v1/manuscripts'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['manuscripts'] });
  });

  it('functions safely without QueryClientProvider without throwing error', async () => {
    const serverAssignedUuid = '550e8400-e29b-41d4-a716-446655440000';
    mockCreateManuscript.mockResolvedValueOnce({
      id: serverAssignedUuid,
      title: 'Standalone Hook Paper',
      version: 1,
    });

    // Render without wrapper/QueryClientProvider
    const { result } = renderHook(() => usePaperStorage());

    const paper = createPaperFixture('paper-isolated-999');

    let success = false;
    await act(async () => {
      success = await result.current.savePaper(paper);
    });

    expect(success).toBe(true);
    expect(paper.id).toBe(serverAssignedUuid);
    expect(mockSavePaperToIndexedDb).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: serverAssignedUuid }),
    );
  });
});
