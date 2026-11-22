import type { Editor } from '@tiptap/core';
import type { PaperFigure, PaperSection, PaperTable } from '@/types/paper';

/** What the blocks and the toolbar of the overview can ask of the paper (everything goes through the page's one way of changing it). */
export interface OverviewActions {
  /** Changes a field of the section itself (a page break after it). */
  updateSection: (sid: string, patch: Partial<PaperSection>) => void;
  updateTable: (sid: string, patch: Partial<PaperTable>) => void;
  /** Puts a whole new table in the place of the table (edited in the spreadsheet): the page is drawn again from it. */
  replaceTable: (sid: string, table: PaperTable) => void;
  updateFigure: (sid: string, patch: Partial<PaperFigure>) => void;
  /** Copies the table's look (lines, colours, type size, fill) to every other table. */
  applyTableLookToAll: (fromSid: string) => void;
  /** Copies the figure's layout (column span, width, alignment, frame) to every other figure. */
  applyFigureLookToAll: (fromSid: string) => void;
  /** Least height in points of a row of a table (`index` counts from the first body row, or the header rows). */
  setRowHeight: (sid: string, kind: 'head' | 'body', index: number, pt: number | null) => void;
  /** Column widths as shares (they add up to 1). */
  setColWeights: (sid: string, weights: number[] | undefined) => void;
  /** Gives the table back the widths and heights it has without any dragging (columns share the box by their text, rows are as tall as their text): the page is drawn again from it. */
  resetTableSize: (sid: string) => void;
}

/** The block of the page the cursor is in: a table, a figure, an equation. */
export function selectedBlock(editor: Editor | null): { kind: 'table' | 'figure' | 'equation'; sid: string | null; pos: number } | null {
  if (!editor) return null;
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d >= 0; d--) {
    const node = $from.node(d);
    const kind = node.type.name === 'tableBlock' ? 'table' : node.type.name === 'figureBlock' ? 'figure' : node.type.name === 'equationBlock' ? 'equation' : null;
    if (kind) return { kind, sid: (node.attrs.sid as string | null) ?? null, pos: d > 0 ? $from.before(d) : 0 };
  }
  // a block selected as a whole (an equation)
  const sel = editor.state.selection as unknown as { node?: { type: { name: string }; attrs: Record<string, unknown> } };
  if (sel.node?.type.name === 'equationBlock') return { kind: 'equation', sid: (sel.node.attrs.sid as string | null) ?? null, pos: editor.state.selection.from };
  return null;
}

/** The section of a block, if the paper has it. */
export const sectionBySid = (sections: PaperSection[], sid: string | null): PaperSection | undefined => (sid ? sections.find((s) => s.id === sid) : undefined);

/** The fields that make up a table's look (copied by "apply to all tables"). */
export const TABLE_LOOK_KEYS = ['borderStyle', 'borderColor', 'borderWidth', 'headerFill', 'bodyTint', 'bodyFill', 'hasZebraStripes', 'fontSize', 'rowStretch', 'headerHeight'] as const;

/** The fields that make up a figure's layout. */
export const FIGURE_LOOK_KEYS = ['columnSpan', 'isFullWidth', 'scalePercent', 'alignment', 'hasBorder'] as const;

export function pickKeys<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}
