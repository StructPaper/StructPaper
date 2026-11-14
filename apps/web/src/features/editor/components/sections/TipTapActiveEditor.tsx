'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import type { EditorOptions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import type { Inline } from '@structpaper/doc-model';
import type { PaperReference } from '@/types/paper';
import {
  CiteNode,
  XrefNode,
  MathNode,
  inlinesToTiptapDoc,
  tiptapDocToInlines,
  tiptapDocToPlainText,
} from './tiptap-schema';
import { cleanWordPasteHtml } from './clean-word-paste';
import { displayTextToInlines } from './TemporaryParagraphInput';
import { ReferencePickerPopover, MathInputPopover } from './tiptap-popovers';
import { TipTapFormattingToolbar } from './TipTapFormattingToolbar';

interface PendingEditorPayload {
  inlines: Inline[];
  plainText: string;
}

export interface TipTapActiveEditorProps {
  currentInlines: Inline[];
  currentText: string;
  onChange?: (inlines: Inline[], plainText: string) => void;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  ariaLabel?: string;
  references?: PaperReference[];
}

export const TipTapActiveEditor: React.FC<TipTapActiveEditorProps> = ({
  currentInlines,
  currentText,
  onChange,
  className = '',
  autoFocus,
  onBlur,
  onKeyDown,
  ariaLabel = 'Nội dung đoạn văn',
  references = [],
}) => {
  const [isRefPickerOpen, setIsRefPickerOpen] = useState(false);
  const [refSearch, setRefSearch] = useState('');
  const [isMathModalOpen, setIsMathModalOpen] = useState(false);
  const [mathLatex, setMathLatex] = useState('');

  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPayloadRef = useRef<PendingEditorPayload | null>(null);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const editorRef = useRef<Editor | null>(null);
  const showRefPickerRef = useRef(isRefPickerOpen);
  const showMathInputRef = useRef(isMathModalOpen);
  const hasNotifiedBlurRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  useEffect(() => {
    showRefPickerRef.current = isRefPickerOpen;
  }, [isRefPickerOpen]);

  useEffect(() => {
    showMathInputRef.current = isMathModalOpen;
  }, [isMathModalOpen]);

  const clearDebounceTimer = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const flushPendingUpdate = useCallback(() => {
    clearDebounceTimer();
    const payload = pendingPayloadRef.current;
    if (!payload) return;
    pendingPayloadRef.current = null;
    onChangeRef.current?.(payload.inlines, payload.plainText);
  }, [clearDebounceTimer]);

  const restoreEditorFocus = useCallback(() => {
    const curEditor = editorRef.current;
    if (curEditor && !curEditor.isDestroyed) {
      curEditor.commands.focus();
    }
  }, []);

  const openRefPicker = useCallback(() => {
    showMathInputRef.current = false;
    setIsMathModalOpen(false);
    setMathLatex('');
    showRefPickerRef.current = true;
    setRefSearch('');
    setIsRefPickerOpen(true);
  }, []);

  const closeRefPicker = useCallback(() => {
    showRefPickerRef.current = false;
    setIsRefPickerOpen(false);
    setRefSearch('');
    restoreEditorFocus();
  }, [restoreEditorFocus]);

  const openMathModal = useCallback(() => {
    showRefPickerRef.current = false;
    setIsRefPickerOpen(false);
    setRefSearch('');
    showMathInputRef.current = true;
    setMathLatex('');
    setIsMathModalOpen(true);
  }, []);

  const closeMathModal = useCallback(() => {
    showMathInputRef.current = false;
    setIsMathModalOpen(false);
    setMathLatex('');
    restoreEditorFocus();
  }, [restoreEditorFocus]);

  const isFocusMovingWithinContainer = useCallback(
    (blurredTarget: EventTarget | null, relatedTarget: EventTarget | null | undefined): boolean => {
      const container = containerRef.current;
      if (!container) return false;
      if (relatedTarget instanceof Node) {
        return container.contains(relatedTarget);
      }
      const activeEl = document.activeElement;
      if (
        activeEl instanceof Node &&
        !(blurredTarget instanceof Node && blurredTarget.contains(activeEl))
      ) {
        return container.contains(activeEl);
      }
      return false;
    },
    []
  );

  const commitExternalBlur = useCallback(
    (blurredTarget: EventTarget | null, relatedTarget: EventTarget | null | undefined) => {
      if (isFocusMovingWithinContainer(blurredTarget, relatedTarget)) {
        return;
      }
      if (hasNotifiedBlurRef.current) return;
      hasNotifiedBlurRef.current = true;
      flushPendingUpdate();
      onBlurRef.current?.();
    },
    [isFocusMovingWithinContainer, flushPendingUpdate]
  );

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
        strike: false,
      }),
      Subscript,
      Superscript,
      CiteNode,
      XrefNode,
      MathNode,
    ],
    []
  );

  const editorProps = useMemo<EditorOptions['editorProps']>(
    () => ({
      attributes: {
        class:
          'w-full p-3 text-xs sm:text-sm text-zinc-900 bg-white leading-relaxed outline-none min-h-[3rem] rounded-b-2xl',
        role: 'textbox',
        'aria-label': ariaLabel,
        spellcheck: 'false',
        autocorrect: 'off',
        autocapitalize: 'off',
      },
      transformPastedHTML(html) {
        return cleanWordPasteHtml(html);
      },
      handleKeyDown(_view, event) {
        if (event.key === '[') {
          openRefPicker();
        }
        return false;
      },
    }),
    [ariaLabel, openRefPicker]
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: inlinesToTiptapDoc(currentInlines),
    editorProps,
    onFocus() {
      hasNotifiedBlurRef.current = false;
    },
    onUpdate({ editor: curEditor }) {
      editorRef.current = curEditor;
      const json = curEditor.getJSON();
      pendingPayloadRef.current = {
        inlines: tiptapDocToInlines(json),
        plainText: tiptapDocToPlainText(json),
      };
      clearDebounceTimer();
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        flushPendingUpdate();
      }, 150);
    },
    onBlur({ event }) {
      if (showRefPickerRef.current || showMathInputRef.current) return;
      commitExternalBlur(event?.target ?? null, event?.relatedTarget);
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const activeEl = document.activeElement;
    if (activeEl instanceof Node && containerRef.current?.contains(activeEl)) return;
    const currentEditorInlines = tiptapDocToInlines(editor.getJSON());
    if (JSON.stringify(currentEditorInlines) !== JSON.stringify(currentInlines)) {
      clearDebounceTimer();
      pendingPayloadRef.current = null;
      editor.commands.setContent(inlinesToTiptapDoc(currentInlines), { emitUpdate: false });
    }
  }, [editor, currentInlines, clearDebounceTimer]);

  useEffect(() => {
    if (editor && !editor.isFocused) {
      editor.commands.focus('end');
    }
  }, [editor]);

  // Flush any pending debounced edit on unmount (immune to @tiptap/react destroy order).
  useEffect(() => {
    return () => {
      flushPendingUpdate();
    };
  }, [flushPendingUpdate]);

  const handleInsertCitation = (refId: number | string) => {
    if (!editor) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'cite',
        attrs: {
          id: `ref-${refId}`,
          targetId: String(refId),
          label: `[${refId}]`,
        },
      })
      .run();
    showRefPickerRef.current = false;
    setIsRefPickerOpen(false);
    setRefSearch('');
  };

  const handleInsertMath = () => {
    if (!editor || !mathLatex.trim()) return;
    editor
      .chain()
      .focus()
      .insertContent({
        type: 'math',
        attrs: { latex: mathLatex.trim() },
      })
      .run();
    showMathInputRef.current = false;
    setMathLatex('');
    setIsMathModalOpen(false);
  };

  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      if (isRefPickerOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeRefPicker();
        return;
      }
      if (isMathModalOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeMathModal();
        return;
      }
    }
    onKeyDown?.(e);
  };

  return (
    <div
      ref={containerRef}
      className={`tiptap-paragraph-editor relative w-full rounded-2xl bg-white border border-blue-300 ring-4 ring-blue-200 shadow-2xs transition-all ${className}`}
      onFocus={() => {
        hasNotifiedBlurRef.current = false;
      }}
      onBlur={(e) => {
        commitExternalBlur(e.target, e.relatedTarget);
      }}
      onKeyDown={handleContainerKeyDown}
    >
      {/* Compact Mini Toolbar */}
      <TipTapFormattingToolbar
        editor={editor}
        onToggleRefPicker={() => (isRefPickerOpen ? closeRefPicker() : openRefPicker())}
        onToggleMathModal={() => (isMathModalOpen ? closeMathModal() : openMathModal())}
      />

      {/* Reference Suggestions Dropdown */}
      <ReferencePickerPopover
        isOpen={isRefPickerOpen}
        search={refSearch}
        onSearchChange={setRefSearch}
        references={references}
        onSelectReference={handleInsertCitation}
        onClose={closeRefPicker}
      />

      {/* Inline Math Input Popover */}
      <MathInputPopover
        isOpen={isMathModalOpen}
        latex={mathLatex}
        onLatexChange={setMathLatex}
        onSubmit={handleInsertMath}
        onClose={closeMathModal}
      />

      {/* TipTap ProseMirror Editor */}
      <EditorContent editor={editor} autoFocus={autoFocus} />

      {/* Synced form input for accessibility and fallback change handlers */}
      <textarea
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        value={currentText}
        onChange={(e) => {
          clearDebounceTimer();
          pendingPayloadRef.current = null;
          const newText = e.target.value;
          const inlines = displayTextToInlines(newText);
          editor?.commands.setContent(inlinesToTiptapDoc(inlines), { emitUpdate: false });
          onChangeRef.current?.(inlines, newText);
        }}
      />
    </div>
  );
};
