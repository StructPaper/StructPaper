import { escapeLatex } from './latex-escape';
import { suggestArticleTypeEn } from './article-types';

/**
 * Closing English summary page, as printed by the journal after the references:
 * English title, author, abstract box, keywords, English affiliation / correspondence /
 * history / DOI / copyright in the side column, and the "Cite this article" box.
 *
 * It reuses the same side-box and \@maketitle machinery as the first page. The standard
 * \maketitle can only run once per document, so the page is built with \@maketitle directly.
 */

export interface EnglishPageInput {
  titleEn: string;
  abstractEn: string;
  keywordsEn: string[];
  articleTypeEn: string;
  authorsFormatted: string; // already LaTeX
  affiliationsEnFormatted: string; // already LaTeX
  corrName: string; // already LaTeX
  corrAffEn: string; // already LaTeX
  corrEmail: string; // already LaTeX
  isOneColumn: boolean;
  /** The first-page side box template, TeX source. */
  sideboxTemplate: string;
  /** Whole preamble source: \@maketitle, \title and \author are re-defined from it. */
  preambleWithMaketitle: string;
  /** Builds the \gdef\affbox{...} block for the given affiliation/correspondence strings. */
  buildAffbox: (affiliations: string, name: string, aff: string, email: string) => string;
  /** QR code block (TeX) built from the article DOI, or a blank space when there is no DOI yet. */
  qrBlock?: string;
  /** "Long P T, Nguyen V T, …" (no diacritics), already LaTeX. */
  citeAuthorsEn?: string;
}

/** "Võ Thị Nguyên" -> "Vo Thi Nguyen", as printed on the English page. */
export function toAsciiName(s: string): string {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

/** "Bài nghiên cứu" -> "Research Article" etc. */
export function articleTypeToEnglish(vi: string): string {
  return suggestArticleTypeEn(vi);
}

/**
 * Return the balanced-brace body of a TeX definition that starts with `opener` (which ends in "{"),
 * e.g. extractBalanced(src, '\\def\\@maketitle{').
 */
export function extractBalanced(source: string, opener: string): string | null {
  const start = source.indexOf(opener);
  if (start < 0) return null;
  let i = start + opener.length;
  let depth = 1;
  const bodyStart = i;
  for (; i < source.length && depth > 0; i++) {
    const c = source[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '%') {
      // TeX comment: braces inside it do not count (the template has "\\bfseries%{")
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return depth === 0 ? source.slice(bodyStart, i - 1) : null;
}

/** Back-compat helper for \@maketitle. */
export function extractMaketitleBody(preamble: string): string | null {
  return extractBalanced(preamble, '\\def\\@maketitle{');
}

export function hasEnglishPageContent(p: { titleEn?: string; abstractEn?: string }): boolean {
  return !!(p.titleEn && p.titleEn.trim() && p.abstractEn && p.abstractEn.trim());
}

export function buildEnglishPage(input: EnglishPageInput): string | null {
  const maketitleBody = extractMaketitleBody(input.preambleWithMaketitle);
  // \maketitle turns \title / \author into \relax after the first page, so re-create them.
  const titleBody = extractBalanced(input.preambleWithMaketitle, '\\def\\title#1{');
  const authorBody = extractBalanced(input.preambleWithMaketitle, '\\def\\author#1{');
  if (!maketitleBody || !titleBody || !authorBody) return null;

  const affbox = input.buildAffbox(input.affiliationsEnFormatted, input.corrName, input.corrAffEn, input.corrEmail);
  const sidebox = input.sideboxTemplate
    .replace(/\\gdef\\affbox\{[\s\S]*?\\newdimen\\fooa/, `${affbox}\n\n\\newdimen\\fooa`)
    // already allocated by the first page
    .replace('\\newsavebox{\\temp}', '')
    .replace('\\newdimen\\fooa', '')
    .replace('\\newdimen\\foob', '');

  const title = escapeLatex(input.titleEn.trim());
  const keywords = input.keywordsEn.filter((k) => k.trim()).join(', ');
  const open = input.isOneColumn ? '\\onecolumn\\@maketitle' : '\\twocolumn[\\@maketitle';
  const close = input.isOneColumn ? '' : ']';

  return `
\\clearpage
\\makeatletter
\\def\\Correspondence{\\normalfont\\textbf{Correspondence}}
\\def\\History{\\normalfont\\textbf{History}}
\\def\\Received{Received}\\def\\Revised{Revised}\\def\\Accepted{Accepted}\\def\\Published{Published Online}
\\def\\Copyright{\\normalfont\\textbf{Copyright}}
\\def\\publishershortname{VNUHCM Journal}
\\def\\copyrighttext{This is an open-access article distributed under the terms of the Creative Commons Attribution 4.0 International license.}
\\def\\citetext{Cite this article}
\\def\\citetitle{\\textbf{${title}}}${input.citeAuthorsEn ? `\n\\def\\citeauthor{${input.citeAuthorsEn}}` : ''}
\\def\\absname{ABSTRACT }
\\def\\@maketitle{${maketitleBody}}
\\def\\title#1{${titleBody}}
\\def\\author#1{${authorBody}}
\\articletype{${escapeLatex(input.articleTypeEn)}}
\\title{${title}}
\\author{{\\bfseries\\sffamily ${input.authorsFormatted}}}

${sidebox}
${open} {\\vspace*{-1pc}\\begin{mdframed}[innerrightmargin=1pc,innerleftmargin=1pc,innertopmargin=1pc,backgroundcolor=unitednationsblue,hidealllines=true]\\begin{textblock*}{.3\\textwidth}(-5cm,0cm)\\begin{center}\\vspace*{-1.15pc} \\hspace*{-.75pc}${input.qrBlock ?? '\\vspace*{1.5cm}'}\\\\
\\vspace*{-.35pc}{\\fontsize{8pt}{9pt}\\selectfont\\hspace*{-.75pc}\\color{gray}{Use your smartphone to scan~this}\\\\
\\vspace*{-.15pc}\\hspace*{-.75pc}\\color{gray}{QR code and download this article}}\\end{center}\\end{textblock*}\\begin{onecolabstract}\\def\\baselinestretch{1.06}\\fontsize{9.5pt}{9.5pt}\\selectfont ${escapeLatex(input.abstractEn.trim())}

\\noindent\\prolight\\textbf{Key words: }{${escapeLatex(keywords)}.\\newline}\\end{onecolabstract}\\end{mdframed}}\\vspace*{.8pc}${close}
\\thispagestyle{plain}
\\makeatother
`;
}
