'use client';

import React from 'react';
import { Undo2, Redo2 } from 'lucide-react';
import { useEditorSession } from '@/context/EditorSessionContext';

const BTN =
  'inline-flex items-center justify-center w-7 h-7 rounded-full text-zinc-600 bg-zinc-100 hover:bg-zinc-200/80 active:scale-90 transition-all duration-150 cursor-pointer select-none disabled:opacity-35 disabled:pointer-events-none';

/**
 * Title-bar undo and redo of the paper: the same steps as Ctrl+Z and Ctrl+Y. The tooltip says what the step would
 * undo ("Hoàn tác: Sửa tiêu đề").
 */
export const UndoRedoButtons: React.FC = () => {
  const { history } = useEditorSession();
  if (!history) return null;
  const undoText = history.undoLabel ? `Hoàn tác: ${history.undoLabel} (Ctrl+Z)` : 'Hoàn tác (Ctrl+Z)';
  const redoText = history.redoLabel ? `Làm lại: ${history.redoLabel} (Ctrl+Y)` : 'Làm lại (Ctrl+Y)';

  return (
    <div className="flex items-center gap-1" data-no-drag="true" data-testid="titlebar-history">
      <button type="button" onClick={history.undo} disabled={!history.canUndo} title={undoText} aria-label="Hoàn tác" data-testid="titlebar-undo" className={BTN}>
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={history.redo} disabled={!history.canRedo} title={redoText} aria-label="Làm lại" data-testid="titlebar-redo" className={BTN}>
        <Redo2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
