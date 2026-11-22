import mammoth from 'mammoth';
import { ommlToLatex } from './omml';
import { extractDisplayEquations, insertEquations, isWhereDefinitionLine } from './docx-equations';
import { attachTableFooterLine, placeLeftoverTable, placeAbbreviationTable, landscapeResolver, applyTableLayoutHints } from './docx-table-extras';
import { mergeBilingualAffiliations } from './docx-affiliations';
import { findEnglishBackMatter, splitKeywords } from './docx-english-backmatter';
import { identifyJournal } from './journal-identify';
import { detectPrimaryLanguage, findVietnameseBackMatter, foldVietnamese } from './docx-language';
import { findArticleTypePreset } from './article-types';
import { emphasiseText, enrichScriptRuns } from './docx-richtext';
import { parseMarkup, serializeMarkup, stripMarkup } from './inline-markup';
import { loadFigureImages } from './docx-figure-images';
import { figureCaptionNumber } from './docx-figures';
import { figureTableInfo, figureTableAsCaptionParagraph, stripGuideParagraphs } from './docx-figure-tables';
import { extractListHeadings, extractListItems, isNoneMark } from './docx-headings';
import { articleIdFromFileName } from './publication';
import { normalizeImportedTitle } from './title-case';
import { prepareDocx } from './docx-prepare';
import { splitReferenceDoi } from './reference-format';
import JSZip from 'jszip';
import { Author, Affiliation, PaperSection, PaperReference, PreflightCheck, StructuralIssue, CompletePaper, PaperMetadata, TableCell } from '@/types/paper';
import { findJournalTemplate, getJournalTemplate } from './templates';
import { datesInLine } from './editorial-dates';

/**
 * Decode XML entities
 */
export function decodeXml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Clean EndNote binary/XML blocks and field codes
 */
export function cleanEndNoteText(str: string): string {
  if (!str) return '';
  let cleaned = str.replace(/ADDIN\s+EN\.CITE\s+[A-Za-z0-9+/=\s<>]+(?=\[\d+\]|\[\d+-\d+\]|\b)/gi, ' ');
  cleaned = cleaned.replace(/[A-Za-z0-9+/=]{40,}/g, '');
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize Vietnamese spaced letters in a NAME (e.g. "Nguy ễ n" -> "Nguyễn", "H ù ng" -> "Hùng").
 * Only a lone accented letter that sits between word fragments is joined; whole words such as "mức độ" or "KCN ở TPHCM" are left alone.
 */
export function normalizeVietnameseWordSpacing(name: string): string {
  if (!name) return '';
  let s = name;
  // "Nguy ễ n": fragment, lone accented letter, then a 1-2 letter fragment: one word
  s = s.replace(/(\p{L}+)\s+([à-ỹ])\s+(\p{L}{1,2})(?!\p{L})/gu, '$1$2$3');
  // "Hu ể" at the end of the name
  s = s.replace(/(\p{L}+)\s+([à-ỹ])(?!\p{L})\s*$/u, '$1$2');
  return s.replace(/\s+/g, ' ').trim();
}

export { ommlToLatex };

/**
 * The journal a manuscript says it belongs to (DOI prefix, ISSN, printed name or header line).
 * Subject words do not count: when nothing explicit is stated the generic journal is returned, and
 * the template step lets the user pick (or leaves it automatic).
 */
export function detectJournalFromContent(
  textSnippet: string,
  fileName?: string
): { journalId: string; journalName: string; journalAbbv: string } {
  const id = identifyJournal(textSnippet, fileName) ?? 'VNUHCM-STDJ';
  const template = findJournalTemplate(id) ?? getJournalTemplate('VNUHCM-STDJ');
  return { journalId: id, journalName: template.name, journalAbbv: template.shortName };
}

/**
 * The text of a table cell with <b>/<i> around its bold and italic runs; undefined when nothing in it is emphasised (or when the
 * tags would change what the cell says, as with reference-manager codes that are cleaned elsewhere).
 */
function cellEmphasis(paragraphXml: string[], plain: string): string | undefined {
  const lines: string[] = [];
  let any = false;
  for (const p of paragraphXml) {
    let line = '';
    for (const m of p.matchAll(/<w:r\b[\s>]([\s\S]*?)<\/w:r>/gi)) {
      const rXml = m[1];
      const t = (rXml.match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/gi) || []).map((x) => x.replace(/<[^>]+>/g, '')).join('');
      if (!t) continue;
      const text = decodeXml(t);
      const own = rXml.replace(/<w:rPrChange\b[\s\S]*?<\/w:rPrChange>/gi, '');
      const bold = /<w:b[\s\/>]/i.test(own) && !/<w:b\s+w:val="(?:0|false)"/i.test(own);
      const italic = /<w:i[\s\/>]/i.test(own) && !/<w:i\s+w:val="(?:0|false)"/i.test(own);
      if ((bold || italic) && text.trim()) any = true;
      line += bold || italic ? (bold ? '<b>' : '') + (italic ? '<i>' : '') + text + (italic ? '</i>' : '') + (bold ? '</b>' : '') : text;
    }
    if (line) lines.push(line);
  }
  if (!any) return undefined;
  const joined = serializeMarkup(parseMarkup(lines.join('\n').trim()));
  return stripMarkup(joined).replace(/\s+/g, ' ') === cleanEndNoteText(plain).replace(/\s+/g, ' ') ? joined : undefined;
}

export interface XmlRun {
  text: string;
  isSup: boolean;
  isSub?: boolean;
  isBold: boolean;
  isItalic: boolean;
}

export interface XmlParagraph {
  runs: XmlRun[];
  text: string;
  hasMath: boolean;
  mathFormula?: string;
  rawXml: string;
}

export async function extractOpenXmlParagraphs(zip: JSZip): Promise<XmlParagraph[]> {
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) return [];
  const rawDocXml = await docXmlFile.async('text');
  // Strip pict & drawing containers that contain nested paragraphs to preserve linear flow
  const docXml = rawDocXml
    .replace(/<w:pict\b[\s\S]*?<\/w:pict>/gi, '')
    .replace(/<w:drawing\b[\s\S]*?<\/w:drawing>/gi, '');

  const paragraphs: XmlParagraph[] = [];
  const pRegex = /<w:p\b[\s>]([\s\S]*?)<\/w:p>/gi;
  let pMatch: RegExpExecArray | null;

  while ((pMatch = pRegex.exec(docXml)) !== null) {
    const pXml = pMatch[1];
    const rRegex = /<w:r\b[\s>]([\s\S]*?)<\/w:r>/gi;
    let rMatch: RegExpExecArray | null;
    const runs: XmlRun[] = [];
    let fullText = '';

    const hasMath = pXml.includes('<m:oMath');
    let mathFormula: string | undefined;

    if (hasMath) {
      const mathParaMatch = pXml.match(/<m:oMathPara\b[\s>]([\s\S]*?)<\/m:oMathPara>/i);
      if (mathParaMatch) {
        mathFormula = `$$ ${ommlToLatex(mathParaMatch[1])} $$`;
      } else {
        const mathInlineMatch = pXml.match(/<m:oMath\b[\s>]([\s\S]*?)<\/m:oMath>/i);
        if (mathInlineMatch) {
          mathFormula = `$ ${ommlToLatex(mathInlineMatch[1])} $`;
        }
      }
    }

    while ((rMatch = rRegex.exec(pXml)) !== null) {
      const rXml = rMatch[1];
      const isSup =
        /<w:vertAlign\s+w:val="superscript"/i.test(rXml) ||
        /<w:position\s+w:val="[1-9]\d*"/i.test(rXml);
      const isSub =
        /<w:vertAlign\s+w:val="subscript"/i.test(rXml) || /<w:position\s+w:val="-\d+"/i.test(rXml);
      // the formatting the run has now (what a tracked formatting change replaced is in <w:rPrChange>, and is not it)
      const own = rXml.replace(/<w:rPrChange\b[\s\S]*?<\/w:rPrChange>/gi, '');
      const isBold = /<w:b[\s\/>]/i.test(own) && !/<w:b\s+w:val="(?:0|false)"/i.test(own);
      const isItalic = /<w:i[\s\/>]/i.test(own) && !/<w:i\s+w:val="(?:0|false)"/i.test(own);

      const tMatch = rXml.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g);
      let text = '';
      if (tMatch) {
        text = tMatch.map((x) => x.replace(/<[^>]+>/g, '')).join('');
      }
      if (text) {
        text = decodeXml(text);
        runs.push({ text, isSup, isSub, isBold, isItalic });
        fullText += text;
      }
    }

    if (fullText.trim().length > 0 || hasMath) {
      paragraphs.push({
        runs,
        text: fullText.trim(),
        hasMath,
        mathFormula,
        rawXml: pXml,
      });
    }
  }

  return paragraphs;
}

export interface ExtractedDocxTable {
  id: string;
  num: number;
  caption: string;
  type: 'table' | 'appendix' | 'abbrev';
  headers: string[];
  rows: string[][];
  headerRows?: TableCell[][];
  bodyRows?: TableCell[][];
  pos: number;
  /** The table sits in a landscape section of the Word file. */
  landscape?: boolean;
  placed?: boolean;
}

/**
 * Parses an individual <w:tbl> OpenXML node with full 2D matrix reconstruction:
 * - Resolves <w:gridSpan> (horizontal colspan)
 * - Resolves <w:vMerge> (vertical rowspan restart/continue)
 * - Detects and synthesizes multi-row hierarchical headers (via <w:tblHeader> and structural detection)
 * - Preserves structural headerRows and bodyRows with exact colSpan and rowSpan
 * - Guarantees headers.length === rows[i].length for all rows
 */
