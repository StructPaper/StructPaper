'use client';

import React, { useEffect, useReducer } from 'react';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Underline, Bookmark, Sigma, Asterisk, List, Link2 } from 'lucide-react';
import { toggleBullet } from '../../overview/overview-lists';

export interface TipTapFormattingToolbarProps {
  editor: Editor | null;
  onToggleRefPicker: () => void;
  onToggleMathModal: () => void;
  onToggleXref?: () => void;
  onToggleNote?: () => void;
}

const preventBlurOnMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault();

export const TipTapFormattingToolbar: React.FC<TipTapFormattingToolbarProps> = ({
  editor,
  onToggleRefPicker,
  onToggleMathModal,
  onToggleXref,
  onToggleNote,
}) => {
  // the marks that are on (bold, italic…) follow the cursor: the toolbar draws itself again when the editor's state moves
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!editor) return;
    editor.on('transaction', redraw);
    return () => {
      editor.off('transaction', redraw);
    };
  }, [editor]);

  // the same look as the toolbar of the one-line fields (RichLineInput): no fill, no colours, a line under it
  const tool = 'h-7 min-w-7 px-1.5 rounded-lg flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-200/70 cursor-pointer transition-colors';
  const markBtnClass = (mark: string) => `${tool} ${editor?.isActive(mark) ? 'bg-zinc-200/70 text-zinc-900' : ''}`;
  const btn = (props: { label: string; title: string; onClick?: () => void; className?: string; testId?: string; children: React.ReactNode }) => (
    <button
      type="button"
      tabIndex={-1}
      onMouseDown={preventBlurOnMouseDown}
      onClick={props.onClick}
      className={props.className ?? tool}
      title={props.title}
      aria-label={props.label}
      data-testid={props.testId}
    >
      {props.children}
    </button>
  );

  return (
    <div className="px-3">
      <div className="mt-2.5 mb-0 pb-1.5 border-b border-zinc-200/70 flex flex-wrap items-center gap-0.5 font-normal not-italic text-xs select-none">
        {btn({ label: 'In đậm', title: 'Đậm (Ctrl+B)', onClick: () => editor?.chain().focus().toggleBold().run(), className: markBtnClass('bold'), children: <Bold className="w-3.5 h-3.5" /> })}
        {btn({ label: 'In nghiêng', title: 'Nghiêng (Ctrl+I)', onClick: () => editor?.chain().focus().toggleItalic().run(), className: markBtnClass('italic'), children: <Italic className="w-3.5 h-3.5" /> })}
        {btn({ label: 'Gạch chân', title: 'Gạch chân (Ctrl+U)', onClick: () => editor?.chain().focus().toggleUnderline().run(), className: markBtnClass('underline'), children: <Underline className="w-3.5 h-3.5" /> })}
        {btn({ label: 'Chỉ số trên', title: 'Chỉ số trên (x²)', onClick: () => editor?.chain().focus().toggleSuperscript().run(), className: markBtnClass('superscript'), children: 'x²' })}
        {btn({ label: 'Chỉ số dưới', title: 'Chỉ số dưới (x₂)', onClick: () => editor?.chain().focus().toggleSubscript().run(), className: markBtnClass('subscript'), children: 'x₂' })}
        <span className="w-px h-4 bg-zinc-300 mx-1" />
        {btn({ label: 'Chèn trích dẫn', title: 'Chèn trích dẫn (gõ [ hoặc nhấp vào đây)', onClick: onToggleRefPicker, children: (<><Bookmark className="w-3.5 h-3.5" />Trích dẫn</>) })}
        {btn({ label: 'Chèn công thức', title: 'Chèn công thức toán học ($latex$)', onClick: onToggleMathModal, children: (<><Sigma className="w-3.5 h-3.5" />Toán</>) })}
        {btn({ label: 'Danh sách chấm đầu dòng', title: 'Đầu dòng danh sách: thêm hoặc bỏ dấu chấm ở đầu đoạn này', onClick: () => editor && toggleBullet(editor), testId: 'toggle-bullet', children: (<><List className="w-3.5 h-3.5" />Danh sách</>) })}
        {btn({ label: 'Chèn tham chiếu bảng hình', title: 'Chèn tham chiếu đến một bảng hoặc hình (như “Bảng 2”)', onClick: onToggleXref, testId: 'insert-xref', children: (<><Link2 className="w-3.5 h-3.5" />Bảng/Hình</>) })}
        {btn({ label: 'Chèn chú thích chân trang', title: 'Chèn chú thích chân trang: nội dung in ở cuối trang có câu này', onClick: onToggleNote, testId: 'insert-footnote', children: (<><Asterisk className="w-3.5 h-3.5" />Chú thích</>) })}
      </div>
    </div>
  );
};
