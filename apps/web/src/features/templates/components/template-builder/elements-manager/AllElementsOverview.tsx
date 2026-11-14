'use client';

import React, { useState } from 'react';
import {
  SemanticElement,
  LayoutZoneConfig,
  FloatingElementsDesignRules,
} from '@/types/template-builder';
import {
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Copy,
  Table as TableIcon,
  Image as ImageIcon,
  Sigma,
  Quote,
  Link2,
  FileText,
  Layers,
  Sparkles,
} from 'lucide-react';

interface AllElementsOverviewProps {
  elements: SemanticElement[];
  zones: LayoutZoneConfig[];
  floatingRules?: FloatingElementsDesignRules;
  onUpdateElement: (id: string, updated: Partial<SemanticElement>) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (element: SemanticElement) => void;
  onOpenCreateComposite: () => void;
  onNavigateToStep?: (step: string) => void;
}

const ELEMENT_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'table-box': TableIcon,
  'figure-box': ImageIcon,
  'equation-box': Sigma,
  'references-block': Quote,
  'link-box': Link2,
  'article-title': FileText,
  'author-block': FileText,
  'abstract-box': FileText,
  'keywords-group': FileText,
  'heading': FileText,
  'body-text': FileText,
  'custom-composite': Sparkles,
  'custom-field': Sparkles,
};

/**
 * AllElementsOverview
 * Displays an organized, full inventory of ALL template elements (core, special, custom composites)
 */
export const AllElementsOverview: React.FC<AllElementsOverviewProps> = ({
  elements,
  zones,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onOpenCreateComposite,
}) => {
  const [filterCategory, setFilterCategory] = useState<'all' | 'core' | 'special' | 'custom'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const specialTypes = ['table-box', 'figure-box', 'equation-box', 'references-block', 'link-box'];
  const customTypes = ['custom-composite', 'custom-field'];

  const filteredElements = elements.filter((el) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!el.name.toLowerCase().includes(q) && !el.type.toLowerCase().includes(q)) {
        return false;
      }
    }

    if (filterCategory === 'special') {
      return specialTypes.includes(el.type);
    }
    if (filterCategory === 'custom') {
      return customTypes.includes(el.type) || Boolean(el.specialProps?.subItems?.length);
    }
    if (filterCategory === 'core') {
      return !specialTypes.includes(el.type) && !customTypes.includes(el.type);
    }

    return true;
  });

  return (
    <div className="space-y-4 pb-6">
      {/* Top Filter and Search Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-gray-200/50 rounded-2xl custom-scrollbar">
          {[
            { id: 'all', label: `Tất cả (${elements.length})` },
            {
              id: 'core',
              label: `Cốt lõi (${elements.filter((e) => !specialTypes.includes(e.type) && !customTypes.includes(e.type)).length})`,
            },
            {
              id: 'special',
              label: `Đặc biệt (${elements.filter((e) => specialTypes.includes(e.type)).length})`,
            },
            {
              id: 'custom',
              label: `Tự tạo (${elements.filter((e) => customTypes.includes(e.type) || Boolean(e.specialProps?.subItems?.length)).length})`,
            },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilterCategory(cat.id as 'all' | 'core' | 'special' | 'custom')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                filterCategory === cat.id
                  ? 'bg-white text-zinc-950 shadow-xs border border-white'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onOpenCreateComposite}
          className="px-3.5 py-2 rounded-2xl bg-[#78C841] hover:bg-[#68B435] text-white text-xs font-extrabold shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Tạo Thành phần Mới (Biến & Hằng)</span>
        </button>
      </div>

      {/* Search Bar */}
      <div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Tìm kiếm thành phần theo tên..."
          className="w-full bg-white rounded-2xl px-3.5 py-2 text-xs text-zinc-800 placeholder-zinc-400 border border-zinc-200 outline-none focus:ring-2 focus:ring-[#78C841]/40"
        />
      </div>

      {/* Elements Grid List */}
      <div className="space-y-2">
        {filteredElements.map((el) => {
          const zone = zones.find((z) => z.id === el.zoneId);
          const Icon = ELEMENT_TYPE_ICONS[el.type] || FileText;
          const isCustom = el.type === 'custom-composite' || el.type === 'custom-field' || Boolean(el.specialProps?.subItems?.length);
          const isSpecial = specialTypes.includes(el.type);

          return (
            <div
              key={el.id}
              className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                el.visible
                  ? 'bg-white border-zinc-200/90 shadow-2xs'
                  : 'bg-zinc-100/80 border-dashed border-zinc-300 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                    isCustom
                      ? 'bg-purple-100 text-purple-700'
                      : isSpecial
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-xs text-zinc-900 truncate">
                      {el.name}
                    </span>
                    {isCustom && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[9px] font-black uppercase">
                        Biến & Hằng
                      </span>
                    )}
                    {isSpecial && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase">
                        Thành phần Nổi
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-500 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3 h-3 text-zinc-400" />
                      <span>{zone?.name || 'Vùng chính'}</span>
                    </span>
                    <span>&bull;</span>
                    <span className="font-mono text-[10px]">
                      {el.styling.fontFamily}, {el.styling.fontSize}pt
                    </span>
                    {el.specialProps?.subItems && (
                      <>
                        <span>&bull;</span>
                        <span className="text-purple-700 font-bold">
                          {el.specialProps.subItems.length} phần tử con
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {/* Toggle Visible */}
                <button
                  type="button"
                  onClick={() => onUpdateElement(el.id, { visible: !el.visible })}
                  className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                    el.visible
                      ? 'text-zinc-600 hover:bg-slate-100'
                      : 'text-zinc-400 hover:bg-slate-200'
                  }`}
                  title={el.visible ? 'Ẩn khỏi trang giấy' : 'Hiển thị lên trang giấy'}
                >
                  {el.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>

                {/* Duplicate */}
                <button
                  type="button"
                  onClick={() => onDuplicateElement(el)}
                  className="p-1.5 rounded-xl text-zinc-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Nhân bản thành phần này"
                >
                  <Copy className="w-4 h-4" />
                </button>

                {/* Delete (for custom elements or if more than 1) */}
                {isCustom && (
                  <button
                    type="button"
                    onClick={() => onDeleteElement(el.id)}
                    className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                    title="Xóa thành phần tự tạo này"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {filteredElements.length === 0 && (
          <div className="p-8 text-center bg-gray-100/60 rounded-3xl border border-dashed border-zinc-300 space-y-2">
            <Layers className="w-8 h-8 text-zinc-400 mx-auto" />
            <div className="text-xs font-bold text-zinc-600">
              Không tìm thấy thành phần nào phù hợp
            </div>
            <button
              type="button"
              onClick={onOpenCreateComposite}
              className="mt-2 px-3 py-1.5 rounded-xl bg-[#78C841] text-white text-xs font-bold"
            >
              Tạo thành phần mới ngay
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
