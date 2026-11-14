// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useManagedJournals } from '@/features/templates/hooks/useManagedJournals';
import { http } from '@structpaper/api-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/context/PaperContext', () => ({
  usePaper: () => ({
    setPaper: vi.fn(),
    setCurrentJournal: vi.fn(),
  }),
}));

vi.mock('@/features/editor', () => ({
  usePaperStorage: () => ({
    savePaper: vi.fn().mockResolvedValue(undefined),
  }),
}));

describe('useManagedJournals (Templates & Backend Sync)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('loads default journals and syncs with backend /api/v1/journals', async () => {
    const backendJournalsMock = [
      {
        id: 'journal-uuid-1',
        slug: 'vnuhcm-std',
        code: 'VNUHCM-STD',
        name: 'Tạp chí Phát triển Khoa học và Công nghệ',
        shortName: 'STD',
        color: '#000099',
        status: 'published',
        articleTypes: ['research', 'review'],
        version: 1,
      },
      {
        id: 'journal-uuid-2',
        slug: 'vnuhcm-hs',
        code: 'VNUHCM-HS',
        name: 'Tạp chí Phát triển KH&CN - Khoa học Sức khỏe',
        shortName: 'HS',
        color: '#2B74B7',
        status: 'published',
        articleTypes: ['research', 'case-report'],
        version: 1,
      },
    ];

    const getSpy = vi.spyOn(http, 'get').mockResolvedValueOnce(backendJournalsMock as any);

    const { result } = renderHook(() => useManagedJournals());

    await waitFor(() => {
      expect(getSpy).toHaveBeenCalledWith('/api/v1/journals');
      expect(result.current.journals.length).toBeGreaterThanOrEqual(2);
    });

    const stdJournal = result.current.journals.find((j) => j.id.toLowerCase().includes('std'));
    expect(stdJournal).toBeDefined();
    expect(stdJournal?.status).toBe('published');
  });
});