export function parseOpenXmlTable(tblXml: string): {
  headers: string[];
  rows: string[][];
  headerRows: TableCell[][];
  bodyRows: TableCell[][];
  headerRowCount: number;
  colCount: number;
  totalRowCount: number;
  allCellTexts: string[];
} | null {
  const trMatches = tblXml.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/gi) || [];
  if (trMatches.length === 0) return null;

  interface MatrixCell {
    text: string;
    rawText: string;
    /** The cell's text with <b>/<i> where the Word runs are bold or italic (only when something in it is). */
    markup?: string;
    /** Where Word centres or right-aligns the cell's text (left is what every cell is without a choice). */
    align?: 'center' | 'right';
    isContinuation: boolean;
    isVContinue: boolean;
    vMerge: 'restart' | 'continue' | 'none';
    gridSpan: number;
    parentRow?: number;
    parentCol?: number;
  }

  const matrix: MatrixCell[][] = [];
  const headerRowIndices = new Set<number>();

  for (let r = 0; r < trMatches.length; r++) {
    const trXml = trMatches[r];
    const isTblHeader = /<w:tblHeader/i.test(trXml);
    if (isTblHeader) headerRowIndices.add(r);

    if (!matrix[r]) matrix[r] = [];

    const tcMatches = trXml.match(/<w:tc[\s>][\s\S]*?<\/w:tc>/gi) || [];
    let col = 0;

    for (let tcIdx = 0; tcIdx < tcMatches.length; tcIdx++) {
      const tcXml = tcMatches[tcIdx];

      // Skip columns in this row that are already occupied by vMerge continue from above
      while (matrix[r][col] !== undefined) {
        col++;
      }

      // 1. Horizontal merge: gridSpan
      const gridSpanMatch = tcXml.match(/<w:gridSpan\b[^>]*w:val="(\d+)"/i);
      const span = gridSpanMatch ? parseInt(gridSpanMatch[1], 10) : 1;

      // 2. Vertical merge: vMerge
      const vMergeMatch = tcXml.match(/<w:vMerge\b([^>]*)/i);
      let vMerge: 'restart' | 'continue' | 'none' = 'none';
      if (vMergeMatch) {
        vMerge = /w:val="restart"/i.test(vMergeMatch[1]) ? 'restart' : 'continue';
      }

      // 3. Extract text from tc paragraphs
      const pMatches = tcXml.match(/<w:p\b[\s>][\s\S]*?<\/w:p>/gi) || [];
      const pTexts = pMatches
        .map((p) => {
          const tMatches = p.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/gi) || [];
          const raw = tMatches.map((t) => t.replace(/<[^>]+>/g, '')).join('');
          return cleanEndNoteText(decodeXml(raw));
        })
        .filter((t) => t.length > 0);
      // one line per paragraph: multi-line cells (e.g. 4 value lines) must stay aligned across columns
      const cellText = pTexts.join('\n').trim();
      const cellMarkup = cellEmphasis(pMatches, cellText);
      const cellAlign = cellAlignment(pMatches);

      if (vMerge === 'continue') {
        let parentRow = r - 1;
        while (parentRow >= 0 && matrix[parentRow][col]?.vMerge === 'continue') {
          parentRow--;
        }
        const parentCell = parentRow >= 0 ? matrix[parentRow][col] : null;
        if (parentCell && !parentCell.text && cellText) {
          parentCell.text = cellText;
          parentCell.rawText = cellText;
        }
        const textToUse = cellText || parentCell?.text || '';

        for (let s = 0; s < span; s++) {
          matrix[r][col + s] = {
            text: textToUse,
            rawText: cellText,
            isContinuation: true,
            isVContinue: true,
            vMerge: 'continue',
            gridSpan: 1,
            parentRow,
            parentCol: col,
          };
        }
      } else {
        for (let s = 0; s < span; s++) {
          matrix[r][col + s] = {
            text: cellText,
            rawText: s === 0 ? cellText : '',
            ...(s === 0 && cellMarkup ? { markup: cellMarkup } : {}),
            ...(s === 0 && cellAlign ? { align: cellAlign } : {}),
            isContinuation: s > 0,
            isVContinue: false,
            vMerge: vMerge === 'restart' ? 'restart' : 'none',
            gridSpan: span,
            parentRow: r,
            parentCol: col,
          };
        }
      }

      col += span;
    }
  }

  // Ensure all rows have the exact same maximum column width
  const maxCols = Math.max(...matrix.map((row) => row.length));
  for (let r = 0; r < matrix.length; r++) {
    while (matrix[r].length < maxCols) {
      matrix[r].push({
        text: '',
        rawText: '',
        isContinuation: false,
        isVContinue: false,
        vMerge: 'none',
        gridSpan: 1,
      });
    }
  }

  // Determine header row count
  let headerRowCount = 0;
  while (headerRowCount < matrix.length && headerRowIndices.has(headerRowCount)) {
    headerRowCount++;
  }

  if (headerRowCount === 0 && matrix.length > 1) {
    headerRowCount = 1;
  }
  if (headerRowCount === 1 && matrix.length > 2) {
    const hasColspansInRow0 = matrix[0].some((c) => c.gridSpan > 1);
    const row1HasVContinuations = matrix[1].some((c) => c.isVContinue);
    if (hasColspansInRow0 && row1HasVContinuations) {
      headerRowCount = 2;
    }
  }

  // If 2 header rows detected, promote standalone trailing cells in row 1 (e.g. "Tài trợ/Xung đột lợi ích")
  // to row 0 with rowSpan: 2 so they don't leave row 0 blank or stay in row 1
  if (headerRowCount === 2 && matrix.length >= 2) {
    for (let c = 0; c < maxCols; c++) {
      const cell0 = matrix[0][c];
      const cell1 = matrix[1][c];
      if (cell0 && cell1) {
        if (!cell0.text.trim() && cell1.text.trim()) {
          cell0.text = cell1.text;
          cell0.rawText = cell1.text;
          cell0.vMerge = 'restart';
          cell1.isVContinue = true;
          cell1.isContinuation = true;
          cell1.parentRow = 0;
          cell1.rawText = '';
        }
      }
    }
  }

  // Build combined composite header titles
  const finalHeaders: string[] = [];
  for (let c = 0; c < maxCols; c++) {
    const parts: string[] = [];
    for (let hr = 0; hr < headerRowCount; hr++) {
      const cell = matrix[hr][c];
      const txt = cell?.rawText || cell?.text || '';
      if (txt && !parts.includes(txt)) {
        parts.push(txt);
      }
    }
    finalHeaders.push(parts.join(' / ')); // an empty corner cell stays empty, as in the file
  }

  // Build data rows
  const finalRows: string[][] = [];
  for (let r = headerRowCount; r < matrix.length; r++) {
    const rowData = matrix[r].map((cell) => cell.text || '');
    if (rowData.some((c) => c.length > 0)) {
      finalRows.push(rowData);
    }
  }

  // Build structured multi-row TableCell arrays preserving exact colSpan and rowSpan
  function extractCellsForRowRange(startR: number, endR: number): TableCell[][] {
    const rows: TableCell[][] = [];
    for (let r = startR; r < endR; r++) {
      const rowCells: TableCell[] = [];
      for (let c = 0; c < maxCols; c++) {
        const cell = matrix[r][c];
        if (cell.isContinuation || cell.isVContinue) continue;

        let rowSpan = 1;
        for (let r2 = r + 1; r2 < endR; r2++) {
          const nextCell = matrix[r2][c];
          if (nextCell && nextCell.isVContinue && nextCell.parentRow === r) {
            rowSpan++;
          } else {
            break;
          }
        }

        rowCells.push({
          // body cells keep the bold and italic of the Word file; header cells are bold by the table's style anyway
          text: (r >= headerRowCount && cell.markup) || cell.rawText || cell.text,
          colSpan: cell.gridSpan > 1 ? cell.gridSpan : undefined,
          rowSpan: rowSpan > 1 ? rowSpan : undefined,
          isHeader: r < headerRowCount,
          ...(cell.align ? { align: cell.align } : {}),
        });
      }
      if (rowCells.length > 0) rows.push(rowCells);
    }
    return rows;
  }

  const headerRows = extractCellsForRowRange(0, headerRowCount);
  const bodyRows = extractCellsForRowRange(headerRowCount, matrix.length);

  return {
    headers: finalHeaders,
    rows: finalRows,
    headerRows,
    bodyRows,
    headerRowCount,
    colCount: maxCols,
    totalRowCount: matrix.length,
    allCellTexts: matrix.flatMap((row) => row.map((cell) => cell.text).filter(Boolean)),
  };
}

/** The alignment Word gives the text of a cell (<w:jc> of the paragraphs that hold text): centre or right when most of them have it. */
function cellAlignment(paragraphs: string[]): 'center' | 'right' | undefined {
  const votes = { center: 0, right: 0, other: 0 };
  for (const p of paragraphs) {
    if (!/<w:t\b[^>]*>[^<]+<\/w:t>/i.test(p)) continue;
    const pPr = p.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/i)?.[1] ?? '';
    const v = pPr.match(/<w:jc\b[^>]*w:val="(\w+)"/i)?.[1];
    if (v === 'center') votes.center++;
    else if (v === 'right' || v === 'end') votes.right++;
    else votes.other++;
  }
  if (votes.center > votes.right && votes.center >= votes.other) return 'center';
  if (votes.right > votes.center && votes.right >= votes.other) return 'right';
  return undefined;
}

export async function extractOpenXmlTables(
  zip: JSZip
): Promise<ExtractedDocxTable[]> {
  const docXmlFile = zip.file('word/document.xml');
  if (!docXmlFile) return [];
  const docXml = await docXmlFile.async('text');

  const tables: ExtractedDocxTable[] = [];
  const isLandscapeAt = landscapeResolver(docXml);
  const tblRegex = /<w:tbl[\s>][\s\S]*?<\/w:tbl>/gi;
  let tblMatch: RegExpExecArray | null;

  while ((tblMatch = tblRegex.exec(docXml)) !== null) {
    const tblXml = tblMatch[0];
    const tblPos = tblMatch.index;

    // Search preceding paragraphs within 3000 chars
    const beforeXml = docXml.slice(Math.max(0, tblPos - 3000), tblPos);
    const pMatches = beforeXml.match(/<w:p\b[\s>][\s\S]*?<\/w:p>/gi) || [];
    let detectedCaption = '';
    let captionType: 'table' | 'appendix' | 'abbrev' | 'none' = 'none';
    let tableNum = 0;

    for (let pI = pMatches.length - 1; pI >= Math.max(0, pMatches.length - 3); pI--) {
      // Text runs only: field codes (" SEQ Bảng \* ARABIC ") live in <w:instrText> and must not leak into the caption
      const pText = (pMatches[pI].match(/<w:t\b[^>]*>[\s\S]*?<\/w:t>/gi) || []).map((t) => t.replace(/<[^>]+>/g, '')).join('').replace(/\s+/g, ' ').trim();
      const cleanP = cleanEndNoteText(decodeXml(pText));

      const tableCapMatch = cleanP.match(/^(?:b\s*ảng|bảng|table|b\.)\s*(\d*)\s*[:.-]?\s*(.*)/i);
      if (
        tableCapMatch &&
        !/^(?:b\s*ảng|bảng|table|b\.)\s*\d*[:.]?\s*(cho thấy|chỉ ra|biểu thị|được thể hiện|minh họa|mô tả|tóm tắt|được trình bày|shows|presents|indicates|illustrates|summarizes|phản ánh|cho biết|thể hiện)/i.test(
          cleanP
        )
      ) {
        detectedCaption = cleanP;
        captionType = 'table';
        tableNum = tableCapMatch[1] ? parseInt(tableCapMatch[1], 10) : 0;
        break;
      }

      const appendixCapMatch = cleanP.match(/^(?:p\s*hụ\s*lục|phụ\s*lục|appendix)\s*(\d*)\s*[:.-]?\s*(.*)/i);
      if (appendixCapMatch) {
        detectedCaption = cleanP;
        captionType = 'appendix';
        tableNum = appendixCapMatch[1] ? parseInt(appendixCapMatch[1], 10) : 0;
        break;
      }

      if (/^(?:danh\s*mục\s*(?:các\s*)?(?:từ\s*)?viết\s*tắt|abbreviations?)/i.test(cleanP)) {
        detectedCaption = cleanP;
        captionType = 'abbrev';
        break;
      }
    }

    const parsed = parseOpenXmlTable(tblXml);
    if (!parsed) continue;

    // Check embedded banner in row 0
    // (a banner that spans every column yields N identical header cells, not just one)
    const isBannerRow =
      parsed.headers.length === 1 ||
      (parsed.headers.length > 1 && !!parsed.headers[0] && parsed.headers.every((h) => h === parsed.headers[0]));
    if (!detectedCaption && parsed.rows.length > 0 && isBannerRow) {
      const h0 = parsed.headers[0];
      const embMatch = h0.match(/^(?:b\s*ảng|bảng|table|b\.)\s*(\d*)[:.-]?\s*(.*)/i);
      if (embMatch) {
        detectedCaption = h0;
        captionType = 'table';
        tableNum = embMatch[1] ? parseInt(embMatch[1], 10) : 0;
        if (parsed.rows.length > 0) {
          parsed.headers = parsed.rows[0];
          parsed.rows = parsed.rows.slice(1);
          // keep the structured rows in step: the first body row becomes the header row
          if (parsed.bodyRows && parsed.bodyRows.length > 0) {
            parsed.headerRows = [parsed.bodyRows[0]];
            parsed.bodyRows = parsed.bodyRows.slice(1);
          } else {
            parsed.headerRows = [];
          }
        }
      }
    }

    // Negative filtering for non-data tables:
    const allText = tblXml.replace(/<[^>]+>/g, ' ').toLowerCase();
    const isAuthorBox =
      tblPos < 25000 &&
      !detectedCaption &&
      (allText.includes('đại học') || allText.includes('bộ môn') || allText.includes('khoa ') || allText.includes('email:'));
    const isSingleCellBox = parsed.totalRowCount === 1 && parsed.colCount === 1;
    const isFigureTable = (/<w:drawing|<w:pict/i.test(tblXml) && parsed.totalRowCount <= 2) || !!figureTableInfo(tblXml);
    const isUncaptionedSmall = !detectedCaption && (parsed.totalRowCount <= 2 || parsed.colCount <= 1);

    if (isAuthorBox || isSingleCellBox || isFigureTable || isUncaptionedSmall) {
      continue;
    }

    const finalNum =
      tableNum ||
      (captionType === 'appendix'
        ? tables.filter((t) => t.type === 'appendix').length + 1
        : tables.filter((t) => t.type === 'table').length + 1);

    const finalCaption =
      detectedCaption ||
      (captionType === 'appendix' ? `Phụ lục ${finalNum}` : `Bảng ${finalNum}`);

    tables.push({
      id: captionType === 'appendix' ? `app_tab_${finalNum}` : `tab_${finalNum}`,
      num: finalNum,
      caption: finalCaption,
      type: captionType === 'none' ? 'table' : captionType,
      headers: parsed.headers,
      rows: parsed.rows,
      headerRows: parsed.headerRows,
      bodyRows: parsed.bodyRows,
      pos: tblPos,
      landscape: isLandscapeAt(tblPos),
      placed: false,
    });
  }

  return tables;
}

