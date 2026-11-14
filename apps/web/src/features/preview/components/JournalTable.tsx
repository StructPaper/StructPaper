import React from 'react';
import { PaperTable, synthesizeHeaderRows, normalizePaperTable } from '@/types/paper';
import { DEFAULT_THEME, type ResolvedTheme } from '@/lib/theme-config';
import { resolveBodyFill, rowIsTinted } from '@/lib/table-fill';

import { stripCaptionLabel } from '@/lib/docx-table-extras';
interface JournalTableProps {
  table: PaperTable;
  isFullWidth?: boolean;
  theme?: ResolvedTheme;
}

export const JournalTable: React.FC<JournalTableProps> = ({ table, isFullWidth = false, theme = DEFAULT_THEME }) => {
  const normalized = normalizePaperTable(table);
  const effectiveHeaderRows =
    normalized.headerRows && normalized.headerRows.length > 0
      ? normalized.headerRows
      : synthesizeHeaderRows(normalized.headers || []);
  const hasComplexHeaders = Boolean(effectiveHeaderRows && effectiveHeaderRows.length > 1);
  const hasComplexBody = Boolean(table.bodyRows && table.bodyRows.length > 0);
  const bodyFill = resolveBodyFill(table);
  const bodyRowCount = table.bodyRows?.length ?? table.rows?.length ?? 0;
  // Short tables stay together; long ones may break across columns/pages with the header repeated.
  const isLong = bodyRowCount > theme.longTableRowThreshold;
  const spansAll = isFullWidth || table.columnSpan === '2-column' || (table.isFullWidth !== false && !table.columnSpan);

  return (
    <div
      className={`my-5 ${isLong ? '' : 'break-inside-avoid'} ${table.isRotated ? 'p-2.5 bg-zinc-50/70 rounded-xl border border-dashed border-zinc-300' : ''}`}
      style={{ columnSpan: spansAll ? 'all' : undefined }}
    >
      {table.isRotated && (
        <div className="mb-2 flex items-center gap-1.5 text-[7.5pt] text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded w-fit font-bold">
          <span>🔄 Bảng xoay ngang 90° (Landscape • Chiếm toàn bộ 2 cột)</span>
        </div>
      )}
      {/* Caption above table - Exact LaTeX: font={small,sf,bf} */}
      <div className="mb-1.5 leading-snug">
        <p
          className="text-[8.5pt] text-gray-900"
          style={{ fontFamily: "'Source Sans 3', Calibri, Arial, sans-serif" }}
        >
          <strong className="font-bold" style={{ color: theme.titleColor }}>Bảng {table.num}: </strong>
          <span>{stripCaptionLabel(table.caption)}</span>
        </p>
      </div>

      {/* Table grid with exact colors: header = #E5E5E5, rows = alternating #E7ECF7 */}
      <div className="border border-gray-300 overflow-x-auto text-[7.5pt] shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead style={theme.repeatTableHeader ? { display: 'table-header-group' } : undefined}>
            {effectiveHeaderRows && effectiveHeaderRows.length > 0 ? (
              effectiveHeaderRows.map((hRow, hrIdx) => (
                <tr
                  key={hrIdx}
                  className="border-b border-gray-300 font-bold text-gray-900" style={{ backgroundColor: theme.tableHeaderColor }}
                >
                  {hRow.map((cell, cIdx) => (
                    <th
                      key={cIdx}
                      colSpan={cell.colSpan || 1}
                      rowSpan={cell.rowSpan || 1}
                      className={`p-1.5 border-r last:border-r-0 border-gray-300 ${
                        (cell.colSpan || 1) > 1 ? 'text-center' : 'text-left'
                      }`}
                      style={{ fontFamily: "'Source Sans 3', sans-serif" }}
                    >
                      {cell.text}
                    </th>
                  ))}
                </tr>
              ))
            ) : (
              <tr className="border-b border-gray-300 font-bold text-gray-900" style={{ backgroundColor: theme.tableHeaderColor }}>
                {table.headers.map((h, i) => (
                  <th
                    key={i}
                    className="p-1.5 border-r last:border-r-0 border-gray-300"
                    style={{ fontFamily: "'Source Sans 3', sans-serif" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {hasComplexBody && table.bodyRows ? (
              table.bodyRows.map((bRow, rIdx) => {
                return (
                  <tr
                    key={rIdx}
                    style={{ backgroundColor: rowIsTinted(bodyFill, rIdx) ? theme.tableZebraColor : '#FFFFFF' }}
                  >
                    {bRow.map((cell, cIdx) => (
                      <td
                        key={cIdx}
                        colSpan={cell.colSpan || 1}
                        rowSpan={cell.rowSpan || 1}
                        className={`p-1.5 border-r last:border-r-0 border-gray-300 align-top ${
                          (cell.colSpan || 1) > 1 && cell.text === 'Không báo cáo'
                            ? 'text-center italic text-gray-600'
                            : ''
                        }`}
                        style={{ fontFamily: "'Source Serif 4', serif" }}
                      >
                        {cell.text}
                      </td>
                    ))}
                  </tr>
                );
              })
            ) : (
              table.rows.map((row, rI) => {
                return (
                  <tr
                    key={rI}
                    style={{ backgroundColor: rowIsTinted(bodyFill, rI) ? theme.tableZebraColor : '#FFFFFF' }}
                  >
                    {row.map((cell, cI) => (
                      <td
                        key={cI}
                        className="p-1.5 border-r last:border-r-0 border-gray-300 align-top"
                        style={{ fontFamily: "'Source Serif 4', serif" }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
