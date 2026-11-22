/**
 * Where the printed pages and columns of the compiled PDF break, found in the words of the paper.
 *
 * The PDF is read page by page into lines (each in the left or right column), the paper's text into words with their positions in the
 * page document, and the two lists of words are lined up. The first word of each page, and of each right-hand column, tells the
 * position in the document where the sheet is cut and the column changes: so the words that start each page and column of the
 * overview are the very ones that start them in the PDF, even in the middle of a paragraph.
 */

/** A word of the paper's text and where it stands in the page document. */
export interface DocToken {
  norm: string;
  /** The word as written (with its punctuation). */
  raw: string;
  /** Position of its first character. */
  pos: number;
  /** The textblock holds the text directly in the page (a paragraph, a heading, the abstract): a break can go inside it. */
  direct: boolean;
  /** Position right before the textblock (a break at the very start of the block goes there). */
  blockPos: number;
  /** Position right before the top-level block it is in (a table, a figure: a break goes before the whole block). */
  topPos: number;
  /** Position right after that top-level block. */
  topEnd: number;
  /** How far into its top-level block the word is (0…1, by words): a break in the second half of a table goes after it. */
  frac: number;
  /** The word is in a row of a table (not its first): where that row starts, so that a page can be cut before it. */
  rowPos?: number;
  /** It is the first word of its textblock. */
  atStart: boolean;
}

/** A line of the PDF's text: the page, the column it is in (2 = across both), the text. In reading order. */
export interface AlignLine {
  page: number;
  col: 0 | 1 | 2;
  text: string;
}

export interface PdfToken {
  norm: string;
  page: number;
  col: 0 | 1 | 2;
}

export interface BreakPoint {
  kind: 'page' | 'col';
  /** The page it starts (a page break) or the page whose right column it starts. */
  page: number;
  pos: number;
}

/** Where a printed line begins inside a paragraph (so the paragraph can be set line by line, as the PDF has it). */
export interface LinePin {
  pos: number;
  /** The line before it ends in the hyphen of a word cut in two. */
  hyphen: boolean;
}

export interface BreakPlan {
  breaks: BreakPoint[];
  /** The start of each printed line that is inside a paragraph the PDF and the paper agree on. */
  pins: LinePin[];
  /** Pages that have no right-hand column in the PDF (the last page, a page of one column). */
  oneColumnPages: number[];
  pageCount: number;
}

/** A word reduced to what is compared: letters and digits, lower case, ligatures spelled out. */
export function normWord(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** The words of a text (cut at spaces and hyphens) with the offset of each. */
export function splitWords(text: string): Array<{ norm: string; offset: number; raw: string }> {
  const out: Array<{ norm: string; offset: number; raw: string }> = [];
  const re = /[^\s\-‐‑–—­]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const norm = normWord(m[0]);
    if (norm) out.push({ norm, offset: m.index, raw: m[0] });
  }
  return out;
}

/**
 * A word the PDF ran together ("kỹthuật" for "kỹ thuật": some fonts leave no space for the PDF reader to find after certain
 * letters) cut into the words of the paper that make it up, the fewest that do. Null when it is not made of such words.
 */
export function splitKnown(norm: string, vocabulary: ReadonlySet<string>): string[] | null {
  const n = norm.length;
  if (n < 4 || n > 48) return null;
  const best: number[] = new Array(n + 1).fill(Infinity);
  const from: number[] = new Array(n + 1).fill(-1);
  best[0] = 0;
  for (let i = 2; i <= n; i++) {
    for (let j = Math.max(0, i - 24); j <= i - 2; j++) {
      if (best[j] + 1 < best[i] && best[j] < 4 && vocabulary.has(norm.slice(j, i))) {
        best[i] = best[j] + 1;
        from[i] = j;
      }
    }
  }
  if (!Number.isFinite(best[n]) || best[n] < 2) return null;
  const parts: string[] = [];
  for (let i = n; i > 0; i = from[i]) parts.unshift(norm.slice(from[i], i));
  return parts;
}

/** Where a printed line starts, in the PDF's words: the word it begins with, or (when the line goes on with the second half of a hyphenated word) that word and where it was cut. */
export interface PdfLineStart {
  token: number;
  cont: boolean;
  /** Letters of the word before the cut (when `cont`). */
  cutAt: number;
  /** The page and column the line is in. */
  page: number;
  col: 0 | 1 | 2;
}

