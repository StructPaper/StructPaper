'use client';

import React, { useState } from 'react';
import {
  FloatingElementsDesignRules,
  DEFAULT_FLOATING_RULES,
} from '@/types/template-builder';
import {
  Sparkles,
  Table as TableIcon,
  Image as ImageIcon,
  Sigma,
  Link2,
  FileText,
  Info,
  Quote,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { NumberInput } from '@/components/ui/NumberInput';

interface StepSpecialElementsProps {
  floatingRules?: FloatingElementsDesignRules;
  onUpdateFloatingRules: (rules: FloatingElementsDesignRules) => void;
  primaryColor: string;
  onNavigateToPreview?: () => void;
  onNavigateToBack?: () => void;
  onNavigateForward?: () => void;
}

type SpecialCategory =
  | 'table'
  | 'figure'
  | 'equation'
  | 'citation'
  | 'linkDoi'
  | 'footnote';

export const StepSpecialElements: React.FC<StepSpecialElementsProps> = ({
  floatingRules,
  onUpdateFloatingRules,
  primaryColor,
  onNavigateToPreview,
  onNavigateToBack,
  onNavigateForward,
}) => {
  const currentRules: FloatingElementsDesignRules = {
    ...DEFAULT_FLOATING_RULES,
    ...(floatingRules || {}),
  };

  const [activeCategory, setActiveCategory] = useState<SpecialCategory>('table');

  const updateSubRule = <K extends keyof FloatingElementsDesignRules>(
    category: K,
    updated: Partial<FloatingElementsDesignRules[K]>
  ) => {
    const next: FloatingElementsDesignRules = {
      ...currentRules,
      [category]: {
        ...currentRules[category],
        ...updated,
      },
    };
    onUpdateFloatingRules(next);
  };

  const categories: {
    id: SpecialCategory;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    desc: string;
  }[] = [
      {
        id: 'table',
        label: 'Bảng biểu (Tables)',
        icon: TableIcon,
        desc: 'Booktabs, chú thích trên bảng, sọc zebra',
      },
      {
        id: 'figure',
        label: 'Hình ảnh (Figures)',
        icon: ImageIcon,
        desc: 'Chú thích dưới hình, 2 hình con song song',
      },
      {
        id: 'equation',
        label: 'Công thức Toán (Equations)',
        icon: Sigma,
        desc: 'Đánh số (1), căn giữa chuẩn LaTeX',
      },
      {
        id: 'citation',
        label: 'Trích dẫn & TLTK (Citations)',
        icon: Quote,
        desc: 'IEEE [1], APA 7th, thụt lề treo hanging indent',
      },
      {
        id: 'linkDoi',
        label: 'Liên kết DOI & QR Code',
        icon: Link2,
        desc: 'Định danh DOI, tạo mã QR cho bản in',
      },
      {
        id: 'footnote',
        label: 'Ghi chú Chân trang (Footnotes)',
        icon: FileText,
        desc: 'Đường kẻ phân cách, chỉ số 1, 2',
      },
    ];

  return (
    <div className="space-y-4 pb-8 select-none">
      {/* Top Banner Header */}
      <div className="relative z-30 focus-within:z-40 p-2 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-zinc-700" />
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
              Bước 5: Thành phần Nổi & Quy chuẩn Học thuật
            </h3>
          </div>
          <div className="text-xs font-mono font-bold text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-xl border border-zinc-200/80">
            Áp dụng mặc định cho toàn bộ Template
          </div>
        </div>
      </div>

      {/* Guidance Alert Banner */}
      <div className="p-3.5 rounded-2xl bg-lime-50/80 border border-lime-200/80 flex items-start gap-3 text-xs text-lime-950 shadow-2xs">
        <Info className="w-4 h-4 text-lime-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-extrabold text-xs text-lime-950">
            Nguyên lý Thành phần Nổi (Floating Elements) trong Xuất bản Khoa học:
          </span>
          <p className="text-[11px] text-lime-900/90 leading-relaxed">
            Các thành phần như Hình ảnh, Bảng biểu, Công thức Toán, Khối mã nguồn... xuất hiện bất chợt theo dòng nội dung của tác giả và không có vị trí cố định trên tờ giấy. Thiết lập tại bước này đóng vai trò là <strong>Bộ quy tắc thiết kế mẫu (Design System Blueprint)</strong> để tự động định dạng đồng nhất cho mọi thành phần khi bóc tách hoặc nhập nội dung vào template này.
          </p>
        </div>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1.5 bg-gray-200/50 rounded-2xl custom-scrollbar">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0 ${isActive
                ? 'bg-white text-zinc-950 shadow-xs border border-white'
                : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/60'
                }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#78C841]' : 'text-zinc-500'}`} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. TABLE DESIGN RULES */}
      {activeCategory === 'table' && (
        <div className="p-5 rounded-[32px] bg-gray-200/50 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
            <div className="flex items-center gap-2">
              <TableIcon className="w-4 h-4 text-zinc-700" />
              <h4 className="font-extrabold text-sm text-zinc-900">
                Quy chuẩn Bảng biểu Học thuật (Academic Table Rules)
              </h4>
            </div>
            <span className="text-[11px] text-zinc-500">IEEE / Nature / VNUHCM Booktabs</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 mb-1.5">
                Tiền tố chú thích (Caption Prefix)
              </label>
              <input
                type="text"
                value={currentRules.table.captionPrefix}
                onChange={(e) => updateSubRule('table', { captionPrefix: e.target.value })}
                placeholder="Bảng / Table"
                className="w-full bg-white border-0 shadow-none rounded-2xl px-3.5 py-2 text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-[#78C841]/30"
              />
            </div>

            <div>
              <Select
                label="Vị trí Chú thích (Caption Position)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.table.captionPosition}
                onChange={(val) =>
                  updateSubRule('table', { captionPosition: val as 'above' | 'below' })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'above', label: 'Trên bảng (Chuẩn học thuật bắt buộc)' },
                  { value: 'below', label: 'Dưới bảng' },
                ]}
              />
            </div>

            <div>
              <Select
                label="Quy chuẩn Đường kẻ (Borders Style)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.table.borderMode}
                onChange={(val) =>
                  updateSubRule('table', {
                    borderMode: val as 'booktabs' | 'grid' | 'clean',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'booktabs', label: 'Booktabs (3 đường kẻ ngang chuẩn quốc tế)' },
                  { value: 'grid', label: 'Lưới ô đầy đủ (Full Grid)' },
                  { value: 'clean', label: 'Tối giản không viền dọc (Clean)' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <NumberInput
                label="Cỡ chữ Chú thích bảng (pt)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.table.captionFontSize}
                onChange={(val) => updateSubRule('table', { captionFontSize: val })}
                min={7}
                max={12}
                step={0.5}
                unit="pt"
                variant="flat-white"
                size="sm"
              />
            </div>

            <div>
              <Select
                label="Font chữ Chú thích"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.table.captionFontFamily}
                onChange={(val) => updateSubRule('table', { captionFontFamily: val })}
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'Arial', label: 'Arial (Sans-serif)' },
                  { value: 'Times New Roman', label: 'Times New Roman (Serif)' },
                  { value: 'Minion Pro', label: 'Minion Pro' },
                  { value: 'Inter', label: 'Inter' },
                ]}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-600 mb-1.5">
                Màu nền tiêu đề bảng (Header Fill)
              </label>
              <div className="flex items-center gap-2.5 bg-white rounded-2xl px-3 py-1.5">
                <input
                  type="color"
                  value={currentRules.table.headerBackground || '#F8FAFC'}
                  onChange={(e) => updateSubRule('table', { headerBackground: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
                />
                <span className="text-xs font-mono font-bold text-zinc-800 uppercase">
                  {currentRules.table.headerBackground || '#F8FAFC'}
                </span>
              </div>
            </div>
          </div>

          {/* Deep Sub-element Design for Table: Constant Label, Caption Text, Cells */}
          <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs space-y-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <span>Định dạng sâu Chữ Hằng & Chú thích (Deep Caption Design)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <Select
                label="Độ đậm Nhãn Hằng (VD: Bảng 1)"
                value={currentRules.table.captionLabelWeight || 'bold'}
                onChange={(val) =>
                  updateSubRule('table', {
                    captionLabelWeight: val as 'bold' | 'normal' | 'semibold',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'bold', label: 'In đậm (Bold)' },
                  { value: 'semibold', label: 'Bán đậm (Semibold)' },
                  { value: 'normal', label: 'Bình thường (Normal)' },
                ]}
              />

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu Nhãn Hằng
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.table.captionLabelColor || '#0F172A'}
                    onChange={(e) => updateSubRule('table', { captionLabelColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.table.captionLabelColor || '#0F172A'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu chữ Chú thích
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.table.captionTextColor || '#334155'}
                    onChange={(e) => updateSubRule('table', { captionTextColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.table.captionTextColor || '#334155'}
                  </span>
                </div>
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentRules.table.captionTextItalic ?? true}
                    onChange={(e) =>
                      updateSubRule('table', { captionTextItalic: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
                  />
                  <span>In nghiêng nội dung chú thích (Italic)</span>
                </label>
              </div>
            </div>

            {/* Cell & Header styling */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-100">
              <NumberInput
                label="Cỡ chữ Dữ liệu ô (pt)"
                value={currentRules.table.dataFontSize || 7}
                onChange={(val) => updateSubRule('table', { dataFontSize: val })}
                min={6}
                max={10}
                step={0.5}
                unit="pt"
                variant="flat-white"
                size="sm"
              />

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu chữ Ô dữ liệu
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.table.dataTextColor || '#1E293B'}
                    onChange={(e) => updateSubRule('table', { dataTextColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.table.dataTextColor || '#1E293B'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu chữ Tiêu đề (Header)
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.table.headerTextColor || '#0F172A'}
                    onChange={(e) => updateSubRule('table', { headerTextColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.table.headerTextColor || '#0F172A'}
                  </span>
                </div>
              </div>

              <NumberInput
                label="Cỡ chữ Ghi chú bảng (pt)"
                value={currentRules.table.noteFontSize || 6.5}
                onChange={(val) => updateSubRule('table', { noteFontSize: val })}
                min={5.5}
                max={9}
                step={0.5}
                unit="pt"
                variant="flat-white"
                size="sm"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-200/60 flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={currentRules.table.zebraStriping}
                onChange={(e) => updateSubRule('table', { zebraStriping: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
              />
              <span>Bật kẻ sọc xen kẽ các hàng (Zebra Striping)</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={currentRules.table.defaultSpanColumns}
                onChange={(e) => updateSubRule('table', { defaultSpanColumns: e.target.checked })}
                className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
              />
              <span>Mặc định bảng rộng tràn 2 cột (Span across columns)</span>
            </label>
          </div>
        </div>
      )}

      {/* 2. FIGURE DESIGN RULES */}
      {activeCategory === 'figure' && (
        <div className="p-5 rounded-[32px] bg-gray-200/50 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
            <div className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-zinc-700" />
              <h4 className="font-extrabold text-sm text-zinc-900">
                Quy chuẩn Hình ảnh & Đồ thị (Academic Figure Rules)
              </h4>
            </div>
            <span className="text-[11px] text-zinc-500">IEEE / Nature Graphics Standard</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 mb-1.5">
                Tiền tố chú thích (Caption Prefix)
              </label>
              <input
                type="text"
                value={currentRules.figure.captionPrefix}
                onChange={(e) => updateSubRule('figure', { captionPrefix: e.target.value })}
                placeholder="Hình / Fig."
                className="w-full bg-white border-0 shadow-none rounded-2xl px-3.5 py-2 text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-[#78C841]/30"
              />
            </div>

            <div>
              <Select
                label="Vị trí Chú thích (Caption Position)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.figure.captionPosition}
                onChange={(val) =>
                  updateSubRule('figure', { captionPosition: val as 'above' | 'below' })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'below', label: 'Dưới hình (Chuẩn học thuật bắt buộc)' },
                  { value: 'above', label: 'Trên hình' },
                ]}
              />
            </div>

            <div>
              <Select
                label="Căn lề Hình ảnh (Alignment)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.figure.figureAlignment}
                onChange={(val) =>
                  updateSubRule('figure', {
                    figureAlignment: val as 'center' | 'left' | 'right',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'center', label: 'Căn giữa (Center)' },
                  { value: 'left', label: 'Căn trái (Left)' },
                  { value: 'right', label: 'Căn phải (Right)' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <NumberInput
                label="Cỡ chữ Chú thích hình (pt)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.figure.captionFontSize}
                onChange={(val) => updateSubRule('figure', { captionFontSize: val })}
                min={7}
                max={12}
                step={0.5}
                unit="pt"
                variant="flat-white"
                size="sm"
              />
            </div>

            <div>
              <Select
                label="Kiểu viền bao quanh hình (Border Style)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.figure.borderStyle}
                onChange={(val) =>
                  updateSubRule('figure', {
                    borderStyle: val as 'none' | 'subtle' | 'card',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'none', label: 'Không viền (Phù hợp ảnh vector)' },
                  { value: 'subtle', label: 'Viền mảnh (Subtle border)' },
                  { value: 'card', label: 'Khung thẻ bo góc (Card container)' },
                ]}
              />
            </div>
          </div>

          {/* Deep Sub-element Design for Figure: Constant Label, Caption Text, Source */}
          <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs space-y-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <span>Định dạng sâu Chữ Hằng & Chú thích Hình (Deep Caption Design)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <Select
                label="Độ đậm Nhãn Hằng (VD: Hình 1)"
                value={currentRules.figure.captionLabelWeight || 'bold'}
                onChange={(val) =>
                  updateSubRule('figure', {
                    captionLabelWeight: val as 'bold' | 'normal' | 'semibold',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'bold', label: 'In đậm (Bold)' },
                  { value: 'semibold', label: 'Bán đậm (Semibold)' },
                  { value: 'normal', label: 'Bình thường (Normal)' },
                ]}
              />

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu Nhãn Hằng
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.figure.captionLabelColor || '#0F172A'}
                    onChange={(e) => updateSubRule('figure', { captionLabelColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.figure.captionLabelColor || '#0F172A'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu chữ Chú thích
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.figure.captionTextColor || '#334155'}
                    onChange={(e) => updateSubRule('figure', { captionTextColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.figure.captionTextColor || '#334155'}
                  </span>
                </div>
              </div>

              <div className="flex items-center pt-4">
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentRules.figure.captionTextItalic ?? true}
                    onChange={(e) =>
                      updateSubRule('figure', { captionTextItalic: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
                  />
                  <span>In nghiêng chú thích (Italic)</span>
                </label>
              </div>
            </div>

            {/* Source text styling */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-zinc-100">
              <NumberInput
                label="Cỡ chữ Dòng Nguồn ảnh (pt)"
                value={currentRules.figure.sourceFontSize || 6.5}
                onChange={(val) => updateSubRule('figure', { sourceFontSize: val })}
                min={5.5}
                max={9}
                step={0.5}
                unit="pt"
                variant="flat-white"
                size="sm"
              />

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu chữ Dòng Nguồn ảnh
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.figure.sourceTextColor || '#64748B'}
                    onChange={(e) => updateSubRule('figure', { sourceTextColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.figure.sourceTextColor || '#64748B'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-200/60 flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={currentRules.figure.showSubfiguresSupport}
                onChange={(e) =>
                  updateSubRule('figure', { showSubfiguresSupport: e.target.checked })
                }
                className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
              />
              <span>Hỗ trợ chia đôi 2 hình con song song (Subfigures a & b)</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={currentRules.figure.defaultSpanColumns}
                onChange={(e) =>
                  updateSubRule('figure', { defaultSpanColumns: e.target.checked })
                }
                className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
              />
              <span>Mặc định hình rộng tràn ngang 2 cột (Span Columns)</span>
            </label>
          </div>
        </div>
      )}

      {/* 3. EQUATION DESIGN RULES */}
      {activeCategory === 'equation' && (
        <div className="p-5 rounded-[32px] bg-gray-200/50 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
            <div className="flex items-center gap-2">
              <Sigma className="w-4 h-4 text-zinc-700" />
              <h4 className="font-extrabold text-sm text-zinc-900">
                Quy chuẩn Công thức Toán học (Math Equation Rules)
              </h4>
            </div>
            <span className="text-[11px] text-zinc-500">LaTeX / MathML Standards</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Select
                label="Định dạng Đánh số công thức"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.equation.numberingFormat}
                onChange={(val) =>
                  updateSubRule('equation', {
                    numberingFormat: val as '(1)' | '[1]' | '(1.1)' | 'none',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: '(1)', label: '(1) - Số trong ngoặc đơn (Chuẩn IEEE)' },
                  { value: '(1.1)', label: '(1.1) - Phân cấp theo chương/mục' },
                  { value: '[1]', label: '[1] - Số trong ngoặc vuông' },
                  { value: 'none', label: 'Không đánh số' },
                ]}
              />
            </div>

            <div>
              <Select
                label="Căn lề Công thức"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.equation.alignment}
                onChange={(val) =>
                  updateSubRule('equation', {
                    alignment: val as 'center' | 'left',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'center', label: 'Căn giữa (Công thức ở giữa, số sát lề phải)' },
                  { value: 'left', label: 'Căn trái (Thụt lề chuẩn)' },
                ]}
              />
            </div>

            <div>
              <NumberInput
                label="Cỡ chữ Công thức (pt)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.equation.fontSize}
                onChange={(val) => updateSubRule('equation', { fontSize: val })}
                min={8}
                max={14}
                step={0.5}
                unit="pt"
                variant="flat-white"
                size="sm"
              />
            </div>
          </div>

          {/* Deep Styling for Equation Numbering */}
          <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs space-y-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <span>Định dạng Chỉ số Đánh số Công thức (Equation Number Design)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Select
                label="Độ đậm Chỉ số (VD: (1))"
                value={currentRules.equation.numberWeight || 'bold'}
                onChange={(val) =>
                  updateSubRule('equation', {
                    numberWeight: val as 'bold' | 'normal',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'bold', label: 'In đậm (Bold)' },
                  { value: 'normal', label: 'Bình thường (Normal)' },
                ]}
              />

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu Chỉ số Đánh số
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.equation.numberColor || '#334155'}
                    onChange={(e) => updateSubRule('equation', { numberColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.equation.numberColor || '#334155'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. CITATION & BIBLIOGRAPHY RULES */}
      {activeCategory === 'citation' && (
        <div className="p-5 rounded-[32px] bg-gray-200/50 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
            <div className="flex items-center gap-2">
              <Quote className="w-4 h-4 text-zinc-700" />
              <h4 className="font-extrabold text-sm text-zinc-900">
                Quy chuẩn Trích dẫn & Danh mục Tài liệu tham khảo (Citations & References)
              </h4>
            </div>
            <span className="text-[11px] text-zinc-500">IEEE, APA 7th, Nature, Vancouver</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label="Phong cách Trích dẫn (Citation Standard)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.citation.citationStyle}
                onChange={(val) => {
                  const style = val as 'ieee' | 'apa' | 'nature' | 'harvard' | 'vancouver';
                  const inText =
                    style === 'apa' || style === 'harvard'
                      ? 'author-year'
                      : style === 'nature'
                        ? 'superscript'
                        : 'brackets-number';
                  const sort = style === 'apa' || style === 'harvard' ? 'alphabetical' : 'appearance';
                  updateSubRule('citation', {
                    citationStyle: style,
                    inTextFormat: inText,
                    sortOrder: sort,
                  });
                }}
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'ieee', label: 'IEEE [1], [2] - Đánh số theo thứ tự xuất hiện (Kỹ thuật/CNTT)' },
                  { value: 'apa', label: 'APA 7th (Tác giả, Năm) - Sắp xếp A-Z (Khoa học Xã hội & Y tế)' },
                  { value: 'nature', label: 'Nature - Số mũ trên ¹, ² (Tự nhiên / Đa ngành)' },
                  { value: 'harvard', label: 'Harvard (Tác giả, Năm) - Phong cách tác giả' },
                  { value: 'vancouver', label: 'Vancouver (1) - Đánh số tuần tự y sinh học' },
                ]}
              />
            </div>

            <div>
              <Select
                label="Định dạng Trích dẫn trong bài (In-text format)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.citation.inTextFormat}
                onChange={(val) =>
                  updateSubRule('citation', {
                    inTextFormat: val as 'brackets-number' | 'superscript' | 'author-year',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'brackets-number', label: 'Ngoặc vuông số: [1], [2-4]' },
                  { value: 'superscript', label: 'Chỉ số mũ trên: ¹, ², ³' },
                  { value: 'author-year', label: 'Tác giả - Năm: (Nguyen et al., 2025)' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label="Thứ tự Sắp xếp Danh mục TLTK (Bibliography Sort)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.citation.sortOrder}
                onChange={(val) =>
                  updateSubRule('citation', {
                    sortOrder: val as 'appearance' | 'alphabetical',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'appearance', label: 'Theo thứ tự trích dẫn trong văn bản (Appearance)' },
                  { value: 'alphabetical', label: 'Theo bảng chữ cái tên tác giả A-Z (Alphabetical)' },
                ]}
              />
            </div>

            <div>
              <Select
                label="Font chữ Danh mục TLTK"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.citation.fontFamily}
                onChange={(val) => updateSubRule('citation', { fontFamily: val })}
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'Times New Roman', label: 'Times New Roman (Chuẩn VNUHCM)' },
                  { value: 'Arial', label: 'Arial (Không chân hiện đại)' },
                  { value: 'Roboto', label: 'Roboto' },
                  { value: 'Latin Modern Roman', label: 'Latin Modern Roman (LaTeX)' },
                ]}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <NumberInput
                label="Cỡ chữ Danh mục TLTK (pt)"
                value={currentRules.citation.fontSize}
                onChange={(val) => updateSubRule('citation', { fontSize: val })}
                min={6.5}
                max={11}
                step={0.5}
                unit="pt"
                variant="flat-white"
                size="sm"
              />
            </div>

            <div>
              <NumberInput
                label="Thụt lề treo dòng 2 (Hanging indent)"
                value={currentRules.citation.hangingIndent}
                onChange={(val) => updateSubRule('citation', { hangingIndent: val })}
                min={0}
                max={15}
                step={1}
                unit="mm"
                variant="flat-white"
                size="sm"
              />
            </div>

            <div>
              <NumberInput
                label="Tối đa tác giả trước khi dùng 'et al.'"
                value={currentRules.citation.maxAuthorsBeforeEtAl}
                onChange={(val) => updateSubRule('citation', { maxAuthorsBeforeEtAl: val })}
                min={1}
                max={10}
                step={1}
                variant="flat-white"
                size="sm"
              />
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={currentRules.citation.showDoiInBibliography}
                onChange={(e) =>
                  updateSubRule('citation', { showDoiInBibliography: e.target.checked })
                }
                className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
              />
              <span>Tự động đính kèm liên kết định danh DOI (https://doi.org/...) ở cuối mục trích dẫn</span>
            </label>
          </div>

          {/* Deep Sub-element Design for Citations & References */}
          <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs space-y-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <span>Định dạng Sâu Chỉ số Trích dẫn Trong Bài & Danh mục TLTK</span>
            </div>

            {/* In-text citation tag styling */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="text-[11px] font-bold text-zinc-700">1. Số trích dẫn trong văn bản (In-text Tag: [1], ¹,...)</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                    Màu số trích dẫn trong bài
                  </label>
                  <div className="flex items-center gap-2 bg-white rounded-xl px-2 py-1 border border-zinc-200">
                    <input
                      type="color"
                      value={currentRules.citation.inTextColor || '#2563EB'}
                      onChange={(e) => updateSubRule('citation', { inTextColor: e.target.value })}
                      className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                      {currentRules.citation.inTextColor || '#2563EB'}
                    </span>
                  </div>
                </div>

                <Select
                  label="Độ đậm số trích dẫn trong bài"
                  value={currentRules.citation.inTextWeight || 'bold'}
                  onChange={(val) =>
                    updateSubRule('citation', {
                      inTextWeight: val as 'bold' | 'normal',
                    })
                  }
                  variant="flat-white"
                  size="sm"
                  options={[
                    { value: 'bold', label: 'In đậm (Bold)' },
                    { value: 'normal', label: 'Bình thường (Normal)' },
                  ]}
                />

                <div className="flex items-center pt-4">
                  <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentRules.citation.inTextPill ?? false}
                      onChange={(e) =>
                        updateSubRule('citation', { inTextPill: e.target.checked })
                      }
                      className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
                    />
                    <span>Dạng huy hiệu nhẹ (Pill Badge)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Bibliography list styling */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="text-[11px] font-bold text-zinc-700">2. Mục tương ứng trong Danh mục Tài liệu tham khảo</div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <Select
                  label="Độ đậm Số thứ tự [1]"
                  value={currentRules.citation.refLabelWeight || 'bold'}
                  onChange={(val) =>
                    updateSubRule('citation', {
                      refLabelWeight: val as 'bold' | 'normal',
                    })
                  }
                  variant="flat-white"
                  size="sm"
                  options={[
                    { value: 'bold', label: 'In đậm (Bold)' },
                    { value: 'normal', label: 'Bình thường (Normal)' },
                  ]}
                />

                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                    Màu Số thứ tự [1]
                  </label>
                  <div className="flex items-center gap-2 bg-white rounded-xl px-2 py-1 border border-zinc-200">
                    <input
                      type="color"
                      value={currentRules.citation.refLabelColor || '#0F172A'}
                      onChange={(e) => updateSubRule('citation', { refLabelColor: e.target.value })}
                      className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                      {currentRules.citation.refLabelColor || '#0F172A'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                    Màu chữ Nội dung TLTK
                  </label>
                  <div className="flex items-center gap-2 bg-white rounded-xl px-2 py-1 border border-zinc-200">
                    <input
                      type="color"
                      value={currentRules.citation.refTextColor || '#334155'}
                      onChange={(e) => updateSubRule('citation', { refTextColor: e.target.value })}
                      className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                      {currentRules.citation.refTextColor || '#334155'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                    Màu liên kết DOI
                  </label>
                  <div className="flex items-center gap-2 bg-white rounded-xl px-2 py-1 border border-zinc-200">
                    <input
                      type="color"
                      value={currentRules.citation.doiColor || '#2563EB'}
                      onChange={(e) => updateSubRule('citation', { doiColor: e.target.value })}
                      className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                    <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                      {currentRules.citation.doiColor || '#2563EB'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={currentRules.citation.doiUnderline ?? false}
                    onChange={(e) =>
                      updateSubRule('citation', { doiUnderline: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
                  />
                  <span>Gạch chân đường link DOI</span>
                </label>
              </div>
            </div>
          </div>

          {/* Interactive Live Sample Box */}
          <div className="mt-3 p-3.5 rounded-2xl bg-white border border-zinc-200 shadow-2xs space-y-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Minh họa Trích dẫn mẫu theo quy chuẩn đang chọn:
            </div>

            {/* In-text example */}
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800 leading-relaxed font-serif">
              <span className="font-sans text-[10px] font-bold text-slate-500 block mb-1">
                1. Mẫu trích dẫn trong văn bản (In-text citation):
              </span>
              Theo các nghiên cứu bóc tách văn bản học thuật gần đây
              {currentRules.citation.inTextFormat === 'brackets-number' && (
                <span
                  className={`font-sans mx-1 ${
                    currentRules.citation.inTextWeight === 'normal' ? 'font-normal' : 'font-bold'
                  } ${
                    currentRules.citation.inTextPill
                      ? 'bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200'
                      : ''
                  }`}
                  style={{ color: currentRules.citation.inTextColor || '#2563EB' }}
                >
                  [1]
                </span>
              )}
              {currentRules.citation.inTextFormat === 'superscript' && (
                <sup
                  className={`mx-0.5 ${
                    currentRules.citation.inTextWeight === 'normal' ? 'font-normal' : 'font-bold'
                  }`}
                  style={{ color: currentRules.citation.inTextColor || '#2563EB' }}
                >
                  ¹
                </sup>
              )}
              {currentRules.citation.inTextFormat === 'author-year' && (
                <span
                  className={`font-sans mx-1 ${
                    currentRules.citation.inTextWeight === 'normal' ? 'font-normal' : 'font-bold'
                  } ${
                    currentRules.citation.inTextPill
                      ? 'bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200'
                      : ''
                  }`}
                  style={{ color: currentRules.citation.inTextColor || '#2563EB' }}
                >
                  (Nguyen et al., 2025)
                </span>
              )}
              , việc ứng dụng học máy đa phương thức đem lại độ chính xác phân đoạn cấu trúc trang đạt trên 98%
              {currentRules.citation.inTextFormat === 'brackets-number' && (
                <span
                  className={`font-sans mx-1 ${
                    currentRules.citation.inTextWeight === 'normal' ? 'font-normal' : 'font-bold'
                  } ${
                    currentRules.citation.inTextPill
                      ? 'bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200'
                      : ''
                  }`}
                  style={{ color: currentRules.citation.inTextColor || '#2563EB' }}
                >
                  [2, 3]
                </span>
              )}
              {currentRules.citation.inTextFormat === 'superscript' && (
                <sup
                  className={`mx-0.5 ${
                    currentRules.citation.inTextWeight === 'normal' ? 'font-normal' : 'font-bold'
                  }`}
                  style={{ color: currentRules.citation.inTextColor || '#2563EB' }}
                >
                  ²,³
                </sup>
              )}
              {currentRules.citation.inTextFormat === 'author-year' && (
                <span
                  className={`font-sans mx-1 ${
                    currentRules.citation.inTextWeight === 'normal' ? 'font-normal' : 'font-bold'
                  } ${
                    currentRules.citation.inTextPill
                      ? 'bg-blue-50/80 px-1.5 py-0.5 rounded border border-blue-200'
                      : ''
                  }`}
                  style={{ color: currentRules.citation.inTextColor || '#2563EB' }}
                >
                  (Tran & Le, 2024)
                </span>
              )}
              .
            </div>

            {/* Bibliography list example */}
            <div
              className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-slate-800"
              style={{
                fontFamily: currentRules.citation.fontFamily,
                fontSize: `${currentRules.citation.fontSize}pt`,
              }}
            >
              <div className="font-sans text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                2. Mẫu danh mục Tài liệu tham khảo (References):
              </div>

              {/* Item 1 */}
              <div
                style={{
                  paddingLeft: `${currentRules.citation.hangingIndent * 2}px`,
                  textIndent: `-${currentRules.citation.hangingIndent * 2}px`,
                  color: currentRules.citation.refTextColor || '#334155',
                }}
              >
                {currentRules.citation.citationStyle === 'apa' || currentRules.citation.citationStyle === 'harvard' ? (
                  <span>
                    Nguyen, H. N., Tran, M. T., & Le, V. K. (2025). Automated Academic Typesetting from DOCX Documents. <em>Science & Technology Development Journal</em>, 28(2), 112–124.
                  </span>
                ) : (
                  <span>
                    <span
                      style={{
                        fontWeight: currentRules.citation.refLabelWeight === 'normal' ? 400 : 700,
                        color: currentRules.citation.refLabelColor || '#0F172A',
                      }}
                    >
                      {currentRules.citation.inTextFormat === 'superscript' ? '1. ' : '[1] '}
                    </span>
                    Nguyen, H. N., Tran, M. T., & Le, V. K. &ldquo;Automated Academic Typesetting from DOCX Documents,&rdquo; <em>Sci. Tech. Dev. J.</em>, vol. 28, no. 2, pp. 112–124, 2025.
                  </span>
                )}
                {currentRules.citation.showDoiInBibliography && (
                  <span
                    className={`ml-1 font-mono text-[7pt] ${
                      currentRules.citation.doiUnderline ? 'underline' : 'no-underline'
                    }`}
                    style={{ color: currentRules.citation.doiColor || '#2563EB' }}
                  >
                    https://doi.org/10.32508/stdj.v28i2.1234
                  </span>
                )}
              </div>

              {/* Item 2 */}
              <div
                style={{
                  paddingLeft: `${currentRules.citation.hangingIndent * 2}px`,
                  textIndent: `-${currentRules.citation.hangingIndent * 2}px`,
                  color: currentRules.citation.refTextColor || '#334155',
                }}
              >
                {currentRules.citation.citationStyle === 'apa' || currentRules.citation.citationStyle === 'harvard' ? (
                  <span>
                    VNU-HCM Publishing House. (2024). <em>Guidelines for Scientific Paper Formatting and Standard Citation Rules</em>. VNUHCM Press.
                  </span>
                ) : (
                  <span>
                    <span
                      style={{
                        fontWeight: currentRules.citation.refLabelWeight === 'normal' ? 400 : 700,
                        color: currentRules.citation.refLabelColor || '#0F172A',
                      }}
                    >
                      {currentRules.citation.inTextFormat === 'superscript' ? '2. ' : '[2] '}
                    </span>
                    VNU-HCM Publishing House, <em>Guidelines for Scientific Paper Formatting and Standard Citation Rules</em>, VNUHCM Press, Ho Chi Minh City, 2024.
                  </span>
                )}
                {currentRules.citation.showDoiInBibliography && (
                  <span
                    className={`ml-1 font-mono text-[7pt] ${
                      currentRules.citation.doiUnderline ? 'underline' : 'no-underline'
                    }`}
                    style={{ color: currentRules.citation.doiColor || '#2563EB' }}
                  >
                    https://doi.org/10.32508/vnuhcm.guide.2024
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. LINK & DOI RULES */}
      {activeCategory === 'linkDoi' && (
        <div className="p-5 rounded-[32px] bg-gray-200/50 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-zinc-700" />
              <h4 className="font-extrabold text-sm text-zinc-900">
                Quy chuẩn Liên kết DOI & Kho Dữ liệu Mở (Links & Open Access)
              </h4>
            </div>
            <span className="text-[11px] text-zinc-500">Crossref DOI & QR Code Print</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label="Kiểu dáng hiển thị Liên kết"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.linkDoi.displayStyle}
                onChange={(val) =>
                  updateSubRule('linkDoi', {
                    displayStyle: val as 'pill' | 'inline' | 'card',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'pill', label: 'Thẻ con nhộng (Pill Badge nổi bật)' },
                  { value: 'card', label: 'Khung thẻ đầy đủ (Card container)' },
                  { value: 'inline', label: 'Văn bản tối giản kèm icon liên kết ngoài' },
                ]}
              />
            </div>

            <div className="flex flex-col justify-center space-y-2 pt-2">
              <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentRules.linkDoi.showQrCodeOnPrint}
                  onChange={(e) =>
                    updateSubRule('linkDoi', { showQrCodeOnPrint: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
                />
                <span>Tự động đính kèm mã QR Code cho ấn bản in/PDF</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentRules.linkDoi.showDoiPrefix}
                  onChange={(e) =>
                    updateSubRule('linkDoi', { showDoiPrefix: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
                />
                <span>Hiển thị tiền tố &quot;https://doi.org/&quot; đầy đủ</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* 6. FOOTNOTE RULES */}
      {activeCategory === 'footnote' && (
        <div className="p-5 rounded-[32px] bg-gray-200/50 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-zinc-700" />
              <h4 className="font-extrabold text-sm text-zinc-900">
                Quy chuẩn Ghi chú Chân trang (Footnote Rules)
              </h4>
            </div>
            <span className="text-[11px] text-zinc-500">Separation Rule & Numbering</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Select
                label="Định dạng Chỉ số chân trang"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.footnote.numberingStyle}
                onChange={(val) =>
                  updateSubRule('footnote', {
                    numberingStyle: val as 'arabic' | 'asterisk' | 'roman',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'arabic', label: '1, 2, 3 - Số Ả Rập' },
                  { value: 'asterisk', label: '*, **, † - Dấu hoa thị / Biểu tượng' },
                  { value: 'roman', label: 'i, ii, iii - Số La Mã thường' },
                ]}
              />
            </div>

            <div>
              <NumberInput
                label="Cỡ chữ Ghi chú chân trang (pt)"
                labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
                value={currentRules.footnote.fontSize}
                onChange={(val) => updateSubRule('footnote', { fontSize: val })}
                min={6.5}
                max={9.5}
                step={0.5}
                unit="pt"
                variant="flat-white"
                size="sm"
              />
            </div>
          </div>

          {/* Deep Sub-element Design for Footnote */}
          <div className="p-3.5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs space-y-3">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
              <span>Định dạng Sâu Chỉ số & Đường kẻ Phân cách Chân trang</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
              <Select
                label="Độ đậm Chỉ số (1, *)"
                value={currentRules.footnote.numWeight || 'bold'}
                onChange={(val) =>
                  updateSubRule('footnote', {
                    numWeight: val as 'bold' | 'normal',
                  })
                }
                variant="flat-white"
                size="sm"
                options={[
                  { value: 'bold', label: 'In đậm (Bold)' },
                  { value: 'normal', label: 'Bình thường (Normal)' },
                ]}
              />

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu Chỉ số chân trang
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.footnote.numColor || '#0F172A'}
                    onChange={(e) => updateSubRule('footnote', { numColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.footnote.numColor || '#0F172A'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu chữ Ghi chú
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.footnote.noteTextColor || '#334155'}
                    onChange={(e) => updateSubRule('footnote', { noteTextColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.footnote.noteTextColor || '#334155'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                  Màu Đường gạch ngang
                </label>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                  <input
                    type="color"
                    value={currentRules.footnote.ruleColor || '#94A3B8'}
                    onChange={(e) => updateSubRule('footnote', { ruleColor: e.target.value })}
                    className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                    {currentRules.footnote.ruleColor || '#94A3B8'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-zinc-200/60">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-800 cursor-pointer">
              <input
                type="checkbox"
                checked={currentRules.footnote.showSeparatorRule}
                onChange={(e) =>
                  updateSubRule('footnote', { showSeparatorRule: e.target.checked })
                }
                className="w-4 h-4 rounded border-zinc-300 text-[#78C841] focus:ring-[#78C841]"
              />
              <span>Hiển thị đường gạch ngang phân cách chân trang (Separator Rule)</span>
            </label>
          </div>
        </div>
      )}

    </div>
  );
};
