'use client';

import React, { useState } from 'react';
import {
  StandardSemanticElementType,
  SciSpaceElementAttributes,
  SEMANTIC_ELEMENTS_CATALOG,
} from '@/types/template-engine/elements';
import { SemanticElement } from '@/types/template-builder';
import {
  elementToSciSpaceAttributes,
  applySciSpaceAttributesToElement,
  mapElementTypeToSemanticType,
} from '@/lib/template-engine/adapter';
import { DEFAULT_ELEMENT_ATTRIBUTES } from '@/lib/template-engine/default-attributes';
import { resolveElementCssStyle } from '@/lib/template-engine/css-style-resolver';
import { TypographyEditor } from './TypographyEditor';
import { SpacingAlignmentEditor } from './SpacingAlignmentEditor';
import { LayoutScopeEditor } from './LayoutScopeEditor';
import { DecorationEditor } from './DecorationEditor';
import { NumberingEditor } from './NumberingEditor';
import { Select } from '@/components/ui/Select';
import { Type, MoveVertical, Columns, Sparkles, Hash, RotateCcw, Eye } from 'lucide-react';

interface ElementStudioMainProps {
  elements: SemanticElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string) => void;
  onUpdateElement: (id: string, updated: Partial<SemanticElement>) => void;
  primaryColor: string;
}

export const ElementStudioMain: React.FC<ElementStudioMainProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  primaryColor,
}) => {
  const [activeTab, setActiveTab] = useState<'typography' | 'spacing' | 'scope' | 'decorations' | 'numbering'>('typography');

  const selectedElement =
    elements.find((e) => e.id === selectedElementId) || elements[0];

  if (!selectedElement) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-zinc-200 text-zinc-500 font-bold text-xs">
        Chưa có phần tử nào được chọn để định dạng.
      </div>
    );
  }

  // Get current SciSpace attributes
  const currentAttributes: SciSpaceElementAttributes = elementToSciSpaceAttributes(
    selectedElement,
    primaryColor
  );

  const handleUpdateAttributes = (updated: Partial<SciSpaceElementAttributes>) => {
    const nextAttributes: SciSpaceElementAttributes = {
      ...currentAttributes,
      ...updated,
    };
    const updatedElement = applySciSpaceAttributesToElement(selectedElement, nextAttributes);
    onUpdateElement(selectedElement.id, updatedElement);
  };

  const handleResetToDefaults = () => {
    const semType = mapElementTypeToSemanticType(selectedElement.type);
    const defaults = DEFAULT_ELEMENT_ATTRIBUTES[semType] || DEFAULT_ELEMENT_ATTRIBUTES['paragraph'];
    const updatedElement = applySciSpaceAttributesToElement(selectedElement, defaults);
    onUpdateElement(selectedElement.id, updatedElement);
  };

  // Preview style generated dynamically
  const previewCssStyle = resolveElementCssStyle(currentAttributes, primaryColor);

  return (
    <div className="space-y-4">
      {/* Top Banner Header */}
      <div className="relative z-30 focus-within:z-40 p-2 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-zinc-700" />
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
              Bước 4: Định dạng & Thuộc tính
            </h3>
          </div>
        </div>
      </div>

      {/* Main Studio Card */}
      <div className="bg-gray-200/50 rounded-[32px] p-5 space-y-4">
        {/* Element Selector Bar */}
        <div className="p-3.5 bg-white rounded-3xl border border-zinc-200/80 shadow-[0_0_10px_rgba(0,0,0,0.03)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-[#78C841] shrink-0" />
            <span className="text-xs font-bold text-zinc-700 shrink-0">Phần tử đang chỉnh:</span>
            <div className="w-64 min-w-[200px]">
              <Select
                value={selectedElement.id}
                onChange={(val) => onSelectElement(val)}
                options={elements.map((el) => ({
                  value: el.id,
                  label: el.name,
                }))}
                variant="flat-white"
                size="sm"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl text-xs font-bold text-zinc-700 hover:text-zinc-950 bg-white hover:bg-zinc-50 border border-zinc-200/80 shadow-2xs transition-all cursor-pointer self-start sm:self-auto active:scale-95"
            title="Đặt lại thuộc tính mặc định chuẩn xuất bản quốc tế"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Đặt lại</span>
          </button>
        </div>

        {/* Attribute Category Tabs (Pill style matching StructPaper) */}
        <div className="flex items-center gap-1 overflow-x-auto p-1 bg-zinc-200/70 rounded-2xl no-scrollbar scrollbar-none w-full select-none">
          {[
            { id: 'typography', label: 'Kiểu Chữ', icon: <Type className="w-3.5 h-3.5" /> },
            { id: 'spacing', label: 'Khoảng Cách & Căn Lề', icon: <MoveVertical className="w-3.5 h-3.5" /> },
            { id: 'scope', label: 'Phạm Vi Cột', icon: <Columns className="w-3.5 h-3.5" /> },
            { id: 'decorations', label: 'Viền & Nền', icon: <Sparkles className="w-3.5 h-3.5" /> },
            { id: 'numbering', label: 'Đánh Số & Trích Dẫn', icon: <Hash className="w-3.5 h-3.5" /> },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none flex-1 min-w-fit ${isActive
                  ? 'bg-white text-zinc-900 shadow-2xs border border-zinc-200/60 font-extrabold'
                  : 'text-zinc-600 hover:text-zinc-950 hover:bg-white/60'
                  }`}
              >
                <span className={isActive ? 'text-[#78C841]' : 'text-zinc-400'}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Panels */}
        {activeTab === 'typography' && (
          <TypographyEditor
            attributes={currentAttributes.typography}
            primaryColor={primaryColor}
            onChange={(typo) =>
              handleUpdateAttributes({
                typography: { ...currentAttributes.typography, ...typo },
              })
            }
          />
        )}

        {activeTab === 'spacing' && (
          <SpacingAlignmentEditor
            attributes={currentAttributes.spacing}
            onChange={(sp) =>
              handleUpdateAttributes({
                spacing: { ...currentAttributes.spacing, ...sp },
              })
            }
            showIndents={selectedElement.type === 'body-text' || selectedElement.type === 'references-block'}
          />
        )}

        {activeTab === 'scope' && (
          <LayoutScopeEditor
            attributes={currentAttributes.layoutScope}
            onChange={(scope) =>
              handleUpdateAttributes({
                layoutScope: { ...currentAttributes.layoutScope, ...scope },
              })
            }
          />
        )}

        {activeTab === 'decorations' && (
          <DecorationEditor
            attributes={currentAttributes.decorations}
            primaryColor={primaryColor}
            onChange={(dec) =>
              handleUpdateAttributes({
                decorations: { ...currentAttributes.decorations, ...dec },
              })
            }
          />
        )}

        {activeTab === 'numbering' && (
          <NumberingEditor
            attributes={currentAttributes.numbering}
            onChange={(num) =>
              handleUpdateAttributes({
                numbering: { ...currentAttributes.numbering, ...num },
              })
            }
            isHeading={selectedElement.type === 'heading'}
            isReference={selectedElement.type === 'references-block'}
          />
        )}
      </div>
    </div>
  );
};
