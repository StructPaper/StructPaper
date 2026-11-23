// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import { RichLineInput } from '@/features/editor/components/sections/RichLineInput';
import { TipTapParagraphEditor } from '@/features/editor/components/sections/TipTapParagraphEditor';
import { XrefProvider } from '@/features/editor/xref-context';

afterEach(cleanup);
vi.setConfig({ testTimeout: 20000 });

const paper: any = {
  references: [{ id: 1, raw: 'Puriwat W. The impact of digital', isCited: true }],
  sections: [
    { id: 'f', type: 'figure', content: '', figure: { id: 'f1', num: 1, caption: 'Figure 1: Proposed model', src: 'x' } },
    { id: 't1', type: 'table', content: '', table: { id: 'ta', num: 1, caption: 'Table 1: Variables', headers: ['A'], rows: [] } },
    { id: 't2', type: 'table', content: '', table: { id: 'tb', num: 2, caption: 'Table 2: Frequency', headers: ['A'], rows: [] } },
  ],
};

describe('the fields of the form that take what goes into the text', () => {
  it('a field offers the tools while it is written in, and a table or figure goes in as a reference', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <XrefProvider paper={paper} lang="en">
        <RichLineInput value="Abstract" onChange={onChange} ariaLabel="Tóm tắt" />
      </XrefProvider>
    );
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    expect(screen.queryByTestId('field-xref')).toBeNull();
    await act(async () => {
      fireEvent.focus(container.querySelector('.ProseMirror')!);
    });
    await act(async () => {
      screen.getByTestId('field-xref').click();
    });
    // the tables stand together and the figures together, each in its order
    const tables = await screen.findByTestId('xref-group-table');
    const figures = await screen.findByTestId('xref-group-figure');
    expect(tables.textContent).toContain('Table 1');
    expect(tables.textContent).toContain('Table 2');
    expect(tables.textContent).not.toContain('Figure');
    expect(figures.textContent).toContain('Figure 1');
    expect(tables.textContent).not.toContain('Table 1: Table 1');
    await act(async () => {
      screen.getByTestId('xref-table-2').click();
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0]).toContain('[[tbl:tb]]');
  });

  it('a footnote is a letter in brackets in the text, with its note at the end of the block', async () => {
    const { container } = render(
      <XrefProvider paper={paper} lang="en">
        <TipTapParagraphEditor value="Animus[[fn: Animus là một khái niệm.]] hết, rồi Bảng[[fn: Ghi chú hai.]]" isEditing={false} />
      </XrefProvider>
    );
    expect(container.querySelectorAll('.marker-fn-mark')).toHaveLength(2);
    const notes = screen.getByTestId('marker-notes');
    expect(Array.from(notes.querySelectorAll('.marker-note')).map((n) => n.textContent)).toEqual(['Animus là một khái niệm.', 'Ghi chú hai.']);
    // the marker itself is never written on the screen
    expect(container.textContent).not.toContain('[[fn');
  });
});

describe('a formula inside the text', () => {
  it('is drawn as a formula, never as the code between dollar signs', () => {
    const { container } = render(
      <XrefProvider paper={paper} lang="en">
        <TipTapParagraphEditor value="Giá trị $a + b + c$ ở đây" isEditing={false} />
      </XrefProvider>
    );
    expect(container.querySelector('.katex')).not.toBeNull();
    expect(container.textContent).not.toContain('$a + b + c$');
  });

  it('opens for editing when it is clicked, and the change goes back into the text', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <XrefProvider paper={paper} lang="en">
        <RichLineInput value="Công thức $x^2$ nhé" onChange={onChange} ariaLabel="Tóm tắt" />
      </XrefProvider>
    );
    await waitFor(() => expect(container.querySelector('.ov-math')).not.toBeNull());
    await act(async () => {
      fireEvent.click(container.querySelector('.ov-math')!);
    });
    const input = (await screen.findByPlaceholderText(/ví dụ: E = mc\^2/i)) as HTMLTextAreaElement;
    expect(input.value).toBe('x^2');
    await act(async () => {
      fireEvent.change(input, { target: { value: 'x^3' } });
    });
    await act(async () => {
      screen.getByRole('button', { name: 'Chèn' }).click();
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)![0]).toBe('Công thức $x^3$ nhé');
  });
});
