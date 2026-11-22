'use client';

import React, { useEffect, useReducer, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Minus,
  Plus,
  ScanSearch,
  Baseline,
  RemoveFormatting,
  PaintBucket,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Settings2,
  Grid3x3,
  Link2,
  MoreHorizontal,
  Sheet,
  RotateCcw,
} from 'lucide-react';
import type { CompletePaper, PaperFigure, PaperTable } from '@/types/paper';
import { NumberInput } from '@/components/ui/NumberInput';
import { DEFAULT_THEME } from '@/lib/theme-config';
import { SegmentedOptions } from '../components/sections/SegmentedOptions';
import { TablePlacementAndBreak } from '../components/TablePlacementAndBreak';
import { TableLookControls, applyLook, lookOf, type TableLookValue } from '../components/TableLookControls';
import { TableSettingsModal } from '../components/TableSettingsModal';
import { TableSpreadsheetModal } from '../components/TableSpreadsheetModal';
import { FigureSettingsModal } from '../components/FigureSettingsModal';
import { Field, ToggleRow } from '../components/settings-ui';
import { resolveBodyFill } from '@/lib/table-fill';
import { cleanSourceStyle, sourceLook, type TableSourceStyle } from '@/lib/table-source';
import { sectionBySid, type OverviewActions } from './overview-actions';
import { tableRowsOf } from './overview-doc';
import { currentBlock } from './overview-commands';
import { MenuList, buildMenu, hasCustomSize } from './OverviewMenu';
import { ColorPanel, Popover, ToolBtn, ToolPill, ToolSep, ToolTag, type BrandColor } from './overview-ui';

interface Props {
  editor: Editor | null;
  paper: CompletePaper;
  actions: OverviewActions;
  /** Colours of this paper's own settings, offered with the journal's. */
  paperColors: BrandColor[];
  zoom: number;
  isFit: boolean;
  readOnly?: boolean;
  /** The preview turns to the page of the block the cursor is in. */
  syncPdf: boolean;
  onToggleSync: () => void;
  hasPdf: boolean;
  onZoom: (z: number) => void;
  onFit: () => void;
  /** Opens the picker for a picture to put in the page ('insert') or in place of the figure's ('replace'). */
  pickImage: (mode: 'insert' | 'replace') => void;
}

/** Re-renders when the selection or the document changes (the buttons show what the cursor is in). */
function useEditorTick(editor: Editor | null) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!editor) return;
    editor.on('selectionUpdate', tick);
    editor.on('transaction', tick);
    return () => {
      editor.off('selectionUpdate', tick);
      editor.off('transaction', tick);
    };
  }, [editor]);
}

const Swatch: React.FC<{ color: string }> = ({ color }) => <span className="block w-[18px] h-1 rounded-full mt-0.5" style={{ background: color }} />;

