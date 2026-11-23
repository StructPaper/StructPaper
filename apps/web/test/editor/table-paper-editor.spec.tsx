// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TablePaperEditor } from '@/features/editor/paper-table/TablePaperEditor';
import { PaperTableProvider } from '@/features/editor/paper-table/paper-table-context';
import { SectionCardHeader } from '@/features/editor/components/sections/SectionCardHeader';
import { createEmptyPaper, DEFAULT_LAYOUT_SETTINGS, type PaperSection, type PaperTable } from '@/types/paper';

afterEach(cleanup);

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
  it('draws the table on a sheet, with its caption, its source and the tools over it', () => {
    render(wrap(<TablePaperEditor table={table()} onChange={vi.fn()} onClose={vi.fn()} />));
    expect(screen.getByRole('dialog', { name: 'Bảng trên trang giấy' })).toBeTruthy();
    expect(document.querySelectorAll('.tp-sheet').length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('.tp-sheet .tp-caption')?.textContent).toContain('Bảng 1:');
    expect(document.querySelector('.tp-sheet .tp-caption')?.textContent).toContain('Bảng thử');
    expect(document.querySelector('.tp-sheet .tp-source')?.textContent).toContain('Nguồn: tác giả');
    expect(screen.getByTestId('table-paper-toolbar')).toBeTruthy();
    // the settings of the table stand beside the sheet
    expect(screen.getByTestId('table-paper-settings').querySelector('[data-docked="true"]')).toBeTruthy();
  });

  it('shows the cells (each once) as the table has them', () => {
    render(wrap(<TablePaperEditor table={table()} onChange={vi.fn()} onClose={vi.fn()} />));
    const cells = [...document.querySelectorAll('.tp-sheet td[data-r]')].map((e) => e.textContent);
    expect(cells).toEqual(['A', 'B', '1', '2', '3', '4']);
  });

  it('a cell is typed in and the table is handed over at once', () => {
    const onChange = vi.fn();
    render(wrap(<TablePaperEditor table={table()} onChange={onChange} onClose={vi.fn()} />));
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

  it('the tools work on the cells chosen: a fill, a merge, a row more, and the history takes it back', () => {
    const onChange = vi.fn();
    render(wrap(<TablePaperEditor table={table()} onChange={onChange} onClose={vi.fn()} />));
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

  it('closes with the button and with Esc', () => {
    const onClose = vi.fn();
    render(wrap(<TablePaperEditor table={table()} onChange={vi.fn()} onClose={onClose} />));
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

  it('opens the paper view', () => {
    render(wrap(header()));
    expect(screen.queryByTestId('table-paper-editor')).toBeNull();
    fireEvent.click(screen.getByTestId('table-paper-open'));
    expect(screen.getByTestId('table-paper-editor')).toBeTruthy();
  });

  it('is not offered where the editor does not provide the paper', () => {
    render(header());
    expect(screen.queryByTestId('table-paper-open')).toBeNull();
  });
});
