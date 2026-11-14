'use client';

import React from 'react';
import { SpacingAttributes } from '@/types/template-engine/elements';
import { NumberInput } from '@/components/ui/NumberInput';
import { AlignLeft, AlignCenter, AlignRight, AlignJustify, MoveVertical } from 'lucide-react';

interface SpacingAlignmentEditorProps {
  attributes: SpacingAttributes;
  onChange: (updated: Partial<SpacingAttributes>) => void;
  showIndents?: boolean;
}

export const SpacingAlignmentEditor: React.FC<SpacingAlignmentEditorProps> = ({
  attributes,
  onChange,
  showIndents = true,
}) => {
  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_0_10px_rgba(0,0,0,0.03)] space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
        <div className="flex items-center gap-2">
          <MoveVertical className="w-4 h-4 text-zinc-700" />
          <h4 className="text-xs font-extrabold text-zinc-900">
            Khoảng Cách & Căn Lề Đoạn (Typst #set par)
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#78C841]/15 text-[#14532D] border border-[#78C841]/40">
          #set par(justify: {attributes.textAlign === 'justify' ? 'true' : 'false'})
        </span>
      </div>

      {/* Text Alignment */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 block">
          Căn lề đoạn văn (Text Alignment)
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { id: 'left', label: 'Căn trái', icon: <AlignLeft className="w-4 h-4" /> },
            { id: 'center', label: 'Căn giữa', icon: <AlignCenter className="w-4 h-4" /> },
            { id: 'right', label: 'Căn phải', icon: <AlignRight className="w-4 h-4" /> },
            { id: 'justify', label: 'Căn đều 2 bên', icon: <AlignJustify className="w-4 h-4" /> },
          ].map((align) => {
            const isActive = attributes.textAlign === align.id;
            return (
              <button
                key={align.id}
                type="button"
                onClick={() => onChange({ textAlign: align.id as any })}
                className={`py-2 px-1.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-2 ring-[#78C841]/50'
                    : 'bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 border-zinc-200/80 shadow-2xs'
                }`}
                title={align.label}
              >
                <span className={isActive ? 'text-[#78C841]' : 'text-zinc-600'}>
                  {align.icon}
                </span>
                <span className="hidden sm:inline text-xs">{align.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Margin Top & Bottom */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200/60">
        <NumberInput
          label="Khoảng cách trên (Margin Top)"
          value={attributes.marginTopPt}
          onChange={(val) => onChange({ marginTopPt: val })}
          unit="pt"
          min={0}
          max={48}
          step={0.5}
          variant="flat-white"
        />

        <NumberInput
          label="Khoảng cách dưới (Margin Bottom)"
          value={attributes.marginBottomPt}
          onChange={(val) => onChange({ marginBottomPt: val })}
          unit="pt"
          min={0}
          max={48}
          step={0.5}
          variant="flat-white"
        />
      </div>

      {/* First-line Indent & Hanging Indent */}
      {showIndents && (
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-200/60">
          <NumberInput
            label="Thụt đầu dòng (First-line Indent)"
            value={attributes.firstLineIndentMm || 0}
            onChange={(val) => onChange({ firstLineIndentMm: val })}
            unit="mm"
            min={0}
            max={20}
            step={0.5}
            variant="flat-white"
          />

          <NumberInput
            label="Thụt dòng sau (Hanging Indent)"
            value={attributes.hangingIndentMm || 0}
            onChange={(val) => onChange({ hangingIndentMm: val })}
            unit="mm"
            min={0}
            max={20}
            step={0.5}
            variant="flat-white"
          />
        </div>
      )}

      {/* Padding 4-side (cho các khối box) */}
      <div className="pt-2 border-t border-zinc-200/60 space-y-2">
        <label className="text-xs font-bold text-zinc-700 block">
          Khoảng đệm trong (Padding mm):
        </label>
        <div className="grid grid-cols-4 gap-2">
          <NumberInput
            label="Trên"
            value={attributes.paddingTopMm || 0}
            onChange={(val) => onChange({ paddingTopMm: val })}
            unit="mm"
            min={0}
            max={25}
            step={0.5}
            variant="flat-white"
          />
          <NumberInput
            label="Phải"
            value={attributes.paddingRightMm || 0}
            onChange={(val) => onChange({ paddingRightMm: val })}
            unit="mm"
            min={0}
            max={25}
            step={0.5}
            variant="flat-white"
          />
          <NumberInput
            label="Dưới"
            value={attributes.paddingBottomMm || 0}
            onChange={(val) => onChange({ paddingBottomMm: val })}
            unit="mm"
            min={0}
            max={25}
            step={0.5}
            variant="flat-white"
          />
          <NumberInput
            label="Trái"
            value={attributes.paddingLeftMm || 0}
            onChange={(val) => onChange({ paddingLeftMm: val })}
            unit="mm"
            min={0}
            max={25}
            step={0.5}
            variant="flat-white"
          />
        </div>
      </div>
    </div>
  );
};
