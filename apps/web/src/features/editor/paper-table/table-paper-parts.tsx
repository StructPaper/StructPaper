'use client';

import React, { useLayoutEffect, useRef } from 'react';
import type { PaperTable } from '@/types/paper';
import type { ResolvedTheme } from '@/lib/theme-config';
import { markupToHtml } from '@/lib/inline-markup';
import { htmlToMarkup } from '@/lib/table-markup-dom';
import { horizontalLine, rowValign, rowsOf, verticalLines } from '@/lib/table-cell-lines';
import { resolveBodyFill, rowIsTinted } from '@/lib/table-fill';
import { sourceLinesOf, sourceLook } from '@/lib/table-source';
import { tableRulesOf, DEFAULT_BORDER_WIDTH, rowHeightOf } from '@/lib/table-style';
import { colsOfGrid, type GridCell, type Range, type TableGrid } from '@/lib/table-grid';
import { columnWidthsPt, type Piece, type TablePaperLook } from '@/lib/table-pages';

/**
 * A field of the table shown on the sheet that can be typed in (a cell, the caption, the source). The text is the tagged string the
 * model stores; what is typed is read back into it. The element is only redrawn when the text differs from what it shows, so the caret
 * stays where it is while its own text comes back.
 */
export const Editable: React.FC<{
  text: string;
  onText?: (text: string) => void;
  className?: string;
  editable?: boolean;
  tag?: 'div' | 'span';
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
  placeholder?: string;
  dataAttrs?: Record<string, string>;
}> = ({ text, onText, className, editable = true, tag = 'div', onKeyDown, onFocus, onBlur, placeholder, dataAttrs }) => {
  const el = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const n = el.current;
    if (!n) return;
    if (htmlToMarkup(n) !== text) n.innerHTML = markupToHtml(text);
  }, [text]);
  const Tag = tag as 'div';
  return (
    <Tag
      ref={el as React.RefObject<HTMLDivElement>}
      className={className}
      contentEditable={editable}
      suppressContentEditableWarning
      spellCheck={false}
      data-placeholder={placeholder}
      {...dataAttrs}
      onInput={editable ? () => onText?.(htmlToMarkup(el.current as HTMLElement)) : undefined}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      onPaste={
        editable
          ? (e) => {
              // a paste is plain text: what comes from a page or a Word file brings its own fonts and colours
              e.preventDefault();
              const t = e.clipboardData.getData('text/plain');
              document.execCommand('insertText', false, t);
            }
          : undefined
      }
      onDrop={editable ? (e) => e.preventDefault() : undefined}
    />
  );
};

export interface PieceHandlers {
  onCellDown: (r: number, c: number, e: React.PointerEvent) => void;
  onCellEnter: (r: number, c: number, e: React.PointerEvent) => void;
  onCellText: (r: number, c: number, text: string) => void;
  onCellKey: (r: number, c: number, e: React.KeyboardEvent<HTMLElement>) => void;
  onCaption: (text: string) => void;
  onSource: (text: string) => void;
  onResizeStart: (kind: 'col' | 'row', index: number, e: React.PointerEvent) => void;
}

export interface PieceProps {
  piece: Piece;
  table: PaperTable;
  grid: TableGrid;
  theme: ResolvedTheme;
  look: TablePaperLook;
  weights: number[];
  /** Width of the table in points. */
  widthPt: number;
  lang: 'vi' | 'en';
  /** Drawn for measuring: with a "continued" line and a foot line besides, and nothing to click. */
  measure?: boolean;
  interactive?: boolean;
  selection?: Range | null;
  active?: { r: number; c: number } | null;
  handlers?: PieceHandlers;
  /** What the table's own number is called ("Bảng 2:" / "Phụ lục 2."). */
  label: string;
  continuedTitle: string;
  continuedFoot: string;
  /** Body rows start at this row of the grid (the head is the rows before). */
  tableAlign?: 'left' | 'center' | 'right';
}

const px = (n: number | undefined) => (n === undefined ? undefined : `${n}pt`);