/**
 * The PDF's words, and where each printed line starts. A word cut at the end of a line ("environ-" / "ment") is joined when the joined
 * word is one the paper has; otherwise ("well-" / "known") it stays two words, as the paper's "well-known" is read as two.
 */
export function readPdf(input: AlignLine[], vocabulary: ReadonlySet<string>): { tokens: PdfToken[]; lineStarts: PdfLineStart[] } {
  const lines = input.map((l) => ({ ...l }));
  const out: PdfToken[] = [];
  const lineStarts: PdfLineStart[] = [];
  let pending = null as { token: number; cutAt: number } | null;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    const text = line.text.trim();
    if (!text) {
      // the second half of a hyphenated word was all this line had
      if (pending) {
        lineStarts.push({ token: pending.token, cont: true, cutAt: pending.cutAt, page: line.page, col: line.col });
        pending = null;
      }
      continue;
    }
    if (pending) {
      lineStarts.push({ token: pending.token, cont: true, cutAt: pending.cutAt, page: line.page, col: line.col });
      pending = null;
    } else lineStarts.push({ token: out.length, cont: false, cutAt: 0, page: line.page, col: line.col });
    const words = splitWords(text);
    const cut = /[\-‐‑­]$/.test(text);
    const next = lines[li + 1];
    let joined: string | null = null;
    // the next line may be in the next column or on the next page: a word is cut there too
    if (cut && words.length > 0 && next) {
      const first = splitWords(next.text)[0];
      if (first) {
        const candidate = words[words.length - 1].norm + first.norm;
        if (vocabulary.has(candidate)) joined = candidate;
      }
    }
    words.forEach((w, i) => {
      if (joined && i === words.length - 1) {
        pending = { token: out.length, cutAt: w.norm.length };
        out.push({ norm: joined, page: line.page, col: line.col });
      } else {
        const parts = vocabulary.has(w.norm) ? null : splitKnown(w.norm, vocabulary);
        for (const part of parts ?? [w.norm]) out.push({ norm: part, page: line.page, col: line.col });
      }
    });
    if (joined) {
      // the first word of the next line is already inside the joined one
      const rest = splitWords(next!.text);
      lines[li + 1] = { ...next!, text: next!.text.slice(rest.length > 1 ? rest[1].offset : next!.text.length) };
    }
  }
  return { tokens: out, lineStarts };
}

export function pdfTokens(input: AlignLine[], vocabulary: ReadonlySet<string>): PdfToken[] {
  return readPdf(input, vocabulary).tokens;
}

const run3 = (a: string[], i: number, b: string[], j: number, iEnd: number, jEnd: number) => i + 2 < iEnd && j + 2 < jEnd && a[i] === b[j] && a[i + 1] === b[j + 1] && a[i + 2] === b[j + 2];

/**
 * Lines up the words of `a[i0..i1)` with those of `b[j0..j1)` where nothing certain is known: step by step, crossing a mismatch by
 * looking ahead for the nearest place where three words in a row agree again (a citation number, a formula, a cell that moved…).
 */
function fill(a: string[], b: string[], i0: number, i1: number, j0: number, j1: number, map: Int32Array, window: number): void {
  let i = i0;
  let j = j0;
  while (i < i1 && j < j1) {
    if (a[i] === b[j]) {
      map[i] = j;
      i++;
      j++;
      continue;
    }
    let found: [number, number] | null = null;
    const reach = Math.min(window, i1 - i + j1 - j);
    for (let d = 1; d <= reach && !found; d++) {
      for (let di = 0; di <= d; di++) {
        if (run3(a, i + di, b, j + (d - di), i1, j1)) {
          found = [di, d - di];
          break;
        }
      }
    }
    if (found) {
      i += found[0];
      j += found[1];
    } else i++;
  }
}

/** The longest increasing run of `ys` (indexes into it), by patience sorting. */
function longestIncreasing(ys: number[]): number[] {
  const tails: number[] = [];
  const prev = new Int32Array(ys.length).fill(-1);
  for (let k = 0; k < ys.length; k++) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ys[tails[mid]] < ys[k]) lo = mid + 1;
      else hi = mid;
    }
    if (lo > 0) prev[k] = tails[lo - 1];
    tails[lo] = k;
  }
  const out: number[] = [];
  for (let k = tails.length > 0 ? tails[tails.length - 1] : -1; k >= 0; k = prev[k]) out.push(k);
  return out.reverse();
}

