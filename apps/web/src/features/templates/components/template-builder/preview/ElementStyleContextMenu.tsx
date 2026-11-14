'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SemanticElement } from '@/types/template-builder';
import {
  elementToSciSpaceAttributes,
  applySciSpaceAttributesToElement,
} from '@/lib/template-engine/adapter';
import {
  SciSpaceElementAttributes,
  TypographyAttributes,
  SpacingAttributes,
  DecorationAttributes,
} from '@/types/template-engine/elements';
import {
  Type,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Columns,
  Square,
  Copy,
  Trash2,
  Settings,
  Edit3,
  X,
  Palette,
} from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';
import { Select, SelectOption } from '@/components/ui/Select';

export interface ElementStyleContextMenuProps {
  element: SemanticElement;
  position: { x: number; y: number };
  onClose: () => void;
  onUpdateElement: (id: string, updated: Partial<SemanticElement>) => void;
  onStartInlineEdit: (element: SemanticElement) => void;
  onDuplicateElement?: (id: string) => void;
  onDeleteElement?: (id: string) => void;
  onNavigateToStep?: (step: string) => void;
  primaryColor?: string;
}

const COMMON_FONT_OPTIONS: SelectOption[] = [
  { label: 'Times New Roman', value: "'Times New Roman', serif" },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Roboto', value: "'Roboto', sans-serif" },
  { label: 'Merriweather', value: "'Merriweather', serif" },
  { label: 'Courier New', value: "'Courier New', monospace" },
];

const PRESET_COLORS = [
  { label: 'Mặc định (Đen)', value: '#111827' },
  { label: 'Xanh ĐHQG', value: '#2B74B7' },
  { label: 'Xanh Lime', value: '#78C841' },
  { label: 'Đỏ mận', value: '#DC2626' },
  { label: 'Hổ phách', value: '#D97706' },
  { label: 'Xám đậm', value: '#475569' },
];

