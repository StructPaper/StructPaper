// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { DuplicatePaperWarningModal } from '@/features/papers/components/DuplicatePaperWarningModal';
import { runBatchImport } from '@/lib/batch-import/run-batch';
import { batchActivity } from '@/lib/batch-import/activity';
import { useAuthStore } from '@/lib/auth-store';

afterEach(() => {
  cleanup();
  batchActivity.set(null);
  useAuthStore.setState({ user: null, isAuthenticated: false } as any);
});

describe('warning for a title that was already uploaded', () => {
  it('says who uploaded it before, each person once with the date; "Bạn" for my own', () => {
    render(
      <DuplicatePaperWarningModal
        isOpen
        paperTitle="Giấc ngủ"
        suggestedTitle="Giấc ngủ (2)"
        matchCount={3}
        uploaders={[
          { title: 'Giấc ngủ', uploaderName: 'Nguyễn Văn A', uploadedAt: '2026-10-21T08:00:00Z', mine: false },
          { title: 'Giấc ngủ (1)', uploaderName: 'Trần B', uploadedAt: '2026-10-22T08:00:00Z', mine: false },
          { title: 'Giấc ngủ (2)', uploaderName: 'Tôi', uploadedAt: '2026-10-23T08:00:00Z', mine: true },
        ]}
        onClose={vi.fn()}
        onConfirmUpload={vi.fn()}
      />,
    );

    const chips = screen.getAllByTestId('duplicate-uploader').map((c) => c.textContent);
    expect(chips).toHaveLength(3);
    expect(chips[0]).toContain('Nguyễn Văn A');
    expect(chips[1]).toContain('Trần B');
    expect(chips[2]).toContain('Bạn');
    expect(chips[2]).not.toContain('Tôi');
    expect(screen.getByText(/"Giấc ngủ \(2\)"/)).toBeDefined();
  });

  it('shows no list when nobody else is known', () => {
    render(<DuplicatePaperWarningModal isOpen paperTitle="X" suggestedTitle="X (1)" matchCount={1} onClose={vi.fn()} onConfirmUpload={vi.fn()} />);
    expect(screen.queryByTestId('duplicate-uploaders')).toBeNull();
  });
});

describe('batch import and a title somebody else already uploaded', () => {
  it('numbers the paper after their copies and records who they are', async () => {
    const parsed: any = { id: 'x', metadata: { title: 'Giấc ngủ', journalId: 'VNUHCM-STD' }, sections: [], references: [] };
    const deps: any = {
      parse: async () => structuredClone(parsed),
      existingTitles: async () => [],
      findDuplicates: async () => [
        { title: 'Giấc ngủ', uploaderName: 'Nguyễn Văn A', mine: false },
        { title: 'Giấc ngủ (1)', uploaderName: 'Trần B', mine: false },
      ],
      save: async () => true,
      check: () => ({ errors: 0, warnings: 0 }),
      compile: async () => ({ blob: new Blob(['%PDF-']), ms: 1 }),
    };
    const journal = { journalId: 'VNUHCM-STD', journalName: 'STD', journalAbbv: 'STD' };

    const items = await runBatchImport({ files: [new File(['a'], 'a.docx')], journal, deps });

    expect(items[0].title).toBe('Giấc ngủ (2)');
    expect(items[0].duplicateOf).toEqual(['Nguyễn Văn A', 'Trần B']);
  });

  it('a failing duplicate check never stops the import', async () => {
    const deps: any = {
      parse: async () => ({ id: 'x', metadata: { title: 'Mới', journalId: 'VNUHCM-STD' }, sections: [], references: [] }),
      existingTitles: async () => [],
      findDuplicates: async () => {
        throw new Error('offline');
      },
      save: async () => true,
      check: () => ({ errors: 0, warnings: 0 }),
      compile: async () => ({ blob: new Blob(['%PDF-']), ms: 1 }),
    };
    const items = await runBatchImport({
      files: [new File(['a'], 'a.docx')],
      journal: { journalId: 'VNUHCM-STD', journalName: 'STD', journalAbbv: 'STD' },
      deps,
    });
    expect(items[0].title).toBe('Mới');
    expect(items[0].stage).toBe('done');
  });
});

describe('papers saved by the batch are the ones that get opened', () => {
  it('uses the id the save gave the paper (the server may replace paper_123 by its own id)', async () => {
    const SERVER_ID = '11111111-2222-3333-4444-555555555555';
    const loaded: string[] = [];
    const deps: any = {
      parse: async () => ({ id: 'x', metadata: { title: 'Bài', journalId: 'VNUHCM-STD' }, sections: [], references: [] }),
      existingTitles: async () => [],
      save: async (paper: any) => {
        paper.id = SERVER_ID;
        return true;
      },
      load: async (id: string) => {
        loaded.push(id);
        return { id, metadata: { title: 'Bài' }, sections: [], references: [] };
      },
      check: () => ({ errors: 0, warnings: 0 }),
      compile: async () => ({ blob: new Blob(['%PDF-']), ms: 1 }),
    };
    const items = await runBatchImport({ files: [new File(['a'], 'a.docx')], journal: { journalId: 'VNUHCM-STD', journalName: 'STD', journalAbbv: 'STD' }, deps });

    expect(items[0].paperId).toBe(SERVER_ID);
    expect(loaded).toEqual([SERVER_ID]);
  });
});

describe('title-bar activity label', () => {
  vi.mock('next/navigation', () => ({ usePathname: () => '/papers', useRouter: () => ({ push: vi.fn() }) }));

  it('shows what this tab is importing, and goes away when it is done', async () => {
    const { CompileActivityPill } = await import('@/components/titlebar/CompileActivityPill');
    render(<CompileActivityPill />);
    expect(screen.queryByTestId('titlebar-compile-activity')).toBeNull();

    act(() => batchActivity.set({ total: 5, finished: 2 }));
    expect(screen.getByTestId('titlebar-compile-activity').textContent).toContain('Đang nhập 2/5 bài báo');

    act(() => batchActivity.set(null));
    expect(screen.queryByTestId('titlebar-compile-activity')).toBeNull();
  });

  it('only the list pages show it', async () => {
    const { showsCompileActivity } = await import('@/components/titlebar/CompileActivityPill');
    for (const ok of ['/papers', '/templates', '/permissions', '/papers/']) expect(showsCompileActivity(ok)).toBe(true);
    for (const no of ['/papers/abc', '/account', '/templates/journal/x', '/login', null]) expect(showsCompileActivity(no)).toBe(false);
  });
});