const ANCHOR = 4;

/**
 * Lines up two lists of words: for each word of `a` the index of its twin in `b` (or -1).
 * First the anchors: runs of four words that occur exactly once in each list. Those that are in the same order in both, the longest
 * such set, are fixed (a table or a figure that sits somewhere else in one of them drops out here, and cannot pull the rest away).
 * What lies between two anchors is lined up step by step (`fill`).
 */
export function alignTokens(a: string[], b: string[], window = 60): Int32Array {
  const map = new Int32Array(a.length).fill(-1);
  const key = (x: string[], i: number) => `${x[i]}|${x[i + 1]}|${x[i + 2]}|${x[i + 3]}`;
  const inB = new Map<string, number>();
  for (let j = 0; j + ANCHOR <= b.length; j++) {
    const k = key(b, j);
    inB.set(k, inB.has(k) ? -1 : j);
  }
  const countA = new Map<string, number>();
  for (let i = 0; i + ANCHOR <= a.length; i++) {
    const k = key(a, i);
    countA.set(k, (countA.get(k) ?? 0) + 1);
  }
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i + ANCHOR <= a.length; i++) {
    const k = key(a, i);
    const j = inB.get(k);
    if (j !== undefined && j >= 0 && countA.get(k) === 1) pairs.push([i, j]);
  }
  const chosen = longestIncreasing(pairs.map((p) => p[1])).map((k) => pairs[k]);
  let pi = 0;
  let pj = 0;
  const closeGap = (ni: number, nj: number) => {
    // the words after the last anchor go on in step; the ones before the next anchor are taken back from it
    while (pi < ni && pj < nj && a[pi] === b[pj]) map[pi++] = pj++;
    let ei = ni;
    let ej = nj;
    while (ei > pi && ej > pj && a[ei - 1] === b[ej - 1]) {
      ei--;
      ej--;
      map[ei] = ej;
    }
    fill(a, b, pi, ei, pj, ej, map, window);
  };
  for (const [i, j] of chosen) {
    if (i < pi || j < pj) {
      // overlaps the run before it (the two agree in the shift): its words are already placed
      if (i - j === pi - pj && i + ANCHOR > pi) {
        for (; pi < i + ANCHOR; pi++, pj++) map[pi] = pj;
      }
      continue;
    }
    closeGap(i, j);
    for (let k = 0; k < ANCHOR; k++) map[i + k] = j + k;
    pi = i + ANCHOR;
    pj = j + ANCHOR;
  }
  closeGap(a.length, b.length);
  // a pair of words that agree by chance (a "the" after a stretch that did not line up) is not trusted: only runs of three or more are
  let runStart = 0;
  for (let k = 1; k <= map.length; k++) {
    const continues = k < map.length && map[k] >= 0 && map[k - 1] >= 0 && map[k] === map[k - 1] + 1;
    if (continues) continue;
    if (k - runStart < 3) for (let q = runStart; q < k; q++) map[q] = -1;
    runStart = k;
  }
  return map;
}

/** Where a break goes for the word: before the block it is the first word of, inside the textblock, or before/after its table/figure. */
function placeOf(t: DocToken): number {
  if (!t.direct) return t.rowPos !== undefined ? t.rowPos : t.frac < 0.5 ? t.topPos : t.topEnd;
  return t.atStart ? t.blockPos : t.pos;
}

/**
 * The breaks of the PDF as positions in the document. `doc` are the paper's words in order, `pdf` the PDF's.
 * A page starts at the first word of its first column that the paper has; a right-hand column at the first of its words.
 */
