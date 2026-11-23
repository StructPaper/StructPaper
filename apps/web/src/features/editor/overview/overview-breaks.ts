import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { TableMap } from '@tiptap/pm/tables';
import { computeBreaks, readPdf, splitWords, type AlignLine, type BreakPlan, type BreakPoint, type DocToken, type LinePin } from './overview-align';
import { continuedRowElement, headRowElement, spacerElement, spacerRowElement, type PageMeta } from './overview-pages';

/** The words of the page document, with where each stands. The title is left out (the PDF prints it across the column on the left). */
export function docTokens(doc: PMNode): DocToken[] {
  const out: DocToken[] = [];
  let before: { name: string; pos: number } | null = null;
  const push = (block: PMNode, blockPos: number, base: Pick<DocToken, 'direct' | 'blockPos' | 'topPos' | 'topEnd' | 'rowPos'>) => {
    let flat = '';
    const at: number[] = [];
    block.forEach((child, offset) => {
      const start = blockPos + 1 + offset;
      // text as it is; a reference to a figure as the label it prints; a citation or a formula as a gap
      const text = child.isText ? (child.text ?? '') : ` ${child.type.name === 'xref' ? String(child.attrs.label ?? '') : ''} `;
      for (let i = 0; i < text.length; i++) at.push(child.isText ? start + i : start);
      flat += text;
    });
    splitWords(flat).forEach((w, i) => out.push({ norm: w.norm, raw: w.raw, pos: at[w.offset], ...base, frac: 0, atStart: i === 0 }));
  };
  doc.forEach((top, topPos) => {
    const topEnd = topPos + top.nodeSize;
    const first = out.length;
    if (top.type.name !== 'frontTitle') {
      if (top.isTextblock) {
        // the first reference goes with the title of the list
        const blockPos = top.type.name === 'refItem' && before?.name === 'refsTitle' ? before.pos : topPos;
        push(top, topPos, { direct: true, blockPos, topPos, topEnd });
      } else if (top.type.name === 'tableBlock') {
        // a table's words know the row they are in, so that the PDF's page can be cut between two rows
        top.forEach((child, off) => {
          const childPos = topPos + 1 + off;
          if (child.type.name !== 'table') {
            child.descendants((node, rel) => {
              if (!node.isTextblock) return true;
              const at = childPos + 1 + rel;
              push(node, at, { direct: false, blockPos: at, topPos, topEnd });
              return false;
            });
            if (child.isTextblock) push(child, childPos, { direct: false, blockPos: childPos, topPos, topEnd });
            return;
          }
          child.forEach((row, rowOff, rowIdx) => {
            const rowPos = childPos + 1 + rowOff;
            row.descendants((node, rel) => {
              if (!node.isTextblock) return true;
              const at = rowPos + 1 + rel;
              push(node, at, { direct: false, blockPos: at, topPos, topEnd, ...(rowIdx > 0 ? { rowPos } : {}) });
              return false;
            });
          });
        });
      } else {
        top.descendants((node, rel) => {
          if (!node.isTextblock) return true;
          const at = topPos + 1 + rel;
          push(node, at, { direct: false, blockPos: at, topPos, topEnd });
          return false;
        });
      }
    }
    const n = out.length - first;
    for (let i = 0; i < n; i++) out[first + i].frac = n > 1 ? i / n : 0;
    before = { name: top.type.name, pos: topPos };
  });
  return out;
}

/** Where the compiled PDF breaks its pages and columns, as positions in the page document. */
export function planBreaks(doc: PMNode, lines: AlignLine[]): BreakPlan {
  const tokens = docTokens(doc);
  const vocabulary = new Set(tokens.map((t) => t.norm));
  const pdf = readPdf(lines, vocabulary);
  return computeBreaks(tokens, pdf.tokens, pdf.lineStarts);
}

export interface BreakState {
  breaks: BreakPoint[];
  /** Where each printed line starts inside a paragraph (the paragraph is set line by line). */
  pins: LinePin[];
  oneColumn: number[];
  pageCount: number;
}

const EMPTY: BreakState = { breaks: [], pins: [], oneColumn: [], pageCount: 1 };

