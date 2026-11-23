// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  usePathname: () => '/trash',
  useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

const api = vi.hoisted(() => ({ listTrash: vi.fn(), restoreFromTrash: vi.fn(), purgeFromTrash: vi.fn(), bulkTrash: vi.fn() }));
vi.mock('@structpaper/api-client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@structpaper/api-client')>()), ...api }));
vi.mock('@/components/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }, sileo: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

import { TrashView } from '@/features/trash';
import { Sidebar } from '@/components/layout/Sidebar';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from '@/components/toast';

const item = (id: string, title: string, daysLeft: number, over: Record<string, any> = {}): any => ({
  id,
  title,
  status: 'DRAFT',
  journal: { id: 'j', slug: 'vnuhcm-hs', code: 'VNUHCM-HS', name: 'Sức khỏe', color: '#2B74B7', shortName: 'HS' },
  owner: { id: 'u-owner', displayName: 'Lan' },
  deletedAt: '2026-11-18T08:00:00Z',
  deletedBy: { id: 'u-owner', displayName: 'Lan' },
  purgeAt: '2026-12-18T08:00:00Z',
  daysLeft,
  access: { canRestore: true, canPurge: true },
  ...over,
});
const LIST = { items: [item('p1', 'Bài đầu tiên', 29), item('p2', 'Bài sắp hết hạn', 2, { deletedBy: { id: 'u-admin', displayName: 'Quản lý' } })], retentionDays: 30 };

const loginWith = (capabilities?: string[]) => useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', capabilities }, isAuthenticated: true } as any);
const renderView = (ui: React.ReactElement = <TrashView />) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  vi.clearAllMocks();
  api.listTrash.mockResolvedValue(LIST);
  loginWith(['trash:manage']);
});
afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null, isAuthenticated: false } as any);
});

describe('the trash page', () => {
  it('lists the deleted papers with who deleted them, when, and how many days are left', async () => {
    renderView();
    const first = await screen.findByTestId('trash-item-p1');
    expect(first.textContent).toContain('Bài đầu tiên');
    expect(first.textContent).toContain('VNUHCM-HS');
    expect(first.textContent).toContain('bởi Lan');
    expect(screen.getByTestId('trash-days-p1').textContent).toContain('Còn 29 ngày');
    expect(screen.getByTestId('trash-item-p2').textContent).toContain('bởi Quản lý');
    expect(screen.getByTestId('trash-item-p2').textContent).toContain('chủ bài: Lan');
    expect(screen.queryByTestId('trash-note')).toBeNull();
    // a paper close to being removed stands out
    expect(screen.getByTestId('trash-days-p2').className).toContain('rose');
  });

  it('searches the trash by title', async () => {
    renderView();
    await screen.findByTestId('trash-item-p1');
    fireEvent.change(screen.getByTestId('trash-search'), { target: { value: 'hết hạn' } });
    await waitFor(() => expect(api.listTrash).toHaveBeenLastCalledWith({ search: 'hết hạn', limit: 200 }, undefined, expect.anything()));
  });

  it('restores at once, without a modal', async () => {
    api.restoreFromTrash.mockResolvedValue({ id: 'p1', title: 'Bài đầu tiên' });
    renderView();
    const btn = await screen.findByTestId('restore-p1');
    await act(async () => {
      fireEvent.click(btn);
    });
    expect(screen.queryByTestId('restore-trash-modal')).toBeNull();
    await waitFor(() => expect(api.restoreFromTrash).toHaveBeenCalledWith('p1'));
    expect(toast.success).toHaveBeenCalledWith('Đã khôi phục bài báo', expect.stringContaining('Bài đầu tiên'));
  });

  it('deletes for good only after a warning that it cannot be undone', async () => {
    api.purgeFromTrash.mockResolvedValue({ success: true });
    renderView();
    fireEvent.click(await screen.findByTestId('purge-p2'));
    const modal = await screen.findByTestId('purge-trash-modal');
    expect(modal.textContent).toContain('vĩnh viễn');
    expect(modal.textContent).toContain('Không thể hoàn tác');
    expect(api.purgeFromTrash).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-purge-trash-btn'));
    });
    await waitFor(() => expect(api.purgeFromTrash).toHaveBeenCalledWith('p2'));
  });

  it('says so when the server refuses', async () => {
    api.restoreFromTrash.mockRejectedValue(new Error('You may not restore or delete this manuscript'));
    renderView();
    const btn = await screen.findByTestId('restore-p1');
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Không khôi phục được', 'You may not restore or delete this manuscript'));
  });

  it('shows an empty trash and an empty search differently', async () => {
    api.listTrash.mockResolvedValue({ items: [], retentionDays: 30 });
    renderView();
    expect((await screen.findByTestId('trash-empty')).textContent).toContain('Thùng rác trống');
    fireEvent.change(screen.getByTestId('trash-search'), { target: { value: 'abc' } });
    await waitFor(() => expect(screen.getByTestId('trash-empty').textContent).toContain('Không tìm thấy bài báo nào'));
  });
});

