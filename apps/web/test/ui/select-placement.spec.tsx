// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { Select, type SelectOption } from '@/components/ui/Select';

const OPTIONS: SelectOption<string>[] = Array.from({ length: 8 }, (_, i) => ({
  value: `opt-${i}`,
  label: `Tùy chọn ${i}`,
}));

/** Pretend the trigger button sits at a given vertical position of a 700px-high screen. */
const placeTriggerAt = (top: number, height = 40) => {
  Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true, writable: true });
  Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true, writable: true });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top,
    bottom: top + height,
    left: 100,
    right: 300,
    width: 200,
    height,
    x: 100,
    y: top,
    toJSON: () => ({}),
  } as DOMRect);
};

const renderSelect = () =>
  render(
    <div data-testid="clipping-container" style={{ overflow: 'hidden', height: 60 }}>
      <Select options={OPTIONS} value="opt-0" onChange={() => {}} />
    </div>,
  );

const openPopover = async () => {
  fireEvent.click(screen.getByRole('button'));
  return waitFor(() => {
    const el = document.querySelector('[data-placement]');
    if (!el) throw new Error('popover not rendered yet');
    return el as HTMLElement;
  });
};

describe('Select popover placement (smart flip + never clipped)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('opens downwards when there is room below', async () => {
    placeTriggerAt(100);
    renderSelect();

    const popover = await openPopover();

    expect(popover.getAttribute('data-placement')).toBe('bottom');
    expect(popover.style.top).toBe('146px'); // trigger bottom (140) + 6px gap
    expect(popover.style.bottom).toBe('');
  });

  it('FLIPS UP when the trigger is near the bottom of the screen and there is more room above', async () => {
    placeTriggerAt(620); // only ~28px of free space below, ~600px above
    renderSelect();

    const popover = await openPopover();

    expect(popover.getAttribute('data-placement')).toBe('top');
    expect(popover.style.top).toBe('');
    // anchored by its bottom edge: viewport height (700) - trigger top (620) + 6px gap
    expect(popover.style.bottom).toBe('86px');
  });

  it('stays below when neither side fits but below has more room', async () => {
    placeTriggerAt(20); // tiny space above, lots below
    renderSelect();

    const popover = await openPopover();

    expect(popover.getAttribute('data-placement')).toBe('bottom');
  });

  it('caps the list height to the room left on the chosen side', async () => {
    placeTriggerAt(300, 40); // 700 - 340 - 12 - 6 = 342px below, 300 - 18 = 282 above -> below, capped by 240
    renderSelect();
    await openPopover();

    const list = screen.getByRole('listbox') as HTMLElement;
    expect(parseInt(list.style.maxHeight, 10)).toBeLessThanOrEqual(240);

    cleanup();
    placeTriggerAt(630, 40); // flips up, ~600px above -> still capped at 240
    renderSelect();
    await openPopover();
    expect(parseInt((screen.getByRole('listbox') as HTMLElement).style.maxHeight, 10)).toBeLessThanOrEqual(240);
  });

  it('is rendered in a portal on <body>, so an overflow-hidden ancestor (e.g. a modal) can not clip it', async () => {
    placeTriggerAt(620);
    renderSelect();

    const popover = await openPopover();

    expect(screen.getByTestId('clipping-container').contains(popover)).toBe(false);
    expect(popover.parentElement).toBe(document.body);
    expect(popover.style.position).toBe('fixed');
  });

  it('sits above modals (z-index higher than the 10000 used by modal portals)', async () => {
    placeTriggerAt(100);
    renderSelect();

    const popover = await openPopover();

    expect(popover.className).toContain('z-[10050]');
  });

  it('still lets you pick an option from the portal and closes afterwards', async () => {
    placeTriggerAt(620);
    const onChange = vi.fn();
    render(<Select options={OPTIONS} value="opt-0" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button'));
    const option = await screen.findByText('Tùy chọn 3');
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith('opt-3');
    // (the exit animation does not run in happy-dom, so check the state, not DOM removal)
    await waitFor(() => expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('false'));
  });

  it('closes on an outside click but not on a click inside the popover', async () => {
    placeTriggerAt(100);
    renderSelect();
    const popover = await openPopover();

    const trigger = screen.getByRole('button');

    fireEvent.mouseDown(popover); // inside the (portaled) popover: stays open
    expect(trigger.getAttribute('aria-expanded')).toBe('true');

    fireEvent.mouseDown(document.body); // outside: closes
    await waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('false'));
  });
});
