'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { PaperTable, normalizePaperTable } from '@/types/paper';
import type { Cell } from '@structpaper/doc-model';
import {
  SheetCell,
  getExcelColLetter,
  cloneMatrix,
  initMatrixFromDocModelGrid,
  initMatrixFromTable,
  matrixToDocModelGrid,
  matrixToPaperTableData,
} from './table-spreadsheet-adapter';
import {
  X,
  Check,
  Copy,
  Plus,
  Trash2,
  Undo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Combine,
  Split,
  Table as TableIcon,
} from 'lucide-react';

interface TableSpreadsheetModalProps {
  isOpen: boolean;
  table: PaperTable;
  grid?: Cell[][];
  onSave: (updated: PaperTable, grid?: Cell[][]) => void;
  onClose: () => void;
}

export const TableSpreadsheetModal: React.FC<TableSpreadsheetModalProps> = ({
  isOpen,
  table,
  grid,
  onSave,
  onClose,
}) => {
  const [mounted, setMounted] = useState<boolean>(false);
  const [isClosing, setIsClosing] = useState<boolean>(false);
  const [captionText, setCaptionText] = useState<string>(table.caption || '');

  // Unified 2D Sheet Grid: All cells are treated equally from Row 0 to Row N-1
  const [matrix, setMatrix] = useState<SheetCell[][]>(() => {
    if (grid && grid.length > 0) return initMatrixFromDocModelGrid(grid);
    if (table.grid && table.grid.length > 0) return initMatrixFromDocModelGrid(table.grid);
    return initMatrixFromTable(table);
  });
  const [history, setHistory] = useState<SheetCell[][][]>([]);

  // Range Selection: selectionStart to selectionEnd defines the highlighted box
  const [selectionStart, setSelectionStart] = useState<{ r: number; c: number } | null>({ r: 0, c: 0 });
  const [selectionEnd, setSelectionEnd] = useState<{ r: number; c: number } | null>({ r: 0, c: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Right-click Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; r: number; c: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  // Refs for cell DOM elements
  const cellInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (grid && grid.length > 0) {
        setMatrix(initMatrixFromDocModelGrid(grid));
      } else if (table.grid && table.grid.length > 0) {
        setMatrix(initMatrixFromDocModelGrid(table.grid));
      } else {
        setMatrix(initMatrixFromTable(table));
      }
      setCaptionText(table.caption || '');
      setHistory([]);
      setIsClosing(false);
      setSelectionStart({ r: 0, c: 0 });
      setSelectionEnd({ r: 0, c: 0 });
      setContextMenu(null);
    }
  }, [isOpen, table, grid]);

  // Global mouse up to finish drag selection
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // Dismiss context menu immediately when clicking outside or scrolling
  useEffect(() => {
    if (!contextMenu) return;

    const handleDismissMenu = (e: MouseEvent | TouchEvent) => {
      // Allow clicking buttons inside the context menu
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target as Node)) {
        return;
      }
      setContextMenu(null);
    };

    const handleDismissOnScroll = () => {
      setContextMenu(null);
    };

    // Use capture: true so stopPropagation inside the modal does NOT block dismissal
    window.addEventListener('mousedown', handleDismissMenu, true);
    window.addEventListener('touchstart', handleDismissMenu, true);
    window.addEventListener('wheel', handleDismissOnScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('mousedown', handleDismissMenu, true);
      window.removeEventListener('touchstart', handleDismissMenu, true);
      window.removeEventListener('wheel', handleDismissOnScroll, true);
    };
  }, [contextMenu]);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (contextMenu) {
          setContextMenu(null);
        } else {
          handleTriggerClose();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleBold();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        handleToggleItalic();
      } else if (e.key === 'Delete' && !isAnyInputFocused()) {
        e.preventDefault();
        handleClearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isClosing, contextMenu, matrix, history, selectionStart, selectionEnd]);

  const isAnyInputFocused = () => {
    const active = document.activeElement;
    return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
  };

  if (!mounted || !isOpen) return null;

  const pushHistory = (current: SheetCell[][]) => {
    setHistory((prev) => [...prev.slice(-25), cloneMatrix(current)]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setMatrix(cloneMatrix(prev));
  };

  const handleTriggerClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 240);
  };

  // Selection Box Coordinates
  const minR = Math.min(selectionStart?.r ?? 0, selectionEnd?.r ?? 0);
  const maxR = Math.max(selectionStart?.r ?? 0, selectionEnd?.r ?? 0);
  const minC = Math.min(selectionStart?.c ?? 0, selectionEnd?.c ?? 0);
  const maxC = Math.max(selectionStart?.c ?? 0, selectionEnd?.c ?? 0);

  const selectedCellCount = (maxR - minR + 1) * (maxC - minC + 1);

  const isCellSelected = (r: number, c: number) => {
    return r >= minR && r <= maxR && c >= minC && c <= maxC;
  };

  // Cell key generator
  const getCellKey = (r: number, c: number) => `${r}_${c}`;

  // Focus a specific cell
  const focusCell = (r: number, c: number) => {
    const clampedR = Math.max(0, Math.min(matrix.length - 1, r));
    const clampedC = Math.max(0, Math.min((matrix[0]?.length || 1) - 1, c));
    setSelectionStart({ r: clampedR, c: clampedC });
    setSelectionEnd({ r: clampedR, c: clampedC });

    setTimeout(() => {
      const el = cellInputRefs.current.get(getCellKey(clampedR, clampedC));
      if (el) {
        el.focus();
        el.select();
      }
    }, 25);
  };

  // Cell Text Change
  const handleCellTextChange = (r: number, c: number, newText: string) => {
    pushHistory(matrix);
    const newMatrix = cloneMatrix(matrix);
    newMatrix[r][c].text = newText;
    setMatrix(newMatrix);
  };

  // Active Anchor Cell Value for Formula Bar (fx)
  const anchorR = selectionStart?.r ?? 0;
  const anchorC = selectionStart?.c ?? 0;
  const activeCellData = matrix[anchorR]?.[anchorC];
  const activeCellValue = activeCellData?.text || '';

  const handleFormulaBarChange = (val: string) => {
    handleCellTextChange(anchorR, anchorC, val);
  };

  const handleCellContextMenu = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isCellSelected(r, c)) {
      setSelectionStart({ r, c });
      setSelectionEnd({ r, c });
    }
    setContextMenu({ x: e.clientX, y: e.clientY, r, c });
  };

  // 1. FEATURE: Merge Highlighted Cells (Gộp vùng ô đã bôi đen)
  const handleMergeSelection = () => {
    if (!selectionStart || !selectionEnd) return;
    if (selectedCellCount <= 1) {
      return;
    }

    pushHistory(matrix);

    const rs = maxR - minR + 1;
    const cs = maxC - minC + 1;

    const newMatrix = cloneMatrix(matrix);
    const anchor = newMatrix[minR][minC];
    anchor.rowSpan = rs;
    anchor.colSpan = cs;
    delete anchor.mergedInto;

    // Collect texts if anchor is blank
    if (!anchor.text.trim()) {
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          if (newMatrix[r][c].text.trim()) {
            anchor.text = newMatrix[r][c].text.trim();
            break;
          }
        }
        if (anchor.text.trim()) break;
      }
    }

    // Mark covered cells
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (r === minR && c === minC) continue;
        newMatrix[r][c].mergedInto = { r: minR, c: minC };
      }
    }

    setMatrix(newMatrix);
  };

  // 2. FEATURE: Unmerge Cells (Hủy gộp ô)
  const handleUnmergeSelection = () => {
    if (!selectionStart) return;
    pushHistory(matrix);

    const newMatrix = cloneMatrix(matrix);
    let unmergedCount = 0;

    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        let cell = newMatrix[r]?.[c];
        if (!cell) continue;

        if (cell.mergedInto) {
          const ar = cell.mergedInto.r;
          const ac = cell.mergedInto.c;
          cell = newMatrix[ar][ac];
        }

        const rs = cell.rowSpan || 1;
        const cs = cell.colSpan || 1;

        if (rs > 1 || cs > 1) {
          delete cell.rowSpan;
          delete cell.colSpan;

          for (let dr = 0; dr < rs; dr++) {
            for (let dc = 0; dc < cs; dc++) {
              if (newMatrix[r + dr]?.[c + dc]) {
                delete newMatrix[r + dr][c + dc].mergedInto;
              }
            }
          }
          unmergedCount++;
        }
      }
    }

    if (unmergedCount > 0) {
      setMatrix(newMatrix);
    }
  };

  // 3. FEATURE: Formatting (Căn lề, In đậm, In nghiêng)
  const handleSetAlignment = (align: 'left' | 'center' | 'right') => {
    pushHistory(matrix);
    const newMatrix = cloneMatrix(matrix);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        newMatrix[r][c].align = align;
      }
    }
    setMatrix(newMatrix);
  };

  const handleToggleBold = () => {
    pushHistory(matrix);
    const newMatrix = cloneMatrix(matrix);
    const targetBold = !matrix[anchorR]?.[anchorC]?.bold;
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        newMatrix[r][c].bold = targetBold;
      }
    }
    setMatrix(newMatrix);
  };

  const handleToggleItalic = () => {
    pushHistory(matrix);
    const newMatrix = cloneMatrix(matrix);
    const targetItalic = !matrix[anchorR]?.[anchorC]?.italic;
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        newMatrix[r][c].italic = targetItalic;
      }
    }
    setMatrix(newMatrix);
  };

  const handleClearSelection = () => {
    pushHistory(matrix);
    const newMatrix = cloneMatrix(matrix);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        newMatrix[r][c].text = '';
      }
    }
    setMatrix(newMatrix);
  };

  // 4. FEATURE: Row & Column Insert/Delete
  const handleInsertRowAbove = (rIdx: number) => {
    pushHistory(matrix);
    const cols = matrix[0]?.length || 1;
    const emptyRow: SheetCell[] = Array(cols)
      .fill(null)
      .map(() => ({ text: '', align: 'left' }));
    const newMatrix = cloneMatrix(matrix);
    newMatrix.splice(rIdx, 0, emptyRow);
    setMatrix(newMatrix);
    focusCell(rIdx, anchorC);
  };

  const handleInsertRowBelow = (rIdx: number) => {
    pushHistory(matrix);
    const cols = matrix[0]?.length || 1;
    const emptyRow: SheetCell[] = Array(cols)
      .fill(null)
      .map(() => ({ text: '', align: 'left' }));
    const newMatrix = cloneMatrix(matrix);
    const target = rIdx + 1;
    newMatrix.splice(target, 0, emptyRow);
    setMatrix(newMatrix);
    focusCell(target, anchorC);
  };

  const handleDeleteRow = (rIdx: number) => {
    if (matrix.length <= 1) {
      return;
    }
    pushHistory(matrix);
    const newMatrix = cloneMatrix(matrix).filter((_, idx) => idx !== rIdx);
    setMatrix(newMatrix);
    const nextR = Math.min(newMatrix.length - 1, rIdx);
    focusCell(nextR, anchorC);
  };

  const handleInsertColumnLeft = (cIdx: number) => {
    pushHistory(matrix);
    const newMatrix = cloneMatrix(matrix);
    newMatrix.forEach((row) => {
      row.splice(cIdx, 0, { text: '', align: 'left' });
    });
    setMatrix(newMatrix);
    focusCell(anchorR, cIdx);
  };

  const handleInsertColumnRight = (cIdx: number) => {
    pushHistory(matrix);
    const newMatrix = cloneMatrix(matrix);
    const target = cIdx + 1;
    newMatrix.forEach((row) => {
      row.splice(target, 0, { text: '', align: 'left' });
    });
    setMatrix(newMatrix);
    focusCell(anchorR, target);
  };

  const handleDeleteColumn = (cIdx: number) => {
    if ((matrix[0]?.length || 0) <= 1) {
      return;
    }
    pushHistory(matrix);
    const newMatrix = cloneMatrix(matrix).map((row) => row.filter((_, idx) => idx !== cIdx));
    setMatrix(newMatrix);
    const nextC = Math.min((newMatrix[0]?.length || 1) - 1, cIdx);
    focusCell(anchorR, nextC);
  };

  // 5. FEATURE: Multi-Cell Paste (Ctrl+V) from Excel / Google Sheets
  const handlePasteSpreadsheetData = (e: React.ClipboardEvent, startR: number, startC: number) => {
    const text = e.clipboardData.getData('text');
    if (!text || (!text.includes('\t') && !text.includes('\n'))) {
      return; // Single value: standard paste
    }

    e.preventDefault();
    pushHistory(matrix);

    const pastedRows = text
      .trim()
      .split(/\r?\n/)
      .map((line) => line.split('\t'));

    if (pastedRows.length === 0) return;

    let newMatrix = cloneMatrix(matrix);
    const neededCols = startC + Math.max(...pastedRows.map((r) => r.length));
    const neededRows = startR + pastedRows.length;

    // Expand cols if needed
    while ((newMatrix[0]?.length || 0) < neededCols) {
      newMatrix.forEach((row) => row.push({ text: '', align: 'left' }));
    }

    // Expand rows if needed
    const currentCols = newMatrix[0]?.length || 1;
    while (newMatrix.length < neededRows) {
      newMatrix.push(Array(currentCols).fill(null).map(() => ({ text: '', align: 'left' })));
    }

    // Populate pasted cells
    pastedRows.forEach((pRow, rOffset) => {
      pRow.forEach((val, cOffset) => {
        const targetR = startR + rOffset;
        const targetC = startC + cOffset;
        if (newMatrix[targetR]?.[targetC]) {
          newMatrix[targetR][targetC].text = val.trim();
        }
      });
    });

    setMatrix(newMatrix);
  };

  // Copy as TSV
  const handleCopyTableAsTsv = async () => {
    try {
      const fullTsv = matrix.map((row) => row.map((cell) => cell.text).join('\t')).join('\n');
      await navigator.clipboard.writeText(fullTsv);
    } catch {
      // Ignore clipboard error silently
    }
  };

  // Save back to PaperTable
  const handleApplyAndSave = () => {
    if (matrix.length === 0 || matrix[0].length === 0) return;

    const { headers, rows, headerRows, bodyRows } = matrixToPaperTableData(matrix);
    const docModelGrid = matrixToDocModelGrid(matrix);

    const updated: PaperTable = {
      ...table,
      caption: captionText,
      headers,
      rows,
      bodyRows: bodyRows.length > 0 ? bodyRows : undefined,
      headerRows: headerRows.length > 0 ? headerRows : undefined,
      grid: docModelGrid,
    };

    onSave(normalizePaperTable(updated), docModelGrid);
    handleTriggerClose();
  };

  return (
    <>
      {createPortal(
        <div
          className={`fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen m-0 z-[999999] flex flex-col items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md overflow-hidden ${isClosing ? 'animate-lightbox-backdrop-out' : 'animate-lightbox-backdrop-in'
            }`}
          onClick={handleTriggerClose}
        >
          <div
            className={`w-full max-w-7xl h-[95vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-white/20 overflow-hidden ${isClosing ? 'animate-lightbox-content-out' : 'animate-lightbox-content-in'
              }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Header Bar */}
            <div className="p-3 sm:p-4 border-b border-zinc-200/90 flex flex-col gap-2.5 flex-shrink-0">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm text-zinc-900">
                        Bảng {table.num}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 hidden sm:block">
                      Kéo chuột bôi đen nhiều ô để gộp (Merge), nhấp chuột phải để xem menu tính năng hoặc dán trực tiếp (Ctrl+V)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  {history.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="px-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                      title="Hoàn tác (Ctrl+Z)"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>Hoàn tác</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyTableAsTsv}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 text-xs font-bold flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
                    title="Sao chép toàn bộ bảng ra Excel (TSV)"
                  >
                    <Copy className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Sao chép bảng</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleApplyAndSave}
                    className="px-4 py-1.5 rounded-xl bg-lime-600 hover:bg-lime-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                    title="Lưu thay đổi vào bài báo"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Lưu & Áp dụng</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleTriggerClose}
                    className="p-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 transition-colors cursor-pointer"
                    title="Đóng cửa sổ (Esc)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Caption Input */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs font-bold text-zinc-600 flex-shrink-0">
                  Tiêu đề bảng (Caption):
                </span>
                <input
                  type="text"
                  value={captionText}
                  onChange={(e) => setCaptionText(e.target.value)}
                  placeholder="Nhập tiêu đề bảng (ví dụ: Bảng 1: Kết quả khảo sát...)"
                  className="flex-1 px-3 py-1.5 rounded-xl border border-zinc-300 text-xs font-bold text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-lime-200 focus:border-lime-400 shadow-2xs"
                />
              </div>
            </div>

            {/* Google Sheets Ribbon Toolbar */}
            <div className="p-2 sm:px-4 bg-zinc-50/95 border-b border-zinc-200 flex items-center justify-between gap-3 text-xs flex-wrap">
              {/* Formula bar (fx) */}
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <div className="px-2.5 py-1 rounded-lg bg-lime-100 text-lime-900 border border-lime-300 font-mono font-bold text-[11px] select-none flex-shrink-0 min-w-[50px] text-center shadow-2xs">
                  {selectionStart ? `${getExcelColLetter(anchorC)}${anchorR + 1}` : '--'}
                </div>

                <span className="font-serif italic font-extrabold text-lime-600 select-none text-sm">
                  fx
                </span>

                <input
                  type="text"
                  value={activeCellValue}
                  onChange={(e) => handleFormulaBarChange(e.target.value)}
                  placeholder="Nội dung ô đang chọn (Formula bar)..."
                  className="flex-1 px-2.5 py-1 rounded-lg bg-white border border-zinc-300 text-xs text-zinc-900 focus:outline-none focus:ring-2 focus:ring-lime-400 shadow-2xs"
                />
              </div>

              {/* Tools Group */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Format: Bold & Italic */}
                <div className="flex items-center bg-white border border-zinc-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={handleToggleBold}
                    className={`p-1.5 rounded hover:bg-zinc-100 transition-colors cursor-pointer ${activeCellData?.bold ? 'bg-zinc-200 text-zinc-950 font-black' : 'text-zinc-600'
                      }`}
                    title="In đậm (Ctrl+B)"
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleToggleItalic}
                    className={`p-1.5 rounded hover:bg-zinc-100 transition-colors cursor-pointer ${activeCellData?.italic ? 'bg-zinc-200 text-zinc-950 font-black' : 'text-zinc-600'
                      }`}
                    title="In nghiêng (Ctrl+I)"
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Alignments */}
                <div className="flex items-center bg-white border border-zinc-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => handleSetAlignment('left')}
                    className={`p-1 rounded hover:bg-zinc-100 cursor-pointer ${activeCellData?.align === 'left' ? 'bg-zinc-200 text-zinc-950' : 'text-zinc-600'
                      }`}
                    title="Căn trái"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAlignment('center')}
                    className={`p-1 rounded hover:bg-zinc-100 cursor-pointer ${activeCellData?.align === 'center' ? 'bg-zinc-200 text-zinc-950' : 'text-zinc-600'
                      }`}
                    title="Căn giữa"
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetAlignment('right')}
                    className={`p-1 rounded hover:bg-zinc-100 cursor-pointer ${activeCellData?.align === 'right' ? 'bg-zinc-200 text-zinc-950' : 'text-zinc-600'
                      }`}
                    title="Căn phải"
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Merge & Unmerge */}
                <div className="flex items-center gap-1 bg-white border border-zinc-200 rounded-lg p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={handleMergeSelection}
                    className="px-2.5 py-1 rounded text-zinc-700 hover:text-zinc-950 hover:bg-lime-50 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                    title="Gộp các ô đã bôi đen lại với nhau (Merge Cells)"
                  >
                    <Combine className="w-3.5 h-3.5 text-lime-600" />
                    <span>Gộp ô</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleUnmergeSelection}
                    className="px-2 py-1 rounded text-zinc-700 hover:text-zinc-950 hover:bg-zinc-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                    title="Hủy gộp ô (Unmerge / Split)"
                  >
                    <Split className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Hủy gộp</span>
                  </button>
                </div>

                {/* Row Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleInsertRowAbove(anchorR)}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-lime-50 hover:border-lime-200 text-zinc-700 font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                    title="Chèn hàng phía trên ô đang chọn"
                  >
                    <Plus className="w-3 h-3 text-lime-600" />
                    <span>Hàng trên</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertRowBelow(anchorR)}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-lime-50 hover:border-lime-200 text-zinc-700 font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                    title="Chèn hàng phía dưới ô đang chọn"
                  >
                    <Plus className="w-3 h-3 text-lime-600" />
                    <span>Hàng dưới</span>
                  </button>
                </div>

                {/* Column Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleInsertColumnLeft(anchorC)}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-lime-50 hover:border-lime-200 text-zinc-700 font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                    title="Chèn cột bên trái ô đang chọn"
                  >
                    <Plus className="w-3 h-3 text-lime-600" />
                    <span>Cột trái</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertColumnRight(anchorC)}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-lime-50 hover:border-lime-200 text-zinc-700 font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                    title="Chèn cột bên phải ô đang chọn"
                  >
                    <Plus className="w-3 h-3 text-lime-600" />
                    <span>Cột phải</span>
                  </button>
                </div>

                {/* Clear & Delete */}
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="p-1.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-500 hover:text-zinc-800 shadow-2xs cursor-pointer"
                  title="Xóa nội dung các ô đang chọn (Delete)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {matrix.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(anchorR)}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-600 font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer"
                    title={`Xóa hàng hiện tại (${anchorR + 1})`}
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                    <span>Xóa hàng</span>
                  </button>
                )}

                {(matrix[0]?.length || 0) > 1 && (
                  <button
                    type="button"
                    onClick={() => handleDeleteColumn(anchorC)}
                    className="px-2 py-1 rounded-lg bg-white border border-zinc-200 hover:bg-red-50 hover:text-red-600 text-zinc-600 font-bold text-[11px] flex items-center gap-1 shadow-2xs cursor-pointer"
                    title={`Xóa cột hiện tại (${getExcelColLetter(anchorC)})`}
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                    <span>Xóa cột</span>
                  </button>
                )}
              </div>
            </div>

            {/* Spreadsheet Table Viewport (expands dynamically inside 95vh modal) */}
            <div className="flex-1 overflow-auto p-2 sm:p-4 bg-zinc-100/60 select-none">
              <div className="inline-block min-w-full align-middle bg-white rounded-xl border border-zinc-300 shadow-sm overflow-hidden">
                <table className="w-full border-collapse text-xs font-sans">
                  <thead>
                    {/* Column letters A, B, C, D... */}
                    <tr className="bg-zinc-200/90 text-zinc-500 font-mono text-[11px]">
                      <th className="w-12 p-1 text-center font-bold border-r border-b border-zinc-300 bg-zinc-300/80 text-zinc-600">
                        {matrix.length}×{matrix[0]?.length || 0}
                      </th>
                      {(matrix[0] || []).map((_, cIdx) => {
                        const isColSelected = minC <= cIdx && cIdx <= maxC;
                        return (
                          <th
                            key={cIdx}
                            onClick={() => {
                              setSelectionStart({ r: 0, c: cIdx });
                              setSelectionEnd({ r: matrix.length - 1, c: cIdx });
                            }}
                            className={`p-1.5 text-center font-bold border-r last:border-r-0 border-b border-zinc-300 cursor-pointer transition-colors ${isColSelected ? 'bg-lime-100 text-lime-900 font-extrabold' : 'hover:bg-zinc-200'
                              }`}
                          >
                            {getExcelColLetter(cIdx)}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  {/* Matrix Data Rows */}
                  <tbody>
                    {matrix.map((row, rIdx) => {
                      const isRowSelected = minR <= rIdx && rIdx <= maxR;

                      return (
                        <tr
                          key={rIdx}
                          className={`border-b last:border-b-0 border-zinc-200 transition-colors ${rIdx === 0
                            ? 'bg-zinc-100 font-bold border-b-2 border-zinc-300'
                            : rIdx % 2 === 0
                              ? 'bg-white'
                              : 'bg-zinc-50/50'
                            }`}
                        >
                          {/* Row number header button */}
                          <td
                            onClick={() => {
                              setSelectionStart({ r: rIdx, c: 0 });
                              setSelectionEnd({ r: rIdx, c: (matrix[0]?.length || 1) - 1 });
                            }}
                            className={`w-12 p-1 text-center font-mono text-[11px] font-bold border-r border-zinc-300 select-none cursor-pointer ${isRowSelected
                              ? 'bg-lime-100 text-lime-900 font-extrabold'
                              : 'bg-zinc-100/80 text-zinc-500 hover:bg-zinc-200'
                              }`}
                          >
                            {rIdx + 1}
                          </td>

                          {/* Unified Cells */}
                          {row.map((cell, cIdx) => {
                            // Skip cells covered by another merged cell
                            if (cell.mergedInto) return null;

                            const selected = isCellSelected(rIdx, cIdx);
                            const isAnchor = anchorR === rIdx && anchorC === cIdx;

                            return (
                              <td
                                key={cIdx}
                                colSpan={cell.colSpan || 1}
                                rowSpan={cell.rowSpan || 1}
                                onMouseDown={(e) => {
                                  if (e.button === 2) return; // Right click
                                  if (e.shiftKey && selectionStart) {
                                    setSelectionEnd({ r: rIdx, c: cIdx });
                                  } else {
                                    setSelectionStart({ r: rIdx, c: cIdx });
                                    setSelectionEnd({ r: rIdx, c: cIdx });
                                    setIsDragging(true);
                                  }
                                }}
                                onMouseEnter={() => {
                                  if (isDragging) {
                                    setSelectionEnd({ r: rIdx, c: cIdx });
                                  }
                                }}
                                onContextMenu={(e) => handleCellContextMenu(e, rIdx, cIdx)}
                                className={`p-1 border-r last:border-r-0 border-zinc-300 relative transition-all min-w-[110px] ${selected
                                  ? 'bg-blue-500/15 ring-2 ring-blue-600 z-10'
                                  : ''
                                  }`}
                              >
                                <input
                                  ref={(el) => {
                                    if (el) cellInputRefs.current.set(getCellKey(rIdx, cIdx), el);
                                    else cellInputRefs.current.delete(getCellKey(rIdx, cIdx));
                                  }}
                                  type="text"
                                  value={cell.text}
                                  onChange={(e) => handleCellTextChange(rIdx, cIdx, e.target.value)}
                                  onFocus={() => {
                                    if (!isDragging) {
                                      setSelectionStart({ r: rIdx, c: cIdx });
                                      setSelectionEnd({ r: rIdx, c: cIdx });
                                    }
                                  }}
                                  onPaste={(e) => handlePasteSpreadsheetData(e, rIdx, cIdx)}
                                  onContextMenu={(e) => handleCellContextMenu(e, rIdx, cIdx)}
                                  spellCheck={false}
                                  className={`w-full px-2 py-1 text-xs text-zinc-900 bg-transparent border-none outline-none focus:outline-none ${cell.bold ? 'font-bold' : ''
                                    } ${cell.italic ? 'italic' : ''} ${cell.align === 'center'
                                      ? 'text-center'
                                      : cell.align === 'right'
                                        ? 'text-right'
                                        : 'text-left'
                                    }`}
                                />
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Right-Click Context Menu portaled directly to document.body (prevents coordinate offset from transformed/filtered modal) */}
      {contextMenu &&
        createPortal(
          <div
            ref={contextMenuRef}
            style={{
              position: 'fixed',
              top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 440)),
              left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 240)),
              zIndex: 10000005,
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            className="w-56 bg-white/98 backdrop-blur-xl border border-zinc-200/90 rounded-2xl shadow-2xl p-1.5 text-xs text-zinc-800 space-y-0.5 animate-fadeIn select-none"
          >
            <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider select-none">
              Thao tác ô ({getExcelColLetter(anchorC)}{anchorR + 1})
            </div>

            <button
              type="button"
              onClick={() => {
                handleMergeSelection();
                setContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-lime-50 hover:text-lime-900 flex items-center gap-2 font-semibold text-left cursor-pointer transition-colors"
            >
              <Combine className="w-3.5 h-3.5 text-lime-600" />
              <span>Gộp các ô đã bôi đen</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleUnmergeSelection();
                setContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 font-semibold text-left cursor-pointer transition-colors"
            >
              <Split className="w-3.5 h-3.5 text-zinc-500" />
              <span>Hủy gộp ô</span>
            </button>

            <div className="border-t border-zinc-200 my-1" />

            <button
              type="button"
              onClick={() => {
                handleInsertRowAbove(contextMenu.r);
                setContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-left cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-500" />
              <span>Chèn hàng phía trên</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleInsertRowBelow(contextMenu.r);
                setContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-left cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-500" />
              <span>Chèn hàng phía dưới</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleInsertColumnLeft(contextMenu.c);
                setContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-left cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-500" />
              <span>Chèn cột bên trái</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleInsertColumnRight(contextMenu.c);
                setContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-left cursor-pointer transition-colors"
            >
              <Plus className="w-3.5 h-3.5 text-zinc-500" />
              <span>Chèn cột bên phải</span>
            </button>

            <div className="border-t border-zinc-200 my-1" />

            <button
              type="button"
              onClick={() => {
                handleDeleteRow(contextMenu.r);
                setContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-red-50 hover:text-red-700 flex items-center gap-2 text-left cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Xóa hàng {contextMenu.r + 1}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                handleDeleteColumn(contextMenu.c);
                setContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-red-50 hover:text-red-700 flex items-center gap-2 text-left cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Xóa cột {getExcelColLetter(contextMenu.c)}</span>
            </button>

            <div className="border-t border-zinc-200 my-1" />

            <button
              type="button"
              onClick={() => {
                handleClearSelection();
                setContextMenu(null);
              }}
              className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-left cursor-pointer transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>Xóa nội dung vùng chọn</span>
            </button>
          </div>,
          document.body
        )}
    </>
  );
};
