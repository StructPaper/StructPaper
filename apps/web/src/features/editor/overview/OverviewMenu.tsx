'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Copy,
  Scissors,
  ClipboardPaste,
  Trash2,
  CopyPlus,
  ArrowUp,
  ArrowDown,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  Quote,
  Square,
  Rows3,
  Columns3,
  Merge,
  Split,
  PanelTop,
  Image as ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FileDown,
  Plus,
  ChevronRight,
  RefreshCw,
  Table as TableIcon,
  Sigma,
  RotateCcw,
  Asterisk,
  List,
  Bookmark,
  Link2,
} from 'lucide-react';
import type { CompletePaper, PaperTable } from '@/types/paper';
import type { OverviewActions } from './overview-actions';
import { sectionBySid } from './overview-actions';
import { canMove, convertBlock, currentBlock, deleteBlock, duplicateBlock, moveBlock, type BlockKind } from './overview-commands';
import { INSERT_ITEMS, insertBlock, readImageFile, type InsertKind } from './overview-insert';
import { POPUP_MOTION } from './overview-ui';
import { toggleBullet } from './overview-lists';
import { canInsertInline } from './overview-commands';
import { listMarkOf } from '@/lib/list-marks';
import { POPUP_EDGE, clampPopup, popupMaxHeight } from '@/lib/popup-bounds';

export type InlineKind = 'cite' | 'math' | 'xref' | 'note';

export interface MenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  danger?: boolean;
  disabled?: boolean;
  on?: boolean;
  onClick?: () => void;
  /** A group that opens under the item. */
  children?: MenuItem[];
}

export type MenuSection = MenuItem[];

const ic = 'w-4 h-4';

/** Has the table column widths or row heights that were set by dragging? */
export const hasCustomSize = (table: PaperTable | undefined): boolean => !!table && (!!table.colWeights || !!table.headerHeight || !!table.rowHeights?.some((h) => h));

const KIND_ITEMS: Array<{ kind: 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'box'; label: string; icon: React.ReactNode }> = [
  { kind: 'paragraph', label: 'Đoạn văn', icon: <Pilcrow className={ic} /> },
  { kind: 'h1', label: 'Mục lớn (cấp 1)', icon: <Heading1 className={ic} /> },
  { kind: 'h2', label: 'Mục con (cấp 2)', icon: <Heading2 className={ic} /> },
  { kind: 'h3', label: 'Mục nhỏ (cấp 3)', icon: <Heading3 className={ic} /> },
  { kind: 'quote', label: 'Trích nguyên văn', icon: <Quote className={ic} /> },
  { kind: 'box', label: 'Khung nổi', icon: <Square className={ic} /> },
];

export const KIND_LABEL: Record<BlockKind, string> = {
  paragraph: 'Đoạn văn',
  h1: 'Mục lớn',
  h2: 'Mục con',
  h3: 'Mục nhỏ',
  quote: 'Trích nguyên văn',
  box: 'Khung nổi',
  table: 'Bảng',
  figure: 'Hình',
  equation: 'Công thức',
  citation: 'Trích dẫn',
};

const INSERT_ICON: Record<InsertKind, React.ReactNode> = {
  paragraph: <Pilcrow className={ic} />,
  h1: <Heading1 className={ic} />,
  h2: <Heading2 className={ic} />,
  h3: <Heading3 className={ic} />,
  table: <TableIcon className={ic} />,
  figure: <ImageIcon className={ic} />,
  equation: <Sigma className={ic} />,
  quote: <Quote className={ic} />,
};

