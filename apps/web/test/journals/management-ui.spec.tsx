// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, fireEvent, within, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const api = vi.hoisted(() => ({
  listArticleTypes: vi.fn(),
  createArticleType: vi.fn(),
  updateArticleType: vi.fn(),
  listProfileVersions: vi.fn(),
  createProfileDraft: vi.fn(),
  validateProfileDraft: vi.fn(),
  publishProfileDraft: vi.fn(),
  rollbackProfile: vi.fn(),
  getJournalAccess: vi.fn(),
  upgradeManuscriptProfile: vi.fn(),
  getPublishedProfiles: vi.fn(),
}));
vi.mock('@structpaper/api-client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@structpaper/api-client')>()), ...api }));
vi.mock('@/components/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));

import { JournalArticleTypesTab } from '@/features/templates/components/tabs/JournalArticleTypesTab';
import { BaseRulesView } from '@/features/templates/components/BaseRulesView';
import { ProfileUpgradeBanner } from '@/features/journals/components/ProfileUpgradeBanner';
import { useJournalAccess } from '@/features/journals/hooks/useJournalAccess';
import { formatPin, isPinBehind, latestPinOf } from '@/features/journals/hooks/usePaperProfile';
import { resolveProfile } from '@structpaper/journal-profiles';
import { toast } from '@/components/toast';

const renderWithClient = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

const TYPES = [
  { id: 'u1', code: 'research', labels: { vi: 'Bài báo nghiên cứu', en: 'Research Article' }, status: 'active', sortOrder: 10 },
  { id: 'u2', code: 'review', labels: { vi: 'Bài tổng quan', en: 'Review' }, status: 'active', sortOrder: 20 },
  { id: 'u3', code: 'letter', labels: { vi: 'Thư gửi tòa soạn', en: 'Letter' }, status: 'archived', sortOrder: 30 },
];
const publishedRules = (config: object) => [{ id: 'v1', scope: 'article_type', version: 1, state: 'published', config, createdAt: '2026-11-18T10:00:00Z' }];

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset());
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
  api.listArticleTypes.mockResolvedValue(TYPES);
  api.listProfileVersions.mockResolvedValue(publishedRules({ id: 'research', requiredSections: ['h1'] }));
  api.updateArticleType.mockResolvedValue({});
  api.createArticleType.mockResolvedValue({});
  api.createProfileDraft.mockResolvedValue({ version: 2 });
  api.validateProfileDraft.mockResolvedValue({ ok: true, issues: [] });
  api.publishProfileDraft.mockResolvedValue({ version: 2 });
});
afterEach(cleanup);

describe('pins and versions', () => {
  it('writes a pin the way the API reads it', () => {
    expect(formatPin({ base: 1, journal: 3, articleType: 2 })).toBe('base:1,journal:3,type:2');
    expect(formatPin({ journal: 3 })).toBe('journal:3');
  });

  const published: any = {
    base: { version: 2, config: {} },
    journals: { hs: { version: 4, config: {} } },
    articleTypes: { hs: { research: { version: 3, config: {} } } },
    etag: '"x"',
  };

  it('the versions published now for a paper\'s journal and article type', () => {
    expect(latestPinOf(published, { journal: 'VNUHCM-HS', articleType: 'research' })).toEqual({ base: 2, journal: 4, articleType: 3 });
    expect(latestPinOf(published, { journal: 'VNUHCM-HS' })).toEqual({ base: 2, journal: 4 });
    expect(latestPinOf(published, { journal: 'VNUHCM-ZZZ' })).toBeUndefined();
    expect(latestPinOf({ ...published, base: { version: 0, config: {} } }, { journal: 'hs' })).toBeUndefined(); // the server answered from its built-ins
  });

  it('a paper is behind when any tier has a newer published version; unpinned papers are never "behind"', () => {
    expect(isPinBehind({ base: 1, journal: 4, articleType: 3 }, { base: 2, journal: 4, articleType: 3 })).toBe(true);
    expect(isPinBehind({ base: 2, journal: 4, articleType: 3 }, { base: 2, journal: 4, articleType: 3 })).toBe(false);
    expect(isPinBehind({ base: 2, journal: 5 }, { base: 2, journal: 4 })).toBe(false);
    expect(isPinBehind(undefined, { base: 2, journal: 4 })).toBe(false);
    expect(isPinBehind({}, { base: 2, journal: 4 })).toBe(false);
  });
});

