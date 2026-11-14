'use client';

import React, { useMemo } from 'react';
import type { PaperReference } from '@/types/paper';
import { Search, X } from 'lucide-react';

export interface ReferencePickerPopoverProps {
  isOpen: boolean;
  search: string;
  onSearchChange: (s: string) => void;
  references: PaperReference[];
  onSelectReference: (id: number | string) => void;
  onClose: () => void;
}

export const ReferencePickerPopover: React.FC<ReferencePickerPopoverProps> = ({
  isOpen,
  search,
  onSearchChange,
  references,
  onSelectReference,
  onClose,
}) => {
  const filteredRefs = useMemo(() => {
    const q = search.replace(/[\[\]]/g, '').trim().toLowerCase();
    if (!q) return references;
    return references.filter(
      (r) =>
        String(r.id).includes(q) ||
        r.raw.toLowerCase().includes(q) ||
        r.authors?.toLowerCase().includes(q) ||
        r.title?.toLowerCase().includes(q)
    );
  }, [references, search]);

  if (!isOpen) return null;

  return (
    <div className="absolute left-2 top-8 z-30 w-72 bg-white rounded-xl shadow-lg border border-zinc-200 p-2 text-xs space-y-1.5">
      <div className="flex items-center justify-between border-b pb-1">
        <span className="font-semibold text-zinc-700">Chọn tài liệu trích dẫn:</span>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-1 px-2 py-1 bg-zinc-50 border rounded-lg">
        <Search className="w-3 h-3 text-zinc-400" />
        <input
          type="text"
          autoFocus
          placeholder="Tìm số hoặc tác giả..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-transparent outline-none text-xs"
        />
      </div>
      <div className="max-h-40 overflow-y-auto space-y-1">
        {filteredRefs.length > 0 ? (
          filteredRefs.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectReference(r.id)}
              className="w-full text-left px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-700 flex items-center justify-between text-xs cursor-pointer"
            >
              <span className="font-bold text-blue-600 mr-2">[{r.id}]</span>
              <span className="truncate flex-1 text-zinc-600">
                {r.authors ? `${r.authors} (${r.year || ''})` : r.raw}
              </span>
            </button>
          ))
        ) : (
          <div className="text-zinc-400 italic text-center py-2">
            {search ? (
              <button
                type="button"
                onClick={() => onSelectReference(search.replace(/\D/g, '') || '1')}
                className="text-blue-600 font-semibold hover:underline"
              >
                Tạo trích dẫn [{search.replace(/\D/g, '') || '1'}]
              </button>
            ) : (
              'Chưa có danh mục tài liệu tham khảo'
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export interface MathInputPopoverProps {
  isOpen: boolean;
  latex: string;
  onLatexChange: (s: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export const MathInputPopover: React.FC<MathInputPopoverProps> = ({
  isOpen,
  latex,
  onLatexChange,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute left-2 top-8 z-30 w-72 bg-white rounded-xl shadow-lg border border-zinc-200 p-2.5 text-xs space-y-2">
      <div className="flex items-center justify-between border-b pb-1">
        <span className="font-semibold text-zinc-700">Chèn công thức LaTeX:</span>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <input
        type="text"
        autoFocus
        placeholder="ví dụ: E = mc^2 hoặc \alpha + \beta"
        value={latex}
        onChange={(e) => onLatexChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
          if (e.key === 'Escape') onClose();
        }}
        className="w-full p-1.5 border rounded-lg font-mono text-xs outline-none focus:ring-2 focus:ring-blue-300"
      />
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onClose}
          className="px-2.5 py-1 text-zinc-600 hover:bg-zinc-100 rounded text-xs cursor-pointer"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="px-2.5 py-1 bg-blue-600 text-white rounded font-medium text-xs hover:bg-blue-700 cursor-pointer"
        >
          Chèn
        </button>
      </div>
    </div>
  );
};
