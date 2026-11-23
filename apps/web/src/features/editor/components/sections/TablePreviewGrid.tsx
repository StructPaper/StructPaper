'use client';

import { Markup } from '@/components/ui/Markup';
import React, { useMemo } from 'react';
import { PaperTable, synthesizeHeaderRows } from '@/types/paper';

export const TABLE_PREVIEW_MAX_ROWS = 10;
/** The preview is also cut by its height (px): a few very tall rows would otherwise fill the card as much as many short ones. */
export const TABLE_PREVIEW_MAX_HEIGHT = 360;

const PREVIEW_WIDTH = 560;
const PREVIEW_CHAR = 6.4;
const PREVIEW_LINE = 16;
const PREVIEW_ROW_PAD = 16;

/**
 * How many rows the preview shows: at most TABLE_PREVIEW_MAX_ROWS, and no more than fit in TABLE_PREVIEW_MAX_HEIGHT as the rows are
 * estimated from what they hold (a row of long sentences is several lines tall). At least one row is always shown.
 */
export function previewRowLimit(rows: string[][], columns: number, maxRows = TABLE_PREVIEW_MAX_ROWS, maxHeight = TABLE_PREVIEW_MAX_HEIGHT): number {
  const colChars = Math.max(6, Math.floor(PREVIEW_WIDTH / Math.max(1, columns) / PREVIEW_CHAR));
  let height = 0;
  let n = 0;
  for (const row of rows) {
    if (n >= maxRows) break;
    const lines = Math.max(1, ...row.map((t) => String(t ?? '').split(/\r?\n/).reduce((a, l) => a + Math.max(1, Math.ceil(l.length / colChars)), 0)));
    height += lines * PREVIEW_LINE + PREVIEW_ROW_PAD;
    if (n > 0 && height > maxHeight) break;
    n += 1;
  }
  return Math.max(n, rows.length ? 1 : 0);
}

export interface TablePreviewGridProps {
  table: PaperTable;
  normalizedTable: PaperTable;
  idx: number;
  onOpenSpreadsheet: (index: number) => void;
}

export function resolveTablePreviewRows(table: PaperTable, normalizedTable: PaperTable) {
  const safeTableHeaders = Array.isArray(table.headers) ? table.headers : [];
  const safeTableRows = Array.isArray(table.rows) ? table.rows : [];
  const safeTableBodyRows = Array.isArray(table.bodyRows) ? table.bodyRows : [];
  const safeNormalizedRows = Array.isArray(normalizedTable.rows) ? normalizedTable.rows : [];
  const safeNormalizedHeaders = Array.isArray(normalizedTable.headers)
    ? normalizedTable.headers
    : [];

  const hasStructuredBodyRows = safeTableBodyRows.length > 0;
  const flatRows = !hasStructuredBodyRows
    ? safeNormalizedRows.length !== safeTableRows.length
      ? safeNormalizedRows
      : safeTableRows
    : [];

  return {
    safeTableHeaders,
    safeTableRows,
    safeTableBodyRows,
    safeNormalizedHeaders,
    hasStructuredBodyRows,
    bodyRows: hasStructuredBodyRows ? safeTableBodyRows : [],
    flatRows,
    totalRows: hasStructuredBodyRows ? safeTableBodyRows.length : flatRows.length,
  };
}