export const breaksKey = new PluginKey<BreakState>('overviewPageBreaks');

/** Hands a new plan to the page (null: no PDF to follow, the paper is one long sheet). */
export function setBreaks(tr: Transaction, plan: BreakPlan | null): Transaction {
  const state: BreakState = plan ? { breaks: plan.breaks, pins: plan.pins, oneColumn: plan.oneColumnPages, pageCount: plan.pageCount } : EMPTY;
  return tr.setMeta(breaksKey, state).setMeta('addToHistory', false);
}

export const getBreaks = (state: EditorState): BreakState => breaksKey.getState(state) ?? EMPTY;

/** The page a position is on, from the page breaks (1 before the first). */
export function pageAtPosition(state: EditorState, pos: number): number {
  let page = 1;
  for (const b of getBreaks(state).breaks) if (b.kind === 'page' && b.pos <= pos) page = b.page;
  return page;
}

export interface PageBreakOptions {
  getMeta: () => PageMeta;
  /** The paper is set in one column: pages of one column need no help to stay in the first. */
  isOneColumn: () => boolean;
  /** Does the table of this section run the whole width of the page? (only such a table is cut between two of its rows) */
  isFullWidthTable?: (sid: string) => boolean;
}

const DEFAULT_META: PageMeta = { header: '', label: 'Trang', cite: '', citeLabel: '', numberPosition: 'alternating', skipFirstNumber: false, showNumbers: true, titleColor: '#2b74b7', firstPage: 1 };

/** A line break where a printed line starts; the hyphen first when the line before ends in a word cut in two. */
function lineBreakElement(hyphen: boolean): HTMLElement {
  const el = document.createElement('span');
  el.className = 'ov-lb';
  el.contentEditable = 'false';
  el.setAttribute('aria-hidden', 'true');
  if (hyphen) el.append(hyphenElement());
  el.append(document.createElement('br'));
  return el;
}

function hyphenElement(): HTMLElement {
  const el = document.createElement('span');
  el.className = 'ov-hy';
  el.textContent = '-';
  return el;
}

/** At the end of a paragraph that has line breaks: room for `fitTails` to fill, so that its last line is not spread. */
function tailElement(): HTMLElement {
  const el = document.createElement('span');
  el.className = 'ov-tail';
  el.contentEditable = 'false';
  el.setAttribute('aria-hidden', 'true');
  return el;
}

function colBreakElement(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'ov-colbreak';
  el.contentEditable = 'false';
  el.setAttribute('aria-hidden', 'true');
  return el;
}

/**
 * Where a position can take a break: between two blocks, or inside a paragraph (a heading, a reference). A position inside anything
 * else (a table, a figure) moves to before that block.
 */
function anchor(doc: PMNode, raw: number, fullWidthTable: (sid: string) => boolean = () => false): { pos: number; block: { start: number; end: number } | null; row?: { cols: number; head: PMNode[] } } {
  const pos = Math.max(0, Math.min(raw, doc.content.size));
  const $p = doc.resolve(pos);
  if ($p.depth === 0) return { pos, block: null };
  // inside a row of a table that runs the whole width of the page (a long table the PDF carries over a page): the break goes before that row
  let rowDepth = -1;
  let tableDepth = -1;
  for (let d = $p.depth; d >= 1; d--) {
    const name = $p.node(d).type.name;
    if (name === 'tableRow' && rowDepth < 0) rowDepth = d;
    if (name === 'table' && tableDepth < 0) tableDepth = d;
  }
  // (a position between two rows has the table itself for its parent)
  const betweenRows = rowDepth < 0 && tableDepth > 0 && tableDepth === $p.depth;
  if ((rowDepth > 0 || betweenRows) && tableDepth > 0 && $p.index(tableDepth) > 0 && $p.index(tableDepth) < $p.node(tableDepth).childCount) {
    const tableBlock = $p.node(1);
    const sid = tableBlock.type.name === 'tableBlock' ? (tableBlock.attrs.sid as string | null) : null;
    if (sid && fullWidthTable(sid)) {
      const table = $p.node(tableDepth);
      const map = TableMap.get(table);
      // a break cannot go through a cell that spans down over it (the cell would be cut in two): it goes before the rows that cell begins at
      let ri = $p.index(tableDepth);
      const crossed = (r: number) => {
        for (let c = 0; c < map.width; c++) if (map.map[(r - 1) * map.width + c] === map.map[r * map.width + c]) return true;
        return false;
      };
      while (ri > 0 && crossed(ri)) ri--;
      if (ri > 0) {
        let pos2 = $p.before(tableDepth) + 1;
        for (let r = 0; r < ri; r++) pos2 += table.child(r).nodeSize;
        // the rows that head the table (all of header cells) are printed again at the top of the sheet that carries it over
        const head: PMNode[] = [];
        for (let r = 0; r < table.childCount; r++) {
          const row = table.child(r);
          let all = row.childCount > 0;
          row.forEach((cell) => {
            if (cell.type.name !== 'tableHeader') all = false;
          });
          if (!all) break;
          head.push(row);
        }
        return { pos: pos2, block: null, row: { cols: Math.max(1, map.width), head: ri >= head.length ? head : [] } };
      }
    }
  }
  if ($p.depth === 1 && $p.parent.isTextblock) {
    const start = $p.start();
    const end = $p.end();
    if (pos > start && pos < end) return { pos, block: { start, end } };
    return { pos: pos <= start ? $p.before(1) : $p.after(1), block: null };
  }
  return { pos: $p.before(1), block: null };
}

