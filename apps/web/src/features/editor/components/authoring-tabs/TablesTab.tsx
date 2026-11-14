'use client';

import React, { useState } from 'react';
import { PaperSection, PaperTable } from '@/types/paper';
import {
  Table as TableIcon,
  Plus,
  Trash2,
  Columns,
  Rows,
  Maximize2,
  Code2,
  CheckCircle2,
} from 'lucide-react';

interface TablesTabProps {
  sections: PaperSection[];
  onChange: (updated: PaperSection[]) => void;
}

export const TablesTab: React.FC<TablesTabProps> = ({ sections, onChange }) => {
  // Extract all sections that are tables
  const tableSections = sections
    .map((sec, originalIndex) => ({ sec, originalIndex }))
    .filter((item) => item.sec.type === 'table' && item.sec.table);

  const [activeTableIdx, setActiveTableIdx] = useState<number>(0);

  // If no tables, show empty state with create button
  const handleAddTable = () => {
    const nextNum = tableSections.length + 1;
    const newTable: PaperTable = {
      id: `tbl_${Date.now()}`,
      num: nextNum,
      caption: `Bảng ${nextNum}: Thống kê số liệu thực nghiệm`,
      headers: ['Tham số', 'Nhóm chứng (n=50)', 'Nhóm can thiệp (n=50)', 'Giá trị p'],
      rows: [
        ['Độ tuổi trung bình', '45.2 ± 6.1', '44.8 ± 5.9', '0.68'],
        ['Tỷ lệ nam / nữ', '28 / 22', '26 / 24', '0.81'],
        ['Chỉ số hiệu quả (%)', '68.4 ± 4.2', '89.1 ± 3.8', '< 0.001'],
      ],
      isFullWidth: false,
      hasZebraStripes: true,
      fontSize: '8pt',
    };

    const newSection: PaperSection = {
      id: `sec_tbl_${Date.now()}`,
      type: 'table',
      title: newTable.caption,
      content: '',
      table: newTable,
    };

    onChange([...sections, newSection]);
    setActiveTableIdx(tableSections.length);
  };

  const handleUpdateCurrentTable = (updatedTable: PaperTable) => {
    if (tableSections.length === 0) return;
    const target = tableSections[activeTableIdx];
    if (!target) return;

    const nextSections = [...sections];
    nextSections[target.originalIndex] = {
      ...nextSections[target.originalIndex],
      title: updatedTable.caption,
      table: updatedTable,
    };
    onChange(nextSections);
  };

  const handleDeleteCurrentTable = () => {
    if (tableSections.length === 0) return;
    const target = tableSections[activeTableIdx];
    if (!target) return;

    const nextSections = [...sections];
    nextSections.splice(target.originalIndex, 1);
    onChange(nextSections);
    setActiveTableIdx(Math.max(0, activeTableIdx - 1));
  };

  const currentTableSection = tableSections[activeTableIdx]?.sec;
  const currentTable = currentTableSection?.table;

  // Table Cell & Header operations
  const handleHeaderChange = (colIdx: number, val: string) => {
    if (!currentTable) return;
    const nextHeaders = [...currentTable.headers];
    nextHeaders[colIdx] = val;
    handleUpdateCurrentTable({ ...currentTable, headers: nextHeaders });
  };

  const handleCellChange = (rowIdx: number, colIdx: number, val: string) => {
    if (!currentTable) return;
    const nextRows = currentTable.rows.map((r, rI) =>
      rI === rowIdx ? r.map((c, cI) => (cI === colIdx ? val : c)) : [...r]
    );
    handleUpdateCurrentTable({ ...currentTable, rows: nextRows });
  };

  const handleAddColumn = () => {
    if (!currentTable) return;
    const colNumber = currentTable.headers.length + 1;
    const nextHeaders = [...currentTable.headers, `Cột ${colNumber}`];
    const nextRows = currentTable.rows.map((r) => [...r, '']);
    handleUpdateCurrentTable({ ...currentTable, headers: nextHeaders, rows: nextRows });
  };

  const handleRemoveColumn = (colIdx: number) => {
    if (!currentTable || currentTable.headers.length <= 1) return;
    const nextHeaders = currentTable.headers.filter((_, idx) => idx !== colIdx);
    const nextRows = currentTable.rows.map((r) => r.filter((_, idx) => idx !== colIdx));
    handleUpdateCurrentTable({ ...currentTable, headers: nextHeaders, rows: nextRows });
  };

  const handleAddRow = () => {
    if (!currentTable) return;
    const newRow = Array(currentTable.headers.length).fill('');
    handleUpdateCurrentTable({ ...currentTable, rows: [...currentTable.rows, newRow] });
  };

  const handleRemoveRow = (rowIdx: number) => {
    if (!currentTable || currentTable.rows.length <= 1) return;
    const nextRows = currentTable.rows.filter((_, idx) => idx !== rowIdx);
    handleUpdateCurrentTable({ ...currentTable, rows: nextRows });
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header bar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <TableIcon className="w-5 h-5 text-[#78C841]" />
          <div>
            <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
              Quản lý Bảng biểu Khoa học ({tableSections.length} bảng)
            </h3>
            <p className="text-xs text-slate-500">
              Chỉnh sửa ô trực tiếp kiểu bảng tính, tự động biên dịch sang cú pháp Typst table(...)
            </p>
          </div>
        </div>

        <button
          onClick={handleAddTable}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-linear-to-r from-[#78C841] to-emerald-600 text-white text-xs font-bold shadow-md shadow-emerald-600/20 hover:from-emerald-600 hover:to-emerald-700 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Thêm bảng số liệu mới
        </button>
      </div>

      {tableSections.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200/80 text-center space-y-3">
          <TableIcon className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
          <h4 className="font-bold text-sm text-slate-700">Chưa có bảng biểu nào trong bài báo</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Nhấn vào nút &ldquo;Thêm bảng số liệu mới&rdquo; để tạo bảng kết quả thực nghiệm với giao diện bảng tính trực quan.
          </p>
          <button
            onClick={handleAddTable}
            className="px-4 py-2 rounded-xl bg-emerald-50 text-[#14532D] text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
          >
            + Tạo bảng đầu tiên
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Table tabs switcher */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {tableSections.map((item, idx) => (
              <button
                key={idx}
                onClick={() => setActiveTableIdx(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                  activeTableIdx === idx
                    ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                }`}
              >
                Bảng {item.sec.table?.num || idx + 1}
              </button>
            ))}
          </div>

          {currentTable && (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-5">
              {/* Table Metadata & Settings */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-extrabold text-[#14532D] bg-emerald-100 px-2 py-1 rounded-lg">
                      Bảng {currentTable.num}
                    </span>
                    <input
                      type="text"
                      value={currentTable.caption}
                      onChange={(e) =>
                        handleUpdateCurrentTable({ ...currentTable, caption: e.target.value })
                      }
                      className="font-bold text-sm text-slate-900 bg-white border border-slate-200 rounded-lg p-2 flex-1 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
                      placeholder="Tên bảng (VD: Bảng 1: Phân bố mẫu theo độ tuổi và giới tính)"
                    />
                  </div>

                  <button
                    onClick={handleDeleteCurrentTable}
                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    title="Xóa bảng này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Settings toggles */}
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-700 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentTable.isFullWidth || false}
                      onChange={(e) =>
                        handleUpdateCurrentTable({ ...currentTable, isFullWidth: e.target.checked })
                      }
                      className="rounded text-emerald-600 focus:ring-[#78C841]"
                    />
                    <span>Tràn 2 cột (Full-width 100%)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={currentTable.hasZebraStripes !== false}
                      onChange={(e) =>
                        handleUpdateCurrentTable({
                          ...currentTable,
                          hasZebraStripes: e.target.checked,
                        })
                      }
                      className="rounded text-emerald-600 focus:ring-[#78C841]"
                    />
                    <span>Sọc màu hàng xen kẽ (Zebra)</span>
                  </label>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-slate-500">Cỡ chữ bảng:</span>
                    <select
                      value={currentTable.fontSize || '8pt'}
                      onChange={(e) =>
                        handleUpdateCurrentTable({
                          ...currentTable,
                          fontSize: e.target.value as any,
                        })
                      }
                      className="border border-slate-200 rounded-lg px-2 py-1 bg-white text-xs font-bold"
                    >
                      <option value="7pt">7pt (Rất nhỏ)</option>
                      <option value="8pt">8pt (Chuẩn khoa học)</option>
                      <option value="9pt">9pt (Vừa)</option>
                      <option value="10pt">10pt (Lớn)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action buttons for Grid */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleAddRow}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-[#14532D] text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <Rows className="w-3.5 h-3.5" />
                    + Thêm Hàng ({currentTable.rows.length})
                  </button>
                  <button
                    onClick={handleAddColumn}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-[#14532D] text-xs font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                  >
                    <Columns className="w-3.5 h-3.5" />
                    + Thêm Cột ({currentTable.headers.length})
                  </button>
                </div>

                <span className="text-xs text-slate-400">
                  Lưới: {currentTable.headers.length} cột × {currentTable.rows.length} hàng
                </span>
              </div>

              {/* Spreadsheet Grid Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full border-collapse text-xs">
                  {/* Headers */}
                  <thead>
                    <tr className="bg-slate-100/80 border-b border-slate-200">
                      <th className="w-10 p-2 text-center text-slate-400 font-bold border-r border-slate-200">
                        #
                      </th>
                      {currentTable.headers.map((h, cIdx) => (
                        <th key={cIdx} className="p-2 border-r border-slate-200 last:border-r-0 min-w-[140px]">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={h}
                              onChange={(e) => handleHeaderChange(cIdx, e.target.value)}
                              className="w-full font-black text-slate-900 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder={`Cột ${cIdx + 1}`}
                            />
                            {currentTable.headers.length > 1 && (
                              <button
                                onClick={() => handleRemoveColumn(cIdx)}
                                title="Xóa cột này"
                                className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  {/* Body Rows */}
                  <tbody>
                    {currentTable.rows.map((row, rIdx) => (
                      <tr
                        key={rIdx}
                        className={`border-b border-slate-200 last:border-b-0 ${
                          currentTable.hasZebraStripes && rIdx % 2 === 1
                            ? 'bg-slate-50/70'
                            : 'bg-white'
                        }`}
                      >
                        <td className="p-2 text-center text-slate-400 font-bold border-r border-slate-200 flex items-center justify-between">
                          <span>{rIdx + 1}</span>
                          {currentTable.rows.length > 1 && (
                            <button
                              onClick={() => handleRemoveRow(rIdx)}
                              title="Xóa hàng này"
                              className="text-slate-300 hover:text-red-500 cursor-pointer ml-1"
                            >
                              ×
                            </button>
                          )}
                        </td>
                        {currentTable.headers.map((_, cIdx) => (
                          <td
                            key={cIdx}
                            className="p-1.5 border-r border-slate-200 last:border-r-0 min-w-[140px]"
                          >
                            <input
                              type="text"
                              value={row[cIdx] || ''}
                              onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                              className="w-full text-xs text-slate-800 bg-transparent rounded px-2 py-1 hover:bg-slate-100 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              placeholder="Dữ liệu..."
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