describe('everybody has a trash', () => {
  const MINE = { items: [item('m1', 'Bài tôi đã xóa', 20, { access: { canRestore: true, canPurge: false } })], retentionDays: 30 };

  it('somebody without management rights sees what they deleted and can restore it; delete for good only where the server allows', async () => {
    loginWith([]);
    api.listTrash.mockResolvedValue(MINE);
    renderView();
    const card = await screen.findByTestId('trash-item-m1');
    expect(within(card).getByTestId('restore-m1')).toBeTruthy();
    expect(screen.queryByTestId('purge-m1')).toBeNull();
    expect(api.listTrash).toHaveBeenCalled();
  });

  it('a journal manager is told they also see their journals\' deletions, and gets "delete for good" where the server allows it', async () => {
    loginWith(['trash:manage']);
    renderView();
    await screen.findByTestId('trash-item-p1');
    expect(screen.getByTestId('purge-p1')).toBeTruthy();
  });

  it('what the server says about one paper decides its buttons, not the role', async () => {
    loginWith(['trash:manage']);
    api.listTrash.mockResolvedValue({ items: [item('a', 'Được phép', 5), item('b', 'Chỉ khôi phục', 5, { access: { canRestore: true, canPurge: false } })], retentionDays: 30 });
    renderView();
    await screen.findByTestId('trash-item-a');
    expect(screen.getByTestId('purge-a')).toBeTruthy();
    expect(screen.queryByTestId('purge-b')).toBeNull();
    expect(screen.getByTestId('restore-b')).toBeTruthy();
  });

  it('the dock shows the trash icon to everybody, right after the permissions item', () => {
    for (const capabilities of [['trash:manage'], [], undefined]) {
      loginWith(capabilities);
      const { unmount } = render(<Sidebar />);
      const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
      expect(hrefs).toContain('/trash');
      expect(hrefs.indexOf('/trash')).toBe(hrefs.indexOf('/permissions') + 1);
      unmount();
    }
  });
});

