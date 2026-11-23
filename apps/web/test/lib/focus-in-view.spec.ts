// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { isInView, focusTarget } from '@/lib/history/focus';

const box = (top: number, bottom: number) => ({ top, bottom, left: 0, right: 100, width: 100, height: bottom - top, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;

describe('a field the author can already see', () => {
  it('is in view when it lies inside the window, not when it is below or above it', () => {
    const el = document.createElement('textarea');
    document.body.appendChild(el);
    Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true });
    el.getBoundingClientRect = () => box(100, 160);
    expect(isInView(el)).toBe(true);
    el.getBoundingClientRect = () => box(900, 960);
    expect(isInView(el)).toBe(false);
    el.getBoundingClientRect = () => box(-80, -20);
    expect(isInView(el)).toBe(false);
  });

  it('is not scrolled to by an undo, but one out of sight is', async () => {
    const panel = document.createElement('div');
    panel.setAttribute('data-editor-panel', 'metadata');
    const el = document.createElement('textarea');
    el.setAttribute('aria-label', 'Tiêu đề');
    panel.appendChild(el);
    document.body.appendChild(panel);
    const scroll = vi.fn();
    el.scrollIntoView = scroll;
    el.getBoundingClientRect = () => box(100, 160);
    const target = { tab: 'metadata', fieldKey: 'Tiêu đề' } as any;
    await focusTarget(target, 100);
    expect(scroll).not.toHaveBeenCalled();
    el.getBoundingClientRect = () => box(1200, 1260);
    await focusTarget(target, 100);
    expect(scroll).toHaveBeenCalledTimes(1);
  });
});
