'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { NodeSelection } from '@tiptap/pm/state';

/**
 * Frames over the page, as a design tool draws them: a light one round the block under the pointer, a firm one round the block the cursor
 * is in (with its name for a table, a figure or a formula). They are drawn over the page and take no room in it; a block split between two
 * columns or two sheets is framed in each piece.
 */

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Framed {
  boxes: Box[];
  label?: string;
}

/** What is a block of the page: the direct children of the editor that carry the text, a table, a figure… (not the gaps and breaks drawn between them). */
const BLOCK = 'p, h1, h2, h3, h4, div.ov-figure, div.ov-table-block, div.ov-equation, div.ov-cite-strip, div.ov-authors';

const LABELS: Record<string, string> = { tableBlock: 'Bảng', figureBlock: 'Hình', equationBlock: 'Công thức' };

/** The block (a direct child of the editor) an element is in. */
export function blockOf(target: EventTarget | null, pm: HTMLElement): HTMLElement | null {
  let el = target instanceof Element ? target : null;
  while (el && el.parentElement !== pm) el = el.parentElement;
  return el instanceof HTMLElement && el.matches(BLOCK) ? el : null;
}

const PAD = 3;

/** The boxes of an element, one for each piece it is split into, placed against the scrolling root. */
function boxesOf(el: HTMLElement, root: HTMLElement): Box[] {
  if (typeof el.getClientRects !== 'function') return [];
  const rr = root.getBoundingClientRect();
  return Array.from(el.getClientRects())
    .filter((r) => r.width > 2 && r.height > 2)
    .map((r) => ({
      left: r.left - rr.left + root.scrollLeft - PAD,
      top: r.top - rr.top + root.scrollTop - PAD,
      width: r.width + PAD * 2,
      height: r.height + PAD * 2,
    }));
}

const same = (a: Framed | null, b: Framed | null) =>
  a === b || (!!a && !!b && a.label === b.label && a.boxes.length === b.boxes.length && a.boxes.every((x, i) => x.left === b.boxes[i].left && x.top === b.boxes[i].top && x.width === b.boxes[i].width && x.height === b.boxes[i].height));

export const BlockFrames: React.FC<{ editor: Editor | null; root: React.RefObject<HTMLElement | null>; zoom: number }> = ({ editor, root, zoom }) => {
  const [hover, setHover] = useState<Framed | null>(null);
  const [selected, setSelected] = useState<Framed | null>(null);
  const hoverEl = useRef<HTMLElement | null>(null);
  const raf = useRef(0);

  const measure = useCallback(() => {
    const rootEl = root.current;
    if (!rootEl || !editor || editor.isDestroyed) return;
    // the block the cursor is in: the top-level block that holds the selection
    let sel: Framed | null = null;
    try {
      const { selection, doc } = editor.state;
      const $from = selection.$from;
      const pos = selection instanceof NodeSelection && $from.depth === 0 ? selection.from : $from.depth >= 1 ? $from.before(1) : -1;
      const node = pos >= 0 ? doc.nodeAt(pos) : null;
      const dom = node ? editor.view.nodeDOM(pos) : null;
      if (node && dom instanceof HTMLElement && editor.view.hasFocus()) {
        const boxes = boxesOf(dom, rootEl);
        if (boxes.length > 0) sel = { boxes, label: LABELS[node.type.name] };
      }
    } catch {
      // the document changed under us: the next measure finds it
    }
    setSelected((prev) => (same(prev, sel) ? prev : sel));
    const h = hoverEl.current;
    const hov = h && h.isConnected && rootEl.contains(h) ? { boxes: boxesOf(h, rootEl) } : null;
    setHover((prev) => (same(prev, hov) ? prev : hov));
  }, [editor, root]);

  const schedule = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(measure);
  }, [measure]);

  useEffect(() => {
    const rootEl = root.current;
    if (!rootEl || !editor || editor.isDestroyed) return;
    const pm = editor.view.dom as HTMLElement;
    const move = (e: MouseEvent) => {
      // while a button is held the pointer is dragging something (a selection, a column): no frame follows it
      const next = e.buttons ? null : blockOf(e.target, pm);
      if (next !== hoverEl.current) {
        hoverEl.current = next;
        schedule();
      }
    };
    const leave = () => {
      if (hoverEl.current) {
        hoverEl.current = null;
        schedule();
      }
    };
    rootEl.addEventListener('mousemove', move);
    rootEl.addEventListener('mouseleave', leave);
    editor.on('selectionUpdate', schedule);
    editor.on('transaction', schedule);
    editor.on('focus', schedule);
    editor.on('blur', schedule);
    window.addEventListener('resize', schedule);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(schedule) : null;
    ro?.observe(pm);
    schedule();
    return () => {
      cancelAnimationFrame(raf.current);
      rootEl.removeEventListener('mousemove', move);
      rootEl.removeEventListener('mouseleave', leave);
      editor.off('selectionUpdate', schedule);
      editor.off('transaction', schedule);
      editor.off('focus', schedule);
      editor.off('blur', schedule);
      window.removeEventListener('resize', schedule);
      ro?.disconnect();
    };
  }, [editor, root, schedule]);

  // a new zoom moves every block
  useEffect(() => {
    schedule();
  }, [zoom, schedule]);

  // the block the cursor is in is framed firmly; when the pointer is over that same block no second frame is drawn on it
  const hoverBoxes = hover && selected && hover.boxes.length === selected.boxes.length && hover.boxes.every((b, i) => b.left === selected.boxes[i].left && b.top === selected.boxes[i].top) ? [] : hover?.boxes ?? [];
  return (
    <div className="ov-frames" aria-hidden data-testid="overview-frames">
      {hoverBoxes.map((b, i) => (
        <div key={`h${i}`} className="ov-frame" data-kind="hover" style={{ left: b.left, top: b.top, width: b.width, height: b.height }} />
      ))}
      {selected?.boxes.map((b, i) => (
        <div key={`s${i}`} className="ov-frame" data-kind="selected" style={{ left: b.left, top: b.top, width: b.width, height: b.height }}>
          {i === 0 && selected.label && (
            <span className="ov-frame-tag" style={b.top < 26 ? { top: 2, left: 2, borderRadius: 6 } : undefined}>
              {selected.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};
