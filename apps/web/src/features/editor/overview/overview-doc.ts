import type { JSONContent } from '@tiptap/core';
import type { CompletePaper, PaperSection, PaperTable, PaperReference, TableCell } from '@/types/paper';
import { normalizePaperTable } from '@/types/paper';
import { displayTextToInlines, inlinesToDisplayText } from '../components/sections/TemporaryParagraphInput';
import { inlinesToTiptapDoc, tiptapDocToPlainText } from '../components/sections/tiptap-schema';
import { parseMarkup, stripMarkup, wrapInlineMarks } from '@/lib/inline-markup';
import { displayHeading } from '@/lib/headings';
import { tablePlacement } from './overview-layout';
import { markerOf } from '@/lib/cross-refs';
import { stripCaptionLabel } from '@/lib/docx-table-extras';

/**
 * The paper as one TipTap document (the "overview" page) and back.
 *
 * The paper model stays the only source of truth: every block of the document carries the id of its section (`sid`), and
 * `docToPaper` gives back the paper with only what the author changed touched. Text that reads the same after both
 * conversions is kept exactly as it was stored, so opening the overview and closing it again never edits anything.
 */

export type OverviewLang = 'vi' | 'en';

export interface OverviewOptions {
  lang: OverviewLang;
  /** Print the section numbers typed in Word ("4. Kết quả"); off = headings are shown without them, as the journal prints them. */
  keepNumbers?: boolean;
  /** The paper is set in one column: every table has the whole width for its box (see `tableBoxPx`). */
  isOneColumn?: boolean;
  /** Filled with the blocks the author added: their position among the blocks of the page and the id given to their new section (so the page can carry it). */
  created?: Array<{ index: number; id: string }>;
}

let counter = 0;
const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

/** Inline content (text with marks, citations, formulas) of a stored string. */
export function textToContent(text: string | undefined, options: { legacyStars?: boolean } = {}): JSONContent[] {
  if (!text) return [];
  // a footnote [[fn: …]] is one mark in the text, numbered by the page as the PDF numbers it; what is between the brackets is kept as it is
  if (text.includes('[[fn:') || text.includes('[[tbl:') || text.includes('[[fig:')) {
    const out: JSONContent[] = [];
    let last = 0;
    for (const m of text.matchAll(/\[\[fn:([\s\S]*?)\]\]|\[\[(tbl|fig):([^\]\s]+)\]\]/g)) {
      const at = m.index ?? 0;
      if (at > last) out.push(...textToContent(text.slice(last, at), options));
      if (m[2]) out.push({ type: 'xref', attrs: { targetId: m[3], kind: m[2] === 'tbl' ? 'table' : 'figure', label: '' } });
      else out.push({ type: 'footnote', attrs: { raw: m[1] } });
      last = at + m[0].length;
    }
    if (last < text.length) out.push(...textToContent(text.slice(last), options));
    return out;
  }
  const plain = (t: string) => inlinesToTiptapDoc(displayTextToInlines(t, options)).content?.[0]?.content ?? [];
  if (!/<color=/.test(text)) return plain(text);
  // text colour is a mark of the page (the inline model has none): each coloured run is read on its own and given the mark
  const out: JSONContent[] = [];
  for (const seg of parseMarkup(text)) {
    const tagged = wrapInlineMarks(seg.text, [seg.b ? 'b' : '', seg.i ? 'i' : '', seg.u ? 'u' : ''].filter(Boolean));
    for (const node of plain(tagged)) {
      if (seg.color && node.type === 'text') out.push({ ...node, marks: [...(node.marks ?? []), { type: 'textColor', attrs: { color: seg.color } }] });
      else out.push(node);
    }
  }
  return out;
}

