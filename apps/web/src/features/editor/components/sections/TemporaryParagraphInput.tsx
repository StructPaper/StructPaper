'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Inline } from '@structpaper/doc-model';
import { parseCitationNumbers } from '@structpaper/doc-model';

/**
 * Converts Inline nodes into text for display and editing.
 * Preserves italic formatted text using markdown *text*, math as $math$, and citations as [n].
 */
export function inlinesToDisplayText(inlines?: Inline[]): string {
  if (!inlines || inlines.length === 0) return '';

  let result = '';
  for (const inline of inlines) {
    switch (inline.t) {
      case 'text': {
        let v = inline.v;
        if (inline.marks?.includes('i')) {
          v = `*${v}*`;
        }
        if (inline.marks?.includes('b')) {
          v = `**${v}**`;
        }
        result += v;
        break;
      }
      case 'cite': {
        const nums = inline.refIds.map((id) => {
          const match = id.match(/\d+/);
          return match ? match[0] : id;
        });
        result += `[${nums.join(', ')}]`;
        break;
      }
      case 'math': {
        result += `$${inline.latex}$`;
        break;
      }
      case 'xref': {
        let label = 'Mục';
        if (inline.kind === 'figure') label = 'Hình';
        else if (inline.kind === 'table') label = 'Bảng';
        else if (inline.kind === 'equation') label = 'Công thức';
        result += `${label} (${inline.target})`;
        break;
      }
      case 'link': {
        result += inlinesToDisplayText(inline.content);
        break;
      }
      default:
        break;
    }
  }
  return result;
}

/**
 * Converts text containing [n] citations, $latex$ math, and *italic* markdown
 * into an array of doc-model Inline nodes.
 */
