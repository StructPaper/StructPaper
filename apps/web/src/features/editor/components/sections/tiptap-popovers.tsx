'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import type { PaperReference } from '@/types/paper';
import { MathFormula, renderLatexToHtml } from '@/features/preview/components/MathText';
import { latexFromClipboard } from '@/lib/math-paste';
import { refLabel, type RefTarget } from '@/lib/cross-refs';
import { POPUP_EDGE, POPUP_TOP } from '@/lib/popup-bounds';
import { stripCaptionLabel } from '@/lib/docx-table-extras';

/**
 * The small dialogs that put something into the text (a citation, a formula, a reference to a table or figure, a footnote): the same
 * card as the settings of a table or a figure, so that every popup of the editor looks and appears alike.
 */
/** The place of the cursor in the text being edited (null when it cannot be told). */
function readCursorRect(): DOMRect | null {
  try {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const first = range.getClientRects()[0];
    if (first && (first.width > 0 || first.height > 0)) return first;
    const el = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement;
    const rect = el?.getBoundingClientRect();
    return rect && rect.height > 0 && el !== document.body ? rect : null;
  } catch {
    return null;
  }
}

export const InlineModal: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  onClose: () => void;
  width?: number;
  testId?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ open, title, subtitle, onClose, width = 320, testId, children, footer }) => {
  // Where the card goes is worked out once, when the dialog opens, from where the cursor is then (it is read while the dialog is being drawn
  // for the first time, because once it is on the page its own field takes the focus, and the selection with it). Nothing is measured
  // afterwards: the card sits under the cursor, or over it when there is more room there, and scrolls inside itself if it must.
  const placeRef = useRef<React.CSSProperties>({});
  const wasOpen = useRef(false);
  if (open && !wasOpen.current) {
    const anchor = readCursorRect();
    const vw = typeof window === 'undefined' ? 1200 : window.innerWidth;
    const vh = typeof window === 'undefined' ? 800 : window.innerHeight;
    if (!anchor) placeRef.current = { left: Math.max(POPUP_EDGE, (vw - width) / 2), top: POPUP_TOP + 60, maxHeight: Math.max(160, vh - POPUP_TOP - 60 - POPUP_EDGE) };
    else {
      const left = Math.max(POPUP_EDGE, Math.min(anchor.left - 12, vw - width - POPUP_EDGE));
      const roomBelow = vh - anchor.bottom - 8 - POPUP_EDGE;
      const roomAbove = anchor.top - 8 - POPUP_TOP;
      placeRef.current =
        roomBelow >= 260 || roomBelow >= roomAbove
          ? { left, top: anchor.bottom + 8, maxHeight: Math.max(140, roomBelow) }
          : { left, bottom: vh - anchor.top + 8, maxHeight: Math.max(140, roomAbove) };
    }
  }
  wasOpen.current = open;
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => window.removeEventListener('keydown', key, true);
  }, [open, onClose]);
  if (typeof document === 'undefined' || !open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[100010]" data-testid={testId}>
      <div className="fixed inset-0 bg-transparent cursor-default" onMouseDown={(e) => e.preventDefault()} onClick={onClose} />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        role="dialog"
        aria-label={title}
        style={{ position: 'fixed', width, maxWidth: 'calc(100vw - 16px)', ...placeRef.current }}
        className="rounded-2xl border border-white/70 bg-[#F8F9FA] shadow-[0_12px_40px_rgba(0,0,0,0.20),0_4px_14px_rgba(0,0,0,0.10)] overflow-hidden flex flex-col text-left select-none"
        onMouseDown={(e) => {
          // fields keep their own focus; a click on empty card keeps the text's selection
          if ((e.target as HTMLElement).closest('input,select,textarea,button')) return;
          e.preventDefault();
        }}
      >
        <div className="flex-shrink-0 flex items-start justify-between gap-2 px-3.5 pt-3 pb-1">
          <div className="min-w-0">
            <h3 className="text-[13px] font-extrabold text-slate-900 leading-tight">{title}</h3>
            {subtitle && <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng" title="Đóng (Esc)" className="w-6 h-6 -mr-1 rounded-full text-gray-500 hover:bg-gray-200 hover:text-gray-900 flex items-center justify-center cursor-pointer flex-shrink-0">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="px-3.5 pb-3 pt-1.5 overflow-y-auto space-y-2">{children}</div>
        {footer && <div className="flex-shrink-0 flex justify-end gap-1.5 px-3.5 pb-3">{footer}</div>}
      </motion.div>
    </div>,
    document.body
  );
};

const Primary: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (p) => (
  <button type="button" {...p} className="px-4 py-1.5 rounded-full text-xs font-bold bg-[#B4E50D] hover:bg-[#a6d40b] text-[#14532D] disabled:opacity-40 disabled:cursor-default cursor-pointer transition-colors" />
);
const Ghost: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = (p) => (
  <button type="button" {...p} className="px-4 py-1.5 rounded-full text-xs font-bold text-zinc-600 bg-gray-200/70 hover:bg-gray-200 cursor-pointer transition-colors" />
);
const SearchBox: React.FC<{ value: string; onChange: (s: string) => void; placeholder: string }> = ({ value, onChange, placeholder }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-zinc-200 rounded-xl focus-within:ring-2 focus-within:ring-lime-200">
    <Search className="w-4 h-4 text-zinc-400" />
    <input type="text" autoFocus placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent outline-none focus:outline-none focus:ring-0 text-xs" />
  </div>
);