describe('the upgrade banner', () => {
  const paper: any = { id: '37cdc2a3-736b-4bd8-a02f-753359e7caf1', metadata: { journalId: 'VNUHCM-HS' }, profilePin: { base: 1, journal: 1 } };

  it('says nothing while the paper is up to date, or while it only exists on this machine', () => {
    const { container, rerender } = renderWithClient(<ProfileUpgradeBanner paper={paper} isOutdated={false} onUpgraded={vi.fn()} />);
    expect(container.querySelector('[data-testid="profile-upgrade-banner"]')).toBeNull();
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <ProfileUpgradeBanner paper={{ ...paper, id: 'paper_123' }} isOutdated onUpgraded={vi.fn()} />
      </QueryClientProvider>,
    );
    expect(container.querySelector('[data-testid="profile-upgrade-banner"]')).toBeNull();
  });

  it('offers the upgrade and hands back the new pin and version when the author accepts', async () => {
    api.upgradeManuscriptProfile.mockResolvedValue({ upgraded: true, profilePin: { base: 1, journal: 2 }, version: 7 });
    const onUpgraded = vi.fn();
    renderWithClient(<ProfileUpgradeBanner paper={paper} isOutdated onUpgraded={onUpgraded} />);
    expect(screen.getByTestId('profile-upgrade-banner').textContent).toContain('giữ quy tắc cũ');

    fireEvent.click(screen.getByRole('button', { name: 'Nâng cấp quy tắc' }));
    await waitFor(() => expect(onUpgraded).toHaveBeenCalledWith({ base: 1, journal: 2 }, 7));
    expect(api.upgradeManuscriptProfile).toHaveBeenCalledWith(paper.id);
    expect(toast.success).toHaveBeenCalled();
  });

  it('says so when the server refuses', async () => {
    api.upgradeManuscriptProfile.mockRejectedValue(new Error('Không có quyền'));
    renderWithClient(<ProfileUpgradeBanner paper={paper} isOutdated onUpgraded={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Nâng cấp quy tắc' }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Không thể nâng cấp', 'Không có quyền'));
  });
});

describe('what the user may do with a journal', () => {
  it('asks the API, which knows who manages which journal', async () => {
    api.getJournalAccess.mockResolvedValue({ canEdit: true, canCreate: false });
    const { result } = renderHook(() => useJournalAccess('hs'), { wrapper });
    await waitFor(() => expect(result.current.canEdit).toBe(true));
    expect(result.current.canCreate).toBe(false);
    expect(api.getJournalAccess).toHaveBeenCalledWith('hs', undefined, expect.anything());
  });

  it('hides nothing where there is no server to ask (the API still refuses what is not allowed)', () => {
    const { result } = renderHook(() => useJournalAccess('hs'));
    expect(result.current).toMatchObject({ canEdit: true, canCreate: true });
  });
});