/** The stored string of a text block (its inline content): emphasis and colour as tags, citations as [n], formulas as $…$. */
export function contentToText(content: JSONContent[] | undefined): string {
  if (!content || content.length === 0) return '';
  // neighbours of one colour share one <color> tag
  const runs: Array<{ color?: string; text: string }> = [];
  for (const node of content) {
    let color: string | undefined;
    let t: string;
    if (node.type === 'text') {
      const names = (node.marks ?? []).map((m) => m.type);
      const marks = [names.includes('bold') ? 'b' : '', names.includes('italic') ? 'i' : '', names.includes('underline') ? 'u' : '', names.includes('superscript') ? 'sup' : '', names.includes('subscript') ? 'sub' : ''].filter(Boolean);
      t = wrapInlineMarks(node.text ?? '', marks);
      color = (node.marks ?? []).find((m) => m.type === 'textColor')?.attrs?.color as string | undefined;
    } else if (node.type === 'xref' && (node.attrs?.kind === 'table' || node.attrs?.kind === 'figure')) {
      t = markerOf(node.attrs.kind, String(node.attrs.targetId));
    } else if (node.type === 'footnote') {
      t = `[[fn:${String(node.attrs?.raw ?? '')}]]`;
    } else {
      t = tiptapDocToPlainText({ type: 'doc', content: [{ type: 'paragraph', content: [node] }] });
    }
    const last = runs[runs.length - 1];
    if (last && last.color === color) last.text += t;
    else runs.push({ color, text: t });
  }
  return runs.map((r) => (r.color && r.text ? `<color=${r.color}>${r.text}</color>` : r.text)).join('');
}

/** What a stored string reads like after one round trip: used to leave untouched text exactly as it is. */
const roundTrip = (text: string | undefined): string => inlinesToDisplayText(displayTextToInlines(text ?? ''));

/** `next` when the author really changed the text, `prev` (byte for byte) when it only reads the same. */
export function keepIfSame(prev: string | undefined, next: string): string {
  if (prev === undefined) return next;
  return roundTrip(prev) === roundTrip(next) ? prev : next;
}


// ───────────────────────────── tables ─────────────────────────────

const cellNode = (c: TableCell, header: boolean, colwidth: number[] | null = null): JSONContent => ({
  type: header ? 'tableHeader' : 'tableCell',
  attrs: {
    colspan: c.colSpan && c.colSpan > 1 ? c.colSpan : 1,
    rowspan: c.rowSpan && c.rowSpan > 1 ? c.rowSpan : 1,
    colwidth,
    align: c.align ?? null,
    fill: c.fill ?? null,
  },
  content: [{ type: 'paragraph', content: textToContent(c.text) }],
});

/** The cells of a table by row: header rows first, then the body (a table with one header row keeps it in `headers`). */
export function tableRowsOf(table: PaperTable): { head: TableCell[][]; body: TableCell[][] } {
  const t = normalizePaperTable(table);
  const head: TableCell[][] =
    t.headerRows && t.headerRows.length > 0 ? t.headerRows : [(t.headers && t.headers.length > 0 ? t.headers : ['']).map((h) => ({ text: h }))];
  const body: TableCell[][] = t.bodyRows && t.bodyRows.length > 0 ? t.bodyRows : (t.rows || []).map((r) => r.map((c) => ({ text: c })));
  return { head, body };
}

/**
 * The width in px of the box a table is drawn in: one column of the sheet (190 pt), or both (392 pt) for a table that runs over them
 * (and for every table of a one-column paper). The widths a dragged column is given are px of this box, so that what the pointer drags
 * and the shares kept in the paper are in the same unit as what is on the screen.
 */
export function tableBoxPx(table: PaperTable, isOneColumn: boolean): number {
  const full = isOneColumn || tablePlacement(table, isOneColumn).spansBoth;
  return Math.round(((full ? 392 : 190) * 96) / 72);
}

/** The widths (px) of the columns a cell of the first row covers, from the saved column shares. */
function firstRowWidths(table: PaperTable, row: TableCell[], boxPx: number): Array<number[] | null> {
  const total = row.reduce((n, c) => n + (c.colSpan ?? 1), 0);
  const w = table.colWeights;
  // shares that are not all there (a column of no width) say nothing about the layout: the columns share the box alike
  if (!w || w.length !== total || !w.every((x) => x > 0)) return row.map(() => null);
  let col = 0;
  return row.map((c) => {
    const span = c.colSpan ?? 1;
    const out = w.slice(col, col + span).map((x) => Math.max(20, Math.round(x * boxPx)));
    col += span;
    return out;
  });
}

