import type { Editor, JSONContent } from '@tiptap/core';

export type InsertKind = 'paragraph' | 'h1' | 'h2' | 'h3' | 'table' | 'equation' | 'quote' | 'figure';

export interface InsertItem {
  kind: InsertKind;
  label: string;
  hint: string;
  /** Words the slash menu matches. */
  keywords: string;
}

export const INSERT_ITEMS: InsertItem[] = [
  { kind: 'paragraph', label: 'Đoạn văn', hint: 'Văn bản thường', keywords: 'doan van paragraph text' },
  { kind: 'h1', label: 'Mục lớn', hint: 'Tiêu đề cấp 1 (VIẾT HOA)', keywords: 'muc lon heading 1 h1 tieu de' },
  { kind: 'h2', label: 'Mục con', hint: 'Tiêu đề cấp 2', keywords: 'muc con heading 2 h2 tieu de' },
  { kind: 'h3', label: 'Mục nhỏ', hint: 'Tiêu đề cấp 3 (nghiêng)', keywords: 'muc nho heading 3 h3 tieu de' },
  { kind: 'table', label: 'Bảng', hint: 'Bảng 3 cột × 3 hàng', keywords: 'bang table' },
  { kind: 'figure', label: 'Hình', hint: 'Chọn ảnh từ máy', keywords: 'hinh anh figure image picture' },
  { kind: 'equation', label: 'Công thức', hint: 'Công thức toán, mã LaTeX', keywords: 'cong thuc equation math latex' },
  { kind: 'quote', label: 'Trích nguyên văn', hint: 'Đoạn trích nghiêng, thụt vào', keywords: 'trich quote nguyen van' },
];

const emptyPara = (): JSONContent => ({ type: 'paragraph', content: [] });

/** A table of `cols` × `rows` empty cells with one header row, in the shape the page uses. */
export function newTableNode(cols = 3, rows = 3): JSONContent {
  const cell = (type: 'tableHeader' | 'tableCell'): JSONContent => ({ type, attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, fill: null }, content: [emptyPara()] });
  const row = (type: 'tableHeader' | 'tableCell'): JSONContent => ({ type: 'tableRow', content: Array.from({ length: cols }, () => cell(type)) });
  return {
    type: 'tableBlock',
    attrs: { sid: null },
    content: [{ type: 'tableCaption' }, { type: 'table', content: [row('tableHeader'), ...Array.from({ length: rows - 1 }, () => row('tableCell'))] }, { type: 'tableSource' }],
  };
}

export function blockNode(kind: InsertKind, src?: string): JSONContent {
  switch (kind) {
    case 'paragraph':
      return { type: 'paragraph', attrs: { sid: null }, content: [] };
    case 'quote':
      return { type: 'paragraph', attrs: { sid: null, variant: 'quote' }, content: [] };
    case 'h1':
    case 'h2':
    case 'h3':
      return { type: 'heading', attrs: { level: Number(kind[1]), sid: null }, content: [] };
    case 'table':
      return newTableNode();
    case 'equation':
      return { type: 'equationBlock', attrs: { sid: null, latex: '' } };
    case 'figure':
      return { type: 'figureBlock', attrs: { sid: null, src: src ?? null }, content: [{ type: 'figureCaption' }, { type: 'figureSource' }] };
  }
}

/** Where a new block goes: right after the top-level block that has the cursor (the end of the page when there is none). */
export function insertionPos(editor: Editor): number {
  const { $from } = editor.state.selection;
  return $from.depth >= 1 ? $from.after(1) : editor.state.doc.content.size;
}

/** Puts a new block after the one the cursor is in and moves the cursor into it. Returns whether it was inserted. */
export function insertBlock(editor: Editor, kind: InsertKind, src?: string): boolean {
  if (kind === 'figure' && !src) return false;
  const pos = insertionPos(editor);
  const ok = editor.chain().focus().insertContentAt(pos, blockNode(kind, src)).run();
  if (!ok) return false;
  // the cursor goes into the first line of the new block (an equation is selected as a whole)
  const after = editor.state.doc.resolve(Math.min(pos + 1, editor.state.doc.content.size));
  editor.commands.setTextSelection(after.pos);
  return true;
}

/** Reads an image file as a data URL (what a figure's `src` holds). */
export function readImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

// ───────────────────────────── the "/" menu ─────────────────────────────

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase();