/** What the author can do with what the cursor is in: text, then the block, then a table or a figure. Used by the right-click menu and the toolbar's block menu. */
export function buildMenu(opts: {
  editor: Editor;
  paper: CompletePaper;
  actions: OverviewActions;
  /** Opens the picker for a new picture (the block's own, or the one to insert). */
  pickImage: (mode: 'insert' | 'replace') => void;
  close: () => void;
  /** Only the block's own commands (no clipboard or text formatting). */
  blockOnly?: boolean;
  /** Opens the dialog that puts something into the text at the cursor. */
  openInline?: (kind: InlineKind) => void;
}): MenuSection[] {
  const { editor, paper, actions, pickImage, close, blockOnly } = opts;
  const run = (fn: () => void) => () => {
    fn();
    close();
  };
  const chain = () => editor.chain().focus();
  const block = currentBlock(editor);
  const sec = sectionBySid(paper.sections, block?.sid ?? null);
  const hasSelection = !editor.state.selection.empty;
  const sections: MenuSection[] = [];

  if (!blockOnly) {
    sections.push([
      { id: 'cut', label: 'Cắt', icon: <Scissors className={ic} />, shortcut: 'Ctrl+X', disabled: !hasSelection, onClick: run(() => void document.execCommand('cut')) },
      { id: 'copy', label: 'Sao chép', icon: <Copy className={ic} />, shortcut: 'Ctrl+C', disabled: !hasSelection, onClick: run(() => void document.execCommand('copy')) },
      {
        id: 'paste',
        label: 'Dán',
        icon: <ClipboardPaste className={ic} />,
        shortcut: 'Ctrl+V',
        onClick: run(() => {
          navigator.clipboard
            ?.readText()
            .then((t) => t && editor.chain().focus().insertContent(t).run())
            .catch(() => undefined);
        }),
      },
    ]);
    sections.push([
      { id: 'bold', label: 'In đậm', icon: <Bold className={ic} />, shortcut: 'Ctrl+B', on: editor.isActive('bold'), onClick: run(() => void chain().toggleBold().run()) },
      { id: 'italic', label: 'In nghiêng', icon: <Italic className={ic} />, shortcut: 'Ctrl+I', on: editor.isActive('italic'), onClick: run(() => void chain().toggleItalic().run()) },
      { id: 'underline', label: 'Gạch chân', icon: <Underline className={ic} />, shortcut: 'Ctrl+U', on: editor.isActive('underline'), onClick: run(() => void chain().toggleUnderline().run()) },
      {
        id: 'list-item',
        label: 'Danh sách chấm đầu dòng',
        icon: <List className={ic} />,
        on: !!block && listMarkOf(editor.state.selection.$from.parent.textContent) !== null,
        disabled: !(block && block.name === 'paragraph'),
        onClick: run(() => void toggleBullet(editor)),
      },
    ]);
    // what goes into the line of text at the cursor, wherever it is (a paragraph, a heading, a caption, a source line)
    const inline = canInsertInline(editor);
    sections.push([
      { id: 'ins-math', label: 'Chèn công thức…', icon: <Sigma className={ic} />, disabled: !inline, onClick: run(() => opts.openInline?.('math')) },
      { id: 'ins-cite', label: 'Chèn trích dẫn tài liệu…', icon: <Bookmark className={ic} />, disabled: !inline, onClick: run(() => opts.openInline?.('cite')) },
      { id: 'ins-xref', label: 'Chèn tham chiếu bảng/hình…', icon: <Link2 className={ic} />, disabled: !inline, onClick: run(() => opts.openInline?.('xref')) },
      { id: 'footnote', label: 'Chèn chú thích chân trang…', icon: <Asterisk className={ic} />, disabled: !inline, onClick: run(() => opts.openInline?.('note')) },
    ]);  }

  if (block) {
    const isText = block.name === 'paragraph' || block.name === 'heading';
    const blockItems: MenuItem[] = [];
    if (isText) {
      blockItems.push({
        id: 'convert',
        label: 'Chuyển thành',
        icon: <RefreshCw className={ic} />,
        children: KIND_ITEMS.map((k) => ({ id: `to-${k.kind}`, label: k.label, icon: k.icon, on: block.kind === k.kind, onClick: run(() => void convertBlock(editor, k.kind)) })),
      });
    }
    blockItems.push({
      id: 'insert',
      label: 'Chèn bên dưới',
      icon: <Plus className={ic} />,
      children: INSERT_ITEMS.map((it) => ({
        id: `ins-${it.kind}`,
        label: it.label,
        icon: INSERT_ICON[it.kind],
        onClick: run(() => {
          if (it.kind === 'figure') pickImage('insert');
          else insertBlock(editor, it.kind);
        }),
      })),
    });
    blockItems.push(
      { id: 'dup', label: 'Nhân đôi khối', icon: <CopyPlus className={ic} />, onClick: run(() => void duplicateBlock(editor, (sid) => sectionBySid(paper.sections, sid)?.figure?.src)) },
      { id: 'up', label: 'Di chuyển lên', icon: <ArrowUp className={ic} />, disabled: !canMove(editor, -1), onClick: run(() => void moveBlock(editor, -1)) },
      { id: 'down', label: 'Di chuyển xuống', icon: <ArrowDown className={ic} />, disabled: !canMove(editor, 1), onClick: run(() => void moveBlock(editor, 1)) }
    );
    if (block.sid && sec) {
      blockItems.push({ id: 'pb', label: 'Ngắt trang sau khối này', icon: <FileDown className={ic} />, on: !!sec.pageBreakAfter, onClick: run(() => actions.updateSection(block.sid!, { pageBreakAfter: sec.pageBreakAfter ? undefined : true })) });
    }
    blockItems.push({ id: 'del', label: `Xóa ${KIND_LABEL[block.kind].toLowerCase()}`, icon: <Trash2 className={ic} />, shortcut: 'Xóa', danger: true, onClick: run(() => void deleteBlock(editor)) });
    sections.push(blockItems);

    if (block.kind === 'table') {
      sections.push([
        { id: 'row-up', label: 'Thêm hàng phía trên', icon: <Rows3 className={ic} />, disabled: !editor.can().addRowBefore(), onClick: run(() => void chain().addRowBefore().run()) },
        { id: 'row-down', label: 'Thêm hàng phía dưới', icon: <Rows3 className={ic} />, disabled: !editor.can().addRowAfter(), onClick: run(() => void chain().addRowAfter().run()) },
        { id: 'row-del', label: 'Xóa hàng', icon: <Trash2 className={ic} />, disabled: !editor.can().deleteRow(), onClick: run(() => void chain().deleteRow().run()) },
        { id: 'col-l', label: 'Thêm cột bên trái', icon: <Columns3 className={ic} />, disabled: !editor.can().addColumnBefore(), onClick: run(() => void chain().addColumnBefore().run()) },
        { id: 'col-r', label: 'Thêm cột bên phải', icon: <Columns3 className={ic} />, disabled: !editor.can().addColumnAfter(), onClick: run(() => void chain().addColumnAfter().run()) },
        { id: 'col-del', label: 'Xóa cột', icon: <Trash2 className={ic} />, disabled: !editor.can().deleteColumn(), onClick: run(() => void chain().deleteColumn().run()) },
        { id: 'merge', label: 'Gộp ô đang chọn', icon: <Merge className={ic} />, disabled: !editor.can().mergeCells(), onClick: run(() => void chain().mergeCells().run()) },
        { id: 'split', label: 'Tách ô đã gộp', icon: <Split className={ic} />, disabled: !editor.can().splitCell(), onClick: run(() => void chain().splitCell().run()) },
        { id: 'head', label: 'Hàng đầu là hàng tiêu đề', icon: <PanelTop className={ic} />, onClick: run(() => void chain().toggleHeaderRow().run()) },
        // the way back from columns or rows dragged to sizes nobody wanted
        {
          id: 'reset-size',
          label: 'Đặt lại độ rộng cột và chiều cao hàng',
          icon: <RotateCcw className={ic} />,
          disabled: !block.sid || !hasCustomSize(sec?.table),
          onClick: run(() => block.sid && actions.resetTableSize(block.sid)),
        },
      ]);
    }
    if (block.kind === 'equation' && block.sid && sec?.equation) {
      const eq = sec.equation;
      const sid = block.sid;
      sections.push([{ id: 'eq-num', label: 'Đánh số công thức', icon: <Sigma className={ic} />, on: !!eq.numbered, onClick: run(() => actions.updateSection(sid, { equation: { ...eq, numbered: !eq.numbered } })) }]);
    }
    if (block.kind === 'figure' && block.sid && sec?.figure) {
      const fig = sec.figure;
      const sid = block.sid;
      sections.push([
        { id: 'replace', label: 'Thay ảnh…', icon: <ImageIcon className={ic} />, onClick: run(() => pickImage('replace')) },
        { id: 'al', label: 'Căn trái', icon: <AlignLeft className={ic} />, on: fig.alignment === 'left', onClick: run(() => actions.updateFigure(sid, { alignment: 'left' })) },
        { id: 'ac', label: 'Căn giữa', icon: <AlignCenter className={ic} />, on: (fig.alignment ?? 'center') === 'center', onClick: run(() => actions.updateFigure(sid, { alignment: 'center' })) },
        { id: 'ar', label: 'Căn phải', icon: <AlignRight className={ic} />, on: fig.alignment === 'right', onClick: run(() => actions.updateFigure(sid, { alignment: 'right' })) },
      ]);
    }
  }
  return sections;
}

