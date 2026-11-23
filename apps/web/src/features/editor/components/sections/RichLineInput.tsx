'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { contentToText, textToContent } from '../../overview/overview-doc';
import { FootnoteNotes, OvCite, OvFootnote, OvMath, OvXref, TextColor } from '../../overview/overview-extensions';
import { Bold, Italic, Underline, Bookmark, Sigma, Link2, Asterisk } from 'lucide-react';
import { useXrefTargets } from '../../xref-context';
import { markupToHtml } from '@/lib/inline-markup';
import { renderLatexToHtml } from '@/features/preview/components/MathText';
import { labelOfRef } from './markers';
import type { RefTarget } from '@/lib/cross-refs';
import { ReferencePickerPopover, MathInputPopover, XrefDialog, FootnoteDialog } from './tiptap-popovers';

/**
 * One line of text that shows its bold, italic, underline, colour and scripts as they will print (the paper stores them as tags
 * in the text, which an author should never have to read). Enter does nothing: it is one line of the model.
 */
type RichLineInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  /** Styles the line like the block it is the text of ("font-bold" for a heading). */
  textClassName?: string;
  /** Offers what goes into the text (bold, italic, a citation, a formula, a table or figure, a footnote) under the field while it is being written in. */
  tools?: boolean;
  /** Enter starts a new line (a line of the text is a paragraph here, and the lines are kept apart by line breaks in the stored text). */
  multiline?: boolean;
  /** The editor is only built when the field is clicked: a card with many fields stays light. Until then the text is shown as it prints. */
  lazy?: boolean;
};

const RichLineInputActive: React.FC<RichLineInputProps & { focusOnMount?: boolean }> = ({ value, onChange, placeholder, className = '', ariaLabel, textClassName = '', tools = true, multiline = false, focusOnMount = false }) => {
  const docOf = (text: string) => ({ type: 'doc', content: (multiline ? text.split('\n') : [text]).map((line) => ({ type: 'paragraph', content: textToContent(line) })) });
  const { targets, lang, references } = useXrefTargets();
  const [focused, setFocused] = useState(false);
  const [dialog, setDialog] = useState<'cite' | 'math' | 'xref' | 'note' | null>(null);
  const [refSearch, setRefSearch] = useState('');
  const [latex, setLatex] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const mathPos = useRef<number | null>(null);
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        undoRedo: false,
        heading: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        strike: false,
        dropcursor: false,
        gapcursor: false,
        trailingNode: false,
      }),
      Subscript,
      Superscript,
      TextColor,
      OvCite,
      OvXref,
      OvMath,
      OvFootnote,
      FootnoteNotes,
    ],
    []
  );
  const last = useRef(value);
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: docOf(value),
    editorProps: {
      attributes: { class: `outline-none ${textClassName}`, 'aria-label': ariaLabel ?? placeholder ?? 'Văn bản', role: 'textbox', ...(placeholder ? { placeholder } : {}) },
      handleKeyDown: (_v, e) => !multiline && e.key === 'Enter',
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      const text = (json.content ?? []).map((p) => contentToText(p.content)).join('\n');
      last.current = text;
      onChange(text);
    },
  });
  useEffect(() => {
    if (focusOnMount && editor && !editor.isDestroyed) editor.commands.focus('end');
  }, [focusOnMount, editor]);
  // a change from outside (undo, the settings popup): the line is drawn again
  useEffect(() => {
    if (!editor || editor.isDestroyed || value === last.current) return;
    last.current = value;
    editor.commands.setContent(docOf(value), { emitUpdate: false });
  }, [editor, value]);
  // a click on a formula opens it to be changed
  useEffect(() => {
    if (!editor) return;
    (editor.storage as unknown as Record<string, unknown>).onEditMath = (pos: number | undefined, text: string) => {
      mathPos.current = typeof pos === 'number' ? pos : null;
      setLatex(text);
      setDialog('math');
    };
  }, [editor]);
  const closeDialog = () => {
    mathPos.current = null;
    setDialog(null);
    setRefSearch('');
    setLatex('');
    editor?.commands.focus();
  };
  const put = (content: Record<string, unknown>) => {
    setDialog(null);
    setRefSearch('');
    setLatex('');
    editor?.chain().focus().insertContent(content).run();
  };
  const tool = 'h-7 min-w-7 px-1.5 rounded-lg flex items-center justify-center gap-1 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-200/70 cursor-pointer transition-colors';
  const noDown = (e: React.MouseEvent) => e.preventDefault();
  return (
    <div
      ref={box}
      className={`relative ${className}`}
      style={{ counterReset: 'ov-fn 0 ov-fnn 0' }}
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest('[data-field-tools]')) editor?.commands.focus();
      }}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (dialog || (e.relatedTarget instanceof Node && box.current?.contains(e.relatedTarget))) return;
        setFocused(false);
      }}
    >
      {tools && (focused || dialog) && (
        <div data-field-tools className="mb-2 pb-1.5 border-b border-zinc-200/70 flex flex-wrap items-center gap-0.5 font-normal not-italic text-xs">
          <button type="button" tabIndex={-1} title="Đậm (Ctrl+B)" aria-label="Đậm" onMouseDown={noDown} onClick={() => editor?.chain().focus().toggleBold().run()} className={tool}>
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button type="button" tabIndex={-1} title="Nghiêng (Ctrl+I)" aria-label="Nghiêng" onMouseDown={noDown} onClick={() => editor?.chain().focus().toggleItalic().run()} className={tool}>
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button type="button" tabIndex={-1} title="Gạch chân (Ctrl+U)" aria-label="Gạch chân" onMouseDown={noDown} onClick={() => editor?.chain().focus().toggleUnderline().run()} className={tool}>
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button type="button" tabIndex={-1} title="Chỉ số trên" aria-label="Chỉ số trên" onMouseDown={noDown} onClick={() => editor?.chain().focus().toggleSuperscript().run()} className={tool}>
            x²
          </button>
          <button type="button" tabIndex={-1} title="Chỉ số dưới" aria-label="Chỉ số dưới" onMouseDown={noDown} onClick={() => editor?.chain().focus().toggleSubscript().run()} className={tool}>
            x₂
          </button>
          <span className="w-px h-4 bg-zinc-300 mx-1" />
          <button type="button" tabIndex={-1} title="Chèn trích dẫn tài liệu" aria-label="Chèn trích dẫn" onMouseDown={noDown} onClick={() => setDialog('cite')} className={`${tool} text-blue-600`} data-testid="field-cite">
            <Bookmark className="w-3.5 h-3.5" />
            Trích dẫn
          </button>
          <button type="button" tabIndex={-1} title="Chèn công thức" aria-label="Chèn công thức" onMouseDown={noDown} onClick={() => setDialog('math')} className={tool} data-testid="field-math">
            <Sigma className="w-3.5 h-3.5" />
            Toán
          </button>
          <button type="button" tabIndex={-1} title="Chèn tham chiếu đến bảng hoặc hình" aria-label="Chèn tham chiếu bảng hình" onMouseDown={noDown} onClick={() => setDialog('xref')} className={`${tool} text-purple-700`} data-testid="field-xref">
            <Link2 className="w-3.5 h-3.5" />
            Bảng/Hình
          </button>
          <button type="button" tabIndex={-1} title="Chèn chú thích chân trang" aria-label="Chèn chú thích chân trang" onMouseDown={noDown} onClick={() => setDialog('note')} className={tool} data-testid="field-note">
            <Asterisk className="w-3.5 h-3.5" />
            Chú thích
          </button>
        </div>
      )}
      {/* the placeholder sits inside the text area, so it keeps the same padding as the text */}
      <div className="relative">
      {!value && placeholder && <span className="absolute left-0 top-0 pointer-events-none text-zinc-400 font-normal select-none truncate max-w-full">{placeholder}</span>}
        <EditorContent editor={editor} />
      </div>
      <ReferencePickerPopover isOpen={dialog === 'cite'} search={refSearch} onSearchChange={setRefSearch} references={references} onSelectReference={(id) => put({ type: 'cite', attrs: { id: `ref-${id}`, targetId: String(id), label: `[${id}]` } })} onClose={closeDialog} />
      <MathInputPopover isOpen={dialog === 'math'} latex={latex} onLatexChange={setLatex} onSubmit={() => {
        if (!latex.trim()) return;
        const at = mathPos.current;
        mathPos.current = null;
        if (at !== null) {
          setDialog(null);
          editor?.chain().focus().command(({ tr }) => {
            tr.setNodeMarkup(at, undefined, { latex: latex.trim() });
            return true;
          }).run();
        } else put({ type: 'math', attrs: { latex: latex.trim() } });
      }} onClose={closeDialog} />
      <XrefDialog open={dialog === 'xref'} targets={targets} lang={lang} onSelect={(t) => put({ type: 'xref', attrs: { targetId: t.id, kind: t.kind, label: '' } })} onClose={closeDialog} />
      <FootnoteDialog open={dialog === 'note'} onSubmit={(text) => put({ type: 'footnote', attrs: { raw: ' ' + text.replace(/\s*\n\s*/g, ' ').replace(/\]\]/g, ']') } })} onClose={closeDialog} />
    </div>
  );
};