export function extractAuthorsAndAffiliationsFromRuns(paragraphs: XmlParagraph[]): {
  authors: Author[];
  affiliations: Affiliation[];
  corresponding: { name: string; email: string; affiliation: string };
  authorLineIndex: number;
} {
  const authors: Author[] = [];
  const affiliations: Affiliation[] = [];
  const corresponding = { name: '', email: '', affiliation: '' };
  let authorLineIndex = -1;
  let authorFound = false;
  let isNextLineCorresponding = false;

  for (let i = 0; i < Math.min(paragraphs.length, 30); i++) {
    const p = paragraphs[i];
    const text = p.text;

    // Stop frontmatter extraction if we hit a body section header
    if (/^(?:\d+(?:\.\d+)*\.?\s+)?(giới thiệu|đặt vấn đề|mở đầu|introduction|phương pháp|methods|vật liệu và phương pháp)/i.test(text.trim())) {
      break;
    }

    const hasSup = p.runs.some((r) => r.isSup) || /([*]|(?:\s+\d+(?:,\d+)*))$/.test(text);
    const startsWithAuthorHeader = /^(authors|nhóm tác giả|tác giả):\s*/i.test(text);

    // 1. Author line detection via superscripts or author headers
    if ((hasSup || startsWithAuthorHeader) && !authorFound) {
      if (
        !/^(tạp chí|journal|sci\.|sciencedirect|springer|vnu|đhqg|open access|bài nghiên|bài tổng|loại bài|review article|research article|tóm tắt|abstract|keywords|từ khóa|ngày|lịch sử|title|tựa đề|preliminaries|introduction|use your smartphone)/i.test(
          text
        ) &&
        !/^(khoa|bộ môn|trường|viện|đại học|faculty|department|university|hospital)/i.test(text) &&
        !/\d{4},\s*\d+\(\d+\)/.test(text) &&
        text.length < 250
      ) {
        let curName = '';
        let curAffIds: number[] = [];
        let curIsCorr = false;

        for (let r = 0; r < p.runs.length; r++) {
          const run = p.runs[r];
          if (run.isSup) {
            const supStr = run.text.trim();
            const nums = (supStr.match(/\d+/g) || []).map(Number);
            curAffIds.push(...nums);
            if (supStr.includes('*')) curIsCorr = true;
          } else {
            const cleanText = run.text.replace(/^(authors|nhóm tác giả|tác giả):\s*/i, '');
            const parts = cleanText.split(/[,;\t]|\s{2,}/);
            for (let partIdx = 0; partIdx < parts.length; partIdx++) {
              const part = parts[partIdx].trim();
              if (partIdx > 0 && curName.trim()) {
                const name = normalizeVietnameseWordSpacing(curName.replace(/[\d*()]/g, ''));
                if (name.length >= 2 && !/^(khoa|trường|viện|đại học|bộ môn)/i.test(name)) {
                  authors.push({
                    id: `a_${authors.length + 1}`,
                    name,
                    affiliationIds: curAffIds.length > 0 ? Array.from(new Set(curAffIds)) : [1],
                    isCorresponding: curIsCorr,
                  });
                }
                curName = '';
                curAffIds = [];
                curIsCorr = false;
              }
              if (part) {
                if (part.includes('*')) curIsCorr = true;
                const trailingNums = (part.match(/\d+/g) || []).map(Number);
                if (trailingNums.length > 0) curAffIds.push(...trailingNums);
                // Runs of one name are contiguous ("Nguy" + "ễ" + "n Thanh H"): keep the raw text,
                // do not insert a space between runs (that produced "Nguyễ n").
                curName += parts[partIdx].replace(/[\d*()]/g, '');
              } else if (curName) {
                // a run holding only a space ("Viên Vinh" + " " + "Phú") still separates two words
                curName += parts[partIdx];
              }
            }
          }
        }

        if (curName.trim()) {
          const name = normalizeVietnameseWordSpacing(curName.replace(/[\d*()]/g, ''));
          if (name.length >= 2 && !/^(khoa|trường|viện|đại học|bộ môn)/i.test(name)) {
            authors.push({
              id: `a_${authors.length + 1}`,
              name,
              affiliationIds: curAffIds.length > 0 ? Array.from(new Set(curAffIds)) : [1],
              isCorresponding: curIsCorr,
            });
          }
        }

        if (authors.length > 0) {
          authorFound = true;
          authorLineIndex = i;
          continue;
        }
      }
    }

    // 2. Author line detection for single author without superscripts (e.g. SSH: "Ngô Viết Hoàn")
    if (
      !authorFound &&
      i >= 1 &&
      i <= 5 &&
      !hasSup &&
      text.length >= 4 &&
      text.length <= 45 &&
      !text.includes('.') &&
      !text.includes(':') &&
      /^[A-ZÀ-Ỹ][a-zà-ỹA-ZÀ-Ỹ\s]+$/.test(text) &&
      !/^(bài nghiên|bài tổng|loại bài|tạp chí|tóm tắt|abstract|keywords|mở đầu|đặt vấn đề|open access)/i.test(text)
    ) {
      authors.push({
        id: 'a_1',
        name: normalizeVietnameseWordSpacing(text),
        affiliationIds: [1],
        isCorresponding: true,
      });
      authorFound = true;
      authorLineIndex = i;
      continue;
    }

    // 3. Corresponding author triggers on isolated line
    if (/^(corresponding author|tác giả liên hệ|liên hệ):?$/i.test(text.trim())) {
      isNextLineCorresponding = true;
      continue;
    }

    // 4. Corresponding author on next line: "Hà Vũ, Bộ môn Nội - Khoa Y..."
    if (isNextLineCorresponding) {
      isNextLineCorresponding = false;
      const corrMatch = text.match(/^([A-ZÀ-Ỹa-zà-ỹ\s]+),\s*(.+)$/);
      if (corrMatch) {
        corresponding.name = normalizeVietnameseWordSpacing(corrMatch[1]);
        corresponding.affiliation = corrMatch[2].trim();
        if (!affiliations.some((a) => a.name === corrMatch[2].trim())) {
          affiliations.push({ id: affiliations.length + 1, name: corrMatch[2].trim() });
        }
        continue;
      }
    }

    // 5. Affiliation detection
    const firstRun = p.runs[0];
    if (
      firstRun &&
      firstRun.isSup &&
      !text.toLowerCase().includes('tác giả liên hệ') &&
      !text.toLowerCase().includes('corresponding') &&
      !/^(từ khóa|keywords|bảng|table|hình|figure|open access)/i.test(text)
    ) {
      const supId = parseInt(firstRun.text.replace(/\D/g, ''), 10);
      const affName = p.runs.slice(1).map((r) => r.text).join('').replace(/^[:.]\s*/, '').trim();
      if (
        affName.length > 5 &&
        affName.length < 250 &&
        /(khoa|bộ môn|trường|viện|đại học|faculty|department|university|hospital|institute|phân viện|trung tâm|bệnh viện|phòng thí nghiệm|lab)/i.test(affName) &&
        !affiliations.some((a) => a.name === affName)
      ) {
        affiliations.push({ id: isNaN(supId) ? affiliations.length + 1 : supId, name: affName });
        continue;
      }
    }

    const affMatch = text.match(/^(\d+)[:.]?\s*([A-ZÀ-Ỹ].+)/);
    if (affMatch && affiliations.length < 15 && !/^(từ khóa|keywords|bảng|table|hình|figure|open access)/i.test(text)) {
      const affId = parseInt(affMatch[1], 10);
      const affText = affMatch[2].trim();
      if (/(khoa|bộ môn|trường|viện|đại học|faculty|department|university|hospital|institute|phân viện)/i.test(affText)) {
        if (!affiliations.some((a) => a.name === affText)) {
          affiliations.push({ id: affId, name: affText });
          continue;
        }
      }
    }

    if (
      /(khoa|bộ môn|trường|viện|đại học|faculty|department|university|hospital|institute|phân viện)/i.test(text) &&
      text.length < 220 &&
      !/^(tạp chí|liên hệ|tựa đề|title|authors|tác giả|doi|tóm tắt|abstract|bài nghiên|loại bài|từ khóa|keywords|bảng|table|hình|figure|open access)/i.test(text) &&
      !authors.some((a) => a.name === text)
    ) {
      // Check if text has author prefix "Author, Institution"
      const m = text.match(/^([A-ZÀ-Ỹa-zà-ỹ\s]+),\s*(.+)$/);
      if (m && /(khoa|bộ môn|trường|viện|đại học|faculty|department|university)/i.test(m[2])) {
        if (!corresponding.name) corresponding.name = normalizeVietnameseWordSpacing(m[1]);
        if (!corresponding.affiliation) corresponding.affiliation = m[2].trim();
        if (!affiliations.some((a) => a.name === m[2].trim())) {
          affiliations.push({ id: affiliations.length + 1, name: m[2].trim() });
        }
        continue;
      }
      if (!affiliations.some((a) => a.name === text)) {
        affiliations.push({ id: affiliations.length + 1, name: text });
        continue;
      }
    }

    // 6. Corresponding author & email inline
    if (
      /^(corresponding author|tác giả liên hệ|liên hệ):\s*(.*)/i.test(text) ||
      /^\*?\s*(tác giả liên hệ|corresponding author):\s*(.*)/i.test(text)
    ) {
      const val = text.replace(/^.*?(tác giả liên hệ|corresponding author):\s*/i, '').trim();
      const emailMatch = val.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
      if (emailMatch) corresponding.email = emailMatch[1];
      const namePart = val.replace(/\(.*?\)/g, '').replace(/email:.*$/i, '').trim();
      if (namePart && !namePart.includes('@')) corresponding.name = namePart;
      continue;
    }

    if (/^email:\s*(.+)/i.test(text) || /^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+$/i.test(text)) {
      const emailMatch = text.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
      if (emailMatch) {
        corresponding.email = emailMatch[1];
      }
    }
  }

  // Filter out any affiliation that is accidentally a keyword or table caption
  const cleanedAffiliations = affiliations.filter(
    // (the correspondence line "*Tác giả liên hệ: Name, Faculty…" is not an institution of its own)
    (a) => !/^(từ khóa|keywords|bảng|table|hình|figure)/i.test(a.name) && !/^\*?\s*(tác\s+gi[aả]\s+liên\s+hệ|corresponding\s+author)\s*:/i.test(a.name)
  );

  authors.forEach((a) => {
    a.name = normalizeVietnameseWordSpacing(a.name);
  });

  if (authors.length > 0 && !authors.some((a) => a.isCorresponding)) {
    authors[0].isCorresponding = true;
  }
  if (!corresponding.name && authors.length > 0) {
    const corr = authors.find((a) => a.isCorresponding) || authors[0];
    corresponding.name = corr.name;
  }
  if (!corresponding.affiliation && cleanedAffiliations.length > 0) {
    corresponding.affiliation = cleanedAffiliations[0].name;
  }

  return { authors, affiliations: cleanedAffiliations, corresponding, authorLineIndex };
}

