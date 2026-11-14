// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocumentApi } from '@/lib/documents/document-api';
import { DocumentSync } from '@/lib/documents/document-sync';
import type { CompletePaper } from '@/types/paper';

describe('DocumentApi & DocumentSync with NestJS Backend (Task 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const samplePaper: CompletePaper = {
    id: '12345678-1234-1234-1234-123456789abc',
    displayName: 'Automated Paper',
    metadata: {
      title: 'Automated Paper',
      journalId: '00000000-0000-0000-0000-000000000000',
      articleType: 'Research Article',
      journalName: 'VNU J. Sci.',
      journalAbbv: 'VNU J. Sci.',
      authors: [],
      affiliations: [],
      corresponding: { name: '', email: '', affiliation: '' },
      abstract: 'Abstract',
      keywords: [],
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

  it('DocumentApi calls /api/v1/manuscripts with PATCH and If-Match header on save', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '12345678-1234-1234-1234-123456789abc',
        title: 'Automated Paper',
        version: 2,
        updatedAt: '2026-11-14T01:00:00Z',
      }),
    });

    const api = new DocumentApi('http://localhost:3000', mockFetch);
    const result = await api.save('12345678-1234-1234-1234-123456789abc', {
      name: 'Automated Paper',
      baseRev: 1,
      doc: samplePaper,
    });

    expect(result.rev).toBe(2);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/manuscripts/12345678-1234-1234-1234-123456789abc',
      expect.objectContaining({
        method: 'PATCH',
        headers: expect.objectContaining({
          'If-Match': '"1"',
        }),
      }),
    );
  });

  it('DocumentSync successfully pushes and tracks knownRev with NestJS API', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: '12345678-1234-1234-1234-123456789abc',
        title: 'Automated Paper',
        version: 2,
        updatedAt: '2026-11-14T01:00:00Z',
      }),
    });

    const api = new DocumentApi('http://localhost:3000', mockFetch);
    const sync = new DocumentSync({ api });

    const saveRes = await sync.push(samplePaper);
    expect(saveRes.rev).toBe(2);
    expect(sync.knownRev(samplePaper.id)).toBe(2);
  });

  it('DocumentApi list maps manuscripts array to DocumentSummary', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          id: 'ms-1',
          title: 'Paper One',
          journalId: 'vnu-jst',
          status: 'DRAFT',
          version: 3,
          createdAt: '2026-11-14T00:00:00Z',
          updatedAt: '2026-11-14T01:00:00Z',
        },
      ],
    });

    const api = new DocumentApi('http://localhost:3000', mockFetch);
    const list = await api.list();

    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('ms-1');
    expect(list[0].name).toBe('Paper One');
    expect(list[0].rev).toBe(3);
  });
});
