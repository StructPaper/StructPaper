'use client';

import React, { useState, useMemo, useCallback } from 'react';
import type { Inline } from '@structpaper/doc-model';
import type { PaperReference } from '@/types/paper';
import {
  displayTextToInlines,
  renderInlineNodes,
  inlinesToDisplayText,
} from './TemporaryParagraphInput';
import { TipTapActiveEditor } from './TipTapActiveEditor';

export { TipTapActiveEditor, type TipTapActiveEditorProps } from './TipTapActiveEditor';
export {
  CiteNode,
  XrefNode,
  MathNode,
  inlinesToTiptapDoc,
  tiptapDocToInlines,
  tiptapDocToPlainText,
} from './tiptap-schema';
export { cleanWordPasteHtml } from './clean-word-paste';

export interface TipTapParagraphEditorProps {
  value?: Inline[] | string;
  onChange?: (inlines: Inline[], plainText: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  readOnly?: boolean;
  isEditing?: boolean;
  onStartEdit?: () => void;
  ariaLabel?: string;
  references?: PaperReference[];
}

const TipTapParagraphEditorBase: React.FC<TipTapParagraphEditorProps> = ({
  value = '',
  onChange,
  placeholder = 'Nội dung đoạn văn bản...',
  className = '',
  autoFocus,
  onBlur,
  onKeyDown,
  readOnly = false,
  isEditing: controlledIsEditing,
  onStartEdit,
  ariaLabel = 'Nội dung đoạn văn',
  references = [],
}) => {
  const [internalIsEditing, setInternalIsEditing] = useState(false);
  const isEditing = controlledIsEditing !== undefined ? controlledIsEditing : internalIsEditing;

  const currentInlines = useMemo(() => {
    if (Array.isArray(value)) return value;
    return displayTextToInlines(value || '');
  }, [value]);

  const currentText = useMemo(() => {
    if (typeof value === 'string') return value;
    return inlinesToDisplayText(value);
  }, [value]);

  const handleStartEditing = useCallback(() => {
    if (readOnly) return;
    if (onStartEdit) {
      onStartEdit();
    } else {
      setInternalIsEditing(true);
    }
  }, [readOnly, onStartEdit]);

  const handleFinishEditing = useCallback(() => {
    setInternalIsEditing(false);
    onBlur?.();
  }, [onBlur]);

  if (isEditing && !readOnly) {
    return (
      <TipTapActiveEditor
        currentInlines={currentInlines}
        currentText={currentText}
        onChange={onChange}
        className={className}
        autoFocus={autoFocus}
        onBlur={handleFinishEditing}
        onKeyDown={onKeyDown}
        ariaLabel={ariaLabel}
        references={references}
      />
    );
  }

  // Non-editing Preview View (100% preserves original view appearance & click interactions)
  const isEmpty = !currentText || currentText.trim().length === 0;

  return (
    <div
      onClick={handleStartEditing}
      role="textbox"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleStartEditing();
        }
      }}
      className={`tiptap-paragraph-preview w-full p-3 rounded-2xl text-xs sm:text-sm text-zinc-900 bg-white leading-relaxed border border-transparent hover:border-zinc-200/80 shadow-2xs cursor-text select-text transition-all min-h-[3rem] whitespace-pre-wrap break-words ${className}`}
    >
      {isEmpty ? (
        <span className="text-zinc-400 italic">{placeholder}</span>
      ) : (
        renderInlineNodes(currentInlines, handleStartEditing)
      )}
    </div>
  );
};

export const TipTapParagraphEditor = React.memo(TipTapParagraphEditorBase);
TipTapParagraphEditor.displayName = 'TipTapParagraphEditor';
