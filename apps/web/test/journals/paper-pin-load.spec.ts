import { describe, it, expect } from 'vitest';
import { manuscriptToCompletePaper } from '@/features/papers/hooks/useLoadPaper';
import { manuscriptToCompletePaper as storageToCompletePaper } from '@/lib/storage/converters';
import { normalizeCompletePaper } from '@/types/paper';

const server = {
  id: '37cdc2a3-736b-4bd8-a02f-753359e7caf1',
  title: 'Bài thử',
  journalId: 'f3a1c6a0-0000-4000-8000-000000000001',
  status: 'DRAFT',
  version: 3,
  createdAt: '2026-11-19T00:00:00Z',
  updatedAt: '2026-11-19T00:00:00Z',
  profilePin: { base: 1, journal: 2, articleType: 1 },
  articleType: 'research',
  journal: { id: 'f3a1c6a0-0000-4000-8000-000000000001', slug: 'vnuhcm-hs', code: 'VNUHCM-HS', name: 'HS', color: '#2B74B7', shortName: 'HS' },
  metadata: { journalId: 'VNUHCM-HS', articleType: 'Bài báo nghiên cứu' },
} as any;

describe('a paper opened from the server carries the rules it is pinned to', () => {
  it('the profile versions and the article type code come with it', () => {
    for (const toPaper of [manuscriptToCompletePaper, storageToCompletePaper]) {
      const paper = toPaper(server);
      expect(paper.profilePin).toEqual({ base: 1, journal: 2, articleType: 1 });
      expect(paper.articleTypeCode).toBe('research');
    }
  });

  it('a paper without a pin (made before pinning, or only on this machine) has none, and nothing breaks', () => {
    const paper = manuscriptToCompletePaper({ ...server, profilePin: undefined, articleType: null });
    expect(paper.profilePin).toBeUndefined();
    expect(paper.articleTypeCode).toBeUndefined();
  });

  it('normalising a paper does not fill in a full layout: it keeps only what the author changed', () => {
    expect(normalizeCompletePaper({ ...manuscriptToCompletePaper(server), layoutSettings: undefined } as any).layoutSettings).toBeUndefined();
    expect(normalizeCompletePaper({ ...manuscriptToCompletePaper(server), layoutSettings: { fontSize: '10pt' } } as any).layoutSettings).toEqual({ fontSize: '10pt' });
  });
});