function buildDecorations(state: EditorState, meta: PageMeta, oneColumn: boolean, fullWidthTable: (sid: string) => boolean): DecorationSet {
  const doc = state.doc;
  const bs = getBreaks(state);
  const sig = `${meta.header}|${meta.cite}|${meta.numberPosition}|${meta.skipFirstNumber}|${meta.showNumbers}|${meta.titleColor}|${meta.firstPage}`;
  const decos: Decoration[] = [];
  /** Paragraphs a break or a line start goes through, with where. */
  const cuts = new Map<number, { end: number; at: Map<number, { hyphen: boolean; brk: boolean; pin: boolean }> }>();
  const cutAt = (block: { start: number; end: number } | null, pos: number, how: { hyphen?: boolean; brk?: boolean; pin?: boolean }) => {
    if (!block) return;
    const entry = cuts.get(block.start) ?? { end: block.end, at: new Map() };
    const prev = entry.at.get(pos) ?? { hyphen: false, brk: false, pin: false };
    entry.at.set(pos, { hyphen: prev.hyphen || !!how.hyphen, brk: prev.brk || !!how.brk, pin: prev.pin || !!how.pin });
    cuts.set(block.start, entry);
  };
  let lastPage = 1;
  const pageAt = new Map<number, number>();
  const inRow = new Set<number>();
  for (const b of bs.breaks) {
    const a = anchor(doc, b.pos, fullWidthTable);
    cutAt(a.block, a.pos, { brk: true });
    if (b.kind === 'page') {
      lastPage = Math.max(lastPage, b.page);
      pageAt.set(b.page, a.pos);
      if (a.row) {
        // the gap between two sheets, as a row of the table that has the whole width of the page
        inRow.add(a.pos);
        const { cols, head } = a.row;
        decos.push(Decoration.widget(a.pos, () => spacerRowElement(b.page - 1, meta, cols), { side: -3, key: `pgrow-${b.page}-${cols}-${sig}` }));
        // as the PDF does: "Table N continued", then the head of the table again, then the rows
        decos.push(Decoration.widget(a.pos, () => continuedRowElement(cols), { side: -2, key: `pgcont-${b.page}-${cols}` }));
        head.forEach((row, i) => decos.push(Decoration.widget(a.pos, () => headRowElement(row), { side: -1 + i * 0.01, key: `pghead-${b.page}-${i}-${row.textContent}` })));
      } else decos.push(Decoration.widget(a.pos, () => spacerElement(b.page - 1, meta, false), { side: -1, key: `pg-${b.page}-${sig}` }));
    } else if (!a.row) decos.push(Decoration.widget(a.pos, colBreakElement, { side: -1, key: `col-${b.page}` }));
  }
  // a page that has one column in the PDF keeps all its text in the first: nothing may balance it into two
  if (!oneColumn) {
    for (const p of bs.oneColumn) {
      const next = pageAt.get(p + 1);
      if (p > lastPage) continue;
      const at = next ?? doc.content.size;
      if (inRow.has(at)) continue;
      decos.push(Decoration.widget(at, colBreakElement, { side: next === undefined ? 0 : -2, key: `endcol-${p}` }));
    }
  }
  decos.push(Decoration.widget(doc.content.size, () => spacerElement(lastPage, meta, true), { side: 1, key: `pg-end-${lastPage}-${sig}` }));
  for (const pin of bs.pins) {
    const a = anchor(doc, pin.pos);
    cutAt(a.block, a.pos, { hyphen: pin.hyphen, pin: true });
  }
  // A paragraph the PDF printed is set line by line: a line break where each printed line starts, every line before a break spread to
  // the width of the column (as TeX does), and the last line of the paragraph left as it falls (see `fitTails`). A paragraph that only a
  // page or a column breaks through has its last line before the break spread in the same way.
  cuts.forEach(({ end, at }, start) => {
    const pinned = [...at.values()].some((v) => v.pin);
    decos.push(Decoration.node(start - 1, end + 1, { class: pinned ? 'ov-cut ov-pinned' : 'ov-cut' }));
    at.forEach((how, pos) => {
      if (how.brk) {
        // a page or a column break is already a break; only the hyphen of a cut word is added
        if (how.hyphen) decos.push(Decoration.widget(pos, hyphenElement, { side: -3, key: `hy-${pos}` }));
      } else if (how.pin) decos.push(Decoration.widget(pos, () => lineBreakElement(how.hyphen), { side: -3, key: `lb-${pos}-${how.hyphen ? 'h' : 'n'}` }));
    });
    decos.push(Decoration.widget(end, tailElement, { side: 2, key: `tail-${start}` }));
  });
  return DecorationSet.create(doc, decos);
}