function tableNode(table: PaperTable, boxPx: number): JSONContent {
  const { head, body } = tableRowsOf(table);
  const first = head[0] ?? body[0] ?? [];
  const widths = firstRowWidths(table, first, boxPx);
  const rowNode = (r: TableCell[], header: boolean, isFirst: boolean): JSONContent => ({
    type: 'tableRow',
    content: r.map((c, i) => cellNode(c, header, isFirst ? widths[i] ?? null : null)),
  });
  const rows: JSONContent[] = [...head.map((r, i) => rowNode(r, true, i === 0)), ...body.map((r, i) => rowNode(r, false, head.length === 0 && i === 0))];
  return { type: 'table', content: rows.length > 0 ? rows : [{ type: 'tableRow', content: [cellNode({ text: '' }, true)] }] };
}

const cellText = (cell: JSONContent): string => {
  const paras = (cell.content ?? []).filter((n) => n.type === 'paragraph');
  return paras.map((p) => contentToText(p.content)).join('\n');
};

/** Back from a TipTap table to the model's cell lists. Spans are kept; covered slots are expanded for the flat `rows`. */
export function docTableToCells(tableNode: JSONContent): { head: TableCell[][]; body: TableCell[][] } {
  const head: TableCell[][] = [];
  const body: TableCell[][] = [];
  let inHead = true;
  for (const row of tableNode.content ?? []) {
    const cells = row.content ?? [];
    const allHeader = cells.length > 0 && cells.every((c) => c.type === 'tableHeader');
    if (!allHeader) inHead = false;
    const out: TableCell[] = cells.map((c) => {
      const a = c.attrs ?? {};
      const cell: TableCell = { text: cellText(c) };
      if (a.colspan > 1) cell.colSpan = a.colspan;
      if (a.rowspan > 1) cell.rowSpan = a.rowspan;
      if (a.align) cell.align = a.align;
      if (a.fill) cell.fill = a.fill;
      if (c.type === 'tableHeader') cell.isHeader = true;
      return cell;
    });
    (inHead ? head : body).push(out);
  }
  return { head, body };
}

/** Is a cell list the same text and structure as the stored one (so the table is left as it is)? */
function sameCells(a: TableCell[][], b: TableCell[][]): boolean {
  if (a.length !== b.length) return false;
  for (let r = 0; r < a.length; r++) {
    if (a[r].length !== b[r].length) return false;
    for (let c = 0; c < a[r].length; c++) {
      const x = a[r][c];
      const y = b[r][c];
      if (roundTrip(x.text) !== roundTrip(y.text)) return false;
      if ((x.colSpan ?? 1) !== (y.colSpan ?? 1) || (x.rowSpan ?? 1) !== (y.rowSpan ?? 1)) return false;
      if ((x.align ?? null) !== (y.align ?? null) || (x.fill ?? null) !== (y.fill ?? null)) return false;
    }
  }
  return true;
}

/** Flat rows (covered slots empty), like the sheet editor writes them. */
function flatRows(body: TableCell[][], cols: number): string[][] {
  const covered: number[] = Array(cols).fill(0);
  return body.map((row) => {
    const out: string[] = Array(cols).fill('');
    let k = 0;
    for (let c = 0; c < cols; c++) {
      if (covered[c] > 0) {
        covered[c]--;
        continue;
      }
      const cell = row[k++];
      if (!cell) continue;
      out[c] = cell.text;
      const cs = cell.colSpan ?? 1;
      const rs = cell.rowSpan ?? 1;
      for (let d = 1; d < cs && c + d < cols; d++) covered[c + d] = rs - 1;
      if (rs > 1) covered[c] = rs - 1;
      c += cs - 1;
    }
    return out;
  });
}

/**
 * Column shares from the widths the author dragged on the page (null when the first row carries none).
 * `boxPx` is the width of the table's box: the columns that were not dragged share what the dragged ones leave of it, as they do on the page.
 */
