/**
 * Where a popup may be drawn. The app's title bar (38 px) lies over the top of the window, so a popup that reaches up to the window's
 * edge goes under it; every popup keeps clear of the title bar and of the other edges, and scrolls inside itself when it is taller.
 */
export const POPUP_TOP = 46;
export const POPUP_EDGE = 8;

const viewport = () => ({ w: typeof window === 'undefined' ? 1200 : window.innerWidth, h: typeof window === 'undefined' ? 800 : window.innerHeight });

/** The tallest a popup may be. */
export function popupMaxHeight(): number {
  return Math.max(160, viewport().h - POPUP_TOP - POPUP_EDGE);
}

/** The corner of a popup of this size that keeps it inside the window, as near as possible to where it was asked for. */
export function clampPopup(left: number, top: number, width: number, height: number): { left: number; top: number } {
  const v = viewport();
  const maxLeft = v.w - width - POPUP_EDGE;
  const maxTop = v.h - height - POPUP_EDGE;
  return {
    left: Math.max(POPUP_EDGE, Math.min(left, maxLeft)),
    top: Math.max(POPUP_TOP, Math.min(top, maxTop)),
  };
}

/**
 * A panel that opens under (or, with no room, over) a button: which side, and how tall it may be there.
 * `below` is the space under the button, `above` the space over it.
 */
export function panelSide(rect: { top: number; bottom: number }, want = 360): { side: 'below' | 'above'; maxHeight: number } {
  const v = viewport();
  const below = v.h - rect.bottom - 8 - POPUP_EDGE;
  const above = rect.top - 8 - POPUP_TOP;
  if (below >= Math.min(want, above) || above < 160) return { side: 'below', maxHeight: Math.max(160, below) };
  return { side: 'above', maxHeight: Math.max(160, above) };
}
