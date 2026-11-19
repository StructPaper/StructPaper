// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerRemoteProfiles, clearRemoteProfiles, JOURNAL_DEFINITIONS } from '@structpaper/journal-profiles';

const api = vi.hoisted(() => ({ changeManuscriptArticleType: vi.fn(), getPublishedProfiles: vi.fn() }));
vi.mock('@structpaper/api-client', async (importOriginal) => ({ ...(await importOriginal<typeof import('@structpaper/api-client')>()), ...api }));
vi.mock('@/components/toast', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() } }));

import { ArticleTypeField } from '@/features/editor/components/ArticleTypeField';
import { useArticleTypeSync } from '@/features/journals/hooks/useArticleTypeSync';
import { toast } from '@/components/toast';

const HS_TYPES = [
  { id: 'research', label: { vi: 'Bài báo nghiên cứu', en: 'Research Article' }, requiredSections: [] },
  { id: 'case-report', label: { vi: 'Báo cáo ca lâm sàng', en: 'Case Report' }, requiredSections: [] },
  { id: 'protocol', label: { vi: 'Đề cương nghiên cứu', en: 'Protocol' }, requiredSections: [] },
];

beforeEach(() => {
  api.changeManuscriptArticleType.mockReset();
  vi.mocked(toast.error).mockClear();
  registerRemoteProfiles({ journals: { hs: { ...JOURNAL_DEFINITIONS.hs, articleTypes: HS_TYPES } as any } });
});
afterEach(() => {
  cleanup();
  clearRemoteProfiles();
});

const base = { title: 't', articleType: 'Bài báo nghiên cứu', journalId: 'VNUHCM-HS', journalName: 'HS', journalAbbv: 'HS', authors: [], affiliations: [] } as any;

describe('the article type of a paper is chosen from the journal\'s own list', () => {
  it('offers the types of the journal (even one an admin just added), in the journal\'s order, and nothing to type', () => {
    render(<ArticleTypeField metadata={base} onChange={vi.fn()} />);
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.click(screen.getAllByRole('button')[0]);
    for (const t of HS_TYPES) expect(screen.getAllByText(t.label.vi).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Protocol').length).toBeGreaterThan(0);
  });

  it('choosing a type stores its code, its Vietnamese and its English name together', () => {
    const onChange = vi.fn();
    render(<ArticleTypeField metadata={base} onChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getAllByText('Báo cáo ca lâm sàng')[0]);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ articleType: 'Báo cáo ca lâm sàng', articleTypeEn: 'Case Report', articleTypeCode: 'case-report' }));
  });

  it('shows the type the paper carries by its code, even when the stored name no longer reads the same', () => {
    render(<ArticleTypeField metadata={{ ...base, articleType: 'Tên cũ', articleTypeCode: 'case-report' }} onChange={vi.fn()} />);
    expect(screen.getAllByRole('button')[0].textContent).toContain('Báo cáo ca lâm sàng');
  });

  it('finds the type a name stored before the codes existed stands for', () => {
    render(<ArticleTypeField metadata={{ ...base, articleType: 'case report' }} onChange={vi.fn()} />);
    expect(screen.getAllByRole('button')[0].textContent).toContain('Báo cáo ca lâm sàng');
  });

  it('keeps a stored name that is none of the journal\'s types, selectable, until another is chosen', () => {
    const onChange = vi.fn();
    render(<ArticleTypeField metadata={{ ...base, articleType: 'Báo cáo kỹ thuật' }} onChange={onChange} />);
    expect(screen.getAllByRole('button')[0].textContent).toContain('Báo cáo kỹ thuật');
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('the server follows the author\'s choice', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>{children}</QueryClientProvider>
  );
  const ID = '37cdc2a3-736b-4bd8-a02f-753359e7caf1';
  const paperWith = (extra: Record<string, unknown> = {}, metadata: Record<string, unknown> = {}) =>
    ({ id: ID, version: 4, articleTypeCode: 'research', profilePin: { base: 1, journal: 1, articleType: 1 }, metadata: { ...base, ...metadata }, ...extra }) as any;

  it('moves the paper to the new type and takes the new pin the server answers with', async () => {
    api.changeManuscriptArticleType.mockResolvedValue({ changed: true, articleType: 'case-report', profilePin: { base: 1, journal: 1, articleType: 3 }, version: 4 });
    const setPaper = vi.fn();
    renderHook(() => useArticleTypeSync(paperWith({}, { articleTypeCode: 'case-report' }), setPaper), { wrapper });
    await waitFor(() => expect(api.changeManuscriptArticleType).toHaveBeenCalledWith(ID, { articleType: 'case-report' }));
    await waitFor(() => expect(setPaper).toHaveBeenCalled());
    const next = setPaper.mock.calls[0][0](paperWith());
    expect(next).toMatchObject({ articleTypeCode: 'case-report', profilePin: { articleType: 3 }, version: 4 });
  });

  it('asks nothing when the server already has that type, when no choice was made, or for a paper only on this machine', () => {
    renderHook(() => useArticleTypeSync(paperWith({}, { articleTypeCode: 'research' }), vi.fn()), { wrapper });
    renderHook(() => useArticleTypeSync(paperWith(), vi.fn()), { wrapper });
    renderHook(() => useArticleTypeSync(paperWith({ id: 'paper_123' }, { articleTypeCode: 'case-report' }), vi.fn()), { wrapper });
    expect(api.changeManuscriptArticleType).not.toHaveBeenCalled();
  });

  it('says so when the server refuses, and does not ask again for the same choice', async () => {
    api.changeManuscriptArticleType.mockRejectedValue(new Error('no longer offered'));
    const paper = paperWith({}, { articleTypeCode: 'protocol' });
    const { rerender } = renderHook(() => useArticleTypeSync(paper, vi.fn()), { wrapper });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Không đổi được loại bài trên máy chủ', 'no longer offered'));
    rerender();
    rerender();
    expect(api.changeManuscriptArticleType).toHaveBeenCalledTimes(1);
  });
});
