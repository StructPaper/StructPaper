'use client';

import React, { useState } from 'react';
import { LayoutZoneConfig, SemanticElement } from '@/types/template-builder';
import { ZoneCssLayout, DEFAULT_FULL_WIDTH_BLOCK_LAYOUT } from '@/types/template-engine/layout';
import { Sliders, Box, FileText, Check, Plus } from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { NumberInput } from '@/components/ui/NumberInput';

interface SubZonePropertiesInspectorProps {
  selectedSubZone: LayoutZoneConfig;
  allElements: SemanticElement[];
  onUpdateSubZone: (id: string, updated: Partial<LayoutZoneConfig>) => void;
  onUpdateElement?: (id: string, updated: Partial<SemanticElement>) => void;
}

export const SubZonePropertiesInspector: React.FC<SubZonePropertiesInspectorProps> = ({
  selectedSubZone,
  allElements,
  onUpdateSubZone,
  onUpdateElement,
}) => {
  const [tab, setTab] = useState<'basic' | 'css-box' | 'elements'>('basic');

  const elementsInThisZone = allElements.filter((el) => el.zoneId === selectedSubZone.id);
  const unassignedElements = allElements.filter((el) => !el.zoneId || el.zoneId !== selectedSubZone.id);

  const cssLayout = selectedSubZone.cssLayout || {
    ...DEFAULT_FULL_WIDTH_BLOCK_LAYOUT,
    id: selectedSubZone.id,
    name: selectedSubZone.name,
  };
  const boxModel = cssLayout.boxModel || DEFAULT_FULL_WIDTH_BLOCK_LAYOUT.boxModel;
  const padding = boxModel.padding;
  const border = boxModel.border;

  return (
    <div className="bg-white border border-zinc-200/80 rounded-2xl p-3.5 space-y-3.5 shadow-2xs">
      {/* Header: Sub-Zone Name & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
        <div className="min-w-0">
          <input
            type="text"
            value={selectedSubZone.name}
            onChange={(e) => onUpdateSubZone(selectedSubZone.id, { name: e.target.value })}
            className="text-xs font-extrabold text-zinc-900 bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent focus:border-[#78C841] rounded-lg px-2 py-1 outline-none transition-all w-full max-w-[200px]"
            title="Bấm để đổi tên phân vùng con"
          />
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1 bg-zinc-100 p-0.5 rounded-xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setTab('basic')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              tab === 'basic' ? 'bg-zinc-900 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Sliders className="w-3 h-3" />
            <span>Bố cục</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('css-box')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              tab === 'css-box' ? 'bg-zinc-900 text-white shadow-2xs ring-1 ring-[#78C841]/50' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Box className="w-3 h-3 text-[#78C841]" />
            <span>Box Model</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('elements')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
              tab === 'elements' ? 'bg-zinc-900 text-white shadow-2xs' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Thành phần ({elementsInThisZone.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BASIC & COLUMNS */}
      {tab === 'basic' && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Select
                label="Kiểu bố cục vùng con:"
                labelClassName="text-[10px] font-bold text-zinc-600 mb-1"
                value={selectedSubZone.type}
                onChange={(val) => onUpdateSubZone(selectedSubZone.id, { type: val as any })}
                variant="flat-white"
                size="xs"
                options={[
                  { value: 'full-width', label: '1 Cột tràn vùng' },
                  { value: 'multi-column', label: 'Chia nhiều cột' },
                  { value: 'sidebar-split', label: 'Sidebar nội bộ' },
                ]}
              />
            </div>

            {selectedSubZone.type === 'multi-column' && (
              <div>
                <label className="block text-[10px] font-bold text-zinc-600 mb-1">Số cột nội bộ:</label>
                <div className="flex gap-1 bg-zinc-100 p-1 rounded-xl select-none">
                  {[1, 2, 3].map((colNum) => (
                    <button
                      key={colNum}
                      type="button"
                      onClick={() => onUpdateSubZone(selectedSubZone.id, { columns: colNum as 1 | 2 | 3 })}
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        selectedSubZone.columns === colNum
                          ? 'bg-zinc-900 text-white shadow-2xs'
                          : 'text-zinc-600 hover:text-zinc-900'
                      }`}
                    >
                      {colNum}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-1.5">
            <label className="block text-[10px] font-extrabold text-zinc-700">Cơ chế tràn (Overflow):</label>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              {[
                { id: 'auto-expand', label: 'Tự dãn' },
                { id: 'clip', label: 'Cắt bớt' },
                { id: 'overflow-up', label: 'Tràn lên ⤊' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSubZone(selectedSubZone.id, { overflowBehavior: opt.id as any })}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                    (selectedSubZone.overflowBehavior || 'auto-expand') === opt.id
                      ? 'border-[#78C841] bg-white text-[#14532D] shadow-2xs'
                      : 'border-zinc-200 bg-white/60 text-zinc-600 hover:bg-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CSS BOX MODEL */}
      {tab === 'css-box' && (
        <div className="space-y-3 pt-1">
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/80 space-y-2">
            <span className="text-[10px] font-extrabold text-zinc-700">Padding nội dung (mm):</span>
            <div className="grid grid-cols-4 gap-2">
              {(['top', 'right', 'bottom', 'left'] as const).map((side) => {
                const key = `${side}Mm` as keyof typeof padding;
                return (
                  <div key={side}>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase">{side}</label>
                    <NumberInput
                      min={0}
                      max={20}
                      step={0.5}
                      size="xs"
                      variant="flat-white"
                      value={padding[key] || 0}
                      onChange={(val) =>
                        onUpdateSubZone(selectedSubZone.id, {
                          cssLayout: {
                            ...cssLayout,
                            boxModel: {
                              ...boxModel,
                              padding: { ...padding, [key]: val },
                            },
                          },
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-zinc-600 mb-1">Màu nền vùng con:</label>
              <div className="flex items-center gap-2 bg-zinc-50 p-1.5 rounded-xl border border-zinc-200">
                <input
                  type="color"
                  value={boxModel.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    onUpdateSubZone(selectedSubZone.id, {
                      cssLayout: {
                        ...cssLayout,
                        boxModel: { ...boxModel, backgroundColor: e.target.value },
                      },
                    })
                  }
                  className="w-6 h-6 rounded cursor-pointer border-0"
                />
                <input
                  type="text"
                  value={boxModel.backgroundColor || 'transparent'}
                  onChange={(e) =>
                    onUpdateSubZone(selectedSubZone.id, {
                      cssLayout: {
                        ...cssLayout,
                        boxModel: { ...boxModel, backgroundColor: e.target.value },
                      },
                    })
                  }
                  className="text-xs font-mono font-bold text-zinc-800 bg-transparent outline-none w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-600 mb-1">Bo góc (px):</label>
              <NumberInput
                min={0}
                max={30}
                step={1}
                size="xs"
                variant="flat-white"
                value={border.radiusPx || 0}
                onChange={(val) =>
                  onUpdateSubZone(selectedSubZone.id, {
                    cssLayout: {
                      ...cssLayout,
                      boxModel: {
                        ...boxModel,
                        border: { ...border, radiusPx: val, show: val > 0 || border.show },
                      },
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SEMANTIC ELEMENTS */}
      {tab === 'elements' && (
        <div className="space-y-2.5 pt-1">
          <p className="text-[11px] text-zinc-600">Thành phần khoa học hiển thị trong phân vùng con này:</p>
          {elementsInThisZone.length === 0 ? (
            <p className="text-xs text-zinc-400 italic py-2 text-center bg-zinc-50 rounded-xl">
              Chưa có thành phần nào được gán vào vùng này
            </p>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {elementsInThisZone.map((el) => (
                <div
                  key={el.id}
                  className="p-2 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs"
                >
                  <span className="font-bold text-zinc-800 truncate">{el.name}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateElement?.(el.id, { zoneId: undefined })}
                    className="text-[10px] text-red-500 hover:text-red-700 font-bold cursor-pointer"
                  >
                    Gỡ bỏ
                  </button>
                </div>
              ))}
            </div>
          )}

          {unassignedElements.length > 0 && (
            <div className="pt-2 border-t border-zinc-100">
              <span className="text-[10px] font-bold text-zinc-500 block mb-1">Gán thêm thành phần:</span>
              <div className="flex flex-wrap gap-1">
                {unassignedElements.slice(0, 6).map((el) => (
                  <button
                    key={el.id}
                    type="button"
                    onClick={() => onUpdateElement?.(el.id, { zoneId: selectedSubZone.id })}
                    className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-zinc-100 hover:bg-[#78C841]/20 hover:text-[#14532D] text-zinc-700 cursor-pointer transition-colors flex items-center gap-1"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span className="truncate max-w-[100px]">{el.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
