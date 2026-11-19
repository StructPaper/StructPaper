// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { Capability } from '@structpaper/contracts';

vi.mock('next/navigation', () => ({
  usePathname: () => '/templates',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));

import { JournalProfileCard, JournalFiltersBar } from '@/features/templates';
import { getDefaultVnuhcmJournals } from '@/lib/templates/journal-storage';
import { useAuthStore } from '@/lib/auth-store';

const loginWith = (capabilities: Capability[]) =>
  useAuthStore.setState({ user: { id: 'u1', email: 'a@b.c', capabilities }, isAuthenticated: true } as any);

const renderBar = () =>
  render(
    <JournalFiltersBar
      searchQuery=""
      onSearchChange={vi.fn()}
      statusFilter="all"
      onStatusFilterChange={vi.fn()}
      totalCount={7}
      filteredCount={7}
    />,
  );

describe('Journals are view-only without journal:manage', () => {
  afterEach(() => {
    cleanup();
    useAuthStore.setState({ user: null, isAuthenticated: false } as any);
  });

  it('an Editor (no capability) gets no "add journal" button', () => {
    loginWith([]);
    renderBar();
    expect(screen.queryByText(/Thêm Tạp chí Mới/)).toBeNull();
  });

  it('a manager gets the "add journal" button', () => {
    loginWith(['journal:manage']);
    renderBar();
    expect(screen.getByText(/Thêm Tạp chí Mới/)).toBeDefined();
  });

  it('the card of a view-only user can still be hovered and opened, but says "view" instead of "customise"', () => {
    loginWith([]);
    const managed = getDefaultVnuhcmJournals()[0];
    const { container } = render(<JournalProfileCard managed={managed} onCreatePaper={vi.fn()} />);

    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('data-readonly')).toBe('true');
    expect(card.className).toContain('hover:');
    expect(card.className).toContain('cursor-pointer');
    expect(screen.queryByText('Tùy chỉnh')).toBeNull();
    expect(screen.getByText('Xem quy định').closest('a')?.getAttribute('href')).toContain('/templates/journal/');
  });

  it('the card of a manager keeps hover, click-through and the editor link', () => {
    loginWith(['journal:manage']);
    const managed = getDefaultVnuhcmJournals()[0];
    const { container } = render(<JournalProfileCard managed={managed} onCreatePaper={vi.fn()} />);

    const card = container.firstElementChild as HTMLElement;
    expect(card.getAttribute('data-readonly')).toBeNull();
    expect(card.className).toContain('hover:');
    expect(screen.getByText('Tùy chỉnh')).toBeDefined();
  });
});