// ───────────────────────────── a citation ─────────────────────────────

export interface ReferencePickerPopoverProps {
  isOpen: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  references: PaperReference[];
  onSelectReference: (id: number | string) => void;
  onClose: () => void;
}

export const ReferencePickerPopover: React.FC<ReferencePickerPopoverProps> = ({ isOpen, search, onSearchChange, references, onSelectReference, onClose }) => {
  const filteredRefs = useMemo(() => {
    const q = search.replace(/[\[\]]/g, '').trim().toLowerCase();
    if (!q) return references;
    return references.filter((r) => String(r.id).includes(q) || r.raw.toLowerCase().includes(q) || r.authors?.toLowerCase().includes(q) || r.title?.toLowerCase().includes(q));
  }, [references, search]);

  return (
    <InlineModal open={isOpen} title="Chọn tài liệu trích dẫn" subtitle="Số của tài liệu sẽ hiện trong câu, như [3]." onClose={onClose} testId="cite-dialog">
      <SearchBox value={search} onChange={onSearchChange} placeholder="Tìm số hoặc tác giả..." />
      <div className="max-h-48 overflow-y-auto space-y-0.5">
        {filteredRefs.length > 0 ? (
          filteredRefs.map((r) => (
            <button key={r.id} type="button" onClick={() => onSelectReference(r.id)} className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-lime-50 flex items-center gap-2 text-xs cursor-pointer">
              <span className="font-extrabold text-[#2B74B7]">[{r.id}]</span>
              <span className="truncate flex-1 text-zinc-700">{r.authors ? `${r.authors} (${r.year || ''})` : r.raw}</span>
            </button>
          ))
        ) : (
          <div className="text-zinc-500 text-center py-3 text-sm">
            {search ? (
              <button type="button" onClick={() => onSelectReference(search.replace(/\D/g, '') || '1')} className="text-[#2B74B7] font-bold hover:underline cursor-pointer">
                Tạo trích dẫn [{search.replace(/\D/g, '') || '1'}]
              </button>
            ) : (
              'Chưa có danh mục tài liệu tham khảo'
            )}
          </div>
        )}
      </div>
    </InlineModal>
  );
};

// ───────────────────────────── a formula ─────────────────────────────

const SYMBOLS: Array<[string, string]> = [
  ['\\alpha', 'α'], ['\\beta', 'β'], ['\\gamma', 'γ'], ['\\mu', 'μ'], ['\\sigma', 'σ'], ['\\pi', 'π'], ['\\theta', 'θ'], ['\\Delta', 'Δ'],
  ['\\frac{a}{b}', 'a/b'], ['x^{2}', 'x²'], ['x_{i}', 'xᵢ'], ['\\sqrt{x}', '√'], ['\\sum_{i=1}^{n}', '∑'], ['\\int_{a}^{b}', '∫'],
  ['\\pm', '±'], ['\\times', '×'], ['\\leq', '≤'], ['\\geq', '≥'], ['\\neq', '≠'], ['\\approx', '≈'], ['\\rightarrow', '→'], ['\\infty', '∞'],
];

export interface MathInputPopoverProps {
  isOpen: boolean;
  latex: string;
  onLatexChange: (s: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export const MathInputPopover: React.FC<MathInputPopoverProps> = ({ isOpen, latex, onLatexChange, onSubmit, onClose }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const clean = latex.trim();
  const error = useMemo(() => (clean ? renderLatexToHtml(clean, false).error : null), [clean]);
  const put = (snippet: string) => {
    const el = ref.current;
    const at = el ? el.selectionStart ?? latex.length : latex.length;
    const to = el ? el.selectionEnd ?? at : at;
    onLatexChange(latex.slice(0, at) + snippet + latex.slice(to));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(at + snippet.length, at + snippet.length);
    });
  };
  return (
    <InlineModal
      open={isOpen}
      title="Chèn công thức LaTeX"
      subtitle="Gõ, hoặc dán công thức copy từ Word, trang web, hay LaTeX."
     
      onClose={onClose}
      width={360}
      testId="math-dialog"
      footer={
        <>
          <Ghost onClick={onClose}>Hủy</Ghost>
          <Primary onClick={onSubmit} disabled={!clean}>
            Chèn
          </Primary>
        </>
      }
    >
      <textarea
        ref={ref}
        autoFocus
        rows={2}
        placeholder="ví dụ: E = mc^2 hoặc \alpha + \beta"
        value={latex}
        onChange={(e) => onLatexChange(e.target.value)}
        onPaste={(e) => {
          // a formula copied from Word (OMML) or from a web page carries its own source: it is read from there, not pasted as pictures or noise
          const pasted = latexFromClipboard(e.clipboardData.getData('text/html'), e.clipboardData.getData('text/plain'));
          if (!pasted) return;
          e.preventDefault();
          const el = e.currentTarget;
          const at = el.selectionStart ?? latex.length;
          const to = el.selectionEnd ?? at;
          onLatexChange(latex.slice(0, at) + pasted + latex.slice(to));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
          if (e.key === 'Escape') onClose();
        }}
        className="w-full p-2 rounded-xl bg-white border border-zinc-200 font-mono text-xs outline-none focus:ring-4 focus:ring-lime-200 focus:border-lime-400 resize-none select-text"
      />
      <div className="rounded-xl bg-white border border-zinc-200 px-3 py-2 min-h-[2.5rem] flex items-center justify-center overflow-x-auto" data-testid="math-preview">
        {clean ? error ? <span className="text-xs text-red-600">{error}</span> : <MathFormula latex={clean} display /> : <span className="text-xs text-zinc-400">Công thức hiện ở đây khi bạn gõ</span>}
      </div>
      <div className="flex flex-wrap gap-1">
        {SYMBOLS.map(([code, shown]) => (
          <button key={code} type="button" title={code} onClick={() => put(code)} className="h-7 min-w-7 px-1.5 rounded-lg bg-white border border-zinc-200 text-xs hover:bg-lime-50 cursor-pointer">
            {shown}
          </button>
        ))}
      </div>
    </InlineModal>
  );
};