/** The table piece as one sheet draws it: caption, the head (again when it is a later piece), its rows, the foot line, the source. */
export const PieceTable: React.FC<PieceProps> = ({
  piece,
  table,
  grid,
  theme,
  look,
  weights,
  widthPt,
  lang,
  measure,
  interactive,
  selection,
  active,
  handlers,
  label,
  continuedTitle,
  continuedFoot,
}) => {
  const cols = colsOfGrid(grid);
  const head = grid.head;
  const R = grid.cells.length;
  const rules = tableRulesOf(table);
  const fill = resolveBodyFill(table);
  const hLines = Array.from({ length: R + 1 }, (_, b) => horizontalLine(table, rules, b, cols).lines);
  const vLines = Array.from({ length: R }, (_, r) => verticalLines(table, rules, r, cols).lines);
  const widths = columnWidthsPt(weights, widthPt);
  const repeatHead = theme.repeatTableHeader;
  const showHead = piece.first || repeatHead || !!measure;
  const rowsRendered: number[] = [];
  if (showHead) for (let r = 0; r < head; r++) rowsRendered.push(r);
  for (let r = head + piece.start; r < head + piece.end; r++) rowsRendered.push(r);
  const firstRendered = rowsRendered[0];
  const lastRendered = rowsRendered[rowsRendered.length - 1];
  const isHeadRow = (r: number) => r < head;
  const headFill = table.headerFill || theme.tableHeaderColor;
  const tint = table.bodyTint || theme.tableZebraColor;
  const ruleW = table.borderWidth && table.borderWidth > 0 ? table.borderWidth : DEFAULT_BORDER_WIDTH;
  const padV = (look.linePt * look.stretch - look.linePt) / 2;
  const captionText = table.caption ?? '';
  const srcLines = sourceLinesOf(table.source);
  const rowIdxOfBody = (r: number) => r - head;

  const renderCell = (r: number, c: number, key: string, inHead: boolean, clone: boolean): React.ReactNode => {
    const cell = grid.cells[r]?.[c];
    if (!cell) return null;
    const rowCells = grid.cells[r].filter((x) => !x.covered);
    const edit = interactive && !clone;
    if (cell.covered) {
      const o = cell.covered;
      // a place under a merged cell that is drawn on this piece belongs to that cell; one whose cell began on an earlier piece is blank here
      if (rowsRendered.includes(o.r)) return null;
      // (a run of blanks of one merged cell is one blank cell)
      const prev = grid.cells[r][c - 1];
      if (prev && prev.covered && prev.covered.r === o.r && prev.covered.c === o.c) return null;
      let span = 1;
      while (grid.cells[r][c + span]?.covered && grid.cells[r][c + span].covered!.r === o.r && grid.cells[r][c + span].covered!.c === o.c) span++;
      return <td key={key} colSpan={span} data-top={String(false)} />;
    }
    const lastRow = Math.min(r + cell.rowSpan - 1, inHead ? head - 1 : head + piece.end - 1);
    const rs = lastRow - r + 1;
    const first = r === firstRendered;
    const top = first ? (piece.first ? hLines[0][c] : false) : hLines[r][c];
    const lastOfPiece = lastRow === lastRendered;
    const bottom = lastOfPiece ? (piece.last ? hLines[R][c] : true) : hLines[lastRow + 1][c];
    const left = vLines[r][c];
    const right = vLines[r][Math.min(cols, c + cell.colSpan)];
    const valign = cell.valign ?? rowValign(rowCells);
    const bodyIdx = rowIdxOfBody(r);
    const align = cell.align ?? (inHead ? 'center' : 'left');
    const selected = !!selection && !clone && r >= selection.r0 && r <= selection.r1 && c >= selection.c0 && c <= selection.c1;
    const isActive = !!active && !clone && active.r === r && active.c === c;
    const minH = inHead ? table.headerHeight : rowHeightOf(table, bodyIdx);
    const style: React.CSSProperties = {
      textAlign: align,
      ...(cell.fill ? ({ ['--tp-cell-fill' as string]: cell.fill } as React.CSSProperties) : {}),
      ...(minH && rs === 1 ? { height: px(minH) } : {}),
    };
    const lastCol = c + cell.colSpan >= cols;
    return (
      <td
        key={key}
        colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
        rowSpan={rs > 1 ? rs : undefined}
        data-head={inHead ? 'true' : undefined}
        data-fill={cell.fill ? 'true' : undefined}
        data-top={String(top)}
        data-bottom={String(bottom)}
        data-left={String(left)}
        data-right={String(right)}
        data-valign={valign}
        data-last-col={lastCol ? 'true' : undefined}
        data-r={edit ? r : undefined}
        data-c={edit ? c : undefined}
        className={`${selected ? 'tp-sel' : ''} ${isActive ? 'tp-active' : ''}`}
        style={style}
        onPointerDown={edit ? (e) => handlers?.onCellDown(r, c, e) : undefined}
        onPointerEnter={edit ? (e) => handlers?.onCellEnter(r, c, e) : undefined}
      >
        <Editable
          className="tp-cell"
          text={cell.text}
          editable={!!edit}
          onText={(t) => handlers?.onCellText(r, c, t)}
          onKeyDown={edit ? (e) => handlers?.onCellKey(r, c, e) : undefined}
        />
        {edit && (
          <>
            <i
              className="tp-colh"
              onPointerDown={(e) => {
                e.stopPropagation();
                handlers?.onResizeStart('col', Math.min(cols - 1, c + cell.colSpan - 1), e);
              }}
            />
            <i
              className="tp-rowh"
              onPointerDown={(e) => {
                e.stopPropagation();
                handlers?.onResizeStart('row', lastRow, e);
              }}
            />
          </>
        )}
      </td>
    );
  };

  const renderRow = (r: number, clone: boolean) => {
    const inHead = isHeadRow(r);
    const tinted = !inHead && rowIsTinted(fill, rowIdxOfBody(r));
    return (
      <tr
        key={`${clone ? 'c' : 'r'}${r}`}
        data-kind={inHead ? 'head' : 'body'}
        data-row={inHead ? undefined : rowIdxOfBody(r)}
        data-tint={tinted ? 'true' : undefined}
      >
        {Array.from({ length: cols }, (_, c) => renderCell(r, c, `${r}:${c}`, inHead, clone))}
      </tr>
    );
  };

  const srcAlign = srcLines.length > 0 ? sourceLook(table.sourceStyle, srcLines[0]).align : 'left';
  const vars = {
    ['--tp-font' as string]: `${look.fontPt}pt`,
    ['--tp-line' as string]: `${look.linePt}pt`,
    ['--tp-padv' as string]: `${padV}pt`,
    ['--tp-head' as string]: headFill,
    ['--tp-tint' as string]: tint,
    ['--tp-title' as string]: theme.titleColor,
    ['--tp-w' as string]: `${ruleW}pt`,
    ['--tp-color' as string]: table.borderColor || '#000',
  } as React.CSSProperties;

  return (
    <div className="tp-piece" style={vars}>
      {piece.first && (
        <div className="tp-caption" data-measure="caption">
          <span className="tp-label">{label} </span>
          {measure || !interactive ? (
            <Editable text={captionText} editable={false} tag="span" />
          ) : (
            <Editable text={captionText} tag="span" onText={handlers?.onCaption} placeholder={lang === 'en' ? 'Table title' : 'Tên bảng'} />
          )}
        </div>
      )}
      <table className="tp-table" style={{ width: `${widthPt}pt` }}>
        <colgroup>
          {widths.map((w, i) => (
            <col key={i} style={{ width: `${w}pt` }} />
          ))}
        </colgroup>
        <tbody>
          {!piece.first && !measure && (
            <tr className="tp-cont" data-kind="cont">
              <td colSpan={cols}>{continuedTitle}</td>
            </tr>
          )}
          {measure && (
            <tr className="tp-cont" data-kind="cont">
              <td colSpan={cols}>{continuedTitle}</td>
            </tr>
          )}
          {rowsRendered.map((r) => renderRow(r, r < head && !piece.first))}
          {measure && (
            <tr className="tp-foot" data-kind="foot">
              <td colSpan={cols}>{continuedFoot}</td>
            </tr>
          )}
          {!piece.last && !measure && (
            <tr className="tp-foot" data-kind="foot">
              <td colSpan={cols}>{continuedFoot}</td>
            </tr>
          )}
        </tbody>
      </table>
      {(piece.last || measure) && (
        <div className="tp-source" data-measure="source" data-empty={srcLines.length === 0 ? 'true' : undefined} style={{ textAlign: srcAlign, width: `${widthPt}pt` }}>
          {srcLines.length === 0 && (measure || !interactive) ? null : (
            <Editable
              text={table.source ?? ''}
              editable={!!interactive && !measure}
              onText={handlers?.onSource}
              placeholder={lang === 'en' ? 'Source: …' : 'Nguồn: …'}
            />
          )}
        </div>
      )}
    </div>
  );
};

export type { GridCell };
export { rowsOf };
