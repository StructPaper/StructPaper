import type { Editor, JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';

/** The blocks of the page that are sections of the paper. */
const ATOMIC_BLOCKS = new Set(['tableBlock', 'figureBlock', 'equationBlock', 'citationBlock']);
const TEXT_BLOCKS = new Set(['paragraph', 'heading']);
/** Parents whose children are the blocks of the page. */
const FLOW = new Set(['doc', 'page']);

export type BlockKind = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'box' | 'table' | 'figure' | 'equation' | 'citation';

export interface BlockInfo {
  node: PMNode;
  pos: number;
  /** End of the block (and of the paragraph written under a heading, which moves with it). */
  end: number;
  name: string;
  sid: string | null;
  kind: BlockKind;
}

const kindOf = (node: PMNode): BlockKind => {
  switch (node.type.name) {
    case 'heading':
      return (`h${node.attrs.level}` as 'h1' | 'h2' | 'h3');
    case 'paragraph':
      return node.attrs.variant === 'quote' ? 'quote' : node.attrs.variant === 'box' ? 'box' : 'paragraph';
    case 'tableBlock':
      return 'table';
    case 'figureBlock':
      return 'figure';
    case 'equationBlock':
      return 'equation';
    default:
      return 'citation';
  }
};

/** The block of the page the cursor is in (a table's cell paragraph belongs to its table). */
export function currentBlock(editor: Editor): BlockInfo | null {
  const { selection, doc } = editor.state;
  const { $from } = selection;
  const make = (node: PMNode, pos: number): BlockInfo => {
    let end = pos + node.nodeSize;
    // the paragraph written under a heading ("<sid>:body") is the heading's own text and goes where it goes
    if (node.type.name === 'heading') {
      const next = doc.nodeAt(end);
      if (next?.type.name === 'paragraph' && typeof next.attrs.sid === 'string' && next.attrs.sid === `${node.attrs.sid}:body`) end += next.nodeSize;
    }
    return { node, pos, end, name: node.type.name, sid: (node.attrs.sid as string | null) ?? null, kind: kindOf(node) };
  };
  for (let d = $from.depth; d >= 1; d--) {
    const node = $from.node(d);
    if (ATOMIC_BLOCKS.has(node.type.name)) return make(node, $from.before(d));
    if (TEXT_BLOCKS.has(node.type.name) && FLOW.has($from.node(d - 1).type.name)) return make(node, $from.before(d));
  }
  const sel = selection as unknown as { node?: PMNode };
  if (sel.node && ATOMIC_BLOCKS.has(sel.node.type.name)) return make(sel.node, selection.from);
  return null;
}

/** Turns a text block into another kind of text block (a section level, a plain paragraph, a quote, a box). */
export function convertBlock(editor: Editor, to: 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'box'): boolean {
  const b = currentBlock(editor);
  if (!b || !TEXT_BLOCKS.has(b.name)) return false;
  const { schema } = editor.state;
  const tr = editor.state.tr;
  if (to === 'h1' || to === 'h2' || to === 'h3') tr.setNodeMarkup(b.pos, schema.nodes.heading, { sid: b.sid, level: Number(to[1]) }, b.node.marks);
  else tr.setNodeMarkup(b.pos, schema.nodes.paragraph, { sid: b.sid, variant: to === 'paragraph' ? null : to }, b.node.marks);
  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

/** The block as JSON with its section ids taken off (so that it is added as new sections). */
function withoutIds(node: JSONContent, figureSrc?: string): JSONContent {
  const out: JSONContent = { ...node };
  if (node.attrs && 'sid' in node.attrs) out.attrs = { ...node.attrs, sid: null, ...(figureSrc ? { src: figureSrc } : {}) };
  if (node.content) out.content = node.content.map((c) => withoutIds(c));
  return out;
}

/** A copy of the block right under it. `figureSrc` is the picture of a figure (it is not in the page). */
export function duplicateBlock(editor: Editor, figureSrc?: (sid: string) => string | undefined): boolean {
  const b = currentBlock(editor);
  if (!b) return false;
  const nodes: JSONContent[] = [];
  editor.state.doc.nodesBetween(b.pos, b.end, (n, pos) => {
    if (pos >= b.pos && pos < b.end && editor.state.doc.resolve(pos).depth === editor.state.doc.resolve(b.pos).depth) nodes.push(n.toJSON());
    return false;
  });
  const copies = nodes.map((n, i) => withoutIds(n, i === 0 && n.type === 'figureBlock' && b.sid ? figureSrc?.(b.sid) : undefined));
  const ok = editor.chain().focus().insertContentAt(b.end, copies).run();
  if (ok) editor.commands.setTextSelection(Math.min(b.end + 1, editor.state.doc.content.size));
  return ok;
}

/** Removes the block (and the text under a heading). */
export function deleteBlock(editor: Editor): boolean {
  const b = currentBlock(editor);
  if (!b) return false;
  const tr = editor.state.tr.delete(b.pos, b.end);
  const at = Math.min(b.pos, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(at), -1));
  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

/** The blocks that can be moved: the sections of the paper, in the order they stand. */
function movableUnits(editor: Editor): Array<{ from: number; to: number }> {
  const { doc } = editor.state;
  const units: Array<{ from: number; to: number }> = [];
  doc.forEach((node, offset) => {
    const name = node.type.name;
    if (!ATOMIC_BLOCKS.has(name) && !TEXT_BLOCKS.has(name)) return;
    const sid = node.attrs.sid;
    const last = units[units.length - 1];
    // the paragraph under a heading joins the heading's unit
    if (name === 'paragraph' && typeof sid === 'string' && sid.endsWith(':body') && last && last.to === offset) {
      last.to = offset + node.nodeSize;
      return;
    }
    units.push({ from: offset, to: offset + node.nodeSize });
  });
  return units;
}

export function canMove(editor: Editor, dir: -1 | 1): boolean {
  const b = currentBlock(editor);
  if (!b) return false;
  const units = movableUnits(editor);
  const i = units.findIndex((u) => u.from === b.pos);
  return i >= 0 && i + dir >= 0 && i + dir < units.length && units[i + dir].to !== undefined && (dir < 0 ? units[i + dir].to === b.pos : units[i + dir].from === b.end);
}

/** Swaps the block with the one before it (-1) or after it (1). */
export function moveBlock(editor: Editor, dir: -1 | 1): boolean {
  if (!canMove(editor, dir)) return false;
  const b = currentBlock(editor)!;
  const units = movableUnits(editor);
  const i = units.findIndex((u) => u.from === b.pos);
  const other = units[i + dir];
  const { doc } = editor.state;
  const slice = doc.slice(b.pos, b.end);
  const tr = editor.state.tr.delete(b.pos, b.end);
  const target = dir < 0 ? other.from : b.pos + (other.to - other.from);
  tr.insert(target, slice.content);
  tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(target + 1, tr.doc.content.size))));
  editor.view.dispatch(tr);
  editor.commands.focus();
  return true;
}

/** Puts the cursor under the pointer when the pointer is outside the selection (a right click lands where it points). */
export function selectAtPoint(editor: Editor, x: number, y: number): void {
  const hit = editor.view.posAtCoords({ left: x, top: y });
  if (!hit) return;
  const { from, to } = editor.state.selection;
  if (hit.pos >= from && hit.pos <= to && from !== to) return;
  try {
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.near(editor.state.doc.resolve(hit.pos))));
  } catch {
    // an atom block: leave the selection where it is
  }
}

/** Can something be put into the line of text the cursor is in (a paragraph, a heading, a caption, a source line)? */
export function canInsertInline(editor: Editor): boolean {
  const { $from } = editor.state.selection;
  const parent = $from.parent;
  return parent.isTextblock && parent.type.name !== 'frontKeywords' && parent.type.contentMatch.matchType(editor.state.schema.nodes.footnote) !== null;
}