export function colWeightsFromDoc(tableDoc: JSONContent, boxPx: number): number[] | null {
  const first = tableDoc.content?.[0]?.content ?? [];
  const cols: Array<number | null> = [];
  for (const c of first) {
    const span = Math.max(1, Number(c.attrs?.colspan) || 1);
    const cw = c.attrs?.colwidth as number[] | null | undefined;
    // a width of 0 is how the editor marks a column of a merged cell that was not dragged: no width
    for (let k = 0; k < span; k++) cols.push(cw && cw.length === span && Number.isFinite(cw[k]) && cw[k] > 0 ? cw[k] : null);
  }
  const set = cols.filter((x): x is number => x !== null);
  if (set.length === 0) return null;
  // columns the author has not touched share what is left
  const rest = Math.max(20, (boxPx - set.reduce((a, b) => a + b, 0)) / Math.max(1, cols.length - set.length));
  const widths = cols.map((x) => x ?? rest);
  const sum = widths.reduce((a, b) => a + b, 0);
  return widths.map((x) => Math.round((x / sum) * 1000) / 1000);
}

const sameWeights = (a: number[] | undefined, b: number[] | undefined) => !!a && !!b && a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.01);

/** The page draws a caption without its "Bảng 1:" / "Table 1:" label (the page numbers them itself): the same words back mean the stored caption, label and all, stays. */
function sameCaption(stored: string, shown: string): boolean {
  return keepIfSame(stripCaptionLabel(stored), shown) === stripCaptionLabel(stored);
}

function updateTable(prev: PaperTable, tableDoc: JSONContent | undefined, caption: string | undefined, source: string | undefined, boxPx: number): PaperTable {
  let next: PaperTable = prev;
  if (caption !== undefined) {
    const kept = sameCaption(prev.caption, caption) ? prev.caption : caption;
    if (kept !== prev.caption) next = { ...next, caption: kept };
  }
  if (source !== undefined) {
    const kept = keepIfSame(prev.source ?? '', source);
    if (kept !== (prev.source ?? '')) next = { ...next, source: kept || undefined };
  }
  if (tableDoc) {
    const { head, body } = docTableToCells(tableDoc);
    const old = tableRowsOf(prev);
    if (!sameCells(head, old.head) || !sameCells(body, old.body)) {
      const cols = Math.max(1, ...head.map((r) => r.reduce((n, c) => n + (c.colSpan ?? 1), 0)), ...body.map((r) => r.reduce((n, c) => n + (c.colSpan ?? 1), 0)));
      const leaf = head[head.length - 1] ?? [];
      const headers = Array.from({ length: cols }, (_, i) => leaf[i]?.text ?? '');
      next = normalizePaperTable({
        ...next,
        headers,
        rows: flatRows(body, cols),
        headerRows: head.length > 1 ? head : undefined,
        bodyRows: body,
      });
      // a different number of columns: the saved shares no longer fit
      if (next.colWeights && next.colWeights.length !== cols) next = { ...next, colWeights: undefined };
    }
    const dragged = colWeightsFromDoc(tableDoc, boxPx);
    if (dragged && !sameWeights(dragged, next.colWeights)) {
      // shares that are all alike say nothing the text did not already say: they are kept only when the table had shares saved
      const equal = dragged.every((w) => Math.abs(w - 1 / dragged.length) < 0.01);
      if (next.colWeights || !equal) next = { ...next, colWeights: dragged };
    }
  }
  return next;
}

// ───────────────────────────── paper → document ─────────────────────────────

const HEADING_LEVEL: Record<string, number> = { h1: 1, h2: 2, h3: 3 };

/** One block per line of what is printed under a table (a new line is a new block, as Enter makes it); a table with none has one empty line. */
function sourceNodes(source: string | undefined): JSONContent[] {
  // (asterisks are asterisks here: "Chú thích: *, **, *** là mức ý nghĩa" is not an italic word)
  return (source ?? '').split('\n').map((line) => ({ type: 'tableSource', content: textToContent(line, { legacyStars: false }) }));
}

/** What the blocks under a table say, one line each (undefined when the page has none of them). */
function sourceOf(tableBlock: JSONContent): string | undefined {
  const lines = (tableBlock.content ?? []).filter((c) => c.type === 'tableSource');
  return lines.length > 0 ? lines.map(textOf).join('\n') : undefined;
}

