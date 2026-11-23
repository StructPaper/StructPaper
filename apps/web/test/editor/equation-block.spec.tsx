// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within, waitFor } from '@testing-library/react';

vi.mock('@/features/preview', () => ({ MathFormula: ({ latex }: { latex: string }) => <span data-testid="math-preview">{latex}</span> }));

import { EquationSectionItem } from '@/features/editor/components/sections/EquationSectionItem';
import type { PaperSection } from '@/types/paper';

afterEach(cleanup);

const section = (latex: string, extra: Record<string, unknown> = {}): PaperSection => ({
  id: 'e1',
  type: 'equation',
  content: latex,
  equation: { latex, numbered: true, num: 2, ...extra },
});

/** Renders the block and keeps it in step with what it reports, as the editor does. */
function Harness({ start, spy }: { start: PaperSection; spy: (s: PaperSection) => void }) {
  const [sec, setSec] = React.useState(start);
  return (
    <EquationSectionItem
      sec={sec}
      idx={0}
      onUpdateSection={(_i, next) => {
        spy(next);
        setSec(next);
      }}
    />
  );
}

const box = () => screen.getByLabelText('Mã LaTeX của công thức') as HTMLTextAreaElement;

describe('the equation block tools', () => {
  it('a new, empty formula opens on the structures', () => {
    render(<Harness start={section('')} spy={vi.fn()} />);
    expect(screen.getByTestId('equation-tool-buttons')).toBeTruthy();
    expect(screen.getByTestId('equation-panel-structures').getAttribute('aria-selected')).toBe('true');
  });

  it('a formula that already has content starts with the tools folded away', () => {
    render(<Harness start={section('x^2')} spy={vi.fn()} />);
    expect(screen.queryByTestId('equation-tool-buttons')).toBeNull();
  });

  it('a structure button puts the structure at the cursor and wraps the selection', () => {
    const spy = vi.fn();
    render(<Harness start={section('y = x')} spy={spy} />);
    fireEvent.click(screen.getByTestId('equation-panel-structures'));
    box().setSelectionRange(4, 5);
    fireEvent.click(screen.getByTitle(/Phân số/));
    expect(spy).toHaveBeenLastCalledWith(expect.objectContaining({ content: String.raw`y = \frac{x}{}` }));
    expect(box().value).toBe(String.raw`y = \frac{x}{}`);
  });

  it('a symbol button inserts the symbol where the cursor is', () => {
    render(<Harness start={section('a+b')} spy={vi.fn()} />);
    fireEvent.click(screen.getByTestId('equation-panel-greek'));
    box().setSelectionRange(1, 1);
    fireEvent.click(screen.getByTitle(/alpha/));
    expect(box().value).toBe(String.raw`a\alpha +b`);
  });

  it('the list of ready-made formulas replaces the formula and folds away', () => {
    const spy = vi.fn();
    render(<Harness start={section('x')} spy={spy} />);
    fireEvent.click(screen.getByTestId('equation-panel-templates'));
    const list = screen.getByTestId('equation-templates');
    fireEvent.click(within(list).getByText('Trung bình mẫu'));
    expect(box().value).toContain(String.raw`\bar{x}`);
    expect(screen.queryByTestId('equation-templates')).toBeNull();
  });

  it('pasted LaTeX loses its $$ / \\[ \\] / \\begin{equation} wrapping', () => {
    const spy = vi.fn();
    render(<Harness start={section('')} spy={spy} />);
    fireEvent.paste(box(), { clipboardData: { getData: () => String.raw`\begin{equation} x^2 \label{eq:1} \end{equation}` } });
    expect(box().value).toBe('x^2');
    fireEvent.paste(box(), { clipboardData: { getData: () => '$$y$$' } });
    expect(box().value).toContain('y');
    expect(box().value).not.toContain('$');
  });

  it('copies the way to point at the equation from the text', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<Harness start={section('x^2')} spy={vi.fn()} />);
    fireEvent.click(screen.getByTestId('equation-copy-mention'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Công thức (2)'));
    fireEvent.click(screen.getByTestId('equation-copy-latex'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('x^2'));
  });

  it('a formula that is not numbered offers no number to copy; the clear button empties it', () => {
    const spy = vi.fn();
    render(<Harness start={section('x^2', { numbered: false })} spy={spy} />);
    expect(screen.queryByTestId('equation-copy-mention')).toBeNull();
    fireEvent.click(screen.getByTestId('equation-clear'));
    expect(box().value).toBe('');
  });

  it('says when a brace is missing', () => {
    render(<Harness start={section(String.raw`\frac{a}{b`)} spy={vi.fn()} />);
    expect(screen.getByRole('alert').textContent.length + (screen.queryByTestId('equation-balance')?.textContent.length ?? 0)).toBeGreaterThan(0);
  });
});
