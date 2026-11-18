// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, renderHook } from '@testing-library/react';
import { createEmptyPaper } from '@/types/paper';
import { PaperProvider, usePaper } from '@/context/PaperContext';

const loadPaper = vi.fn(async (id: string) => {
  const p = createEmptyPaper();
  p.id = id;
  return p;
});

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'paper_old' }),
  useSearchParams: () => new URLSearchParams('id=paper_old'),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@/features/editor', () => ({
  usePaperStorage: () => ({ loadPaper }),
  UnifiedEditorView: () => null,
}));

afterEach(() => {
  cleanup();
  loadPaper.mockClear();
});

describe('PaperContext setters', () => {
  it('keep their identity across renders', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => <PaperProvider>{children}</PaperProvider>;
    const { result, rerender } = renderHook(() => usePaper(), { wrapper });
    const first = { setPaper: result.current.setPaper, setCurrentJournal: result.current.setCurrentJournal, updatePaper: result.current.updatePaper };
    act(() => result.current.setPaper({ ...result.current.paper, id: 'x' }));
    rerender();
    expect(result.current.setPaper).toBe(first.setPaper);
    expect(result.current.setCurrentJournal).toBe(first.setCurrentJournal);
    expect(result.current.updatePaper).toBe(first.updatePaper);
  });
});

describe('/papers/[id] page', () => {
  it('loads the paper once, not in a loop (each load re-renders the provider)', async () => {
    const { default: PaperDetailPage } = await import('@/app/(authenticate)/(workspace)/papers/[id]/page');
    render(
      <PaperProvider>
        <PaperDetailPage params={{ id: 'paper_old' }} />
      </PaperProvider>
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 300));
    });
    expect(loadPaper).toHaveBeenCalledTimes(1);
  });
});
