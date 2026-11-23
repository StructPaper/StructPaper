// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor, fireEvent } from '@testing-library/react';
import { TableSourceField, TableSectionItem } from '@/features/editor/components/sections/TableSectionItem';
import type { PaperSection } from '@/types/paper';
import type { TableSourceStyle } from '@/lib/table-source';

afterEach(cleanup);
vi.setConfig({ testTimeout: 20000 });

/** The field with a source that takes back what it hands out, as the card does. */
const Field: React.FC<{ initial?: string; initialStyle?: TableSourceStyle; spy: (source: string, style: TableSourceStyle | undefined) => void }> = ({ initial = '', initialStyle, spy }) => {
  const [source, setSource] = React.useState(initial);
  const [style, setStyle] = React.useState<TableSourceStyle | undefined>(initialStyle);
  return (
    <TableSourceField
      source={source}
      style={style}
      onChange={(s, st) => {
        setSource(s);
        setStyle(st);
        spy(s, st);
      }}
    />
  );
};

/** The field, once its editor is built (it is built when the field is clicked). */
const box = async () => {
  const first = (await screen.findByLabelText('Nguồn và chú thích dưới bảng')) as HTMLElement;
  if (!(first as any).editor) {
    await act(async () => {
      fireEvent.mouseDown(first);
    });
  }
  await waitFor(() => expect(((screen.getByLabelText('Nguồn và chú thích dưới bảng') as any).editor)).toBeTruthy());
  return screen.getByLabelText('Nguồn và chú thích dưới bảng') as HTMLElement;
};
/** Writes lines into the field the way an author does (each Enter is a new line). */
const write = async (el: HTMLElement, lines: string[]) => {
  const ed = (el as any).editor;
  await act(async () => {
    ed.commands.setContent({ type: 'doc', content: lines.map((l) => ({ type: 'paragraph', content: l ? [{ type: 'text', text: l }] : [] })) }, { emitUpdate: true });
  });
};

describe('the source under a table, in the form', () => {
  it('takes several lines: Enter starts a new one, and the text keeps its line breaks', async () => {
    const spy = vi.fn();
    render(<Field spy={spy} />);
    const el = await box();
    await write(el, ['Chú thích: *, ** là mức ý nghĩa', 'Nguồn: Tác giả']);
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(spy).toHaveBeenLastCalledWith('Chú thích: *, ** là mức ý nghĩa\nNguồn: Tác giả', undefined);
    expect(el.querySelectorAll('p')).toHaveLength(2);
  });

  it('shows the lines as the PDF sets them: a note in italic, a source upright, to the left', async () => {
    render(<Field initial={'Chú thích: a\nNguồn: b'} spy={vi.fn()} />);
    const el = await box();
    // (the first line decides how the box looks)
    expect(el.className).toContain('italic');
    expect(screen.getByTestId('table-source-italic').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('table-source-left').getAttribute('aria-pressed')).toBe('true');
    cleanup();
    render(<Field initial="Nguồn: Tác giả" spy={vi.fn()} />);
    const plain = await box();
    expect(plain.className).not.toContain('italic');
    expect(screen.getByTestId('table-source-italic').getAttribute('aria-pressed')).toBe('false');
  });

  it('has bold, italic and alignment for the whole block, and keeps only what was chosen', async () => {
    const spy = vi.fn();
    render(<Field initial="Nguồn: Tác giả" spy={spy} />);
    const el = await box();
    act(() => screen.getByTestId('table-source-italic').click());
    expect(spy).toHaveBeenLastCalledWith('Nguồn: Tác giả', { italic: true });
    act(() => screen.getByTestId('table-source-center').click());
    expect(spy).toHaveBeenLastCalledWith('Nguồn: Tác giả', { italic: true, align: 'center' });
    act(() => screen.getByTestId('table-source-bold').click());
    expect(spy).toHaveBeenLastCalledWith('Nguồn: Tác giả', { italic: true, align: 'center', bold: true });
    // (the editor takes the new look as the field is drawn again)
    expect(el.className).toContain('font-bold');
    expect(el.className).toContain('text-center');
    // everything back to the journal's own: nothing is kept
    act(() => screen.getByTestId('table-source-bold').click());
    act(() => screen.getByTestId('table-source-left').click());
    act(() => screen.getByTestId('table-source-italic').click());
    expect(spy).toHaveBeenLastCalledWith('Nguồn: Tác giả', { italic: false });
  });

  it('is on the card of a table, and writes the lines and their look into the table', async () => {
    const onUpdate = vi.fn();
    const sec: PaperSection = { id: 's', type: 'table', content: '', table: { id: 't', num: 1, caption: 'Bảng', headers: ['A'], rows: [['1']], source: 'Nguồn: Tác giả' } };
    render(<TableSectionItem sec={sec} idx={3} onUpdateSection={onUpdate} onOpenTableZoom={vi.fn()} onPasteTableData={vi.fn()} onPasteTableFromClipboardButton={vi.fn()} />);
    const el = await box();
    expect(el.textContent).toBe('Nguồn: Tác giả');
    await write(el, ['Nguồn: Tác giả', 'Chú thích: ghi thêm']);
    await waitFor(() => expect(onUpdate).toHaveBeenCalled());
    expect(onUpdate).toHaveBeenLastCalledWith(3, expect.objectContaining({ table: expect.objectContaining({ source: 'Nguồn: Tác giả\nChú thích: ghi thêm' }) }));
    act(() => screen.getByTestId('table-source-right').click());
    expect(onUpdate).toHaveBeenLastCalledWith(3, expect.objectContaining({ table: expect.objectContaining({ sourceStyle: { align: 'right' } }) }));
  });
});
