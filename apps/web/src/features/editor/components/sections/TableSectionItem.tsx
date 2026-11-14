'use client';

import React, { useMemo, useCallback } from 'react';
import { PaperSection, PaperTable, normalizePaperTable } from '@/types/paper';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { TablePreviewGrid, resolveTablePreviewRows } from './TablePreviewGrid';
import { Maximize2, ClipboardPaste, Table as TableIcon } from 'lucide-react';

interface TableSectionItemProps {
  sec: PaperSection;
  idx: number;
  onUpdateSection: (index: number, updated: PaperSection) => void;
  onOpenTableZoom: (index: number, table: PaperTable) => void;
  onPasteTableData: (index: number, e: React.ClipboardEvent) => void;
  onPasteTableFromClipboardButton: (index: number) => void;
}

const TableSectionItemBase: React.FC<TableSectionItemProps> = ({
  sec,
  idx,
  onUpdateSection,
  onOpenTableZoom,
  onPasteTableData,
  onPasteTableFromClipboardButton,
}) => {
  const table = sec.table;
  const normalizedTable = useMemo(
    () => (table ? normalizePaperTable(table) : null),
    [table]
  );

  const handleOpenSpreadsheet = useCallback(
    (sectionIndex: number) => {
      if (table) {
        onOpenTableZoom(sectionIndex, table);
      }
    },
    [onOpenTableZoom, table]
  );

  if (!table || !normalizedTable) return null;

  const {
    safeTableHeaders,
    safeTableRows,
    safeTableBodyRows,
    safeNormalizedHeaders,
    totalRows,
  } = resolveTablePreviewRows(table, normalizedTable);

  const isTableEmpty =
    safeTableHeaders.length === 0 &&
    safeTableRows.length === 0 &&
    safeTableBodyRows.length === 0;

  const colCount =
    safeNormalizedHeaders.length > 0
      ? safeNormalizedHeaders.length
      : safeTableHeaders.length > 0
        ? safeTableHeaders.length
        : normalizedTable.headerRows?.[0]?.reduce((sum, cell) => sum + (cell.colSpan || 1), 0) || 0;

  return (
    <div className="space-y-2.5 bg-white p-3 rounded-2xl border border-zinc-200/80 shadow-2xs">
      {/* Table Caption (Directly editable without opening zoom modal) */}
      <div>
        <div className="flex items-center justify-between mb-1 gap-2">
          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
            Tiêu đề bảng (Caption):
          </label>
          <button
            type="button"
            onClick={() => onOpenTableZoom(idx, table)}
            className="px-2 py-0.5 rounded-lg bg-lime-50 hover:bg-lime-100 text-lime-800 text-[10px] font-bold border border-lime-200 flex items-center gap-1 shadow-2xs hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Phóng to bảng số liệu toàn màn hình & chỉnh sửa kiểu Google Sheets"
          >
            <Maximize2 className="w-2.5 h-2.5 text-lime-600" />
            <span>Phóng to</span>
          </button>
        </div>
        <AutoResizeTextarea
          value={table.caption || ''}
          onChange={(val) =>
            onUpdateSection(idx, {
              ...sec,
              content: val,
              table: { ...table, caption: val },
            })
          }
          placeholder="Nhập tiêu đề bảng (ví dụ: Bảng 1: Kết quả khảo sát...)"
          className="w-full p-2.5 rounded-xl text-xs font-bold text-zinc-900 bg-zinc-50 border border-zinc-200/80 focus:bg-white focus:outline-none focus:ring-4 focus:ring-lime-200 focus:border-lime-400 transition-all shadow-2xs"
        />
      </div>

      {/* Table Cells Grid (Read-only in normal view or empty dropzone) */}
      {isTableEmpty ? (
        <div
          tabIndex={0}
          onPaste={(e) => onPasteTableData(idx, e)}
          className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-zinc-300 hover:border-lime-400 rounded-3xl bg-zinc-50/50 hover:bg-lime-50/30 transition-all text-center focus:outline-none focus:ring-4 focus:ring-lime-200 group cursor-pointer"
        >
          {/* Eatzy signature empty state squircle icon (compact) */}
          <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-3xl bg-gray-50 flex items-center justify-center text-gray-400 mb-2.5 border-2 border-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)] mx-auto relative group-hover:scale-105 transition-transform duration-300">
            <TableIcon className="w-6 h-6 sm:w-6.5 sm:h-6.5 text-gray-400" strokeWidth={1.8} />
          </div>

          <h4 className="font-extrabold text-sm text-zinc-900 mb-1">
            Bảng số liệu đang trống
          </h4>
          <p className="text-xs text-zinc-600 max-w-md mb-4 leading-relaxed">
            Nhấn{' '}
            <kbd className="px-1.5 py-0.5 rounded bg-white border border-zinc-300 text-zinc-800 font-mono text-[11px] shadow-2xs">
              Ctrl + V
            </kbd>{' '}
            để dán cấu trúc bảng từ Excel, Google Sheets, Word hoặc định dạng Tab / CSV vào đây. Hệ thống sẽ tự động ghi nhận!
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <button
              type="button"
              onClick={() => onPasteTableFromClipboardButton(idx)}
              className="px-3.5 py-2 rounded-xl bg-lime-600 hover:bg-lime-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer active:scale-95"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              <span>Dán từ Clipboard (Ctrl + V)</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenTableZoom(idx, table)}
              className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 font-bold text-xs flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-lime-600" />
              <span>Soạn thảo thủ công</span>
            </button>
          </div>
        </div>
      ) : (
        <TablePreviewGrid
          table={table}
          normalizedTable={normalizedTable}
          idx={idx}
          onOpenSpreadsheet={handleOpenSpreadsheet}
        />
      )}

      {/* Table Footer Controls */}
      <div className="flex items-center justify-between gap-2 pt-1 text-[11px]">
        <button
          type="button"
          onClick={() => onOpenTableZoom(idx, table)}
          className="px-2.5 py-1 rounded-lg bg-lime-50 hover:bg-lime-100 text-lime-800 font-bold flex items-center gap-1.5 transition-colors cursor-pointer border border-lime-200 shadow-2xs hover:scale-105 active:scale-95"
          title="Phóng to bảng số liệu toàn màn hình & soạn thảo"
        >
          <Maximize2 className="w-3 h-3 text-lime-600" />
          <span>Soạn thảo</span>
        </button>

        <div className="flex items-center gap-1.5">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              table.columnSpan === '2-column' || table.isFullWidth !== false
                ? 'bg-[#EEF2FF] text-[#3730A3]'
                : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {table.columnSpan === '2-column' || table.isFullWidth !== false ? '2 Cột' : '1 Cột'}
          </span>
          {table.isRotated && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
              Xoay 90°
            </span>
          )}
          <span className="text-zinc-400 text-[10px] font-medium ml-1">
            {totalRows} hàng × {colCount} cột
          </span>
        </div>
      </div>
    </div>
  );
};

export const TableSectionItem = React.memo(TableSectionItemBase);
TableSectionItem.displayName = 'TableSectionItem';
