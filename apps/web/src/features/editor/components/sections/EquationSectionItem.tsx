'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { Check, ClipboardCopy, Eraser, Link2, Sigma, Wrench } from 'lucide-react';
import type { PaperSection } from '@/types/paper';
import { MathFormula } from '@/features/preview';
import { checkLatexMath } from '@/lib/math-text';
import { FORMULA_TEMPLATES, TOOL_GROUPS, bracketBalance, cleanPastedLatex, equationMention, insertSnippet } from '@/lib/equation-tools';

interface EquationSectionItemProps {
  sec: PaperSection;
  idx: number;
  onUpdateSection: (index: number, updated: PaperSection) => void;
}

type PanelId = 'greek' | 'operators' | 'structures' | 'templates';

const PANEL_NAMES: Record<PanelId, string> = {
  structures: 'Cấu trúc',
  greek: 'Chữ Hy Lạp',
  operators: 'Toán tử',
  templates: 'Công thức mẫu',
};
const PANEL_ORDER: PanelId[] = ['structures', 'greek', 'operators', 'templates'];

const BTN = 'px-2 py-1 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-[11px] font-bold text-zinc-700 cursor-pointer active:scale-95 transition-all';

/**
 * The equation block. The formula is typed as LaTeX, with a preview above it. To make that quick: buttons put symbols
 * (Greek letters, operators) and structures (fraction, root, sum, integral, matrix...) at the cursor, wrapping what is selected;
 * a list of formulas that come up often (mean, regression, normal distribution...); pasted LaTeX is cleaned of its $$ / \[ \] /
 * \begin{equation} wrapping; and the number can be copied as "Công thức (n)" to point at the equation from the text.
 */
