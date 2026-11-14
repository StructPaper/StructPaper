'use client';

import React from 'react';
import { Check } from 'lucide-react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
  testId?: string;
}

interface SegmentedOptionsProps<T extends string> {
  value: T;
  options: Array<SegmentedOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
}

/** Small pill-style segmented control, same look as the table settings modal (Chiều dọc / Xoay ngang). */
export function SegmentedOptions<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: SegmentedOptionsProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-1 p-1 bg-zinc-100 rounded-xl"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={opt.title}
            data-testid={opt.testId}
            onClick={() => onChange(opt.value)}
            className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
              active
                ? 'bg-white text-zinc-900 shadow-2xs font-extrabold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            {active && <Check className="w-3 h-3 text-[#78C841] stroke-[3]" />}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
