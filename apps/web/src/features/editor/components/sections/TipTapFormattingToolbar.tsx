'use client';

import React from 'react';
import type { Editor } from '@tiptap/react';
import { Bold, Italic, Bookmark, Sigma } from 'lucide-react';

export interface TipTapFormattingToolbarProps {
  editor: Editor | null;
  onToggleRefPicker: () => void;
  onToggleMathModal: () => void;
}

const preventBlurOnMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault();

export const TipTapFormattingToolbar: React.FC<TipTapFormattingToolbarProps> = ({
  editor,
  onToggleRefPicker,
  onToggleMathModal,
}) => {
  const markBtnClass = (mark: string, base: string) =>
    `${base} ${editor?.isActive(mark) ? 'bg-zinc-200 text-blue-600 font-bold' : 'text-zinc-600'}`;

  return (
    <div className="flex items-center justify-between px-2.5 py-1 bg-zinc-50 border-b border-zinc-200/80 rounded-t-2xl select-none text-xs">
      <div className="flex items-center gap-1">
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={preventBlurOnMouseDown}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={markBtnClass('bold', 'p-1 rounded hover:bg-zinc-200 transition-colors')}
          title="Đậm (Ctrl+B)"
          aria-label="In đậm"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={preventBlurOnMouseDown}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={markBtnClass('italic', 'p-1 rounded hover:bg-zinc-200 transition-colors')}
          title="Nghiêng (Ctrl+I)"
          aria-label="In nghiêng"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={preventBlurOnMouseDown}
          onClick={() => editor?.chain().focus().toggleSuperscript().run()}
          className={markBtnClass(
            'superscript',
            'px-1.5 py-0.5 rounded font-mono text-[11px] hover:bg-zinc-200 transition-colors'
          )}
          title="Chỉ số trên (x²)"
          aria-label="Chỉ số trên"
        >
          x²
        </button>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={preventBlurOnMouseDown}
          onClick={() => editor?.chain().focus().toggleSubscript().run()}
          className={markBtnClass(
            'subscript',
            'px-1.5 py-0.5 rounded font-mono text-[11px] hover:bg-zinc-200 transition-colors'
          )}
          title="Chỉ số dưới (x₂)"
          aria-label="Chỉ số dưới"
        >
          x₂
        </button>
        <span className="w-px h-3.5 bg-zinc-300 mx-1" />
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={preventBlurOnMouseDown}
          onClick={onToggleRefPicker}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-blue-50 text-blue-600 font-medium text-[11px] transition-colors"
          title="Chèn trích dẫn (gõ [ hoặc nhấp vào đây)"
          aria-label="Chèn trích dẫn"
        >
          <Bookmark className="w-3 h-3" />
          <span>Trích dẫn</span>
        </button>
        <button
          type="button"
          tabIndex={-1}
          onMouseDown={preventBlurOnMouseDown}
          onClick={onToggleMathModal}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-zinc-200 text-zinc-700 text-[11px] font-mono transition-colors"
          title="Chèn công thức toán học ($latex$)"
          aria-label="Chèn công thức"
        >
          <Sigma className="w-3.5 h-3.5" />
          <span>Toán</span>
        </button>
      </div>
    </div>
  );
};
