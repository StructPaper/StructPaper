// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { Capability } from '@structpaper/contracts';

vi.mock('next/navigation', () => ({
  usePathname: () => '/papers',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { PaperFiltersBar } from '@/features/papers/components/PaperFiltersBar';
import { remoteManuscriptToRecord } from '@/features/papers/hooks/usePapersHub';
import { useAuthStore } from '@/lib/auth-store';
import { useAccess } from '@/lib/access';

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null, isAuthenticated: false } as any);
});

const bar = (props: Record<string, any> = {}) =>
  render(
    <PaperFiltersBar
      searchQuery=""
      onSearchChange={vi.fn()}
      statusFilter="all"
      onStatusFilterChange={vi.fn()}
      journalFilter="all"
      onJournalFilterChange={vi.fn()}
      sortBy="newest"
      onSortChange={vi.fn()}
      viewMode="grid"
      onViewModeChange={vi.fn()}
      {...props}
    />,
  );

describe('library toggles next to the search box', () => {
  it('are hidden unless the page asks for them', () => {
    bar();
    expect(screen.queryByTestId('library-toggles')).toBeNull();
  });

  it('show "Kho bài public" and "Được chia sẻ với tôi", on the same row as the search box', () => {
    bar({ showLibrary: true, onLibraryModeChange: vi.fn() });

    const search = screen.getByTestId('paper-search-input');
    const toggles = screen.getByTestId('library-toggles');
    expect(search.closest('div.flex-wrap')).toBe(toggles.parentElement);
    expect(screen.getByTestId('library-toggle-public').textContent).toContain('Kho bài public');
    expect(screen.getByTestId('library-toggle-shared').textContent).toContain('Được chia sẻ với tôi');
  });

  it('a toggle turns its list on, and the same toggle turns it off again', () => {
    const onChange = vi.fn();
    const { rerender } = bar({ showLibrary: true, onLibraryModeChange: onChange, libraryMode: 'mine' });

    fireEvent.click(screen.getByTestId('library-toggle-public'));
    expect(onChange).toHaveBeenLastCalledWith('public');

    rerender(
      <PaperFiltersBar
        searchQuery="" onSearchChange={vi.fn()} statusFilter="all" onStatusFilterChange={vi.fn()}
        journalFilter="all" onJournalFilterChange={vi.fn()} sortBy="newest" onSortChange={vi.fn()}
        viewMode="grid" onViewModeChange={vi.fn()}
        showLibrary onLibraryModeChange={onChange} libraryMode="public"
      />,
    );
    expect(screen.getByTestId('library-toggle-public').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByTestId('library-toggle-public'));
    expect(onChange).toHaveBeenLastCalledWith('mine');
  });
});

describe('who needs the toggles (manuscript:read_all)', () => {
  const Probe = () => {
    const access = useAccess();
    return <span data-testid="show">{String(access.status === 'ready' && !access.can('manuscript:read_all'))}</span>;
  };
  const login = (capabilities?: Capability[]) =>
    useAuthStore.setState({ user: { id: 'u', email: 'a@b.c', capabilities }, isAuthenticated: true } as any);

  it('Editor and below (no read_all) need them; roles that read everything do not', () => {
    login([]);
    const { unmount } = render(<Probe />);
    expect(screen.getByTestId('show').textContent).toBe('true');
    unmount();

    login(['manuscript:read_all']);
    render(<Probe />);
    expect(screen.getByTestId('show').textContent).toBe('false');
  });

  it('while capabilities are unknown nothing is shown (default deny)', () => {
    login(undefined);
    render(<Probe />);
    expect(screen.getByTestId('show').textContent).toBe('false');
  });
});

describe('library papers become cards like any other', () => {
  it('keeps the access the API computed, so menus follow it', () => {
    const record: any = remoteManuscriptToRecord({
      id: '11111111-2222-3333-4444-555555555555',
      title: 'Bài công khai',
      status: 'DRAFT',
      metadata: {},
      generalAccess: 'VIEWER',
      access: { canEdit: false, canShare: false, canDelete: false },
    });
    expect(record.remoteData.access).toEqual({ canEdit: false, canShare: false, canDelete: false });
    expect(record.info.displayName).toBe('Bài công khai');
  });
});
