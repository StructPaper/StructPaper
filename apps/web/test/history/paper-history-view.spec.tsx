// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), usePathname: () => '/papers/p/history', useParams: () => ({ id: 'p' }) }));

const api = vi.hoisted(() => ({
  listManuscriptRevisions: vi.fn(),
  getManuscriptRevision: vi.fn(),
  getManuscript: vi.fn(),
  createManuscriptRevision: vi.fn(),
  updateManuscriptRevision: vi.fn(),
  deleteManuscriptRevision: vi.fn(),
  restoreManuscriptRevision: vi.fn(),
  duplicateManuscriptRevision: vi.fn(),
  http: { get: vi.fn(), patch: vi.fn() },
}));
vi.mock('@structpaper/api-client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@structpaper/api-client')>()), ...api }));
vi.mock('@/components/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }, toastStore: { dismissToast: vi.fn() } }));

import { PaperHistoryView } from '@/features/history';
import { EditorSessionProvider } from '@/context/EditorSessionContext';
import { PaperHistoryTitleBarInfo, PaperHistorySaveButton, PaperHistoryDetailToggle } from '@/components/titlebar/PaperHistoryTitleBarInfo';
import { toast } from '@/components/toast';

const stats = (over: Record<string, number | boolean> = {}) => ({ blocksAdded: 0, blocksRemoved: 0, blocksModified: 0, blocksMoved: 0, wordsDelta: 0, refsDelta: 0, fieldsChanged: 0, itemsChanged: 0, layoutChanged: false, ...over });
const summary = (id: string, kind: string, at: string, over: Record<string, any> = {}) => ({
  id, manuscriptId: 'p', kind, name: null, description: null, pinned: kind === 'named', createdAt: at, author: { id: 'u', displayName: 'Lan' }, stats: stats(), sizeBytes: 100, ...over,
});

const docV1 = { metadata: { title: 'Tiêu đề cũ', authors: [], affiliations: [], keywords: [] }, sections: [{ id: 's1', type: 'paragraph', content: 'Đoạn một.' }], references: [] };
const docV2 = { metadata: { title: 'Tiêu đề mới', authors: [], affiliations: [], keywords: [] }, sections: [{ id: 's1', type: 'paragraph', content: 'Đoạn một đã sửa.' }, { id: 's2', type: 'paragraph', content: 'Đoạn mới.' }], references: [] };

const LIST = {
  items: [
    summary('r2', 'named', '2026-11-19T10:00:00Z', { name: 'Gửi lần 1', stats: stats({ blocksAdded: 1, blocksModified: 1 }) }),
    summary('r1', 'auto', '2026-11-19T08:00:00Z'),
  ],
  nextBefore: null,
};

function mockApi() {
  api.listManuscriptRevisions.mockResolvedValue(LIST);
  api.getManuscriptRevision.mockImplementation(async (_id: string, rid: string) => ({ ...LIST.items.find((i) => i.id === rid), doc: rid === 'r2' ? docV2 : docV1 }));
  api.getManuscript.mockResolvedValue({ id: 'p', title: 'Bài thử', version: 5, updatedAt: '2026-11-19T11:00:00Z', access: { canEdit: true }, metadata: { doc: docV2 } });
}

const renderView = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <EditorSessionProvider>
        {/* the way back and the save button live in the title bar */}
        <PaperHistoryTitleBarInfo />
        <PaperHistoryDetailToggle />
        <PaperHistorySaveButton />
        <PaperHistoryView paperId="p" />
      </EditorSessionProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockApi();
});
afterEach(cleanup);

