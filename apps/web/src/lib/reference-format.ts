/**
 * How the journals print a reference and its DOI, learnt from their published PDFs:
 *   Hackshaw A, Morris JK, ... BMJ. 2018;360:j5855. Available from: https://doi.org/10.1136/bmj.j5855.
 * The DOI comes last, as a link, after "Available from:" (the Science and Technology Development journal prints the link alone);
 * page and year ranges use the en dash ("268–9", "2016–2023"), where Word files carry a hyphen.
 */

const DOI_AT_END = /\s*(?:\(?\s*(?:available\s+(?:from|at)|doi|link)\s*[:：]?\s*)?(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/\S+?)[.;,)]*\s*$/i;

/** A DOI as a bare "10.xxxx/yyyy", or undefined for something that is not one. */
export function cleanDoi(value?: string | null): string | undefined {
  const v = (value ?? '')
    .trim()
    .replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '')
    .replace(/[.;,)]+$/, '')
    .replace(/\s+/g, '');
  return /^10\.\d{4,9}\/\S+$/.test(v) ? v : undefined;
}

/** A reference whose text ends with "Available from: https://doi.org/..." (or "DOI: ...") keeps the DOI in its own field. */
export function splitReferenceDoi(raw: string): { raw: string; doi?: string } {
  const m = raw.match(DOI_AT_END);
  if (!m || m.index === undefined) return { raw };
  const doi = cleanDoi(m[1]);
  if (!doi) return { raw };
  const rest = raw.slice(0, m.index).trim();
  // nothing left but the DOI: the reference text is the DOI itself, keep it as it is
  if (rest.length < 20) return { raw };
  return { raw: rest.replace(/[\s,;:]+$/, ''), doi };
}

/** 268-9 -> 268–9, 2016-2023 -> 2016–2023; leaves dates (15-08-2025), ISSN (1859-0128), codes (COVID-19), decimals and links alone. */
export function enDashRanges(text: string): string {
  if (!text || !/\d\s?[-‐‑]\s?\d/.test(text)) return text;
  const guard = /(https?:\/\/\S+|10\.\d{4,9}\/\S+|\$[^$]*\$)/g;
  return text
    .split(guard)
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(/(?<![\w.,/-])(\d{1,4})\s?[-‐‑]\s?(\d{1,4})(?![\w.,/-]?\d|-|\w)/g, (all, a: string, b: string) => {
            // ISSN / ISBN-like groups are four digits each side
            if (a.length === 4 && b.length === 4) return Number(a) >= 1000 && Number(a) <= 2999 && Number(b) >= 1000 && Number(b) <= 2999 ? `${a}–${b}` : all;
            return `${a}–${b}`;
          }),
    )
    .join('');
}

/**
 * One reference as LaTeX: its text, then the DOI as a link when it has one and the text does not already say it.
 * `label` is what the journal prints before the link ("Available from: "); empty prints the link alone.
 */
export function referenceLatex(
  ref: { raw: string; doi?: string | null },
  escape: (s: string) => string,
  label = 'Available from: ',
  options: { dash?: boolean; showDoi?: boolean } = {},
): string {
  const body = escape(options.dash === false ? ref.raw.trim() : enDashRanges(ref.raw.trim()));
  const doi = options.showDoi === false ? undefined : cleanDoi(ref.doi);
  if (!doi || ref.raw.includes(doi)) return body;
  const end = /[.!?]$/.test(ref.raw.trim()) ? '' : '.';
  return `${body}${end} ${escape(label)}\\url{https://doi.org/${doi}}.`;
}
