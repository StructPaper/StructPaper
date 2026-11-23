/**
 * Emphasis inside a piece of text (a table cell, a paragraph, a caption): `<b>bold</b>`, `<i>italic</i>`, `<u>underline</u>` and
 * `<color=#RRGGBB>coloured</color>`. The tags live in the same string the model already stores, so every place that reads text keeps
 * working (it prints the tags away with `stripMarkup`) and the exporters turn them into real formatting.
 * `<sup>…</sup>` and `<sub>…</sub>` raise and lower (a cell of a table: m², H₂O); the paragraphs write them as the `$^{2}$` / `$_{2}$` the
 * importer already uses.
 */

export interface MarkupStyle {
  b?: boolean;
  i?: boolean;
  u?: boolean;
  sup?: boolean;
  sub?: boolean;
  color?: string; // "#RRGGBB"
}

export interface MarkupSegment extends MarkupStyle {
  text: string;
}

const TAG_RE = /<(\/?)(b|i|u|sup|sub)>|<color=(#[0-9a-fA-F]{6})>|<\/color>/g;
export const MARKUP_PROBE = /<\/?(?:b|i|u|sup|sub)>|<color=#[0-9a-fA-F]{6}>|<\/color>/;

export const hasMarkup = (text: string | undefined | null): boolean => !!text && MARKUP_PROBE.test(text);

/** The text cut into runs of one style each. Unclosed tags run to the end; stray closing tags are ignored. */
export function parseMarkup(text: string): MarkupSegment[] {
  const src = text ?? '';
  const out: MarkupSegment[] = [];
  let b = 0;
  let i = 0;
  let u = 0;
  let sup = 0;
  let sub = 0;
  const colors: string[] = [];
  let last = 0;
  const push = (chunk: string) => {
    if (!chunk) return;
    out.push({ text: chunk, ...(b > 0 ? { b: true } : {}), ...(i > 0 ? { i: true } : {}), ...(u > 0 ? { u: true } : {}), ...(sup > 0 ? { sup: true } : {}), ...(sub > 0 ? { sub: true } : {}), ...(colors.length ? { color: colors[colors.length - 1] } : {}) });
  };
  for (const m of src.matchAll(TAG_RE)) {
    push(src.slice(last, m.index));
    last = (m.index ?? 0) + m[0].length;
    if (m[3]) colors.push(m[3].toUpperCase());
    else if (m[0] === '</color>') colors.pop();
    else {
      const d = m[1] ? -1 : 1;
      if (m[2] === 'b') b = Math.max(0, b + d);
      else if (m[2] === 'i') i = Math.max(0, i + d);
      else if (m[2] === 'sup') sup = Math.max(0, sup + d);
      else if (m[2] === 'sub') sub = Math.max(0, sub + d);
      else u = Math.max(0, u + d);
    }
  }
  push(src.slice(last));
  return out;
}

/** The text without the tags (for counting, searching, plain-text formats). */
export function stripMarkup(text: string | undefined | null): string {
  const s = text ?? '';
  return MARKUP_PROBE.test(s) ? s.replace(TAG_RE, '') : s;
}

const sameStyle = (a: MarkupStyle, b: MarkupStyle) => !!a.b === !!b.b && !!a.i === !!b.i && !!a.u === !!b.u && !!a.sup === !!b.sup && !!a.sub === !!b.sub && (a.color ?? '') === (b.color ?? '');

/** Runs back to a string, with the fewest tags (neighbours of one style are joined). */
export function serializeMarkup(segments: MarkupSegment[]): string {
  const joined: MarkupSegment[] = [];
  for (const s of segments) {
    if (!s.text) continue;
    const prev = joined[joined.length - 1];
    if (prev && sameStyle(prev, s)) prev.text += s.text;
    else joined.push({ ...s });
  }
  return joined
    .map((s) => {
      let t = s.text;
      if (s.sub) t = `<sub>${t}</sub>`;
      if (s.sup) t = `<sup>${t}</sup>`;
      if (s.u) t = `<u>${t}</u>`;
      if (s.i) t = `<i>${t}</i>`;
      if (s.b) t = `<b>${t}</b>`;
      if (s.color) t = `<color=${s.color}>${t}</color>`;
      return t;
    })
    .join('');
}

const hexToRgbCsv = (hex: string): string => {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
};

/** LaTeX for the text: each run is escaped by `escapePlain` and wrapped in \textbf, \textit, \underline, \textcolor. */
export function markupToLatex(text: string, escapePlain: (plain: string) => string): string {
  return parseMarkup(text)
    .map((s) => {
      let t = escapePlain(s.text);
      if (!t.trim()) return t;
      if (s.sub) t = `\\textsubscript{${t}}`;
      if (s.sup) t = `\\textsuperscript{${t}}`;
      if (s.u) t = `\\underline{${t}}`;
      if (s.i) t = `\\textit{${t}}`;
      if (s.b) t = `\\textbf{${t}}`;
      if (s.color) t = `{\\color[RGB]{${hexToRgbCsv(s.color)}}${t}}`;
      return t;
    })
    .join('');
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** HTML for the text (the on-screen preview): `<strong>`, `<em>`, `<u>`, a coloured span, line breaks. */
export function markupToHtml(text: string): string {
  return parseMarkup(text)
    .map((s) => {
      let t = escapeHtml(s.text).replace(/\r?\n/g, '<br>');
      if (s.sub) t = `<sub>${t}</sub>`;
      if (s.sup) t = `<sup>${t}</sup>`;
      if (s.u) t = `<u>${t}</u>`;
      if (s.i) t = `<em>${t}</em>`;
      if (s.b) t = `<strong>${t}</strong>`;
      if (s.color) t = `<span style="color:${s.color}">${t}</span>`;
      return t;
    })
    .join('');
}

/** Is every character of [start, end) of the plain text already in this style? */
function rangeHas(segments: MarkupSegment[], start: number, end: number, key: 'b' | 'i' | 'u' | 'sup' | 'sub'): boolean {
  let pos = 0;
  let any = false;
  for (const s of segments) {
    const a = pos;
    const z = pos + s.text.length;
    pos = z;
    if (z <= start || a >= end) continue;
    any = true;
    if (!s[key]) return false;
  }
  return any;
}

/**
 * Applies a style to the characters [start, end) of the PLAIN text (the text with tags removed), returning the new tagged string.
 * `on: undefined` toggles: if the whole range already has the style it is taken off, otherwise put on.
 */
export function applyMarkup(text: string, start: number, end: number, change: { key: 'b' | 'i' | 'u' | 'sup' | 'sub'; on?: boolean } | { key: 'color'; color: string | null }): string {
  const segs = parseMarkup(text);
  const total = segs.reduce((n, s) => n + s.text.length, 0);
  const from = Math.max(0, Math.min(start, end, total));
  const to = Math.max(from, Math.min(Math.max(start, end), total));
  if (from === to) return text;
  const on = change.key === 'color' ? true : change.on ?? !rangeHas(segs, from, to, change.key);
  const out: MarkupSegment[] = [];
  let pos = 0;
  for (const s of segs) {
    const a = pos;
    const z = pos + s.text.length;
    pos = z;
    const cut = (txt: string, inside: boolean) => {
      if (!txt) return;
      const seg: MarkupSegment = { ...s, text: txt };
      if (inside) {
        if (change.key === 'color') {
          if (change.color) seg.color = change.color.toUpperCase();
          else delete seg.color;
        } else if (on) {
          seg[change.key] = true;
          // raised and lowered exclude each other
          if (change.key === 'sup') delete seg.sub;
          if (change.key === 'sub') delete seg.sup;
        } else delete seg[change.key];
      }
      out.push(seg);
    };
    if (z <= from || a >= to) {
      cut(s.text, false);
      continue;
    }
    cut(s.text.slice(0, Math.max(0, from - a)), false);
    cut(s.text.slice(Math.max(0, from - a), Math.min(s.text.length, to - a)), true);
    cut(s.text.slice(Math.min(s.text.length, to - a)), false);
  }
  return serializeMarkup(out);
}

/** The style at the start of a range (for showing which toolbar buttons are on). */
export function styleAt(text: string, start: number, end: number): { b: boolean; i: boolean; u: boolean; sup: boolean; sub: boolean; color?: string } {
  const segs = parseMarkup(text);
  const s = Math.min(start, end);
  const e = Math.max(start, end, s + 1);
  return { b: rangeHas(segs, s, e, 'b'), i: rangeHas(segs, s, e, 'i'), u: rangeHas(segs, s, e, 'u'), sup: rangeHas(segs, s, e, 'sup'), sub: rangeHas(segs, s, e, 'sub'), color: segs.find((x) => x.color)?.color };
}

/** Whole-text toggle (a cell, a caption): the style on every character. */
export function toggleWholeMarkup(text: string, key: 'b' | 'i' | 'u'): string {
  return applyMarkup(text, 0, stripMarkup(text).length, { key });
}

/** The style a whole text has in common (every character bold → b true). */
export function wholeStyle(text: string): { b: boolean; i: boolean; u: boolean } {
  const n = stripMarkup(text).length;
  return { b: rangeHas(parseMarkup(text), 0, n, 'b'), i: rangeHas(parseMarkup(text), 0, n, 'i'), u: rangeHas(parseMarkup(text), 0, n, 'u') };
}

/**
 * The tags for the marks of an inline run (what the paragraph editor stores): bold, italic and underline as tags;
 * superscript and subscript as the `$^{…}$` / `$_{…}$` the importer already writes.
 */
export function wrapInlineMarks(value: string, marks?: readonly string[]): string {
  if (!value) return value;
  if (marks?.includes('sup')) return `$^{${value}}$`;
  if (marks?.includes('sub')) return `$_{${value}}$`;
  let t = value;
  if (marks?.includes('u')) t = `<u>${t}</u>`;
  if (marks?.includes('i')) t = `<i>${t}</i>`;
  if (marks?.includes('b')) t = `<b>${t}</b>`;
  return t;
}

/** How a whole text is set: bold, italic, underlined, in a colour. */
export interface WholeLook {
  b: boolean;
  i: boolean;
  u: boolean;
  color?: string;
}

/** The look every character of the text shares (what a heading's emphasis is). */
export function lookOfText(text: string): WholeLook {
  const segs = parseMarkup(text).filter((s) => s.text.length > 0);
  if (segs.length === 0) return { b: false, i: false, u: false };
  const all = (k: 'b' | 'i' | 'u') => segs.every((s) => !!s[k]);
  const colors = new Set(segs.map((s) => s.color ?? ''));
  return { b: all('b'), i: all('i'), u: all('u'), ...(colors.size === 1 && [...colors][0] ? { color: [...colors][0] } : {}) };
}

/** The text with its whole look set: whatever emphasis it had is replaced by this one. */
export function setWholeLook(text: string, look: Partial<WholeLook>): string {
  const n = stripMarkup(text).length;
  if (n === 0) return text;
  let t = stripMarkup(text);
  if (look.b) t = applyMarkup(t, 0, n, { key: 'b', on: true });
  if (look.i) t = applyMarkup(t, 0, n, { key: 'i', on: true });
  if (look.u) t = applyMarkup(t, 0, n, { key: 'u', on: true });
  if (look.color) t = applyMarkup(t, 0, n, { key: 'color', color: look.color });
  return t;
}
