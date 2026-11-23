import { PaperTable, TableCell, synthesizeHeaderRows, normalizePaperTable } from '@/types/paper';
import type { Cell } from '@structpaper/doc-model';
import { parseMarkup } from '@/lib/inline-markup';

export interface SheetCell {
  text: string;
  colSpan?: number;
  rowSpan?: number;
  mergedInto?: { r: number; c: number };
  align?: 'left' | 'center' | 'right' | 'justify';
  /** Header marker: header cells are bold and decide where the header rows end (not an emphasis the author chose). */
  bold?: boolean;
  italic?: boolean;
  /** Emphasis chosen by the author for the whole cell. */
  strong?: boolean;
  underline?: boolean;
  /** Text colour "#RRGGBB". */
  color?: string;
  /** Background "#RRGGBB". */
  fill?: string;
}

/**
 * The text of a table cell as the sheet shows it: when the whole text has one emphasis, it becomes flags (the sheet draws them) and the
 * tags are taken off the text; text with mixed emphasis keeps its tags.
 */
export function unpackCellText(raw: string): Pick<SheetCell, 'text' | 'strong' | 'italic' | 'underline' | 'color'> {
  const segs = parseMarkup(raw || '');
  if (segs.length === 0) return { text: raw || '' };
  const first = segs[0];
  const uniform = segs.every((s) => !!s.b === !!first.b && !!s.i === !!first.i && !!s.u === !!first.u && (s.color ?? '') === (first.color ?? ''));
  if (!uniform || (!first.b && !first.i && !first.u && !first.color)) return { text: raw || '' };
  return {
    text: segs.map((s) => s.text).join(''),
    ...(first.b ? { strong: true } : {}),
    ...(first.i ? { italic: true } : {}),
    ...(first.u ? { underline: true } : {}),
    ...(first.color ? { color: first.color } : {}),
  };
}

/** The sheet cell's text with its emphasis written back as tags (what the model stores). */
export function packCellText(cell: SheetCell): string {
  let t = cell.text ?? '';
  if (!t) return t;
  if (cell.underline) t = `<u>${t}</u>`;
  if (cell.italic) t = `<i>${t}</i>`;
  if (cell.strong) t = `<b>${t}</b>`;
  if (cell.color) t = `<color=${cell.color}>${t}</color>`;
  return t;
}

// Convert column index 0 -> 'A', 1 -> 'B', 25 -> 'Z', 26 -> 'AA'
export function getExcelColLetter(index: number): string {
  let letter = '';
  let temp = index;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function cloneMatrix(mat: SheetCell[][]): SheetCell[][] {
  return mat.map((row) =>
    row.map((cell) => ({
      ...cell,
      mergedInto: cell.mergedInto ? { ...cell.mergedInto } : undefined,
    }))
  );
}

// Initialize sheet matrix from doc-model Cell[][]
export function initMatrixFromDocModelGrid(grid: Cell[][]): SheetCell[][] {
  if (!grid || grid.length === 0) return [];
  const maxCols = Math.max(...grid.map((r) => r.length), 1);
  const fullMatrix: SheetCell[][] = grid.map((row) => {
    return Array(maxCols)
      .fill(null)
      .map((_, cIdx): SheetCell => {
        const cell = row[cIdx];
        if (!cell) {
          return { text: '', align: 'left' };
        }
        const text = cell.content
          ? cell.content
              .map((c) => (c.t === 'text' ? c.v : ''))
              .join('')
          : '';
        const marks =
          cell.content?.flatMap((c) =>
            c.t === 'text' ? c.marks || [] : []
          ) || [];
        return {
          text,
          colSpan: cell.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined,
          rowSpan: cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined,
          align:
            cell.align === 'c'
              ? 'center'
              : cell.align === 'r'
              ? 'right'
              : 'left',
          bold: cell.header || marks.includes('b'),
          italic: marks.includes('i'),
        };
      });
  });

  // Compute mergedInto flags
  for (let r = 0; r < fullMatrix.length; r++) {
    for (let c = 0; c < fullMatrix[r].length; c++) {
      const cell = fullMatrix[r][c];
      const rs = cell.rowSpan || 1;
      const cs = cell.colSpan || 1;
      if (rs > 1 || cs > 1) {
        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (fullMatrix[r + dr]?.[c + dc]) {
              fullMatrix[r + dr][c + dc].mergedInto = { r, c };
            }
          }
        }
      }
    }
  }

  return fullMatrix;
}