describe('the history page of a paper', () => {
  it('switches to the detailed way of reading from the title bar, and back', async () => {
    renderView();
    await screen.findByTestId('document-diff-view');
    expect(screen.queryByTestId('detailed-diff-view')).toBeNull();
    const toggle = await screen.findByTestId('history-detail-toggle');
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(toggle);
    expect(await screen.findByTestId('detailed-diff-view')).toBeTruthy();
    expect(screen.queryByTestId('document-diff-view')).toBeNull();
    expect(screen.getByTestId('history-detail-toggle').getAttribute('aria-pressed')).toBe('true');
    // the tabs of the editor, with the changes counted
    expect(screen.getByTestId('detail-tab-layout')).toBeTruthy();
    expect(screen.getByTestId('detail-count-metadata').textContent).toBe('1');
    fireEvent.click(screen.getByTestId('history-detail-toggle'));
    expect(await screen.findByTestId('document-diff-view')).toBeTruthy();
  });

  it('lists the versions with the current one first, and opens on the newest version', async () => {
    renderView();
    await screen.findByTestId('revision-r2');
    expect(screen.getByTestId('revision-current')).toBeTruthy();
    expect(screen.getByTestId('revision-r2').textContent).toContain('Gửi lần 1');
    expect(screen.getByTestId('revision-r2').textContent).toContain('+1 khối');
    await waitFor(() => expect(screen.getByTestId('version-title').textContent).toBe('Gửi lần 1'));
  });

  it('shows what the version changed against the one before it, and can hide the marks', async () => {
    renderView();
    await screen.findByTestId('diff-summary');
    const view = screen.getByTestId('document-diff-view');
    // title changed (old struck, new marked), one paragraph edited, one added
    expect(within(view).getAllByTestId('mark-del').length).toBeGreaterThan(0);
    expect(within(view).getAllByTestId('mark-add').length).toBeGreaterThan(0);
    expect(view.querySelector('[data-block="s2"][data-change="added"]')).toBeTruthy();
    expect(view.querySelector('[data-block="s1"][data-change="modified"]')).toBeTruthy();

    fireEvent.click(screen.getByTestId('toggle-changes'));
    await waitFor(() => expect(screen.queryByTestId('diff-summary')).toBeNull());
    expect(screen.queryAllByTestId('mark-add')).toHaveLength(0);
  });

  it('opening an older version shows its own content', async () => {
    renderView();
    fireEvent.click(await screen.findByTestId('revision-r1'));
    await waitFor(() => expect(screen.getByTestId('version-title').textContent).toBe('Phiên bản tự động'));
    await waitFor(() => expect(screen.getByTestId('document-diff-view').textContent).toContain('Tiêu đề cũ'));
    expect(screen.getByTestId('document-diff-view').textContent).not.toContain('Đoạn mới.');
  });

  it('filters the list by kind', async () => {
    renderView();
    await screen.findByTestId('revision-r2');
    fireEvent.click(screen.getByTestId('filter-named'));
    expect(screen.queryByTestId('revision-r1')).toBeNull();
    expect(screen.getByTestId('revision-r2')).toBeTruthy();
    fireEvent.click(screen.getByTestId('filter-restore'));
    expect(screen.getByTestId('revision-empty').textContent).toContain('Không có phiên bản nào thuộc loại này');
  });

  it('keeps the paper under a name', async () => {
    api.createManuscriptRevision.mockResolvedValue(summary('r3', 'named', '2026-11-19T12:00:00Z', { name: 'Bản gửi' }));
    renderView();
    fireEvent.click(await screen.findByTestId('history-save-version'));
    const input = await screen.findByTestId('version-name-input');
    expect((screen.getByTestId('version-name-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Bản gửi' } });
    fireEvent.change(screen.getByTestId('version-description-input'), { target: { value: 'cho tòa soạn' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('version-name-submit'));
    });
    await waitFor(() => expect(api.createManuscriptRevision).toHaveBeenCalledWith('p', { name: 'Bản gửi', description: 'cho tòa soạn', kind: 'named' }));
    expect(toast.success).toHaveBeenCalledWith('Đã lưu phiên bản', expect.stringContaining('Bản gửi'));
  });

  it('restores after a confirmation, then goes back to the editor', async () => {
    api.restoreManuscriptRevision.mockResolvedValue({ version: 6, restoredAs: summary('r9', 'restore', '2026-11-19T12:00:00Z') });
    renderView();
    fireEvent.click(await screen.findByTestId('revision-r1'));
    fireEvent.click(await screen.findByTestId('restore-version'));
    expect(await screen.findByTestId('restore-confirm-modal')).toBeTruthy();
    expect(api.restoreManuscriptRevision).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-restore-btn'));
    });
    await waitFor(() => expect(api.restoreManuscriptRevision).toHaveBeenCalledWith('p', 'r1'));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/papers/p'));
  });

  it('only a named version can be deleted, and it asks first', async () => {
    api.deleteManuscriptRevision.mockResolvedValue({ success: true });
    renderView();
    fireEvent.click(await screen.findByTestId('revision-r1')); // automatic
    await screen.findByTestId('restore-version');
    expect(screen.queryByTestId('delete-version')).toBeNull();

    fireEvent.click(screen.getByTestId('revision-r2')); // named
    fireEvent.click(await screen.findByTestId('delete-version'));
    await act(async () => {
      fireEvent.click(await screen.findByTestId('confirm-delete-version-btn'));
    });
    await waitFor(() => expect(api.deleteManuscriptRevision).toHaveBeenCalledWith('p', 'r2'));
  });

  it('naming an automatic version, and making a copy from a version', async () => {
    api.updateManuscriptRevision.mockResolvedValue(summary('r1', 'named', '2026-11-19T08:00:00Z', { name: 'Bản đầu' }));
    api.duplicateManuscriptRevision.mockResolvedValue({ id: 'copy-1' });
    renderView();
    fireEvent.click(await screen.findByTestId('revision-r1'));
    fireEvent.click(await screen.findByTestId('rename-version'));
    fireEvent.change(await screen.findByTestId('version-name-input'), { target: { value: 'Bản đầu' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('version-name-submit'));
    });
    await waitFor(() => expect(api.updateManuscriptRevision).toHaveBeenCalledWith('p', 'r1', { name: 'Bản đầu', description: null }));

    await act(async () => {
      fireEvent.click(screen.getByTestId('duplicate-version'));
    });
    await waitFor(() => expect(api.duplicateManuscriptRevision).toHaveBeenCalledWith('p', 'r1'));
    expect(toast.success).toHaveBeenCalledWith('Đã tạo bản sao', expect.any(String), expect.objectContaining({ action: expect.objectContaining({ label: 'Mở bản sao' }) }));
  });

  it('takes one block of an older version into the paper as it is now, with a new id', async () => {
    api.http.get.mockResolvedValue({ data: { version: 5, metadata: { doc: docV2 } } });
    api.http.patch.mockResolvedValue({});
    renderView();
    fireEvent.click(await screen.findByTestId('revision-r1'));
    await waitFor(() => expect(screen.getByTestId('document-diff-view').textContent).toContain('Tiêu đề cũ'));
    await act(async () => {
      fireEvent.click(screen.getByTestId('insert-block-s1'));
    });
    await waitFor(() => expect(api.http.patch).toHaveBeenCalled());
    const [url, body, config] = api.http.patch.mock.calls[0];
    expect(url).toBe('/api/v1/manuscripts/p');
    expect(config.headers['If-Match']).toBe('"5"');
    const sections = body.metadata.doc.sections;
    expect(sections).toHaveLength(3);
    expect(sections[2].content).toBe('Đoạn một.');
    expect(sections[2].id).not.toBe('s1');
  });

  it('hides naming, restoring and copying from someone who may not edit', async () => {
    api.getManuscript.mockResolvedValue({ id: 'p', title: 'Bài thử', version: 5, access: { canEdit: false }, metadata: { doc: docV2 } });
    renderView();
    fireEvent.click(await screen.findByTestId('revision-r1'));
    await screen.findByTestId('version-title');
    expect(screen.queryByTestId('restore-version')).toBeNull();
    expect(screen.queryByTestId('history-save-version')).toBeNull();
  });
});
