import type { Editor } from '@tiptap/react';

/** Where the pointer went down (in the window), so that the editor that replaces a text puts the caret where the person clicked. */
export interface ClickPoint {
  x: number;
  y: number;
}

/** Puts the caret at the character under the point and focuses the editor; false when the point is not over its text. */
export function placeCaretAt(editor: Editor, point: ClickPoint): boolean {
  if (editor.isDestroyed) return false;
  const hit = editor.view.posAtCoords({ left: point.x, top: point.y });
  if (!hit) return false;
  return editor.chain().focus().setTextSelection(hit.pos).run();
}