describe('while the server works', () => {
  const deferred = () => {
    let resolve!: (v: unknown) => void;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
  };

  it('the confirm button spins and the modal stays until the paper is really gone; only then the toast', async () => {
    const d = deferred();
    api.purgeFromTrash.mockReturnValue(d.promise);
    renderView();
    fireEvent.click(await screen.findByTestId('purge-p1'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('confirm-purge-trash-btn'));
    });
    const btn = screen.getByTestId('confirm-purge-trash-btn') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('Đang xử lý');
    expect(screen.getByTestId('purge-trash-modal')).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
    await act(async () => {
      d.resolve({ success: true });
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã xóa vĩnh viễn', expect.stringContaining('Bài đầu tiên')));
    await waitFor(() => expect(screen.queryByTestId('purge-trash-modal')).toBeNull());
  });
});

describe('browsing the trash like the papers page', () => {
  it('switches between cards and a table', async () => {
    renderView();
    await screen.findByTestId('trash-item-p1');
    expect(screen.queryByTestId('trash-table')).toBeNull();
    fireEvent.click(screen.getByTestId('trash-view-table'));
    const table = await screen.findByTestId('trash-table');
    expect(within(table).getByTestId('trash-item-p1').textContent).toContain('Bài đầu tiên');
    expect(within(table).getByTestId('restore-p2')).toBeTruthy();
    fireEvent.click(screen.getByTestId('trash-view-grid'));
    await waitFor(() => expect(screen.queryByTestId('trash-table')).toBeNull());
  });

  it('filters: about to expire, who deleted, journal; and sorts', async () => {
    api.listTrash.mockResolvedValue({
      items: [
        item('a', 'Bài Alpha', 20, { deletedBy: { id: 'u1', displayName: 'Tôi' } }),
        item('b', 'Bài Beta', 2, { purgeAt: '2026-11-20T08:00:00Z', deletedBy: { id: 'u-x', displayName: 'Khác' }, journal: { id: 'j2', slug: 'et', code: 'ET', name: 'ET', color: '#111', shortName: 'ET' } }),
      ],
      retentionDays: 30,
    });
    renderView();
    await screen.findByTestId('trash-item-a');
    expect(screen.getByTestId('trash-chip-soon').textContent).toContain('1');
    fireEvent.click(screen.getByTestId('trash-chip-soon'));
    await waitFor(() => expect(screen.queryByTestId('trash-item-a')).toBeNull());
    expect(screen.getByTestId('trash-item-b')).toBeTruthy();
    fireEvent.click(screen.getByTestId('trash-chip-mine'));
    await waitFor(() => expect(screen.queryByTestId('trash-item-b')).toBeNull());
    expect(screen.getByTestId('trash-item-a')).toBeTruthy();
    fireEvent.click(screen.getByTestId('trash-chip-all'));
    fireEvent.change(screen.getByTestId('trash-journal-select'), { target: { value: 'j2' } });
    await waitFor(() => expect(screen.queryByTestId('trash-item-a')).toBeNull());
    fireEvent.change(screen.getByTestId('trash-journal-select'), { target: { value: 'all' } });
    fireEvent.change(screen.getByTestId('trash-sort-select'), { target: { value: 'expiring' } });
    await waitFor(() => {
      const ids = screen.getAllByTestId(/^trash-item-/).map((e) => e.getAttribute('data-testid'));
      expect(ids).toEqual(['trash-item-b', 'trash-item-a']);
    });
  });

  it('selects several papers and restores them with one request', async () => {
    api.bulkTrash.mockResolvedValue({ done: 2, skipped: 0 });
    renderView();
    fireEvent.click(await screen.findByTestId('select-p1'));
    fireEvent.click(screen.getByTestId('select-p2'));
    expect(screen.getByTestId('trash-selected-count').textContent).toContain('2');
    await act(async () => {
      fireEvent.click(screen.getByTestId('restore-selected'));
    });
    expect(screen.queryByTestId('restore-trash-modal')).toBeNull();
    await waitFor(() => expect(api.bulkTrash).toHaveBeenCalledWith({ action: 'restore', ids: ['p1', 'p2'] }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Đã khôi phục 2 bài báo', expect.any(String)));
    expect(api.restoreFromTrash).not.toHaveBeenCalled();
  });

  it('empties the trash after a warning, only with the papers the user may delete for good', async () => {
    api.listTrash.mockResolvedValue({ items: [item('a', 'Được xóa', 5), item('b', 'Chỉ khôi phục', 5, { access: { canRestore: true, canPurge: false } })], retentionDays: 30 });
    api.bulkTrash.mockResolvedValue({ done: 1, skipped: 0 });
    renderView();
    fireEvent.click(await screen.findByTestId('empty-trash'));
    const modal = await screen.findByTestId('purge-trash-modal');
    expect(modal.textContent).toContain('Không thể hoàn tác');
    expect(api.bulkTrash).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-purge-trash-btn'));
    });
    await waitFor(() => expect(api.bulkTrash).toHaveBeenCalledWith({ action: 'purge', ids: ['a'] }));
  });

  it('"restore all" restores every paper shown at once', async () => {
    api.bulkTrash.mockResolvedValue({ done: 2, skipped: 0 });
    renderView();
    const btn = await screen.findByTestId('restore-all');
    await act(async () => {
      fireEvent.click(btn);
    });
    await waitFor(() => expect(api.bulkTrash).toHaveBeenCalledWith({ action: 'restore', ids: ['p1', 'p2'] }));
  });
});

describe('reading a paper in the trash', () => {
  it('a click on a card or a row opens its preview; the buttons and the tick do not', async () => {
    renderView();
    const card = await screen.findByTestId('trash-item-p1');
    fireEvent.click(within(card).getByTestId('restore-p1'));
    fireEvent.click(within(card).getByTestId('select-p1'));
    expect(push).not.toHaveBeenCalled();
    fireEvent.click(card);
    expect(push).toHaveBeenCalledWith('/trash/p1');
    fireEvent.click(screen.getByTestId('trash-view-table'));
    const row = await screen.findByTestId('trash-table');
    fireEvent.click(within(row).getByTestId('trash-item-p2'));
    expect(push).toHaveBeenLastCalledWith('/trash/p2');
  });
});
