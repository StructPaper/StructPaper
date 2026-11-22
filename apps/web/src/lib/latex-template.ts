import JSZip from 'jszip';
import { CompletePaper, LayoutSettings, JournalTemplate, PaperSection } from '@/types/paper';
import { arrangeForOutput, appendixSettingsOf, appendixLabel, isAppendix } from './appendix';
import { resolvePaperLayout } from '@/lib/layout/paper-profile';
import { getJournalTemplate } from './templates';
import { hasFootnotes, splitFootnotes } from './footnotes';
import { enDashRanges, referenceLatex } from './reference-format';
import { resolveTheme, hexToRgb as themeHexToRgb } from './theme-config';
import { sanitizeMathForLatex } from './math-text';
import { equationToLatex, EQUATION_FIT_MACRO } from './latex-equation';
import { PageLayoutTracker } from './latex-page-layout';
import { escapeLatex } from './latex-escape';
import { stripMarkup } from './inline-markup';
import { resolveCrossRefs } from './cross-refs';
import { isBullet, splitListItem } from './list-marks';
import { tableToLatex } from './latex-table';
import { SIZE9_PREAMBLE } from './latex-size9';
import { displayHeading } from './headings';
import { resolvePublication, hasPublicationValue, UNKNOWN } from './publication';
import { qrBlockFor } from './qr-latex';
import { buildEnglishPage, hasEnglishPageContent, toAsciiName } from './latex-english-page';
import { articleTypeEnglish } from './article-types';
import { affiliationEnglish, affiliationToEnglish } from './affiliation-en';
import { ENGLISH_LABELS, VIETNAMESE_LABELS, labelsFor, relabelPreamble, type PageLanguage } from './page-labels';
import {
  resolveLatexFigureFilename,
  appendFigureImagesToZip,
  rewriteBlobFigureSrcsForArchive,
} from './media/figure-image-utils';

import { stripCaptionLabel } from './docx-table-extras';
export { escapeLatex };

/**
 * Converts inline citation brackets like [1] or [1, 2] to native LaTeX natbib citations
 */
/** A heading is also an entry of the PDF's bookmark panel: an anchor at the heading and an entry that points to it. */
export const bookmark = (level: 'section' | 'subsection' | 'subsubsection', title: string): string =>
  `\\phantomsection\\addcontentsline{toc}{${level}}{${escapeLatex(title)}}\n`;

