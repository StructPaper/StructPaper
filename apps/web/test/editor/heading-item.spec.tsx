// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, act, fireEvent } from '@testing-library/react';
import { HeadingSectionItem } from '@/features/editor/components/sections/HeadingSectionItem';
import type { PaperSection } from '@/types/paper';

afterEach(cleanup);

const sec = (extra: Partial<PaperSection> = {}): PaperSection => ({ id: 'h', type: 'h2', title: '<b><i>Introduction</i></b>', content: '', ...extra });

describe('a heading in the form', () => {
  it('shows its bold and italic as they print, not as tags', async () => {
    const { container } = render(<HeadingSectionItem sec={sec()} idx={3} onUpdateSection={vi.fn()} />);
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    const pm = container.querySelector('.ProseMirror')!;
    expect(pm.textContent).toBe('Introduction');
    expect(pm.querySelector('strong, b')).not.toBeNull();
    expect(pm.querySelector('em, i')).not.toBeNull();
    expect(pm.textContent).not.toContain('<b>');
  });

  it('opens a settings popup that changes the look and applies it to the others; the level is not repeated in it', async () => {
    const onUpdate = vi.fn();
    const onApply = vi.fn();
    render(<HeadingSectionItem sec={sec({ title: 'Kết quả' })} idx={2} onUpdateSection={onUpdate} onApplyHeadingLook={onApply} />);
    await act(async () => {
      screen.getByTestId('heading-settings').click();
    });
    expect(screen.getByTestId('heading-settings-panel')).toBeDefined();
    // the level (h1, h2, h3) and "turn into a paragraph" are on the card's header, so the popup does not offer them again
    expect(screen.queryByTestId('heading-kind-h3')).toBeNull();
    expect(screen.queryByText('Kiểu khối')).toBeNull();
    await act(async () => {
      screen.getByLabelText('In nghiêng').click();
    });
    expect(onUpdate).toHaveBeenLastCalledWith(2, expect.objectContaining({ title: '<i>Kết quả</i>' }));
    await act(async () => {
      screen.getByTestId('heading-apply-level').click();
    });
    expect(onApply).toHaveBeenCalledWith(2, 'copy');
  });

  it('can reset the look of all headings of its level', async () => {
    const onApply = vi.fn();
    render(<HeadingSectionItem sec={sec()} idx={1} onUpdateSection={vi.fn()} onApplyHeadingLook={onApply} />);
    await act(async () => {
      screen.getByTestId('heading-settings').click();
    });
    await act(async () => {
      screen.getByTestId('heading-reset-level').click();
    });
    expect(onApply).toHaveBeenCalledWith(1, 'reset');
  });

  it('writes tags back when the author types in bold', async () => {
    const onUpdate = vi.fn();
    const { container } = render(<HeadingSectionItem sec={sec({ title: 'Tiêu đề' })} idx={0} onUpdateSection={onUpdate} />);
    await waitFor(() => expect(container.querySelector('.ProseMirror')).not.toBeNull());
    expect(container.querySelector('.ProseMirror')!.textContent).toBe('Tiêu đề');
    fireEvent.keyDown(container.querySelector('.ProseMirror')!, { key: 'Enter' });
    expect(onUpdate).not.toHaveBeenCalled(); // Enter does nothing
  });
});