// Initialize sheet matrix from legacy PaperTable
export function initMatrixFromTable(t: PaperTable): SheetCell[][] {
  const norm = normalizePaperTable(t);
  const headers = norm.headers && norm.headers.length > 0 ? norm.headers : ['Cột 1'];
  const maxCols = Math.max(
    headers.length,
    ...(norm.rows || []).map((r) => r.length),
    1
  );

  let initialRows: SheetCell[][] = [];

  if (norm.headerRows && norm.headerRows.length > 0) {
    for (const hRow of norm.headerRows) {
      const rowArr: SheetCell[] = [];
      for (const cell of hRow) {
        rowArr.push({
          ...unpackCellText(cell.text || ''),
          colSpan: cell.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined,
          rowSpan: cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined,
          align: cell.align || 'center',
          bold: true,
          ...(cell.fill ? { fill: cell.fill } : {}),
        });
      }
      while (rowArr.length < maxCols) {
        rowArr.push({ text: '', align: 'center', bold: true });
      }
      initialRows.push(rowArr);
    }
  } else {
    const singleHeaderRow: SheetCell[] = headers.map((h) => ({
      ...unpackCellText(h || ''),
      align: 'center',
      bold: true,
    }));
    while (singleHeaderRow.length < maxCols) {
      singleHeaderRow.push({ text: '', align: 'center', bold: true });
    }
    initialRows.push(singleHeaderRow);
  }

  if (norm.bodyRows && norm.bodyRows.length > 0) {
    for (const bRow of norm.bodyRows) {
      const rowArr: SheetCell[] = [];
      for (const cell of bRow) {
        rowArr.push({
          ...unpackCellText(cell.text || ''),
          colSpan: cell.colSpan && cell.colSpan > 1 ? cell.colSpan : undefined,
          rowSpan: cell.rowSpan && cell.rowSpan > 1 ? cell.rowSpan : undefined,
          align: cell.align || 'left',
          bold: cell.isHeader || false,
          ...(cell.fill ? { fill: cell.fill } : {}),
        });
      }
      while (rowArr.length < maxCols) {
        rowArr.push({ text: '', align: 'left' });
      }
      initialRows.push(rowArr);
    }
  } else if (norm.rows && norm.rows.length > 0) {
    for (const r of norm.rows) {
      const rowArr: SheetCell[] = r.map((cellText) => ({
        ...unpackCellText(cellText || ''),
        align: 'left',
      }));
      while (rowArr.length < maxCols) {
        rowArr.push({ text: '', align: 'left' });
      }
      initialRows.push(rowArr);
    }
  } else {
    initialRows.push(Array(maxCols).fill(null).map(() => ({ text: '', align: 'left' })));
  }

  // Populate mergedInto pointers
  for (let r = 0; r < initialRows.length; r++) {
    for (let c = 0; c < initialRows[r].length; c++) {
      const cell = initialRows[r][c];
      const rs = cell.rowSpan || 1;
      const cs = cell.colSpan || 1;
      if (rs > 1 || cs > 1) {
        for (let dr = 0; dr < rs; dr++) {
          for (let dc = 0; dc < cs; dc++) {
            if (dr === 0 && dc === 0) continue;
            if (initialRows[r + dr]?.[c + dc]) {
              initialRows[r + dr][c + dc].mergedInto = { r, c };
            }
          }
        }
      }
    }
  }

  return initialRows;
}

// Convert sheet matrix to doc-model Cell[][]
export function matrixToDocModelGrid(matrix: SheetCell[][]): Cell[][] {
  return matrix.map((row, rIdx) =>
    row
      .filter((cell) => !cell.mergedInto)
      .map((cell) => {
        const marks: ('b' | 'i')[] = [];
        if (cell.bold || cell.strong) marks.push('b');
        if (cell.italic) marks.push('i');
        return {
          content: [{ t: 'text' as const, v: cell.text, marks: marks.length > 0 ? marks : undefined }],
          rowSpan: cell.rowSpan || 1,
          colSpan: cell.colSpan || 1,
          align: cell.align === 'center' ? ('c' as const) : cell.align === 'right' ? ('r' as const) : ('l' as const),
          header: rIdx === 0 || !!cell.bold,
        };
      })
  );
}

// Convert sheet matrix back to legacy PaperTable fields
export function matrixToPaperTableData(matrix: SheetCell[][]): {
  headers: string[];
  rows: string[][];
  headerRows: TableCell[][];
  bodyRows: TableCell[][];
} {
  const headerRowsCount = matrix.findIndex((r) => r.some((c) => !c.bold && c.text.trim() !== ''));
  const actualHeaderRowsCount = headerRowsCount <= 0 ? 1 : headerRowsCount;

  const headers: string[] = matrix[0] ? matrix[0].map((c) => packCellText(c)) : [];
  const rows: string[][] = matrix.slice(actualHeaderRowsCount).map((r) => r.map((c) => packCellText(c)));

  const bodyRows: TableCell[][] = matrix.slice(actualHeaderRowsCount).map((r) =>
    r
      .filter((c) => !c.mergedInto)
      .map((c) => ({
        text: packCellText(c),
        colSpan: c.colSpan,
        rowSpan: c.rowSpan,
        align: c.align,
        isHeader: c.bold,
        ...(c.fill ? { fill: c.fill } : {}),
      }))
  );

  const headerRows: TableCell[][] = actualHeaderRowsCount > 1
    ? matrix.slice(0, actualHeaderRowsCount).map((r) =>
        r
          .filter((c) => !c.mergedInto)
          .map((c) => ({
            text: packCellText(c),
            colSpan: c.colSpan,
            rowSpan: c.rowSpan,
            align: c.align,
            isHeader: true,
            ...(c.fill ? { fill: c.fill } : {}),
          }))
      )
    : synthesizeHeaderRows(headers);

  return { headers, rows, headerRows, bodyRows };
}
