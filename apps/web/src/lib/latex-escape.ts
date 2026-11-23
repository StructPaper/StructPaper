import { hasMarkup, markupToLatex } from './inline-markup';

/**
 * Escapes characters that have special meaning in LaTeX, while safely preserving math equations
 */
export function escapeLatex(text: string): string {
  if (!text) return '';
  // <b>…</b>, <i>…</i>, <u>…</u>, <color=#rrggbb>…</color> become real formatting; each run is escaped on its own
  if (hasMarkup(text)) return markupToLatex(text, escapePlainLatex);
  return escapePlainLatex(text);
}

function escapePlainLatex(text: string): string {
  if (!text) return '';

  // Strip zero-width and invisible unicode characters
  let clean = text.replace(/[\u200B\u200C\u200D\uFEFF\u200E\u200F]/g, '');

  // Protect LaTeX math segments: $$...$$ and $...$
  const mathSegments: string[] = [];
  const textWithPlaceholders = clean.replace(/(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g, (match) => {
    mathSegments.push(match);
    return `@@MATHTOKEN${mathSegments.length - 1}@@`;
  });

  let escaped = textWithPlaceholders
    // Replace % with \%
    .replace(/(?<!\\)%/g, () => '\\%')
    // Replace & with \&
    .replace(/(?<!\\)&/g, () => '\\&')
    // Replace _ with \_
    .replace(/(?<!\\)_/g, () => '\\_')
    // Replace # with \#
    .replace(/(?<!\\)#/g, () => '\\#')
    // Greek characters outside math mode
    .replace(/β/g, '$\\beta$')
    .replace(/α/g, '$\\alpha$')
    .replace(/γ/g, '$\\gamma$')
    .replace(/δ/g, '$\\delta$')
    .replace(/λ/g, '$\\lambda$')
    .replace(/μ/g, '$\\mu$')
    .replace(/π/g, '$\\pi$')
    .replace(/σ/g, '$\\sigma$')
    .replace(/θ/g, '$\\theta$')
    // Common math symbols outside math mode
    .replace(/≥/g, '$\\ge$')
    .replace(/≤/g, '$\\le$')
    .replace(/≠/g, '$\\ne$')
    .replace(/±/g, '$\\pm$')
    .replace(/→/g, '$\\to$')
    .replace(/←/g, '$\\gets$')
    .replace(/↔/g, '$\\leftrightarrow$')
    .replace(/⇒/g, '$\\Rightarrow$')
    .replace(/≈/g, '$\\approx$')
    .replace(/°/g, '$^\\circ$');

  // Restore math blocks untouched
  mathSegments.forEach((math, idx) => {
    escaped = escaped.replace(`@@MATHTOKEN${idx}@@`, () => math);
  });

  return escaped;
}
