// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { StepSelectTemplate } from '@/features/papers/components/CreatePaperModal/StepSelectTemplate';
import { StepBatchTemplates } from '@/features/papers/components/CreatePaperModal/StepBatchTemplates';

afterEach(cleanup);

const files = [new File(['a'], 'a.docx'), new File(['b'], 'b.docx')];

describe('step 2: choosing a journal template', () => {
  it('nothing is chosen up front, and continuing without a choice means automatic', () => {
    const onConfirm = vi.fn();
    render(<StepSelectTemplate onConfirm={onConfirm} onBack={vi.fn()} />);

    expect(document.querySelector('[data-testid^="selected-tick-"]')).toBeNull();
    expect(screen.getByTestId('template-auto-hint').textContent).toMatch(/tự nhận diện/);

    fireEvent.click(screen.getByTestId('continue-to-editor-btn'));
    expect(onConfirm).toHaveBeenCalledWith(null);
  });

  it('choosing a card selects it; choosing the same card again un-selects it', () => {
    const onConfirm = vi.fn();
    render(<StepSelectTemplate onConfirm={onConfirm} onBack={vi.fn()} />);
    const card = document.querySelector('[data-testid^="compact-template-"]') as HTMLElement;
    const id = card.getAttribute('data-testid')!.replace('compact-template-', '');

    fireEvent.click(card);
    expect(screen.getByTestId(`selected-tick-${id}`)).toBeDefined();
    fireEvent.click(screen.getByTestId('continue-to-editor-btn'));
    expect(onConfirm).toHaveBeenLastCalledWith(expect.objectContaining({ id }));

    fireEvent.click(card);
    expect(document.querySelector('[data-testid^="selected-tick-"]')).toBeNull();
    fireEvent.click(screen.getByTestId('continue-to-editor-btn'));
    expect(onConfirm).toHaveBeenLastCalledWith(null);
  });
});

describe('batch import: choosing templates', () => {
  it('nothing is chosen up front: every file is automatic', () => {
    const onConfirm = vi.fn();
    render(<StepBatchTemplates files={files} onConfirm={onConfirm} onBack={vi.fn()} />);

    expect(document.querySelector('[data-testid^="selected-tick-"]')).toBeNull();
    fireEvent.click(screen.getByTestId('continue-to-editor-btn'));
    expect(onConfirm).toHaveBeenCalledWith([null, null]);
  });

  it('one template for all, un-selectable by choosing it again', () => {
    const onConfirm = vi.fn();
    render(<StepBatchTemplates files={files} onConfirm={onConfirm} onBack={vi.fn()} />);
    const card = document.querySelector('[data-testid^="compact-template-"]') as HTMLElement;

    fireEvent.click(card);
    fireEvent.click(screen.getByTestId('continue-to-editor-btn'));
    const chosen = onConfirm.mock.calls[0][0];
    expect(chosen[0]).toEqual(chosen[1]);
    expect(chosen[0]).not.toBeNull();

    fireEvent.click(card);
    fireEvent.click(screen.getByTestId('continue-to-editor-btn'));
    expect(onConfirm.mock.calls[1][0]).toEqual([null, null]);
  });

  it('per file: a file may keep "Tự động" while another gets a template', () => {
    const onConfirm = vi.fn();
    render(<StepBatchTemplates files={files} onConfirm={onConfirm} onBack={vi.fn()} />);
    fireEvent.click(screen.getByTestId('batch-template-each'));

    const selects = screen.getAllByTestId('batch-template-select') as HTMLSelectElement[];
    expect(selects.map((s) => s.value)).toEqual(['', '']);
    expect(selects[0].options[0].textContent).toBe('Tự động');

    const second = Array.from(selects[1].options).find((o) => o.value)!.value;
    fireEvent.change(selects[1], { target: { value: second } });
    fireEvent.click(screen.getByTestId('continue-to-editor-btn'));

    const result = onConfirm.mock.calls[0][0];
    expect(result[0]).toBeNull();
    expect(result[1]).toEqual(expect.objectContaining({ id: second }));
  });
});
