import type { PaperTable } from '@/types/paper';
import type { ResolvedTheme } from './theme-config';
import { escapeLatex } from './latex-escape';

import { stripCaptionLabel } from './docx-table-extras';
import { columnWeights, planTable } from './table-plan';
import { resolveBodyFill, rowIsTinted } from './table-fill';
import { DEFAULT_BORDER_WIDTH, rgbCsv, rowHeightOf, tableRulesOf } from './table-style';
import { stripMarkup } from './inline-markup';
import { sourceLinesOf, sourceLook } from './table-source';
import { horizontalLine, rowValign, rowsOf, verticalLines } from './table-cell-lines';
/**
 * LaTeX for one table block. Layout is chosen from the table options:
 *
 *  | table is…                         | typeset as                                                    |
 *  | short                             | floating `table` / `table*` (1 or 2 columns)                  |
 *  | short + rotated                   | `sidewaystable(*)`                                            |
 *  | long + 1 column                   | `supertabular` flowing through the column(s)                  |
 *  | long + 2 columns, or long+rotated | own page(s): one-column `longtable` (landscape if rotated)    |
 *
 * Long tables repeat the header row on every page and show the "continued" markers used by the
 * journal ("Table N continued" on top, "Continued on next page" at the bottom).
 */
/** The words of an appendix table when the caller gives none (a Vietnamese paper). */
const APPENDIX_WORDS = { label: (n: number): string => `Phụ lục ${n}`, continued: "(tiếp theo)", foot: "Xem tiếp ở trang sau" };

