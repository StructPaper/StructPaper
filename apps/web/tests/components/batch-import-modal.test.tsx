// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor, within } from '@testing-library/react';
import { createEmptyPaper } from '@/types/paper';
import type { BatchDeps } from '@/lib/batch-import/types';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/papers',
}));

const toastMock = vi.hoisted(() => ({ success: vi.fn(), info: vi.fn(), error: vi.fn(), warning: vi.fn(), loading: vi.fn(), dismiss: vi.fn() }));
vi.mock('@/components/DynamicIslandToast', () => ({ toast: toastMock }));

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    LayoutGroup: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    motion: new Proxy(actual.motion as Record<string, unknown>, {
      get: (_t, prop: string) => {
        const C = React.forwardRef<HTMLElement, any>(({ children, ...props }, ref) => {
          const El = prop as unknown as React.ElementType;
          for (const k of ['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'layoutId', 'layout']) delete props[k];
          return <El ref={ref} {...props}>{children}</El>;
        });
        C.displayName = `motion.${prop}`;
        return C;
      },
    }),
  };
});

// Real parsing / typesetting are replaced by controllable fakes.
const control = vi.hoisted(() => ({ releaseCompile: [] as (() => void)[], hold: false, failParse: new Set<string>(), parsed: [] as string[], compiled: [] as string[] }));
vi.mock('@/lib/batch-import/default-deps', async () => {
  const { createEmptyPaper: mk } = await import('@/types/paper');
  return {
    createBatchDeps: (): BatchDeps => ({
      async parse(file) {
        control.parsed.push(file.name);
        if (control.failParse.has(file.name)) throw new Error('Không đọc được ' + file.name);
        const p = mk();
        p.metadata.title = file.name.replace(/\.docx$/, '');
        return p;
      },
      existingTitles: async () => [],
      save: async () => true,
      check: () => ({ errors: 0, warnings: 1 }),
      compile: (paper, signal) =>
        new Promise((resolve, reject) => {
          control.compiled.push(paper.metadata.title);
          const done = () => resolve({ blob: new Blob(['%PDF']), ms: 1200 });
          signal.addEventListener('abort', () => reject(Object.assign(new Error('abort'), { name: 'AbortError' })), { once: true });
          if (control.hold) control.releaseCompile.push(done);
          else setTimeout(done, 5);
        }),
    }),
    compileToPdf: vi.fn(),
  };
});
vi.mock('@/lib/docx-parser', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  parseDocxFile: vi.fn(async (_b: ArrayBuffer, name: string) => {
    const p = createEmptyPaper();
    p.metadata.title = name;
    return p;
  }),
}));

import { CreatePaperModal } from '@/features/papers';
import { defaultDatabase } from '@structpaper/storage';

const docx = (name: string) => new File([new Uint8Array([1, 2, 3])], name);
const pick = (files: File[]) => fireEvent.change(screen.getByTestId('create-paper-file-input'), { target: { files } });

beforeEach(async () => {
  mockPush.mockClear();
  Object.values(toastMock).forEach((f) => f.mockClear());
  control.hold = false;
  control.releaseCompile = [];
  control.failParse.clear();
  control.parsed = [];
  control.compiled = [];
  await defaultDatabase.manuscripts.clear();
});
afterEach(cleanup);

const renderModal = (props: Partial<React.ComponentProps<typeof CreatePaperModal>> = {}) => {
  const onClose = vi.fn();
  const onBatchFinished = vi.fn();
  const utils = render(<CreatePaperModal isOpen onClose={onClose} onBatchFinished={onBatchFinished} {...props} />);
  return { onClose, onBatchFinished, ...utils };
};

