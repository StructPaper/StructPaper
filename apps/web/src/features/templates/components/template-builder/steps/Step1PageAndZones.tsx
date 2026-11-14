'use client';

import React, { useState } from 'react';
import {
  PageArchitectureConfig,
  LayoutZoneConfig,
  PageSize,
  PageNumberPosition,
  PageNumberFormat,
  ZoneLayoutType,
} from '@/types/template-builder';
import {
  Layout,
  FileText,
  Hash,
  Bookmark,
  Sparkles,
  Lock,
  LayoutGrid,
  ArrowRight,
} from 'lucide-react';
import { BUILT_IN_TEMPLATES } from '@/data/templates';
import { toast } from '@/components/DynamicIslandToast';
import { Select } from '@/components/ui/Select';
import { NumberInput } from '@/components/ui/NumberInput';

interface Step1PageAndZonesProps {
  pageConfig: PageArchitectureConfig;
  zones?: LayoutZoneConfig[];
  onPageChange: (updated: Partial<PageArchitectureConfig>) => void;
  onZonesChange?: (zones: LayoutZoneConfig[]) => void;
  primaryColor: string;
  templateName?: string;
  onNameChange?: (name: string) => void;
  currentPresetId?: string;
  onPresetSelect?: (presetId: string) => void;
  onNavigateToGridZones?: () => void;
}

