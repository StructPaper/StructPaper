import { serializeMarkup, type MarkupSegment, type MarkupStyle } from './inline-markup';

/**
 * The text of a field being edited on screen (a cell, a caption), read back as the tagged string the model stores: bold, italic,
 * underline and colour become `<b>`, `<i>`, `<u>`, `<color=#RRGGBB>`; a line break (a <br>, or the block a browser makes when Enter is
 * pressed) becomes a newline.
 */

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/** "rgb(12, 34, 56)", "#abc" or "#aabbcc" as "#AABBCC"; undefined when it is not a colour (or is the default black). */
export function toHexColor(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  let out: string | undefined;
  const rgb = v.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (rgb) out = `#${hex2(+rgb[1])}${hex2(+rgb[2])}${hex2(+rgb[3])}`;
  else if (/^#[0-9a-f]{6}$/.test(v)) out = v;
  else if (/^#[0-9a-f]{3}$/.test(v)) out = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  if (!out) return undefined;
  return out === '#000000' ? undefined : out.toUpperCase();
}

const BLOCKS = new Set(['DIV', 'P', 'LI']);

export function htmlToMarkup(root: ParentNode): string {
  const segments: MarkupSegment[] = [];
  const push = (text: string, style: MarkupStyle) => {
    if (text) segments.push({ text, ...style });
  };
  const walk = (node: Node, style: MarkupStyle) => {
    if (node.nodeType === 3) {
      push((node.textContent ?? '').replace(/ /g, ' ').replace(/[\r\n]+/g, ' '), style);
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (tag === 'BR') {
      push('\n', style);
      return;
    }
    let next = style;
    const css = el.style;
    if (tag === 'B' || tag === 'STRONG' || css?.fontWeight === 'bold' || (css?.fontWeight && Number(css.fontWeight) >= 600)) next = { ...next, b: true };
    if (tag === 'I' || tag === 'EM' || css?.fontStyle === 'italic') next = { ...next, i: true };
    if (tag === 'U' || css?.textDecorationLine?.includes('underline') || css?.textDecoration?.includes('underline')) next = { ...next, u: true };
    const colour = toHexColor(tag === 'FONT' ? el.getAttribute('color') : css?.color);
    if (colour) next = { ...next, color: colour };
    // a block starts on a new line (but not at the very start)
    const isBlock = BLOCKS.has(tag);
    if (isBlock && segments.length > 0 && !segments[segments.length - 1].text.endsWith('\n')) push('\n', style);
    el.childNodes.forEach((c) => walk(c, next));
  };
  root.childNodes.forEach((c) => walk(c, {}));
  // a trailing line break the browser leaves in an emptied field is not a line of the text
  while (segments.length && /\n$/.test(segments[segments.length - 1].text)) {
    const last = segments[segments.length - 1];
    last.text = last.text.replace(/\n+$/, '');
    if (!last.text) segments.pop();
  }
  return serializeMarkup(segments);
}
