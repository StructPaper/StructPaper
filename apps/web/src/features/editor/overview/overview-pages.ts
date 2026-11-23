/**
 * The printed page as measured on a PDF the app compiled for this journal (points): the sheet is 612.72 × 792 pt, the text starts 184 pt
 * from the left edge (the first 136 pt of text width is the column of QR code and contact details), 51.8 pt from the top, and a page
 * holds 648 pt of text. The foot under it holds the page number (and, on the first page, the "how to cite" strip).
 */
export const PAGE = {
  w: 612.72,
  h: 792,
  /** Space between two sheets on screen. */
  gap: 22,
  /** Top of the text (the first line's box; its baseline is 9.2 pt lower). */
  top: 51.8,
  left: 184,
  right: 36.72,
  content: 648,
  content1: 648,
} as const;

export const PT_PX = 96 / 72;

/** The height of text a page holds. */
export const contentHeight = (page: number) => (page === 1 ? PAGE.content1 : PAGE.content);
/** The height of the foot of a page (what is left of the sheet under its text). */
export const footHeight = (page: number) => PAGE.h - PAGE.top - contentHeight(page);

export type NumberPosition = 'alternating' | 'left' | 'center' | 'right';

export interface PageMeta {
  /** "VNUHCM Journal of Health Sciences 2026, 7(1):990-1011" */
  header: string;
  /** "Trang" / "Page" */
  label: string;
  /** The "how to cite" line printed in the foot of the first page. */
  cite: string;
  citeLabel: string;
  numberPosition: NumberPosition;
  /** Print no number on the first page. */
  skipFirstNumber: boolean;
  /** Page numbers are printed at all. */
  showNumbers: boolean;
  titleColor: string;
  firstPage: number;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Where the number of page `n` is printed. */
export function numberSide(pos: NumberPosition, n: number): 'left' | 'center' | 'right' {
  if (pos === 'alternating') return n % 2 === 0 ? 'left' : 'right';
  return pos;
}

/** The foot of page `n`: the "how to cite" strip on the first page, the page number. */
function footHtml(n: number, meta: PageMeta): string {
  const num = meta.firstPage + n - 1;
  const showNumber = meta.showNumbers && !(n === 1 && meta.skipFirstNumber);
  const side = n === 1 ? 'right' : numberSide(meta.numberPosition, n);
  const strip = n === 1 && meta.cite ? `<div class="ov-cite-foot"><b>${esc(meta.citeLabel)}</b>${esc(meta.cite)}</div>` : '';
  const number = showNumber ? `<span class="ov-pageno" data-side="${side}" data-first="${n === 1}" style="color:${esc(meta.titleColor)}">${num}</span>` : '';
  return `${strip}${number}`;
}

/** Everything between the end of the text of page `after` and the start of the text of the next page (or the end of the sheet). */
export function spacerElement(after: number, meta: PageMeta, last: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = `ov-pagegap${last ? ' ov-pagegap-last' : ''}`;
  el.contentEditable = 'false';
  el.setAttribute('data-after', String(after));
  el.setAttribute('data-page', String(after + 1));
  const foot = footHeight(after);
  el.innerHTML =
    `<div class="ov-pad"></div>` +
    `<div class="ov-foot" data-foot="${foot}" style="height:${foot}pt">${footHtml(after, meta)}</div>` +
    (last
      ? ''
      : `<div class="ov-gapbar" style="height:${PAGE.gap}pt"></div>` +
        `<div class="ov-head" style="height:${PAGE.top}pt"><span class="ov-head-text">${esc(meta.header)}</span><i class="ov-head-rule"></i></div>`);
  return el;
}

/** The same gap as a row of a table (the PDF cuts a long table between two of its rows): one cell that spans the table, holding the gap. */
export function spacerRowElement(after: number, meta: PageMeta, cols: number): HTMLElement {
  const tr = document.createElement('tr');
  tr.className = 'ov-pagegap-row';
  tr.contentEditable = 'false';
  const td = document.createElement('td');
  td.colSpan = cols;
  td.append(spacerElement(after, meta, false));
  tr.append(td);
  return tr;
}

/** The line over the rows a table goes on with on the next sheet (the number is counted by the page; see .ov-continued). */
export function continuedRowElement(cols: number): HTMLElement {
  const tr = document.createElement('tr');
  tr.className = 'ov-continued-row';
  tr.contentEditable = 'false';
  const td = document.createElement('td');
  td.colSpan = cols;
  td.className = 'ov-continued';
  tr.append(td);
  return tr;
}

/** A row of the head of the table, drawn again (from the document, so that it is the same words) at the top of the next sheet. */
export function headRowElement(row: import('@tiptap/pm/model').Node): HTMLElement {
  const tr = document.createElement('tr');
  tr.className = 'ov-repeat-head';
  tr.contentEditable = 'false';
  row.forEach((cell) => {
    const th = document.createElement('th');
    if (Number(cell.attrs.colspan) > 1) th.colSpan = Number(cell.attrs.colspan);
    if (Number(cell.attrs.rowspan) > 1) th.rowSpan = Number(cell.attrs.rowspan);
    if (cell.attrs.align) th.style.textAlign = String(cell.attrs.align);
    if (cell.attrs.fill) {
      th.setAttribute('data-fill', String(cell.attrs.fill));
      th.style.setProperty('--ov-cell-fill', String(cell.attrs.fill));
    }
    th.textContent = cell.textContent;
    tr.append(th);
  });
  return tr;
}

/** How far an element is from the top of the page's text, whatever it is nested in (a cell of a table, say). */
function topOf(el: HTMLElement, pm: HTMLElement): number {
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== pm) {
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return y;
}

/**
 * Pads the end of the text of each page so that every sheet is exactly the height of a real one (792 pt): the text of a page that
 * ends short leaves white space under it, as on the printed page. A page whose text runs over takes it from its foot.
 * Reads the layout, so it runs after the browser has laid the page out (and again whenever that changes).
 */
export function fitPages(pm: HTMLElement): void {
  // a gap between two sheets can sit between two blocks or inside a paragraph (a page that breaks in the middle of one)
  const gaps = Array.from(pm.querySelectorAll<HTMLElement>('.ov-pagegap'));
  if (gaps.length === 0) return;
  const pads = gaps.map((g) => g.querySelector<HTMLElement>('.ov-pad')!);
  const foots = gaps.map((g) => g.querySelector<HTMLElement>('.ov-foot')!);
  // measure with no padding and the feet at their full height
  pads.forEach((p) => (p.style.height = '0px'));
  foots.forEach((f) => (f.style.height = `${f.getAttribute('data-foot')}pt`));
  const pxTop = parseFloat(getComputedStyle(pm).paddingTop) || PAGE.top * PT_PX;
  let contentTop = pxTop;
  const measured = gaps.map((g, i) => {
    const text = topOf(g, pm) - contentTop;
    const page = Number(g.getAttribute('data-after'));
    contentTop = topOf(g, pm) + g.offsetHeight;
    return { i, text, page };
  });
  for (const { i, text, page } of measured) {
    const room = contentHeight(page) * PT_PX;
    const diff = room - text;
    if (diff >= 0) pads[i].style.height = `${diff}px`;
    else {
      // the text overran its page: the foot gives up what it can
      const foot = parseFloat(foots[i].getAttribute('data-foot') || '0') * PT_PX;
      foots[i].style.height = `${Math.max(24 * PT_PX, foot + diff)}px`;
    }
  }
}

/**
 * The last line of a paragraph is not spread to the width of the column, as the lines before it are. Those are spread because the
 * paragraph spreads the line before each break; the last line is kept as it falls by giving it a tail that fills the rest of the line,
 * so that there is nothing to spread. The width of the tail is worked out from the layout: how far the words of the last line reach
 * into the column.
 */
export function fitTails(pm: HTMLElement): void {
  const tails = Array.from(pm.querySelectorAll<HTMLElement>('.ov-tail'));
  if (tails.length === 0) return;
  // measured as the line falls, not as it is spread: the paragraphs are not spread while the widths are read
  // (a class on the page, not a style on the paragraphs: ProseMirror redraws a paragraph whose attributes are changed from outside)
  const sheet = pm.closest('.ov-page');
  sheet?.classList.add('ov-measuring');
  for (const t of tails) t.style.width = '0px';
  const widths: number[] = [];
  const pmBox = pm.getBoundingClientRect();
  const k = pm.offsetWidth > 0 ? pmBox.width / pm.offsetWidth : 1;
  const pcs = getComputedStyle(pm);
  const content = pm.clientWidth - (parseFloat(pcs.paddingLeft) || 0) - (parseFloat(pcs.paddingRight) || 0);
  const count = Number(pcs.columnCount) || 1;
  const colWidth = (content - (parseFloat(pcs.columnGap) || 0) * (count - 1)) / count;
  for (const t of tails) {
    const p = t.parentElement;
    if (!p) {
      widths.push(0);
      continue;
    }
    const cs = getComputedStyle(p);
    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    // the boxes of the last line, found by going back through the text until the line changes
    const pieces: Element[] = [];
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (n.nodeType === Node.TEXT_NODE) return (n.textContent ?? '').trim() && !(n.parentElement?.closest('.ov-lb, .ov-hy, .ov-tail')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        return (n as Element).classList.contains('ov-cite') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    const nodes: Node[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
    let lineTop: number | null = null;
    let right = -Infinity;
    let left = Infinity;
    scan: for (let i = nodes.length - 1; i >= 0; i--) {
      const range = document.createRange();
      range.selectNodeContents(nodes[i]);
      const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0);
      for (let j = rects.length - 1; j >= 0; j--) {
        const r = rects[j];
        if (lineTop === null) lineTop = r.top;
        else if (Math.abs(r.top - lineTop) > 4) break scan;
        right = Math.max(right, r.right);
        left = Math.min(left, r.left);
      }
    }
    void pieces;
    if (lineTop === null) {
      widths.push(0);
      continue;
    }
    // a block across both columns (the abstract) has the whole width, any other the width of its column
    const room = cs.columnSpan === 'all' ? content : colWidth;
    const colRight = left - padL * k + room * k - padR * k;
    // a little short of the edge: a tail that does not fit would move to a line of its own, and the paragraph would grow by a line
    widths.push(Math.max(0, Math.floor((colRight - right) / k) - 4));
  }
  tails.forEach((t, i) => (t.style.width = `${widths[i]}px`));
  sheet?.classList.remove('ov-measuring');
}