export function displayTextToInlines(text: string): Inline[] {
  if (!text) return [{ t: 'text', v: '' }];

  // Matches citations like [1] or [1, 2], math like $...$, and italic like *...*
  const tokenRegex = /(\[(\d+(?:\s*[,-–—]\s*\d+)*)\])|(\$([^$]+)\$)|(\*([^*]+)\*)/g;
  const inlines: Inline[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = tokenRegex.lastIndex;

    if (matchStart > lastIndex) {
      const plain = text.slice(lastIndex, matchStart);
      if (plain) {
        inlines.push({ t: 'text', v: plain });
      }
    }

    if (match[1]) {
      // Citation: [1, 2]
      const bracketNums = parseCitationNumbers(match[2]);
      const refIds = bracketNums.map((n) => `ref-${n}`);
      inlines.push({
        t: 'cite',
        refIds: refIds.length > 0 ? refIds : [`ref-${match[2]}`],
      });
    } else if (match[3]) {
      // Math: $...$
      inlines.push({
        t: 'math',
        latex: match[4],
      });
    } else if (match[5]) {
      // Italic: *...*
      inlines.push({
        t: 'text',
        v: match[6],
        marks: ['i'],
      });
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    const trailing = text.slice(lastIndex);
    if (trailing) {
      inlines.push({ t: 'text', v: trailing });
    }
  }

  return inlines.length > 0 ? inlines : [{ t: 'text', v: '' }];
}

/**
 * Renders preview elements for inline nodes when in non-editing mode.
 */
export function renderInlineNodes(
  inlines: Inline[],
  onStartEdit?: () => void
): React.ReactNode {
  return inlines.map((node, i) => {
    switch (node.t) {
      case 'text': {
        const isItalic = node.marks?.includes('i');
        const isBold = node.marks?.includes('b');
        if (isItalic && isBold) {
          return (
            <strong key={`inline_t_${i}`} className="font-bold italic">
              {node.v}
            </strong>
          );
        }
        if (isItalic) {
          return (
            <em key={`inline_t_${i}`} className="italic">
              {node.v}
            </em>
          );
        }
        if (isBold) {
          return (
            <strong key={`inline_t_${i}`} className="font-bold">
              {node.v}
            </strong>
          );
        }
        return <span key={`inline_t_${i}`}>{node.v}</span>;
      }
      case 'cite': {
        const numbers = node.refIds.map((id) => {
          const match = id.match(/\d+/);
          return match ? match[0] : id;
        });
        const citeLabel = `[${numbers.join(', ')}]`;
        return (
          <span
            key={`inline_cite_${i}`}
            className="text-blue-600 font-semibold cursor-pointer hover:underline inline-flex items-center mx-0.5 select-none"
            onClick={(e) => {
              e.stopPropagation();
              onStartEdit?.();
            }}
            title="Nhấp để sửa trích dẫn"
          >
            {citeLabel}
          </span>
        );
      }
      case 'math': {
        return (
          <span
            key={`inline_math_${i}`}
            className="font-mono bg-zinc-100 px-1 py-0.5 rounded text-zinc-800 text-xs mx-0.5 border border-zinc-200/60"
            title="Công thức toán học"
          >
            ${node.latex}$
          </span>
        );
      }
      case 'xref': {
        return (
          <span
            key={`inline_xref_${i}`}
            className="text-purple-600 font-medium bg-purple-50 px-1 rounded text-xs mx-0.5"
          >
            {node.kind} ({node.target})
          </span>
        );
      }
      case 'link': {
        return (
          <a
            key={`inline_link_${i}`}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 underline"
          >
            {renderInlineNodes(node.content, onStartEdit)}
          </a>
        );
      }
      default:
        return null;
    }
  });
}

export interface TemporaryParagraphInputProps {
  /** Inline array or string content */
  value?: Inline[] | string;
  /** Emits both V2 Inline[] and plain text string */
  onChange?: (inlines: Inline[], plainText: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  readOnly?: boolean;
  /** Whether the component is in edit mode. If not provided, internally managed on click. */
  isEditing?: boolean;
  onStartEdit?: () => void;
  ariaLabel?: string;
}

/**
 * TemporaryParagraphInput
 * 
 * Provides an auto-resizing paragraph input reading and writing doc-model Inline[] directly.
 * Preserves 100% of the visual styling and citation interactions of the original editor.
 */
export const TemporaryParagraphInput: React.FC<TemporaryParagraphInputProps> = ({
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
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [internalIsEditing, setInternalIsEditing] = useState(false);

  // Compute text string representation from value prop
  const currentText = typeof value === 'string' ? value : inlinesToDisplayText(value);
  const currentInlines = typeof value === 'string' ? displayTextToInlines(value) : value;

  const isEditing = controlledIsEditing !== undefined ? controlledIsEditing : internalIsEditing;

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (isEditing) {
      resize();
    }
  }, [currentText, isEditing, resize]);

  useEffect(() => {
    const handleWindowResize = () => {
      if (isEditing) resize();
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [isEditing, resize]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      const length = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(length, length);
    }
  }, [isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const newInlines = displayTextToInlines(newText);
    onChange?.(newInlines, newText);
    resize();
  };

  const handleBlur = () => {
    setInternalIsEditing(false);
    onBlur?.();
  };

  const handleClickPreview = () => {
    if (readOnly) return;
    if (onStartEdit) {
      onStartEdit();
    } else {
      setInternalIsEditing(true);
    }
  };

  if (isEditing && !readOnly) {
    return (
      <textarea
        ref={textareaRef}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        value={currentText}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder={placeholder}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        style={{ resize: 'none', overflow: 'hidden' }}
        className={`[field-sizing:content] w-full p-3 rounded-2xl text-xs sm:text-sm text-zinc-900 bg-white leading-relaxed focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs border border-zinc-200/80 transition-all ${className}`}
      />
    );
  }

  const isEmpty = !currentText || currentText.trim().length === 0;

  return (
    <div
      onClick={handleClickPreview}
      role="textbox"
      tabIndex={0}
      aria-label={ariaLabel}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClickPreview();
        }
      }}
      className={`w-full p-3 rounded-2xl text-xs sm:text-sm text-zinc-900 bg-white leading-relaxed border border-transparent hover:border-zinc-200/80 shadow-2xs cursor-text select-text transition-all min-h-[3rem] whitespace-pre-wrap break-words ${className}`}
    >
      {isEmpty ? (
        <span className="text-zinc-400 italic">{placeholder}</span>
      ) : (
        renderInlineNodes(currentInlines, handleClickPreview)
      )}
    </div>
  );
};