/** The group that opens beside an item: to the right of it (to the left when there is no room), level with it. */
const Flyout: React.FC<{ item: MenuItem; rect: DOMRect; renderRow: (it: MenuItem) => React.ReactNode; onEnter: () => void; onLeave: () => void }> = ({ item, rect, renderRow, onEnter, onLeave }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: rect.right + 4, top: rect.top - 6 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const b = el.getBoundingClientRect();
    const left = rect.right + 4 + b.width > window.innerWidth - POPUP_EDGE ? Math.max(POPUP_EDGE, rect.left - b.width - 4) : rect.right + 4;
    // level with its item, but inside the room under the title bar (it scrolls inside itself when it is taller)
    setPos({ left, top: clampPopup(left, rect.top - 6, b.width, b.height).top });
  }, [rect]);
  return (
    <motion.div
      ref={ref}
      {...POPUP_MOTION}
      role="menu"
      data-overview-flyout=""
      data-testid={`flyout-${item.id}`}
      className="fixed z-[10001] w-[230px] overflow-y-auto rounded-2xl bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.22),0_0_0_0.5px_rgba(0,0,0,0.05)] p-1.5"
      style={{ left: pos.left, top: pos.top, maxHeight: popupMaxHeight() }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onMouseDown={(e) => e.preventDefault()}
    >
      {item.children?.map((c) => renderRow(c))}
    </motion.div>
  );
};

