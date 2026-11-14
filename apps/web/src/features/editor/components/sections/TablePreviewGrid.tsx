'use client';

import React, { useMemo } from 'react';
import { PaperTable, synthesizeHeaderRows } from '@/types/paper';

export const TABLE_PREVIEW_MAX_ROWS = 10;

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

  const isTruncated = totalRows > TABLE_PREVIEW_MAX_ROWS;
  const hiddenCount = totalRows - TABLE_PREVIEW_MAX_ROWS;

  const visibleBodyRows = isTruncated ? rawBodyRows.slice(0, TABLE_PREVIEW_MAX_ROWS) : rawBodyRows;
  const visibleFlatRows = isTruncated ? rawFlatRows.slice(0, TABLE_PREVIEW_MAX_ROWS) : rawFlatRows;

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
                    className={`px-3 py-2 border-r last:border-r-0 border-zinc-200 min-w-[100px] bg-zinc-100 font-bold text-zinc-900 text-xs ${
                      cell.align === 'center' || (cell.colSpan || 1) > 1
                        ? 'text-center font-extrabold'
                        : cell.align === 'right'
                          ? 'text-right'
                          : 'text-left'
                    }`}
                  >
                    <span className="break-words">{cell.text}</span>
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
                  <span className="break-words">{h}</span>
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
                        className={`px-3 py-2 border-r last:border-r-0 border-zinc-200 min-w-[100px] align-top text-xs text-zinc-800 ${
                          cell.align === 'center' || (cell.colSpan || 1) > 1
                            ? 'text-center font-medium'
                            : cell.align === 'right'
                              ? 'text-right'
                              : 'text-left'
                        }`}
                      >
                        <span className="break-words">{cell.text}</span>
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
                      <span className="break-words">{cell}</span>
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>

      {isTruncated && (
        <div className="sticky left-0 flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-zinc-50/90 border-t border-zinc-200 text-[11px] text-zinc-600">
          <span>
            Đang hiển thị {TABLE_PREVIEW_MAX_ROWS} / {totalRows} hàng — còn {hiddenCount} hàng nữa
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