export function tableToLatex(
  table: PaperTable,
  { isOneColumn, theme, inline = false, appendix }: { isOneColumn: boolean; theme: ResolvedTheme; /** The words of an appendix table: its label ("Phụ lục 2"), the "(tiếp theo)" on its next pages and the foot line. */ appendix?: { label: (n: number) => string; continued: string; foot: string }; /** Set in the flow of a page that is already turned and as wide as it can be (an appendix page): no float, no page of its own. */ inline?: boolean }
): string {
  const rawHeaders = table.headers && table.headers.length > 0 ? table.headers : ['Cột 1'];
  const rawRows = table.rows || [];
  const maxCols = Math.max(rawHeaders.length, ...rawRows.map((r) => r.length), 1);
  const headers = Array(maxCols).fill('').map((_, idx) => rawHeaders[idx] || '');
  const paddedRows = rawRows.map((row) => Array(maxCols).fill('').map((_, idx) => row[idx] || ''));

  // where the table goes and how it is set: the decision the paper view of the table takes too (lib/table-plan)
  const plan = planTable(table, theme, { isOneColumn, inline });
  const { isRotated, spansOneColumn, fontSize } = plan;
  // line spacing grows with the type: 8 pt -> 10 pt, 9 pt -> 11 pt, 10 pt -> 12 pt
  const lineHeight = `${Math.round((parseFloat(fontSize) + 2) * 2) / 2}pt`;
  const arrayStretch = table.rowStretch || 1.2;
  const fill = resolveBodyFill(table);

  const bodyRows = table.bodyRows && table.bodyRows.length > 0
    ? table.bodyRows
    : paddedRows.map((r) => r.map((c) => ({ text: c })));

  const cellBody = (cell: any): string => {
    const rawText = cell?.text !== undefined ? cell.text : String(cell || '');
    let escaped = escapeLatex(rawText);
    escaped = escaped.replace(/•/g, '$\\bullet$~');
    escaped = escaped.replace(/\r?\n/g, ' \\newline ');
    // citations inside cells ("Ho [36,6]") become superscript natbib citations, as in the paragraphs
    escaped = escaped.replace(/\s*\[(\d+(?:\s*,\s*\d+)*)\]/g, (_m, nums: string) => `\\unskip\\cite{${nums.split(',').map((n) => `ref${n.trim()}`).join(',')}}`);
    return escaped;
  };
  const rules = tableRulesOf(table);
  const cellFill = (c: any): string => {
    const rgb = rgbCsv(c?.fill);
    return rgb ? `\\cellcolor[RGB]{${rgb}}` : '';
  };
  // width of columns col .. col+span-1 together, from the column weights (set below, before any row is drawn)
  // the width the columns share: the room of the table, or the part of it the author chose (a table narrower than the column)
  const lw = table.widthPercent && table.widthPercent > 0 && table.widthPercent < 100 ? `${(table.widthPercent / 100).toFixed(3)}\\linewidth` : '\\linewidth';
  const spanWidth = (col: number, span: number): string => {
    let w = 0;
    for (let k = col; k < Math.min(col + span, maxCols); k++) w += weights[k] ?? 0;
    return `\\dimexpr(${lw}-${2 * maxCols}\\tabcolsep)*${w}/${totalWeight}+${2 * (span - 1)}\\tabcolsep\\relax`;
  };
  const headCount = rowsOf(table).head;
  const bodySpans = spanRenderer(maxCols, (c: any) => cellFill(c) + cellBody(c), 'l', rules, spanWidth, (r) => verticalLines(table, rules, r, maxCols));
  const tintRgb = rgbCsv(table.bodyTint);
  const tintCmd = tintRgb ? `\\rowcolor[RGB]{${tintRgb}}` : '\\rowcolor{tablezebracolor}';
  // a row can be given a least height: a strut as tall as asked starts its first cell
  // (the strut hangs below the baseline by half its height less the text's own half-height, so the text sits in the middle of the row)
  const strut = (h: number | undefined) => (h ? `\\rule[-${Math.max(0, h / 2 - parseFloat(fontSize) * 0.35).toFixed(1)}pt]{0pt}{${h}pt}` : '');
  // the lines between rows: the table's style, unless a cell has said something about the line (see lib/table-cell-lines)
  const totalRows = rowsOf(table).rows.length;
  const ruleText = (lines: boolean[]): string => {
    if (lines.every(Boolean)) return '\\hline';
    const runs: string[] = [];
    for (let c = 0; c < lines.length; ) {
      if (!lines[c]) { c++; continue; }
      let e = c;
      while (e + 1 < lines.length && lines[e + 1]) e++;
      runs.push(`\\cline{${c + 1}-${e + 1}}`);
      c = e + 1;
    }
    return runs.join('');
  };
  const afterRow = (b: number): string => {
    const h = horizontalLine(table, rules, b, maxCols);
    if (!h.explicit) return rules.hInner ? ' \\hline' : '';
    const t = ruleText(h.lines);
    return t ? ` ${t}` : '';
  };
  const topLine = horizontalLine(table, rules, 0, maxCols);
  const bottomLine = horizontalLine(table, rules, totalRows, maxCols);
  // the table's top and bottom lines (with lines between rows, the last row's own line is the bottom one)
  const topRule = topLine.explicit ? (ruleText(topLine.lines) ? `${ruleText(topLine.lines)} ` : '') : rules.top ? '\\hline ' : '';
  const bottomRule = !bottomLine.explicit && rules.bottom && !rules.hInner ? '\\hline' : '';
  const renderRow = (row: any[], rI: number) =>
    `${rowIsTinted(fill, rI) ? tintCmd + '\n' : ''}${strut(rowHeightOf(table, rI))}${bodySpans(row, headCount + rI)} \\\\${afterRow(headCount + rI + 1)}`;

  // what is printed under the table: a note ("Chú thích: …") in italic and a source ("Nguồn: …") upright, both to the left, as the
  // printed journal sets them, unless the author chose bold, italic or an alignment for the block (see lib/table-source)
  const srcLines = sourceLinesOf(table.source);
  const srcAlign = srcLines.length > 0 ? sourceLook(table.sourceStyle, srcLines[0]).align : 'left';
  const sourceLine = srcLines.length > 0
    ? `\\par\\vspace{2pt}{\\footnotesize ${srcAlign === 'center' ? '\\centering' : srcAlign === 'right' ? '\\raggedleft' : '\\raggedright'} ${srcLines
        .map((l) => {
          const look = sourceLook(table.sourceStyle, l);
          let t = escapeLatex(l);
          if (look.italic) t = `\\textit{${t}}`;
          if (look.bold) t = `\\textbf{${t}}`;
          return t;
        })
        // (a line break by "\\", not "\newline": after "\newline" a right-aligned or centred line is pushed off its edge by the fill it adds)
        .join(' \\\\ ')}\\par}`
    : '';

  // the caption is as wide as the table and starts at its left edge (not centred in a narrower box), as in the printed journals
  // an appendix table is numbered on its own ("Phụ lục 2."), apart from the table counter of the text: its caption has no label of the counter
  // (the label is set as the journal sets "Bảng 1": bold, sans, in the title colour; then the title)
  const appendixLabelText = table.appendix ? (appendix ?? APPENDIX_WORDS).label(table.num) : '';
  const capText = table.appendix ? `{\\sffamily\\bfseries\\color{titlecolor}${escapeLatex(appendixLabelText)}.}\\ \\textbf{${escapeLatex(stripCaptionLabel(table.caption))}}` : `\\textbf{${escapeLatex(stripCaptionLabel(table.caption))}}`;
  const caption = `\\captionsetup{width=\\linewidth,justification=raggedright,singlelinecheck=false,font={small,sf,bf}}\\caption${table.appendix ? '*' : ''}{{${capText}}}`;
  const label = table.appendix ? '' : `\\label{tab:${table.num || 1}}`;
  // Multi-row headers keep their merged cells ("Quan trắc" over 3 columns, "Dự báo" over 2 rows)
  const headSpans = spanRenderer(maxCols, (c: any) => cellFill(c) + `\\textbf{${escapeLatex(c?.text ?? '')}}`, 'c', rules, spanWidth, (r) => verticalLines(table, rules, r, maxCols));
  const headRgb = rgbCsv(table.headerFill);
  const headCmd = headRgb ? `\\rowcolor[RGB]{${headRgb}}` : '\\rowcolor{tableheadrcolor}';
  const headStrut = strut(table.headerHeight && table.headerHeight > 0 ? table.headerHeight : undefined);
  // a head of one row is set from its titles; when its cells say more (a fill, a line, a merge, a vertical alignment) from its cells
  const styledHead = !!table.headerRows && table.headerRows.length === 1 && table.headerRows[0].some((c) => c.fill || c.borders || c.valign || (c.colSpan ?? 1) > 1);
  const buildHeadRow = (): string =>
    table.headerRows && (table.headerRows.length > 1 || styledHead)
      ? table.headerRows.map((r, i) => `${headCmd}\n${headStrut}${headSpans(r, i)} \\\\${afterRow(i + 1)}`).join('\n')
      : // as printed: the header band is grey with bold centred titles, and no rule between it and the body (the rules are above and below the table)
        `${headCmd}\n${headStrut}${headers.map((h) => `\\centering\\arraybackslash\\textbf{${escapeLatex(h)}}`).join(' & ')} \\\\${afterRow(1)}`;
  // an appendix says "Phụ lục 2 (tiếp theo)", not "Table 2 continued"
  const continuedTitle = table.appendix ? escapeLatex(`${appendixLabelText} ${(appendix ?? APPENDIX_WORDS).continued}`) : escapeLatex(theme.continuedTitleText.replace('{n}', String(table.num || '')));
  const continuedFoot = table.appendix ? escapeLatex((appendix ?? APPENDIX_WORDS).foot) : escapeLatex(theme.continuedFootText);
  // Column widths like a typeset journal table: the longest line of a column decides, softened by a square root so that a column of
  // short names still gets about a third of the width next to a column of long sentences (the printed tables are set that way).
  // A banner merged over several columns ("Điểm đánh giá … " over six) says nothing about one column's width: the leaf header row decides,
  // and merged cells are left out.
  const weights = columnWeights(table, headers, bodyRows);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const headRow = buildHeadRow(); // (built once the column widths are known)
  // vertical lines: the first column owns the left edge, every column the line on its right
  const colSpec = weights
    .map((w, c) => {
      const left = c === 0 && rules.vOuter ? '|' : '';
      const right = c === maxCols - 1 ? (rules.vOuter ? '|' : '') : rules.vInner ? '|' : '';
      return `${left}>{\\raggedright\\arraybackslash}p{\\dimexpr(${lw}-${2 * maxCols}\\tabcolsep)*${w}/${totalWeight}\\relax}${right}`;
    })
    .join('');
  const ruleColor = rgbCsv(table.borderColor);
  const ruleWidth = table.borderWidth && table.borderWidth > 0 ? table.borderWidth : undefined;
  const ruleSetup =
    (ruleColor ? `\\arrayrulecolor[RGB]{${ruleColor}}` : '') +
    (ruleWidth !== undefined && ruleWidth !== DEFAULT_BORDER_WIDTH ? `\\setlength{\\arrayrulewidth}{${ruleWidth}pt}` : '');
  const sizeOpen = `{\\fontsize{${fontSize}}{${lineHeight}}\\selectfont\n\\def\\arraystretch{${arrayStretch}}${ruleSetup}`;

  const { isLong } = plan;

  // ---- long table, flowing inside one column ----
  if (isLong && spansOneColumn && !isRotated && !inline) {
    const contLine = `\\multicolumn{${maxCols}}{c}{\\textit{${continuedTitle}}}\\\\`;
    const repeat = theme.repeatTableHeader ? `\\tablehead{\\hline ${contLine}\n${headRow}}\n` : `\\tablehead{${contLine}}\n`;
    return `\n${sizeOpen}
${table.appendix ? `\\captionof*{table}{{${capText}}}` : `\\topcaption{{${capText}}${label}}`}
\\tablefirsthead{${topRule}${headRow}}
${repeat}\\tabletail{\\hline \\multicolumn{${maxCols}}{r}{\\textit{${continuedFoot}}}\\\\}
\\tablelasttail{${bottomRule}}
\\begin{supertabular}{${colSpec}}
${bodyRows.map(renderRow).join('\n')}
\\end{supertabular}${sourceLine}}
\\par\\vspace{4pt}\n`;
  }

  // ---- long table over 2 columns and/or rotated: own page(s), full width ----
  if (isLong || inline) {
    // on pages of its own a large table takes the whole width of the page, over the side column (as the printed journal's appendix tables
    // do), unless the author keeps it in the text; a table turned on its side keeps the text area
    const wide = !inline && (table.sideColumn === 'full' || (table.sideColumn !== 'text' && !spansOneColumn));
    const leave = inline ? "" : (wide ? '\\ifdefined\\spwidegeometry\\spwidegeometry\\fi\n' : '') + (isOneColumn ? '' : '\\onecolumn\n');
    // (the text area is put back first, so the two columns are measured from it)
    const back = inline ? "" : (wide ? '\\ifdefined\\sptextgeometry\\sptextgeometry\\fi\n' : '') + (isOneColumn ? '' : '\\twocolumn\n');
    const open = isRotated && !inline ? '\\begin{landscape}\n' : '';
    const close = isRotated && !inline ? '\\end{landscape}\n' : '';
    const contLine = `\\multicolumn{${maxCols}}{c}{\\textit{${continuedTitle}}}\\\\`;
    const endHead = theme.repeatTableHeader
      ? `\\hline ${contLine}\n${headRow}\n\\endhead`
      : `\\hline ${contLine}\n\\endhead`;
    const page = inline ? '' : '\\clearpage\n';
    return `\n${page}${leave}${open}${sizeOpen}${isRotated && !inline ? '\n% on the turned page the table keeps clear of the running head and the foot\n\\setlength{\\linewidth}{\\dimexpr\\linewidth-1.6cm\\relax}' : ''}
\\begin{longtable}${table.tableAlign === 'left' ? '[l]' : table.tableAlign === 'right' ? '[r]' : ''}{${colSpec}}
${caption}${label}\\\\
${topRule}${headRow}
\\endfirsthead
${endHead}
\\hline \\multicolumn{${maxCols}}{r}{\\textit{${continuedFoot}}}\\\\
\\endfoot
${bottomRule}
\\endlastfoot
${bodyRows.map(renderRow).join('\n')}
\\end{longtable}${sourceLine}}
${close}${page}${back}`;
  }

  // ---- short table: floating, kept together ----
  const tabEnv = isRotated
    ? (spansOneColumn ? 'sidewaystable' : 'sidewaystable*')
    : (spansOneColumn ? 'table' : 'table*');

  let placement = '!htbp';
  if (table.placement === 'top') placement = 't';
  else if (table.placement === 'here') placement = '!h';
  else if (table.placement === 'bottom') placement = 'b';

  return `\n\\begin{${tabEnv}}[${placement}]
${caption}
${label}
${table.tableAlign === 'left' ? '\\raggedright' : table.tableAlign === 'right' ? '\\raggedleft' : '\\centering'}
${sizeOpen}
\\begin{tabular}{${colSpec}}
${topRule}${headRow}
${bodyRows.map(renderRow).join('\n')}
${bottomRule}
\\end{tabular}${sourceLine}}
\\end{${tabEnv}}\n`;
}