describe('CreatePaperModal: several Word files at once', () => {
  it('the file input accepts several files', () => {
    renderModal();
    expect((screen.getByTestId('create-paper-file-input') as HTMLInputElement).multiple).toBe(true);
  });

  it('three files -> pick the template once -> three papers imported and typeset together', async () => {
    const { onBatchFinished } = renderModal();
    await act(async () => pick([docx('Bài một.docx'), docx('Bài hai.docx'), docx('Bài ba.docx')]));

    // template step, labelled for the whole batch; nothing was parsed yet
    expect(screen.getByText('Chọn mẫu tạp chí cho 3 bài báo?')).toBeDefined();
    expect(screen.queryByTestId('new-document-name')).toBeNull();
    expect(control.parsed).toEqual([]);

    await act(async () => fireEvent.click(screen.getByTestId('compact-template-hs')));
    await act(async () => fireEvent.click(screen.getByTestId('continue-to-editor-btn')));

    expect(screen.getByTestId('batch-panel')).toBeDefined();
    expect(screen.getAllByTestId('batch-item')).toHaveLength(3);
    await waitFor(() => expect(screen.getByTestId('batch-summary').textContent).toContain('Hoàn thành 3/3 bài báo'), { timeout: 4000 });

    const rows = screen.getAllByTestId('batch-item');
    expect(rows.map((r) => r.getAttribute('data-stage'))).toEqual(['done', 'done', 'done']);
    expect(rows.map((r) => within(r).getByTestId('batch-item-status').textContent)).toEqual([
      expect.stringContaining('Hoàn tất'),
      expect.stringContaining('Hoàn tất'),
      expect.stringContaining('Hoàn tất'),
    ]);
    // every file was parsed and typeset
    expect(control.parsed.sort()).toEqual(['Bài ba.docx', 'Bài hai.docx', 'Bài một.docx']);
    expect(control.compiled.sort()).toEqual(['Bài ba', 'Bài hai', 'Bài một']);
    expect(toastMock.success).toHaveBeenCalledWith('Đã tạo 3/3 bài báo', 'Tất cả đã có bản PDF.');
    expect(onBatchFinished).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('batch-download-all')).toBeDefined();
    expect(screen.queryByTestId('batch-cancel')).toBeNull();
  });

  it('"Mở" goes to that paper in the editor and closes the dialog', async () => {
    const { onClose } = renderModal();
    await act(async () => pick([docx('a.docx'), docx('b.docx')]));
    await act(async () => fireEvent.click(screen.getByTestId('continue-to-editor-btn')));
    await waitFor(() => expect(screen.getByTestId('batch-summary').textContent).toContain('Hoàn thành 2/2'), { timeout: 4000 });
    await act(async () => fireEvent.click(screen.getAllByTestId('batch-item-open')[1]));
    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush.mock.calls[0][0]).toMatch(/^\/editor\?id=paper_\d+_1$/);
    expect(onClose).toHaveBeenCalled();
  });

  it('skips the template step when the journal is already chosen', async () => {
    const { getDefaultVnuhcmJournals } = await import('@/lib/templates/journal-storage');
    renderModal({ preselectedManaged: getDefaultVnuhcmJournals()[2] });
    await act(async () => pick([docx('a.docx'), docx('b.docx')]));
    expect(screen.getByTestId('batch-panel')).toBeDefined();
    await waitFor(() => expect(screen.getByTestId('batch-summary').textContent).toContain('Hoàn thành 2/2'), { timeout: 4000 });
  });

  it('ignores files that are not Word documents and says so', async () => {
    renderModal();
    await act(async () => pick([docx('a.docx'), docx('ghi-chu.pdf'), docx('b.DOCX')]));
    await act(async () => fireEvent.click(screen.getByTestId('continue-to-editor-btn')));
    expect(screen.getAllByTestId('batch-item')).toHaveLength(2);
    expect(screen.getByText(/Đã bỏ qua 1 tệp không phải Word/)).toBeDefined();
    await waitFor(() => expect(screen.getByTestId('batch-summary').textContent).toContain('Hoàn thành 2/2'), { timeout: 4000 });
  });

  it('one unreadable file is marked as failed, the rest are created, and "Thử lại" runs only the failed one', async () => {
    control.failParse.add('hỏng.docx');
    renderModal();
    await act(async () => pick([docx('tốt 1.docx'), docx('hỏng.docx'), docx('tốt 2.docx')]));
    await act(async () => fireEvent.click(screen.getByTestId('continue-to-editor-btn')));
    await waitFor(() => expect(screen.getByTestId('batch-summary').textContent).toContain('Hoàn thành 2/3 bài báo · 1 lỗi'), { timeout: 4000 });
    const rows = screen.getAllByTestId('batch-item');
    expect(rows[1].getAttribute('data-stage')).toBe('error');
    expect(within(rows[1]).getByTestId('batch-item-status').textContent).toContain('Không đọc được hỏng.docx');
    expect(within(rows[1]).queryByTestId('batch-item-open')).toBeNull();

    control.failParse.clear();
    control.parsed = [];
    await act(async () => fireEvent.click(screen.getByTestId('batch-retry')));
    await waitFor(() => expect(screen.getByTestId('batch-summary').textContent).toContain('Hoàn thành 3/3'), { timeout: 4000 });
    expect(control.parsed).toEqual(['hỏng.docx']);
    expect(screen.queryByTestId('batch-retry')).toBeNull();
  });

  it('shows live progress and lets the user cancel the files that are not finished', async () => {
    control.hold = true;
    renderModal();
    await act(async () => pick([docx('a.docx'), docx('b.docx')]));
    await act(async () => fireEvent.click(screen.getByTestId('continue-to-editor-btn')));
    await waitFor(() => expect(control.compiled.length).toBe(2));
    expect(screen.getByTestId('batch-summary').textContent).toContain('Đang xử lý 0/2');
    expect(screen.getAllByTestId('batch-item').map((r) => r.getAttribute('data-stage'))).toEqual(['compiling', 'compiling']);
    expect(screen.getAllByTestId('batch-item-open').every((b) => !(b as HTMLButtonElement).disabled)).toBe(true); // saved papers open while the PDF is typeset

    await act(async () => fireEvent.click(screen.getByTestId('batch-cancel')));
    await waitFor(() => expect(screen.queryByTestId('batch-cancel')).toBeNull(), { timeout: 4000 });
    // the papers were already created; only their PDFs were stopped
    const rows = screen.getAllByTestId('batch-item');
    expect(rows.map((r) => r.getAttribute('data-stage'))).toEqual(['done', 'done']);
    expect(rows[0].textContent).toContain('Đã hủy biên dịch PDF');
    expect(screen.getByTestId('batch-summary').textContent).toContain('2 chưa có PDF');
  });

  it('closing the dialog while it runs does not stop the import; a toast reports the end', async () => {
    control.hold = true;
    const { onClose, onBatchFinished } = renderModal();
    await act(async () => pick([docx('a.docx'), docx('b.docx')]));
    await act(async () => fireEvent.click(screen.getByTestId('continue-to-editor-btn')));
    await waitFor(() => expect(control.compiled.length).toBe(2));
    await act(async () => fireEvent.click(screen.getByLabelText('Đóng')));
    expect(onClose).toHaveBeenCalled();
    expect(toastMock.success).not.toHaveBeenCalled();
    await act(async () => control.releaseCompile.forEach((f) => f()));
    await waitFor(() => expect(onBatchFinished).toHaveBeenCalled(), { timeout: 4000 });
  });

  it('after "Xong" the dialog opens fresh for the next import', async () => {
    const view = renderModal();
    await act(async () => pick([docx('a.docx'), docx('b.docx')]));
    await act(async () => fireEvent.click(screen.getByTestId('continue-to-editor-btn')));
    await waitFor(() => expect(screen.getByTestId('batch-done')).toBeDefined(), { timeout: 4000 });
    await act(async () => fireEvent.click(screen.getByTestId('batch-done')));
    view.rerender(<CreatePaperModal isOpen={false} onClose={view.onClose} />);
    view.rerender(<CreatePaperModal isOpen onClose={view.onClose} />);
    expect(screen.queryByTestId('batch-panel')).toBeNull();
    expect(screen.getByTestId('create-paper-dropzone')).toBeDefined();
  });

  it('a single file keeps the one-paper flow (parsed first, then template, no batch panel)', async () => {
    renderModal();
    await act(async () => pick([docx('chỉ-một.docx')]));
    await waitFor(() => expect(screen.getByText('Chọn mẫu tạp chí?')).toBeDefined());
    expect(screen.queryByTestId('batch-panel')).toBeNull();
    expect(control.parsed).toEqual([]); // the batch deps were not used
  });

  it('going back from the template step drops the picked files', async () => {
    renderModal();
    await act(async () => pick([docx('a.docx'), docx('b.docx')]));
    await act(async () => fireEvent.click(screen.getByText('Quay lại tải file')));
    expect(screen.getByTestId('create-paper-dropzone')).toBeDefined();
    expect(screen.getByTestId('new-document-name')).toBeDefined();
  });
});

