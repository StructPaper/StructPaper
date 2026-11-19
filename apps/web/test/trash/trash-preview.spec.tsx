// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const nav = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => '/trash/p1', useRouter: () => nav }));

const api = vi.hoisted(() => ({ getTrashedManuscript: vi.fn(), restoreFromTrash: vi.fn(), purgeFromTrash: vi.fn() }));
vi.mock('@structpaper/api-client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@structpaper/api-client')>()), ...api }));
vi.mock('@/components/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }, sileo: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

const session = vi.hoisted(() => ({ setTrashBar: vi.fn() }));
vi.mock('@/context/EditorSessionContext', () => ({ useEditorSession: () => session }));

vi.mock('@/features/editor/components/ReadOnlyPaperView', () => ({
  ReadOnlyPaperView: (p: any) => (
    <div data-testid="readonly-paper" data-title={p.paper.displayName ?? p.paper.metadata?.title} data-fallback={p.backFallback}>
      {p.banner}
    </div>
  ),
}));

import { TrashPreviewView } from '@/features/trash';
import { toast } from '@/components/toast';

const paper = (over: Record<string, any> = {}): any => ({
  id: 'p1',
  title: 'Bài đã xóa',
  status: 'DRAFT',
  journal: { id: 'j', slug: 's', code: 'VNUHCM-HS', name: 'HS', color: '#2B74B7', shortName: 'HS' },
  owner: { id: 'u', displayName: 'Lan' },
  deletedAt: '2026-11-18T08:00:00Z',
  deletedBy: { id: 'u', displayName: 'Lan' },
  purgeAt: '2026-12-18T08:00:00Z',
  daysLeft: 12,
  access: { canRestore: true, canPurge: true },
  metadata: { doc: { metadata: { title: 'Tiêu đề trong nội dung' }, sections: [] } },
  ...over,
});
const renderView = () =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><TrashPreviewView id="p1" /></QueryClientProvider>);

const lastBar = (): any => [...session.setTrashBar.mock.calls].reverse().map((c) => c[0]).find(Boolean);

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  api.getTrashedManuscript.mockResolvedValue(paper());
});
afterEach(cleanup);

describe('the preview of a paper in the trash', () => {
  it('opens it in the read-only paper page and puts what it says about the paper in the title bar', async () => {
    renderView();
    const page = await screen.findByTestId('readonly-paper');
    expect(page.getAttribute('data-title')).toBe('Bài đã xóa');
    expect(page.getAttribute('data-fallback')).toBe('/trash');
    await waitFor(() => expect(lastBar()).toBeTruthy());
    expect(lastBar()).toMatchObject({ daysLeft: 12, deletedBy: 'Lan', busy: false });
    expect(lastBar().onRestore).toBeTypeOf('function');
    expect(lastBar().onPurge).toBeTypeOf('function');
    expect(api.getTrashedManuscript).toHaveBeenCalledWith('p1', undefined, expect.anything());
  });

  it('offers no "delete for good" when the server does not allow it', async () => {
    api.getTrashedManuscript.mockResolvedValue(paper({ access: { canRestore: true, canPurge: false } }));
    renderView();
    await waitFor(() => expect(lastBar()).toBeTruthy());
    expect(lastBar().onRestore).toBeTypeOf('function');
    expect(lastBar().onPurge).toBeUndefined();
  });

  it('restores from the title bar at once (no modal), spinning until done, then opens the paper', async () => {
    let done!: (v: unknown) => void;
    api.restoreFromTrash.mockReturnValue(new Promise((r) => (done = r)));
    renderView();
    await waitFor(() => expect(lastBar()).toBeTruthy());
    await act(async () => lastBar().onRestore());
    expect(screen.queryByTestId('restore-trash-modal')).toBeNull();
    expect(lastBar().busy).toBe(true);
    expect(lastBar().restoring).toBe(true);
    expect(toast.success).not.toHaveBeenCalled();
    await act(async () => done({ id: 'p1', title: 'Bài đã xóa' }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(nav.replace).toHaveBeenCalledWith('/papers/p1');
  });

  it('says so when the paper is no longer there, with a way back', async () => {
    api.getTrashedManuscript.mockRejectedValue(new Error('403'));
    renderView();
    expect(await screen.findByTestId('trash-preview-missing')).toBeTruthy();
    fireEvent.click(screen.getByTestId('trash-preview-back'));
    expect(nav.push).toHaveBeenCalledWith('/trash');
  });
});