/** The text of a field as it prints, without an editor: formatting as formatting, a formula as a formula, a reference as its label. */
function staticHtml(value: string, targets: RefTarget[], lang: 'vi' | 'en'): string {
  const marks: string[] = [];
  const hold = (html: string) => {
    marks.push(html);
    return `\u0000${marks.length - 1}\u0000`;
  };
  let t = value
    .replace(/\[\[fn:([\s\S]*?)\]\]/g, () => hold('<sup style="color:#2b74b7;font-weight:700">[•]</sup>'))
    .replace(/\[\[(tbl|fig|app):([^\]\s]+)\]\]/g, (_m, k: 'tbl' | 'fig' | 'app', id: string) => hold(`<span class="marker-chip marker-xref-chip">${labelOfRef(k, id, targets, lang)}</span>`))
    .replace(/\$([^$]+)\$/g, (_m, latex: string) => {
      const r = renderLatexToHtml(latex, false);
      return hold(r.error ? `<code>${latex.replace(/</g, '&lt;')}</code>` : r.html);
    });
  t = markupToHtml(t);
  return t.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => marks[Number(i)] ?? '');
}

export const RichLineInput: React.FC<RichLineInputProps> = (props) => {
  const { targets, lang } = useXrefTargets();
  const [built, setBuilt] = useState(!props.lazy);
  const [clicked, setClicked] = useState(false);
  if (built) return <RichLineInputActive {...props} focusOnMount={clicked} />;
  const { value, placeholder, className = '', ariaLabel, textClassName = '' } = props;
  return (
    <div
      className={`relative ${className}`}
      role="textbox"
      tabIndex={0}
      aria-label={ariaLabel ?? placeholder ?? 'Văn bản'}
      {...(placeholder ? ({ placeholder } as Record<string, string>) : {})}
      onMouseDown={() => {
        setClicked(true);
        setBuilt(true);
      }}
      onFocus={() => setBuilt(true)}
    >
      {value ? <div className={`whitespace-pre-wrap ${textClassName}`} dangerouslySetInnerHTML={{ __html: staticHtml(value, targets, lang) }} /> : <span className="text-zinc-400 font-normal select-none">{placeholder}</span>}
    </div>
  );
};
