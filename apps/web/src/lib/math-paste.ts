import { ommlToLatex } from './omml';

/** The formula in LaTeX from what was copied: no "$", "\[" or "\begin{equation}" around it. */
export function cleanLatex(raw: string): string {
  let t = (raw ?? '').trim();
  const strip = (re: RegExp) => {
    const m = re.exec(t);
    if (m) t = m[1].trim();
  };
  strip(/^\$\$([\s\S]*)\$\$$/);
  strip(/^\$([\s\S]*)\$$/);
  strip(/^\\\[([\s\S]*)\\\]$/);
  strip(/^\\\(([\s\S]*)\\\)$/);
  strip(/^\\begin\{(?:equation|align|displaymath)\*?\}([\s\S]*)\\end\{(?:equation|align|displaymath)\*?\}$/);
  return t.replace(/\s*\n\s*/g, ' ');
}

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

/**
 * A formula in what was copied. Where it came from decides how it is found: a Word equation travels as OMML in the HTML of the
 * clipboard; a formula on a web page (Wikipedia, KaTeX, MathJax) carries its LaTeX in an annotation or a data attribute; anything
 * else is the text itself, which may be LaTeX with or without its "$" signs.
 */
export function latexFromClipboard(html: string | undefined | null, text: string | undefined | null): string {
  const h = html ?? '';
  const annotation = /<annotation[^>]*encoding="application\/x-tex"[^>]*>([\s\S]*?)<\/annotation>/i.exec(h);
  if (annotation) return cleanLatex(decode(annotation[1]));
  const dataLatex = /data-(?:latex|tex)="([^"]+)"/i.exec(h);
  if (dataLatex) return cleanLatex(decode(dataLatex[1]));
  const omml = /<m:oMath(?:Para)?\b[\s\S]*?<\/m:oMath(?:Para)?>/i.exec(h);
  if (omml) {
    try {
      const latex = ommlToLatex(omml[0]);
      if (latex) return latex;
    } catch {
      // not a formula the converter reads: the text is tried instead
    }
  }
  return cleanLatex(text ?? '');
}
