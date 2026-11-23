import { Extension, type Editor } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { listMarkOf } from '@/lib/list-marks';

/**
 * Lists on the page. An item is a paragraph that starts with its mark ("• ", "1. ", "a) "; see lib/list-marks): the page draws it with
 * the mark hanging to the left, and Enter at the end of an item starts the next one with the same kind of mark (Enter on an item with
 * nothing in it takes the mark off, which ends the list).
 */
const key = new PluginKey('overviewListItems');

/** The next item's mark after this one: a bullet stays, a number counts up, a letter goes on. */
export function nextMark(mark: string): string {
  const num = /^(\d{1,2})([.)])\s*$/.exec(mark);
  if (num) return `${Number(num[1]) + 1}${num[2]} `;
  const letter = /^([a-z])\)\s*$/.exec(mark);
  if (letter) return `${String.fromCharCode(letter[1].charCodeAt(0) + 1)}) `;
  return mark.endsWith(' ') ? mark : `${mark} `;
}

/** Puts the bullet at the start of the paragraph the cursor is in, or takes the mark off when it has one. */
export function toggleBullet(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  if (!$from.parent.isTextblock) return false;
  const start = $from.start();
  const mark = listMarkOf($from.parent.textContent);
  const tr = editor.state.tr;
  if (mark) tr.delete(start, start + mark.length);
  else tr.insert(start, editor.state.schema.text('• '));
  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

export const ListItems = Extension.create({
  name: 'overviewListItems',
  priority: 200,
  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parent.type.name !== 'paragraph') return false;
        const text = $from.parent.textContent;
        const mark = listMarkOf(text);
        if (!mark) return false;
        const start = $from.start();
        // an item with nothing in it: the mark goes, and the list ends
        if (text.trim() === mark.trim()) {
          editor.view.dispatch(editor.state.tr.delete(start, start + mark.length));
          return true;
        }
        // the cursor at the very end of the item: the next item begins with the next mark
        if ($from.pos !== $from.end()) return false;
        return editor.chain().splitBlock().insertContent(nextMark(mark.trim())).run();
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.forEach((node, pos) => {
              if (node.type.name === 'paragraph' && !node.attrs.variant && listMarkOf(node.textContent)) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'ov-li' }));
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
