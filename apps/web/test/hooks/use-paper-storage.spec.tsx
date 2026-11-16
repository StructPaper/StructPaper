// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePaperStorage } from '@/features/editor';
import { StorageProvider } from '@/context/StorageContext';
import type { CompletePaper } from '@/types/paper';

const mockSavePaperToIndexedDb = vi.fn().mockResolvedValue(true);
const mockLoadPaperFromIndexedDb = vi.fn();
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
    manuscriptApi: {
      ...actual.manuscriptApi,
      update: (...args: any[]) => mockUpdateManuscript(...args),
      create: (...args: any[]) => mockCreateManuscript(...args),
      get: (...args: any[]) => mockGetManuscript(...args),
    },
    isMockModeEnabled: () => false,
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StorageProvider enableLocal={true}>{children}</StorageProvider>
);

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

  it('saves paper to IndexedDB and syncs to API via updateManuscript', async () => {
    mockUpdateManuscript.mockResolvedValueOnce({
      id: '12345678-1234-1234-1234-123456789abc',
      title: 'Quantum Machine Learning',
      version: 2,
    });

    const { result } = renderHook(() => usePaperStorage(), { wrapper });

    let success = false;
    await act(async () => {
      success = await result.current.savePaper(samplePaper);
    });

    expect(success).toBe(true);
    expect(mockSavePaperToIndexedDb).toHaveBeenCalledWith(samplePaper);
    expect(mockUpdateManuscript).toHaveBeenCalledWith(
      '12345678-1234-1234-1234-123456789abc',
      expect.objectContaining({
        title: 'Quantum Machine Learning',
      }),
      { 'If-Match': '"1"' },
    );
  });

  it('calls createManuscript when paper has local non-UUID id', async () => {
    const localPaper = { ...samplePaper, id: 'temp-local-id' };
    mockCreateManuscript.mockResolvedValueOnce({
      id: 'server-assigned-uuid',
      title: 'Quantum Machine Learning',
      version: 1,
    });

    const { result } = renderHook(() => usePaperStorage(), { wrapper });

    let success = false;
    await act(async () => {
      success = await result.current.savePaper(localPaper);
    });

    expect(success).toBe(true);
    expect(mockCreateManuscript).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Quantum Machine Learning',
      }),
    );
  });

  it('persists locally even if cloud sync fails', async () => {
    mockUpdateManuscript.mockRejectedValueOnce(new Error('Cloud sync error'));

    const { result } = renderHook(() => usePaperStorage(), { wrapper });

    let success = false;
    await act(async () => {
      success = await result.current.savePaper(samplePaper);
    });

    expect(success).toBe(true);
    expect(mockSavePaperToIndexedDb).toHaveBeenCalledWith(samplePaper);
  });

  it('loads paper from IndexedDB if available', async () => {
    mockLoadPaperFromIndexedDb.mockResolvedValueOnce(samplePaper);

    const { result } = renderHook(() => usePaperStorage(), { wrapper });

    let loaded: CompletePaper | null = null;
    await act(async () => {
      loaded = await result.current.loadPaper('12345678-1234-1234-1234-123456789abc');
    });

    expect(loaded).toEqual(samplePaper);
    expect(mockLoadPaperFromIndexedDb).toHaveBeenCalledWith('12345678-1234-1234-1234-123456789abc');
  });
});