// ───────────────────────────── a table or a figure ─────────────────────────────

export const XrefDialog: React.FC<{ open: boolean; targets: RefTarget[]; lang?: 'vi' | 'en'; onSelect: (t: RefTarget) => void; onClose: () => void }> = ({ open, targets, lang = 'vi', onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (open) setSearch('');
  }, [open]);
  const shown = targets.filter((t) => !search.trim() || `${refLabel(t.kind, t.order, lang)} ${t.caption}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <InlineModal open={open} title="Tham chiếu đến bảng hoặc hình" subtitle="Hiện như “Bảng 2”, tự đúng số." onClose={onClose} testId="xref-dialog">
      <SearchBox value={search} onChange={setSearch} placeholder="Tìm bảng hoặc hình..." />
      <div className="max-h-56 overflow-y-auto space-y-0.5">
        {shown.length > 0 ? (
          (['table', 'figure'] as const).map((kind) => {
            const group = shown.filter((t) => t.kind === kind).sort((a, b) => a.order - b.order);
            if (group.length === 0) return null;
            return (
              <div key={kind} data-testid={`xref-group-${kind}`}>
                <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-extrabold uppercase tracking-wide text-zinc-400">{kind === 'table' ? (lang === 'en' ? 'Tables' : 'Bảng') : lang === 'en' ? 'Figures' : 'Hình'}</div>
                {group.map((t) => (
                  <button key={`${t.kind}:${t.id}`} type="button" data-testid={`xref-${t.kind}-${t.order}`} onClick={() => onSelect(t)} className="w-full text-left px-2.5 py-1.5 rounded-xl hover:bg-lime-50 flex items-center gap-2 text-xs cursor-pointer">
                    <span className="font-extrabold text-purple-700 whitespace-nowrap">{refLabel(t.kind, t.order, lang)}</span>
                    <span className="truncate flex-1 text-zinc-600">{stripCaptionLabel(t.caption)}</span>
                  </button>
                ))}
              </div>
            );
          })
        ) : (
          <div className="text-zinc-500 text-center py-3 text-sm">{targets.length === 0 ? 'Bài chưa có bảng hoặc hình nào' : 'Không có bảng hoặc hình khớp'}</div>
        )}
      </div>
    </InlineModal>
  );
};

// ───────────────────────────── a footnote ─────────────────────────────

export const FootnoteDialog: React.FC<{ open: boolean; initial?: string; onSubmit: (text: string) => void; onClose: () => void }> = ({ open, initial = '', onSubmit, onClose }) => {
  const [text, setText] = useState(initial);
  useEffect(() => {
    if (open) setText(initial);
  }, [open, initial]);
  return (
    <InlineModal
      open={open}
      title="Chú thích chân trang"
      subtitle="Một số nhỏ hiện trong câu; nội dung in ở cuối trang có câu đó."
     
      onClose={onClose}
      testId="footnote-dialog"
      footer={
        <>
          <Ghost onClick={onClose}>Hủy</Ghost>
          <Primary onClick={() => onSubmit(text.trim())} disabled={!text.trim()}>
            Chèn
          </Primary>
        </>
      }
    >
      <textarea
        autoFocus
        rows={3}
        aria-label="Nội dung chú thích chân trang"
        placeholder="Nội dung chú thích, ví dụ: Animus (tiếng Latin: “tâm trí”) là một khái niệm của Carl Jung."
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (text.trim()) onSubmit(text.trim());
          }
        }}
        className="w-full p-2 rounded-xl bg-white border border-zinc-200 text-xs outline-none focus:ring-4 focus:ring-lime-200 focus:border-lime-400 resize-none select-text"
      />
    </InlineModal>
  );
};