function sectionNodes(sec: PaperSection, keepNumbers: boolean, isOneColumn: boolean): JSONContent[] {
  const sid = sec.id;
  switch (sec.type) {
    case 'h1':
    case 'h2':
    case 'h3': {
      const out: JSONContent[] = [{ type: 'heading', attrs: { level: HEADING_LEVEL[sec.type], sid }, content: textToContent(displayHeading(sec.title ?? '', keepNumbers)) }];
      if (sec.content && sec.content.trim()) out.push({ type: 'paragraph', attrs: { sid: `${sid}:body` }, content: textToContent(sec.content) });
      return out;
    }
    case 'paragraph':
      return [{ type: 'paragraph', attrs: { sid }, content: textToContent(sec.content) }];
    case 'quote':
    case 'box':
      return [{ type: 'paragraph', attrs: { sid, variant: sec.type }, content: textToContent(sec.content) }];
    case 'figure':
      return sec.figure
        ? [
            {
              type: 'figureBlock',
              attrs: { sid },
              content: [
                { type: 'figureCaption', content: textToContent(stripCaptionLabel(sec.figure.caption)) },
                { type: 'figureSource', content: textToContent(sec.figure.source) },
              ],
            },
          ]
        : [];
    case 'table':
      return sec.table
        ? [
            {
              type: 'tableBlock',
              attrs: { sid },
              content: [
                { type: 'tableCaption', content: textToContent(stripCaptionLabel(sec.table.caption)) },
                tableNode(sec.table, tableBoxPx(sec.table, isOneColumn)),
                ...sourceNodes(sec.table.source),
              ],
            },
          ]
        : [];
    case 'equation':
      return [{ type: 'equationBlock', attrs: { sid } }];
    case 'citation':
      return [{ type: 'citationBlock', attrs: { sid } }];
    default:
      return [];
  }
}

export function paperToDoc(paper: CompletePaper, { lang, keepNumbers = false, isOneColumn = false }: OverviewOptions): JSONContent {
  const m = paper.metadata;
  const title = lang === 'en' ? m.titleEn || m.title : m.title;
  const abstract = lang === 'en' ? m.abstractEn || '' : m.abstract || '';
  const keywords = (lang === 'en' ? m.keywordsEn : m.keywords) ?? [];
  const content: JSONContent[] = [
    { type: 'frontTitle', content: textToContent(title) },
    { type: 'frontAuthors' },
    { type: 'frontAbstract', attrs: { lang }, content: textToContent(abstract) },
    { type: 'frontKeywords', attrs: { lang }, content: keywords.length ? [{ type: 'text', text: keywords.join(', ') }] : [] },
    // (the "how to cite" line is printed in the foot of the first sheet, where the journal has it)
    ...paper.sections.flatMap((s) => sectionNodes(s, keepNumbers, isOneColumn)),
  ];
  if (paper.references.length > 0) {
    content.push({ type: 'refsTitle' });
    for (const r of paper.references) content.push({ type: 'refItem', attrs: { rid: r.id }, content: textToContent(r.raw) });
  }
  return { type: 'doc', content };
}

// ───────────────────────────── document → paper ─────────────────────────────

const textOf = (node: JSONContent) => contentToText(node.content);
const childOf = (node: JSONContent, type: string) => (node.content ?? []).find((c) => c.type === type);

