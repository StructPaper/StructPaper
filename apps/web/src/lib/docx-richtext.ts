import type { PaperSection } from '@/types/paper';
import { hasMarkup, parseMarkup, serializeMarkup, stripMarkup } from './inline-markup';

/**
 * The text pipeline (mammoth) flattens Word formatting, so "f² DS→DT", "R²", "CO₂", "m²" lose their
 * superscripts / subscripts. For body paragraphs that carry such runs in the original XML, rebuild the
 * paragraph with `$^{…}$` / `$_{…}$` so every exporter (LaTeX, Word, XML, preview) renders them.
 */

export interface ScriptRun {
  text: string;
  isSup: boolean;
  isSub?: boolean;
  isBold?: boolean;
  isItalic?: boolean;
}

export interface ScriptParagraph {
  text: string;
  runs: ScriptRun[];
}

const MATH_SYMBOLS: Record<string, string> = {
  '→': '\\to ',
  '←': '\\leftarrow ',
  '↔': '\\leftrightarrow ',
  '≥': '\\geq ',
  '≤': '\\leq ',
  '≠': '\\neq ',
  '≈': '\\approx ',
  '±': '\\pm ',
  '×': '\\times ',
  '−': '-',
  '–': '-',
};

/** Plain text -> math-mode LaTeX that keeps Vietnamese letters (via \text) and common symbols. */
export function plainToMath(text: string): string {
  const t = text.trim();
  if (!t) return '';
  if (/^[0-9+\-=(),.]+$/.test(t)) return t;
  let out = '';
  let buf = '';
  const flush = () => {
    if (buf) out += `\\text{${buf}}`;
    buf = '';
  };
  for (const ch of t) {
    if (MATH_SYMBOLS[ch]) {
      flush();
      out += MATH_SYMBOLS[ch];
    } else if ('%&#_{}'.includes(ch)) buf += `\\${ch}`;
    else if (ch === '\\') buf += '\\textbackslash{}';
    else if (ch === '^' || ch === '~') buf += `\\char\`\\${ch}`;
    else buf += ch;
  }
  flush();
  return out.trim();
}

const norm = (s: string) => (s || '').normalize('NFC').replace(/[​-‏﻿]/g, '').replace(/\s+/g, '');

/**
 * A superscript made only of reference numbers ("10", "16,17", "16–18", "19-20;24") written as a citation marker "[16,17,18]", which the
 * typesetter prints as a numbered citation (a run of three or more compresses to "16–18"). Null when it is not one.
 */