/**
 * Cuts the one long flow of the page into the printed pages and columns of the compiled PDF. A break is a position in the document;
 * it moves with the text as the author types, and is worked out again when a new PDF is read (`setBreaks`).
 */
export const PageBreaks = Extension.create<PageBreakOptions>({
  name: 'overviewPageBreaks',
  addOptions() {
    return { getMeta: () => DEFAULT_META, isOneColumn: () => false };
  },
  addProseMirrorPlugins() {
    const opts = this.options;
    return [
      new Plugin<BreakState>({
        key: breaksKey,
        state: {
          init: () => EMPTY,
          apply(tr, value) {
            const next = tr.getMeta(breaksKey) as BreakState | undefined;
            if (next) return next;
            if (!tr.docChanged || (value.breaks.length === 0 && value.pins.length === 0)) return value;
            let floor = 0;
            const breaks = value.breaks.map((b) => {
              floor = Math.max(floor, tr.mapping.map(b.pos, -1));
              return { ...b, pos: floor };
            });
            // a paragraph that has been edited is no longer the one the PDF printed: it goes back to flowing by itself
            const touched: Array<[number, number]> = [];
            tr.mapping.maps.forEach((map, i) => {
              const rest = tr.mapping.slice(i + 1);
              map.forEach((_os, _oe, ns, ne) => touched.push([rest.map(ns, -1), rest.map(ne, 1)]));
            });
            const size = tr.doc.content.size;
            let pinFloor = -1;
            const pins: LinePin[] = [];
            for (const p of value.pins) {
              const pos = tr.mapping.map(p.pos, -1);
              if (pos <= pinFloor || pos > size) continue;
              const $p = tr.doc.resolve(pos);
              if (!$p.parent.isTextblock) continue;
              const from = $p.start();
              const to = $p.end();
              if (touched.some(([x, y]) => x <= to && y >= from)) continue;
              pins.push({ ...p, pos });
              pinFloor = pos;
            }
            return { ...value, breaks, pins };
          },
        },
        props: {
          decorations: (state) => buildDecorations(state, opts.getMeta(), opts.isOneColumn(), opts.isFullWidthTable ?? (() => false)),
        },
      }),
    ];
  },
});