export const Step1PageAndZones: React.FC<Step1PageAndZonesProps> = ({
  pageConfig,
  onPageChange,
  primaryColor,
  templateName = '',
  onNameChange,
  currentPresetId,
  onPresetSelect,
  onNavigateToGridZones,
}) => {
  const [activeHeaderTab, setActiveHeaderTab] = useState<'first' | 'odd' | 'even'>('first');

  const currentHeaderSlot =
    activeHeaderTab === 'first'
      ? pageConfig.headers.firstPage
      : activeHeaderTab === 'odd'
        ? pageConfig.headers.oddPages
        : pageConfig.headers.evenPages;

  const updateCurrentHeaderSlot = (updated: Partial<typeof currentHeaderSlot>) => {
    const key =
      activeHeaderTab === 'first'
        ? 'firstPage'
        : activeHeaderTab === 'odd'
          ? 'oddPages'
          : 'evenPages';
    onPageChange({
      headers: {
        ...pageConfig.headers,
        [key]: { ...pageConfig.headers[key], ...updated },
      },
    });
  };

  return (
    <div className="space-y-2.5">
      {/* Top Banner Header (matching Step 2 style) */}
      <div className="relative z-30 focus-within:z-40 p-2 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-700" />
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
              Cài đặt Khổ giấy & Bố cục chung
            </h3>
          </div>
        </div>
      </div>

      {/* 0. Thông tin cơ bản Template */}
      <div className="relative z-40 focus-within:z-50 bg-gray-200/50 rounded-[32px] p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/60">
          <Sparkles className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
            Thông tin cơ bản & Mẫu tham chiếu
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1.5">
              Tên Template (Hiển thị trong Thư viện):
            </label>
            <input
              type="text"
              value={templateName}
              onChange={(e) => onNameChange && onNameChange(e.target.value)}
              placeholder="Nhập tên template (VD: Tạp chí KH ĐHQG-HCM)..."
              className="w-full p-2.5 rounded-2xl text-xs font-bold text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs transition-all"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-zinc-600">
                Bộ mẫu Khởi đầu (Preset):
              </label>
              <span className="text-[10px] text-zinc-400 font-bold flex items-center gap-1">
                <Lock className="w-3 h-3 text-zinc-400" /> Cố định
              </span>
            </div>
            <div
              className="w-full p-2.5 rounded-2xl bg-zinc-100/80 border border-zinc-200 text-xs font-bold text-zinc-700 flex items-center justify-between select-none cursor-default shadow-2xs"
              title="Bộ mẫu này đã được chọn từ Thư viện trước khi vào trình thiết kế"
            >
              <span className="truncate">
                {BUILT_IN_TEMPLATES.find((p) => p.id === currentPresetId)?.name || templateName || 'Khung Thiết Kế Trống'}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white text-zinc-600 font-bold shrink-0 ml-2 shadow-2xs">
                Mẫu gốc
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 1. Khổ giấy & Lề trang */}
      <div className="relative z-30 focus-within:z-50 bg-gray-200/50 rounded-[32px] p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/60">
          <FileText className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
            Khổ giấy & Khoảng cách Lề in (mm)
          </h3>
        </div>

        {/* Khổ giấy & Hướng xoay */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Select
              label="Khổ giấy (Paper Size):"
              labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
              value={pageConfig.size}
              onChange={(val) => onPageChange({ size: val as PageSize })}
              variant="flat-white"
              size="sm"
              options={[
                { value: 'A4', label: 'A4 (210 × 297 mm)', description: 'Chuẩn học thuật phổ biến' },
                { value: 'A5', label: 'A5 (148 × 210 mm)', description: 'Khổ kỷ yếu & sách nhỏ' },
                { value: 'B5', label: 'B5 (176 × 250 mm)', description: 'Chuẩn tạp chí chuyên khảo' },
                { value: 'Letter', label: 'US Letter (215.9 × 279.4 mm)', description: 'Chuẩn xuất bản Bắc Mỹ & IEEE' },
                { value: 'Legal', label: 'US Legal (215.9 × 355.6 mm)', description: 'Khổ giấy dài' },
                { value: 'Executive', label: 'Executive (184.1 × 266.7 mm)', description: 'Khổ kỷ yếu tài liệu' },
                { value: 'Custom', label: 'Tùy chỉnh tự do (Custom mm)', description: 'Nhập kích thước riêng theo mm' },
              ]}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1.5">
              Hướng trang:
            </label>
            <div className="grid grid-cols-2 gap-1 bg-zinc-200/70 p-1 rounded-2xl select-none">
              <button
                type="button"
                onClick={() => onPageChange({ orientation: 'portrait' })}
                className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${pageConfig.orientation === 'portrait'
                  ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60 font-extrabold'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60'
                  }`}
              >
                Đứng (Portrait)
              </button>
              <button
                type="button"
                onClick={() => onPageChange({ orientation: 'landscape' })}
                className={`py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${pageConfig.orientation === 'landscape'
                  ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60 font-extrabold'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60'
                  }`}
              >
                Ngang (Landscape)
              </button>
            </div>
          </div>
        </div>

        {/* Tùy chỉnh kích thước khi chọn Custom */}
        {pageConfig.size === 'Custom' && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-100 animate-fadeIn">
            <div>
              <label className="block text-[11px] font-bold text-zinc-600 mb-1.5">
                Chiều rộng trang (Width mm):
              </label>
              <NumberInput
                min={80}
                max={1200}
                step={1}
                unit="mm"
                size="sm"
                variant="flat-white"
                value={pageConfig.customDimensions?.width || 210}
                onChange={(val) =>
                  onPageChange({
                    customDimensions: {
                      width: val,
                      height: pageConfig.customDimensions?.height || 297,
                    },
                  })
                }
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-zinc-600 mb-1.5">
                Chiều cao trang (Height mm):
              </label>
              <NumberInput
                min={80}
                max={1200}
                step={1}
                unit="mm"
                size="sm"
                variant="flat-white"
                value={pageConfig.customDimensions?.height || 297}
                onChange={(val) =>
                  onPageChange({
                    customDimensions: {
                      width: pageConfig.customDimensions?.width || 210,
                      height: val,
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {/* 4 Lề mm */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-zinc-100">
          {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
            <div key={side}>
              <label className="block text-[11px] font-bold text-zinc-600 mb-1.5 capitalize">
                Lề {side === 'top' ? 'Trên' : side === 'bottom' ? 'Dưới' : side === 'left' ? 'Trái' : 'Phải'}:
              </label>
              <NumberInput
                min={8}
                max={40}
                step={0.5}
                unit="mm"
                size="sm"
                variant="flat-white"
                value={pageConfig.margins[side]}
                onChange={(val) =>
                  onPageChange({
                    margins: {
                      ...pageConfig.margins,
                      [side]: val,
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Đánh số trang phức hợp (Page Numbering Engine) */}
      <div className="relative z-20 focus-within:z-50 bg-gray-200/50 rounded-[32px] p-5 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-200/60">
          <Hash className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
            Quy tắc Đánh số trang (Page Numbering)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Select
              label="Vị trí số trang:"
              labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
              value={pageConfig.pageNumbering.position}
              onChange={(val) =>
                onPageChange({
                  pageNumbering: {
                    ...pageConfig.pageNumbering,
                    position: val as PageNumberPosition,
                  },
                })
              }
              variant="flat-white"
              size="sm"
              options={[
                { value: 'bottom-center', label: 'Chính giữa cuối trang (Bottom Center)' },
                { value: 'bottom-right', label: 'Góc phải cuối trang (Bottom Right)' },
                { value: 'top-right', label: 'Góc phải đầu trang (Top Right)' },
                { value: 'margin-outer', label: 'Lệch góc ngoài trang chẵn/lẻ (Outer Margins)' },
                { value: 'none', label: 'Ẩn số trang hoàn toàn' },
              ]}
            />
          </div>

          <div>
            <Select
              label="Định dạng số trang:"
              labelClassName="text-[11px] font-bold text-zinc-600 mb-1.5"
              value={pageConfig.pageNumbering.format}
              onChange={(val) =>
                onPageChange({
                  pageNumbering: {
                    ...pageConfig.pageNumbering,
                    format: val as PageNumberFormat,
                  },
                })
              }
              variant="flat-white"
              size="sm"
              options={[
                { value: 'arabic', label: 'Số Ả Rập chuẩn (1, 2, 3...)' },
                { value: 'page-of-n', label: 'Trang X trên Y (Page 1 of 8)' },
                { value: 'roman-lower', label: 'Số La Mã thường (i, ii, iii...)' },
                { value: 'roman-upper', label: 'Số La Mã in hoa (I, II, III...)' },
              ]}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-zinc-100">
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1.5">
              Tiền tố số trang (Prefix text):
            </label>
            <input
              type="text"
              value={pageConfig.pageNumbering.prefixText}
              onChange={(e) =>
                onPageChange({
                  pageNumbering: {
                    ...pageConfig.pageNumbering,
                    prefixText: e.target.value,
                  },
                })
              }
              placeholder="Trang / Page "
              className="w-full p-2.5 rounded-2xl text-xs font-bold text-zinc-900 bg-white border-0 shadow-none focus:outline-none focus:ring-4 focus:ring-blue-200"
            />
          </div>

          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer pb-2">
              <input
                type="checkbox"
                checked={pageConfig.pageNumbering.suppressOnFirstPage}
                onChange={(e) =>
                  onPageChange({
                    pageNumbering: {
                      ...pageConfig.pageNumbering,
                      suppressOnFirstPage: e.target.checked,
                    },
                  })
                }
                className="w-4 h-4 rounded-md border-zinc-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Ẩn số trang ở trang nhất (Trang bìa/Front page)</span>
            </label>
          </div>
        </div>
      </div>

      {/* 3. Trình dựng Header & Footer Đa Dải (Running Headers/Footers) */}
      <div className="relative z-10 focus-within:z-50 bg-gray-200/50 rounded-[32px] p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-zinc-200/60">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-zinc-700" />
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
              Tiêu đề Đầu & Cuối trang (Header & Footer)
            </h3>
          </div>

          <div className="flex bg-zinc-200/70 p-1 rounded-2xl gap-1 select-none">
            <button
              type="button"
              onClick={() => setActiveHeaderTab('first')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeHeaderTab === 'first'
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60 font-extrabold'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60'
                }`}
            >
              Trang nhất
            </button>
            <button
              type="button"
              onClick={() => setActiveHeaderTab('odd')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeHeaderTab === 'odd'
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60 font-extrabold'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60'
                }`}
            >
              Trang lẻ
            </button>
            <button
              type="button"
              onClick={() => setActiveHeaderTab('even')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeHeaderTab === 'even'
                ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60 font-extrabold'
                : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60'
                }`}
            >
              Trang chẵn
            </button>
          </div>
        </div>

        {/* Dynamic variable chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-zinc-500 font-bold flex items-center gap-1 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Biến tự động:
          </span>
          {['{page_number}', '{journal_name}', '{paper_title}', '{doi}', '{issn}'].map((token) => (
            <button
              key={token}
              type="button"
              onClick={() =>
                updateCurrentHeaderSlot({
                  leftText: currentHeaderSlot.leftText + ` ${token}`,
                })
              }
              className="btn-pill-subtle text-[10px] py-0.5 px-2 text-zinc-700 bg-white hover:bg-zinc-100"
              title="Click để chèn vào Header Trái"
            >
              {token}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1.5">
              Nội dung góc Trái (Left slot):
            </label>
            <input
              type="text"
              value={currentHeaderSlot.leftText}
              onChange={(e) => updateCurrentHeaderSlot({ leftText: e.target.value })}
              className="w-full p-2.5 rounded-2xl text-xs font-bold text-zinc-900 bg-white border-0 shadow-none focus:outline-none focus:ring-4 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-600 mb-1.5">
              Nội dung góc Phải (Right slot):
            </label>
            <input
              type="text"
              value={currentHeaderSlot.rightText}
              onChange={(e) => updateCurrentHeaderSlot({ rightText: e.target.value })}
              className="w-full p-2.5 rounded-2xl text-xs font-bold text-zinc-900 bg-white border-0 shadow-none focus:outline-none focus:ring-4 focus:ring-blue-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-zinc-100">
          <label className="flex items-center gap-2 text-xs font-bold text-zinc-700 cursor-pointer">
            <input
              type="checkbox"
              checked={currentHeaderSlot.showDividerLine}
              onChange={(e) =>
                updateCurrentHeaderSlot({ showDividerLine: e.target.checked })
              }
              className="w-4 h-4 rounded-md border-zinc-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>Kẻ đường viền trang trí</span>
          </label>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-600">Màu kẻ:</span>
            <div className="flex items-center gap-2 bg-white rounded-xl px-2.5 py-1 border-0 shadow-none">
              <input
                type="color"
                value={currentHeaderSlot.dividerLineColor}
                onChange={(e) =>
                  updateCurrentHeaderSlot({ dividerLineColor: e.target.value })
                }
                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0"
              />
              <span className="text-xs font-mono font-bold text-zinc-800 uppercase">
                {currentHeaderSlot.dividerLineColor}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-zinc-600">Độ dày:</span>
            <div className="w-20">
              <NumberInput
                min={0.2}
                max={3}
                step={0.1}
                unit="pt"
                size="xs"
                variant="flat-white"
                value={currentHeaderSlot.dividerLineThickness}
                onChange={(val) =>
                  updateCurrentHeaderSlot({ dividerLineThickness: val })
                }
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
