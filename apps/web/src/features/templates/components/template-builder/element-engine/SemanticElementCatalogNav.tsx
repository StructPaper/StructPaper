'use client';

import React, { useState } from 'react';
import {
  SEMANTIC_ELEMENTS_CATALOG,
  StandardSemanticElementType,
  ElementCategory,
  SemanticElementMeta,
} from '@/types/template-engine/elements';
import { Search, Tag, Layers, ChevronRight } from 'lucide-react';

interface SemanticElementCatalogNavProps {
  selectedType: StandardSemanticElementType;
  onSelectType: (type: StandardSemanticElementType) => void;
}

const CATEGORIES: Array<{ id: ElementCategory | 'all'; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'frontmatter', label: 'Phần đầu' },
  { id: 'headings', label: 'Tiêu đề' },
  { id: 'body', label: 'Thân bài' },
  { id: 'floats', label: 'Hình/Bảng' },
  { id: 'backmatter', label: 'Tham khảo' },
];

export const SemanticElementCatalogNav: React.FC<SemanticElementCatalogNavProps> = ({
  selectedType,
  onSelectType,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<ElementCategory | 'all'>('all');

  const filteredElements = SEMANTIC_ELEMENTS_CATALOG.filter((el) => {
    const matchesCategory = activeCategory === 'all' || el.category === activeCategory;
    const matchesSearch =
      el.label.toLowerCase().includes(search.toLowerCase()) ||
      el.description.toLowerCase().includes(search.toLowerCase()) ||
      el.type.toLowerCase().includes(search.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-2">
      {/* Search Input */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm kiếm phần tử khoa học..."
          className="w-full pl-8 pr-3 py-1.5 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Category Filter Pills */}
      <div className="flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold whitespace-nowrap transition-all border cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white hover:bg-zinc-100 text-zinc-600 border-zinc-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Elements List */}
      <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
        {filteredElements.map((el) => {
          const isSelected = selectedType === el.type;
          return (
            <button
              key={el.type}
              type="button"
              onClick={() => onSelectType(el.type)}
              className={`w-full p-2 rounded-xl text-left border transition-all flex items-center justify-between cursor-pointer ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-400 ring-1 ring-blue-400/30'
                  : 'bg-white/80 hover:bg-white border-zinc-200/80 shadow-xs'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-zinc-900 truncate">
                    {el.label}
                  </span>
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full ${
                      el.defaultColumnSpan === 'all'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {el.defaultColumnSpan === 'all' ? 'Tràn trang' : '1 cột'}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-500 truncate leading-tight mt-0.5">
                  {el.description}
                </p>
              </div>

              <ChevronRight
                className={`w-4 h-4 shrink-0 transition-transform ${
                  isSelected ? 'text-blue-600 translate-x-0.5' : 'text-zinc-300'
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};
