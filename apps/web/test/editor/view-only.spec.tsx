// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  usePathname: () => '/papers/11111111-2222-3333-4444-555555555555',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@/context/StorageContext', () => ({
  useStorage: () => ({ isLocalAvailable: true }),
}));

import { ReadOnlyScope } from '@/features/editor/components/ReadOnlyScope';
import { EditorLeftDock } from '@/features/editor/components/EditorLeftDock';
import { Select } from '@/components/ui/Select';
import { isSharedPaperLink } from '@/components/layout/AuthGuard';

afterEach(cleanup);

describe('ReadOnlyScope', () => {
  it('locks text fields, selects and rich-text areas, even ones rendered later', async () => {
    const { rerender } = render(
      <ReadOnlyScope readOnly>
        <input data-testid="i" defaultValue="a" />
        <textarea data-testid="t" defaultValue="b" />
        <div data-testid="rich" contentEditable suppressContentEditableWarning />
      </ReadOnlyScope>,
    );
    await waitFor(() => expect((screen.getByTestId('i') as HTMLInputElement).readOnly).toBe(true));
    expect((screen.getByTestId('t') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(screen.getByTestId('rich').getAttribute('contenteditable')).toBe('false');

    rerender(
      <ReadOnlyScope readOnly>
        <input data-testid="late" />
      </ReadOnlyScope>,
    );
    await waitFor(() => expect((screen.getByTestId('late') as HTMLInputElement).readOnly).toBe(true));
  });

  it('a field can not keep focus, and click-to-edit areas do nothing', async () => {
    const onEdit = vi.fn();
    render(
      <ReadOnlyScope readOnly>
        <input data-testid="i" />
        <div data-testid="preview" tabIndex={0} onClick={onEdit} onFocus={onEdit}>texte</div>
        <button data-testid="toggle" onClick={onEdit}>mở rộng</button>
      </ReadOnlyScope>,
    );
    await waitFor(() => expect((screen.getByTestId('i') as HTMLInputElement).readOnly).toBe(true));

    (screen.getByTestId('i') as HTMLInputElement).focus();
    expect(document.activeElement).not.toBe(screen.getByTestId('i'));

    fireEvent.click(screen.getByTestId('preview'));
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByTestId('preview').getAttribute('tabindex')).toBe('-1');

    fireEvent.click(screen.getByTestId('toggle'));
    expect(onEdit).toHaveBeenCalledTimes(1); // real buttons keep working
  });

  it('shared Select controls lock themselves inside the scope', () => {
    render(
      <ReadOnlyScope readOnly>
        <Select options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} value="a" onChange={vi.fn()} />
      </ReadOnlyScope>,
    );
    const trigger = screen.getAllByRole('button')[0] as HTMLButtonElement;
    expect(trigger.disabled).toBe(true);
  });

  it('marks the scope so edit-only controls can be hidden', () => {
    const { container } = render(
      <ReadOnlyScope readOnly>
        <button data-edit-only>Thêm</button>
      </ReadOnlyScope>,
    );
    expect(container.querySelector('[data-readonly="true"] [data-edit-only]')).not.toBeNull();
  });

  it('leaves everything alone when the user may edit', () => {
    const { container } = render(
      <ReadOnlyScope readOnly={false}>
        <input data-testid="i" />
      </ReadOnlyScope>,
    );
    expect((screen.getByTestId('i') as HTMLInputElement).readOnly).toBe(false);
    expect(container.querySelector('[data-readonly]')).toBeNull();
  });
});

describe('Editor dock for view-only access', () => {
  const dockProps = {
    onOpenQuickEdit: vi.fn(),
    onOpenExtractedDrawer: vi.fn(),
    onOpenLayoutSettings: vi.fn(),
    onSave: vi.fn(),
    saveSuccess: false,
    onRecompile: vi.fn(),
    isCompiling: false,
    onDownloadDocx: vi.fn(),
    isExportingDocx: false,
    onDownloadZip: vi.fn(),
    isExportingZip: false,
    compiledPdfUrl: null,
    qcScore: 80,
  };
  const labels = () => screen.getAllByRole('button').map((b) => (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase());

  it('an editor sees quick-edit, layout, save, compile and the quality score', () => {
    render(<EditorLeftDock {...dockProps} />);
    const all = labels().join('|');
    expect(all).toContain('sửa thông tin bài báo');
    expect(all).toContain('cài đặt dàn trang');
    expect(all).toContain('lưu thay đổi');
    expect(all).toContain('biên dịch lại');
    expect(all).toContain('chất lượng bản thảo');
  });

  it('a reader sees none of them, but keeps back, extracted content and downloads', () => {
    render(<EditorLeftDock {...dockProps} readOnly />);
    const all = labels().join('|');
    expect(all).not.toContain('sửa thông tin bài báo');
    expect(all).not.toContain('cài đặt dàn trang');
    expect(all).not.toContain('lưu thay đổi');
    expect(all).not.toContain('biên dịch lại');
    expect(all).not.toContain('chất lượng bản thảo');
    expect(all).toContain('quay lại danh sách');
    expect(all).toContain('nội dung trích xuất');
  });
});

describe('guest access to a paper link', () => {
  it('only /papers/<id> is open to guests, nothing else under the signed-in area', () => {
    expect(isSharedPaperLink('/papers/11111111-2222-3333-4444-555555555555')).toBe(true);
    expect(isSharedPaperLink('/papers/abc/')).toBe(true);
    expect(isSharedPaperLink('/papers')).toBe(false);
    expect(isSharedPaperLink('/papers/abc/edit')).toBe(false);
    expect(isSharedPaperLink('/permissions')).toBe(false);
    expect(isSharedPaperLink(null)).toBe(false);
  });
});

describe('share control in the title bar', () => {
  const ID = '11111111-2222-3333-4444-555555555555';
  let access: any = { canEdit: false, canShare: false, canDelete: false };

  it('a reader only gets "copy link" (no dialog)', async () => {
    vi.resetModules();
    vi.doMock('@structpaper/api-client', async () => ({
      ...(await vi.importActual<any>('@structpaper/api-client')),
      useGetManuscript: () => ({ data: { access, title: 'Bài' } }),
      isMockModeEnabled: () => false,
    }));
    const { ShareManuscriptButton } = await import('@/features/sharing');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    render(<ShareManuscriptButton manuscriptId={ID} />);

    expect(screen.queryByTestId('titlebar-share')).toBeNull();
    fireEvent.click(screen.getByTestId('titlebar-copy-link'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining(`/papers/${ID}`)));
    expect(screen.queryByTestId('share-manuscript-modal')).toBeNull();
    vi.doUnmock('@structpaper/api-client');
  });
});
