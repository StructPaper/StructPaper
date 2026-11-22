'use client';

import React from 'react';
import { FileText, ListTree } from 'lucide-react';
import { useEditorSession, type EditorViewMode } from '@/context/EditorSessionContext';

const OPTIONS: Array<{ value: EditorViewMode; label: string; title: string; icon: React.ReactNode }> = [
  { value: 'form', label: 'Biểu mẫu', title: 'Chỉnh bài theo từng thẻ và ô nhập', icon: <ListTree className="w-3.5 h-3.5" /> },
  { value: 'overview', label: 'Tổng thể', title: 'Xem cả bài như trang in và chỉnh sửa trực tiếp trên đó', icon: <FileText className="w-3.5 h-3.5" /> },
];

/** Title-bar switch between the form tabs and the overview page (the same paper, two ways to edit it). */
export const EditorViewSwitch: React.FC = () => {
  const { editorView, setEditorView } = useEditorSession();
  return (
    <div data-no-drag="true" data-testid="titlebar-editor-view" role="radiogroup" aria-label="Cách chỉnh sửa bài" style={{ boxShadow: 'inset 0 0 10px rgba(0, 0, 0, 0.07)' }}
      className="inline-flex items-center rounded-full bg-white/40 border border-white p-0.5 select-none">
      {OPTIONS.map((o) => {
        const on = editorView === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.title}
            data-testid={`editor-view-${o.value}`}
            onClick={() => setEditorView(o.value)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              on ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900 hover:bg-white/60'
            }`}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
};
