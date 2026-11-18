// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { resolveProfile, clearRemoteProfiles, JOURNAL_DEFINITIONS } from '@structpaper/journal-profiles';

const api = vi.hoisted(() => ({
  getPublishedProfiles: vi.fn(),
  listProfileVersions: vi.fn(),
  rollbackProfile: vi.fn(),
}));
vi.mock('@structpaper/api-client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@structpaper/api-client')>()), ...api }));
vi.mock('@/components/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import { PublishedProfilesSync } from '@/features/journals/components/PublishedProfilesSync';
import { registerPublished } from '@/features/journals/hooks/usePublishedProfiles';
import { JournalVersionsTab } from '@/features/templates/components/tabs/JournalVersionsTab';
import { useAuthStore } from '@/lib/auth-store';
import { toast } from '@/components/toast';

const renderWithClient = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});
afterEach(() => {
  cleanup();
  clearRemoteProfiles();
  useAuthStore.setState({ user: null, isAuthenticated: false, token: null });
});

describe('registering what the server published', () => {
  const published = (baseVersion: number) => ({
    base: { version: baseVersion, config: {} },
    journals: { hs: { version: 3, config: { ...JOURNAL_DEFINITIONS.hs, color: '#abcdef' } } },
    etag: '"x"',
  });

  it('makes the profile resolver follow the server', () => {
    registerPublished(published(1) as any);
    expect(resolveProfile('hs').color).toBe('#abcdef');
  });

  it('a server answering from its built-ins (version 0) leaves the resolver on the code definitions', () => {
    registerPublished(published(1) as any);
    registerPublished(published(0) as any);
    expect(resolveProfile('hs').color).toBe(JOURNAL_DEFINITIONS.hs.color);
  });

  it('the root component registers after loading, and tolerates a failing request', async () => {
    api.getPublishedProfiles.mockResolvedValue(published(2));
    renderWithClient(<PublishedProfilesSync />);
    await waitFor(() => expect(resolveProfile('hs').color).toBe('#abcdef'));

    cleanup();
    clearRemoteProfiles();
    api.getPublishedProfiles.mockRejectedValue(new Error('offline'));
    renderWithClient(<PublishedProfilesSync />);
    await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
    expect(resolveProfile('hs').color).toBe(JOURNAL_DEFINITIONS.hs.color);
  });
});

describe('the version history tab', () => {
  const versions = [
    { id: 'v3', scope: 'journal', version: 3, state: 'published', changeNote: 'Sửa dàn trang', createdAt: '2026-11-18T10:00:00Z', publishedAt: '2026-11-18T10:00:00Z', config: {} },
    { id: 'v2', scope: 'journal', version: 2, state: 'archived', changeNote: 'Sửa trích dẫn', createdAt: '2026-11-17T10:00:00Z', publishedAt: '2026-11-17T10:00:00Z', config: {} },
    { id: 'v1', scope: 'journal', version: 1, state: 'archived', changeNote: null, createdAt: '2026-11-16T10:00:00Z', publishedAt: '2026-11-16T10:00:00Z', config: {} },
    { id: 'd4', scope: 'journal', version: 4, state: 'draft', changeNote: 'dở dang', createdAt: '2026-11-18T11:00:00Z', publishedAt: null, config: {} },
  ];

  const signInAs = (capabilities: string[]) =>
    useAuthStore.setState({ user: { id: 'u', email: 'a@b.c', capabilities } as any, isAuthenticated: true });

  it('shows a shimmer first, then published and replaced versions (not drafts) with their notes', async () => {
    api.listProfileVersions.mockResolvedValue(versions);
    const { container } = renderWithClient(<JournalVersionsTab journalKey="hs" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();

    await screen.findByTestId('version-row-3');
    expect(screen.getByTestId('version-row-3').textContent).toContain('Đang xuất bản');
    expect(screen.getByTestId('version-row-2').textContent).toContain('Sửa trích dẫn');
    expect(screen.getByTestId('version-row-1').textContent).toContain('Không có ghi chú');
    expect(screen.queryByTestId('version-row-4')).toBeNull(); // a draft is not history
    expect(api.listProfileVersions).toHaveBeenCalledWith('journal', 'hs', undefined, expect.anything());
  });

  it('offers "Khôi phục" on replaced versions only to those who manage journals', async () => {
    api.listProfileVersions.mockResolvedValue(versions);
    signInAs([]);
    renderWithClient(<JournalVersionsTab journalKey="hs" />);
    await screen.findByTestId('version-row-2');
    expect(screen.queryByText('Khôi phục bản này')).toBeNull();

    cleanup();
    signInAs(['journal:manage']);
    renderWithClient(<JournalVersionsTab journalKey="hs" />);
    await screen.findByTestId('version-row-2');
    expect(screen.getAllByText('Khôi phục bản này')).toHaveLength(2); // v2 and v1, not the published v3
  });

  it('rolls back after confirming and says which version it created', async () => {
    api.listProfileVersions.mockResolvedValue(versions);
    api.rollbackProfile.mockResolvedValue({ version: 5 });
    signInAs(['journal:manage']);
    renderWithClient(<JournalVersionsTab journalKey="hs" />);
    await screen.findByTestId('version-row-2');

    fireEvent.click(within2('version-row-2'));
    fireEvent.click(await screen.findByTestId('confirm-rollback-btn'));
    await waitFor(() => expect(api.rollbackProfile).toHaveBeenCalledWith('journal', 'hs', { toVersion: 2 }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(vi.mocked(toast.success).mock.calls[0][1]).toContain('phiên bản 5');
  });

  it('says so when the history cannot be loaded', async () => {
    api.listProfileVersions.mockRejectedValue(new Error('403'));
    renderWithClient(<JournalVersionsTab journalKey="hs" />);
    await screen.findByText(/Không tải được lịch sử phiên bản/);
  });
});

/** The rollback button inside one version's row. */
function within2(testId: string): HTMLElement {
  return screen.getByTestId(testId).querySelector('button') as HTMLElement;
}