describe('CreatePaperModal: limits', () => {
  it('refuses more than 100 files with a clear message', async () => {
    renderModal();
    await act(async () => pick(Array.from({ length: 101 }, (_, i) => docx(`f${i}.docx`))));
    expect(screen.getByText(/tối đa 100 tệp/)).toBeDefined();
    expect(screen.queryByTestId('batch-panel')).toBeNull();
    expect(screen.getByTestId('create-paper-dropzone')).toBeDefined();
  });

  it('accepts upper-case extensions in the batch', async () => {
    renderModal();
    await act(async () => pick([docx('A.DOCX'), docx('B.Docx')]));
    expect(screen.getByText('Chọn mẫu tạp chí cho 2 bài báo?')).toBeDefined();
  });
});

describe('CreatePaperModal: template per file', () => {
  const rows = () => screen.getAllByTestId('batch-item');

  it('"Mỗi tệp một mẫu": one select per file, each paper made with its own journal', async () => {
    renderModal();
    await act(async () => pick([docx('a.docx'), docx('b.docx'), docx('c.docx')]));
    expect(screen.getByTestId('batch-template-same').getAttribute('aria-selected')).toBe('true');
    await act(async () => fireEvent.click(screen.getByTestId('batch-template-each')));
    const selects = screen.getAllByTestId('batch-template-select') as HTMLSelectElement[];
    expect(selects).toHaveLength(3);
    expect(screen.getByTestId('batch-template-hint').textContent).toContain('1 mẫu khác nhau');
    await act(async () => fireEvent.change(selects[1], { target: { value: 'ebl' } }));
    await act(async () => fireEvent.change(selects[2], { target: { value: 'ssh' } }));
    expect(screen.getByTestId('batch-template-hint').textContent).toContain('3 mẫu khác nhau');
    await act(async () => fireEvent.click(screen.getByTestId('continue-to-editor-btn')));
    await waitFor(() => expect(screen.getByTestId('batch-summary').textContent).toContain('Hoàn thành 3/3'), { timeout: 4000 });
    const badges = screen.getAllByTestId('batch-item-journal').map((b) => b.textContent);
    expect(new Set(badges).size).toBe(3);
    expect(rows()).toHaveLength(3);
  });

  it('"Đặt cùng một mẫu cho tất cả" fills every select', async () => {
    renderModal();
    await act(async () => pick([docx('a.docx'), docx('b.docx')]));
    await act(async () => fireEvent.click(screen.getByTestId('batch-template-each')));
    await act(async () => fireEvent.change(screen.getByTestId('batch-template-all'), { target: { value: 'et' } }));
    expect((screen.getAllByTestId('batch-template-select') as HTMLSelectElement[]).map((s) => s.value)).toEqual(['et', 'et']);
  });

  it('switching back to "Một mẫu cho tất cả" uses the one shared template again', async () => {
    renderModal();
    await act(async () => pick([docx('a.docx'), docx('b.docx')]));
    await act(async () => fireEvent.click(screen.getByTestId('batch-template-each')));
    await act(async () => fireEvent.change(screen.getAllByTestId('batch-template-select')[0], { target: { value: 'ebl' } }));
    await act(async () => fireEvent.click(screen.getByTestId('batch-template-same')));
    await act(async () => fireEvent.click(screen.getByTestId('compact-template-et')));
    await act(async () => fireEvent.click(screen.getByTestId('continue-to-editor-btn')));
    await waitFor(() => expect(screen.getByTestId('batch-summary').textContent).toContain('Hoàn thành 2/2'), { timeout: 4000 });
    const badges = screen.getAllByTestId('batch-item-journal').map((b) => b.textContent);
    expect(badges[0]).toBe(badges[1]);
  });
});
