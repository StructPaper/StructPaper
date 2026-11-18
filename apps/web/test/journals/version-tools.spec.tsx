// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({ applyProfileToPapers: vi.fn(), listProfileVersions: vi.fn(), rollbackProfile: vi.fn() }));
vi.mock('@structpaper/api-client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@structpaper/api-client')>()), ...api }));
vi.mock('@/components/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  toastStore: { dismissToast: vi.fn() },
}));
vi.mock('next/link', () => ({ default: ({ children, href, ...rest }: any) => <a href={href} {...rest}>{children}</a> }));

import { describeChanges, countChanges } from '@/features/journals/profile-changes';
import { ApplyToAllPapersFlow } from '@/features/journals/components/ApplyToAllPapersFlow';
import { JournalVersionsModal } from '@/features/journals/components/JournalVersionsModal';
import { JournalSaveDiffModal } from '@/features/journals/components/JournalSaveDiffModal';
import { PaperProfileInfoModal } from '@/features/journals/components/PaperProfileInfoButton';
import { toast } from '@/components/toast';

const withClient = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

describe('the changes shown before saving', () => {
  const before = { status: 'published', profile: { names: { vi: 'A', en: 'A en', short: 'A' }, color: '#111111', layout: { columns: 2, fontSize: 9 }, publication: { issn: '1859-0128', publisher: 'P' } } };

  it('lists nothing when nothing changed', () => {
    expect(describeChanges(before, JSON.parse(JSON.stringify(before)))).toEqual([]);
  });

  it('separates who the journal is (saved at once) from its rules (a new version)', () => {
    const after = { status: 'draft', profile: { ...before.profile, names: { ...before.profile.names, vi: 'B' }, layout: { columns: 1, fontSize: 9, margin: 20 } } };
    const groups = describeChanges(before, after);
    const identity = groups.find((g) => g.scope === 'identity')!;
    expect(identity.changes.map((c) => [c.label, c.before, c.after])).toEqual(
      expect.arrayContaining([['Tên tiếng Việt', 'A', 'B'], ['Trạng thái', 'Đang phát hành', 'Bản nháp']]),
    );
    const layout = groups.find((g) => g.title === 'Dàn trang')!;
    expect(layout.scope).toBe('rules');
    expect(layout.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Dàn trang › columns', kind: 'changed', before: '2', after: '1' }),
        expect.objectContaining({ label: 'Dàn trang › margin', kind: 'added', after: '20' }),
      ]),
    );
    expect(countChanges(groups)).toMatchObject({ added: 1, changed: 3, removed: 0, rules: 2 });
  });

  it('treats the ISSN as identity, not as a rule', () => {
    const after = { ...before, profile: { ...before.profile, publication: { issn: '1234-5678', publisher: 'P' } } };
    const groups = describeChanges(before, after);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ scope: 'identity', changes: [{ label: 'ISSN', before: '1859-0128', after: '1234-5678' }] });
  });

  it('a new journal lists its identity as added and has no rules to compare', () => {
    const groups = describeChanges(null, { status: 'draft', profile: { names: { vi: 'Mới', en: 'New', short: 'NEW' }, color: '#222222' } });
    expect(groups.every((g) => g.scope === 'identity')).toBe(true);
    expect(groups[0].changes.every((c) => c.kind === 'added')).toBe(true);
  });
});

