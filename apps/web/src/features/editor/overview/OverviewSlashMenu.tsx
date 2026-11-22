'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { POPUP_EDGE, clampPopup, popupMaxHeight } from '@/lib/popup-bounds';
import { POPUP_MOTION } from './overview-ui';
import type { InsertItem } from './overview-insert';

/** The list that opens under a "/" typed in an empty line. It is moved with the arrow keys by the page, and clicked with the mouse. */
export const OverviewSlashMenu: React.FC<{ items: InsertItem[]; index: number; x: number; y: number; onPick: (item: InsertItem) => void; onHover: (i: number) => void }> = ({ items, index, x, y, onPick, onHover }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  // under the line the "/" was typed in; over it when there is no room under, and always inside the window, clear of the title bar
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const fitsBelow = y + b.height <= window.innerHeight - POPUP_EDGE;
    const wanted = fitsBelow ? y : y - 28 - b.height;
    setPos(clampPopup(x, wanted, b.width, b.height));
  }, [x, y, items.length]);
  return (
    <motion.div
      ref={ref}
      role="listbox"
      {...POPUP_MOTION}
      aria-label="Chèn khối"
      data-testid="slash-menu"
      className="fixed z-[70] w-60 overflow-y-auto rounded-2xl bg-white border border-zinc-200 shadow-xl p-1.5"
      style={{ left: pos.left, top: pos.top, maxHeight: popupMaxHeight() }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 ? (
        <p className="px-2.5 py-2 text-xs text-slate-500">Không có khối nào khớp</p>
      ) : (
        items.map((it, i) => (
          <button
            key={it.kind}
            type="button"
            role="option"
            aria-selected={i === index}
            data-testid={`slash-${it.kind}`}
            onMouseEnter={() => onHover(i)}
            onClick={() => onPick(it)}
            className={`w-full text-left px-2.5 py-1.5 rounded-xl cursor-pointer ${i === index ? 'bg-lime-50' : ''}`}
          >
            <span className="block text-xs font-bold text-slate-900">{it.label}</span>
            <span className="block text-[10.5px] text-slate-500">{it.hint}</span>
          </button>
        ))
      )}
    </motion.div>
  );
};
