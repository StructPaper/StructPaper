import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';

const key = new PluginKey('overviewBlockSelect');

/** Parts of a block that have their own clicks (handles, buttons, fields): the block does not take them over. */
const OWN_CLICKS = '.ov-fig-handle, button, input, textarea, select, a, [role="slider"], .column-resize-handle';

/**
 * A click anywhere on a figure or a table makes it the block the cursor is in (so that its tools show and its menu opens), not only a click
 * on its caption. A picture is a frame the editor does not write in, so a click on it would put the cursor nowhere; it puts it in the
 * figure's caption instead. Likewise for the margin around a table and the gaps between its cells.
 */
export const BlockSelect = Extension.create({
  name: 'overviewBlockSelect',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        props: {
          handleDOMEvents: {
            mousedown(view, event) {
              const e = event as MouseEvent;
              if (e.button !== 0 || !view.editable) return false;
              const target = e.target as HTMLElement | null;
              if (!target || !target.closest || target.closest(OWN_CLICKS)) return false;

              // the picture of a figure: the cursor goes to its caption
              const frame = target.closest('.ov-figure-frame');
              const figure = frame?.closest('.ov-figure');
              if (frame && figure) {
                const inside = view.posAtDOM(figure, 0);
                const $pos = view.state.doc.resolve(Math.min(inside + 1, view.state.doc.content.size));
                view.dispatch(view.state.tr.setSelection(TextSelection.near($pos)).setMeta('pointer', true));
                view.focus();
                e.preventDefault();
                return true;
              }

              // around a table, not on a cell, the caption or a line under it: the nearest text of the table
              const block = target.closest('.ov-table-block');
              if (block && !target.closest('td, th, p')) {
                const hit = view.posAtCoords({ left: e.clientX, top: e.clientY });
                if (hit) {
                  view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(hit.pos))).setMeta('pointer', true));
                  view.focus();
                  e.preventDefault();
                  return true;
                }
              }
              return false;
            },
          },
        },
      }),
    ];
  },
});
