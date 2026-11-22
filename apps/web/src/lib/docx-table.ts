import { Paragraph, Table, TableRow, TableCell, TextRun, WidthType, ShadingType, AlignmentType, VerticalAlign, BorderStyle, HeightRule } from 'docx';
import { DEFAULT_BORDER_WIDTH, hasCustomTableLook, rgbCsv, rowHeightOf, tableRulesOf } from './table-style';
import type { PaperTable, TableCell as PaperCell } from '@/types/paper';
import type { ResolvedTheme } from './theme-config';

import { stripCaptionLabel } from './docx-table-extras';
import { resolveBodyFill, rowIsTinted } from './table-fill';
import { parseMarkup } from './inline-markup';
import { sourceLinesOf, sourceLook } from './table-source';
const FONT_SERIF = 'Times New Roman';
const FONT_SANS = 'Calibri';

/** One Paragraph per line, so multi-line cells keep their line breaks in Word. */
function cellParagraphs(text: string, font: string, size: number, bold = false, center = false): Paragraph[] {
  // <b>, <i>, <u>, <color=…> runs inside a line keep their emphasis
  return String(text ?? '')
    .split('\n')
    .map(
      (line) =>
        new Paragraph({
          alignment: center ? AlignmentType.CENTER : undefined,
          children: parseMarkup(line).map(
            (s) => new TextRun({ text: s.text, font, size, bold: bold || s.b || undefined, italics: s.i || undefined, underline: s.u ? {} : undefined, ...(s.color ? { color: s.color.slice(1) } : {}) })
          ),
        })
    );
}

/** Cell rows with spans; plain string rows become one-cell-per-column rows. */
const asCells = (rows: string[][]): PaperCell[][] => rows.map((r) => r.map((text) => ({ text })));

/**
 * Word table block: caption, the table (header rows repeat on every page, rows never split,
 * merged cells kept: colSpan -> gridSpan, rowSpan -> vMerge), and the "Nguồn: …" source line.
 */
export function buildDocxTable(table: PaperTable, theme: ResolvedTheme, widthTwips?: number): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  const bodyFill = resolveBodyFill(table);
  const COLOR_TITLE = theme.titleColor.slice(1);
  out.push(
    new Paragraph({
      style: 'TableCaption',
      keepNext: true,
      children: [
        new TextRun({ text: `Bảng ${table.num}: `, font: FONT_SANS, size: 17, bold: true, color: COLOR_TITLE }),
        new TextRun({ text: stripCaptionLabel(table.caption), font: FONT_SANS, size: 17, bold: true }),
      ],
      spacing: { before: 200, after: 100 },
    })
  );

  const headerRows: PaperCell[][] = table.headerRows && table.headerRows.length > 1 ? table.headerRows : [table.headers.map((text) => ({ text }))];
  const bodyRows: PaperCell[][] = table.bodyRows && table.bodyRows.length > 0 ? table.bodyRows : asCells(table.rows || []);
  const cols = Math.max(table.headers.length, ...bodyRows.map((r) => r.reduce((n, c) => n + (c.colSpan ?? 1), 0)), 1);

  const hex = (h: string | undefined, fallback: string) => (rgbCsv(h) ? (h as string).slice(1).toUpperCase() : fallback);
  const cell = (c: PaperCell, header: boolean, fill: string) =>
    new TableCell({
      shading: { type: ShadingType.CLEAR, fill: hex(c.fill, fill), color: 'auto' },
      verticalAlign: VerticalAlign.CENTER,
      ...(c.colSpan && c.colSpan > 1 ? { columnSpan: c.colSpan } : {}),
      ...(c.rowSpan && c.rowSpan > 1 ? { rowSpan: c.rowSpan } : {}),
      children: cellParagraphs(c.text, header ? FONT_SANS : FONT_SERIF, 16, header, header || (c.colSpan ?? 1) > 1),
    });

  const tableRows: TableRow[] = [
    ...headerRows.map(
      (r) =>
        new TableRow({
          // Repeat the header rows on every page the table spans; never split a row.
          tableHeader: theme.repeatTableHeader,
          cantSplit: true,
          ...(table.headerHeight && table.headerHeight > 0 ? { height: { value: Math.round(table.headerHeight * 20), rule: HeightRule.ATLEAST } } : {}),
          children: r.map((c) => cell(c, true, hex(table.headerFill, theme.tableHeaderColor.slice(1)))),
        })
    ),
    ...bodyRows.map((r, rIdx) => {
      const h = rowHeightOf(table, rIdx);
      return new TableRow({
        cantSplit: true,
        ...(h ? { height: { value: Math.round(h * 20), rule: HeightRule.ATLEAST } } : {}),
        children: r.map((c) => cell(c, false, rowIsTinted(bodyFill, rIdx) ? hex(table.bodyTint, theme.tableZebraColor.slice(1)) : 'FFFFFF')),
      });
    }),
  ];

  // lines: only written when the table asks for something other than the journal's default
  const rules = tableRulesOf(table);
  const lineWidth = Math.max(2, Math.round((table.borderWidth ?? DEFAULT_BORDER_WIDTH) * 8)); // eighths of a point
  const lineColor = hex(table.borderColor, '000000');
  const line = (on: boolean) => (on ? { style: BorderStyle.SINGLE, size: lineWidth, color: lineColor } : { style: BorderStyle.NONE, size: 0, color: 'auto' });
  const borders = hasCustomTableLook(table)
    ? {
        borders: {
          top: line(rules.top),
          bottom: line(rules.bottom),
          left: line(rules.vOuter),
          right: line(rules.vOuter),
          insideHorizontal: line(rules.hInner),
          insideVertical: line(rules.vInner),
        },
      }
    : {};

  out.push(
    new Table({
      rows: tableRows,
      ...borders,
      ...(widthTwips
        ? { width: { size: widthTwips, type: WidthType.DXA }, columnWidths: Array(cols).fill(Math.floor(widthTwips / cols)) }
        : { width: { size: 100, type: WidthType.PERCENTAGE } }),
    })
  );
  const srcLines = sourceLinesOf(table.source);
  if (srcLines.length > 0) {
    // the same lines, the same bold / italic / alignment as the PDF (see lib/table-source)
    const align = sourceLook(table.sourceStyle, srcLines[0]).align;
    out.push(
      new Paragraph({
        style: 'SourceLine',
        alignment: align === 'center' ? AlignmentType.CENTER : align === 'right' ? AlignmentType.RIGHT : AlignmentType.LEFT,
        children: srcLines.flatMap((l, i) => {
          const look = sourceLook(table.sourceStyle, l);
          return parseMarkup(l).map(
            (s, k) =>
              new TextRun({ text: s.text, font: FONT_SANS, size: 15, italics: look.italic || s.i || undefined, bold: look.bold || s.b || undefined, underline: s.u ? {} : undefined, break: i > 0 && k === 0 ? 1 : 0 })
          );
        }),
        spacing: { before: 40, after: 160 },
      })
    );
  } else {
    out.push(new Paragraph({ spacing: { after: 120 }, children: [] }));
  }
  return out;
}