export async function parseDocxFile(originalBuffer: ArrayBuffer, fileName?: string): Promise<CompletePaper> {
  // not a .docx: say so plainly. Track Changes are resolved and footnotes placed in the text before anything is read
  const prepared = await prepareDocx(originalBuffer);
  const fileBuffer = prepared.buffer;
  const mammothOpts: any = { arrayBuffer: fileBuffer };
  if (typeof Buffer !== 'undefined') {
    mammothOpts.buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  }

  let html = '';
  try {
    const htmlResult = await mammoth.convertToHtml(mammothOpts, {
      convertImage: mammoth.images.dataUri,
    });
    html = htmlResult.value;
  } catch (err) {
    console.warn('Mammoth convertToHtml failed:', err);
  }

  const zip = await JSZip.loadAsync(fileBuffer);

  const { imageMap, figureImageMap, xmlCaptionNumbers } = await loadFigureImages(zip, html);

  const openXmlTables = await extractOpenXmlTables(zip);
  const openXmlParagraphs = await extractOpenXmlParagraphs(zip);
  const { authors, affiliations: rawAffiliations, corresponding } = extractAuthorsAndAffiliationsFromRuns(openXmlParagraphs);
  // VI + EN lines of the same affiliation become one entry (nameEn)
  const affiliations = mergeBilingualAffiliations(rawAffiliations);

  // Generate clean document text without table cells to prevent table cell fragments leaking into body paragraphs
  const docXmlFile = zip.file('word/document.xml');
  let cleanMammothOpts = mammothOpts;
  if (docXmlFile) {
    const docXml = await docXmlFile.async('text');
    if (docXml.includes('<w:tbl') || /w:val="(Guide|Instruction)/.test(docXml)) {
      // Tables leave the text pass; a picture grid with a "Hình N" caption leaves its caption behind
      const cleanDocXml = stripGuideParagraphs(docXml.replace(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/gi, (t) => figureTableAsCaptionParagraph(t) ?? ''));
      const cleanZip = await JSZip.loadAsync(fileBuffer);
      cleanZip.file('word/document.xml', cleanDocXml);
      const cleanBuffer = await cleanZip.generateAsync({ type: 'arraybuffer' });
      cleanMammothOpts = {
        arrayBuffer: cleanBuffer,
        buffer: typeof Buffer !== 'undefined' ? Buffer.from(cleanBuffer) : undefined,
      };
    }
  }

  const listHeadings = extractListHeadings((await zip.file('word/document.xml')?.async('text')) || '', await zip.file('word/styles.xml')?.async('text'));
  // the bullets and numbers Word draws by itself are not in the text: they are written in front of their paragraphs
  const listItems = extractListItems((await zip.file('word/document.xml')?.async('text')) || '', await zip.file('word/numbering.xml')?.async('text'), listHeadings);
  const rawTextResult = await mammoth.extractRawText(cleanMammothOpts);
  const rawLines = rawTextResult.value
    .split(/\r?\n/)
    .map((l) => cleanEndNoteText(l))
    .filter((l) => l.length > 0);

  // Fallback author extraction from rawLines if openXmlParagraphs missed authors
  if (authors.length === 0 && rawLines.length > 2) {
    for (let rIdx = 1; rIdx < Math.min(rawLines.length, 8); rIdx++) {
      const rLine = rawLines[rIdx].trim();
      if (
        !/^(tạp chí|bài |open access|tóm tắt|abstract|keywords|từ khóa|ngày|lịch sử|loại bài|title|tựa đề|use your smartphone)/i.test(
          rLine
        ) &&
        !/(khoa|bộ môn|trường|viện|đại học)/i.test(rLine) &&
        rLine.length >= 4 &&
        rLine.length <= 120
      ) {
        const names = rLine
          .split(/[,;]|\s{2,}/)
          .map((n) => normalizeVietnameseWordSpacing(n.replace(/[\d*()]/g, '').trim()))
          .filter((n) => n.length >= 2);
        if (names.length > 0 && names.every((n) => /^[A-ZÀ-Ỹ]/.test(n))) {
          names.forEach((name, nIdx) => {
            authors.push({
              id: `a_${nIdx + 1}`,
              name,
              affiliationIds: [1],
              isCorresponding: rLine.includes('*') ? new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[^,;]*\\*').test(rLine) : nIdx === 0,
            });
          });
          break;
        }
      }
    }
  }

  const journalInfo = detectJournalFromContent(rawLines.slice(0, 40).join('\n'), fileName);

  let title = '';
  let titleEn = '';
  let articleType = 'Bài báo nghiên cứu';
  let articleTypeEn: string | undefined;
  let abstract = '';
  let abstractEn = '';
  const keywords: string[] = [];
  const keywordsEn: string[] = [];
  const dates = {
    received: '',
    revised: '',
    accepted: '',
    published: '',
  };
  let doi = '';
  let volume = '';
  let issue = '';
  let year = '';
  let firstPage = 0;
  let lastPage = 0;

  let i = 0;

  // Header line with Journal vol/issue/pages
  if (rawLines.length > 0 && /^(tạp chí|journal of|sci\. tech\. dev)/i.test(rawLines[0])) {
    const h = rawLines[0];
    const matchVol = h.match(/(\d{4}),?\s*(\d+)\((\d+)\):(\d+)-(\d+)/);
    if (matchVol) {
      year = matchVol[1];
      volume = matchVol[2];
      issue = matchVol[3];
      firstPage = parseInt(matchVol[4], 10);
      lastPage = parseInt(matchVol[5], 10);
    }
    i++;
  }

  // Article Type
  if (
    i < rawLines.length &&
    /^(open access|bài nghiên cứu|bài nghiên cứu|bài tổng quan|research article|review article)/i.test(rawLines[i])
  ) {
    const atLine = rawLines[i];
    if (/bài tổng quan|review/i.test(atLine)) articleType = 'Bài tổng quan';
    else if (/bài nghiên cứu|bài nghiên cứu|research/i.test(atLine)) articleType = 'Bài nghiên cứu';
    i++;
  }

  const sections: PaperSection[] = [];
  const references: PaperReference[] = [];

  let isReadingAbstract = false;
  let isReadingAbstractEn = false;
  let isReadingReferences = false;
  let isFrontMatterDone = false;
  let tableCursor = 0;
  // English summary page after the references ("Research Article", title, authors, ABSTRACT, Keywords)
  // The template labels the first page in ONE language; the other language is the closing page.
  const primaryLanguage = detectPrimaryLanguage(rawLines);
  const enBack = primaryLanguage === 'vi' ? findEnglishBackMatter(rawLines) : null;
  const viBack = primaryLanguage === 'en' ? findVietnameseBackMatter(rawLines) : null;
  const back = enBack ?? viBack;

  for (; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (!line) continue;
    if (back && i === back.start) {
      isReadingReferences = false;
      isReadingAbstract = false;
      isReadingAbstractEn = false;
      isFrontMatterDone = true;
      i = back.end;
      continue;
    }

    // Explicit Article Type
    if (/^(loại bài|loại bài viết|article type):\s*(.+)/i.test(line)) {
      articleType = line.replace(/^(loại bài|loại bài viết|article type):\s*/i, '').trim();
      continue;
    }

    // Explicit Title
    if (/^(title|tựa đề|tiêu đề):\s*(.+)/i.test(line)) {
      const val = line.replace(/^(title|tựa đề|tiêu đề):\s*/i, '').trim();
      if (!title) title = val;
      else if (!titleEn && !/^(authors|nhóm tác giả|tác giả):/i.test(val)) titleEn = val;
      continue;
    }

    // Explicit Authors line: do not absorb into title
    if (/^(authors|nhóm tác giả|tác giả):\s*(.+)/i.test(line)) {
      continue;
    }

    // Dates & History: one label per line, or every label on one line ("Ngày nhận bài: …Ngày chỉnh sửa: …Ngày chấp nhận: …")
    {
      const lineDates = line.length < 300 && (/ngày/i.test(line) || (!isFrontMatterDone && !isReadingReferences)) ? datesInLine(line) : {};
      const keys = Object.keys(lineDates) as Array<keyof typeof dates>;
      if (keys.length > 0) {
        keys.forEach((k) => {
          dates[k] = lineDates[k] ?? '';
        });
        continue;
      }
    }

    // Article DOI: only the labelled line in the front matter / side box. References and body text
    // quote other papers' DOIs ("… DOI: https://doi.org/…"); those lines must reach the reference parser.
    if (!isReadingReferences && !isFrontMatterDone && /^\s*DOI\s*:\s*\S/i.test(line)) {
      if (!doi) doi = line.replace(/^\s*DOI\s*:\s*/i, '').trim().replace(/[.;,]$/, '');
      continue;
    }

    // Natural Title
    if (
      !title &&
      !isFrontMatterDone &&
      !isReadingAbstract &&
      !isReadingAbstractEn &&
      !isReadingReferences &&
      !/^(tóm tắt|abstract|keywords|từ khóa|từ khoá|1:|2:|bài nghiên|loại bài|authors|tác giả)/i.test(line) &&
      line.length > 12
    ) {
      title = line;
      continue;
    }

    // Natural TitleEn (must NOT be an author line or affiliation)
    if (
      title &&
      !titleEn &&
      !isFrontMatterDone &&
      !isReadingAbstract &&
      !isReadingAbstractEn &&
      !isReadingReferences &&
      /^[A-Z][a-zA-Z0-9\s:,'’–-]{20,200}$/.test(line) &&
      !/^(use your smartphone|scan this qr|download this article|open access|creative commons|cite this article|trích dẫn|abstract|keywords|table|figure|introduction|preliminaries|khoa|trường|viện|bộ môn|faculty|authors|tác giả)/i.test(line) &&
      !authors.some((a) => a.name === line) &&
      !affiliations.some((a) => a.name === line)
    ) {
      titleEn = line;
      continue;
    }

    // Abstract triggers
    if (/^(tóm tắt|abstract):?$/i.test(line)) {
      if (/tóm tắt/i.test(line)) {
        isReadingAbstract = true;
        isReadingAbstractEn = false;
      } else {
        isReadingAbstract = false;
        isReadingAbstractEn = true;
      }
      isReadingReferences = false;
      continue;
    }

    // Keywords triggers
    if (/^(key\s?w+ords?|từ khóa|từ khoá)\s*:/i.test(line)) {
      isReadingAbstract = false;
      isReadingAbstractEn = false;
      const kwStr = line.replace(/^(key\s?w+ords?|từ khóa|từ khoá)\s*:\s*/i, '').trim();
      const kwItems = splitKeywords(kwStr);
      if (/từ khóa|từ khoá/i.test(line)) {
        keywords.push(...kwItems);
      } else {
        keywordsEn.push(...kwItems);
      }
      continue;
    }

    if (/^(từ khóa|từ khoá|key\s?w+ords?)$/i.test(line)) {
      isReadingAbstract = false;
      isReadingAbstractEn = false;
      if (i + 1 < rawLines.length) {
        const nextLine = cleanEndNoteText(rawLines[i + 1]);
        const kwItems = splitKeywords(nextLine);
        if (/từ khóa|từ khoá/i.test(line)) {
          keywords.push(...kwItems);
        } else {
          keywordsEn.push(...kwItems);
        }
        i++;
      }
      continue;
    }

    if (isReadingAbstract) {
      if (
        /^(giới thiệu|đặt vấn đề|introduction|mở đầu|key\s?w+ords?|từ khóa|từ khoá|abstract)\s*:/i.test(line) ||
        /^(abstract|key\s?w+ords?|từ khóa|từ khoá)$/i.test(line) ||
        /^(\d+\.)\s+[A-ZÀ-Ỹ]/i.test(line)
      ) {
        isReadingAbstract = false;
        isFrontMatterDone = true;
      } else {
        abstract += (abstract ? ' ' : '') + line;
        continue;
      }
    }

    if (isReadingAbstractEn) {
      if (
        /^(giới thiệu|đặt vấn đề|introduction|mở đầu|key\s?w+ords?|từ khóa|từ khoá)\s*:/i.test(line) ||
        /^(key\s?w+ords?|từ khóa|từ khoá)$/i.test(line) ||
        /^(\d+\.)\s+[A-ZÀ-Ỹ]/i.test(line)
      ) {
        isReadingAbstractEn = false;
        isFrontMatterDone = true;
      } else {
        abstractEn += (abstractEn ? ' ' : '') + line;
        continue;
      }
    }

    // References trigger
    if (/^(tài liệu tham khảo|references|bibliography)$/i.test(line)) {
      isReadingReferences = true;
      isReadingAbstract = false;
      isReadingAbstractEn = false;
      isFrontMatterDone = true;
      continue;
    }

    if (isReadingReferences) {
      if (
        /^(abstract|tóm tắt|keywords|từ khóa|từ khoá|danh mục từ viết tắt|phụ lục|appendix|lời cảm ơn|acknowledgements)$/i.test(
          line
        ) ||
        /^(abstract|keywords|từ khóa):/i.test(line)
      ) {
        isReadingReferences = false;
        i--;
        continue;
      }

      const refMatch = line.match(/^\[?(\d+)\]?\.?\t?\s*(.+)/);
      if (refMatch) {
        const refId = parseInt(refMatch[1], 10);
        const refRaw = refMatch[2].trim();
        references.push({
          id: refId,
          raw: refRaw,
          isCited: true,
          citationCount: 1,
        });
      } else if (/^[A-ZÀ-Ỹ]/.test(line) && line.length > 25) {
        references.push({
          id: references.length + 1,
          raw: line,
          isCited: true,
          citationCount: 1,
        });
      } else if (references.length > 0) {
        references[references.length - 1].raw += ' ' + line;
      }
      continue;
    }

    // Skip front matter noise
    // Skip front matter noise
    if (!isFrontMatterDone) {
      if (
        authors.some((a) => a.name === line || line.includes(a.name)) ||
        affiliations.some((a) => a.name === line || line.includes(a.name)) ||
        /^\d*\s*(khoa|trường|viện|đại học|bộ môn|faculty|university|department|hospital|institute|school|bệnh viện|trung tâm|center|centre)\b/i.test(line) ||
        /^(\*|tác giả liên hệ|corresponding author|liên hệ|email|e-mail|tel|fax)[:*]?\s*/i.test(line) ||
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(line) ||
        line === title ||
        line === titleEn ||
        line.startsWith('Use your smartphone to scan') ||
        /^(open access|bài nghiên|bài tổng|loại bài|review article|research article|lịch sử|bản quyền|copyright|trích dẫn bài báo này|cite this article|doi\s*:)/i.test(line) ||
        /^(ngày nhận|ngày sửa|ngày chỉnh sửa|ngày chấp nhận|ngày đăng|ngày xuất bản)/i.test(line) ||
        /©|Creative Commons|hvu@uhsvnu|tạp chí phát triển/i.test(line) ||
        keywords.some((k) => line.includes(k)) ||
        /^(không steroid|thuốc ức chế)/i.test(line)
      ) {
        continue;
      }
    }

    // Headings numbered by Word's automatic list ("Tổng quan", "Lý thuyết nền tảng")
    const listLevel = listHeadings.get(line.trim());
    if (listLevel !== undefined && isFrontMatterDone) {
      sections.push({
        id: `s_${sections.length + 1}`,
        type: (['h1', 'h2', 'h3'] as const)[listLevel],
        title: line,
        content: '',
      });
      continue;
    }

    // Headings H1
    if (
      /^(?:\d+(?:\.\d+)*\.?\s+)?(giới thiệu|đặt vấn đề|mở đầu|introduction|phương pháp|methods|phương pháp nghiên cứu|vật liệu và phương pháp|kết quả|results|kết quả và thảo luận|bàn luận|thảo luận|discussion|kết luận|conclusion|conclusions|lời cảm ơn|acknowledgements|danh mục từ viết tắt|tuyên bố đóng góp của tác giả|tuyên bố xung đột lợi ích|đóng góp của các tác giả|xung đột lợi ích|tính khả dụng của dữ liệu|chấp thuận về đạo đức nghiên cứu|nguồn kinh phí|kinh phí|tài trợ|funding|author contributions|conflicts? of interest|data availability|ethics approval):?$/i.test(
        line
      ) ||
      /^(\d+)\.\s+([A-ZÀ-Ỹa-z\s:]{3,60})$/i.test(line) ||
      (/^[A-ZÀ-Ỹ\s:]{5,50}$/.test(line) && !line.includes('.') && !/^(hình|bảng|từ khóa|table|figure|liên hệ|lịch sử|bản quyền|copyright|ngày)/i.test(line) && i > 10)
    ) {
      isFrontMatterDone = true;
      sections.push({
        id: `s_${sections.length + 1}`,
        type: 'h1',
        title: line,
        content: '',
      });
      continue;
    }

    // Subheadings H2
    // "4.1. Kết quả…" / "4.2.2 Kiểm định…": short numbered line starting with a capital, not a sentence
    if (/^\d+\.\d+(?:\.\d+)*\.?\s+[A-ZÀ-Ỹ]/.test(line) && line.length <= 110 && !/[.;:]$/.test(line)) {
      isFrontMatterDone = true;
      sections.push({
        id: `s_${sections.length + 1}`,
        type: /^\d+\.\d+\.\d+/.test(line) ? 'h3' : 'h2',
        title: line,
        content: '',
      });
      continue;
    }

    // Figure captions
    const bareFigNum = figureCaptionNumber(line);
    if (/^(?:h\s*ình|hình|figure|fig\.|h\.)\s*(\d*)[:.]/i.test(line) || (bareFigNum && xmlCaptionNumbers.has(bareFigNum))) {
      isFrontMatterDone = true;
      const figNumMatch =
        line.match(/^(?:h\s*ình|hình|figure|fig\.|h\.)\s*(\d*)[:.]\s*(.*)/i) ?? line.match(/^(?:h\s*ình|hình|figure|fig\.?)\s*(\d+)\s+(.*)/i);
      const explicitNum = figNumMatch && figNumMatch[1] ? parseInt(figNumMatch[1], 10) : 0;
      const figNum = explicitNum || (sections.filter((s) => s.type === 'figure').length + 1);
      const rawCap = figNumMatch && figNumMatch[2] ? figNumMatch[2].trim() : line;
      const caption = rawCap.replace(/^[:.-]\s*/, '').trim() || `Hình ${figNum}`;
      const imageList = Array.from(imageMap.values());
      const matchedImg =
        figureImageMap.get(figNum) ||
        figureImageMap.get(explicitNum) ||
        (!xmlCaptionNumbers.has(figNum) && figNum <= imageList.length ? imageList[figNum - 1] : '') ||
        '';

      sections.push({
        id: `s_${sections.length + 1}`,
        type: 'figure',
        content: caption,
        figure: {
          id: `fig_${figNum}`,
          num: figNum,
          caption: caption,
          src: matchedImg,
          isFullWidth: true,
        },
      });
      continue;
    }

    // Figure source note (e.g. "(Nguồn: ...)", "(Source: ...)", "Nguồn: ...")
    const isFigureSource = /^\(?\s*(nguồn|source)\s*[:.]/i.test(line) || /^\(nguồn\b/i.test(line);
    if (isFigureSource && sections.length > 0) {
      const lastSec = sections[sections.length - 1];
      if (lastSec.type === 'figure' && lastSec.figure && !lastSec.figure.source) {
        lastSec.figure.source = line.trim();
        continue;
      }
    }

    // Citation block / Cách trích dẫn bài báo này (Special metadata section)
    const isCitationSection = /^(cách\s+trích\s+dẫn(\s+bài\s+báo(\s+này)?)?|trích\s+dẫn\s+bài\s+báo(\s+này)?|to\s+cite\s+this\s+article|how\s+to\s+cite):?/i.test(line);
    if (isCitationSection) {
      isFrontMatterDone = true;
      sections.push({
        id: `s_${sections.length + 1}`,
        type: 'citation',
        title: 'Trích dẫn bài báo này',
        content: line.replace(/^(cách\s+trích\s+dẫn(\s+bài\s+báo(\s+này)?)?|trích\s+dẫn\s+bài\s+báo(\s+này)?|to\s+cite\s+this\s+article|how\s+to\s+cite)[:\s-]*/i, '').trim() || line,
      });
      continue;
    }

    // Table / Appendix captions
    // "Bảng 1 Tên bảng" (a Word caption with no colon) is a caption when a table of that number carries the same text
    const lettersOnly = (s: string) => s.replace(/[^\p{L}]/gu, '').toLowerCase();
    const bareNum = line.length <= 250 ? line.match(/^(?:b\s*ảng|bảng|table)\s*(\d+)\s+\S/i)?.[1] : undefined;
    const isBareTableCaption =
      !!bareNum && openXmlTables.some((t) => !t.placed && t.type === 'table' && t.num === Number(bareNum) && lettersOnly(t.caption) === lettersOnly(line));
    const isTableCaption =
      isBareTableCaption ||
      line.length <= 250 &&
      !/^(?:b\s*ảng|bảng|table|b\.)\s*\d*[:.]?\s*(cho thấy|chỉ ra|biểu thị|được thể hiện|minh họa|mô tả|tóm tắt|được trình bày|shows|presents|indicates|illustrates|summarizes|phản ánh|cho biết|thể hiện)/i.test(
        line
      ) &&
      !/\b(p\s*[<=]|β\s*=|t\s*=|VIF|H\d+[:)])/i.test(line) &&
      /^(?:b\s*ảng|bảng|table|b\.)\s*(\d*)\s*[:.-]/i.test(line);

    const isAppendixCaption =
      line.length <= 250 &&
      /^(?:p\s*hụ\s*lục|phụ\s*lục|appendix)\s*(\d*)\s*[:.-]/i.test(line);

    if (isTableCaption) {
      isFrontMatterDone = true;
      const numMatch = line.match(/^(?:b\s*ảng|bảng|table|b\.)\s*(\d*)/i);
      const capNum = numMatch && numMatch[1] ? parseInt(numMatch[1], 10) : 0;

      let targetTable = capNum
        ? openXmlTables.find((t) => !t.placed && t.type === 'table' && t.num === capNum)
        : null;
      if (!targetTable) {
        targetTable = openXmlTables.find((t) => !t.placed && t.type === 'table');
      }

      const finalCaption = line.trim();
      const tableNum = capNum || (targetTable?.num ?? (sections.filter((s) => s.type === 'table').length + 1));

      sections.push({
        id: `s_${sections.length + 1}`,
        type: 'table',
        content: finalCaption,
        table: {
          id: targetTable ? targetTable.id : `tab_${tableNum}`,
          num: tableNum,
          caption: targetTable && targetTable.caption.length > finalCaption.length ? targetTable.caption : finalCaption,
          headers: targetTable ? targetTable.headers : ['Cột 1', 'Cột 2'],
          rows: targetTable ? targetTable.rows : [],
          headerRows: targetTable?.headerRows,
          bodyRows: targetTable?.bodyRows,
          isFullWidth: true,
        },
      });

      if (targetTable) {
        targetTable.placed = true;
      }
      continue;
    }

    if (isAppendixCaption) {
      isFrontMatterDone = true;
      const appNumMatch = line.match(/^(?:p\s*hụ\s*lục|phụ\s*lục|appendix)\s*(\d*)/i);
      const appNum = appNumMatch && appNumMatch[1] ? parseInt(appNumMatch[1], 10) : 0;

      let targetApp = appNum
        ? openXmlTables.find((t) => !t.placed && t.type === 'appendix' && t.num === appNum)
        : null;
      if (!targetApp) {
        targetApp = openXmlTables.find((t) => !t.placed && t.type === 'appendix');
      }

      if (targetApp) {
        targetApp.placed = true;
        sections.push({
          id: `s_${sections.length + 1}`,
          type: 'table',
          content: targetApp.caption,
          table: {
            id: targetApp.id,
            num: targetApp.num,
            caption: targetApp.caption,
            headers: targetApp.headers,
            rows: targetApp.rows,
            headerRows: targetApp.headerRows,
            bodyRows: targetApp.bodyRows,
            isFullWidth: true,
          },
        });
        continue;
      }
    }

    // "Chú thích: …" / "Nguồn: …" right after a table belong to that table
    if (attachTableFooterLine(sections, line)) continue;

    // Paragraph (short "n là số lượng mẫu" lines after "Trong đó:" are kept too)
    // an item of a list keeps its mark, however short it is
    const listMark = isFrontMatterDone ? listItems.get(line.trim())?.shift() : undefined;
    if (listMark) {
      sections.push({ id: `s_${sections.length + 1}`, type: 'paragraph', content: `${listMark}${line}` });
      continue;
    }
    if (line.length > 20 || (isFrontMatterDone && (isWhereDefinitionLine(line, sections[sections.length - 1]) || isNoneMark(line, sections[sections.length - 1])))) {
      if (!isFrontMatterDone) {
        continue;
      }
      sections.push({
        id: `s_${sections.length + 1}`,
        type: 'paragraph',
        content: line,
      });
    }
  }

  // Any remaining real tables that were not matched by text captions
  // (e.g. caption was embedded in table banner or had non-standard formatting)
  for (const t of openXmlTables) {
    if (!t.placed && (t.type === 'table' || t.type === 'appendix')) {
      t.placed = true;
      placeLeftoverTable(sections, {
        id: `s_tab_${t.id}`,
        type: 'table',
        content: t.caption,
        table: {
          id: t.id,
          num: t.num,
          caption: t.caption,
          headers: t.headers,
          rows: t.rows,
          headerRows: t.headerRows,
          bodyRows: t.bodyRows,
          isFullWidth: true,
        },
      });
    } else if (!t.placed && t.type === 'abbrev') {
      t.placed = placeAbbreviationTable(sections, t.headers, t.rows);
    }
  }

  // Recover Word equations (OMML) that the text pipeline cannot see.
  try {
    const eqs = extractDisplayEquations(openXmlParagraphs);
    if (eqs.length) {
      const res = insertEquations(sections, eqs);
      sections.splice(0, sections.length, ...res.sections);
      if (res.unplaced > 0) {
        console.warn(`[docx-parser] ${res.unplaced} công thức không xác định được vị trí chèn`);
      }
    }
  } catch (eqErr) {
    console.warn('[docx-parser] Không thể trích xuất công thức Word:', eqErr);
  }

  // Keep superscripts / subscripts (f², R², CO₂ …) that plain-text extraction flattens
  enrichScriptRuns(sections, openXmlParagraphs, references.length);
  applyTableLayoutHints(sections, Object.fromEntries(openXmlTables.map((t) => [t.id, !!t.landscape])));

  if (primaryLanguage === 'en') {
    // An English paper: what the loop read from the first page is the ENGLISH version, and the Vietnamese
    // version is the closing page. Put each text into the slot of its own language.
    const enTitle = titleEn || title;
    const enAbstract = abstractEn || abstract;
    const enKeywords = keywordsEn.length > 0 ? [...keywordsEn] : [...keywords];
    title = viBack?.title || enTitle;
    titleEn = enTitle;
    abstract = viBack?.abstract || enAbstract;
    abstractEn = enAbstract;
    keywords.splice(0, keywords.length, ...(viBack?.keywords.length ? viBack.keywords : enKeywords));
    keywordsEn.splice(0, keywordsEn.length, ...enKeywords);

    // "Article type: Research Article" -> the Vietnamese name of that type, and keep the English one
    const preset = findArticleTypePreset(articleType);
    if (preset) {
      articleType = preset.vi;
      articleTypeEn = preset.en;
    }

    // Names and institution: the first page has them without marks / in English; the closing page has them in Vietnamese
    if (viBack) {
      authors.forEach((a, idx) => {
        const viName = viBack.authorNames.find((n) => foldVietnamese(n) === foldVietnamese(a.name)) ?? (viBack.authorNames.length === authors.length ? viBack.authorNames[idx] : undefined);
        if (viName && foldVietnamese(viName) === foldVietnamese(a.name)) a.name = viName;
      });
      if (viBack.institution && affiliations.length === 1) {
        affiliations[0].nameEn = affiliations[0].nameEn || affiliations[0].name;
        affiliations[0].name = viBack.institution;
      }
    }
  }

  if (enBack) {
    if (!titleEn) titleEn = enBack.titleEn;
    if (!abstractEn) abstractEn = enBack.abstractEn;
    if (keywordsEn.length === 0) keywordsEn.push(...enBack.keywordsEn);
    enBack.affiliationsEn.forEach((a) => {
      const target = affiliations.find((x) => x.id === a.id) ?? (affiliations.length === 1 ? affiliations[0] : undefined);
      if (target && !target.nameEn) target.nameEn = a.name;
    });
  }

  if (!title) {
    title = fileName ? fileName.replace(/\.docx$/i, '') : 'Bản thảo chưa đặt tiêu đề';
  }

  if (authors.length === 0) {
    authors.push({
      id: 'a_1',
      name: 'Tác giả bài báo',
      affiliationIds: [1],
      isCorresponding: true,
    });
  }

  if (affiliations.length === 0) {
    affiliations.push({
      id: 1,
      name: 'Đại học Quốc gia Thành phố Hồ Chí Minh',
    });
  }

  if (!corresponding.name) corresponding.name = authors[0]?.name || '';
  if (!corresponding.affiliation) corresponding.affiliation = affiliations[0]?.name || '';

  // ALL-CAPS titles become sentence case (acronyms found elsewhere in the paper stay capital); original kept for undo
  const normalizedTitle = normalizeImportedTitle(title, [abstract, keywords.join(' '), ...sections.map((s) => s.content)]);
  // the English title too: a title typed in CAPITALS becomes sentence case (acronyms found elsewhere in the paper stay capital)
  const normalizedTitleEn = normalizeImportedTitle(titleEn, [abstractEn, keywordsEn.join(' '), abstract, ...sections.map((s) => s.content)]);
  const metadata: PaperMetadata = {
    title: normalizedTitle.title,
    titleOriginal: normalizedTitle.original,
    titleEn: normalizedTitleEn.title,
    ...(normalizedTitleEn.original ? { titleEnOriginal: normalizedTitleEn.original } : {}),
    articleType,
    ...(articleTypeEn ? { articleTypeEn } : {}),
    journalId: journalInfo.journalId,
    journalName: journalInfo.journalName,
    journalAbbv: journalInfo.journalAbbv,
    authors,
    affiliations,
    corresponding,
    abstract: abstract ? emphasiseText(abstract, openXmlParagraphs) : 'Chưa phát hiện phần tóm tắt trong tài liệu.',
    abstractEn: abstractEn ? emphasiseText(abstractEn, openXmlParagraphs) : abstractEn,
    keywords: keywords.length > 0 ? keywords : ['Báo cáo khoa học', 'VNUHCM'],
    keywordsEn,
    dates,
    // Publication data (DOI, volume, issue, pages) is assigned by the editorial office: never invent it.
    doi,
    volume,
    issue,
    year: year || '2026',
    firstPage,
    lastPage,
    // only the article id is knowable from the file name; the rest stays "?" until the editor enters it
    publication: articleIdFromFileName(fileName) ? { articleId: articleIdFromFileName(fileName) } : undefined,
    // what the import did and what it could not carry over (Track Changes, footnotes, comments, EMF/WMF, MathType)
    ...(prepared.notes.length ? { importNotes: prepared.notes } : {}),
    // the language the first page is written in: the title bar's language picker starts on it
    primaryLanguage,
  };

  const paper: CompletePaper = {
    id: `paper_${Date.now()}`,
    metadata,
    sections,
    // a DOI at the end of a reference ("Available from: https://doi.org/..." / "DOI: ...") is kept in its own field
    references: references.map((r) => {
      if (r.doi) return r;
      const split = splitReferenceDoi(r.raw);
      return split.doi ? { ...r, raw: split.raw, doi: split.doi } : r;
    }),
  };

  return paper;
}

export function computePreflightCheck(paper: CompletePaper): PreflightCheck {
  const { metadata, sections, references } = paper;

  const allText = sections.map((s) => s.content + ' ' + (s.title || '')).join(' ');
  const citedIds = new Set<number>();

  const citationRegex = /\[(\d+(?:[–-]\d+|,\s*\d+)*)\]/g;
  let match: RegExpExecArray | null;
  while ((match = citationRegex.exec(allText)) !== null) {
    const raw = match[1];
    const parts = raw.split(/,/);
    for (const part of parts) {
      if (part.includes('-') || part.includes('–')) {
        const [start, end] = part.split(/[–-]/).map(Number);
        if (!isNaN(start) && !isNaN(end)) {
          for (let k = start; k <= end; k++) citedIds.add(k);
        }
      } else {
        const num = Number(part.trim());
        if (!isNaN(num)) citedIds.add(num);
      }
    }
  }

  const uncitedReferences: number[] = [];
  references.forEach((ref) => {
    if (!citedIds.has(ref.id)) {
      uncitedReferences.push(ref.id);
    }
  });

  const refIds = new Set(references.map((r) => r.id));
  const missingCitations: number[] = [];
  citedIds.forEach((id) => {
    if (!refIds.has(id)) {
      missingCitations.push(id);
    }
  });

  const titleOk = Boolean(metadata.title && metadata.title !== 'Bản thảo chưa đặt tiêu đề' && metadata.title.length > 10);
  const titleEnOk = Boolean(metadata.titleEn && metadata.titleEn.trim().length > 10);

  const abstractWordCount = metadata.abstract ? metadata.abstract.split(/\s+/).filter(Boolean).length : 0;
  const abstractOk = Boolean(
    metadata.abstract &&
      abstractWordCount >= 40 &&
      !metadata.abstract.includes('Chưa phát hiện phần tóm tắt')
  );

  const abstractEnWordCount = metadata.abstractEn ? metadata.abstractEn.split(/\s+/).filter(Boolean).length : 0;
  const abstractEnOk = Boolean(metadata.abstractEn && abstractEnWordCount >= 30);

  const keywordsCount = metadata.keywords ? metadata.keywords.filter(Boolean).length : 0;
  const keywordsEnCount = metadata.keywordsEn ? metadata.keywordsEn.filter(Boolean).length : 0;

  const authorsCount = metadata.authors ? metadata.authors.length : 0;
  const affiliationsCount = metadata.affiliations ? metadata.affiliations.length : 0;

  const corrEmail = metadata.corresponding?.email || metadata.authors.find((a) => a.isCorresponding)?.email || '';
  const correspondingOk = Boolean(
    (metadata.corresponding?.name || metadata.authors.some((a) => a.isCorresponding)) &&
      corrEmail.includes('@')
  );

  const allTitles = sections.map((s) => (s.title || '').toLowerCase());
  const foundImradSections = {
    intro: allTitles.some((t) => /giới thiệu|đặt vấn đề|mở đầu|introduction/i.test(t)),
    methods: allTitles.some((t) => /phương pháp|vật liệu|thực nghiệm|đối tượng|methods|materials|khảo sát/i.test(t)),
    results: allTitles.some((t) => /kết quả|results|thực nghiệm và thảo luận/i.test(t)),
    discussion: allTitles.some((t) => /bàn luận|thảo luận|discussion|kết quả và thảo luận|tổng quan/i.test(t)),
    conclusion: allTitles.some((t) => /kết luận|conclusions?|kết luận và kiến nghị/i.test(t)),
  };
  const imradCount = Object.values(foundImradSections).filter(Boolean).length;
  const imradOk = imradCount >= 3;

  const totalFigures = sections.filter((s) => s.type === 'figure').length;
  const totalTables = sections.filter((s) => s.type === 'table').length;

  const issues: StructuralIssue[] = [];

  // 1. Metadata check
  if (!titleOk) {
    issues.push({
      id: 'iss_title',
      category: 'metadata',
      severity: 'error',
      title: 'Thiếu tiêu đề bài báo chính',
      message: 'Bản thảo chưa có tựa đề tiếng Việt hợp lệ hoặc tựa đề quá ngắn.',
      suggestion: 'Vui lòng bổ sung tiêu đề bài báo chính xác theo bản thảo nộp tạp chí.',
      fixTab: 'metadata',
    });
  }

  if (!titleEnOk) {
    issues.push({
      id: 'iss_title_en',
      category: 'metadata',
      severity: 'warning',
      title: 'Thiếu tiêu đề tiếng Anh (Title)',
      message: 'Quy chuẩn tạp chí ĐHQG-HCM bắt buộc có tiêu đề tiếng Anh để phục vụ chỉ mục Scopus / ACI.',
      suggestion: 'Bổ sung tiêu đề tiếng Anh trong tab "Thông tin chung".',
      fixTab: 'metadata',
    });
  }

  // 2. Authors & Affiliations
  if (authorsCount === 0) {
    issues.push({
      id: 'iss_authors',
      category: 'author',
      severity: 'error',
      title: 'Chưa có danh sách tác giả',
      message: 'Bài báo chưa được gán tên tác giả.',
      suggestion: 'Thêm danh sách tác giả trong tab "Tác giả & Đơn vị".',
      fixTab: 'authors',
    });
  }

  if (affiliationsCount === 0) {
    issues.push({
      id: 'iss_affiliations',
      category: 'author',
      severity: 'warning',
      title: 'Chưa có cơ quan / đơn vị công tác',
      message: 'Chưa có thông tin Trường, Viện hoặc Khoa công tác của tác giả.',
      suggestion: 'Bổ sung đơn vị công tác có đánh số thứ tự mũ.',
      fixTab: 'authors',
    });
  }

  if (!correspondingOk) {
    issues.push({
      id: 'iss_corresponding',
      category: 'author',
      severity: 'warning',
      title: 'Chưa chỉ định tác giả liên hệ hoặc thiếu Email',
      message: 'Bản thảo cần chỉ định 1 tác giả liên hệ kèm địa chỉ email chính xác để liên lạc phản biện.',
      suggestion: 'Cập nhật email tác giả liên hệ trong tab "Tác giả & Đơn vị".',
      fixTab: 'authors',
    });
  }

  // 3. Abstracts & Keywords
  if (!abstractOk) {
    issues.push({
      id: 'iss_abstract',
      category: 'abstract',
      severity: 'warning',
      title: 'Tóm tắt tiếng Việt chưa đạt chuẩn',
      message: `Tóm tắt hiện có ${abstractWordCount} từ (tiêu chuẩn VNUHCM yêu cầu từ 150 - 250 từ).`,
      suggestion: 'Bổ sung tóm tắt bao gồm: mục tiêu, phương pháp, kết quả nổi bật và kết luận.',
      fixTab: 'abstract',
    });
  }

  if (!abstractEnOk) {
    issues.push({
      id: 'iss_abstract_en',
      category: 'abstract',
      severity: 'warning',
      title: 'Thiếu tóm tắt tiếng Anh (Abstract)',
      message: 'Chưa trích xuất được Abstract tiếng Anh hoặc nội dung quá ngắn.',
      suggestion: 'Bổ sung Abstract tiếng Anh trong tab "Tóm tắt & Từ khóa".',
      fixTab: 'abstract',
    });
  }

  if (keywordsCount < 3) {
    issues.push({
      id: 'iss_keywords',
      category: 'abstract',
      severity: 'warning',
      title: `Số từ khóa tiếng Việt (${keywordsCount}) chưa đủ`,
      message: 'Quy định VNUHCM yêu cầu tối thiểu từ 3 đến 6 từ khóa chuyên ngành.',
      suggestion: 'Thêm từ khóa phân cách bằng dấu phẩy trong tab "Tóm tắt & Từ khóa".',
      fixTab: 'abstract',
    });
  }

  if (keywordsEnCount < 3) {
    issues.push({
      id: 'iss_keywords_en',
      category: 'abstract',
      severity: 'info',
      title: 'Chưa có đủ từ khóa tiếng Anh (Keywords)',
      message: 'Khuyến nghị bổ sung 3 - 6 keywords tiếng Anh song song với từ khóa tiếng Việt.',
      suggestion: 'Bổ sung keywords trong tab "Tóm tắt & Từ khóa".',
      fixTab: 'abstract',
    });
  }

  // 4. IMRaD Sections
  if (!foundImradSections.intro) {
    issues.push({
      id: 'iss_intro',
      category: 'content',
      severity: 'warning',
      title: 'Chưa phát hiện mục [Giới thiệu / Đặt vấn đề]',
      message: 'Khung bài báo khoa học chuẩn cần có mục Mở đầu hoặc Giới thiệu (Introduction).',
      suggestion: 'Kiểm tra lại tiêu đề mục cấp 1 (H1) trong nội dung bản thảo.',
      fixTab: 'sections',
    });
  }

  if (!foundImradSections.methods) {
    issues.push({
      id: 'iss_methods',
      category: 'content',
      severity: 'info',
      title: 'Khuyến nghị bổ sung mục [Phương pháp nghiên cứu]',
      message: 'Các bài báo thực nghiệm cần mục Methods / Phương pháp mô tả quy trình thực hiện.',
      suggestion: 'Đảm bảo có phần mô tả phương pháp, dữ liệu hoặc đối tượng nghiên cứu.',
      fixTab: 'sections',
    });
  }

  if (!foundImradSections.conclusion) {
    issues.push({
      id: 'iss_conclusion',
      category: 'content',
      severity: 'info',
      title: 'Khuyến nghị bổ sung mục [Kết luận]',
      message: 'Bài báo nên có phần Kết luận (Conclusion) tóm lược đóng góp và hướng nghiên cứu tương lai.',
      suggestion: 'Đặt tiêu đề H1 rõ ràng cho phần Kết luận ở cuối bài.',
      fixTab: 'sections',
    });
  }

  // 5. Vancouver Citations
  if (missingCitations.length > 0) {
    issues.push({
      id: 'iss_missing_cites',
      category: 'reference',
      severity: 'error',
      title: `Phát hiện ${missingCitations.length} trích dẫn thiếu trong danh mục tham khảo`,
      message: `Trong văn bản có viện dẫn các mã trích dẫn [${missingCitations.slice(0, 5).join(', ')}${missingCitations.length > 5 ? '...' : ''}] nhưng danh mục tài liệu chưa có mục tương ứng.`,
      suggestion: 'Thêm các mục tài liệu còn thiếu hoặc hiệu chỉnh lại chỉ số trích dẫn trong tab "Tài liệu tham khảo".',
      fixTab: 'refs',
    });
  }

  if (uncitedReferences.length > 0) {
    issues.push({
      id: 'iss_uncited_refs',
      category: 'reference',
      severity: 'warning',
      title: `Có ${uncitedReferences.length} tài liệu tham khảo chưa được viện dẫn trong bài`,
      message: `Tài liệu số [${uncitedReferences.slice(0, 5).join(', ')}${uncitedReferences.length > 5 ? '...' : ''}] có trong danh mục nhưng chưa thấy xuất hiện mã trích dẫn trong văn bản.`,
      suggestion: 'Kiểm tra bổ sung trích dẫn [X] vào nội dung bài viết tương ứng.',
      fixTab: 'refs',
    });
  }

  // 6. How to Cite (Citation) Check
  const citationSec = sections.find((s) => s.type === 'citation');
  const citationOk = Boolean(citationSec && citationSec.content && citationSec.content.trim().length > 10);
  if (!citationOk) {
    issues.push({
      id: 'iss_missing_citation',
      category: 'metadata',
      severity: 'error',
      title: 'Thiếu phần trích dẫn bài báo (How to cite)',
      message: 'Bản thảo chưa có phần "Trích dẫn bài báo này" (How to cite). Đây là mục bắt buộc cho tạp chí ĐHQG-HCM.',
      suggestion: 'Bổ sung thông tin trích dẫn bài báo trong tab "Trích dẫn bài báo".',
      fixTab: 'citation',
    });
  }

  // 7. Empty Tables & Table Captions
  let emptyTablesCount = 0;
  let tablesNoCaptionCount = 0;
  sections
    .filter((s) => s.type === 'table')
    .forEach((s, idx) => {
      const tbl = s.table;
      const hasCells =
        tbl &&
        ((tbl.headers && tbl.headers.some((h) => h.trim())) ||
          (tbl.rows && tbl.rows.some((row) => row.some((cell) => cell.trim()))) ||
          (tbl.bodyRows && tbl.bodyRows.some((row) => row.some((cell) => cell.text?.trim()))));

      if (!tbl || !hasCells) {
        emptyTablesCount++;
        issues.push({
          id: `iss_empty_table_${s.id || idx}`,
          category: 'table_fig',
          severity: 'error',
          title: `Bảng ${tbl?.num ? tbl.num + ' ' : ''}trống không`,
          message: `Bảng số liệu ${tbl?.num ? 'số ' + tbl.num : ''} chưa có bất kỳ dữ liệu hàng hay cột nào.`,
          suggestion: 'Nhập dữ liệu cho bảng, dán từ Clipboard hoặc xóa bảng nếu không dùng.',
          fixTab: 'sections',
        });
      }

      if (!tbl?.caption || !tbl.caption.trim()) {
        tablesNoCaptionCount++;
        issues.push({
          id: `iss_tbl_no_cap_${s.id || idx}`,
          category: 'table_fig',
          severity: 'error',
          title: `Bảng ${tbl?.num ? tbl.num + ' ' : ''}thiếu chú thích (Caption)`,
          message: `Bảng ${tbl?.num || ''} chưa có tên hoặc chú thích tiêu đề bảng (caption).`,
          suggestion: 'Quy chuẩn bài báo yêu cầu tất cả bảng biểu phải có chú thích tiêu đề phía trên.',
          fixTab: 'sections',
        });
      }
    });

  // 8. Empty Figures & Figure Captions
  let emptyFiguresCount = 0;
  let figuresNoCaptionCount = 0;
  sections
    .filter((s) => s.type === 'figure')
    .forEach((s, idx) => {
      const fig = s.figure;
      if (!fig || !fig.src || !fig.src.trim()) {
        emptyFiguresCount++;
        issues.push({
          id: `iss_empty_fig_${s.id || idx}`,
          category: 'table_fig',
          severity: 'error',
          title: `Hình ảnh ${fig?.num ? fig.num + ' ' : ''}trống không`,
          message: `Hình ${fig?.num || ''} chưa có tệp ảnh hoặc đường dẫn hình ảnh được tải lên.`,
          suggestion: 'Tải lên tệp ảnh hoặc dán ảnh vào khung hình ảnh minh họa.',
          fixTab: 'sections',
        });
      }

      if (!fig?.caption || !fig.caption.trim()) {
        figuresNoCaptionCount++;
        issues.push({
          id: `iss_fig_no_cap_${s.id || idx}`,
          category: 'table_fig',
          severity: 'error',
          title: `Hình ${fig?.num ? fig.num + ' ' : ''}thiếu chú thích (Caption)`,
          message: `Hình ${fig?.num || ''} chưa có tên hoặc chú thích tiêu đề hình (caption).`,
          suggestion: 'Quy chuẩn bài báo yêu cầu tất cả hình ảnh minh họa phải có chú thích phía dưới.',
          fixTab: 'sections',
        });
      }
    });

  // 9. Empty Headings & Empty Paragraphs
  let emptyHeadingsCount = 0;
  let emptyParasCount = 0;
  sections.forEach((s, idx) => {
    if (['h1', 'h2', 'h3'].includes(s.type)) {
      if (!s.title || !s.title.trim()) {
        emptyHeadingsCount++;
        issues.push({
          id: `iss_empty_heading_${s.id || idx}`,
          category: 'content',
          severity: 'error',
          title: `Tiêu đề mục (${s.type.toUpperCase()}) để trống`,
          message: 'Phát hiện tiêu đề đề mục trong nội dung bài viết đang bị để trống.',
          suggestion: 'Vui lòng nhập tên tiêu đề hoặc xóa mục này nếu không sử dụng.',
          fixTab: 'sections',
        });
      }
    } else if (s.type === 'paragraph') {
      if (!s.content || !s.content.trim()) {
        emptyParasCount++;
        issues.push({
          id: `iss_empty_para_${s.id || idx}`,
          category: 'content',
          severity: 'error',
          title: 'Đoạn văn bản để trống',
          message: 'Phát hiện đoạn văn bản trong bài đang để trống không có nội dung.',
          suggestion: 'Vui lòng nhập nội dung cho đoạn văn hoặc xóa đoạn trống này.',
          fixTab: 'sections',
        });
      }
    }
  });

  // 10. Empty References
  let emptyRefsCount = 0;
  references.forEach((r) => {
    if (!r.raw || !r.raw.trim()) {
      emptyRefsCount++;
      issues.push({
        id: `iss_empty_ref_${r.id}`,
        category: 'reference',
        severity: 'error',
        title: `Tài liệu tham khảo [${r.id}] để trống`,
        message: `Mục tài liệu tham khảo số [${r.id}] chưa có nội dung trích dẫn.`,
        suggestion: 'Vui lòng nhập thông tin trích dẫn theo chuẩn Vancouver hoặc xóa mục trống.',
        fixTab: 'refs',
      });
    }
  });

  // Score computation
  let score = 100;
  if (!titleOk) score -= 15;
  if (!titleEnOk) score -= 8;
  if (!abstractOk) score -= 12;
  if (!abstractEnOk) score -= 8;
  if (keywordsCount < 3) score -= 8;
  if (authorsCount === 0) score -= 15;
  if (!correspondingOk) score -= 8;
  if (!imradOk) score -= 10;
  score -= Math.min(uncitedReferences.length * 2, 8);
  score -= Math.min(missingCitations.length * 4, 15);

  // Deductions for strict error issues
  if (!citationOk) score -= 10;
  score -= Math.min(emptyTablesCount * 10, 20);
  score -= Math.min(tablesNoCaptionCount * 5, 15);
  score -= Math.min(emptyFiguresCount * 10, 20);
  score -= Math.min(figuresNoCaptionCount * 5, 15);
  score -= Math.min(emptyHeadingsCount * 5, 15);
  score -= Math.min(emptyParasCount * 5, 15);
  score -= Math.min(emptyRefsCount * 5, 15);

  return {
    titleOk,
    titleEnOk,
    abstractOk,
    abstractEnOk,
    citationOk,
    keywordsCount,
    keywordsEnCount,
    authorsCount,
    affiliationsCount,
    correspondingOk,
    imradOk,
    foundImradSections,
    totalFigures,
    totalTables,
    totalReferences: references.length,
    uncitedReferences,
    missingCitations,
    vancouverConformant: references.length > 0 && missingCitations.length === 0,
    score: Math.min(Math.max(score, 0), 100),
    issues,
  };
}

export interface AiParseOptions {
  /** @deprecated API key is managed securely on the server */
  apiKey?: string;
  model?: string;
  onProgress?: (status: string) => void;
}

/**
 * Intelligent AI-Powered DOCX Extractor (OpenAI GPT-5.4-mini / GPT-4o-mini).
 * Combines full OpenXML figure/media extraction and OMML math preservation
 * with deep semantic understanding of academic front matter and complex tables.
 */
export async function parseDocxFileWithAi(
  fileBuffer: ArrayBuffer,
  fileName?: string,
  options?: AiParseOptions
): Promise<CompletePaper> {
  const onProgress = options?.onProgress || (() => {});
  onProgress('Đang phân tích cấu trúc OpenXML và trích xuất hình ảnh...');

  // Step 1: Base OpenXML extraction (figures, OMML math, sections, references)
  const basePaper = await parseDocxFile(fileBuffer, fileName);

  onProgress('Đang gửi dữ liệu đến mô hình AI GPT-5.4-mini...');

  const mammothOpts: any = { arrayBuffer: fileBuffer };
  if (typeof Buffer !== 'undefined') {
    mammothOpts.buffer = Buffer.isBuffer(fileBuffer) ? fileBuffer : Buffer.from(fileBuffer);
  }

  let fullRawText = '';
  try {
    const rawResult = await mammoth.extractRawText(mammothOpts);
    fullRawText = rawResult.value;
  } catch (e) {
    fullRawText = basePaper.sections.map((s) => s.content).join('\n');
  }

  try {
    onProgress('AI đang bóc tách Tiêu đề song ngữ, Tác giả, Đơn vị & Tóm tắt...');
    const metaRes = await fetch('/api/ai/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'metadata',
        text: fullRawText.slice(0, 7000),
        model: options?.model || 'gpt-5.4-mini',
      }),
    });

    if (metaRes.ok) {
      const metaData = await metaRes.json();
      const aiData = metaData.data;

      if (aiData) {
        if (aiData.title && aiData.title.trim()) basePaper.metadata.title = aiData.title.trim();
        if (aiData.titleEn && aiData.titleEn.trim()) basePaper.metadata.titleEn = aiData.titleEn.trim();
        if (aiData.articleType && aiData.articleType.trim()) basePaper.metadata.articleType = aiData.articleType.trim();
        const aiJournal = findJournalTemplate(aiData.journalId);
        if (aiData.journalId && aiJournal) {
          basePaper.metadata.journalId = aiData.journalId;
          basePaper.metadata.journalName = aiJournal.name;
          basePaper.metadata.journalAbbv = aiJournal.shortName;
        }
        if (Array.isArray(aiData.authors) && aiData.authors.length > 0) {
          basePaper.metadata.authors = aiData.authors.map((a: any, idx: number) => ({
            id: `a_${idx + 1}`,
            name: normalizeVietnameseWordSpacing(a.name || `Tác giả ${idx + 1}`),
            affiliationIds: Array.isArray(a.affiliationIds) && a.affiliationIds.length > 0 ? a.affiliationIds : [1],
            isCorresponding: Boolean(a.isCorresponding),
          }));
        }
        if (Array.isArray(aiData.affiliations) && aiData.affiliations.length > 0) {
          basePaper.metadata.affiliations = aiData.affiliations.map((aff: any, idx: number) => ({
            id: aff.id || idx + 1,
            name: aff.name,
          }));
        }
        if (aiData.corresponding && aiData.corresponding.name) {
          basePaper.metadata.corresponding = {
            name: normalizeVietnameseWordSpacing(aiData.corresponding.name),
            email: aiData.corresponding.email || '',
            affiliation: aiData.corresponding.affiliation || (basePaper.metadata.affiliations[0]?.name ?? ''),
          };
        }
        if (aiData.abstract && aiData.abstract.trim()) basePaper.metadata.abstract = aiData.abstract.trim();
        if (aiData.abstractEn && aiData.abstractEn.trim()) basePaper.metadata.abstractEn = aiData.abstractEn.trim();
        if (Array.isArray(aiData.keywords) && aiData.keywords.length > 0) {
          basePaper.metadata.keywords = aiData.keywords;
        }
        if (Array.isArray(aiData.keywordsEn) && aiData.keywordsEn.length > 0) {
          basePaper.metadata.keywordsEn = aiData.keywordsEn;
        }
        if (aiData.dates) {
          if (aiData.dates.received) basePaper.metadata.dates.received = aiData.dates.received;
          if (aiData.dates.revised) basePaper.metadata.dates.revised = aiData.dates.revised;
          if (aiData.dates.accepted) basePaper.metadata.dates.accepted = aiData.dates.accepted;
          if (aiData.dates.published) basePaper.metadata.dates.published = aiData.dates.published;
        }
        if (aiData.doi) basePaper.metadata.doi = aiData.doi;
        if (aiData.volume) basePaper.metadata.volume = aiData.volume;
        if (aiData.issue) basePaper.metadata.issue = aiData.issue;
        if (aiData.year) basePaper.metadata.year = aiData.year;
      }
    }

    // Step 3: Check for empty tables (e.g. textbox tables) and reconstruct with AI
    const emptyTables = basePaper.sections.filter(
      (s) => s.type === 'table' && s.table && s.table.rows.length === 0
    );

    if (emptyTables.length > 0) {
      onProgress('AI đang tái cấu trúc các bảng biểu đặc biệt/textbox...');
      for (const tSec of emptyTables) {
        if (!tSec.table) continue;
        const caption = tSec.table.caption;
        const captionIdx = fullRawText.indexOf(caption);
        let tableSlice = '';
        if (captionIdx !== -1) {
          tableSlice = fullRawText.slice(captionIdx, captionIdx + 3000);
        } else {
          const numMatch = caption.match(/\d+/);
          const tKw = numMatch ? `Bảng ${numMatch[0]}` : 'Bảng';
          const altIdx = fullRawText.indexOf(tKw);
          if (altIdx !== -1) {
            tableSlice = fullRawText.slice(altIdx, altIdx + 3000);
          }
        }

        if (tableSlice) {
          const tRes = await fetch('/api/ai/proxy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'table',
              text: tableSlice,
              model: options?.model || 'gpt-5.4-mini',
            }),
          });
          if (tRes.ok) {
            const tData = await tRes.json();
            if (tData.data && Array.isArray(tData.data.headers) && Array.isArray(tData.data.rows) && tData.data.rows.length > 0) {
              tSec.table.headers = tData.data.headers;
              tSec.table.rows = tData.data.rows;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('AI extraction warning (falling back to OpenXML):', err);
  }

  // Step 4: Validate and sanitize table captions to prevent narrative paragraphs from leaking
  basePaper.sections.forEach((s) => {
    if (s.type === 'table' && s.table) {
      if (
        s.table.caption &&
        (s.table.caption.length > 120 ||
          /\b(p\s*[<=]|β\s*=|t\s*=|VIF|H\d+[:)])/i.test(s.table.caption) ||
          /cho thấy|chỉ ra|biểu thị|minh họa|mô tả/i.test(s.table.caption))
      ) {
        const m = s.table.caption.match(/^(bảng|table|b\.)\s*\d+[:.-]?\s*([^.\n]{3,80})/i);
        if (m) {
          s.table.caption = `${m[1]} ${m[2]}`.trim();
        } else {
          s.table.caption = `Bảng ${s.table.num || 1}`;
        }
        s.content = s.table.caption;
      }
    }
  });

  onProgress('Hoàn tất trích xuất và tối ưu hóa!');
  return basePaper;
}