/**
 * Renders rows of cells with colSpan/rowSpan on a fixed grid. A column covered by a cell spanning
 * down from a row above gets an empty slot; the text of a row-spanning cell is drawn in its last row
 * with a negative \multirow, so a later \rowcolor does not paint over it.
 *
 * A row whose cells have a say in their own lines or in where their text stands (the "vl" it is given and the cells' valign) is drawn
 * cell by cell, each with the column spec of its own; the other rows keep the columns' specs of the table.
 */
function spanRenderer(
  maxCols: number,
  fmt: (cell: any) => string,
  groupAlign: 'l' | 'c' = 'l',
  rules: { vInner: boolean; vOuter: boolean } = { vInner: false, vOuter: false },
  /** The width of the columns col .. col+span-1 together: a merged cell is a paragraph of that width, so its text wraps instead of running over its neighbours. */
  widthOf?: (col: number, span: number) => string,
  /** The vertical lines of a row (boundary k is left of column k), and whether any cell has said something about them. */
  vl?: (rowIndex: number) => { lines: boolean[]; explicit: boolean }
) {
  const core = (col: number, span: number, align: string, kind: 'p' | 'm' | 'b' = 'p') =>
    widthOf ? `>{${align === 'c' ? '\\centering' : align === 'r' ? '\\raggedleft' : '\\raggedright'}\\arraybackslash}${kind}{${widthOf(col, span)}}` : align;
  const cover: ({ left: number; span: number; text: string; rs: number } | undefined)[] = [];
  return (row: any[], rowIndex = -1): string => {
    const lines = vl && rowIndex >= 0 ? vl(rowIndex) : undefined;
    // where the text stands is a thing of the row (see rowValign): the cells that say nothing take the row's
    const rowV = widthOf ? rowValign(row) : 'top';
    const aligned = rowV !== 'top';
    const own = !!lines && (lines.explicit || aligned);
    // a merged cell takes the place of its columns' specs, so it carries their vertical lines itself
    const spec = (col: number, span: number, align: string, kind: 'p' | 'm' | 'b' = 'p') => {
      const left = own ? col === 0 && lines!.lines[0] : col === 0 && rules.vOuter;
      const right = own ? lines!.lines[col + span] : col + span >= maxCols ? rules.vOuter : rules.vInner;
      return `${left ? '|' : ''}${core(col, span, align, kind)}${right ? '|' : ''}`;
    };
    const out: string[] = [];
    let col = 0;
    let k = 0;
    while (col < maxCols) {
      const cv = cover[col];
      if (cv && cv.left > 0) {
        cv.left--;
        // (a cell merged down is set in a box as wide as its columns, so a long title wraps)
        const body = cv.left === 0 ? (widthOf ? `\\multirow{-${cv.rs}}{${widthOf(col, cv.span)}}{\\centering\\arraybackslash ${cv.text}}` : `\\multirow{-${cv.rs}}{*}{${cv.text}}`) : '';
        out.push(cv.span > 1 || own ? `\\multicolumn{${cv.span}}{${spec(col, cv.span, 'c')}}{${body}}` : body);
        col += cv.span;
        continue;
      }
      const cell = row[k++];
      if (cell === undefined) {
        out.push(own ? `\\multicolumn{1}{${spec(col, 1, 'l')}}{}` : '');
        col++;
        continue;
      }
      const cs = Math.max(1, Math.min(cell?.colSpan ?? 1, maxCols - col));
      const rs = cell?.rowSpan ?? 1;
      let body = fmt(cell);
      if (rs > 1) {
        cover[col] = { left: rs - 1, span: cs, text: body, rs };
        body = '';
      }
      const align = cell?.align === 'center' || rs > 1 ? 'c' : cell?.align === 'right' ? 'r' : cell?.align === 'left' ? 'l' : groupAlign;
      // where the text stands in a tall row: a middle or bottom aligned paragraph column (the array package's m and b)
      const v = cell?.valign ?? rowV;
      const kind: 'p' | 'm' | 'b' = widthOf && v === 'middle' ? 'm' : widthOf && v === 'bottom' ? 'b' : 'p';
      // a single column is a paragraph column set to the left: a centred or right cell says so itself
      const single = align === 'c' ? `\\centering\\arraybackslash ${body}` : align === 'r' ? `\\raggedleft\\arraybackslash ${body}` : body;
      out.push(cs > 1 || own || kind !== 'p' ? `\\multicolumn{${cs}}{${spec(col, cs, align, kind)}}{${body}}` : single);
      col += cs;
    }
    return out.join(' & ');
  };
}