/** One list of menu sections: items with an icon, a label and a shortcut; a group opens in a panel beside its item when the pointer is over it. */
export const MenuList: React.FC<{ sections: MenuSection[] }> = ({ sections }) => {
  const [open, setOpen] = useState<{ item: MenuItem; rect: DOMRect } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  // The pointer on its way to the panel crosses the edge of the menu and may pass over the next items. So nothing changes the moment the
  // pointer leaves an item: it waits a moment (the panel's own arrival cancels it), and only then closes the panel or opens another one.
  const later = (then: () => void = () => setOpen(null), ms = 320) => {
    cancel();
    timer.current = setTimeout(then, ms);
  };
  useEffect(() => cancel, []);
  const show = (it: MenuItem, el: HTMLElement) => {
    cancel();
    setOpen({ item: it, rect: el.getBoundingClientRect() });
  };
  /** A group's item: opens its panel at once when none is open, otherwise after the pause. */
  const hoverGroup = (it: MenuItem, el: HTMLElement) => {
    if (!open || open.item.id === it.id) show(it, el);
    else later(() => setOpen({ item: it, rect: el.getBoundingClientRect() }), 220);
  };
  const row = (it: MenuItem, nested = false) => (
    <button
      key={it.id}
      type="button"
      role="menuitem"
      aria-haspopup={it.children ? 'menu' : undefined}
      aria-expanded={it.children ? open?.item.id === it.id : undefined}
      data-testid={`menu-${it.id}`}
      disabled={it.disabled}
      aria-pressed={it.on}
      // the items inside a panel do nothing on the pointer: they must not close the panel they are in
      onMouseEnter={nested ? undefined : (e) => (it.children ? hoverGroup(it, e.currentTarget) : open ? later(() => setOpen(null), 220) : undefined)}
      onMouseLeave={nested ? undefined : () => it.children && later()}
      onClick={(e) => (it.children ? show(it, e.currentTarget) : it.onClick?.())}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-left transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-default ${
        it.danger ? 'text-red-600 hover:bg-red-50' : it.on ? 'bg-[#ECFCCB] text-[#14532D]' : open?.item.id === it.id ? 'bg-zinc-100 text-zinc-800' : 'text-zinc-800 hover:bg-zinc-100'
      }`}
    >
      <span className="w-4 h-4 flex-shrink-0 text-zinc-500">{it.icon}</span>
      <span className="flex-1">{it.label}</span>
      {it.shortcut && <span className="text-[11px] font-semibold text-zinc-400 bg-zinc-100 rounded-md px-1.5 py-0.5">{it.shortcut}</span>}
      {it.children && <ChevronRight className="w-4 h-4 text-zinc-400" />}
    </button>
  );
  return (
    <div role="menu">
      {sections.map((sec, i) => (
        <div key={i} className={i > 0 ? 'mt-1 pt-1 border-t border-zinc-100' : ''}>
          {sec.map((it) => row(it))}
        </div>
      ))}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>{open && <Flyout key={open.item.id} item={open.item} rect={open.rect} renderRow={(c) => row(c, true)} onEnter={cancel} onLeave={() => later()} />}</AnimatePresence>,
          document.body
        )}
    </div>
  );
};

/** The menu that opens under the right mouse button on the page. */
export const OverviewContextMenu: React.FC<{ x: number; y: number; editor: Editor; paper: CompletePaper; actions: OverviewActions; onClose: () => void; pickImage: (mode: 'insert' | 'replace') => void; openInline?: (kind: InlineKind) => void }> = ({ x, y, editor, paper, actions, onClose, pickImage, openInline }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  const sections = useMemo(() => buildMenu({ editor, paper, actions, pickImage, close: onClose, openInline }), [editor, paper, actions, pickImage, onClose, openInline]);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      // a click in a panel that opened beside an item is a click in the menu
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as Element).closest?.('[data-overview-flyout]')) onClose();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('mousedown', down);
    window.addEventListener('keydown', key);
    window.addEventListener('blur', onClose);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('keydown', key);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);
  // the menu stays inside the window, under the title bar (it is never taller than the room there is; the rest scrolls inside it)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const c = clampPopup(x, y, r.width, r.height);
    setPos({ x: c.left, y: c.top });
  }, [x, y, sections]);
  return (
    <motion.div
      ref={ref}
      {...POPUP_MOTION}
      data-testid="overview-context-menu"
      className="fixed z-[80] w-[270px] overflow-y-auto rounded-2xl bg-white border border-zinc-100 shadow-[0_12px_40px_rgba(0,0,0,0.22),0_0_0_0.5px_rgba(0,0,0,0.05)] p-1.5"
      style={{ left: pos.x, top: pos.y, maxHeight: popupMaxHeight() }}
      onMouseDown={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <MenuList sections={sections} />
    </motion.div>
  );
};

export { readImageFile };
