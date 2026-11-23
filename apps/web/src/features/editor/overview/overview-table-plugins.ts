import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { isNoteLine } from '@/lib/table-source';

export interface TableGeometry {
  rowHeights?: Array<number | null>;
  headerHeight?: number;
}

export interface RowHeightOptions {
  /** The saved row heights of a table (by section id). */
  getGeometry: (sid: string) => TableGeometry | undefined;
  /** A row was dragged to a new least height in points (null clears it). */
  onRowHeight: (sid: string, kind: 'head' | 'body', index: number, pt: number | null) => void;
  /** Zoom of the page: the pointer moves in screen pixels, the paper is measured in points. */
  getZoom: () => number;
}

const key = new PluginKey('overviewRowHeights');
const GRIP_PX = 4;

/**
 * Row heights of the tables: drawn from the saved heights, and changed by dragging the bottom edge of a row.
 * (A row's height is a *least* height, as in the LaTeX output: text that needs more still makes the row taller.)
 */
export const RowHeights = Extension.create<RowHeightOptions>({
  name: 'overviewRowHeights',
  addOptions() {
    return { getGeometry: () => undefined, onRowHeight: () => {}, getZoom: () => 1 };
  },
  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'tableBlock') return true;
              const geo = opts.getGeometry(node.attrs.sid);
              if (!geo) return false;
              node.forEach((child, offset) => {
                if (child.type.name !== 'table') return;
                let bodyIndex = 0;
                let inHead = true;
                child.forEach((row, rowOffset) => {
                  let allHeader = row.childCount > 0;
                  row.forEach((cell) => {
                    if (cell.type.name !== 'tableHeader') allHeader = false;
                  });
                  if (!allHeader) inHead = false;
                  const h = inHead ? geo.headerHeight : geo.rowHeights?.[bodyIndex];
                  if (!inHead) bodyIndex++;
                  if (h && h > 0) {
                    // pos + 1 enters the tableBlock, + offset reaches the table, + 1 enters it, + rowOffset reaches the row
                    const from = pos + 1 + offset + 1 + rowOffset;
                    decos.push(Decoration.node(from, from + row.nodeSize, { style: `height:${h}pt` }));
                  }
                });
              });
              return false;
            });
            return DecorationSet.create(state.doc, decos);
          },
          handleDOMEvents: {
            mousemove(view, event) {
              const e = event as MouseEvent;
              if ((e.buttons & 1) !== 0) return false;
              view.dom.style.cursor = overRowEdge(e) ? 'row-resize' : '';
              return false;
            },
            mousedown(_view, event) {
              const e = event as MouseEvent;
              const hit = overRowEdge(e);
              if (!hit || e.button !== 0) return false;
              e.preventDefault();
              const { tr, tableBlock, sid, kind, index } = hit;
              const startY = e.clientY;
              const startH = tr.getBoundingClientRect().height;
              const zoom = opts.getZoom() || 1;
              const move = (ev: MouseEvent) => {
                const h = Math.max(10, startH + (ev.clientY - startY));
                tr.style.height = `${h / zoom}px`;
              };
              const up = (ev: MouseEvent) => {
                window.removeEventListener('mousemove', move);
                window.removeEventListener('mouseup', up);
                const px = Math.max(10, startH + (ev.clientY - startY)) / zoom;
                const pt = Math.round(px * 0.75 * 2) / 2; // CSS px -> pt, to half a point
                tr.style.height = '';
                if (sid && tableBlock) opts.onRowHeight(sid, kind, index, Math.abs(ev.clientY - startY) < 2 ? null : pt);
              };
              window.addEventListener('mousemove', move);
              window.addEventListener('mouseup', up);
              return true;
            },
          },
        },
      }),
    ];
  },
});

const notesKey = new PluginKey('overviewSourceNotes');

/**
 * The lines under a table that are notes ("Chú thích: …") are set in italic by the journal, a source ("Nguồn: …") upright. Which a line is
 * depends on what it says, as it is typed, so each note line gets a class and the stylesheet does the rest (the author's own choice of
 * bold, italic or alignment for the block is on the table block, see `TableBlockView`).
 */
export const SourceNotes = Extension.create({
  name: 'overviewSourceNotes',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: notesKey,
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.forEach((block, blockPos) => {
              if (block.type.name !== 'tableBlock') return;
              block.forEach((child, offset) => {
                if (child.type.name === 'tableSource' && isNoteLine(child.textContent)) {
                  const from = blockPos + 1 + offset;
                  decos.push(Decoration.node(from, from + child.nodeSize, { class: 'ov-src-note' }));
                }
              });
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

/** The row whose bottom edge the pointer is on, with what is needed to save its height. */
function overRowEdge(e: MouseEvent): { tr: HTMLElement; tableBlock: HTMLElement; sid: string | null; kind: 'head' | 'body'; index: number } | null {
  const target = e.target as HTMLElement | null;
  const cell = target?.closest?.('td,th') as HTMLElement | null;
  if (!cell) return null;
  const rect = cell.getBoundingClientRect();
  // the grip is the last few pixels of the cell's bottom edge, and not the column-resize zone at its right edge
  if (e.clientY < rect.bottom - GRIP_PX || e.clientY > rect.bottom + 1) return null;
  if (e.clientX > rect.right - 6) return null;
  const tr = cell.closest('tr') as HTMLElement | null;
  const tableBlock = cell.closest('.ov-table-block') as HTMLElement | null;
  if (!tr || !tableBlock) return null;
  const rows = Array.from(tableBlock.querySelectorAll('tr:not(.ov-pagegap-row):not(.ov-continued-row):not(.ov-repeat-head)')) as HTMLElement[];
  let headRows = 0;
  while (headRows < rows.length && Array.from(rows[headRows].children).every((c) => c.tagName === 'TH')) headRows++;
  const at = rows.indexOf(tr);
  // a row spanning into the next one would be cut in two by the drag: only whole rows get a grip
  const kind = at < headRows ? 'head' : 'body';
  return { tr, tableBlock, sid: tableBlock.getAttribute('data-sid'), kind, index: kind === 'head' ? 0 : at - headRows };
}