const TablePreviewGridBase: React.FC<TablePreviewGridProps> = ({
  table,
  normalizedTable,
  idx,
  onOpenSpreadsheet,
}) => {
  const {
    safeTableHeaders,
    safeNormalizedHeaders,
    hasStructuredBodyRows,
    bodyRows: rawBodyRows,
    flatRows: rawFlatRows,
    totalRows,
  } = resolveTablePreviewRows(table, normalizedTable);

  const effectiveHeaderRows = useMemo(
    () =>
      normalizedTable.headerRows && normalizedTable.headerRows.length > 0
        ? normalizedTable.headerRows
        : synthesizeHeaderRows(safeNormalizedHeaders),
    [normalizedTable.headerRows, safeNormalizedHeaders]
  );

  const columns = Math.max(effectiveHeaderRows?.[0]?.length ?? 0, safeNormalizedHeaders.length, 1);
  const plainRows = hasStructuredBodyRows ? rawBodyRows.map((r) => r.map((c) => c.text ?? '')) : rawFlatRows.map((r) => r.map((c) => String(c ?? '')));
  const shown = previewRowLimit(plainRows, columns);
  const isTruncated = totalRows > shown;
  const hiddenCount = totalRows - shown;

  const visibleBodyRows = isTruncated ? rawBodyRows.slice(0, shown) : rawBodyRows;
  const visibleFlatRows = isTruncated ? rawFlatRows.slice(0, shown) : rawFlatRows;

  return (
    <div className="overflow-x-auto max-w-full w-full rounded-xl border border-zinc-200">
      <table className="w-full text-xs text-left border-collapse">
        <thead className="bg-zinc-100 text-zinc-800 font-bold border-b border-zinc-200">
          {effectiveHeaderRows && effectiveHeaderRows.length > 0 ? (
            effectiveHeaderRows.map((hRow, hrIdx) => (
              <tr key={hrIdx} className="border-b last:border-b-0 border-zinc-200">
                {hRow.map((cell, cIdx) => (
                  <th
                    key={cIdx}
                    colSpan={cell.colSpan || 1}
                    rowSpan={cell.rowSpan || 1}
                    style={cell.fill ? { backgroundColor: cell.fill } : undefined}
                    className={`px-3 py-2 border-r last:border-r-0 border-zinc-200 min-w-[100px] bg-zinc-100 font-bold text-zinc-900 text-xs ${
                      cell.align === 'center' || (cell.colSpan || 1) > 1
                        ? 'text-center font-extrabold'
                        : cell.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    }`}
                  >
                    <Markup className="break-words" text={cell.text} />
                  </th>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              {safeTableHeaders.map((h, colI) => (
                <th
                  key={colI}
                  className="px-3 py-2 border-r last:border-r-0 border-zinc-200 min-w-[100px] font-bold text-zinc-900 text-xs"
                >
                  <Markup className="break-words" text={h} />
                </th>
              ))}
            </tr>
          )}
        </thead>
        <tbody>
          {hasStructuredBodyRows
            ? visibleBodyRows.map((bRow, rIdx) => {
                const isEven = rIdx % 2 === 0;
                return (
                  <tr
                    key={rIdx}
                    className={`border-b last:border-b-0 border-zinc-200 ${
                      isEven ? 'bg-[#E7ECF7]/40' : 'bg-white'
                    } hover:bg-zinc-50/50`}
                  >
                    {bRow.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        colSpan={cell.colSpan || 1}
                        rowSpan={cell.rowSpan || 1}
                        style={cell.fill ? { backgroundColor: cell.fill } : undefined}
                        className={`px-3 py-2 border-r last:border-r-0 border-zinc-200 min-w-[100px] align-top text-xs text-zinc-800 ${
                          cell.align === 'center' || (cell.colSpan || 1) > 1
                            ? 'text-center font-medium'
                            : cell.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                        }`}
                      >
                        <Markup className="break-words" text={cell.text} />
                      </td>
                    ))}
                  </tr>
                );
              })
            : visibleFlatRows.map((row, rI) => (
                <tr
                  key={rI}
                  className="border-b last:border-b-0 border-zinc-200 hover:bg-zinc-50/50"
                >
                  {row.map((cell, cI) => (
                    <td
                      key={cI}
                      className="px-3 py-2 border-r last:border-r-0 border-zinc-200 min-w-[100px] text-xs text-zinc-800"
                    >
                      <Markup className="break-words" text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>

      {isTruncated && (
        <div className="sticky left-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-zinc-50/90 border-t border-zinc-200 text-[11px] text-zinc-600">
          <span>
            Đang hiển thị {shown} / {totalRows} hàng — còn {hiddenCount} hàng nữa
          </span>
          <button
            type="button"
            onClick={() => onOpenSpreadsheet(idx)}
            className="px-2.5 py-1 rounded-lg bg-lime-50 hover:bg-lime-100 text-lime-800 font-bold border border-lime-200 transition-colors cursor-pointer"
          >
            Mở bảng tính ({totalRows} hàng)
          </button>
        </div>
      )}
    </div>
  );
};

export const TablePreviewGrid = React.memo(TablePreviewGridBase);
TablePreviewGrid.displayName = 'TablePreviewGrid';