export function superscriptToCitation(sup: string, max: number, before: string): string | null {
  // numbers separated only by a space ("6 7 8") are a list too
  const t = sup.trim().replace(/(\d)\s+(?=\d)/g, '$1,').replace(/\s+/g, '');
  if (!t || !/^\d{1,3}(?:[,;–—\-−]\d{1,3})*$/.test(t)) return null;
  // "m²", "R2", "10^6": a lone digit right after a short unit or a number is an exponent
  if (/^\d$/.test(t) && /(?:^|[\s(])(?:[A-Za-zµ°]{1,3}|\d+)$/.test(before)) return null;
  const nums: number[] = [];
  for (const part of t.split(/[,;]/)) {
    const range = part.match(/^(\d{1,3})[–—\-−](\d{1,3})$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (b < a || b - a > 30) return null;
      for (let n = a; n <= b; n++) nums.push(n);
    } else if (/^\d{1,3}$/.test(part)) nums.push(Number(part));
    else return null;
  }
  if (nums.some((n) => n < 1 || n > max)) return null;
  return `[${nums.join(',')}]`;
}

/** Join runs, turning sup/sub runs (an adjacent sup+sub pair becomes one `^{a}_{b}`) into math. */
export function runsToScriptedText(runs: ScriptRun[], citeMax = 0): string {
  let out = '';
  // bold and italic runs keep their emphasis when they stand out from plain text (a paragraph set entirely in one style is a style of the block)
  const emphasised = (r: ScriptRun) => !!(r.isBold || r.isItalic);
  const mixed = runs.some((r) => emphasised(r) && r.text.trim()) && runs.some((r) => !emphasised(r) && r.text.trim());
  for (let i = 0; i < runs.length; i++) {
    const r = runs[i];
    if (!r.isSup && !r.isSub) {
      out += mixed && emphasised(r) && r.text.trim() ? `${r.isBold ? '<b>' : ''}${r.isItalic ? '<i>' : ''}${r.text}${r.isItalic ? '</i>' : ''}${r.isBold ? '</b>' : ''}` : r.text;
      continue;
    }
    let sup = '';
    let sub = '';
    let j = i;
    for (; j < runs.length && (runs[j].isSup || runs[j].isSub); j++) {
      if (runs[j].isSup) sup += runs[j].text;
      else sub += runs[j].text;
    }
    i = j - 1;
    if (citeMax > 0 && sup && !sub) {
      const cite = superscriptToCitation(sup, citeMax, out);
      if (cite) {
        out += cite;
        continue;
      }
    }
    const s = plainToMath(sup);
    const b = plainToMath(sub);
    if (!s && !b) continue;
    out += `$${s ? `^{${s}}` : ''}${b ? `_{${b}}` : ''}$`;
  }
  // neighbours of one style share their tags
  return hasMarkup(out) ? serializeMarkup(parseMarkup(out)) : out;
}

/** Replace body paragraphs by their scripted version when the original XML paragraph matches exactly. */
export function enrichScriptRuns(sections: PaperSection[], paragraphs: ScriptParagraph[], refCount = 0): number {
  const hasMixedEmphasis = (p: ScriptParagraph) => p.runs.some((r) => (r.isBold || r.isItalic) && r.text.trim()) && p.runs.some((r) => !r.isBold && !r.isItalic && r.text.trim());
  const withScripts = paragraphs.filter((p) => p.runs.some((r) => r.isSup || r.isSub) || hasMixedEmphasis(p));
  if (!withScripts.length) return 0;
  // A paper that cites with superscript numbers (and has no [n] citations): its numeric superscripts are citations
  const numericSup = withScripts.flatMap((p) => p.runs.filter((r) => r.isSup && /^[\d\s,;–—\-−]+$/.test(r.text) && /\d/.test(r.text)));
  const looksLikeCitations = numericSup.filter((r) => /[,;–—\-−]|\d{2}/.test(r.text.trim())).length;
  const bracketCites = sections.some((s) => /\[\d+(?:\s*[,–-]\s*\d+)*\]/.test(s.content || ''));
  const citeMax = refCount > 0 && !bracketCites && looksLikeCitations >= 3 ? refCount : 0;
  const byText = new Map<string, ScriptParagraph>();
  for (const p of withScripts) {
    const k = norm(p.text);
    if (k && !byText.has(k)) byText.set(k, p);
  }
  let changed = 0;
  for (const s of sections) {
    if (s.type !== 'paragraph' || !s.content) continue;
    const p = byText.get(norm(s.content));
    if (!p) continue;
    let rebuilt = runsToScriptedText(p.runs, citeMax).replace(/\s+/g, ' ').trim();
    // neighbours of one style share their tags
    if (hasMarkup(rebuilt)) rebuilt = serializeMarkup(parseMarkup(rebuilt));
    if (rebuilt && rebuilt !== s.content) {
      s.content = rebuilt;
      changed += 1;
    }
  }
  return changed;
}

/**
 * A text the parser read as plain (the abstract) with the bold and italic of the Word paragraphs it came from: when the paragraphs,
 * one after the other, say exactly that text (white space aside) and some of them mix emphasis with plain words. Otherwise the text
 * comes back as it was, so no word can ever be changed by this.
 */
export function emphasiseText(plain: string, paragraphs: ScriptParagraph[]): string {
  const target = norm(plain);
  if (!target) return plain;
  const mixed = (p: ScriptParagraph) => p.runs.some((r) => (r.isBold || r.isItalic) && r.text.trim()) && p.runs.some((r) => !r.isBold && !r.isItalic && r.text.trim());
  const pieces: ScriptParagraph[] = [];
  let pos = 0;
  for (const p of paragraphs) {
    const k = norm(p.text);
    if (!k) continue;
    if (target.startsWith(k, pos)) {
      pieces.push(p);
      pos += k.length;
      if (pos >= target.length) break;
    }
  }
  if (pos !== target.length || !pieces.some(mixed)) return plain;
  const joined = pieces.map((p) => runsToScriptedText(p.runs.map((r) => ({ ...r, isSup: false, isSub: false })))).join(' ').replace(/\s+/g, ' ').trim();
  return norm(stripMarkup(joined)) === target ? joined : plain;
}
