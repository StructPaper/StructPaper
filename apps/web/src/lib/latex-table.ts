import type { PaperTable } from '@/types/paper';
import type { ResolvedTheme } from './theme-config';
import { escapeLatex } from './latex-escape';

import { stripCaptionLabel } from './docx-table-extras';
import { choosePlacement } from './table-placement';
import { resolveBodyFill, rowIsTinted } from './table-fill';
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
export function tableToLatex(
  table: PaperTable,
  { isOneColumn, theme }: { isOneColumn: boolean; theme: ResolvedTheme }
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
  const bodySpans = spanRenderer(maxCols, cellBody);
  const renderRow = (row: any[], rI: number) =>
    `${rowIsTinted(fill, rI) ? '\\rowcolor{tablezebracolor}\n' : ''}${bodySpans(row)} \\\\`;

  const sourceLine = table.source && table.source.trim()
    ? `\\par\\vspace{2pt}{\\footnotesize ${table.source
        .split('\n')
        .filter((l) => l.trim())
        // notes ("Chú thích: …") are italic, the "Nguồn: …" line is upright, like the printed journal
        .map((l) => (/^(chú thích|ghi chú|notes?)\s*:/i.test(l.trim()) ? `\\textit{${escapeLatex(l.trim())}}` : escapeLatex(l.trim())))
        .join('\\newline ')}}`
    : '';

  // the caption is as wide as the table and starts at its left edge (not centred in a narrower box), as in the printed journals
  const caption = `\\captionsetup{width=\\linewidth,justification=raggedright,singlelinecheck=false}\\caption{{\\textbf{${escapeLatex(stripCaptionLabel(table.caption))}}}}`;
  const label = `\\label{tab:${table.num || 1}}`;
  // Multi-row headers keep their merged cells ("Quan trắc" over 3 columns, "Dự báo" over 2 rows)
  const headSpans = spanRenderer(maxCols, (c: any) => `\\textbf{${escapeLatex(c?.text ?? '')}}`, 'c');
  const headRow =
    table.headerRows && table.headerRows.length > 1
      ? table.headerRows.map((r) => `\\rowcolor{tableheadrcolor}\n${headSpans(r)} \\\\`).join('\n')
      : // as printed: the header band is grey with bold centred titles, and no rule between it and the body (the rules are above and below the table)
        `\\rowcolor{tableheadrcolor}\n${headers.map((h) => `\\centering\\arraybackslash\\textbf{${escapeLatex(h)}}`).join(' & ')} \\\\`;
  const continuedTitle = escapeLatex(theme.continuedTitleText.replace('{n}', String(table.num || '')));
  const continuedFoot = escapeLatex(theme.continuedFootText);
  // Column widths like a typeset journal table: the longest line of a column decides, softened by a square root so that a column of
  // short names still gets about a third of the width next to a column of long sentences (the printed tables are set that way).
  // A banner merged over several columns ("Điểm đánh giá … " over six) says nothing about one column's width: the leaf header row decides,
  // and merged cells are left out.
  const headerText = (c: number): string => String(headers[c] ?? '').split(' / ').pop() ?? "";
  const weights = headers.map((_h, c) => {
    const cells = [headerText(c), ...bodyRows.filter((r: any[]) => !(r[c]?.colSpan && r[c].colSpan > 1)).map((r) => String(r[c]?.text ?? r[c] ?? ''))];
    const longestLine = Math.max(...cells.flatMap((t) => t.split(/\r?\n/).map((l) => l.length)), 1);
    const L = Math.min(110, Math.max(6, longestLine));
    // a label that fits on one line ("KCN Hiệp Phước GĐ1") gets the room to stay on it: grows linearly up to ~28 characters
    return Math.max(Math.round(Math.sqrt(L) * 10), L <= 28 ? Math.round(L * 3.2) : 0);
  });
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const colSpec = weights
    .map((w) => `>{\\raggedright\\arraybackslash}p{\\dimexpr(\\linewidth-${2 * maxCols}\\tabcolsep)*${w}/${totalWeight}\\relax}`)
    .join('');
  const sizeOpen = `{\\fontsize{${fontSize}}{${lineHeight}}\\selectfont\n\\def\\arraystretch{${arrayStretch}}`;

  const breakMode = table.breakAcrossPages ?? 'auto';
  // with "turn the page" on, a table set sideways always gets its own landscape page(s), however short
  const isLong = breakMode === 'always' || (breakMode === 'auto' && bodyRows.length > theme.longTableRowThreshold) || (isRotated && theme.rotateTablePage);

  // ---- long table, flowing inside one column ----
  if (isLong && spansOneColumn && !isRotated) {
    const contLine = `\\multicolumn{${maxCols}}{c}{\\textit{${continuedTitle}}}\\\\`;
    const repeat = theme.repeatTableHeader ? `\\tablehead{\\hline ${contLine}\n${headRow}}\n` : `\\tablehead{${contLine}}\n`;
    return `\n${sizeOpen}
\\topcaption{{\\textbf{${escapeLatex(stripCaptionLabel(table.caption))}}}${label}}
\\tablefirsthead{\\hline ${headRow}}
${repeat}\\tabletail{\\hline \\multicolumn{${maxCols}}{r}{\\textit{${continuedFoot}}}\\\\}
\\tablelasttail{\\hline}
\\begin{supertabular}{${colSpec}}
${bodyRows.map(renderRow).join('\n')}
\\end{supertabular}${sourceLine}}
\\par\\vspace{4pt}\n`;
  }

  // ---- long table over 2 columns and/or rotated: own page(s), full width ----
  if (isLong) {
    const leave = isOneColumn ? '' : '\\onecolumn\n';
    const back = isOneColumn ? '' : '\\twocolumn\n';
    const open = isRotated ? '\\begin{landscape}\n' : '';
    const close = isRotated ? '\\end{landscape}\n' : '';
    const contLine = `\\multicolumn{${maxCols}}{c}{\\textit{${continuedTitle}}}\\\\`;
    const endHead = theme.repeatTableHeader
      ? `\\hline ${contLine}\n${headRow}\n\\endhead`
      : `\\hline ${contLine}\n\\endhead`;
    return `\n\\clearpage
${leave}${open}${sizeOpen}
\\begin{longtable}{${colSpec}}
${caption}${label}\\\\
\\hline ${headRow}
\\endfirsthead
${endHead}
\\hline \\multicolumn{${maxCols}}{r}{\\textit{${continuedFoot}}}\\\\
\\endfoot
\\hline
\\endlastfoot
${bodyRows.map(renderRow).join('\n')}
\\end{longtable}${sourceLine}}
${close}\\clearpage
${back}`;
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
\\hline ${headRow}
${bodyRows.map(renderRow).join('\n')}
\\hline
\\end{tabular}${sourceLine}}
\\end{${tabEnv}}\n`;
}

/**
 * Renders rows of cells with colSpan/rowSpan on a fixed grid. A column covered by a cell spanning
 * down from a row above gets an empty slot; the text of a row-spanning cell is drawn in its last row
 * with a negative \multirow, so a later \rowcolor does not paint over it.
 */
function spanRenderer(maxCols: number, fmt: (cell: any) => string, groupAlign: 'l' | 'c' = 'l') {
  const cover: ({ left: number; span: number; text: string; rs: number } | undefined)[] = [];
  return (row: any[]): string => {
    const out: string[] = [];
    let col = 0;
    let k = 0;
    while (col < maxCols) {
      const cv = cover[col];
      if (cv && cv.left > 0) {
        cv.left--;
        const body = cv.left === 0 ? `\\multirow{-${cv.rs}}{*}{${cv.text}}` : '';
        out.push(cv.span > 1 ? `\\multicolumn{${cv.span}}{c}{${body}}` : body);
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
      out.push(cs > 1 ? `\\multicolumn{${cs}}{${align}}{${body}}` : body);
      col += cs;
    }
    return out.join(' & ');
  };
}
