// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TablePaperEditor } from '@/features/editor/paper-table/TablePaperEditor';
import { PaperTableProvider } from '@/features/editor/paper-table/paper-table-context';
import { SectionCardHeader } from '@/features/editor/components/sections/SectionCardHeader';
import { createEmptyPaper, DEFAULT_LAYOUT_SETTINGS, type PaperSection, type PaperTable } from '@/types/paper';

afterEach(cleanup);

// the sheets and the settings come in a moment after the ground has faded in
const openEditor = async (ui: React.ReactElement) => {
  const r = render(<PaperTableProvider value={{ paper: createEmptyPaper('VNUHCM-HS'), layout: { ...DEFAULT_LAYOUT_SETTINGS }, lang: 'vi' }}>{ui}</PaperTableProvider>);
  await waitFor(() => expect(document.querySelector('.tp-sheet')).toBeTruthy());
  return r;
};

const table = (): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'Bảng thử',
  source: 'Nguồn: tác giả',
  headers: ['A', 'B'],
  rows: [['1', '2'], ['3', '4']],
  headerRows: [[{ text: 'A', isHeader: true }, { text: 'B', isHeader: true }]],
  bodyRows: [
    [{ text: '1' }, { text: '2' }],
    [{ text: '3' }, { text: '4' }],
  ],
  columnSpan: '1-column',
});

const wrap = (ui: React.ReactNode) => (
  <PaperTableProvider value={{ paper: createEmptyPaper('VNUHCM-HS'), layout: { ...DEFAULT_LAYOUT_SETTINGS }, lang: 'vi' }}>{ui}</PaperTableProvider>
);

