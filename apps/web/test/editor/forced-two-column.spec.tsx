// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { TableSettingsModal } from '@/features/editor/components/TableSettingsModal';
import { FigureSettingsModal } from '@/features/editor/components/FigureSettingsModal';
import { TablePaperEditor } from '@/features/editor/paper-table/TablePaperEditor';
import { PaperTableProvider } from '@/features/editor/paper-table/paper-table-context';
import { createEmptyPaper, DEFAULT_LAYOUT_SETTINGS, type PaperFigure, type PaperTable } from '@/types/paper';

afterEach(cleanup);
vi.setConfig({ testTimeout: 20000 });

const table = (extra: Partial<PaperTable> = {}): PaperTable => ({
  id: 't',
  num: 1,
  caption: 'B',
  headers: ['A', 'B'],
  rows: [['1', '2']],
  headerRows: [[{ text: 'A', isHeader: true }, { text: 'B', isHeader: true }]],
  bodyRows: [[{ text: '1' }, { text: '2' }]],
  columnSpan: '1-column',
  ...extra,
});
const figure = (extra: Partial<PaperFigure> = {}): PaperFigure => ({ id: 'f', num: 1, caption: 'H', src: '', columnSpan: '1-column', ...extra });

const radio = (name: RegExp) => screen.getAllByRole('radio').find((r) => name.test(r.textContent ?? ''))!;
const saved = (fn: ReturnType<typeof vi.fn>) => fn.mock.calls[fn.mock.calls.length - 1][0];

describe('a table that is turned or set across the whole page can only be over two columns', () => {
  it('is chosen at once, and one column is greyed and cannot be picked', async () => {
    const onSave = vi.fn();
    render(<TableSettingsModal table={table()} onSave={onSave} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(radio(/^1 cột/).getAttribute('aria-disabled')).toBeNull();
    // turned 90°
    fireEvent.click(screen.getByText('Xoay ngang 90°'));
    expect(radio(/^2 cột/).getAttribute('aria-checked')).toBe('true');
    expect(radio(/^1 cột/).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(radio(/^1 cột/));
    expect(radio(/^2 cột/).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByText('Lưu'));
    expect(saved(onSave)).toMatchObject({ columnSpan: '2-column', isRotated: true, isFullWidth: true });
  });

  it('also when it is set across the whole page, over the side column', async () => {
    const onSave = vi.fn();
    render(<TableSettingsModal table={table()} onSave={onSave} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.click(screen.getByText(/^Cả trang$/));
    expect(radio(/^1 cột/).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByText('Lưu'));
    expect(saved(onSave)).toMatchObject({ columnSpan: '2-column', sideColumn: 'full' });
  });

  it('one that was saved turned with one column is shown, and saved, as two', async () => {
    const onSave = vi.fn();
    render(<TableSettingsModal table={table({ isRotated: true })} onSave={onSave} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(radio(/^2 cột/).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByText('Lưu'));
    expect(saved(onSave)).toMatchObject({ columnSpan: '2-column' });
  });

  it('turning it back does not take the two columns away: that is a choice', async () => {
    render(<TableSettingsModal table={table({ isRotated: true })} onSave={vi.fn()} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.click(screen.getByText('Chiều dọc'));
    expect(radio(/^2 cột/).getAttribute('aria-checked')).toBe('true');
    expect(radio(/^1 cột/).getAttribute('aria-disabled')).toBeNull();
  });
});

describe('the same for a figure', () => {
  it('turned 90° it can only be over two columns', async () => {
    const onSave = vi.fn();
    render(<FigureSettingsModal figure={figure()} onSave={onSave} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    fireEvent.click(screen.getByLabelText('Xoay ngang 90°'));
    expect(radio(/^2 cột/).getAttribute('aria-checked')).toBe('true');
    expect(radio(/^1 cột/).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByText('Lưu'));
    expect(saved(onSave)).toMatchObject({ columnSpan: '2-column', isRotated: true });
  });

  it('a figure that was saved across the whole page with one column is saved as two', async () => {
    const onSave = vi.fn();
    render(<FigureSettingsModal figure={figure({ sideColumn: 'full' })} onSave={onSave} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    expect(radio(/^1 cột/).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByText('Lưu'));
    expect(saved(onSave)).toMatchObject({ columnSpan: '2-column' });
  });
});

describe('the borders panel of the paper view', () => {
  it('stays open as lines and colours are chosen, in any order, until the person clicks away', async () => {
    const onChange = vi.fn();
    render(
      <PaperTableProvider value={{ paper: createEmptyPaper('VNUHCM-HS'), layout: { ...DEFAULT_LAYOUT_SETTINGS }, lang: 'vi' }}>
        <TablePaperEditor table={table()} onChange={onChange} onClose={vi.fn()} />
      </PaperTableProvider>
    );
    await waitFor(() => expect(document.querySelector('.tp-sheet')).toBeTruthy());
    const cell = document.querySelector<HTMLElement>('.tp-sheet td[data-r="1"][data-c="0"]')!;
    fireEvent.pointerDown(cell, { button: 0 });
    fireEvent.pointerUp(window);
    fireEvent.click(screen.getByTestId('tp-borders'));
    fireEvent.click(screen.getByTestId('tp-border-bottom'));
    expect(screen.queryByTestId('tp-border-top')).toBeTruthy();
    // a colour, then another line: the panel is still there
    fireEvent.click(screen.getByTestId('tp-line-color'));
    fireEvent.click(screen.getByTestId('color-ff0000'));
    expect(screen.queryByTestId('tp-border-top')).toBeTruthy();
    fireEvent.click(screen.getByTestId('tp-border-top'));
    expect(screen.queryByTestId('tp-border-top')).toBeTruthy();
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0] as PaperTable;
    expect(last.bodyRows![0][0].borders).toEqual({ bottom: 'line', top: 'line' });
    expect(last.bodyRows![0][0].borderColors).toEqual({ top: '#FF0000' });
    // a click away closes it
    fireEvent.pointerDown(document.body);
    expect(screen.queryByTestId('tp-border-top')).toBeNull();
  });
});

describe('splitting words at the end of a line', () => {
  it('is off in a table, and the table settings can turn it on', async () => {
    const onSave = vi.fn();
    render(<TableSettingsModal table={table()} onSave={onSave} onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    const group = screen.getByTestId('table-hyphen-option');
    const on = Array.from(group.querySelectorAll('[role="radio"]')).find((r) => r.textContent === 'Bật') as HTMLElement;
    const off = Array.from(group.querySelectorAll('[role="radio"]')).find((r) => r.textContent === 'Tắt') as HTMLElement;
    expect(off.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(on);
    fireEvent.click(screen.getByText('Lưu'));
    expect(saved(onSave).hyphenate).toBe(true);
  });
});