export const ElementStyleContextMenu: React.FC<ElementStyleContextMenuProps> = ({
  element,
  position,
  onClose,
  onUpdateElement,
  onStartInlineEdit,
  onDuplicateElement,
  onDeleteElement,
  onNavigateToStep,
  primaryColor = '#2B74B7',
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onClose]);

  if (!mounted) return null;

  // Extract current SciSpace attributes via standard adapter
  const attrs: SciSpaceElementAttributes = elementToSciSpaceAttributes(element, primaryColor);
  const typo = attrs.typography;
  const spacing = attrs.spacing;
  const decor = attrs.decorations;

  const updateAttrs = (updated: Partial<SciSpaceElementAttributes>) => {
    const next: SciSpaceElementAttributes = {
      ...attrs,
      ...updated,
    };
    const updatedElement = applySciSpaceAttributesToElement(element, next);
    onUpdateElement(element.id, updatedElement);
  };

  const updateTypo = (updated: Partial<TypographyAttributes>) => {
    updateAttrs({
      typography: { ...typo, ...updated },
    });
  };

  const updateSpacing = (updated: Partial<SpacingAttributes>) => {
    updateAttrs({
      spacing: { ...spacing, ...updated },
    });
  };

  const updateDecor = (updated: Partial<DecorationAttributes>) => {
    updateAttrs({
      decorations: { ...decor, ...updated },
    });
  };

  // Toggle Bold
  const isBold = typo.fontWeight === '700' || typo.fontWeight === '800' || typo.fontWeight === '900';
  const toggleBold = () => {
    updateTypo({ fontWeight: isBold ? '400' : '700' });
  };

  // Toggle Italic
  const isItalic = typo.fontStyle === 'italic';
  const toggleItalic = () => {
    updateTypo({ fontStyle: isItalic ? 'normal' : 'italic' });
  };

  // Toggle Underline
  const isUnderline = decor.borderBottom;
  const toggleUnderline = () => {
    updateDecor({
      borderBottom: !decor.borderBottom,
      borderStyle: !decor.borderBottom ? 'solid' : decor.borderStyle,
      borderWidthPt: !decor.borderBottom ? 1 : decor.borderWidthPt,
    });
  };

  // Font Size +/-
  const changeFontSize = (delta: number) => {
    const current = Number(typo.fontSizePt) || 10;
    const next = Math.max(6, Math.min(72, Math.round((current + delta) * 2) / 2));
    updateTypo({ fontSizePt: next });
  };

  // Position calculation clamped to viewport boundaries
  const menuWidth = 284;
  const menuHeight = 440;
  const left = Math.max(10, Math.min(position.x, window.innerWidth - menuWidth - 10));
  const top = Math.max(10, Math.min(position.y, window.innerHeight - menuHeight - 10));

  const isSpanAll = Boolean(element.spanColumns || attrs.layoutScope?.columnSpan === 'all');

  return createPortal(
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top,
        left,
        zIndex: 10000005,
      }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className="w-72 bg-white/98 backdrop-blur-xl border border-zinc-200/90 rounded-2xl shadow-2xl p-2 text-xs text-zinc-800 space-y-1.5 animate-fadeIn select-none"
    >
      {/* 1. Header: Element Name, Type badge, and Close Button */}
      <div className="flex items-center justify-between pb-1 px-1 border-b border-zinc-100">
        <div className="flex items-center gap-1.5 min-w-0">
          <Type className="w-3.5 h-3.5 text-[#78C841] shrink-0" />
          <span className="font-extrabold text-[11px] text-zinc-900 truncate max-w-[170px]">
            {element.name}
          </span>
          <span className="text-[9px] px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-600 font-mono font-bold shrink-0">
            {element.type}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-700 p-0.5 rounded-md hover:bg-zinc-100 transition-colors"
          title="Đóng bảng công cụ"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Word/Excel Quick Formatting Floating Toolbar */}
      <div className="bg-zinc-50/90 p-1.5 rounded-xl border border-zinc-200/70 space-y-1.5">
        {/* Row 1: Font Family Selector & Font Size Stepper */}
        <div className="flex items-center gap-1">
          <div className="flex-1 min-w-0">
            <Select
              options={COMMON_FONT_OPTIONS}
              value={typo.fontFamily || "'Times New Roman', serif"}
              onChange={(val) => updateTypo({ fontFamily: val })}
              size="xs"
              variant="clean"
              fullWidth
            />
          </div>

          {/* Font size - / + buttons */}
          <div className="flex items-center bg-white border border-zinc-300 rounded-lg overflow-hidden shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => changeFontSize(-0.5)}
              className="px-1.5 py-1 hover:bg-zinc-100 font-bold text-zinc-700 cursor-pointer transition-colors"
              title="Giảm cỡ chữ"
            >
              -
            </button>
            <span className="px-1 text-[10px] font-mono font-bold text-zinc-900 min-w-[28px] text-center select-none">
              {typo.fontSizePt || 10}
            </span>
            <button
              type="button"
              onClick={() => changeFontSize(0.5)}
              className="px-1.5 py-1 hover:bg-zinc-100 font-bold text-zinc-700 cursor-pointer transition-colors"
              title="Tăng cỡ chữ"
            >
              +
            </button>
          </div>
        </div>

        {/* Row 2: Bold, Italic, Underline, Color, and Text Alignment */}
        <div className="flex items-center justify-between gap-1 flex-wrap">
          {/* Style Toggles: B, I, U */}
          <div className="flex items-center bg-white border border-zinc-200/80 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={toggleBold}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors cursor-pointer ${
                isBold
                  ? 'bg-[#78C841] text-zinc-950 font-black shadow-xs'
                  : 'text-zinc-700 hover:bg-zinc-100 font-bold'
              }`}
              title="In đậm (Bold)"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleItalic}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors cursor-pointer ${
                isItalic
                  ? 'bg-[#78C841] text-zinc-950 font-black italic shadow-xs'
                  : 'text-zinc-700 hover:bg-zinc-100 italic'
              }`}
              title="In nghiêng (Italic)"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={toggleUnderline}
              className={`w-6 h-6 rounded flex items-center justify-center text-xs transition-colors cursor-pointer ${
                isUnderline
                  ? 'bg-[#78C841] text-zinc-950 font-black shadow-xs'
                  : 'text-zinc-700 hover:bg-zinc-100'
              }`}
              title="Gạch dưới chân (Underline)"
            >
              <Underline className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Color Swatch Picker */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="h-6 px-1.5 rounded-lg bg-white border border-zinc-200/80 flex items-center gap-1 shadow-2xs hover:bg-zinc-50 cursor-pointer"
              title="Màu chữ"
            >
              <div
                className="w-3 h-3 rounded-full border border-black/20"
                style={{ backgroundColor: typo.color || '#111827' }}
              />
              <Palette className="w-3 h-3 text-zinc-500" />
            </button>

            {showColorPicker && (
              <div className="absolute right-0 top-7 z-50 bg-white border border-zinc-200 rounded-xl p-2 shadow-xl flex items-center gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => {
                      updateTypo({ color: c.value });
                      setShowColorPicker(false);
                    }}
                    style={{ backgroundColor: c.value }}
                    className="w-5 h-5 rounded-full border-2 border-white shadow-xs hover:scale-110 transition-transform cursor-pointer"
                    title={c.label}
                  />
                ))}
                <input
                  type="color"
                  value={typo.color || '#111827'}
                  onChange={(e) => updateTypo({ color: e.target.value })}
                  className="w-5 h-5 rounded cursor-pointer border-0 p-0"
                  title="Chọn màu tự do"
                />
              </div>
            )}
          </div>

          {/* Text Alignment */}
          <div className="flex items-center bg-white border border-zinc-200/80 rounded-lg p-0.5 shadow-2xs">
            {[
              { id: 'left', icon: <AlignLeft className="w-3 h-3" />, title: 'Căn trái' },
              { id: 'center', icon: <AlignCenter className="w-3 h-3" />, title: 'Căn giữa' },
              { id: 'right', icon: <AlignRight className="w-3 h-3" />, title: 'Căn phải' },
              { id: 'justify', icon: <AlignJustify className="w-3 h-3" />, title: 'Căn đều' },
            ].map((al) => {
              const isActive = (spacing.textAlign || 'left') === al.id;
              return (
                <button
                  key={al.id}
                  type="button"
                  onClick={() => updateSpacing({ textAlign: al.id as any })}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#78C841] text-zinc-950 font-bold shadow-xs'
                      : 'text-zinc-600 hover:bg-zinc-100'
                  }`}
                  title={al.title}
                >
                  {al.icon}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Action Menu Items (Matching TableSpreadsheetModal Style) */}
      <div className="space-y-0.5 pt-0.5">
        {/* Double-Click Trigger / Direct Edit Text */}
        <button
          type="button"
          onClick={() => {
            onStartInlineEdit(element);
            onClose();
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-lime-50 hover:text-[#14532D] flex items-center gap-2 font-semibold text-left cursor-pointer transition-colors"
        >
          <Edit3 className="w-3.5 h-3.5 text-[#78C841]" />
          <span>Sửa văn bản trực tiếp (Kích đúp)</span>
        </button>

        {/* Quick Spacing (Margin Top / Bottom) */}
        <div className="px-2.5 py-1 rounded-xl bg-zinc-50 border border-zinc-100 flex items-center justify-between gap-1 text-[11px]">
          <span className="font-bold text-zinc-600">Lề dưới:</span>
          <div className="flex items-center gap-1">
            {[0, 3, 6, 12].map((pt) => {
              const active = (spacing.marginBottomPt ?? 4) === pt;
              return (
                <button
                  key={pt}
                  type="button"
                  onClick={() => updateSpacing({ marginBottomPt: pt })}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#78C841] text-zinc-950 shadow-2xs'
                      : 'bg-white text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {pt}pt
                </button>
              );
            })}
          </div>
        </div>

        {/* Column Span Toggle: 1 Column vs Span All */}
        <button
          type="button"
          onClick={() => {
            const nextSpan = !isSpanAll;
            updateAttrs({
              layoutScope: { ...attrs.layoutScope, columnSpan: nextSpan ? 'all' : 'single' },
            });
            onUpdateElement(element.id, { spanColumns: nextSpan });
            toast.success(
              'Phạm vi cột',
              nextSpan ? 'Đã bật tràn toàn trang (Span All)' : 'Đã đưa về hiển thị trong cột đơn'
            );
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center justify-between font-semibold text-left cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2">
            <Columns className="w-3.5 h-3.5 text-zinc-500" />
            <span>Phạm vi tràn cột</span>
          </div>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
              isSpanAll
                ? 'bg-[#78C841]/20 text-[#14532D] border border-[#78C841]/50'
                : 'bg-zinc-200 text-zinc-700'
            }`}
          >
            {isSpanAll ? 'Tràn toàn bộ (Span All)' : '1 Cột'}
          </span>
        </button>

        {/* Box Borders & Background Toggle */}
        <button
          type="button"
          onClick={() => {
            const hasBorder = decor.borderStyle && decor.borderStyle !== 'none';
            updateDecor({
              borderStyle: hasBorder ? 'none' : 'solid',
              borderWidthPt: hasBorder ? 0 : 0.75,
              borderColor: hasBorder ? 'transparent' : '#CBD5E1',
              backgroundColor: hasBorder ? 'transparent' : '#F8FAFC',
              borderRadiusPx: hasBorder ? 0 : 4,
            });
            toast.success('Viền & Nền', hasBorder ? 'Đã tắt viền nền' : 'Đã bật viền hộp học thuật');
          }}
          className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center justify-between font-semibold text-left cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-2">
            <Square className="w-3.5 h-3.5 text-zinc-500" />
            <span>Viền & Màu nền hộp</span>
          </div>
          <span className="text-[10px] text-zinc-400">
            {decor.borderStyle && decor.borderStyle !== 'none' ? 'Bật ✓' : 'Tắt'}
          </span>
        </button>

        {/* Go to Step 4 Deep Styling Studio */}
        {onNavigateToStep && (
          <button
            type="button"
            onClick={() => {
              onNavigateToStep('deep-styling');
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 font-semibold text-left cursor-pointer transition-colors text-zinc-700"
          >
            <Settings className="w-3.5 h-3.5 text-[#2B74B7]" />
            <span>Mở bảng Định dạng chuyên sâu (Step 4)</span>
          </button>
        )}
      </div>

      <div className="border-t border-zinc-200 my-1" />

      {/* 4. Secondary actions: Duplicate & Delete */}
      <div className="space-y-0.5">
        {onDuplicateElement && (
          <button
            type="button"
            onClick={() => {
              onDuplicateElement(element.id);
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-zinc-100 flex items-center gap-2 text-left cursor-pointer transition-colors text-zinc-700"
          >
            <Copy className="w-3.5 h-3.5 text-zinc-400" />
            <span>Nhân bản thành phần này</span>
          </button>
        )}

        {onDeleteElement && (
          <button
            type="button"
            onClick={() => {
              onDeleteElement(element.id);
              onClose();
            }}
            className="w-full px-2.5 py-1.5 rounded-xl hover:bg-red-50 hover:text-red-700 flex items-center gap-2 text-left cursor-pointer transition-colors text-red-600 font-semibold"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
            <span>Xóa thành phần này</span>
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};