export function computeBreaks(doc: DocToken[], pdf: PdfToken[], lineStarts: PdfLineStart[] = []): BreakPlan {
  const pageCount = pdf.reduce((n, t) => Math.max(n, t.page), 1);
  if (doc.length === 0 || pdf.length === 0) return { breaks: [], pins: [], oneColumnPages: [], pageCount: 1 };
  const map = alignTokens(
    pdf.map((t) => t.norm),
    doc.map((t) => t.norm)
  );
  /**
   * The place for the first of the words of `idxs` that is in the paper. A page may begin with a figure's caption that the paper keeps
   * somewhere else (a float): those words have no twin, and the first word that has one is where the paper's text goes on.
   */
  const firstPlace = (idxs: number[], first?: PdfLineStart): number | null => {
    // a page or a column that begins with the second half of a word cut in two begins there, inside the word
    if (first?.cont) {
      const m = map[first.token];
      if (m !== undefined && m >= 0 && doc[m].direct) return doc[m].pos + rawOffset(doc[m].raw, first.cutAt);
    }
    for (const i of idxs.slice(0, 400)) {
      const m = map[i];
      if (m >= 0) return placeOf(doc[m]);
    }
    return null;
  };
  const byPage = new Map<number, number[]>();
  const byPageCol1 = new Map<number, number[]>();
  const byPageCol0 = new Map<number, number[]>();
  pdf.forEach((t, i) => {
    (byPage.get(t.page) ?? byPage.set(t.page, []).get(t.page)!).push(i);
    if (t.col === 2) return; // across both columns: says nothing of where a column starts
    const target = t.col === 1 ? byPageCol1 : byPageCol0;
    (target.get(t.page) ?? target.set(t.page, []).get(t.page)!).push(i);
  });
  const raw: BreakPoint[] = [];
  const oneColumnPages: number[] = [];
  for (let p = 1; p <= pageCount; p++) {
    if (p >= 2) {
      const pos = firstPlace(byPage.get(p) ?? [], lineStarts.find((l) => l.page === p));
      if (pos !== null) raw.push({ kind: 'page', page: p, pos });
    }
    const col1 = byPageCol1.get(p);
    const col0 = byPageCol0.get(p);
    if (col1 && col1.length > 0 && col0 && col0.length > 0) {
      const pos = firstPlace(col1, lineStarts.find((l) => l.page === p && l.col === 1));
      if (pos !== null) raw.push({ kind: 'col', page: p, pos });
    } else oneColumnPages.push(p);
  }
  // in document order, never going back: a break that falls before the one before it (a mismatch of the lining up) is dropped
  const breaks: BreakPoint[] = [];
  let last = -1;
  for (const b of raw) {
    if (b.pos <= last) continue;
    breaks.push(b);
    last = b.pos;
  }
  return { breaks, pins: linePins(doc, map, lineStarts), oneColumnPages, pageCount };
}

/** The offset in `raw` after `letters` letters of the normalised word. */
function rawOffset(raw: string, letters: number): number {
  let kept = 0;
  let i = 0;
  for (const ch of raw) {
    if (kept >= letters) break;
    kept += normWord(ch).length;
    i += ch.length;
  }
  return i;
}

/**
 * The start of each printed line, as a position in the document. Only in a paragraph whose words the PDF has (almost) all: where the
 * paper has been edited since the PDF was made the lines of the PDF are not the lines of the paper.
 */
function linePins(doc: DocToken[], map: Int32Array, lineStarts: PdfLineStart[]): LinePin[] {
  if (lineStarts.length === 0) return [];
  const matched = new Uint8Array(doc.length);
  for (let i = 0; i < map.length; i++) if (map[i] >= 0) matched[map[i]] = 1;
  const stats = new Map<number, { n: number; m: number }>();
  doc.forEach((t, j) => {
    if (!t.direct) return;
    const e = stats.get(t.topPos) ?? { n: 0, m: 0 };
    e.n++;
    e.m += matched[j];
    stats.set(t.topPos, e);
  });
  const pins: LinePin[] = [];
  let last = -1;
  for (const ls of lineStarts) {
    const m = map[ls.token];
    if (m === undefined || m < 0) continue;
    const d = doc[m];
    if (!d.direct || (!ls.cont && d.atStart)) continue;
    const st = stats.get(d.topPos);
    if (!st || st.m < 0.85 * st.n) continue;
    const pos = ls.cont ? d.pos + rawOffset(d.raw, ls.cutAt) : d.pos;
    if (pos <= last) continue;
    pins.push({ pos, hyphen: ls.cont });
    last = pos;
  }
  return pins;
}

/** The page of a position in the document, from the page breaks (1 before the first). */
export function pageAtPos(plan: Pick<BreakPlan, 'breaks'>, pos: number): number {
  let page = 1;
  for (const b of plan.breaks) if (b.kind === 'page' && b.pos <= pos) page = b.page;
  return page;
}