/** "/bang" typed in an empty line: the word after the slash, or null when the cursor is not at the end of such a line. */
export function slashQuery(editor: Editor): string | null {
  const { selection } = editor.state;
  if (!selection.empty) return null;
  const { $from } = selection;
  const parent = $from.parent;
  if (parent.type.name !== 'paragraph' || $from.parentOffset !== parent.content.size) return null;
  const m = /^\/([^\s/]*)$/.exec(parent.textContent);
  return m ? m[1] : null;
}

/** The items whose name or words match what was typed after the slash. */
export function filterInsertItems(query: string): InsertItem[] {
  const q = fold(query);
  if (!q) return INSERT_ITEMS;
  return INSERT_ITEMS.filter((it) => fold(`${it.label} ${it.keywords}`).includes(q));
}

/** Takes the "/word" out of the line the cursor is in (it stays as an empty line). */
export function clearSlashText(editor: Editor): void {
  const { $from } = editor.state.selection;
  editor.chain().focus().deleteRange({ from: $from.start(), to: $from.pos }).run();
}

/** Puts the new block in the place of the empty line the cursor is in, and the cursor in it. */
export function replaceEmptyLine(editor: Editor, kind: InsertKind, src?: string): boolean {
  if (kind === 'figure' && !src) return false;
  const { $from } = editor.state.selection;
  if ($from.parent.type.name !== 'paragraph' || $from.parent.content.size > 0) return insertBlock(editor, kind, src);
  const from = $from.before();
  const to = $from.after();
  const ok = editor.chain().focus().insertContentAt({ from, to }, blockNode(kind, src)).run();
  if (ok) editor.commands.setTextSelection(Math.min(from + 1, editor.state.doc.content.size));
  return ok;
}

// ───────────────────────────── pasting a table ─────────────────────────────

/** Rows of cell text from what Excel or Word put on the clipboard: its HTML table, or tab-separated lines. Null when it is no table. */
export function rowsFromClipboard(html: string, text: string): string[][] | null {
  if (html && /<table[\s>]/i.test(html)) {
    let rows: string[][] = [];
    if (typeof DOMParser !== 'undefined') {
      const table = new DOMParser().parseFromString(html, 'text/html').querySelector('table');
      if (table) rows = Array.from(table.querySelectorAll('tr')).map((tr) => Array.from(tr.children).map((c) => (c.textContent ?? '').replace(/\s+/g, ' ').trim()));
    } else {
      // no DOM (a worker, a test): the rows and cells are read from the tags
      const strip = (s: string) => s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
      rows = Array.from(html.matchAll(/<tr[\s>][\s\S]*?<\/tr>/gi)).map((m) => Array.from(m[0].matchAll(/<t[dh][\s>][\s\S]*?<\/t[dh]>/gi)).map((c) => strip(c[0])));
    }
    if (rows.length > 1 || rows.some((r) => r.length > 1)) return rows;
  }
  const lines = (text || '').replace(/\r/g, '').split('\n').filter((l, i, all) => l.length > 0 || i < all.length - 1);
  if (lines.length >= 2 && lines.every((l) => l.includes('\t'))) return lines.map((l) => l.split('\t').map((c) => c.trim()));
  if (lines.length === 1 && lines[0].split('\t').length >= 2) return [lines[0].split('\t').map((c) => c.trim())];
  return null;
}

/** A table block with these cells (the first row is the header). */
export function tableNodeFromRows(rows: string[][]): JSONContent {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const cell = (type: 'tableHeader' | 'tableCell', t: string): JSONContent => ({
    type,
    attrs: { colspan: 1, rowspan: 1, colwidth: null, align: null, fill: null },
    content: [{ type: 'paragraph', content: t ? [{ type: 'text', text: t }] : [] }],
  });
  return {
    type: 'tableBlock',
    attrs: { sid: null },
    content: [
      { type: 'tableCaption' },
      { type: 'table', content: rows.map((r, i) => ({ type: 'tableRow', content: Array.from({ length: cols }, (_, c) => cell(i === 0 ? 'tableHeader' : 'tableCell', r[c] ?? '')) })) },
      { type: 'tableSource' },
    ],
  };
}

/** Puts pasted cells in the page as a new table after the block the cursor is in. */
export function insertTableFromRows(editor: Editor, rows: string[][]): boolean {
  const pos = insertionPos(editor);
  return editor.chain().focus().insertContentAt(pos, tableNodeFromRows(rows)).run();
}
