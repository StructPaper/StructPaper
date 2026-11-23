// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { POPUP_EDGE, POPUP_TOP, clampPopup, panelSide, popupMaxHeight } from '@/lib/popup-bounds';

const setWindow = (w: number, h: number) => {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true });
};
afterEach(() => setWindow(1024, 768));

describe('where a popup may be drawn', () => {
  it('keeps clear of the title bar at the top and of the edges', () => {
    setWindow(1000, 700);
    // asked for at the very top: it goes under the title bar, not behind it
    expect(clampPopup(10, 0, 270, 300)).toEqual({ left: 10, top: POPUP_TOP });
    // asked for near the bottom right: pulled back inside
    expect(clampPopup(950, 650, 270, 300)).toEqual({ left: 1000 - 270 - POPUP_EDGE, top: 700 - 300 - POPUP_EDGE });
    // taller than the room there is: it starts under the title bar (and scrolls inside itself, see popupMaxHeight)
    expect(clampPopup(10, 200, 270, 900).top).toBe(POPUP_TOP);
  });

  it('is never taller than the room between the title bar and the bottom edge', () => {
    setWindow(1000, 700);
    expect(popupMaxHeight()).toBe(700 - POPUP_TOP - POPUP_EDGE);
    setWindow(1000, 300);
    expect(popupMaxHeight()).toBeGreaterThanOrEqual(160);
  });

  it('puts a panel under its button, or over it when there is more room there', () => {
    setWindow(1000, 800);
    // a button near the top: the panel goes under it, as tall as the room under it allows
    const top = panelSide({ top: 60, bottom: 96 });
    expect(top.side).toBe('below');
    expect(top.maxHeight).toBe(800 - 96 - 8 - POPUP_EDGE);
    // a button near the bottom: no room under it, so the panel opens over it, clear of the title bar
    const bottom = panelSide({ top: 700, bottom: 736 });
    expect(bottom.side).toBe('above');
    expect(bottom.maxHeight).toBe(700 - 8 - POPUP_TOP);
  });
});