export function docToPaper(doc: JSONContent, prev: CompletePaper, { lang, keepNumbers = false, isOneColumn = false, created }: OverviewOptions): CompletePaper {
  const prevSections = new Map(prev.sections.map((s) => [s.id, s]));
  const prevRefs = new Map<number, PaperReference>(prev.references.map((r) => [r.id, r]));
  const nodes = doc.content ?? [];

  let metadata = prev.metadata;
  const setMeta = (patch: Partial<typeof metadata>) => {
    metadata = { ...metadata, ...patch };
  };

  const sections: PaperSection[] = [];
  const refs = new Map<number, PaperReference>();
  const seen = new Set<string>();
  /** The id of a section the author added: the one its block was given when it was inserted, or a new one (noted for the page to carry). */
  const idFor = (sid: string | null | undefined, index: number) => {
    if (sid && !sid.includes(':')) return sid;
    const id = newId('sec');
    created?.push({ index, id });
    return id;
  };
  const countOf = (type: PaperSection['type']) => sections.filter((x) => x.type === type).length + 1;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const sid: string | null | undefined = node.attrs?.sid;
    switch (node.type) {
      case 'frontTitle': {
        const key = lang === 'en' ? 'titleEn' : 'title';
        const prevTitle = (lang === 'en' ? prev.metadata.titleEn || prev.metadata.title : prev.metadata.title) ?? '';
        const t = keepIfSame(prevTitle, textOf(node));
        if (t !== prevTitle) setMeta({ [key]: t } as never);
        break;
      }
      case 'frontAbstract': {
        const key = lang === 'en' ? 'abstractEn' : 'abstract';
        const prevAbs = (lang === 'en' ? prev.metadata.abstractEn : prev.metadata.abstract) ?? '';
        const t = keepIfSame(prevAbs, textOf(node));
        if (t !== prevAbs) setMeta({ [key]: t } as never);
        break;
      }
      case 'frontKeywords': {
        const key = lang === 'en' ? 'keywordsEn' : 'keywords';
        const prevKw = (lang === 'en' ? prev.metadata.keywordsEn : prev.metadata.keywords) ?? [];
        const kw = stripMarkup(textOf(node))
          .split(/[,;]/)
          .map((k) => k.trim())
          .filter(Boolean);
        if (kw.join('\u0000') !== prevKw.join('\u0000')) setMeta({ [key]: kw } as never);
        break;
      }
      case 'heading': {
        const at = i;
        const old = sid ? prevSections.get(sid) : undefined;
        const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
        const type = (`h${level}` as 'h1' | 'h2' | 'h3');
        // the heading is shown without its Word number: the same text back means the stored title (number and all) stays
        const shown = old ? displayHeading(old.title ?? '', keepNumbers) : undefined;
        const typed = keepIfSame(shown, textOf(node));
        const title = old && typed === shown ? old.title ?? '' : typed;
        // the paragraph right after, written for this heading ("<sid>:body"), is the heading's own content
        // (a paragraph that became a heading has said its text as the title: nothing is left under it)
        const wasHeading = !!old && old.type.startsWith('h');
        let content = wasHeading ? old!.content ?? '' : '';
        const nextNode = nodes[i + 1];
        const bodySid: string | undefined = nextNode?.type === 'paragraph' ? nextNode.attrs?.sid : undefined;
        if (sid && bodySid === `${sid}:body`) {
          content = keepIfSame(old?.content, textOf(nextNode));
          i++;
        } else if (wasHeading && old?.content && old.content.trim()) {
          content = '';
        }
        const id = old?.id ?? idFor(sid, at);
        seen.add(id);
        sections.push(old && old.type === type && old.title === title && old.content === content ? old : { ...(old ?? { id, content: '' }), id, type, title, content });
        break;
      }
      case 'paragraph': {
        const old = sid && !sid.endsWith(':body') ? prevSections.get(sid) : undefined;
        // the empty line the editor keeps after a last table or figure (and one the author has not typed in yet) is not a section
        if (!old && !(sid && sid.endsWith(':body')) && !textOf(node).trim()) break;
        const variant = (node.attrs?.variant as 'quote' | 'box' | null) ?? undefined;
        const type = variant === 'quote' || variant === 'box' ? variant : 'paragraph';
        const content = keepIfSame(old?.content, textOf(node));
        const id = old?.id ?? idFor(sid, i);
        seen.add(id);
        sections.push(old && old.type === type && old.content === content ? old : { ...(old ?? { id }), id, type, content, ...(old?.title !== undefined && type !== 'paragraph' ? {} : { title: undefined }) });
        break;
      }
      case 'figureBlock': {
        const old = sid ? prevSections.get(sid) : undefined;
        if (!old && typeof node.attrs?.src === 'string' && node.attrs.src) {
          // a figure the author added: the picture rides on the block until its section exists
          const id = idFor(sid, i);
          const cap = childOf(node, 'figureCaption');
          const srcLine = childOf(node, 'figureSource');
          const source = srcLine ? textOf(srcLine) : '';
          seen.add(id);
          sections.push({ id, type: 'figure', content: '', figure: { id: newId('fig'), num: countOf('figure'), caption: cap ? textOf(cap) : '', src: node.attrs.src, ...(source ? { source } : {}) } });
          break;
        }
        if (!old?.figure) break;
        const cap = childOf(node, 'figureCaption');
        const src = childOf(node, 'figureSource');
        const caption = cap ? (sameCaption(old.figure.caption, textOf(cap)) ? old.figure.caption : textOf(cap)) : old.figure.caption;
        const source = src ? keepIfSame(old.figure.source ?? '', textOf(src)) : old.figure.source ?? '';
        seen.add(old.id);
        sections.push(caption === old.figure.caption && source === (old.figure.source ?? '') ? old : { ...old, figure: { ...old.figure, caption, source: source || undefined } });
        break;
      }
      case 'tableBlock': {
        const old = sid ? prevSections.get(sid) : undefined;
        if (!old) {
          const id = idFor(sid, i);
          const blank: PaperTable = { id: newId('tbl'), num: countOf('table'), caption: '', headers: [''], rows: [] };
          const tableDoc = childOf(node, 'table');
          const capNode = childOf(node, 'tableCaption');
          seen.add(id);
          sections.push({ id, type: 'table', content: '', table: updateTable(blank, tableDoc, capNode ? textOf(capNode) : '', sourceOf(node) ?? '', tableBoxPx(blank, isOneColumn)) });
          break;
        }
        if (!old.table) break;
        const table = updateTable(old.table, childOf(node, 'table'), childOf(node, 'tableCaption') ? textOf(childOf(node, 'tableCaption')!) : undefined, sourceOf(node), tableBoxPx(old.table, isOneColumn));
        seen.add(old.id);
        sections.push(table === old.table ? old : { ...old, table });
        break;
      }
      case 'equationBlock':
      case 'citationBlock': {
        const old = sid ? prevSections.get(sid) : undefined;
        if (!old && node.type === 'equationBlock') {
          const id = idFor(sid, i);
          seen.add(id);
          sections.push({ id, type: 'equation', content: '', equation: { latex: typeof node.attrs?.latex === 'string' ? node.attrs.latex : '', numbered: true, num: countOf('equation') } });
          break;
        }
        if (old) {
          seen.add(old.id);
          // an equation's formula is edited in place and written back into the node's attrs
          if (node.type === 'equationBlock' && old.equation && typeof node.attrs?.latex === 'string' && node.attrs.latex !== old.equation.latex) {
            sections.push({ ...old, equation: { ...old.equation, latex: node.attrs.latex } });
          } else sections.push(old);
        }
        break;
      }
      case 'refItem': {
        const rid = Number(node.attrs?.rid);
        const old = prevRefs.get(rid);
        if (!old) break;
        const raw = keepIfSame(old.raw, textOf(node));
        refs.set(rid, raw === old.raw ? old : { ...old, raw });
        break;
      }
      default:
        break;
    }
  }

  // blocks the overview cannot show or edit (and so cannot have deleted) stay where they were in the list
  for (const s of prev.sections) {
    if (seen.has(s.id)) continue;
    const handled = ['h1', 'h2', 'h3', 'paragraph', 'quote', 'box', 'figure', 'table', 'equation', 'citation'].includes(s.type);
    if (!handled) sections.push(s);
  }

  const references = prev.references.map((r) => refs.get(r.id) ?? r);
  const sameSections = sections.length === prev.sections.length && sections.every((s, k) => s === prev.sections[k]);
  const sameRefs = references.every((r, k) => r === prev.references[k]);
  if (sameSections && sameRefs && metadata === prev.metadata) return prev;
  return { ...prev, metadata, sections: sameSections ? prev.sections : sections, references: sameRefs ? prev.references : references };
}
