'use client';

import React from 'react';
import type { PaperSection } from '@/types/paper';
import { MathFormula } from '@/components/preview/MathText';
import { checkLatexMath } from '@/lib/math-text';
import { SegmentedOptions } from './SegmentedOptions';

interface EquationSectionItemProps {
  sec: PaperSection;
  idx: number;
  onUpdateSection: (index: number, updated: PaperSection) => void;
}

const SAMPLES: Array<{ label: string; latex: string }> = [
  { label: 'Phân số', latex: '\\frac{a}{b}' },
  { label: 'Tổng', latex: '\\sum_{i=1}^{n} x_i' },
  { label: 'Căn', latex: '\\sqrt{x^2+y^2}' },
  { label: 'Hồi quy', latex: 'y_{i,t} = \\alpha + \\beta x_{i,t} + \\varepsilon_{i,t}' },
];

export const EquationSectionItem: React.FC<EquationSectionItemProps> = ({ sec, idx, onUpdateSection }) => {
  const eq = sec.equation || { latex: '', numbered: true };
  const structuralError = eq.latex.trim() ? checkLatexMath(eq.latex) : null;

  const update = (patch: Partial<typeof eq>) =>
    onUpdateSection(idx, { ...sec, equation: { ...eq, ...patch }, content: patch.latex ?? eq.latex });

  return (
    <div className="space-y-2" data-testid="equation-item">
      <div className="rounded-2xl bg-white border border-zinc-200 px-3 py-3 min-h-[56px] flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex-1 text-center">
          {eq.latex.trim() ? (
            <MathFormula latex={eq.latex} display />
          ) : (
            <span className="text-xs text-zinc-400">Nhập mã LaTeX bên dưới để xem công thức…</span>
          )}
        </div>
        {eq.numbered && (
          <span className="shrink-0 text-sm font-semibold text-zinc-700" data-testid="equation-number">
            ({eq.num ?? '?'})
          </span>
        )}
      </div>

      <textarea
        value={eq.latex}
        onChange={(e) => update({ latex: e.target.value })}
        rows={2}
        spellCheck={false}
        placeholder="Ví dụ: \frac{a}{b} = \sum_{i=1}^{n} x_i"
        aria-label="Mã LaTeX của công thức"
        className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 font-mono text-xs text-zinc-800 outline-none focus:ring-2 focus:ring-lime-300"
      />

      {structuralError && (
        <p className="text-[11px] font-semibold text-red-600" role="alert">
          {structuralError}
        </p>
      )}

      <div className="space-y-1" data-testid="equation-span">
        <SegmentedOptions
          ariaLabel="Độ rộng công thức"
          value={eq.columnSpan ?? '1-column'}
          onChange={(columnSpan) => update({ columnSpan })}
          options={[
            { value: '1-column', label: 'Trong 1 cột', testId: 'equation-span-1', title: 'Công thức nằm trong 1 cột, tự xuống dòng ở dấu + - = khi quá rộng' },
            { value: '2-column', label: 'Trải 2 cột', testId: 'equation-span-2', title: 'Công thức trải ngang cả 2 cột, nằm trên một dòng liền mạch' },
          ]}
        />
        <p className="text-[10px] text-zinc-500 leading-snug">
          Trải 2 cột: công thức nằm trên một dòng liền mạch, như bảng/hình rộng
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={eq.numbered}
            onChange={(e) => update({ numbered: e.target.checked })}
            className="accent-lime-500"
          />
          Đánh số công thức
        </label>
        <div className="flex items-center gap-1 flex-wrap">
          {SAMPLES.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => update({ latex: eq.latex ? `${eq.latex} ${s.latex}` : s.latex })}
              className="px-2 py-0.5 rounded-lg bg-white hover:bg-zinc-100 border border-zinc-200 text-[10px] font-bold text-zinc-700"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