describe('the article types tab', () => {
  const profile = resolveProfile('hs') as any;

  it('shows a shimmer first, then each type with its names and status', async () => {
    const { container } = renderWithClient(<JournalArticleTypesTab profile={profile} journalKey="hs" />);
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    await screen.findByTestId('article-type-research');
    expect(api.listArticleTypes).toHaveBeenCalledWith('hs', { includeArchived: true }, undefined, expect.anything());
    expect(screen.getByTestId('article-type-letter').textContent).toContain('Đã lưu trữ');
    expect((within(screen.getByTestId('article-type-review')).getAllByRole('textbox')[0] as HTMLInputElement).value).toBe('Bài tổng quan');
  });

  it('adds a type only when its code is well formed and all names are given', async () => {
    renderWithClient(<JournalArticleTypesTab profile={profile} journalKey="hs" />);
    const form = await screen.findByTestId('add-article-type');
    const [code, vi, en] = within(form).getAllByRole('textbox') as HTMLInputElement[];
    const add = within(form).getByRole('button', { name: /Thêm/ }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);

    fireEvent.change(code, { target: { value: 'Bad Code!' } }); // lower-cased, still not a valid code
    fireEvent.change(vi, { target: { value: 'Đề cương' } });
    fireEvent.change(en, { target: { value: 'Protocol' } });
    expect(add.disabled).toBe(true);
    expect(form.textContent).toContain('2-50 ký tự');

    fireEvent.change(code, { target: { value: 'protocol' } });
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    await waitFor(() => expect(api.createArticleType).toHaveBeenCalledWith('hs', { code: 'protocol', labels: { vi: 'Đề cương', en: 'Protocol' } }));
  });

  it('renames a type, and archives or restores one', async () => {
    renderWithClient(<JournalArticleTypesTab profile={profile} journalKey="hs" />);
    const review = await screen.findByTestId('article-type-review');
    fireEvent.change(within(review).getAllByRole('textbox')[1], { target: { value: 'Overview' } });
    fireEvent.click(within(review).getByRole('button', { name: /Lưu tên/ }));
    await waitFor(() => expect(api.updateArticleType).toHaveBeenCalledWith('hs', 'review', { labels: { vi: 'Bài tổng quan', en: 'Overview' } }));

    fireEvent.click(within(review).getByRole('button', { name: /Lưu trữ/ }));
    await waitFor(() => expect(api.updateArticleType).toHaveBeenCalledWith('hs', 'review', { status: 'archived' }));
    fireEvent.click(within(screen.getByTestId('article-type-letter')).getByRole('button', { name: /Dùng lại/ }));
    await waitFor(() => expect(api.updateArticleType).toHaveBeenCalledWith('hs', 'letter', { status: 'active' }));
  });

  it('moving a type swaps its place with its neighbour', async () => {
    renderWithClient(<JournalArticleTypesTab profile={profile} journalKey="hs" />);
    const review = await screen.findByTestId('article-type-review');
    fireEvent.click(within(review).getByRole('button', { name: 'Đưa lên' }));
    await waitFor(() => expect(api.updateArticleType).toHaveBeenCalledTimes(2));
    expect(api.updateArticleType).toHaveBeenCalledWith('hs', 'review', { sortOrder: 10 });
    expect(api.updateArticleType).toHaveBeenCalledWith('hs', 'research', { sortOrder: 20 });
  });

  it('whether papers of a type need an abstract is saved as a new version of that type\'s rules', async () => {
    renderWithClient(<JournalArticleTypesTab profile={profile} journalKey="hs" />);
    const research = await screen.findByTestId('article-type-research');
    const box = (await within(research).findByRole('checkbox')) as HTMLInputElement;
    await waitFor(() => expect(box.checked).toBe(true)); // no `abstract: null`: an abstract is needed

    fireEvent.click(box);
    await waitFor(() => expect(api.publishProfileDraft).toHaveBeenCalled());
    expect(api.createProfileDraft).toHaveBeenCalledWith('article_type', 'hs:research', {
      config: { id: 'research', requiredSections: ['h1'], frontMatter: { abstract: null } },
      changeNote: 'Không yêu cầu tóm tắt',
    });
    expect(api.validateProfileDraft).toHaveBeenCalledWith('article_type', 'hs:research', 2);
    expect(api.publishProfileDraft).toHaveBeenCalledWith('article_type', 'hs:research', 2, {});
  });

  it('is read-only for someone who may not edit the journal', async () => {
    renderWithClient(<JournalArticleTypesTab profile={profile} journalKey="hs" canEdit={false} />);
    const research = await screen.findByTestId('article-type-research');
    expect(within(research).queryByRole('button')).toBeNull();
    expect((within(research).getAllByRole('textbox')[0] as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByTestId('add-article-type')).toBeNull();
  });

  it('a journal not saved yet starts with the default types, and offline it lists what the profile carries', async () => {
    renderWithClient(<JournalArticleTypesTab profile={profile} journalKey="new-journal" isNew />);
    expect(screen.getByText(/Hãy lưu tạp chí trước/)).toBeTruthy();
    expect(screen.getAllByText('Bài báo nghiên cứu').length).toBeGreaterThan(0);
    expect(api.listArticleTypes).not.toHaveBeenCalled();
  });
});

describe('the shared rules (base)', () => {
  const base = { id: 'base', version: '1', layout: { columns: 2 } };
  const versions = [{ id: 'b1', scope: 'base', version: 1, state: 'published', config: base, changeNote: 'Initial rules', createdAt: '2026-11-18T10:00:00Z', publishedAt: '2026-11-18T10:00:00Z' }];

  beforeEach(() => {
    api.listProfileVersions.mockResolvedValue(versions);
    api.getJournalAccess.mockResolvedValue({ canEdit: false, canCreate: true });
  });

  it('shows the published rules and what version they are', async () => {
    renderWithClient(<BaseRulesView />);
    const box = (await screen.findByLabelText('Quy tắc dùng chung (JSON)')) as HTMLTextAreaElement;
    await waitFor(() => expect(JSON.parse(box.value)).toEqual(base));
    expect(screen.getByText(/Phiên bản đang xuất bản: v1/)).toBeTruthy();
    expect(api.listProfileVersions).toHaveBeenCalledWith('base', 'base', undefined, expect.anything());
  });

  it('refuses text that is not JSON without calling the server', async () => {
    renderWithClient(<BaseRulesView />);
    const box = (await screen.findByLabelText('Quy tắc dùng chung (JSON)')) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).not.toBe(''));
    await screen.findByRole('button', { name: /Kiểm tra và xuất bản/ });
    fireEvent.change(box, { target: { value: '{ not json' } });
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra và xuất bản/ }));
    expect(await screen.findByText(/JSON chưa hợp lệ/)).toBeTruthy();
    expect(api.createProfileDraft).not.toHaveBeenCalled();
  });

  it('publishes through draft, validation and publish, with the note', async () => {
    renderWithClient(<BaseRulesView />);
    const box = (await screen.findByLabelText('Quy tắc dùng chung (JSON)')) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).not.toBe(''));
    await screen.findByRole('button', { name: /Kiểm tra và xuất bản/ });
    fireEvent.change(box, { target: { value: JSON.stringify({ ...base, layout: { columns: 1 } }) } });
    fireEvent.change(screen.getByPlaceholderText(/Ghi chú thay đổi/), { target: { value: 'một cột' } });
    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra và xuất bản/ }));
    await waitFor(() => expect(api.publishProfileDraft).toHaveBeenCalledWith('base', 'base', 2, {}));
    expect(api.createProfileDraft).toHaveBeenCalledWith('base', 'base', { config: { ...base, layout: { columns: 1 } }, changeNote: 'một cột' });
  });

  it('shows where the server found the rules wrong, and publishes nothing', async () => {
    api.validateProfileDraft.mockResolvedValue({ ok: false, issues: [{ path: 'typography.fontSizes', message: 'Expected object' }] });
    renderWithClient(<BaseRulesView />);
    const box = (await screen.findByLabelText('Quy tắc dùng chung (JSON)')) as HTMLTextAreaElement;
    await waitFor(() => expect(box.value).not.toBe(''));
    fireEvent.click(await screen.findByRole('button', { name: /Kiểm tra và xuất bản/ }));
    const issues = await screen.findByTestId('base-rules-issues');
    expect(issues.textContent).toContain('typography.fontSizes');
    expect(api.publishProfileDraft).not.toHaveBeenCalled();
  });

  it('is read-only for someone who may not change the base', async () => {
    api.getJournalAccess.mockResolvedValue({ canEdit: false, canCreate: false });
    renderWithClient(<BaseRulesView />);
    const box = (await screen.findByLabelText('Quy tắc dùng chung (JSON)')) as HTMLTextAreaElement;
    expect(box.readOnly).toBe(true);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Kiểm tra và xuất bản/ })).toBeNull());
    expect(screen.getByText(/chỉ có quyền xem/)).toBeTruthy();
  });
});