/** The strip over the page, as a design tool's floating bar: the kind of block, the text, colour, what can be inserted, then the zoom. */
export const OverviewToolbar: React.FC<Props> = ({ editor, paper, actions, paperColors, zoom, isFit, readOnly, syncPdf, onToggleSync, hasPdf, onZoom, onFit, pickImage }) => {
  useEditorTick(editor);
  const can = !!editor && !readOnly;
  const active = (name: string) => !!editor?.isActive(name);
  const chain = () => editor!.chain().focus();
  const block = editor ? currentBlock(editor) : null;
  const sec = sectionBySid(paper.sections, block?.sid ?? null);
  const [textColor, setTextColor] = useState('#CC0000');
  const [cellFill, setCellFill] = useState('#FFEEAA');
  const [modal, setModal] = useState<{ kind: 'table' | 'figure' | 'sheet'; rect?: DOMRect } | null>(null);
  const journalId = paper.metadata.journalId;
  const markColor = editor?.getAttributes('textColor')?.color as string | undefined;
  // the cursor in one of the lines under a table: the tools for how those lines are set (one setting for all of them, as in the PDF)
  const sourceParent = editor ? editor.state.selection.$from.parent : null;
  const inSource = sourceParent?.type.name === 'tableSource';
  const srcLook = sourceLook(sec?.table?.sourceStyle, sourceParent?.textContent ?? '');
  const setSourceStyle = (patch: TableSourceStyle) => {
    if (!block?.sid || !sec?.table) return;
    actions.updateTable(block.sid, { sourceStyle: cleanSourceStyle({ ...sec.table.sourceStyle, ...patch }) });
  };

  return (
    <>
      {/* a little room round the bar so that its shadow is not cut by the box the page sits in */}
      <div className="flex-shrink-0 flex flex-col items-stretch gap-2 px-2.5 pt-1.5 pb-3" data-testid="overview-toolbar">
        {/* the tools take the width there is and wrap among themselves; zoom and the PDF link stay on the first row, at the end */}
        <ToolPill className="!flex-nowrap !items-start">
          <div className="flex items-center gap-0.5 flex-wrap flex-1 min-w-0">
            {/* undo and redo are in the title bar, for every tab: not repeated here */}
            {/* the kind of block ("Chuyển thành") and "Chèn" are in the right-click menu, the "/" menu and the "…" menu: not repeated here */}
            <ToolBtn title="In đậm (Ctrl+B)" on={active('bold')} disabled={!can} onClick={() => chain().toggleBold().run()}>
              <Bold className="w-[18px] h-[18px]" />
            </ToolBtn>
            <ToolBtn title="In nghiêng (Ctrl+I)" on={active('italic')} disabled={!can} onClick={() => chain().toggleItalic().run()}>
              <Italic className="w-[18px] h-[18px]" />
            </ToolBtn>
            <ToolBtn title="Gạch chân (Ctrl+U)" on={active('underline')} disabled={!can} onClick={() => chain().toggleUnderline().run()}>
              <Underline className="w-[18px] h-[18px]" />
            </ToolBtn>
            <ToolBtn title="Chỉ số trên" on={active('superscript')} disabled={!can} onClick={() => chain().toggleSuperscript().run()}>
              <span className="font-mono text-[13px]">x²</span>
            </ToolBtn>
            <ToolBtn title="Chỉ số dưới" on={active('subscript')} disabled={!can} onClick={() => chain().toggleSubscript().run()}>
              <span className="font-mono text-[13px]">x₂</span>
            </ToolBtn>
            <Popover
              label={null}
              title="Màu chữ"
              width={300}
              testId="overview-text-color"
              chevron={false}
              trigger={(open, toggle) => (
                <ToolBtn title="Màu chữ" on={open} disabled={!can} onClick={toggle} testId="overview-text-color">
                  <span className="flex flex-col items-center leading-none">
                    <Baseline className="w-[18px] h-[18px]" />
                    <Swatch color={markColor ?? textColor} />
                  </span>
                </ToolBtn>
              )}
            >
              {(close) => (
                <ColorPanel
                  title="Màu chữ"
                  value={markColor ?? null}
                  journalId={journalId}
                  paper={paperColors}
                  clearLabel="Bỏ màu chữ"
                  onPick={(hex) => {
                    if (hex) {
                      setTextColor(hex);
                      chain().setMark('textColor', { color: hex }).run();
                    } else chain().unsetMark('textColor').run();
                    close();
                  }}
                />
              )}
            </Popover>
            <ToolBtn title="Xóa định dạng chữ" disabled={!can} onClick={() => chain().unsetAllMarks().run()}>
              <RemoveFormatting className="w-[18px] h-[18px]" />
            </ToolBtn>
            <ToolSep />
            <Popover label={<MoreHorizontal className="w-[18px] h-[18px]" />} title="Thao tác với khối: di chuyển, nhân đôi, xóa…" disabled={!can || !block} width={270} chevron={false} testId="overview-block-menu">
              {(close) => <MenuList sections={buildMenu({ editor: editor!, paper, actions, pickImage, close, blockOnly: true })} />}
            </Popover>
            {/* what the cursor is in: its own tools, beside the others; what the right-click menu already offers is not repeated here */}
            {can && block?.kind === 'table' && (
              <>
                <ToolSep />
                <span data-testid="overview-table-tools" className="contents">
                  <ToolTag>Bảng</ToolTag>
                  <ToolBtn title="Mở bảng tính toàn màn hình để sửa nhiều ô, dán từ Excel" onClick={() => setModal({ kind: 'sheet' })} wide testId="overview-open-sheet">
                    <Sheet className="w-4 h-4" />
                    Bảng tính
                  </ToolBtn>
                  <ToolSep />
                  <ToolBtn title="Căn trái ô" onClick={() => chain().setCellAttribute('align', 'left').run()}>
                    <AlignLeft className="w-[18px] h-[18px]" />
                  </ToolBtn>
                  <ToolBtn title="Căn giữa ô" onClick={() => chain().setCellAttribute('align', 'center').run()}>
                    <AlignCenter className="w-[18px] h-[18px]" />
                  </ToolBtn>
                  <ToolBtn title="Căn phải ô" onClick={() => chain().setCellAttribute('align', 'right').run()}>
                    <AlignRight className="w-[18px] h-[18px]" />
                  </ToolBtn>
                  <Popover
                    label={null}
                    title="Màu nền ô"
                    width={300}
                    chevron={false}
                    trigger={(open, toggle) => (
                      <ToolBtn title="Màu nền ô" on={open} onClick={toggle} testId="overview-cell-fill">
                        <span className="flex flex-col items-center leading-none">
                          <PaintBucket className="w-[18px] h-[18px]" />
                          <Swatch color={cellFill} />
                        </span>
                      </ToolBtn>
                    )}
                  >
                    {(close) => (
                      <ColorPanel
                        title="Màu nền ô"
                        journalId={journalId}
                        paper={paperColors}
                        clearLabel="Bỏ màu nền ô"
                        onPick={(hex) => {
                          if (hex) {
                            setCellFill(hex);
                            chain().setCellAttribute('fill', hex).run();
                          } else chain().setCellAttribute('fill', null).run();
                          close();
                        }}
                      />
                    )}
                  </Popover>
                  <ToolSep />
                  {sec?.table && block.sid && (
                    <Popover label={<><Grid3x3 className="w-4 h-4" />Kiểu bảng</>} title="Đường kẻ, màu, cỡ chữ, vị trí của bảng" width={380} testId="overview-table-style">
                      {() => <TableStylePanel table={sec.table!} sid={block.sid!} actions={actions} onFull={(rect) => setModal({ kind: 'table', rect })} />}
                    </Popover>
                  )}
                  {/* in the lines under the table: how they are set (the whole block, as the PDF shows it) */}
                  {inSource && sec?.table && block.sid && (
                    <span data-testid="overview-source-tools" className="contents">
                      <ToolSep />
                      <ToolTag>Nguồn</ToolTag>
                      <ToolBtn title="In đậm các dòng dưới bảng" on={srcLook.bold} onClick={() => setSourceStyle({ bold: !srcLook.bold })} testId="overview-source-bold">
                        <Bold className="w-[18px] h-[18px]" />
                      </ToolBtn>
                      <ToolBtn title="In nghiêng các dòng dưới bảng" on={srcLook.italic} onClick={() => setSourceStyle({ italic: !srcLook.italic })} testId="overview-source-italic">
                        <Italic className="w-[18px] h-[18px]" />
                      </ToolBtn>
                      <ToolBtn title="Căn trái các dòng dưới bảng" on={srcLook.align === 'left'} onClick={() => setSourceStyle({ align: 'left' })} testId="overview-source-left">
                        <AlignLeft className="w-[18px] h-[18px]" />
                      </ToolBtn>
                      <ToolBtn title="Căn giữa các dòng dưới bảng" on={srcLook.align === 'center'} onClick={() => setSourceStyle({ align: 'center' })} testId="overview-source-center">
                        <AlignCenter className="w-[18px] h-[18px]" />
                      </ToolBtn>
                      <ToolBtn title="Căn phải các dòng dưới bảng" on={srcLook.align === 'right'} onClick={() => setSourceStyle({ align: 'right' })} testId="overview-source-right">
                        <AlignRight className="w-[18px] h-[18px]" />
                      </ToolBtn>
                    </span>
                  )}
                </span>
              </>
            )}
            {can && block?.kind === 'figure' && sec?.figure && block.sid && (
              <>
                <ToolSep />
                <span data-testid="overview-figure-tools" className="contents">
                  <ToolTag>Hình</ToolTag>
                  <FigureQuick figure={sec.figure} sid={block.sid} actions={actions} onFull={(rect) => setModal({ kind: 'figure', rect })} />
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <ToolBtn title={syncPdf ? 'PDF đang theo con trỏ (bấm để tắt)' : 'Bật: PDF cuộn theo khối đang chọn'} on={syncPdf} disabled={!hasPdf} onClick={onToggleSync} testId="overview-sync-pdf" wide>
              <Link2 className="w-4 h-4" />
              PDF
            </ToolBtn>
            <ToolSep />
            <ToolBtn title="Thu nhỏ" onClick={() => onZoom(Math.max(0.4, Math.round((zoom - 0.1) * 10) / 10))}>
              <Minus className="w-4 h-4" />
            </ToolBtn>
            <span className="w-12 text-center text-[12px] font-semibold text-zinc-700 tabular-nums">{Math.round(zoom * 100)}%</span>
            <ToolBtn title="Phóng to" onClick={() => onZoom(Math.min(2, Math.round((zoom + 0.1) * 10) / 10))}>
              <Plus className="w-4 h-4" />
            </ToolBtn>
            <ToolBtn title="Vừa khung" on={isFit} onClick={onFit}>
              <ScanSearch className="w-[18px] h-[18px]" />
            </ToolBtn>
          </div>
        </ToolPill>

      </div>

      {modal?.kind === 'table' && sec?.table && block?.sid && (
        <TableSettingsModal table={sec.table} triggerRect={modal.rect} onSave={(t) => actions.updateTable(block.sid!, t)} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'sheet' && sec?.table && block?.sid && (
        <TableSpreadsheetModal isOpen table={sec.table} onSave={(t) => actions.replaceTable(block.sid!, t)} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'figure' && sec?.figure && block?.sid && (
        <FigureSettingsModal figure={sec.figure} triggerRect={modal.rect} onSave={(f) => actions.updateFigure(block.sid!, f)} onClose={() => setModal(null)} />
      )}
    </>
  );
};

/** The table's look and layout, edited on the page with its effect seen at once. */
const TableStylePanel: React.FC<{ table: PaperTable; sid: string; actions: OverviewActions; onFull: (rect: DOMRect) => void }> = ({ table, sid, actions, onFull }) => {
  const look = lookOf(table);
  const rowCount = tableRowsOf(table).body.length;
  const span = table.columnSpan || (table.isFullWidth === false ? '1-column' : '2-column');
  const change = (patch: Partial<TableLookValue>) => {
    const applied = applyLook(table, { ...look, ...patch }, rowCount, 'rowHeight' in patch);
    const keys = ['borderStyle', 'borderColor', 'borderWidth', 'headerFill', 'bodyTint', 'headerHeight', 'rowHeights'] as const;
    actions.updateTable(sid, Object.fromEntries(keys.map((k) => [k, applied[k]])) as Partial<PaperTable>);
  };
  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1" data-testid="table-style-panel">
      <TableLookControls value={look} onChange={change} themeHeader={DEFAULT_THEME.tableHeaderColor} themeTint={DEFAULT_THEME.tableZebraColor} />
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200/70">
        <Field label="Cỡ chữ">
          <NumberInput value={parseFloat(table.fontSize ?? '8') || 8} onChange={(v) => actions.updateTable(sid, { fontSize: `${Math.round(v * 2) / 2}pt` as `${number}pt` })} min={5} max={14} step={0.5} unit="pt" variant="flat-white" ariaLabel="Cỡ chữ bảng (pt)" />
        </Field>
        <Field label="Số cột">
          <SegmentedOptions ariaLabel="Số cột của bảng" value={span} onChange={(v) => actions.updateTable(sid, { columnSpan: v, isFullWidth: v === '2-column' })} options={[{ value: '1-column', label: '1 cột' }, { value: '2-column', label: '2 cột' }]} />
        </Field>
      </div>
      <ToggleRow checked={!!table.isRotated} onChange={(v) => actions.updateTable(sid, { isRotated: v })} label="Xoay ngang 90°" hint="Cho bảng nhiều cột." />
      <TablePlacementAndBreak
        placement={table.placement || 'auto'}
        onPlacement={(placement) => actions.updateTable(sid, { placement })}
        breakAcrossPages={table.breakAcrossPages || 'auto'}
        onBreakAcrossPages={(breakAcrossPages) => actions.updateTable(sid, { breakAcrossPages })}
        bodyFill={resolveBodyFill(table)}
        onBodyFill={(bodyFill) => actions.updateTable(sid, { bodyFill, hasZebraStripes: bodyFill === 'zebra' })}
      />
      {/* the way back from columns or rows dragged to sizes nobody wanted */}
      <button
        type="button"
        data-testid="table-reset-size"
        disabled={!hasCustomSize(table)}
        onClick={() => actions.resetTableSize(sid)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold text-zinc-600 bg-gray-200/70 hover:bg-gray-200 disabled:opacity-40 disabled:cursor-default cursor-pointer"
        title="Cột chia đều theo nội dung, hàng cao theo chữ: bỏ các kích thước đã kéo"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Đặt lại độ rộng cột và chiều cao hàng
      </button>
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200/70">
        <button type="button" data-testid="table-apply-all" onClick={() => actions.applyTableLookToAll(sid)} className="px-3.5 py-2 rounded-full text-xs font-bold bg-lime-200/70 text-lime-950 hover:bg-lime-200 cursor-pointer" title="Chép đường kẻ, màu, cỡ chữ và nền của bảng này sang mọi bảng khác">
          Áp dụng cho mọi bảng
        </button>
        <button type="button" onClick={(e) => onFull((e.currentTarget as HTMLElement).getBoundingClientRect())} className="inline-flex items-center gap-1 px-3.5 py-2 rounded-full text-xs font-bold text-zinc-600 bg-gray-200/70 hover:bg-gray-200 cursor-pointer">
          <Settings2 className="w-3.5 h-3.5" />
          Cài đặt đầy đủ
        </button>
      </div>
    </div>
  );
};

/** Layout of the figure the cursor is in, in the toolbar. */
const FigureQuick: React.FC<{ figure: PaperFigure; sid: string; actions: OverviewActions; onFull: (rect: DOMRect) => void }> = ({ figure, sid, actions, onFull }) => {
  const span = figure.columnSpan || (figure.isFullWidth === false ? '1-column' : '2-column');
  const scale = figure.scalePercent ?? 100;
  return (
    <>
      {[50, 70, 85, 100].map((pct) => (
        <ToolBtn key={pct} title={`Rộng ${pct}% cột`} on={scale === pct} onClick={() => actions.updateFigure(sid, { scalePercent: pct })} testId={`figure-width-${pct}`}>
          {pct}%
        </ToolBtn>
      ))}
      <ToolSep />
      <ToolBtn title="Hình vừa một cột" on={span === '1-column'} onClick={() => actions.updateFigure(sid, { columnSpan: '1-column', isFullWidth: false })} testId="figure-span-1" wide>
        1 cột
      </ToolBtn>
      <ToolBtn title="Hình trải cả trang" on={span === '2-column'} onClick={() => actions.updateFigure(sid, { columnSpan: '2-column', isFullWidth: true })} testId="figure-span-2" wide>
        2 cột
      </ToolBtn>
      <ToolBtn title="Khung viền quanh hình" on={figure.hasBorder !== false} onClick={() => actions.updateFigure(sid, { hasBorder: figure.hasBorder === false })} wide>
        Khung
      </ToolBtn>
      <ToolSep />
      <button type="button" data-testid="figure-apply-all" onClick={() => actions.applyFigureLookToAll(sid)} className="px-3.5 py-2 rounded-full text-xs font-bold bg-lime-200/70 text-lime-950 hover:bg-lime-200 cursor-pointer" title="Chép cách đặt hình này sang mọi hình khác">
        Áp dụng cho mọi hình
      </button>
      <ToolBtn title="Cài đặt đầy đủ của hình" onClick={() => onFull(new DOMRect(window.innerWidth - 420, 120, 0, 0))}>
        <Settings2 className="w-[18px] h-[18px]" />
      </ToolBtn>
    </>
  );
};
