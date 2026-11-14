'use client';

import React from 'react';
import { TemplateBuilderCategory } from '@/types/template-builder';
import {
  Layout,
  Type,
  BoxSelect,
  Heading,
  Baseline,
  Image,
  BookOpen,
} from 'lucide-react';

interface ElementSidebarNavProps {
  activeCategory: TemplateBuilderCategory;
  onSelectCategory: (cat: TemplateBuilderCategory) => void;
}

const CATEGORIES: {
  id: TemplateBuilderCategory;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'page',
    label: 'Khổ giấy & Bố cục',
    sub: 'Lề, chia cột & bố cục trang đầu',
    icon: Layout,
  },
  {
    id: 'title',
    label: 'Tiêu đề & Tác giả',
    sub: 'Font chữ, căn lề, song ngữ & đvct',
    icon: Type,
  },
  {
    id: 'abstract',
    label: 'Tóm tắt & Từ khoá',
    sub: 'Khung viền, màu nền & từ khoá',
    icon: BoxSelect,
  },
  {
    id: 'headings',
    label: 'Định dạng Tiêu đề',
    sub: 'H1, H2, H3, La Mã & thanh nhấn',
    icon: Heading,
  },
  {
    id: 'body',
    label: 'Kiểu chữ Thân bài',
    sub: 'Font, cỡ chữ, dãn dòng & thụt lề',
    icon: Baseline,
  },
  {
    id: 'floats',
    label: 'Hình ảnh & Bảng biểu',
    sub: 'Chú thích caption & kẻ sọc bảng',
    icon: Image,
  },
  {
    id: 'references',
    label: 'Tài liệu tham khảo',
    sub: 'Vancouver, IEEE, APA & thụt lề treo',
    icon: BookOpen,
  },
];

export const ElementSidebarNav: React.FC<ElementSidebarNavProps> = ({
  activeCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex flex-col gap-1.5 p-1.5 bg-slate-100/80 backdrop-blur-md rounded-2xl border border-black/5">
      {CATEGORIES.map((cat) => {
        const Icon = cat.icon;
        const isActive = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-3 p-2.5 rounded-xl text-left transition-all relative ${
              isActive
                ? 'bg-white text-slate-900 shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                isActive ? 'bg-[#78C841] text-white shadow-xs' : 'bg-slate-200/60 text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4 stroke-[2.2]" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-xs truncate">{cat.label}</div>
              <div className="text-[10px] text-slate-400 font-normal truncate">{cat.sub}</div>
            </div>

            {isActive && (
              <div className="w-1.5 h-1.5 rounded-full bg-[#78C841] shrink-0 mr-1" />
            )}
          </button>
        );
      })}
    </div>
  );
};