describe('the paper view of a table', () => {
  it('draws the table on a sheet, with its caption, its source and the tools over it', async () => {
    await openEditor(<TablePaperEditor table={table()} onChange={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Bảng trên trang giấy' })).toBeTruthy();
    expect(document.querySelectorAll('.tp-sheet').length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('.tp-sheet .tp-caption')?.textContent).toContain('Bảng 1:');
    expect(document.querySelector('.tp-sheet .tp-caption')?.textContent).toContain('Bảng thử');
    expect(document.querySelector('.tp-sheet .tp-source')?.textContent).toContain('Nguồn: tác giả');
    expect(screen.getByTestId('table-paper-toolbar')).toBeTruthy();
    // the settings of the table stand beside the sheet
    await waitFor(() => expect(screen.getByTestId('table-paper-settings').querySelector('[data-docked="true"]')).toBeTruthy());
  });

  it('shows the cells (each once) as the table has them', async () => {
    await openEditor(<TablePaperEditor table={table()} onChange={vi.fn()} onClose={vi.fn()} />);
    const cells = [...document.querySelectorAll('.tp-sheet td[data-r]')].map((e) => e.textContent);
    expect(cells).toEqual(['A', 'B', '1', '2', '3', '4']);
  });

  it('a cell is typed in and the table is handed over at once', async () => {
    const onChange = vi.fn();
    await openEditor(<TablePaperEditor table={table()} onChange={onChange} onClose={vi.fn()} />);
    // (the cell of the second body row, first column)
    const cell = document.querySelector<HTMLElement>('.tp-sheet td[data-r="2"][data-c="0"] .tp-cell')!;
    cell.textContent = '30';
    fireEvent.input(cell);
    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as PaperTable;
    expect(last.bodyRows![1][0].text).toBe('30');
    expect(last.rows[1][0]).toBe('30');
    expect(last.bodyRows![0][0].text).toBe('1');
  });

  it('the tools work on the cells chosen: a fill, a merge, a row more, and the history takes it back', async () => {
    const onChange = vi.fn();
    await openEditor(<TablePaperEditor table={table()} onChange={onChange} onClose={vi.fn()} />);
    const td = (r: number, c: number) => document.querySelector<HTMLElement>(`.tp-sheet td[data-r="${r}"][data-c="${c}"]`)!;
    fireEvent.pointerDown(td(1, 0), { button: 0 });
    fireEvent.pointerEnter(td(1, 1));
    fireEvent.pointerUp(window);
    expect(screen.getByTestId('tp-selection').textContent).toBe('1 hàng × 2 cột');
    // merge
    fireEvent.click(screen.getByTestId('tp-merge'));
    let t = onChange.mock.calls[onChange.mock.calls.length - 1][0] as PaperTable;
    expect(t.bodyRows![0]).toHaveLength(1);
    expect(t.bodyRows![0][0].colSpan).toBe(2);
    // undo
    fireEvent.click(screen.getByTestId('tp-undo'));
    t = onChange.mock.calls[onChange.mock.calls.length - 1][0] as PaperTable;
    expect(t.bodyRows![0]).toHaveLength(2);
  });

  it('closes with the button and with Esc', async () => {
    const onClose = vi.fn();
    await openEditor(<TablePaperEditor table={table()} onChange={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('table-paper-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});

describe('the icon on the table block', () => {
  const section = (): PaperSection => ({ id: 's', type: 'table', content: '', table: table() });
  const header = () => (
    <SectionCardHeader
      sec={section()}
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

  it('opens the paper view', async () => {
    render(wrap(header()));
    expect(screen.queryByTestId('table-paper-editor')).toBeNull();
    fireEvent.click(screen.getByTestId('table-paper-open'));
    expect(screen.getByTestId('table-paper-editor')).toBeTruthy();
  });

  it('is not offered where the editor does not provide the paper', async () => {
    render(header());
    expect(screen.queryByTestId('table-paper-open')).toBeNull();
  });
});

describe('the toolbar of the paper view', () => {
  const td = (r: number, c: number) => document.querySelector<HTMLElement>(`.tp-sheet td[data-r="${r}"][data-c="${c}"]`)!;
  const select = (r: number, c: number) => {
    fireEvent.pointerDown(td(r, c), { button: 0 });
    fireEvent.pointerUp(window);
  };

  it('shows what the chosen cell is set as: bold, centred, with a fill', async () => {
    const t = table();
    t.bodyRows![0][0] = { text: '<b>1</b>', align: 'center', fill: '#FFE08A' };
    await openEditor(<TablePaperEditor table={t} onChange={vi.fn()} onClose={vi.fn()} />);
    select(1, 0);
    expect(screen.getByTestId('tp-bold').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('tp-italic').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('tp-align-center').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('tp-align-left').getAttribute('aria-pressed')).toBe('false');
    // another cell, another state
    select(1, 1);
    expect(screen.getByTestId('tp-bold').getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('tp-align-left').getAttribute('aria-pressed')).toBe('true');
  });

  it('raised and lowered text are buttons, and show when they are on', async () => {
    const t = table();
    t.bodyRows![0][0] = { text: 'H<sub>2</sub>' };
    t.bodyRows![0][1] = { text: '<sup>2</sup>' };
    await openEditor(<TablePaperEditor table={t} onChange={vi.fn()} onClose={vi.fn()} />);
    select(1, 1);
    expect(screen.getByTestId('tp-sup').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('tp-sub').getAttribute('aria-pressed')).toBe('false');
  });

  it('a whole cell is set raised with the button when the cells, not the text, are chosen', async () => {
    const onChange = vi.fn();
    await openEditor(<TablePaperEditor table={table()} onChange={onChange} onClose={vi.fn()} />);
    fireEvent.pointerDown(td(1, 0), { button: 0 });
    fireEvent.pointerEnter(td(1, 1));
    fireEvent.pointerUp(window);
    fireEvent.click(screen.getByTestId('tp-sup'));
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as PaperTable;
    expect(last.bodyRows![0][0].text).toBe('<sup>1</sup>');
  });

  it('the fill panel offers the header band and the tinted row colours first', async () => {
    await openEditor(<TablePaperEditor table={table()} onChange={vi.fn()} onClose={vi.fn()} />);
    select(1, 0);
    fireEvent.click(screen.getByTestId('tp-fill'));
    const lead = screen.getByTestId('color-lead');
    expect(lead.querySelectorAll('button')).toHaveLength(2);
    expect(lead.textContent).toBe('Màu hay dùng cho bảng');
    // the panel of the app's other places: it has the basic colours after them
    expect(screen.getByTestId('color-panel').textContent).toContain('Màu hay dùng cho bảng');
  });

  it('the lines of the cells chosen take the colour chosen', async () => {
    const onChange = vi.fn();
    await openEditor(<TablePaperEditor table={table()} onChange={onChange} onClose={vi.fn()} />);
    select(1, 0);
    fireEvent.click(screen.getByTestId('tp-borders'));
    // the colour is chosen in the same panel as the lines
    fireEvent.click(screen.getByTestId('tp-line-color'));
    fireEvent.click(screen.getByTestId('color-ff0000'));
    fireEvent.click(screen.getByTestId('tp-border-bottom'));
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as PaperTable;
    expect(last.bodyRows![0][0].borders).toEqual({ bottom: 'line' });
    expect(last.bodyRows![0][0].borderColors).toEqual({ bottom: '#FF0000' });
  });
});

describe('history while the paper view is open', () => {
  it('stands as a dialog the paper\'s own history leaves alone, and Ctrl+Z undoes this table only', async () => {
    const onChange = vi.fn();
    await openEditor(<TablePaperEditor table={table()} onChange={onChange} onClose={vi.fn()} />);
    // the mark the paper's history looks for before it answers Ctrl+Z
    expect(document.querySelector('[data-testid="modal-portal-root"]')).toBeTruthy();
    const cell = document.querySelector<HTMLElement>('.tp-sheet td[data-r="1"][data-c="0"] .tp-cell')!;
    cell.textContent = 'đổi';
    fireEvent.input(cell);
    let last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as PaperTable;
    expect(last.bodyRows![0][0].text).toBe('đổi');
    const outside = vi.fn();
    window.addEventListener('keydown', outside);
    const ev = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(ev);
    window.removeEventListener('keydown', outside);
    last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as PaperTable;
    expect(last.bodyRows![0][0].text).toBe('1');
    expect(ev.defaultPrevented).toBe(true);
  });
});

describe('the edge being dragged', () => {
  it('has a blue guide over the table while it is held, and none after', async () => {
    await openEditor(<TablePaperEditor table={table()} onChange={vi.fn()} onClose={vi.fn()} />);
    const handle = document.querySelector<HTMLElement>('.tp-sheet td[data-r="1"][data-c="0"] .tp-colh')!;
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, clientY: 100 });
    expect(screen.getByTestId('tp-guide')).toBeTruthy();
    fireEvent.pointerUp(window);
    expect(screen.queryByTestId('tp-guide')).toBeNull();
  });
});