describe('the save dialog', () => {
  const label = { short: 'HS', name: 'Sức khỏe', color: '#2B74B7' };

  it('shows removed and added lines and warns that rule changes publish a version', () => {
    const groups = describeChanges({ profile: { layout: { columns: 2 } } }, { profile: { layout: { columns: 1 } } });
    const onConfirm = vi.fn();
    render(<JournalSaveDiffModal isOpen onClose={vi.fn()} onConfirm={onConfirm} journalLabel={label} groups={groups} />);
    expect(screen.getByTestId('change-removed').textContent).toContain('2');
    expect(screen.getByTestId('change-added').textContent).toContain('1');
    expect(screen.getByTestId('diff-publish-note')).toBeTruthy();
    fireEvent.click(screen.getByTestId('confirm-save-template-btn'));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('does not talk about versions when only identity changed', () => {
    const groups = describeChanges({ profile: { color: '#111111' } }, { profile: { color: '#222222' } });
    render(<JournalSaveDiffModal isOpen onClose={vi.fn()} onConfirm={vi.fn()} journalLabel={label} groups={groups} />);
    expect(screen.queryByTestId('diff-publish-note')).toBeNull();
  });
});

describe('moving every paper to the rules in force', () => {
  it('takes three steps and the password before anything is sent', async () => {
    api.applyProfileToPapers.mockResolvedValue({ updated: 4, unchanged: 1 });
    const onClose = vi.fn();
    withClient(<ApplyToAllPapersFlow isOpen onClose={onClose} journalKey="hs" version={3} />);

    expect(screen.getByTestId('apply-all-warn-modal')).toBeTruthy();
    fireEvent.click(screen.getByTestId('apply-all-continue-btn'));
    expect(await screen.findByTestId('apply-all-final-modal')).toBeTruthy();
    expect(api.applyProfileToPapers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('apply-all-understand-btn'));

    const input = await screen.findByTestId('apply-all-password-input');
    expect((screen.getByTestId('apply-all-submit-btn') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'secret-pass' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('apply-all-submit-btn'));
    });
    await waitFor(() => expect(api.applyProfileToPapers).toHaveBeenCalledWith('hs', { password: 'secret-pass' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Đã áp dụng cho các bài báo', expect.stringContaining('4 bài báo'));
  });

  it('says the password is wrong, keeps the dialog open and clears the field', async () => {
    const wrong = Object.assign(new Error('Incorrect password'), { status: 403 });
    api.applyProfileToPapers.mockRejectedValue(wrong);
    const onClose = vi.fn();
    withClient(<ApplyToAllPapersFlow isOpen onClose={onClose} journalKey="hs" version={3} />);
    fireEvent.click(screen.getByTestId('apply-all-continue-btn'));
    fireEvent.click(await screen.findByTestId('apply-all-understand-btn'));
    const input = (await screen.findByTestId('apply-all-password-input')) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'nope' } });
    await act(async () => {
      fireEvent.click(screen.getByTestId('apply-all-submit-btn'));
    });
    expect(await screen.findByTestId('apply-all-wrong-password')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe('the version history dialog', () => {
  const v = (version: number, state: string) => ({ id: `id-${version}`, scope: 'journal', version, state, changeNote: `note ${version}`, createdAt: '2026-11-01T00:00:00Z', publishedAt: '2026-11-01T00:00:00Z' });

  it('marks the version in force, lets the author look at an older one, and offers "all papers" only for the version in force', async () => {
    api.listProfileVersions.mockResolvedValue([v(2, 'published'), v(1, 'archived')]);
    const onView = vi.fn();
    const onClose = vi.fn();
    withClient(<JournalVersionsModal isOpen onClose={onClose} journalKey="hs" canEdit viewingVersion={null} onView={onView} />);

    await screen.findByTestId('version-row-2');
    expect(screen.getByTestId('version-row-2').textContent).toContain('Đang áp dụng');
    expect(screen.getByTestId('version-row-1').textContent).toContain('Đã thay thế');
    expect(screen.getAllByTestId('apply-to-all-papers-btn')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('view-version-1'));
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ version: 1 }));
    expect(onClose).toHaveBeenCalled();
  });

  it('hides restore and "all papers" from someone who may not edit', async () => {
    api.listProfileVersions.mockResolvedValue([v(2, 'published'), v(1, 'archived')]);
    withClient(<JournalVersionsModal isOpen onClose={vi.fn()} journalKey="hs" canEdit={false} onView={vi.fn()} />);
    await screen.findByTestId('version-row-2');
    expect(screen.queryByTestId('apply-to-all-papers-btn')).toBeNull();
    expect(screen.queryByText('Khôi phục')).toBeNull();
  });
});

describe('the dialog behind the title bar "?"', () => {
  const info = {
    paperId: 'p1',
    journalKey: 'hs',
    journalName: { vi: 'Sức khỏe', en: 'Health' },
    journalShort: 'VNUHCM-HS',
    journalColor: '#2B74B7',
    articleType: { vi: 'Bài báo nghiên cứu', en: 'Research Article' },
    pin: { base: 1, journal: 2, articleType: 1 },
    latestPin: { base: 1, journal: 3, articleType: 1 },
    isOutdated: true,
    isUpgrading: false,
    onUpgrade: vi.fn(),
  };

  it('shows each pinned version against the newest, offers the upgrade, and links to the journal rules', () => {
    render(<PaperProfileInfoModal info={info} isOpen onClose={vi.fn()} />);
    expect(screen.getByTestId('profile-tier-journal').textContent).toContain('v2');
    expect(screen.getByTestId('profile-tier-journal').textContent).toContain('mới nhất v3');
    expect(screen.getByTestId('profile-tier-base').textContent).toContain('mới nhất');
    expect(screen.getByTestId('paper-profile-open-journal').getAttribute('href')).toBe('/templates/journal/hs');
    fireEvent.click(screen.getByTestId('paper-profile-upgrade-btn'));
    expect(info.onUpgrade).toHaveBeenCalled();
  });

  it('has no upgrade section when the paper is up to date', () => {
    render(<PaperProfileInfoModal info={{ ...info, isOutdated: false, latestPin: info.pin }} isOpen onClose={vi.fn()} />);
    expect(screen.queryByTestId('paper-profile-upgrade')).toBeNull();
  });
});