export const EquationSectionItem: React.FC<EquationSectionItemProps> = ({ sec, idx, onUpdateSection }) => {
  const eq = sec.equation || { latex: '', numbered: true };
  const structuralError = eq.latex.trim() ? checkLatexMath(eq.latex) : null;
  const balance = eq.latex.trim() && !structuralError ? bracketBalance(eq.latex) : { ok: true as boolean, message: undefined as string | undefined };

  const area = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);
  // a new, empty formula opens on the structures: that is what somebody starting one reaches for
  const [panel, setPanel] = useState<PanelId | null>(eq.latex.trim() ? null : 'structures');
  const [copied, setCopied] = useState<'latex' | 'mention' | null>(null);

  const update = (patch: Partial<typeof eq>) => onUpdateSection(idx, { ...sec, equation: { ...eq, ...patch }, content: patch.latex ?? eq.latex });

  // after a button changed the text, the cursor goes where the snippet wants it
  useLayoutEffect(() => {
    const sel = pendingSelection.current;
    const el = area.current;
    if (!sel || !el) return;
    pendingSelection.current = null;
    el.focus();
    el.setSelectionRange(sel.start, sel.end);
  }, [eq.latex]);

  const put = (snippet: string) => {
    const el = area.current;
    const start = el?.selectionStart ?? eq.latex.length;
    const end = el?.selectionEnd ?? eq.latex.length;
    const edit = insertSnippet(eq.latex, start, end, snippet);
    pendingSelection.current = { start: edit.start, end: edit.end };
    update({ latex: edit.text });
  };

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const raw = e.clipboardData.getData('text');
    const clean = cleanPastedLatex(raw);
    if (!raw || clean === raw.trim()) return; // nothing to clean: the browser pastes as usual
    e.preventDefault();
    const el = e.currentTarget;
    const edit = insertSnippet(eq.latex, el.selectionStart, el.selectionEnd, clean);
    pendingSelection.current = { start: edit.start, end: edit.end };
    update({ latex: edit.text });
  };

  const copy = async (what: 'latex' | 'mention') => {
    try {
      await navigator.clipboard.writeText(what === 'latex' ? eq.latex : equationMention(eq.num));
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // no clipboard (insecure context): nothing to confirm
    }
  };

  const togglePanel = (id: PanelId) => setPanel((current) => (current === id ? null : id));
  const keepSelection = (e: React.MouseEvent) => e.preventDefault(); // a button must not take the selection out of the box

  const group = panel && panel !== 'templates' ? TOOL_GROUPS.find((g) => g.id === panel) : undefined;

  return (
    <div className="space-y-2" data-testid="equation-item">
      <div className="rounded-2xl bg-white border border-zinc-200 px-3 py-3 min-h-[56px] flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex-1 text-center">
          {eq.latex.trim() ? (
            <MathFormula latex={eq.latex} display />
          ) : (
            <span className="text-xs text-zinc-400">Nhập mã LaTeX bên dưới hoặc chọn một cấu trúc để xem công thức…</span>
          )}
        </div>
        {eq.numbered && (
          <span className="shrink-0 text-sm font-semibold text-zinc-700" data-testid="equation-number">
            ({eq.num ?? '?'})
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 flex-wrap" role="tablist" aria-label="Công cụ nhập công thức" data-edit-only data-testid="equation-tools">
        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 pr-1">
          <Wrench className="w-3 h-3" />
          Công cụ
        </span>
        {PANEL_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={panel === id}
            data-testid={`equation-panel-${id}`}
            onMouseDown={keepSelection}
            onClick={() => togglePanel(id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all ${panel === id ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
          >
            {PANEL_NAMES[id]}
          </button>
        ))}
      </div>

      {group && (
        <div className="flex flex-wrap gap-1 rounded-2xl bg-gray-200/50 p-2" data-edit-only data-testid="equation-tool-buttons">
          {group.tools.map((t) => (
            <button key={t.hint} type="button" title={t.hint} aria-label={t.hint} onMouseDown={keepSelection} onClick={() => put(t.snippet)} className={`${BTN} min-w-[2rem]`} data-testid="equation-tool">
              {t.label}
            </button>
          ))}
        </div>
      )}

      {panel === 'templates' && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 rounded-2xl bg-gray-200/50 p-2" data-edit-only data-testid="equation-templates">
          {FORMULA_TEMPLATES.map((f) => (
            <li key={f.name}>
              <button
                type="button"
                onMouseDown={keepSelection}
                onClick={() => {
                  update({ latex: f.latex });
                  setPanel(null);
                }}
                title={f.latex}
                className="w-full text-left px-2.5 py-1.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-[11px] font-bold text-zinc-700 cursor-pointer active:scale-[0.99] transition-all"
              >
                <Sigma className="inline w-3 h-3 mr-1 text-zinc-400" />
                {f.name}
              </button>
            </li>
          ))}
        </ul>
      )}

      <textarea
        ref={area}
        value={eq.latex}
        onChange={(e) => update({ latex: e.target.value })}
        onPaste={onPaste}
        rows={Math.min(8, Math.max(2, eq.latex.split('\n').length))}
        spellCheck={false}
        placeholder="Ví dụ: \frac{a}{b} = \sum_{i=1}^{n} x_i"
        aria-label="Mã LaTeX của công thức"
        className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-800 outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300"
      />

      {structuralError && (
        <p className="text-[11px] font-semibold text-red-600" role="alert">
          {structuralError}
        </p>
      )}
      {!structuralError && !balance.ok && (
        <p className="text-[11px] font-semibold text-amber-700" role="status" data-testid="equation-balance">
          {balance.message}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-700 cursor-pointer select-none">
          <input type="checkbox" checked={eq.numbered} onChange={(e) => update({ numbered: e.target.checked })} className="accent-lime-500" />
          Đánh số công thức
        </label>
        <div className="flex items-center gap-1 flex-wrap">
          {eq.numbered && (
            <button type="button" onClick={() => copy('mention')} title={`Sao chép "${equationMention(eq.num)}" để nhắc tới công thức này trong văn bản`} data-testid="equation-copy-mention" className={`${BTN} inline-flex items-center gap-1`}>
              {copied === 'mention' ? <Check className="w-3 h-3 text-emerald-600" /> : <Link2 className="w-3 h-3" />}
              {copied === 'mention' ? 'Đã sao chép' : equationMention(eq.num)}
            </button>
          )}
          {eq.latex.trim() && (
            <>
              <button type="button" onClick={() => copy('latex')} title="Sao chép mã LaTeX" data-testid="equation-copy-latex" className={`${BTN} inline-flex items-center gap-1`}>
                {copied === 'latex' ? <Check className="w-3 h-3 text-emerald-600" /> : <ClipboardCopy className="w-3 h-3" />}
                {copied === 'latex' ? 'Đã sao chép' : 'Sao chép LaTeX'}
              </button>
              <button type="button" data-edit-only onClick={() => update({ latex: '' })} title="Xóa nội dung công thức" data-testid="equation-clear" className={`${BTN} inline-flex items-center gap-1 hover:!bg-red-50 hover:!text-red-600`}>
                <Eraser className="w-3 h-3" />
                Xóa
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