/** Text for a PDF information field: no TeX specials, one line. */
export const pdfText = (s: string): string => (s || '').replace(/[{}\\%#&_^~$]/g, ' ').replace(/\s+/g, ' ').trim();

const ORCID = /(\d{4}-\d{4}-\d{4}-\d{3}[\dXx])/;

/** The small green "iD" after an author's name, linking to their ORCID page; nothing for an ORCID that is not well formed. */
export const orcidLatex = (orcid?: string): string => {
  const id = (orcid || '').match(ORCID)?.[1]?.toUpperCase();
  return id ? `\\,\\href{https://orcid.org/${id}}{\\textcolor[RGB]{166,206,57}{\\textbf{\\scriptsize iD}}}` : '';
};

/** A footnote, printed at the foot of the page (in a two-column paper, at the foot of its column). */
const footnoteLatex = (note: string): string => `\\footnote{${escapeLatex(note)}}`;

/** Baseline of a bottom page number, in pt up from the bottom edge (measured on the printed journals: 756 pt down a 792 pt page). */
const PAGE_NUMBER_FROM_BOTTOM = 29.4;

/** The same for the alternating journals (ARNS, HS, SSH) from page 2 on: 736 pt down a 792 pt page, in 10 pt type. */
const ALTERNATING_FROM_BOTTOM = 48.7;

/** Set at the start of each document: whether number ranges get an en dash (see LayoutSettings.rangeDash). */
let rangeDashOn = true;

function formatParagraphText(text: string): string {
  if (!text) return '';
  // a footnote typed or imported as [[fn: text]] is printed at the foot of the page
  if (hasFootnotes(text)) return splitFootnotes(text).map((part) => (part.kind === 'note' ? footnoteLatex(part.text) : formatParagraphText(part.text))).join('');
  let escaped = escapeLatex(rangeDashOn ? enDashRanges(text) : text);
  if (parenCiteMax > 0) escaped = parenthesisedCitations(escaped, parenCiteMax);
  // "[15], [16–18]; [19, 20]": citations separated only by a comma or semicolon are one citation ("15,16–18,19,20"), with its commas
  // set small like the numbers, as the journals print them (a comma left between them would sit on the baseline)
  for (let i = 0; i < 6; i++) {
    const merged = escaped
      // "[6]–[8]" is the range 6–8
      .replace(/(\[\d[\d\s,;–—-]*)\]\s*[–—-]\s*\[(?=\d)/g, '$1–')
      // "[6], [7]" and "[6] [7][8]" (nothing, or only spaces, between) are one citation as well
      .replace(/(\[\d[\d\s,;–—-]*)\]\s*[,;]?\s*\[(?=\d)/g, '$1,');
    if (merged === escaped) break;
    escaped = merged;
  }
  escaped = escaped.replace(/\[(\d+(?:\s*[,;–—-]\s*\d+)*)\]/g, (_m, list: string) => bracketCitation(list));
  return linkFigureTableMentions(escaped);
}

/**
 * "[15]", "[10,11]", "[16–18]", "[15; 19-20]" -> one natbib citation of those references (a range is expanded; natbib prints a run of three
 * or more as "16–18" and two as "10,11", as the printed journals do).
 */
/**
 * A paragraph; or an item of a list (it starts with its mark: "• ", "1. ", "a) "), set with the mark hanging to the left of the text.
 */
export function paragraphOrItemLatex(content: string): string {
  const item = splitListItem(content);
  if (!item) return formatParagraphText(content);
  const mark = isBullet(item.mark) ? '$\\bullet$' : escapeLatex(item.mark);
  return `{\\hangindent=1.6em\\hangafter=1\\noindent\\hspace*{0.5em}\\makebox[1.1em][l]{${mark}}${formatParagraphText(item.rest)}\\par}`;
}

export function bracketCitation(list: string): string {
  const keys: string[] = [];
  for (const part of list.split(/\s*[,;]\s*/)) {
    const range = part.match(/^(\d+)\s*[–—-]\s*(\d+)$/);
    if (range && Number(range[2]) >= Number(range[1]) && Number(range[2]) - Number(range[1]) <= 40) {
      for (let n = Number(range[1]); n <= Number(range[2]); n++) keys.push(`ref${n}`);
    } else if (/^\d+$/.test(part)) keys.push(`ref${part}`);
    else return `[${list}]`;
  }
  return `\\unskip~\\cite{${keys.join(',')}}`;
}

/** Set at the start of each document: the number of references when "(n)" means a citation, else 0. */
let parenCiteMax = 0;

/** Words after which "(3)" names an equation, a figure, a step… not a reference. */
const NOT_A_CITATION = /(?:công thức|phương trình|biểu thức|hình|bảng|mục|bước|điều|khoản|điểm|equation|eq\.?|figure|fig\.?|table|section|step|formula|eqs?\.)\s*$/i;

/**
 * "(3)", "(2, 5)" and "(4-6)" after a word are citations of those references; "(1)" after "phương trình" or alone on a line is not.
 * Numbers above the number of references are left alone.
 */
export function parenthesisedCitations(escaped: string, max: number): string {
  return escaped.replace(/(\S)(\s?)\((\d{1,3}(?:\s*[,\-–]\s*\d{1,3})*)\)/g, (whole, prev: string, sp: string, list: string, offset: number, all: string) => {
    const before = all.slice(Math.max(0, offset - 20), offset) + prev;
    if (NOT_A_CITATION.test(before)) return whole;
    const nums: number[] = [];
    for (const part of list.split(/\s*,\s*/)) {
      const range = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
      if (range) {
        const [a, b] = [Number(range[1]), Number(range[2])];
        if (b < a || b - a > 20) return whole;
        for (let n = a; n <= b; n++) nums.push(n);
      } else nums.push(Number(part));
    }
    if (nums.some((n) => n < 1 || n > max)) return whole;
    return `${prev}${sp ? '\\unskip' : ''}~\\cite{${nums.map((n) => `ref${n}`).join(',')}}`;
  });
}

/**
 * Does this paper cite as "(6–8)", "(8, 9)" rather than "[6]"? True when at least three parenthesised citations are found and they are
 * more than the bracketed ones (a few stray "[49]" in a paper that cites with parentheses do not count).
 */
export function citesInParentheses(texts: string[], referenceCount: number): boolean {
  if (referenceCount <= 0) return false;
  const all = texts.join('\n');
  const bracketed = (all.match(/\[\d+(?:\s*[,;–-]\s*\d+)*\]/g) || []).length;
  const parenthesised = (parenthesisedCitations(all, referenceCount).match(/\\cite\{/g) || []).length;
  return parenthesised >= 3 && parenthesised > bracketed;
}

/** Numbers of the figures and tables of the paper being typeset: only these mentions become links. */
let figureTargets = new Set<number>();
let tableTargets = new Set<number>();

/**
 * "Hình 3", "Bảng 2", "Figure 1", "Table 4" in the text link to that figure or table (the labels set on their captions).
 * Lists ("Hình 1, 2 và 3") link each number that exists; a number without a figure or table is left as plain text.
 */
export function linkFigureTableMentions(escaped: string, figures: Set<number> = figureTargets, tables: Set<number> = tableTargets): string {
  return escaped.replace(
    /\b(Hình|Hình ảnh|Figures?|Figs?\.?|Bảng|Tables?)(~|\s)(\d+)((?:\s*(?:,|và|and|&|–|-)\s*\d+)*)/g,
    (whole, word: string, sep: string, first: string, rest: string) => {
      const isTable = /^(Bảng|Table)/i.test(word);
      const targets = isTable ? tables : figures;
      const link = (n: string, text: string) => (targets.has(Number(n)) ? `\\hyperref[${isTable ? 'tab:' : 'figure-'}${Number(n)}]{${text}}` : text);
      const tail = rest.replace(/(\d+)/g, (n) => link(n, n));
      return `${word}${sep}${link(first, first)}${tail}`;
    }
  );
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = (hex || '#003E88').replace('#', '');
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function formatJournalDate(dateStr?: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  const parts = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (parts) {
    const dd = parts[1].padStart(2, '0');
    const mm = parts[2].padStart(2, '0');
    const yyyy = parts[3];
    return `${dd}-${mm}-${yyyy}`;
  }
  const isoParts = trimmed.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (isoParts) {
    const yyyy = isoParts[1];
    const mm = isoParts[2].padStart(2, '0');
    const dd = isoParts[3].padStart(2, '0');
    return `${dd}-${mm}-${yyyy}`;
  }
  return trimmed;
}

// Complete official preamble before metadata with safe fallback guards
const OFFICIAL_PREAMBLE_PART1: string = "\\documentclass[9pt,twocolumn]{article}\n\\makeatletter\\if@twocolumn\\PassOptionsToPackage{switch}{lineno}\\else\\fi\\makeatother\n\n%Publisher: Pharmacogn\n%Template Provided By: Typeset\n\n\\usepackage{amsmath,amsfonts,amssymb,balance,tabulary,graphicx,caption,fancyhdr}\n\\usepackage[utf8]{inputenc}\n\\usepackage[numbers,super,sort&compress]{natbib}\n\n\\renewcommand{\\bibnumfmt}[1]{\\color{titlecolor} #1.}\n\n\\usepackage{abstract,mdframed}\n\n\n\\usepackage[paperheight=11in,paperwidth=8.51in,margin=2cm,left=1.7cm,headsep=.2cm,right=1.3cm,top=1.8cm]{geometry}\n\\setlength{\\paperwidth}{8.51in}\n\\setlength{\\paperheight}{11in}\n\\ifx\\pdfpagewidth\\undefined\\else\\setlength{\\pdfpagewidth}{8.51in}\\setlength{\\pdfpageheight}{11in}\\fi\n\\renewenvironment{onecolabstract} {\\prolight\\trivlist\\item[] \\vspace*{-.65pc}\\textbf{\\sffamily\\fontsize{9pt}{10pt}\\color{titlecolor}\\selectfont \\absname }\\\\}{\\par\\noindent\\endtrivlist}\\setlength{\\columnsep}{1pc} \n\\linespread{1.13} \\date{}\n\\renewcommand{\\headrulewidth}{0pt}\n          \\usepackage{polyglossia}\n          \\PassOptionsToPackage{vietnamese}{babel}\n          \\def\\absname{TÓM TẮT }\n          \\def\\Correspondence{\\normalfont\\textbf{Liên hệ}}\n          \\def\\History{\\normalfont\\textbf{Lịch sử}}\n          \\def\\Received{Ngày nhận}\n          \\def\\Revised{Ngày sửa đổi}\n          \\def\\Accepted{Ngày chấp nhận}\n          \\def\\Published{Ngày đăng}\n          \\def\\Copyright{\\normalfont\\textbf{Bản quyền}}\n          \\def\\publishershortname{ĐHQG Tp.HCM}\n          \\def\\copyrighttext{Đây là bài báo công bố mở được phát hành theo các điều khoản của the Creative Commons Attribution 4.0 International license.}\n          \\def\\citetext{Trích dẫn bài báo này}\n          \\def\\figurenm{\\sffamily\\bfseries\\color{titlecolor}Hình}\n          \\def\\tablenm{\\sffamily\\bfseries\\color{titlecolor}Bảng}\n\n          \\renewcommand\\ttfamily\\prolight\n        \n\n%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%\n% Following additional macros are required to function some \n% functions which are not available in the class used.\n%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%\n\\usepackage{url,multirow,morefloats,floatflt,cancel,tfrupee}\n\\makeatletter\n\n\n\\AtBeginDocument{\\@ifpackageloaded{textcomp}{}{\\usepackage{textcomp}}}\n\\makeatother\n\\usepackage{colortbl}\n\\usepackage{xcolor}\n\\usepackage{pifont}\n\\usepackage[nointegrals]{wasysym}\n\\urlstyle{rm}\n\\makeatletter\n\n%%%For Table column width calculation.\n\\def\\mcWidth#1{\\csname TY@F#1\\endcsname+\\tabcolsep}\n\n%%Hacking center and right align for table\n\\def\\cAlignHack{\\rightskip\\@flushglue\\leftskip\\@flushglue\\parindent\\z@\\parfillskip\\z@skip}\n\\def\\rAlignHack{\\rightskip\\z@skip\\leftskip\\@flushglue \\parindent\\z@\\parfillskip\\z@skip}\n\n%Etal definition in references\n\\@ifundefined{etal}{\\def\\etal{\\textit{et~al}}}{}\n\n\n%\\if@twocolumn\\usepackage{dblfloatfix}\\fi\n\\usepackage{ifxetex}\n\\ifxetex\\else\\if@twocolumn\\@ifpackageloaded{stfloats}{}{\\usepackage{dblfloatfix}}\\fi\\fi\n\n\\AtBeginDocument{\n\\expandafter\\ifx\\csname eqalign\\endcsname\\relax\n\\def\\eqalign#1{\\null\\vcenter{\\def\\\\{\\cr}\\openup\\jot\\m@th\n  \\ialign{\\strut$\\displaystyle{##}$\\hfil&$\\displaystyle{{}##}$\\hfil\n      \\crcr#1\\crcr}}\\,}\n\\fi\n}\n\n%For fixing hardfail when unicode letters appear inside table with endfloat\n\\AtBeginDocument{%\n  \\@ifpackageloaded{endfloat}%\n   {\\renewcommand\\efloat@iwrite[1]{\\immediate\\expandafter\\protected@write\\csname efloat@post#1\\endcsname{}}}{\\newif\\ifefloat@tables}%\n}%\n\n\\def\\BreakURLText#1{\\@tfor\\brk@tempa:=#1\\do{\\brk@tempa\\hskip0pt}}\n\\let\\lt=<\n\\let\\gt=>\n\\def\\processVert{\\ifmmode|\\else\\textbar\\fi}\n\\let\\processvert\\processVert\n\n\\@ifundefined{subparagraph}{\n\\def\\subparagraph{\\@startsection{paragraph}{5}{2\\parindent}{0ex plus 0.1ex minus 0.1ex}%\n{0ex}{\\normalfont\\small\\itshape}}%\n}{}\n\n% These are now gobbled, so won't appear in the PDF.\n\\newcommand\\role[1]{\\unskip}\n\\newcommand\\aucollab[1]{\\unskip}\n  \n\\@ifundefined{tsGraphicsScaleX}{\\gdef\\tsGraphicsScaleX{1}}{}\n\\@ifundefined{tsGraphicsScaleY}{\\gdef\\tsGraphicsScaleY{.9}}{}\n% To automatically resize figures to fit inside the text area\n\\def\\checkGraphicsWidth{\\ifdim\\Gin@nat@width>\\linewidth\n\t\\tsGraphicsScaleX\\linewidth\\else\\Gin@nat@width\\fi}\n\n\\def\\checkGraphicsHeight{\\ifdim\\Gin@nat@height>.9\\textheight\n\t\\tsGraphicsScaleY\\textheight\\else\\Gin@nat@height\\fi}\n\n\\def\\fixFloatSize#1{}%\\@ifundefined{processdelayedfloats}{\\setbox0=\\hbox{\\includegraphics{#1}}\\ifnum\\wd0<\\columnwidth\\relax\\renewenvironment{figure*}{\\begin{figure}}{\\end{figure}}\\fi}{}}\n\\let\\ts@includegraphics\\includegraphics\n\n\\def\\inlinegraphic[#1]#2{{\\edef\\@tempa{#1}\\edef\\baseline@shift{\\ifx\\@tempa\\@empty0\\else#1\\fi}\\edef\\tempZ{\\the\\numexpr(\\numexpr(\\baseline@shift*\\f@size/100))}\\protect\\raisebox{\\tempZ pt}{\\ts@includegraphics{#2}}}}\n\n%\\renewcommand{\\includegraphics}[1]{\\ts@includegraphics[width=\\checkGraphicsWidth]{#1}}\n\\AtBeginDocument{\\def\\includegraphics{\\@ifnextchar[{\\ts@includegraphics}{\\ts@includegraphics[width=\\checkGraphicsWidth,height=\\checkGraphicsHeight,keepaspectratio]}}}\n\n\\DeclareMathAlphabet{\\mathpzc}{OT1}{pzc}{m}{it}\n\n\\def\\URL#1#2{\\@ifundefined{href}{#2}{\\href{#1}{#2}}}\n\n%%For url break\n\\def\\UrlOrds{\\do\\*\\do\\-\\do\\~\\do\\'\\do\\\"\\do\\-}%\n\\g@addto@macro{\\UrlBreaks}{\\UrlOrds}\n\n\n\n\\edef\\fntEncoding{\\f@encoding}\n\\def\\EUoneEnc{EU1}\n\\makeatother\n\\def\\floatpagefraction{0.8} \n\\def\\dblfloatpagefraction{0.8}\n\\def\\style#1#2{#2}\n\\def\\xxxguillemotleft{\\fontencoding{T1}\\selectfont\\guillemotleft}\n\\def\\xxxguillemotright{\\fontencoding{T1}\\selectfont\\guillemotright}\n\n\\newif\\ifmultipleabstract\\multipleabstractfalse%\n\\newenvironment{typesetAbstractGroup}{}{}%\n\n%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%\n\n\n\n\\definecolor{titlecolor}{RGB}{TITLE_COLOR_R, TITLE_COLOR_G, TITLE_COLOR_B}\n\n\\usepackage{alphalph}\n\\makeatletter\n\\newalphalph{\\alphmult}[mult]{\\@alph}{26}\n\\makeatother\n\\renewcommand{\\thefootnote}{{\\alphmult{\\value{footnote}}}}\n\n\n\\usepackage{everyshi}\n\n\\makeatletter\n\\@ifpackageloaded{lineno}{\\setlength{\\linenumbersep}{.35pc}}{}\n\\usepackage{mathptmx}\n  \\def\\beforepage#1{%\n    \\edef\\later@{ later@}%\n    \\write\\@auxout{%\n        \\string\\expandafter\\string\\gdef\\string\\csname\\later@\\the\\numexpr\\c@page\\endcsname{\\unexpanded{#1}}\n    }%\n    }\n\\EveryShipout{\\ifcsname later@\\the\\numexpr\\c@page+1\\endcsname\\csname later@\\the\\numexpr\\c@page+1\\endcsname\\fi}\n\\AtBeginDocument{\\ifcsname later@1\\endcsname\\csname later@1\\endcsname\\fi}\n\\makeatother\n\n\\setlength{\\bibsep}{0.0pt}\n\\usepackage{fontspec}\n\\usepackage{xeCJK}\n\n% Han characters are set in SimSun, as the printed journal does (a light Song face at the size of the text around it); YaHei is the fallback\n\\newif\\ifcjksimsun\\IfFontExistsTF{SimSun}{\\cjksimsuntrue}{}\n\\IfFontExistsTF{Microsoft YaHei}{\n  \\ifcjksimsun\n    \\setCJKmainfont{SimSun}[AutoFakeBold=2.5,AutoFakeSlant=true]\n    \\setCJKsansfont{SimSun}[AutoFakeBold=2.5,AutoFakeSlant=true]\n    \\setCJKmonofont{SimSun}\n  \\else\n    \\setCJKmainfont{Microsoft YaHei}[AutoFakeBold=true,AutoFakeSlant=true]\n    \\setCJKsansfont{Microsoft YaHei}[AutoFakeBold=true,AutoFakeSlant=true]\n    \\setCJKmonofont{Microsoft YaHei}\n  \\fi\n}{\n  \\IfFontExistsTF{SimSun}{\n    \\setCJKmainfont{SimSun}[AutoFakeBold=true,AutoFakeSlant=true]\n    \\setCJKsansfont{SimHei}[AutoFakeBold=true,AutoFakeSlant=true]\n    \\setCJKmonofont{SimSun}\n  }{\n    \\IfFontExistsTF{PingFang SC}{\n      \\setCJKmainfont{PingFang SC}[AutoFakeBold=true,AutoFakeSlant=true]\n      \\setCJKsansfont{PingFang SC}[AutoFakeBold=true,AutoFakeSlant=true]\n      \\setCJKmonofont{PingFang SC}\n    }{\n      \\IfFontExistsTF{Noto Sans CJK SC}{\n        \\setCJKmainfont{Noto Sans CJK SC}[AutoFakeBold=true,AutoFakeSlant=true]\n        \\setCJKsansfont{Noto Sans CJK SC}[AutoFakeBold=true,AutoFakeSlant=true]\n        \\setCJKmonofont{Noto Sans CJK SC}\n      }{\n        \\IfFontExistsTF{WenQuanYi Micro Hei}{\n          \\setCJKmainfont{WenQuanYi Micro Hei}[AutoFakeBold=true,AutoFakeSlant=true]\n          \\setCJKsansfont{WenQuanYi Micro Hei}[AutoFakeBold=true,AutoFakeSlant=true]\n          \\setCJKmonofont{WenQuanYi Micro Hei}\n        }{}\n      }\n    }\n  }\n}\n\n%\\let\\oldcite=\\cite\n%\\renewcommand{\\cite}[1]{\\textcolor[RGB]{0,62,136}{\\oldcite{#1}}}\n\n\\usepackage[colorlinks=true,citecolor=titlecolor,urlcolor=titlecolor,linkcolor=titlecolor]{hyperref}\n\n  \\widowpenalty=10000 \n  \\clubpenalty=10000\n\n\n\\ifxetex\n  \\usepackage{letltxmacro}\n  \\setlength{\\XeTeXLinkMargin}{1pt}\n  \\LetLtxMacro\\SavedIncludeGraphics\\includegraphics\n  \\def\\includegraphics#1#{% #1 catches optional stuff (star/opt. arg.)\n    \\IncludeGraphicsAux{#1}%\n  }%\n  \\newcommand*{\\IncludeGraphicsAux}[2]{%\n    \\XeTeXLinkBox{%\n      \\SavedIncludeGraphics#1{#2}%\n    }%\n  }%\n\\fi\n\n\n\\IfFontExistsTF{MinionPro-Regular.otf}{%\n\\setmainfont{MinionPro-Regular.otf}[\nBoldFont=MinionPro-Bold.otf,\nItalicFont=MinionPro-It.otf,\nBoldItalicFont=MinionPro-BoldIt.otf]\n}{%\n\\IfFontExistsTF{Times New Roman}{%\n  \\setmainfont{Times New Roman}[\n    BoldFont=Times New Roman Bold,\n    ItalicFont=Times New Roman Italic,\n    BoldItalicFont=Times New Roman Bold Italic]\n}{%\n  \\setmainfont{Palatino Linotype}\n}%\n}\n\n\\IfFontExistsTF{MyriadPro-Regular.otf}{%\n\\setsansfont{MyriadPro-Regular.otf}[\nBoldFont=MyriadPro-Bold.otf,\nItalicFont=MyriadPro-It.otf,\nBoldItalicFont=MyriadPro-BoldIt.otf]\n}{%\n\\IfFontExistsTF{Source Sans 3}{%\n  \\setsansfont{Source Sans 3}[\n    BoldFont=Source Sans 3 Bold,\n    ItalicFont=Source Sans 3 Italic,\n    BoldItalicFont=Source Sans 3 Bold Italic]\n}{%\n\\IfFontExistsTF{Calibri}{%\n  \\setsansfont{Calibri}[\n    BoldFont=Calibri Bold,\n    ItalicFont=Calibri Italic,\n    BoldItalicFont=Calibri Bold Italic]\n}{%\n  \\setsansfont{Arial}\n}%\n}\n}\n\n\\IfFontExistsTF{UniversLTStd-Light.otf}{%\n\\setmonofont{UniversLTStd-Light.otf}[\nBoldFont=UniversLTStd-Bold.otf,\nItalicFont=UniversLTStd-ExObl.otf,\nBoldItalicFont=UniversLTStd-BlackObl.otf]\n}{%\n\\IfFontExistsTF{Source Sans 3 Light}{%\n  \\setmonofont{Source Sans 3 Light}[\n    BoldFont=Source Sans 3 Semibold,\n    ItalicFont=Source Sans 3 Light Italic,\n    BoldItalicFont=Source Sans 3 Bold Italic\n  ]\n}{%\n\\IfFontExistsTF{Calibri Light}{%\n  \\setmonofont{Calibri Light}[\n    BoldFont=Calibri,\n    ItalicFont=Calibri Light Italic,\n    BoldItalicFont=Calibri\n  ]\n}{%\n  \\setmonofont{Calibri}\n}%\n}\n}\n\n\\IfFontExistsTF{MyriadPro-Light.otf}{%\n\\newfontfamily\\prolight{MyriadPro-Light.otf}[\nBoldFont=MyriadPro-Bold.otf,\nItalicFont=MyriadPro-LightIt.otf,\nBoldItalicFont=MyriadPro-BoldIt.otf\n]\n}{%\n\\IfFontExistsTF{Source Sans 3 Light}{%\n  \\newfontfamily\\prolight{Source Sans 3 Light}[\n    BoldFont=Source Sans 3 Bold,\n    ItalicFont=Source Sans 3 Light Italic,\n    BoldItalicFont=Source Sans 3 Bold Italic\n  ]\n}{%\n\\IfFontExistsTF{Calibri Light}{%\n  \\newfontfamily\\prolight{Calibri Light}[\n    BoldFont=Calibri,\n    ItalicFont=Calibri Light Italic,\n    BoldItalicFont=Calibri\n  ]\n}{%\n  \\newfontfamily\\prolight{Calibri}\n}%\n}\n}\n\n\\renewcommand\\ttfamily\\prolight\n\n\\definecolor{numbercolor}{RGB}{0, 62, 136}\n\n\n\\definecolor{tableheadrcolor}{RGB}{229, 229, 229}\n\n\\definecolor{unitednationsblue}{RGB}{231, 236, 247}\n\n\n\n      \n      \\makeatletter\\def\\oupIndent{1pt}\n\\IfFileExists{tabcaptionwidth.sty}{\\usepackage{tabcaptionwidth}}{\\providecommand{\\tabularWidth}{\\linewidth}}\n\\definecolor{ocre}{RGB}{243,102,25}\n\\captionsetup[table]{justification=raggedright,singlelinecheck=false,name={\\tablenm},skip=1.4pt,font={small,sf,bf}, width=\\tabularWidth}\n\\captionsetup[figure]{name={\\figurenm},skip=.8pc,font={small,sf,small}}\n\\usepackage{changepage}\n\n\\usepackage{ifthen,everypage}\n\\IfFileExists{size9-edited.clo}{\\input{size9-edited.clo}}{}\n      \\def\\author#1{\\gdef\\@author{\\hskip-\\dimexpr(\\tabcolsep)%\n      \\hskip\\oupIndent%\n      \\hspace*{-11.5pc}%\n      \\parbox{\\dimexpr\\textwidth-\\oupIndent+11.5pc}%\n      {\\fontsize{11pt}{12pt}\\selectfont\\sffamily\\color{titlecolor}\\raggedright#1}}}\n      \n      \\def\\title#1{\\gdef\\@title{\\if@twocolumn\\else\\vspace*{-.8pc}\\fi\\vspace{.5pc}\\hspace*{.2pc}\\sffamily\\fontsize{18pt}{19pt}\n      \\selectfont\n      \\bfseries%{\n      \\parbox{\\dimexpr(\\linewidth+3.9cm)}\n      {\\color{titlecolor}\\raggedright#1\\\\[-.5pc]}\n      }}\n\n      \\let\\@articleType\\@empty \\def\\articletype#1{\\gdef\\@articleType{\\bfseries{\\fontsize{12pt}{12pt}\\selectfont\\itshape#1}}}\n\n\\fancypagestyle{headings}{\\fancyhf{}\\renewcommand{\\headrulewidth}{.5pt}\n\\fancyhead[L]{\\hspace{-\\spheadshift}\\bfseries\\sffamily\\itshape\\fontsize{8.5pt}{10pt}\\selectfont \\actualjournal\\journalname\\space\\ifx\\cmYear\\empty\\the\\year\\else\\cmYear\\fi,\\space\\cmVolume(\\cmIssue):\\cmfirstpage-\\cmlastpage}\n\\fancyfoot[L]{\\color{titlecolor}\\bfseries\\sffamily\\ifthenelse{\\isodd{\\value{page}}}{}{\\thepage}}\n\\fancyfoot[R]{\\color{titlecolor}\\bfseries\\sffamily\\ifthenelse{\\isodd{\\value{page}}}{\\thepage}{}}\n}\n\\pagestyle{headings}\n  \n\\fancypagestyle{plain}{\\renewcommand{\\headrulewidth}{0pt}\\renewcommand{\\footrulewidth}{0pt}\\fancyhf{}\n\\fancyhead[R]{\\begin{minipage}[b]{.5\\textwidth}\n\\hfill\\underline{\\@articleType}\\hspace*{.2pc} \\\\[-25pt]\n\\end{minipage}}\n\\fancyhead[L]{\\begin{minipage}[t]{.5\\textwidth}\n\\hspace{-11.4pc}\\itshape\\bfseries\n\\sffamily{\\fontsize{8pt}{7pt}\\selectfont \\actualjournal\\journalname\\space\\ifx\\cmYear\\empty\\the\\year\\else\\cmYear\\fi,\\space\\cmVolume(\\cmIssue):\\cmfirstpage-\\cmlastpage\\\\[.25pc]\\hspace*{-11.48pc}\n\\IfFileExists{open-access.png}{\\includegraphics[scale=.0072,keepaspectratio]{open-access.png}}{}\\raisebox{0.4pc}{\\normalfont \\color{gray}{\\bfseries\\,Open Access Full Text Article}}\n\\hfill}\n\\end{minipage}}%\n\\fancyfoot[c]{%\n  \\normalfont\\footnotesize%\n  \\raisebox{-.4cm}[2pc]{%\n    \\colorbox{blue!15}{\\parbox[c][1.4\\height]{.99\\textwidth}{\\sffamily\\fontsize{9pt}{10pt}\\selectfont\\textbf{\\citetext :} \\citeauthor. \\citetitle. \\textit{Sci. Tech. Dev. J.\\journalabbv}\\space\\ifx\\cmYear\\empty\\the\\year\\else\\cmYear\\fi;\\space\\cmVolume(\\cmIssue):\\cmfirstpage-\\cmlastpage.}}}~\\\\[2pt]\\hfill\\normalsize\\bfseries\\sffamily\\color{titlecolor}\\thepage}\n      }%\n      \\fancyheadoffset[leh,roh]{0pt}\n\n\\definecolor{trueblue}{rgb}{0.42, 0.35, 0.8}\n\\makeatother\n\n\n\\usepackage[explicit,noindentafter]{titlesec}\n\\def\\NormalBaseline{\\def\\baselinestretch{1.1}}\n\\usepackage{textcase}\n\\titleformat{\\section}[hang]{\\NormalBaseline\\filright\\boldmath\\bfseries\\color{titlecolor}\\fontsize{12pt}{13pt}\\selectfont\\sffamily}\n{\\thesection.}\n{6pt}\n{\\MakeTextUppercase{#1}}\n[]\n\\titleformat{\\subsection}[hang]{\\NormalBaseline\\color{titlecolor}\\fontsize{10pt}{12pt}\\selectfont\\bfseries\\sffamily}\n{\\thesubsection.}\n{6pt}\n{{#1}}\n[]\n\\titleformat{\\subsubsection}[hang]{\\NormalBaseline\\bfseries\\itshape\\color{titlecolor}\\fontsize{10pt}{12pt}\\selectfont\\sffamily}\n{\\hspace{16pt}\\thesubsubsection}\n{6pt}\n{{#1}}\n[]\n\\titleformat{\\paragraph}[hang]{\\NormalBaseline\\itshape}\n{\\theparagraph}\n{6pt}\n{\\color{titlecolor}{#1}}\n[]\n\\titleformat{\\subparagraph}[runin]{\\NormalBaseline}\n{\\thesubparagraph}\n{6pt}\n{\\color{titlecolor}{#1}}\n[]\n\n\\titlespacing{\\section}{0pt}{.5\\baselineskip}{.3\\baselineskip}  \n\\titlespacing{\\subsection}{0pt}{.8\\baselineskip}{.2\\baselineskip}  \n\\titlespacing{\\subsubsection}{0pt}{.8\\baselineskip}{.2\\baselineskip}  \n\\titlespacing{\\paragraph}{0pt}{.8\\baselineskip}{2pt}\n\\titlespacing{\\subparagraph}{0pt}{.5\\baselineskip}{2pt}\n\n";
const OFFICIAL_PREAMBLE_PART2: string = "\\setlength{\\parindent}{0pt}\n\n  \\usepackage{textpos}\n\n\\makeatletter\n\\def\\@maketitle{%\n  \\newpage\n  \\null\n  \\vskip 2em%\n\\begin{textblock*}{4.4cm}(-4.8cm,-2.3cm)\n\\begin{minipage}[b][.93\\paperheight]{4.4cm}\n\\vfill\n\\usebox{\\temp}\n\\ifdim\\the\\fooa<200pt\n\\vspace*{1.15cm}\n\\else\n\\vspace*{1.15cm}\n\\fi\n\\end{minipage}\n  \\end{textblock*}\n  \\let \\footnote \\thanks\n    \\hspace*{-5cm}\\parbox{\\linewidth}{\\LARGE \\@title \\par}%\n  \\begin{center}%\n    \\vskip 1.5em%\n    {\\large\n      \\lineskip .5em%\n      \\begin{tabular}[t]{c}%\n        \\@author\n      \\end{tabular}\\par}%\n    \\vskip 1em%\n    {\\large \\@date}%\n  \\end{center}%\n  \\par\n  \\vskip 1.5em}\n\n\\makeatother\n\\AtBeginDocument{\\usepackage{lastpage}}\n\\usepackage{enumitem}\n\\setlist{itemsep=-3pt}\n\n\n\\usepackage{float}\n\n\\makeatletter\n\\AtBeginDocument{\\@ifpackageloaded{rotating}{\\PassOptionsToPackage{figuresright}{rotating}}{\\usepackage[figuresright]{rotating}}\\setlength{\\rotFPtop}{0pt plus 1fil}\\setlength{\\rotFPbot}{0pt plus 1fil}}\n\\makeatother\n\n\\makeatletter\n \\AtBeginDocument{%\n  \\@ifpackagewith{endfloat}{figuresonly}\n  {\\DeclareDelayedFloatFlavor{sidewaysfigure}{figure}}%true\n  {\\@ifpackagewith{endfloat}{tablesonly}{\\DeclareDelayedFloatFlavor{sidewaystable}{table}\\DeclareDelayedFloatFlavor{longtable}{table}\\DeclareDelayedFloatFlavor{landscape}{table}}%true\n  {\\@ifpackageloaded{endfloat}{\\DeclareDelayedFloatFlavor{sidewaysfigure}{figure}\\DeclareDelayedFloatFlavor{sidewaystable}{table}\\DeclareDelayedFloatFlavor{longtable}{table}\\DeclareDelayedFloatFlavor{landscape}{table}}{}}%false\n  }%false\n  }\n\\makeatother\n\\IfFileExists{multirow-custom.sty}{\\usepackage{multirow-custom}}{}\n\\begin{document}";

// Official sidebox metadata structure
const OFFICIAL_SIDEBOX_TEMPLATE: string = "\\newsavebox{\\temp}\n        \\sbox{\\temp}{%\n        \\parbox{4.4cm}{%\n        %\\hrule \n        \\noindent\\hfil\\rule{4.4cm}{.5pt}\\hfil\n        \\gdef\\affbox{\\parbox{4.4cm}{\n        {~\\\\[.5pc]\\raggedright {\\fontsize{8pt}{8pt}\\selectfont\\itshape B{\\^{\\d{o}}} m{\\^o}n N{\\^{\\d{o}}}i - Khoa Y {\\textendash} Trường \\text{\\DJ}{\\d{a}}i h\\d{o}c Khoa h\\d{o}c Sức khỏe - \\text{\\DJ}{\\d{a}}i h\\d{o}c Quốc Gia Th\\`{a}nh phố Hồ Ch\\'{\\i} Minh\\\\[.5pc] }{\\ttfamily\\bfseries\\color{titlecolor}\\fontsize{7pt}{7pt}\\selectfont \\Correspondence}\\\\[.35pc]\n        {\\ttfamily\\fontsize{7pt}{8pt}\\selectfont\\textbf{\\prolight H\\`{a} {V{\\~{u}}}}, B{\\^{\\d{o}}} m{\\^o}n N{\\^{\\d{o}}}i - Khoa Y {\\textendash} Trường \\text{\\DJ}{\\d{a}}i h\\d{o}c Khoa h\\d{o}c Sức khỏe - \\text{\\DJ}{\\d{a}}i h\\d{o}c Quốc Gia Th\\`{a}nh phố Hồ Ch\\'{\\i} Minh\\\\[.35pc]Email: hvu@uhsvnu.edu.vn.\\\\[.3pc]}}}}\n\n\\newdimen\\fooa\n\\setbox0=\\hbox{\\affbox}\n\\fooa=\\ht0 \\advance\\fooa by \\dp0\n\\global\\fooa=\\fooa\n        \\affbox\n        \\\\[.5pc]\\raggedright%\n        \\gdef\\hiscopybox{\\parbox{4.4cm}{%\n\\gdef\\his{%\\raggedright\n        {\\ttfamily\\color{titlecolor}\\fontsize{7pt}{9pt}\\selectfont\\bfseries \\History}\\\\[-.1pc]\n{\\fontsize{8pt}{9pt}\\selectfont \\hspace{2pt}{\\color{titlecolor} $\\bullet$}\\ \\Received: \\ttfamily \\cmReceived\\\\}{\\fontsize{8pt}{9pt}\\selectfont \\hspace{2pt}{\\color{titlecolor} $\\bullet$}\\ \\Revised: \\ttfamily \\cmRevised\\\\}\n{\\fontsize{8pt}{9pt}\\selectfont \\hspace{2pt}{\\color{titlecolor}$\\bullet$}\\ \\Accepted: \\ttfamily \\cmAccepted\\\\}\n{\\fontsize{8pt}{9pt}\\selectfont \\hspace{2pt}{\\color{titlecolor}$\\bullet$}\\ \\Published: \\ttfamily \\cmPublished\\\\[.3pc]}\n{\\ttfamily\\color{titlecolor}\\fontsize{7pt}{9pt}\\selectfont\\bfseries DOI : }{\\fontsize{7pt}{7pt}\\selectfont\\bfseries \\cmDoi}\\\\[.8pc]\n\\IfFileExists{check-update.jpeg}{\\includegraphics[width=3.8cm,height=.8cm]{check-update.jpeg}\\\\[.8pc]}{\\vspace{.8pc}}}\n\\ifdim\\the\\fooa>200pt\\relax\\ifdim\\the\\fooa<265pt\\relax\\else\\his\\fi\\fi{\\raggedright\\fontsize{7pt}{9pt}\\selectfont{\\ttfamily\\color{titlecolor}\\bfseries \\Copyright\\\\[.1pc]}\\textcopyright\\ \\publishershortname. {\\ttfamily \\copyrighttext}\\\\[1pc]}\n\\ifdim\\the\\fooa>200pt\\IfFileExists{logo-vnuhcmpress-color.png}{\\hspace*{1pc}\\includegraphics[width=3cm,height=2cm]{logo-vnuhcmpress-color.png}}{}\\fi}}\n      \\newdimen\\foob\n\\setbox0=\\hbox{\\hiscopybox}\n\\global\\foob=\\ht0 \\advance\\foob by \\dp0\n\\AddEverypageHook{\n%\\settototalheight\\fooc{\\affbox}\n \\ifcsname dupcontnt\\endcsname%\n\\else\\ifdim\\the\\fooa>200pt\\ifnum\\thepage=2\n\\begin{textblock*}{\\textwidth}(-.8cm,-.15cm)\n\\begin{minipage}[b]{1.2\\textwidth}\n\\hiscopybox\n\\end{minipage}\n  \\end{textblock*}\\gdef\\dupcontnt{}\n\\fi\\fi\\fi\n}\n\\ifdim\\the\\fooa<265pt\\his\\fi\n\\ifdim\\the\\fooa<200pt\\hiscopybox\\fi\n\n    }}\n\n"

/**
 * Official LaTeX Template Generator for VNUHCM Scientific Journals.
 * Dynamically applies colors, headers, metadata, math, tables, and figures.
 */
export interface LatexOptions {
  /**
   * Language the paper is laid out in: its title, abstract, keywords, article type and the printed
   * labels (first page, references). The closing summary page is then printed in the OTHER language.
   */
  primaryLanguage?: PageLanguage;
  /**
   * Typeset with this template (names, colour, official cite names) instead of the journal's registered one: the Template editor
   * previews the rules being edited, which nobody has saved or published yet.
   */
  template?: JournalTemplate;
}

export function generateFullJournalLatex(paper: CompletePaper, customSettings?: LayoutSettings, options: LatexOptions = {}): string {
  // a reference to a table or a figure ("[[tbl:ID]]") is printed as its label, with the number the block has
  paper = resolveCrossRefs(paper, options.primaryLanguage ?? 'vi');
  const { metadata, sections, references } = paper;
  const lang: PageLanguage = options.primaryLanguage ?? 'vi';
  const en = lang === 'en';
  const labels = labelsFor(lang);
  const tmpl = options.template ?? getJournalTemplate(metadata.journalId);
  const customColor = (customSettings as any)?.color || (paper as any)?.color || (metadata as any)?.journalColor;
  const journalColor = customColor || tmpl.color;

  const settings = customSettings || resolvePaperLayout(paper);
  const theme = resolveTheme(settings, journalColor);
  const rgb = themeHexToRgb(theme.titleColor);
  const headRgb = themeHexToRgb(theme.tableHeaderColor);
  const zebraRgb = themeHexToRgb(theme.tableZebraColor);
  const isOneColumn = settings.columnLayout === '1-column';
  // hyphens between numbers become en dashes unless the author turned that off (read by formatParagraphText and the references)
  rangeDashOn = settings.rangeDash !== false;
  // a paper that cites as (1), (2, 3) instead of [1]: when the parenthesised numbers outnumber the bracketed ones they are citations
  parenCiteMax = citesInParentheses(sections.map((s) => s.content || ''), references.length) ? references.length : 0;

  let paperWidthStr = '8.51in';
  let paperHeightStr = '11in';
  if (settings.paperSize === 'a4') {
    paperWidthStr = '210mm';
    paperHeightStr = '297mm';
  } else if (settings.paperSize === 'letter') {
    paperWidthStr = '8.5in';
    paperHeightStr = '11in';
  } else if (settings.paperSize === 'b5') {
    paperWidthStr = '182mm';
    paperHeightStr = '257mm';
  }

  const docClassCols = isOneColumn ? 'onecolumn' : 'twocolumn';
  const fontSize = settings.fontSize || '9pt';
  const colSep = isOneColumn ? '1pc' : (settings.columnSep || '1pc');
  const lineSpread = settings.lineSpacing || '1.13';

  // Flexible Word-style Page Numbering configuration
  const pageNum = settings.pageNumbering || {
    enabled: true,
    position: 'bottom-alternating',
    format: 'arabic',
    startNumber: 1,
    suppressOnFirstPage: false,
    prefixText: '',
  };

  const pfxStr = pageNum.prefixText ? `${pageNum.prefixText} ` : '';
  let pageFormatCmd = '\\pagenumbering{arabic}';
  if (pageNum.format === 'roman-lower') pageFormatCmd = '\\pagenumbering{roman}';
  else if (pageNum.format === 'roman-upper') pageFormatCmd = '\\pagenumbering{Roman}';
  else if (pageNum.format === 'alpha-lower') pageFormatCmd = '\\pagenumbering{alph}';
  else if (pageNum.format === 'alpha-upper') pageFormatCmd = '\\pagenumbering{Alph}';
  else if (pageNum.format === 'hyphen') pageFormatCmd = '\\pagenumbering{arabic}\\renewcommand{\\thepage}{- \\arabic{page} -}';
  else if (pageNum.format === 'page-x-of-y') pageFormatCmd = '\\pagenumbering{arabic}\\renewcommand{\\thepage}{\\arabic{page} / \\pageref{LastPage}}';

  if (pfxStr && pageNum.format !== 'hyphen' && pageNum.format !== 'page-x-of-y') {
    pageFormatCmd += `\\let\\origthepage\\thepage\\renewcommand{\\thepage}{${pfxStr}\\origthepage}`;
  }

  // The printed article starts at its first page in the issue (e.g. 1237) once the editor enters it
  const issueFirstPage = parseInt(resolvePublication(paper.metadata).firstPage, 10);
  const startPage = Number.isFinite(issueFirstPage) && issueFirstPage > 0 ? issueFirstPage : pageNum.startNumber || 1;
  const startPageCmd = `\\setcounter{page}{${Math.max(1, startPage)}}`;

  let headingsFootHead = `\\fancyfoot[L]{\\color{titlecolor}\\bfseries\\sffamily\\ifthenelse{\\isodd{\\value{page}}}{}{\\thepage}}
\\fancyfoot[R]{\\color{titlecolor}\\bfseries\\sffamily\\ifthenelse{\\isodd{\\value{page}}}{\\thepage}{}}`;

  if (!pageNum.enabled) {
    headingsFootHead = '\\fancyfoot[L]{}\\fancyfoot[C]{}\\fancyfoot[R]{}';
    pageFormatCmd = '\\pagenumbering{gobble}';
  } else {
    switch (pageNum.position) {
      case 'bottom-center':
        headingsFootHead = '\\fancyfoot[L]{}\\fancyfoot[R]{}\\fancyfoot[C]{\\color{titlecolor}\\bfseries\\sffamily\\thepage}';
        break;
      case 'bottom-right':
        headingsFootHead = '\\fancyfoot[L]{}\\fancyfoot[C]{}\\fancyfoot[R]{\\color{titlecolor}\\bfseries\\sffamily\\thepage}';
        break;
      case 'bottom-left':
        headingsFootHead = '\\fancyfoot[R]{}\\fancyfoot[C]{}\\fancyfoot[L]{\\color{titlecolor}\\bfseries\\sffamily\\thepage}';
        break;
      case 'top-center':
        headingsFootHead = `\\fancyhead[C]{\\color{titlecolor}\\bfseries\\sffamily\\thepage}\\fancyfoot[L]{}\\fancyfoot[C]{}\\fancyfoot[R]{}`;
        break;
      case 'top-right':
        headingsFootHead = `\\fancyhead[R]{\\color{titlecolor}\\bfseries\\sffamily\\thepage}\\fancyfoot[L]{}\\fancyfoot[C]{}\\fancyfoot[R]{}`;
        break;
      case 'top-left':
        headingsFootHead = `\\fancyhead[L]{\\color{titlecolor}\\bfseries\\sffamily\\thepage}\\fancyfoot[L]{}\\fancyfoot[C]{}\\fancyfoot[R]{}`;
        break;
      case 'top-alternating':
        headingsFootHead = `\\fancyhead[R]{\\color{titlecolor}\\bfseries\\sffamily\\ifthenelse{\\isodd{\\value{page}}}{\\thepage}{}}\\fancyhead[L]{\\color{titlecolor}\\bfseries\\sffamily\\ifthenelse{\\isodd{\\value{page}}}{}{\\thepage}}\\fancyfoot[L]{}\\fancyfoot[C]{}\\fancyfoot[R]{}`;
        break;
      case 'bottom-alternating':
      default:
        headingsFootHead = `\\fancyfoot[L]{\\color{titlecolor}\\bfseries\\sffamily\\ifthenelse{\\isodd{\\value{page}}}{}{\\thepage}}\\fancyfoot[R]{\\color{titlecolor}\\bfseries\\sffamily\\ifthenelse{\\isodd{\\value{page}}}{\\thepage}{}}`;
        break;
    }
  }

  // A bottom page number sits at the same distance from the bottom of the page on every page (as on the printed first page),
  // not at a distance from the text: it is drawn on the page itself.
  let absolutePageNumber = '';
  const bottomKind = !pageNum.enabled
    ? ''
    : pageNum.position === 'bottom-center'
      ? 'C'
      : pageNum.position === 'bottom-right'
        ? 'R'
        : pageNum.position === 'bottom-left'
          ? 'L'
          : !pageNum.position || pageNum.position === 'bottom-alternating'
            ? 'A'
            : '';
  if (bottomKind) {
    headingsFootHead = '\\fancyfoot[L]{}\\fancyfoot[C]{}\\fancyfoot[R]{}';
    const style = (pt: number) => `\\fontsize{${pt}pt}{${pt + 1}pt}\\selectfont\\bfseries\\sffamily\\color{titlecolor}`;
    const at = (x: string, y: number, align: string, pt: number) => `\\put(${x},${y}){\\makebox(0,0)[${align}]{${style(pt)}\\thepage}}`;
    // the text area of the pages after the first (see \newgeometry below): the numbers sit under its edges, not at the edge of the paper
    const textLeft = '15.4pc';
    const textRight = '\\dimexpr\\paperwidth-3.1pc\\relax';
    const textMiddle = '\\dimexpr(15.4pc+\\paperwidth-3.1pc)/2\\relax';
    // measured on the printed journals: page 1, and the journals that put the number on one side, 9 pt at 756 pt down the page;
    // the alternating journals from page 2 on: 10 pt at 736 pt down, left under the left column and right under the right column
    const low = (x: string, align: string) => at(x, PAGE_NUMBER_FROM_BOTTOM, align, 9);
    const body =
      bottomKind === 'L'
        ? low(textLeft, 'bl')
        : bottomKind === 'R'
          ? low(textRight, 'br')
          : bottomKind === 'C'
            ? low(textMiddle, 'b')
            : // the first page, and the closing summary page (set like the first, with the "how to cite" strip in its foot; it marks itself
              // with \ovlowpage<n>), carry the number low on the right; the pages between alternate
              `\\ifnum\\value{page}=${Math.max(1, startPage)}${low(textRight, 'br')}\\else\\ifcsname ovlowpage\\thepage\\endcsname${low(textRight, 'br')}\\else\\ifodd\\value{page}${at(textRight, ALTERNATING_FROM_BOTTOM, 'br', 10)}\\else${at(textLeft, ALTERNATING_FROM_BOTTOM, 'bl', 10)}\\fi\\fi\\fi`;
    const shown = pageNum.suppressOnFirstPage ? `\\ifnum\\value{page}=${Math.max(1, startPage)}\\else${body}\\fi` : body;
    absolutePageNumber = `\\usepackage{eso-pic}\\AddToShipoutPictureFG{${shown}}`;
  }

  let preamblePart1 = OFFICIAL_PREAMBLE_PART1
    .replace('TITLE_COLOR_R', String(rgb.r))
    .replace('TITLE_COLOR_G', String(rgb.g))
    .replace('TITLE_COLOR_B', String(rgb.b))
    .replace('\\usepackage{url,multirow,morefloats,floatflt,cancel,tfrupee}', `\\usepackage{url,multirow,morefloats,floatflt,cancel,tfrupee,supertabular,array,longtable,${theme.rotateTablePage || (appendixSettingsOf(paper).rotatePage && paper.sections.some(isAppendix)) ? 'pdflscape' : 'lscape'}}`)
    .replace('\\definecolor{tableheadrcolor}{RGB}{229, 229, 229}', `\\definecolor{tableheadrcolor}{RGB}{${headRgb.r}, ${headRgb.g}, ${headRgb.b}}\n\\definecolor{tablezebracolor}{RGB}{${zebraRgb.r}, ${zebraRgb.g}, ${zebraRgb.b}}`)
    .replace('left=1.7cm,headsep=.2cm,right=1.3cm,top=1.8cm]', `left=${theme.margins.left}cm,headsep=.2cm,right=${theme.margins.right}cm,top=${theme.margins.top}cm,bottom=${theme.margins.bottom}cm]`)
    // xeCJK treats curly quotes (U+2018-201F) as CJK punctuation and sets them in a full-width CJK font
    // (MicrosoftYaHei) - the stray "providers’ perceived" glitch. Declare them ordinary (Default) characters.
    .replace('\\usepackage{xeCJK}', '\\usepackage{xeCJK}\n\\ifdefined\\xeCJKDeclareCharClass\\xeCJKDeclareCharClass{Default}{"2018,"2019,"201A,"201B,"201C,"201D,"201E,"201F}\\fi')
    // `article` has no real 9pt option (silent 10pt): emulate it inline, no extra TeX package needed.
    .replace('\\documentclass[9pt,twocolumn]{article}', fontSize === '9pt'
      ? `\\documentclass[10pt,${docClassCols}]{article}${SIZE9_PREAMBLE}`
      : `\\documentclass[${fontSize},${docClassCols}]{article}`)
    .replace('paperheight=11in,paperwidth=8.51in', `paperheight=${paperHeightStr},paperwidth=${paperWidthStr}`)
    .replace('\\setlength{\\paperwidth}{8.51in}', `\\setlength{\\paperwidth}{${paperWidthStr}}`)
    .replace('\\setlength{\\paperheight}{11in}', `\\setlength{\\paperheight}{${paperHeightStr}}`)
    .replace('\\setlength{\\pdfpagewidth}{8.51in}\\setlength{\\pdfpageheight}{11in}', `\\setlength{\\pdfpagewidth}{${paperWidthStr}}\\setlength{\\pdfpageheight}{${paperHeightStr}}`)
    .replace('\\setlength{\\columnsep}{1pc}', `\\setlength{\\columnsep}{${colSep}}`)
    .replace('\\linespread{1.13}', `\\linespread{${lineSpread}}`)
    .replace(
      `\\fancyfoot[L]{\\color{titlecolor}\\bfseries\\sffamily\\ifthenelse{\\isodd{\\value{page}}}{}{\\thepage}}\n\\fancyfoot[R]{\\color{titlecolor}\\bfseries\\sffamily\\ifthenelse{\\isodd{\\value{page}}}{\\thepage}{}}`,
      headingsFootHead
    );

  // If page numbering is disabled or suppressed on the first page
  if (!pageNum.enabled || pageNum.suppressOnFirstPage || bottomKind) {
    preamblePart1 = preamblePart1.replace(
      '\\hfill\\normalsize\\bfseries\\sffamily\\color{titlecolor}\\thepage',
      ''
    );
  }

  if (en) preamblePart1 = relabelPreamble(preamblePart1, ENGLISH_LABELS);

  if (tmpl.officialAbbvEn) {
    // "… Earth Sci." already ends with a period; do not print "Sci.."
    preamblePart1 = preamblePart1.replace('\\textit{Sci. Tech. Dev. J.\\journalabbv}', `\\textit{${tmpl.officialAbbvEn.replace(/\.$/, '')}.}`);
  }

  // Inject page numbering format and startNumber at end of preamble
  preamblePart1 += `\n${pageFormatCmd}\n${startPageCmd}\n${absolutePageNumber}\n`;
  if (theme.bodyFont !== 'Times New Roman') {
    preamblePart1 += `\\IfFontExistsTF{${theme.bodyFont}}{\\setmainfont{${theme.bodyFont}}}{}\n`;
  }
  if (theme.headingFont !== 'Calibri') {
    preamblePart1 += `\\IfFontExistsTF{${theme.headingFont}}{\\setsansfont{${theme.headingFont}}}{}\n`;
  }

  const viTitle = (metadata.title || '').trim() || 'TIÊU ĐỀ BÀI BÁO (BẢN THẢO)';
  const safeTitle = en ? (metadata.titleEn || '').trim() || viTitle : viTitle;
  const viAbstract = (metadata.abstract || '').trim() || 'Tóm tắt bài báo chưa được nhập. Vui lòng cập nhật tóm tắt tại mục Tóm tắt để hoàn thiện bản thảo.';
  // a trailing '.' on the last keyword would print as ".." because the template appends one
  const cleanKw = (ks?: string[]) => (ks || []).map((k) => k.trim().replace(/\.+$/, '')).filter(Boolean);
  const viKeywords = cleanKw(metadata.keywords).length > 0 ? cleanKw(metadata.keywords) : ['Bản thảo', 'Từ khóa'];
  const safeAbstract = en ? (metadata.abstractEn || '').trim() || viAbstract : viAbstract;
  const safeKeywords = en && cleanKw(metadata.keywordsEn).length > 0 ? cleanKw(metadata.keywordsEn) : viKeywords;

  const rawAuthors = metadata.authors && metadata.authors.length > 0
    ? metadata.authors
    : [{ id: 'a_default', name: 'Nhóm Tác giả', affiliationIds: [1] }];

  const rawAffiliations = metadata.affiliations && metadata.affiliations.length > 0
    ? metadata.affiliations
    : [{ id: 1, name: 'Đại học Quốc gia Thành phố Hồ Chí Minh' }];

  const citeAuthors = rawAuthors
    .map((a) => {
      const parts = (a.name || 'Tác giả').trim().split(/\s+/);
      const last = parts.pop() || '';
      const initials = parts.map((p) => p[0]).join(' ');
      return `${last} ${initials}`.trim();
    })
    .join(', ');

  const hasMultipleAffs = rawAffiliations.length > 1;
  const authorsFormatted = rawAuthors
    .map((a) => {
      const affMark = hasMultipleAffs && a.affiliationIds && a.affiliationIds.length > 0
        ? a.affiliationIds.join(',')
        : '';
      const corrMark = a.isCorresponding ? '*' : '';
      const supContent = `${affMark}${affMark && corrMark ? ',' : ''}${corrMark}`;
      const sup = supContent ? `\\textsuperscript{${supContent}}\\!` : '';
      const nameWithTildes = (a.name || 'Tác giả').trim().replace(/\s+/g, '~');
      return `${escapeLatex(nameWithTildes)}${sup}${orcidLatex(a.orcid)}`;
    })
    .join(', ');

  const affiliationsFormatted = rawAffiliations
    .map((aff) => {
      const prefix = hasMultipleAffs && aff.id ? `\\textsuperscript{${aff.id}}` : '';
      const lines: string[] = [];
      if (aff.name && aff.name.trim()) {
        lines.push(`${prefix}${escapeLatex(aff.name.trim())}`);
      }
      // The printed first page lists the Vietnamese affiliation only; the English one is on the closing summary page.
      if (!lines.length && aff.nameEn && aff.nameEn.trim()) {
        lines.push(`${prefix}${escapeLatex(aff.nameEn.trim())}`);
      }
      if (lines.length === 0) {
        lines.push(`${prefix}Đại học Quốc gia Thành phố Hồ Chí Minh`);
      }
      return lines.join('\\\\[.15pc]\n');
    })
    .join('\\\\[.35pc]\n');

  const corrAuthorObj = rawAuthors.find((a) => a.isCorresponding);
  const corrName = escapeLatex(metadata.corresponding?.name || corrAuthorObj?.name || rawAuthors[0]?.name || 'Tác giả liên hệ');
  const corrAff = escapeLatex(metadata.corresponding?.affiliation || rawAffiliations[0]?.name || 'Đại học Quốc gia TP.HCM');
  const corrEmail = escapeLatex((metadata.corresponding?.email || corrAuthorObj?.email || rawAuthors[0]?.email || 'tacgia@vnuhcm.edu.vn').replace(/\.+$/, ''));

  const customJournalName = metadata.journalName || tmpl.name;
  const isVnuhcmMain = /^Tạp chí Phát triển (Khoa học &|KH&CN|Khoa học và) Công nghệ/i.test(customJournalName);
  const mainJournalName = tmpl.officialNameEn || (isVnuhcmMain ? 'Tạp chí Phát triển Khoa học và Công nghệ' : customJournalName);
  const subSeriesName = isVnuhcmMain
    ? customJournalName.replace(/^Tạp chí Phát triển (Khoa học &|KH&CN|Khoa học và) Công nghệ\s*[–-]?\s*/i, '').trim()
    : '';
  const journalSuffix = subSeriesName && !tmpl.officialNameEn ? ` -- ${subSeriesName}` : '';

  const rawAbbv = metadata.journalAbbv || tmpl.shortName;
  const subAbbv = rawAbbv.replace(/^Sci\.\s*Tech\.\s*Dev\.\s*J\.?\s*/i, '').trim();
  const formattedAbbv = subAbbv ? ` - ${subAbbv.replace(/^-\s*/, '')}` : (rawAbbv && rawAbbv !== tmpl.shortName ? ` - ${rawAbbv}` : '');

  // Publication data: "?" until the editor enters it, blank if deliberately cleared
  const pub = resolvePublication(metadata);
  const qrBlock = qrBlockFor(pub.doi);
  const dateOrUnknown = (v?: string) => formatJournalDate(v) || UNKNOWN;
  const publishedText = hasPublicationValue(pub.published) ? formatJournalDate(pub.published) : pub.published;
  const metaBlock = `\\def\\cmDoi{${escapeLatex(pub.doi)}}
\\def\\cmVolume{${escapeLatex(pub.volume)}}
\\def\\cmIssue{${escapeLatex(pub.issue)}}
\\def\\cmMonth{}
\\def\\cmYear{${metadata.year || new Date().getFullYear().toString()}}
\\def\\journalabbv{${escapeLatex(formattedAbbv)}}

\\def\\cmReceived{${escapeLatex(dateOrUnknown(metadata.dates?.received))}}
\\def\\cmRevised{${escapeLatex(dateOrUnknown(metadata.dates?.revised))}}
\\def\\cmAccepted{${escapeLatex(dateOrUnknown(metadata.dates?.accepted))}}
\\def\\cmPublished{${escapeLatex(publishedText)}}
\\def\\cmfirstpage{${escapeLatex(pub.firstPage)}}
\\def\\cmlastpage{${escapeLatex(pub.lastPage)}}
\\def\\citeauthor{${escapeLatex(en ? toAsciiName(citeAuthors) : citeAuthors)}}
\\def\\citetitle{\\textbf{${escapeLatex(safeTitle)}}}\\def\\journalname{${escapeLatex(journalSuffix)}}\\def\\actualjournal{${escapeLatex(mainJournalName)}}\\renewcommand{\\refname}{${labels.references}}
% what a PDF reader and a search index show about the file
\\hypersetup{pdftitle={${pdfText(safeTitle)}},pdfauthor={${pdfText(rawAuthors.map((a) => a.name).join(', '))}},pdfsubject={${pdfText(`${mainJournalName} ${metadata.year || ''}`)}},pdfkeywords={${pdfText(safeKeywords.join(', '))}},pdfcreator={StructPaper}}
`;

  const buildAffbox = (affs: string, name: string, aff: string, email: string) => `        \\gdef\\affbox{\\parbox{4.4cm}{
        {~\\\\[.5pc]\\raggedright {\\fontsize{8pt}{8pt}\\selectfont\\itshape ${affs}\\\\[.77pc]} }{\\ttfamily\\bfseries\\color{titlecolor}\\fontsize{7pt}{7pt}\\selectfont \\Correspondence}\\\\[.35pc]
        {\\ttfamily\\fontsize{7pt}{8pt}\\selectfont\\textbf{\\prolight ${name}}, ${aff}\\\\[.35pc]Email: ${email}.\\par}\\vspace{.3pc}}}`;
  const affiliationsEnFormatted = rawAffiliations
    .map((aff) => `${hasMultipleAffs && aff.id ? `\\textsuperscript{${aff.id}}` : ''}${escapeLatex(affiliationEnglish(aff))}`)
    .join('\\\\[.35pc]\n');
  const corrAffEn = escapeLatex(
    rawAffiliations[0]?.nameEn?.trim() || rawAffiliations[0]?.name
      ? affiliationEnglish(rawAffiliations[0])
      : affiliationToEnglish((metadata.corresponding?.affiliation || '').trim())
  );
  // first page: the primary language (English prints names without diacritics)
  const dynamicAffbox = en
    ? buildAffbox(affiliationsEnFormatted, toAsciiName(corrName), corrAffEn, corrEmail)
    : buildAffbox(affiliationsFormatted, corrName, corrAff, corrEmail);

  const sidebox = OFFICIAL_SIDEBOX_TEMPLATE.replace(
    /\\gdef\\affbox\{[\s\S]*?\\newdimen\\fooa/,
    `${dynamicAffbox}\n\n\\newdimen\\fooa`
  );

  const titleBlock = `\n\n\\articletype{${escapeLatex(en ? articleTypeEnglish(metadata) : metadata.articleType || 'Bài nghiên cứu')}}
\\title{${escapeLatex(safeTitle)}}
\\author{{\\bfseries\\sffamily ${en ? toAsciiName(authorsFormatted) : authorsFormatted}}}

${sidebox}
\\newgeometry{left=15.4pc,right=3.1pc,footskip=0cm,bottom=${(theme.margins.bottom + 1.4).toFixed(1)}cm,paperheight=${paperHeightStr},paperwidth=${paperWidthStr},headsep=.2cm,top=${theme.margins.top}cm}    
% a table that takes a page of its own may use the whole width, over the side column (QR code, contact), then the text area comes back
% (the running head is set 11.4pc left of the text area, into the side column; across the whole page it starts at the text edge)
\\newlength{\\spheadshift}\\setlength{\\spheadshift}{11.4pc}
\\newcommand{\\spwidegeometry}{\\newgeometry{left=${theme.margins.left}cm,right=${theme.margins.right}cm,footskip=0cm,bottom=${(theme.margins.bottom + 1.4).toFixed(1)}cm,paperheight=${paperHeightStr},paperwidth=${paperWidthStr},headsep=.2cm,top=${theme.margins.top}cm}\\setlength{\\spheadshift}{0pt}}
\\newcommand{\\sptextgeometry}{\\newgeometry{left=15.4pc,right=3.1pc,footskip=0cm,bottom=${(theme.margins.bottom + 1.4).toFixed(1)}cm,paperheight=${paperHeightStr},paperwidth=${paperWidthStr},headsep=.2cm,top=${theme.margins.top}cm}\\setlength{\\spheadshift}{11.4pc}}
${isOneColumn
  ? `\\onecolumn \\maketitle {\\vspace*{-1pc}\\begin{mdframed}[innerrightmargin=1pc,innerleftmargin=1pc,innertopmargin=1pc,backgroundcolor=unitednationsblue,hidealllines=true]\\begin{textblock*}{.3\\textwidth}(-5cm,0cm)\\begin{center}\\vspace*{-1.15pc} \\hspace*{-.75pc}${qrBlock}\\\\\n\\vspace*{-.35pc}{\\fontsize{8pt}{9pt}\\selectfont\\hspace*{-.75pc}\\color{gray}{Use your smartphone to scan~this}\\\\\n\\vspace*{-.15pc}\\hspace*{-.75pc}\\color{gray}{QR code and download this article}}\\end{center}\\end{textblock*}\\begin{onecolabstract}\\def\\baselinestretch{1.06}\\fontsize{9.5pt}{9.5pt}\\selectfont ${escapeLatex(safeAbstract)}\\def\\keywordstitle{Keywords}

\\noindent\\prolight\\textbf{${labels.keywords}: }{${escapeLatex(safeKeywords.join(', '))}\\newline}\\end{onecolabstract}\\end{mdframed}}\\vspace*{.8pc}\\saythanks \\baselineskip=\\the\\baselineskip plus.5pt minus.5pt`
  : `\\twocolumn[ \\maketitle {\\vspace*{-1pc}\\begin{mdframed}[innerrightmargin=1pc,innerleftmargin=1pc,innertopmargin=1pc,backgroundcolor=unitednationsblue,hidealllines=true]\\begin{textblock*}{.3\\textwidth}(-5cm,0cm)\\begin{center}\\vspace*{-1.15pc} \\hspace*{-.75pc}${qrBlock}\\\\\n\\vspace*{-.35pc}{\\fontsize{8pt}{9pt}\\selectfont\\hspace*{-.75pc}\\color{gray}{Use your smartphone to scan~this}\\\\\n\\vspace*{-.15pc}\\hspace*{-.75pc}\\color{gray}{QR code and download this article}}\\end{center}\\end{textblock*}\\begin{onecolabstract}\\def\\baselinestretch{1.06}\\fontsize{9.5pt}{9.5pt}\\selectfont ${escapeLatex(safeAbstract)}\\def\\keywordstitle{Keywords}

\\noindent\\prolight\\textbf{${labels.keywords}: }{${escapeLatex(safeKeywords.join(', '))}\\newline}\\end{onecolabstract}\\end{mdframed}}\\vspace*{.8pc}]\\saythanks \\baselineskip=\\the\\baselineskip plus.5pt minus.5pt`}

`;

  figureTargets = new Set();
  tableTargets = new Set();
  sections.forEach((sec, secIdx) => {
    if (sec.type === 'figure' && sec.figure) figureTargets.add(sec.figure.num || secIdx + 1);
    else if (sec.type === 'table' && sec.table) tableTargets.add(sec.table.num || 1);
  });
  let bodyLatex = '';
  const layoutTracker = new PageLayoutTracker(isOneColumn, settings.orientation === 'landscape');
  // the order the paper is printed in: the appendices where the paper's setting puts them (see lib/appendix)
  const arranged = arrangeForOutput(paper, lang);
  const appendixSettings = appendixSettingsOf(paper);
  const appendixLabelFor = (n: number): string => appendixLabel(n, appendixSettings.numbering, lang);
  // the words of an appendix table: its label, and what its next pages say
  const appendixWords = { label: appendixLabelFor, continued: en ? '(continued)' : '(tiếp theo)', foot: en ? 'Continued on next page' : 'Xem tiếp ở trang sau' };
  const renderSections = (list: PaperSection[], indexBase = 0, inAppendix = false): string => {
  let bodyLatex = '';
  list.forEach((sec, k) => {
    const secIdx = indexBase + k;
    const title = sec.title?.trim() || '';
    const content = sec.content?.trim() || '';
    // Skip stray metadata sections or paragraphs
    if (/^(liên hệ|lịch sử|bản quyền|copyright|trích dẫn bài báo này|open access|article type)/i.test(title)) return;
    if (/©\s*ĐHQG|Creative Commons|hvu@uhsvnu|tạp chí phát triển/i.test(title)) return;
    if (sec.type === 'paragraph') {
      if (/©\s*ĐHQG|Creative Commons|Use your smartphone/i.test(content)) return;
      if (/^(email:|doi:|lịch sử|ngày nhận)/i.test(content)) return;
      if (/^(không steroid|thuốc ức chế)/i.test(content) && content.length < 80) return;
      if (rawAuthors.some((a) => a.name === content || (content.includes(a.name) && content.length < 80))) return;
    }

    bodyLatex += layoutTracker.enter(sec, secIdx);
    const oneCol = layoutTracker.oneColumn; // columns in force here (a page-layout marker may change them)

    if (sec.type === 'h1' && sec.title) {
      // capitals for the words only: the tags of bold/italic/colour ("<i>…</i>") must stay lower case to be read as tags
      const displayTitle = displayHeading(sec.title, theme.keepSectionNumbers)
        .replace(/<[^>]*>|[^<]+/g, (part) => (part.startsWith('<') ? part : part.toUpperCase()))
        .replace(/TÁ\s+TRÀNG/g, 'TÁ~TRÀNG');
      bodyLatex += `\n${bookmark('section', stripMarkup(displayTitle))}\\section*\n  {\\textbf{${escapeLatex(displayTitle)}}}\n`;
      if (sec.content) bodyLatex += `${formatParagraphText(sec.content)}\n`;
    } else if (sec.type === 'h2' && sec.title) {
      bodyLatex += `\n${bookmark('subsection', displayHeading(sec.title, theme.keepSectionNumbers))}\\subsection*\n  {\\textbf{${escapeLatex(displayHeading(sec.title, theme.keepSectionNumbers))}}}\n`;
      if (sec.content) bodyLatex += `${formatParagraphText(sec.content)}\n`;
    } else if (sec.type === 'h3' && sec.title) {
      bodyLatex += `\n${bookmark('subsubsection', displayHeading(sec.title, theme.keepSectionNumbers))}\\subsubsection*\n  {\\textbf{${escapeLatex(displayHeading(sec.title, theme.keepSectionNumbers))}}}\n`;
      if (sec.content) bodyLatex += `${formatParagraphText(sec.content)}\n`;
    } else if (sec.type === 'paragraph' && sec.content) {
      bodyLatex += `\n${paragraphOrItemLatex(sec.content)}\n`;
    } else if (sec.type === 'citation' && sec.content) {
      bodyLatex += `\n\\begin{mdframed}[backgroundcolor=unitednationsblue,linecolor=journalBlue,linewidth=0.5pt,innerleftmargin=0.8pc,innerrightmargin=0.8pc,innertopmargin=0.5pc,innerbottommargin=0.5pc]
{\\footnotesize\\textbf{\\color{journalBlue}Trích dẫn bài báo này: }\\textit{${escapeLatex(sec.content)}}}
\\end{mdframed}\n`;
    } else if (sec.type === 'equation' && sec.equation && sec.equation.latex.trim()) {
      bodyLatex += equationToLatex(sec, secIdx, oneCol);
    } else if (sec.type === 'figure' && sec.figure) {
      const figNum = sec.figure.num || (secIdx + 1);
      const imgName = resolveLatexFigureFilename(sec.figure, figNum);

      // A figure on a page of its own (an appendix figure, or one the author sets across the whole page, over the side column): not a float,
      // which could not be turned or sent off the page. The caption stands above an appendix figure, under any other, as the journal sets them.
      const figWide = sec.figure.sideColumn === 'full';
      if (inAppendix || figWide) {
        const turned = !inAppendix && !!sec.figure.isRotated;
        const pic = `width=${((sec.figure.scalePercent || 100) / 100).toFixed(2)}\\linewidth,height=\\dimexpr\\textheight-2.6cm\\relax,keepaspectratio`;
        const isApp = !!sec.figure.appendix;
        const capTitle = escapeLatex(stripCaptionLabel(sec.figure.caption));
        const capBody = isApp ? `{\\color{titlecolor}${escapeLatex(appendixLabelFor(sec.figure.num))}.}\\ ${capTitle}` : `\\textbf{${capTitle}}`;
        const capTex = `{\\captionsetup{width=\\linewidth,justification=raggedright,singlelinecheck=false,font={small,sf,bf}}\\captionof${isApp ? '*' : ''}{figure}{${capBody}}}`;
        const imageTex = `\\begin{center}\\IfFileExists{images/${imgName}}{\\includegraphics[${pic}]{images/${imgName}}}{\\IfFileExists{${imgName}}{\\includegraphics[${pic}]{${imgName}}}{\\fbox{\\parbox[c][2.4cm][c]{0.6\\linewidth}{\\centering\\sffamily\\footnotesize Chưa có ảnh cho ${isApp ? appendixLabelFor(sec.figure.num) : 'Hình ' + figNum}}}}}\\end{center}`;
        const sourceTex = sec.figure.source ? `{\\footnotesize\\textit{${escapeLatex(sec.figure.source)}}}\\par\n` : '';
        const block = isApp ? `${capTex}\\par\\nopagebreak[4]\\vspace{0.3em}\\nopagebreak[4]\n${imageTex}\n${sourceTex}` : `${imageTex}\n${capTex}\\par\n${sourceTex}`;
        if (inAppendix) {
          bodyLatex += `\n\\par\\vspace{0.6em}${block}`;
        } else {
          bodyLatex += `\n\\clearpage\n\\ifdefined\\spwidegeometry\\spwidegeometry\\fi\n${oneCol ? '' : '\\onecolumn\n'}${turned ? '\\begin{landscape}\n{\\setlength{\\linewidth}{\\dimexpr\\linewidth-1.6cm\\relax}\n' : ''}${block}${turned ? '}\n\\end{landscape}\n' : ''}\\clearpage\n\\ifdefined\\sptextgeometry\\sptextgeometry\\fi\n${oneCol ? '' : '\\twocolumn\n'}`;
        }
        return;
      }

      // Column layout for figure: 1-column vs 2-column
      const isFigOneCol = oneCol || sec.figure.columnSpan === '1-column' || sec.figure.isFullWidth === false;
      const figEnv = isFigOneCol ? 'figure' : 'figure*';

      // Placement: auto -> !htbp, top -> t, here -> !h, bottom -> b
      let placement = '!htbp';
      if (sec.figure.placement === 'top') placement = 't';
      else if (sec.figure.placement === 'here') placement = '!h';
      else if (sec.figure.placement === 'bottom') placement = 'b';

      // Scale
      const scalePct = sec.figure.scalePercent || 100;
      const widthFactor = (scalePct / 100).toFixed(2);
      const widthArg = `width=${widthFactor}\\linewidth`;

      // Frame / Background
      const hasBorder = sec.figure.hasBorder !== false;
      const mdframedStart = hasBorder
        ? `\\begin{mdframed}[backgroundcolor=unitednationsblue,hidealllines=true]\n`
        : '';
      const mdframedEnd = hasBorder ? `\\end{mdframed}` : '';

      const figureLatex = `\n\\bgroup
\\fixFloatSize{images/${imgName}}
\\begin{${figEnv}}[${placement}]${mdframedStart}\\centering \\makeatletter
${sec.figure.src?.trim() ? '' : `\\fbox{\\parbox[c][2.4cm][c]{0.92\\linewidth}{\\centering\\sffamily\\footnotesize Chưa có ảnh cho Hình ${figNum}}}\\iffalse\n`}\\IfFileExists{images/${imgName}}{\\includegraphics[${widthArg}]{images/${imgName}}}{%
\\IfFileExists{${imgName}}{\\includegraphics[${widthArg}]{${imgName}}}{%
\\IfFileExists{images/fig${figNum}.png}{\\includegraphics[${widthArg}]{images/fig${figNum}.png}}{%
\\IfFileExists{fig${figNum}.png}{\\includegraphics[${widthArg}]{fig${figNum}.png}}{%
\\IfFileExists{images/fig${figNum}.jpg}{\\includegraphics[${widthArg}]{images/fig${figNum}.jpg}}{%
\\IfFileExists{fig${figNum}.jpg}{\\includegraphics[${widthArg}]{fig${figNum}.jpg}}{%
\\IfFileExists{open-access.png}{\\includegraphics[width=0.65\\linewidth]{open-access.png}}{\\rule{5cm}{3cm}}%
}}}}}}${sec.figure.src?.trim() ? '' : '\n\\fi'}
\\makeatother
\\caption${sec.figure.appendix ? '*' : ''}{{\\textbf{${escapeLatex(sec.figure.appendix ? `Phụ lục ${sec.figure.num}. ${stripCaptionLabel(sec.figure.caption)}` : stripCaptionLabel(sec.figure.caption))}}}}
${sec.figure.source ? `\\vspace{-0.3em}\\centering{\\footnotesize\\textit{${escapeLatex(sec.figure.source)}}}\\\\\n` : ''}${sec.figure.appendix ? '' : `\\label{figure-${figNum}}`}${mdframedEnd}
\\end{${figEnv}}
\\egroup\n`;
      bodyLatex += figureLatex;
    } else if (sec.type === 'table' && sec.table) {
      // a rotated table inside a landscape page is already sideways
      // (on an appendix page the table is already across the turned page: it flows there, a float would be sent off the page)
      bodyLatex += tableToLatex(layoutTracker.landscape || inAppendix ? { ...sec.table, isRotated: false } : sec.table, { isOneColumn: oneCol || inAppendix, theme, inline: inAppendix, appendix: appendixWords });
    }

    if (sec.pageBreakAfter) {
      bodyLatex += `\n\\clearpage\n`;
    }
  });
  return bodyLatex;
  };
  // The appendices are tables and figures like any other, each with its own settings (turned, across the whole page): they are set one by
  // one, each on its own page where its settings say so. Only when the author asks to turn the sheet itself ("Xoay luôn tờ giấy") are they
  // set together on turned sheets, whatever the settings of each.
  const appendixRegion = (list: PaperSection[], indexBase: number): string => {
    if (list.length === 0) return '';
    if (!appendixSettings.rotatePage) return `\n\\clearpage\n${renderSections(list, indexBase, false)}`;
    const inner = renderSections(list, indexBase, true);
    return (
      `\n\\clearpage\n\\ifdefined\\spwidegeometry\\spwidegeometry\\fi\n${isOneColumn ? '' : '\\onecolumn\n'}` +
      `\\begin{landscape}\n{\\setlength{\\linewidth}{\\dimexpr\\linewidth-1.6cm\\relax}\n${inner}\n}\n\\end{landscape}\n` +
      `\\clearpage\n\\ifdefined\\sptextgeometry\\sptextgeometry\\fi\n${isOneColumn ? '' : '\\twocolumn\n'}`
    );
  };
  bodyLatex = renderSections(arranged.bodyText) + appendixRegion(arranged.bodyGroup, arranged.bodyText.length);
  const appendixAfterRefs = appendixRegion(arranged.afterReferences, arranged.body.length);

  // a heading right before a table that has its own page(s) goes onto that page, not alone on the page before
  bodyLatex = bodyLatex.replace(
    /(\n\\phantomsection\\addcontentsline[^\n]*\n\\(?:sub)*section\*\n {2}\{\\textbf\{[^\n]*\}\}\n)(\n\\clearpage\n\\onecolumn\n)/g,
    '$2$1'
  );
  if (bodyLatex.includes('\\fiteq{')) bodyLatex = EQUATION_FIT_MACRO + bodyLatex;
  if (!bodyLatex.trim()) {
    bodyLatex = `\n\\section*{\\textbf{NỘI DUNG BẢN THẢO}}\nChưa có nội dung bài báo. Vui lòng thêm các đề mục, đoạn văn bản, bảng số liệu hoặc hình ảnh minh họa tại thẻ Nội dung.\n`;
  }

  // what is printed before a reference's DOI link: the journal's own habit unless the author chose another
  const doiLabel = settings.referenceDoi === 'available' ? 'Available from: ' : settings.referenceDoi === 'link' ? '' : tmpl.referenceDoiLabel ?? 'Available from: ';
  let bibLatex = '';
  if (references.length > 0) {
    const balanceCmd = layoutTracker.oneColumn || settings.balanceColumns === false ? '' : '\\beforepage{\\balance} \n\n';
    // polyglossia resets \refname to "References" at \begin{document}; set the printed heading here
    // long links and words may break at the column edge instead of running into the next column
    const bibBreaks = '\\sloppy\\emergencystretch=3em\\def\\UrlBreaks{\\do\\/\\do\\-\\do\\_\\do\\.\\do\\?\\do\\=\\do\\&\\do\\:\\do\\#\\do\\%\\do\\+\\do\\a\\do\\b\\do\\c\\do\\d\\do\\e\\do\\f}\\Urlmuskip=0mu plus 2mu\\hbadness=10000\\hfuzz=2pt ';
    bibLatex = `\n${balanceCmd}{\\sffamily\\fontsize{7}{8}\\selectfont ${bibBreaks}\n\n\\renewcommand{\\refname}{${labels.references}}\n\\begin{thebibliography}{10}\n\n` +
      references
        .map((r) => `\\bibitem{ref${r.id}}\n${referenceLatex(r, escapeLatex, doiLabel, { dash: rangeDashOn, showDoi: settings.referenceDoi !== 'none' })}`)
        .join('\n\n') +
      `\n\n\\end{thebibliography}\n}\n`;
  }

  // Closing summary page, like the printed journal: English after a Vietnamese paper, Vietnamese after an English one.
  const closingPage = !theme.englishSummaryPage
    ? null
    : en
      ? buildEnglishPage({
          titleEn: viTitle,
          abstractEn: viAbstract,
          keywordsEn: viKeywords,
          articleTypeEn: metadata.articleType || 'Bài nghiên cứu',
          authorsFormatted,
          citeAuthorsEn: escapeLatex(citeAuthors),
          qrBlock,
          affiliationsEnFormatted: affiliationsFormatted,
          corrName,
          corrAffEn: corrAff,
          corrEmail,
          isOneColumn,
          sideboxTemplate: OFFICIAL_SIDEBOX_TEMPLATE,
          preambleWithMaketitle: OFFICIAL_PREAMBLE_PART1 + OFFICIAL_PREAMBLE_PART2,
          buildAffbox,
          labels: VIETNAMESE_LABELS,
        })
      : hasEnglishPageContent({ titleEn: metadata.titleEn, abstractEn: metadata.abstractEn })
        ? buildEnglishPage({
            titleEn: metadata.titleEn || '',
            abstractEn: metadata.abstractEn || '',
            keywordsEn: cleanKw(metadata.keywordsEn),
            articleTypeEn: articleTypeEnglish(metadata),
            // the English page prints names without diacritics ("Vo Thi Nguyen")
            authorsFormatted: toAsciiName(authorsFormatted),
            citeAuthorsEn: escapeLatex(toAsciiName(citeAuthors)),
            qrBlock,
            affiliationsEnFormatted,
            corrName: toAsciiName(corrName),
            corrAffEn,
            corrEmail,
            isOneColumn,
            sideboxTemplate: OFFICIAL_SIDEBOX_TEMPLATE,
            preambleWithMaketitle: OFFICIAL_PREAMBLE_PART1 + OFFICIAL_PREAMBLE_PART2,
            buildAffbox,
          })
        : null;

  return `${preamblePart1}${metaBlock}${OFFICIAL_PREAMBLE_PART2}${titleBlock}${bodyLatex}${bibLatex}${layoutTracker.close()}${appendixAfterRefs}${closingPage ?? ''}\n\\end{document}\n`;
}

export const exportToLatex = generateFullJournalLatex;

export function generateBibTex(paper: CompletePaper): string {
  const { references } = paper;
  let bib = `% BibTeX database for ${paper.metadata.journalId || 'article'}\n\n`;

  references.forEach((ref) => {
    const authorStr = Array.isArray(ref.authors) ? ref.authors.join(' and ') : (ref.authors || 'Author');
    bib += `@article{ref${ref.id},
  title = {${escapeLatex(ref.title || ref.raw)}},
  author = {${escapeLatex(authorStr)}},
  year = {${ref.year || '2026'}},
  journal = {${escapeLatex(ref.journal || paper.metadata.journalName)}}
}\n\n`;
  });

  return bib;
}

export async function generateLatexPackageZip(paper: CompletePaper, customSettings?: LayoutSettings): Promise<Blob> {
  const zip = new JSZip();
  const folderName = paper.id || 'vnuhcm_latex_package';
  const folder = zip.folder(folderName) || zip;

  const imgFolder = folder.folder('images');
  const packedPaths = await appendFigureImagesToZip(imgFolder, paper.sections);
  const archivePaper = rewriteBlobFigureSrcsForArchive(paper, packedPaths);

  folder.file('document.tex', generateFullJournalLatex(archivePaper, customSettings));
  folder.file('references.bib', generateBibTex(archivePaper));

  return await zip.generateAsync({ type: 'blob' });
}
