'use client';

import React from 'react';
import { NumberingAttributes } from '@/types/template-engine/elements';
import { Select } from '@/components/ui/Select';
import { Hash } from 'lucide-react';

interface NumberingEditorProps {
  attributes: NumberingAttributes;
  onChange: (updated: Partial<NumberingAttributes>) => void;
  isHeading?: boolean;
  isReference?: boolean;
}

export const NumberingEditor: React.FC<NumberingEditorProps> = ({
  attributes,
  onChange,
  isHeading = false,
  isReference = false,
}) => {
  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_0_10px_rgba(0,0,0,0.03)] space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
        <div className="flex items-center gap-2">
          <Hash className="w-4 h-4 text-zinc-700" />
          <h4 className="text-xs font-extrabold text-zinc-900">
            Quy Tắc Đánh Số & Trích Dẫn (Typst #set heading / cite)
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#78C841]/15 text-[#14532D] border border-[#78C841]/40">
          #set heading(numbering: &quot;1.1&quot;)
        </span>
      </div>

      {/* Numbering Scheme */}
      <div className="space-y-1">
        <label className="text-xs font-bold text-zinc-700 block">
          Kiểu đánh số thứ tự (Numbering Scheme)
        </label>
        <Select
          value={attributes.scheme}
          onChange={(val) => onChange({ scheme: val as any })}
          options={[
            { value: 'none', label: 'Không đánh số (None)' },
            { value: 'arabic', label: 'Số Ả Rập (1., 2., 3.)' },
            { value: 'roman', label: 'Số La Mã (I., II., III.)' },
            { value: 'decimal', label: 'Số thập phân (1.1, 1.2, 1.2.1)' },
            { value: 'alphabet', label: 'Chữ cái (A., B., C.)' },
          ]}
          variant="flat-white"
          size="sm"
        />
      </div>

      {/* Prefix & Suffix */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">Tiền tố (Prefix)</label>
          <input
            type="text"
            value={attributes.prefix || ''}
            onChange={(e) => onChange({ prefix: e.target.value })}
            placeholder="e.g. Hình, Bảng, Mục"
            className="w-full px-3 py-2 text-xs font-mono font-bold text-zinc-900 bg-white border border-zinc-200/90 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#78C841]/20 focus:border-[#78C841] shadow-2xs"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">Hậu tố (Suffix)</label>
          <input
            type="text"
            value={attributes.suffix || ''}
            onChange={(e) => onChange({ suffix: e.target.value })}
            placeholder="e.g. ., :, -"
            className="w-full px-3 py-2 text-xs font-mono font-bold text-zinc-900 bg-white border border-zinc-200/90 rounded-2xl focus:outline-none focus:ring-4 focus:ring-[#78C841]/20 focus:border-[#78C841] shadow-2xs"
          />
        </div>
      </div>

      {/* Citation Style (If element is reference) */}
      {isReference && (
        <div className="pt-2 border-t border-zinc-200/60 space-y-1">
          <label className="text-xs font-bold text-zinc-700 block">
            Chuẩn trích dẫn học thuật (Citation Style)
          </label>
          <Select
            value={attributes.citationStyle || 'Vancouver'}
            onChange={(val) => onChange({ citationStyle: val as any })}
            options={[
              { value: 'Vancouver', label: 'Vancouver (Đánh số [1], y sinh học)' },
              { value: 'IEEE', label: 'IEEE (Đánh số [1], kỹ thuật & CNTT)' },
              { value: 'APA', label: 'APA 7th (Tác giả, Năm)' },
              { value: 'Harvard', label: 'Harvard (Tác giả, Năm)' },
              { value: 'Nature', label: 'Nature (Số mũ 1)' },
            ]}
            variant="flat-white"
            size="sm"
          />
        </div>
      )}
    </div>
  );
};
