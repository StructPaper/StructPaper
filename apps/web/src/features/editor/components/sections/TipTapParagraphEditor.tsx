'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Inline } from '@structpaper/doc-model';
import type { PaperReference } from '@/types/paper';
import {
  displayTextToInlines,
  renderInlineNodes,
  inlinesToDisplayText,
} from './TemporaryParagraphInput';
import { TipTapActiveEditor, type ParagraphController } from './TipTapActiveEditor';
import { TipTapFormattingToolbar } from './TipTapFormattingToolbar';
import type { ClickPoint } from './caret-at-point';
import { MarkerNotes } from './markers';

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
  /** How many footnotes stand before this paragraph in the paper (their letters go on from there). */
  noteOffset?: number;
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
  noteOffset = 0,
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
    setStartPoint(null);
    setInternalIsEditing(false);
    onBlur?.();
  }, [onBlur]);

  const editing = isEditing && !readOnly;
  const [controller, setController] = useState<ParagraphController | null>(null);
  const ready = controller !== null;
  const [startPoint, setStartPoint] = useState<ClickPoint | null>(null);
  const isEmpty = !currentText || currentText.trim().length === 0;

  return (
    <div
      className={`tiptap-paragraph-shell relative w-full rounded-2xl bg-white shadow-2xs border transition-all ${
        editing ? 'border-blue-300 ring-4 ring-blue-200' : 'border-transparent hover:border-zinc-200/80'
      } ${className}`}
    >
      {/* the toolbar belongs to the shell, which stays while the text switches between reading and editing: it unfolds and folds like the toolbar of the one-line fields, whatever else happens at the same moment */}
      <AnimatePresence initial={false}>
        {editing && (
          <motion.div
            key="paragraph-tools"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <TipTapFormattingToolbar
              editor={controller?.editor ?? null}
              onToggleRefPicker={() => controller?.toggleRefPicker()}
              onToggleMathModal={() => controller?.toggleMath()}
              onToggleXref={() => controller?.openXref()}
              onToggleNote={() => controller?.openNote()}
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* The editor takes a moment to build (its text is empty until then): it is built out of sight, over the text that is being read, and
          the two swap only when it is ready, so nothing blinks. */}
      {editing && (
        <div style={ready ? undefined : { position: 'absolute', left: 0, right: 0, top: 0, paddingTop: '0.5rem', opacity: 0, pointerEvents: 'none' }}>
          <TipTapActiveEditor
            bare
            startPoint={startPoint}
            onController={setController}
            currentInlines={currentInlines}
            currentText={currentText}
            onChange={onChange}
            autoFocus={autoFocus}
            onBlur={handleFinishEditing}
            onKeyDown={onKeyDown}
            ariaLabel={ariaLabel}
            references={references}
            noteOffset={noteOffset}
          />
        </div>
      )}
      {!(editing && ready) && (
        <div
          style={{ counterReset: `ov-fn ${noteOffset} ov-fnn ${noteOffset}` }}
          onClick={handleStartEditing}
          onMouseDown={(e) => {
            // begins when the button goes down (as the one-line fields do), one frame later so that the paragraph being edited has let go first
            if (e.button !== 0 || readOnly) return;
            // (the hidden editor is laid out exactly under the text: the same box, the same padding, so the point is good for it too)
            setStartPoint({ x: e.clientX, y: e.clientY });
            requestAnimationFrame(handleStartEditing);
          }}
          role="textbox"
          tabIndex={0}
          aria-label={ariaLabel}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setStartPoint(null);
              handleStartEditing();
            }
          }}
          className="tiptap-paragraph-preview w-full p-3 text-xs sm:text-sm text-zinc-900 leading-relaxed cursor-text select-text min-h-[3rem] whitespace-pre-wrap break-words"
        >
          {isEmpty ? <span className="text-zinc-400 italic">{placeholder}</span> : renderInlineNodes(currentInlines, handleStartEditing)}
          <MarkerNotes text={currentText} />
        </div>
      )}
    </div>
  );
};

export const TipTapParagraphEditor = React.memo(TipTapParagraphEditorBase);
TipTapParagraphEditor.displayName = 'TipTapParagraphEditor';
