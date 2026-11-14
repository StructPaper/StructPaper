'use client';

import React, { useEffect, useRef } from 'react';
import {
  SemanticElement,
  FloatingElementsDesignRules,
} from '@/types/template-builder';
import { buildContainerStyle } from './renderers/types';

export interface InlineWordEditorProps {
  element: SemanticElement;
  initialText: string;
  primaryColor: string;
  floatingRules?: FloatingElementsDesignRules;
  onSave: (newText: string) => void;
  onCancel: () => void;
}

/**
 * InlineWordEditor: Natural Word-like in-place contentEditable editor.
 * - Preserves the exact original layout, typography, line-height, text indent, justification, and colors.
 * - No min-height or intrusive card overlay.
 * - In multi-column zones (column-count: 2), text naturally balances and flows across columns.
 * - Automatically saves on blur, Enter (on single-line elements), and cancels on Escape.
 */
export const InlineWordEditor: React.FC<InlineWordEditorProps> = ({
  element,
  initialText,
  primaryColor,
  onSave,
  onCancel,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef(false);

  const isReadyRef = useRef(false);

  // Focus and place cursor at the end of text on mount after double-click settle
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    el.innerText = initialText;

    // Small delay to allow the browser double-click mouseup events to finish
    const timer = setTimeout(() => {
      if (!editorRef.current) return;
      editorRef.current.focus();

      try {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      } catch {
        // Fallback if browser selection fails
      }
      isReadyRef.current = true;
    }, 40);

    return () => clearTimeout(timer);
  }, [initialText]);

  const handleBlur = () => {
    if (isCancelledRef.current) return;
    if (!isReadyRef.current) return;

    const text = editorRef.current?.innerText ?? '';
    // If text was not changed, cancel quietly without saving or toasting
    if (text.trim() === initialText.trim()) {
      onCancel();
      return;
    }
    onSave(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      isCancelledRef.current = true;
      onCancel();
      return;
    }

    const isSingleLine =
      element.type === 'heading' ||
      element.type === 'article-title' ||
      element.type === 'author-block' ||
      element.type === 'citation-strip' ||
      element.type === 'metadata-grid';

    if (e.key === 'Enter') {
      if (isSingleLine) {
        e.preventDefault();
        e.stopPropagation();
        const text = editorRef.current?.innerText ?? '';
        if (text.trim() === initialText.trim()) {
          onCancel();
          return;
        }
        onSave(text);
      }
      // For multi-line elements (body-text, abstract-box, callout-box):
      // allow normal Enter to create paragraph breaks naturally like in Word!
    }
  };

  const containerStyle = buildContainerStyle(element.styling, element.specialProps);
  const sp = element.specialProps || {};

  // 1. Heading Elements (Prefix I., 1., etc. kept separate so user edits the title cleanly)
  if (element.type === 'heading') {
    const lvl = sp.headingLevel || 1;
    const numScheme = sp.headingNumbering || 'ROMAN';
    const getPrefix = () => {
      if (numScheme === 'NONE') return '';
      if (numScheme === 'ROMAN') return lvl === 1 ? 'I. ' : lvl === 2 ? 'II.A ' : 'III.A.1 ';
      if (numScheme === 'ARABIC') return lvl === 1 ? '1. ' : lvl === 2 ? '1.1 ' : '1.1.1 ';
      return '1. ';
    };

    return (
      <div style={containerStyle} className="select-text">
        <div
          className={`flex items-baseline gap-1 ${
            lvl === 1
              ? 'text-[11pt] font-extrabold uppercase tracking-tight'
              : lvl === 2
                ? 'text-[10pt] font-bold tracking-tight'
                : 'text-[9.5pt] font-semibold italic'
          }`}
        >
          {getPrefix() && (
            <span className="select-none shrink-0 opacity-70 font-mono">{getPrefix()}</span>
          )}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="outline-none focus:outline-none flex-1 min-w-0 cursor-text"
            style={{ outline: 'none' }}
          />
        </div>
      </div>
    );
  }

  // 2. Paragraph & Body Text (Handles 1-col or 2-col CSS flow naturally)
  if (element.type === 'body-text') {
    const isContinuation = sp.isContinuation;
    const indentMm = isContinuation ? 0 : sp.firstLineIndent ?? 4;

    return (
      <div style={containerStyle} className="leading-relaxed select-text">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="text-justify outline-none focus:outline-none cursor-text whitespace-pre-wrap"
          style={{
            textIndent: `${indentMm}mm`,
            outline: 'none',
          }}
        />
      </div>
    );
  }

  // 3. Abstract Box
  if (element.type === 'abstract-box') {
    return (
      <div style={containerStyle} className="select-text">
        {!sp.isContinuation && (
          <div
            className="font-bold mb-1 font-sans select-none"
            style={{ color: primaryColor, fontSize: `${element.styling.fontSize}pt` }}
          >
            {sp.abstractTitle || 'TÓM TẮT'}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="whitespace-pre-wrap leading-relaxed text-justify outline-none focus:outline-none cursor-text"
          style={{ outline: 'none' }}
        />
        {sp.supportBilingual && !sp.isContinuation && (
          <div className="mt-3 pt-2 border-t border-slate-200/60 opacity-60 pointer-events-none select-none">
            <div
              className="font-bold mb-1 font-sans"
              style={{ color: primaryColor, fontSize: `${element.styling.fontSize}pt` }}
            >
              ABSTRACT
            </div>
            <div className="italic font-serif leading-relaxed text-justify text-slate-600">
              {sp.bilingualLabel ||
                'This paper proposes an automated extraction framework for scientific papers from OpenXML DOCX format...'}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 4. Research Callout Box
  if (element.type === 'callout-box') {
    return (
      <div style={containerStyle} className="select-text">
        <div
          className="font-bold mb-1 flex items-center gap-1 text-[9pt] select-none"
          style={{ color: element.styling.borderColor }}
        >
          <span>{sp.calloutTitle || '⚡ Điểm nhấn nghiên cứu'}</span>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="whitespace-pre-wrap text-[8.5pt] leading-snug outline-none focus:outline-none cursor-text"
          style={{ outline: 'none' }}
        />
      </div>
    );
  }

  // 5. Default Fallback for all other text elements (article-title, author-block, metadata, etc.)
  return (
    <div style={containerStyle} className="select-text">
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="outline-none focus:outline-none w-full cursor-text whitespace-pre-wrap"
        style={{
          textAlign: element.styling?.textAlign || 'left',
          outline: 'none',
        }}
      />
    </div>
  );
};
