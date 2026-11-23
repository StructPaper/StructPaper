// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TablePaperEditor } from '@/features/editor/paper-table/TablePaperEditor';
import { PaperTableProvider } from '@/features/editor/paper-table/paper-table-context';
import { SectionCardHeader } from '@/features/editor/components/sections/SectionCardHeader';
import { createEmptyPaper, DEFAULT_LAYOUT_SETTINGS, type PaperSection, type PaperTable } from '@/types/paper';

afterEach(cleanup);
vi.setConfig({ testTimeout: 20000 });

const table = (): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'Bảng thử',
  headers: ['A', 'B'],
  rows: [['1', '2'], ['3', '4']],
  headerRows: [[{ text: 'A', isHeader: true }, { text: 'B', isHeader: true }]],
  bodyRows: [
    [{ text: '1' }, { text: '2' }],
    [{ text: '3' }, { text: '4' }],
  ],
  columnSpan: '1-column',
});
const provider = (ui: React.ReactNode) => (
  <PaperTableProvider value={{ paper: createEmptyPaper('VNUHCM-HS'), layout: { ...DEFAULT_LAYOUT_SETTINGS }, lang: 'vi' }}>{ui}</PaperTableProvider>
);
const open = async (onChange = vi.fn()) => {
  render(provider(<TablePaperEditor table={table()} onChange={onChange} onClose={vi.fn()} />));
  await waitFor(() => expect(document.querySelector('.tp-sheet')).toBeTruthy());
  return onChange;
};
const td = (r: number, c: number) => document.querySelector<HTMLElement>(`.tp-sheet td[data-r="${r}"][data-c="${c}"]`)!;
const select = (r: number, c: number) => {
  fireEvent.pointerDown(td(r, c), { button: 0 });
  fireEvent.pointerUp(window);
};
const lastTable = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0] as PaperTable;

describe('the size of the text', () => {
  it('shows the size of the table until a cell has its own, and sets the size of the cells chosen with + and −', async () => {
    const onChange = await open();
    select(1, 0);
    const input = screen.getByTestId('tp-font-input') as HTMLInputElement;
    expect(input.value).toBe('8');
    fireEvent.click(screen.getByTestId('tp-font-plus'));
    expect(lastTable(onChange).bodyRows![0][0].fontSize).toBe(9);
    expect(lastTable(onChange).bodyRows![0][1].fontSize).toBeUndefined();
    expect((screen.getByTestId('tp-font-input') as HTMLInputElement).value).toBe('9');
    fireEvent.click(screen.getByTestId('tp-font-minus'));
    fireEvent.click(screen.getByTestId('tp-font-minus'));
    expect(lastTable(onChange).bodyRows![0][0].fontSize).toBe(7);
  });

  it('a size typed in is taken, and the size of the table itself is back when it is the table\'s', async () => {
    const onChange = await open();
    select(1, 1);
    const input = screen.getByTestId('tp-font-input') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '11' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(lastTable(onChange).bodyRows![0][1].fontSize).toBe(11);
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '8' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(lastTable(onChange).bodyRows![0][1].fontSize).toBeUndefined();
  });

  it('with no cell chosen it sets the size of the whole table', async () => {
    const onChange = await open();
    fireEvent.click(screen.getByTestId('tp-font-plus'));
    expect(lastTable(onChange).fontSize).toBe('9pt');
  });
});

describe('the borders panel', () => {
  it('holds the lines and their colour together, two rows of five and a column for the colour', async () => {
    await open();
    select(1, 0);
    fireEvent.click(screen.getByTestId('tp-borders'));
    const modes = ['all', 'inner', 'inner-h', 'inner-v', 'outer', 'top', 'bottom', 'left', 'right', 'none'];
    for (const m of modes) expect(screen.getByTestId(`tp-border-${m}`)).toBeTruthy();
    expect(screen.getByTestId('tp-line-color')).toBeTruthy();
    expect(screen.getByTestId('tp-border-reset')).toBeTruthy();
    // no colour button of its own in the toolbar any more
    expect(screen.getAllByTestId('tp-line-color')).toHaveLength(1);
  });
});

describe('the ground of the paper view', () => {
  it('is a light glass: a clear light colour with the page behind it blurred', async () => {
    await open();
    const root = screen.getByTestId('table-paper-editor');
    expect(root.style.backdropFilter).toContain('blur');
    expect(root.style.background).toContain('rgba(244');
  });

  it('fades in: the ground first, the sheets after it', () => {
    render(provider(<TablePaperEditor table={table()} onChange={vi.fn()} onClose={vi.fn()} />));
    expect(screen.getByTestId('table-paper-editor')).toBeTruthy();
    expect(document.querySelector('.tp-sheet')).toBeNull();
  });
});

describe('the block of a table', () => {
  const header = () => {
    const sec: PaperSection = { id: 's', type: 'table', content: '', table: table() };
    return (
      <SectionCardHeader
        sec={sec}
        idx={0}
        isDeleting={false}
        onUpdateSection={vi.fn()}
        onRemoveSection={vi.fn()}
        onMoveUp={vi.fn()}
        onMoveDown={vi.fn()}
        onConvertToHeading={vi.fn()}
        onConvertToParagraph={vi.fn()}
        onOpenTableZoom={vi.fn()}
        onOpenFigureSettings={vi.fn()}
        onOpenTableSettings={vi.fn()}
        onCloseSettings={vi.fn()}
        onSaveFigureSettings={vi.fn()}
        onSaveTableSettings={vi.fn()}
      />
    );
  };

  it('has the paper button to the left of the page-break button, set as it is', () => {
    render(provider(header()));
    const paper = screen.getByTestId('table-paper-open');
    const brk = screen.getByTitle(/Ngắt trang sau phần này/);
    expect(paper.compareDocumentPosition(brk) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // the same look as the page-break button (not a coloured block)
    expect(paper.className).toContain('text-zinc-500');
    expect(paper.className).not.toContain('bg-[#ECFCCB]');
  });
});

describe('the note under the table on the sheet', () => {
  const openWith = async (source: string, extra: Partial<PaperTable> = {}) => {
    render(provider(<TablePaperEditor table={{ ...table(), source, ...extra }} onChange={vi.fn()} onClose={vi.fn()} />));
    await waitFor(() => expect(document.querySelector('.tp-sheet .tp-source')).toBeTruthy());
    return document.querySelector<HTMLElement>('.tp-sheet .tp-source')!;
  };

  it('is set as the PDF sets it: a note in italic, a source upright', async () => {
    expect((await openWith('Ghi chú: CT: nhóm can thiệp')).style.fontStyle).toBe('italic');
    cleanup();
    expect((await openWith('Nguồn: tác giả')).style.fontStyle).toBe('normal');
  });

  it('follows the bold, italic and alignment the author chose for it', async () => {
    const el = await openWith('Nguồn: tác giả', { sourceStyle: { bold: true, italic: true, align: 'center' } });
    expect(el.style.fontWeight).toBe('700');
    expect(el.style.fontStyle).toBe('italic');
    expect(el.style.textAlign).toBe('center');
  });

  it('is as wide as the room of the table, whatever width the table itself has', async () => {
    const wide = await openWith('Nguồn: tác giả');
    const full = parseFloat(wide.style.width);
    cleanup();
    const narrow = await openWith('Nguồn: tác giả', { widthPercent: 50 });
    expect(parseFloat(narrow.style.width)).toBeCloseTo(full, 3);
  });
});
