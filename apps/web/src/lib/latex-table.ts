import type { PaperTable } from '@/types/paper';
import type { ResolvedTheme } from './theme-config';
import { escapeLatex } from './latex-escape';

import { stripCaptionLabel } from './docx-table-extras';
import { choosePlacement, estimateHeight, JOURNAL_GEOMETRY, measureTable } from './table-placement';
import { resolveBodyFill, rowIsTinted } from './table-fill';
import { DEFAULT_BORDER_WIDTH, rgbCsv, rowHeightOf, tableRulesOf } from './table-style';
import { stripMarkup } from './inline-markup';
import { sourceLinesOf, sourceLook } from './table-source';
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

  // a table whose author has not chosen one column, two or turned: its size decides
  const undecided = table.columnSpan === undefined && table.isFullWidth === undefined && table.isRotated === undefined;
  const auto = undecided ? choosePlacement(table) : undefined;
  const isRotated = auto ? auto.rotated : !!table.isRotated;
  const spansOneColumn = isOneColumn || (auto ? auto.columnSpan === '1-column' : table.columnSpan === '1-column' || table.isFullWidth === false);

  const fontSize = table.fontSize || auto?.fontSize || '8pt';
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
  const spanWidth = (col: number, span: number): string => {
    let w = 0;
    for (let k = col; k < Math.min(col + span, maxCols); k++) w += weights[k] ?? 0;
    return `\\dimexpr(\\linewidth-${2 * maxCols}\\tabcolsep)*${w}/${totalWeight}+${2 * (span - 1)}\\tabcolsep\\relax`;
  };
  const bodySpans = spanRenderer(maxCols, (c: any) => cellFill(c) + cellBody(c), 'l', rules, spanWidth);
  const tintRgb = rgbCsv(table.bodyTint);
  const tintCmd = tintRgb ? `\\rowcolor[RGB]{${tintRgb}}` : '\\rowcolor{tablezebracolor}';
  // a row can be given a least height: a strut as tall as asked starts its first cell
  // (the strut hangs below the baseline by half its height less the text's own half-height, so the text sits in the middle of the row)
  const strut = (h: number | undefined) => (h ? `\\rule[-${Math.max(0, h / 2 - parseFloat(fontSize) * 0.35).toFixed(1)}pt]{0pt}{${h}pt}` : '');
  const rowRule = rules.hInner ? ' \\hline' : '';
  // the table's top and bottom lines (with lines between rows, the last row's own line is the bottom one)
  const topRule = rules.top ? '\\hline ' : '';
  const bottomRule = rules.bottom && !rules.hInner ? '\\hline' : '';
  const renderRow = (row: any[], rI: number) =>
    `${rowIsTinted(fill, rI) ? tintCmd + '\n' : ''}${strut(rowHeightOf(table, rI))}${bodySpans(row)} \\\\${rowRule}`;

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
  const headSpans = spanRenderer(maxCols, (c: any) => cellFill(c) + `\\textbf{${escapeLatex(c?.text ?? '')}}`, 'c', rules, spanWidth);
  const headRgb = rgbCsv(table.headerFill);
  const headCmd = headRgb ? `\\rowcolor[RGB]{${headRgb}}` : '\\rowcolor{tableheadrcolor}';
  const headStrut = strut(table.headerHeight && table.headerHeight > 0 ? table.headerHeight : undefined);
  const headRule = rules.hInner ? ' \\hline' : '';
  const buildHeadRow = (): string =>
    table.headerRows && table.headerRows.length > 1
      ? table.headerRows.map((r) => `${headCmd}\n${headStrut}${headSpans(r)} \\\\${headRule}`).join('\n')
      : // as printed: the header band is grey with bold centred titles, and no rule between it and the body (the rules are above and below the table)
        `${headCmd}\n${headStrut}${headers.map((h) => `\\centering\\arraybackslash\\textbf{${escapeLatex(h)}}`).join(' & ')} \\\\${headRule}`;
  // an appendix says "Phụ lục 2 (tiếp theo)", not "Table 2 continued"
  const continuedTitle = table.appendix ? escapeLatex(`${appendixLabelText} ${(appendix ?? APPENDIX_WORDS).continued}`) : escapeLatex(theme.continuedTitleText.replace('{n}', String(table.num || '')));
  const continuedFoot = table.appendix ? escapeLatex((appendix ?? APPENDIX_WORDS).foot) : escapeLatex(theme.continuedFootText);
  // Column widths like a typeset journal table: the longest line of a column decides, softened by a square root so that a column of
  // short names still gets about a third of the width next to a column of long sentences (the printed tables are set that way).
  // A banner merged over several columns ("Điểm đánh giá … " over six) says nothing about one column's width: the leaf header row decides,
  // and merged cells are left out.
  const headerText = (c: number): string => stripMarkup(String(headers[c] ?? '')).split(' / ').pop() ?? "";
  const explicit = table.colWeights && table.colWeights.length === maxCols && table.colWeights.every((w) => w > 0) ? table.colWeights.map((w) => Math.max(1, Math.round(w * 100))) : null;
  const weights = explicit ?? headers.map((_h, c) => {
    const cells = [headerText(c), ...bodyRows.filter((r: any[]) => !(r[c]?.colSpan && r[c].colSpan > 1)).map((r) => stripMarkup(String(r[c]?.text ?? r[c] ?? '')))];
    const longestLine = Math.max(...cells.flatMap((t) => t.split(/\r?\n/).map((l) => l.length)), 1);
    const L = Math.min(110, Math.max(6, longestLine));
    // a label that fits on one line ("KCN Hiệp Phước GĐ1") gets the room to stay on it: grows linearly up to ~28 characters
    return Math.max(Math.round(Math.sqrt(L) * 10), L <= 28 ? Math.round(L * 3.2) : 0);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const headRow = buildHeadRow(); // (built once the column widths are known)
  // vertical lines: the first column owns the left edge, every column the line on its right
  const colSpec = weights
    .map((w, c) => {
      const left = c === 0 && rules.vOuter ? '|' : '';
      const right = c === maxCols - 1 ? (rules.vOuter ? '|' : '') : rules.vInner ? '|' : '';
      return `${left}>{\\raggedright\\arraybackslash}p{\\dimexpr(\\linewidth-${2 * maxCols}\\tabcolsep)*${w}/${totalWeight}\\relax}${right}`;
    })
    .join('');
  const ruleColor = rgbCsv(table.borderColor);
  const ruleWidth = table.borderWidth && table.borderWidth > 0 ? table.borderWidth : undefined;
  const ruleSetup =
    (ruleColor ? `\\arrayrulecolor[RGB]{${ruleColor}}` : '') +
    (ruleWidth !== undefined && ruleWidth !== DEFAULT_BORDER_WIDTH ? `\\setlength{\\arrayrulewidth}{${ruleWidth}pt}` : '');
  const sizeOpen = `{\\fontsize{${fontSize}}{${lineHeight}}\\selectfont\n\\def\\arraystretch{${arrayStretch}}${ruleSetup}`;

  const breakMode = table.breakAcrossPages ?? 'auto';
  // with "turn the page" on, a table set sideways always gets its own landscape page(s), however short
  // A float cannot be cut: a table taller than the room it has (a column, the page, or the page turned on its side) would run off the
  // page. Such a table is set so that it flows over as many pages as it needs, with its header repeated. Estimated from what it holds.
  const fontPt = parseFloat(fontSize) || 8;
  const room = isRotated
    ? { width: JOURNAL_GEOMETRY.sidewaysWidth, height: JOURNAL_GEOMETRY.sidewaysHeight }
    : { width: spansOneColumn ? JOURNAL_GEOMETRY.column : JOURNAL_GEOMETRY.page, height: JOURNAL_GEOMETRY.pageHeight * 0.85 };
  const tooTall = breakMode !== 'never' && estimateHeight(measureTable({ headers, rows: paddedRows, bodyRows: table.bodyRows }, fontPt), room.width, fontPt) > room.height;
  // (a table set "across the whole page" takes pages of its own, however short)
  const isLong = breakMode === 'always' || tooTall || table.sideColumn === 'full' || (breakMode === 'auto' && bodyRows.length > theme.longTableRowThreshold) || (isRotated && theme.rotateTablePage);

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
\\begin{longtable}{${colSpec}}
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
\\centering
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
 */
function spanRenderer(
  maxCols: number,
  fmt: (cell: any) => string,
  groupAlign: 'l' | 'c' = 'l',
  rules: { vInner: boolean; vOuter: boolean } = { vInner: false, vOuter: false },
  /** The width of the columns col .. col+span-1 together: a merged cell is a paragraph of that width, so its text wraps instead of running over its neighbours. */
  widthOf?: (col: number, span: number) => string
) {
  const core = (col: number, span: number, align: string) =>
    widthOf ? `>{${align === 'c' ? '\\centering' : align === 'r' ? '\\raggedleft' : '\\raggedright'}\\arraybackslash}p{${widthOf(col, span)}}` : align;
  // a merged cell takes the place of its columns' specs, so it carries their vertical lines itself
  const spec = (col: number, span: number, align: string) =>
    `${col === 0 && rules.vOuter ? '|' : ''}${core(col, span, align)}${col + span >= maxCols ? (rules.vOuter ? '|' : '') : rules.vInner ? '|' : ''}`;
  const cover: ({ left: number; span: number; text: string; rs: number } | undefined)[] = [];
  return (row: any[]): string => {
    const out: string[] = [];
    let col = 0;
    let k = 0;
    while (col < maxCols) {
      const cv = cover[col];
      if (cv && cv.left > 0) {
        cv.left--;
        // (a cell merged down is set in a box as wide as its columns, so a long title wraps)
        const body = cv.left === 0 ? (widthOf ? `\\multirow{-${cv.rs}}{${widthOf(col, cv.span)}}{\\centering\\arraybackslash ${cv.text}}` : `\\multirow{-${cv.rs}}{*}{${cv.text}}`) : '';
        out.push(cv.span > 1 ? `\\multicolumn{${cv.span}}{${spec(col, cv.span, 'c')}}{${body}}` : body);
        col += cv.span;
        continue;
      }
      const cell = row[k++];
      if (cell === undefined) {
        out.push('');
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
      // a single column is a paragraph column set to the left: a centred or right cell says so itself
      const single = align === 'c' ? `\\centering\\arraybackslash ${body}` : align === 'r' ? `\\raggedleft\\arraybackslash ${body}` : body;
      out.push(cs > 1 ? `\\multicolumn{${cs}}{${spec(col, cs, align)}}{${body}}` : single);
      col += cs;
    }
    return out.join(' & ');
  };
}
