'use client';

import React from 'react';
import { LayoutScopeAttributes } from '@/types/template-engine/elements';
import { Select } from '@/components/ui/Select';
import { Columns, SplitSquareHorizontal } from 'lucide-react';

interface LayoutScopeEditorProps {
  attributes: LayoutScopeAttributes;
  onChange: (updated: Partial<LayoutScopeAttributes>) => void;
}

export const LayoutScopeEditor: React.FC<LayoutScopeEditorProps> = ({
  attributes,
  onChange,
}) => {
  return (
    <div className="p-4 rounded-3xl bg-white border border-zinc-200/80 shadow-[0_0_10px_rgba(0,0,0,0.03)] space-y-3.5">
      <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
        <div className="flex items-center gap-2">
          <Columns className="w-4 h-4 text-zinc-700" />
          <h4 className="text-xs font-extrabold text-zinc-900">
            Phạm Vi Cột & Hiển Thị (Typst Layout Scope)
          </h4>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#78C841]/15 text-[#14532D] border border-[#78C841]/40">
          {attributes.columnSpan === 'all' ? 'Span All (100%)' : 'In Column'}
        </span>
      </div>

      {/* Column Span */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold text-zinc-700 block">
          Phạm vi tràn cột (Column Span Scope)
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onChange({ columnSpan: 'all' })}
            className={`p-3 rounded-2xl text-left border transition-all cursor-pointer select-none ${
              attributes.columnSpan === 'all'
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-2 ring-[#78C841]/50'
                : 'bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 border-zinc-200/80 shadow-2xs'
            }`}
          >
            <div className="text-xs font-extrabold flex items-center gap-2 mb-1">
              <SplitSquareHorizontal className={`w-4 h-4 ${attributes.columnSpan === 'all' ? 'text-[#78C841]' : 'text-zinc-600'}`} />
              <span>Tràn toàn trang (All Columns)</span>
            </div>
            <p className={`text-[10px] leading-snug ${attributes.columnSpan === 'all' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              Phần tử tự động chiếm 100% bề rộng trang (Thường dùng cho Tiêu đề, Tác giả, Tóm tắt).
            </p>
          </button>

          <button
            type="button"
            onClick={() => onChange({ columnSpan: 'single' })}
            className={`p-3 rounded-2xl text-left border transition-all cursor-pointer select-none ${
              attributes.columnSpan === 'single'
                ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-2 ring-[#78C841]/50'
                : 'bg-white hover:bg-zinc-50 text-zinc-700 hover:text-zinc-950 border-zinc-200/80 shadow-2xs'
            }`}
          >
            <div className="text-xs font-extrabold flex items-center gap-2 mb-1">
              <Columns className={`w-4 h-4 ${attributes.columnSpan === 'single' ? 'text-[#78C841]' : 'text-zinc-600'}`} />
              <span>Nằm trong cột (Single Column)</span>
            </div>
            <p className={`text-[10px] leading-snug ${attributes.columnSpan === 'single' ? 'text-zinc-300' : 'text-zinc-500'}`}>
              Phần tử tuân theo độ rộng của cột phân vùng hiện tại (Thường dùng cho Đoạn văn, Heading).
            </p>
          </button>
        </div>
      </div>

      {/* Page Scope Target */}
      <div className="pt-2 border-t border-zinc-200/60 space-y-1">
        <label className="text-xs font-bold text-zinc-700 block">
          Mục tiêu hiển thị theo trang (Page Scope)
        </label>
        <Select
          value={attributes.pageScope || 'all'}
          onChange={(val) => onChange({ pageScope: val as any })}
          options={[
            { value: 'all', label: 'Tất cả các trang trong bài (All Pages)' },
            { value: 'first-page', label: 'Chỉ xuất hiện ở trang đầu (First Page / Cover)' },
            { value: 'subsequent-pages', label: 'Chỉ từ trang thứ 2 trở đi (Subsequent Pages)' },
          ]}
          variant="flat-white"
          size="sm"
        />
      </div>
    </div>
  );
};
