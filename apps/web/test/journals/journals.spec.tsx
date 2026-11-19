// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

let listState: { data?: unknown; isError?: boolean; isLoading?: boolean } = {};
vi.mock('@structpaper/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@structpaper/api-client')>()),
  useListJournals: () => ({ data: undefined, isError: false, isLoading: false, ...listState }),
}));

import { findJournal, toJournalInfo, builtInJournals, isLegacyJournal } from '@/features/journals/resolve';
import { journalTemplatesFrom } from '@/features/journals/journal-templates';
import { JournalCodeBadge } from '@/features/journals';

const SERVER = [
  { id: 'u-1', slug: 'vnuhcm-hs', code: 'VNUHCM-HS', name: 'Khoa học Sức khỏe', color: '#123456', status: 'published' },
  { id: 'u-2', slug: 'vnuhcm-et', code: 'VNUHCM-ET', name: 'Kỹ thuật & Công nghệ', color: '#000000', status: 'draft' },
  { id: 'u-3', slug: 'vnuhcm-std', code: 'VNUHCM-STD', name: 'Khoa học & Công nghệ', color: '#000099' },
].map((j) => toJournalInfo({ shortName: j.code.replace("VNUHCM-", ""), version: 1, ...j } as any));

const renderWithClient = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => {
  listState = {};
});
afterEach(cleanup);

/** happy-dom keeps the colour as written (jsdom would turn it into rgb()). */
const hex = (el: HTMLElement) => {
  const c = el.style.backgroundColor.toLowerCase();
  const m = c.match(/^rgb((d+),s*(d+),s*(d+))$/);
  return m ? '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('') : c;
};

describe('looking a journal up', () => {
  it('finds it by server id, slug, code, short key, and the old STDJ alias', () => {
    for (const ref of ['u-1', 'vnuhcm-hs', 'VNUHCM-HS', 'hs', 'HS']) expect(findJournal(SERVER, ref)?.id).toBe('u-1');
    expect(findJournal(SERVER, 'VNUHCM-STDJ')?.key).toBe('std');
    expect(findJournal(SERVER, 'VNUHCM-NOPE')).toBeUndefined();
    expect(findJournal(SERVER, undefined)).toBeUndefined();
  });

  it('the built-in list stands in with all 7 journals, each with a code and a colour', () => {
    const list = builtInJournals();
    expect(list).toHaveLength(7);
    for (const j of list) expect(j.color).toMatch(/^#[0-9A-F]{6}$/i);
  });
});

describe('template cards from the server', () => {
  it('what the server holds (colour, name, code, status) wins over the code profile', () => {
    const cards = journalTemplatesFrom(SERVER);
    const hs = cards.find((c) => c.id === 'hs')!;
    expect(hs.profile.color).toBe('#123456');
    expect(hs.profile.names?.vi).toBe('Khoa học Sức khỏe');
    expect(hs.profile.names?.short).toBe('VNUHCM-HS');
    expect(cards.find((c) => c.id === 'et')!.status).toBe('draft');
    expect(cards).toHaveLength(3);
  });

  it('a journal the code has no profile for (e.g. the seed\'s old "vnu-jst" row) does not throw', () => {
    const odd = toJournalInfo({ id: 'u-9', slug: 'vnu-jst', code: 'VNUHCM-JST', name: 'Cũ', color: '#000099' } as any);
    const cards = journalTemplatesFrom([odd]);
    expect(cards).toHaveLength(1);
    expect(cards[0].profile.names?.vi).toBe('Cũ');
  });

  it('the old "vnu-jst" alias and its row resolve to the standard journal', () => {
    expect(findJournal(SERVER, 'vnu-jst')?.key).toBe('std');
    expect(isLegacyJournal({ slug: 'vnu-jst' })).toBe(true);
    expect(isLegacyJournal({ slug: 'vnuhcm-std' })).toBe(false);
  });
});

describe('the journal code on a paper', () => {
  it('shows a shimmer while the list loads, then the server colour', () => {
    listState = { isLoading: true };
    const { container, rerender } = renderWithClient(<JournalCodeBadge journalId="VNUHCM-HS" />);
    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.queryByText('VNUHCM-HS')).toBeNull();

    listState = { data: SERVER.map((j) => ({ ...j, id: j.id })) };
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <JournalCodeBadge journalId="VNUHCM-HS" />
      </QueryClientProvider>,
    );
    const chip = screen.getByText('VNUHCM-HS');
    expect(hex(chip)).toBe('#123456');
  });

  it('prefers the journal the server joined onto the paper', () => {
    listState = { data: SERVER };
    const record: any = { doc: { journalId: 'hs', journal: { code: 'VNUHCM-HS', color: '#ABCDEF', name: 'X' }, meta: {} }, info: {} };
    renderWithClient(<JournalCodeBadge journalId="hs" record={record} />);
    expect(hex(screen.getByText('VNUHCM-HS'))).toBe('#abcdef');
  });

  it('falls back to the built-in list when the server can not be reached', () => {
    listState = { isError: true };
    renderWithClient(<JournalCodeBadge journalId="VNUHCM-EBL" />);
    expect(screen.getByText(/EBL/)).toBeTruthy();
  });

  it('works without any QueryClientProvider (built-in list)', () => {
    render(<JournalCodeBadge journalId="VNUHCM-SSH" />);
    expect(screen.getByText(/SSH/)).toBeTruthy();
  });
});
