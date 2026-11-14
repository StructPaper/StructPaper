'use client';

import React, { useState } from 'react';
import { LayoutSubSlot, CssDisplayMode } from '@/types/template-engine/layout';
import { SemanticElement } from '@/types/template-builder';
import { Select } from '@/components/ui/Select';
import { Layers, Plus, Trash2, ChevronRight, Sliders, Box, Move } from 'lucide-react';

interface HybridSubSlotsEditorProps {
  subSlots?: LayoutSubSlot[];
  zoneElements: SemanticElement[];
  onChange: (subSlots: LayoutSubSlot[]) => void;
  onAssignElementToSlot: (elementId: string, slotId: string | undefined) => void;
}

export const HybridSubSlotsEditor: React.FC<HybridSubSlotsEditorProps> = ({
  subSlots = [],
  zoneElements,
  onChange,
  onAssignElementToSlot,
}) => {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(
    subSlots[0]?.id || null
  );

  const handleAddSubSlot = () => {
    const newIndex = subSlots.length + 1;
    const newSlot: LayoutSubSlot = {
      id: `slot-${Date.now()}`,
      name: `Ô chứa con ${newIndex} (Sub-Slot ${newIndex})`,
      display: 'block',
      boxModel: {
        margin: { topMm: 0, rightMm: 0, bottomMm: 1, leftMm: 0 },
        padding: { topMm: 1, rightMm: 1, bottomMm: 1, leftMm: 1 },
        overflow: 'visible',
        border: {
          show: false,
          top: false,
          right: false,
          bottom: false,
          left: false,
          style: 'none',
          color: '#E2E8F0',
          widthPt: 0,
          radiusPx: 0,
        },
      },
    };

    const next = [...subSlots, newSlot];
    onChange(next);
    setActiveSlotId(newSlot.id);
  };

  const handleRemoveSubSlot = (slotId: string) => {
    const next = subSlots.filter((s) => s.id !== slotId);
    // Unassign elements
    zoneElements.forEach((el) => {
      if (el.subSlotId === slotId) {
        onAssignElementToSlot(el.id, undefined);
      }
    });
    onChange(next);
    if (activeSlotId === slotId) {
      setActiveSlotId(next[0]?.id || null);
    }
  };

  const handleUpdateSlot = (slotId: string, updated: Partial<LayoutSubSlot>) => {
    const next = subSlots.map((s) => (s.id === slotId ? { ...s, ...updated } : s));
    onChange(next);
  };

  return (
    <div className="space-y-3 p-3 bg-white/90 rounded-2xl border border-zinc-200/80 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-600" />
          <h4 className="text-xs font-bold text-zinc-800">
            Hòa Trộn Bố Cục Đa Cấp (CSS Hybrid Sub-Slots)
          </h4>
        </div>
        <button
          type="button"
          onClick={handleAddSubSlot}
          className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-2 py-1 rounded-lg transition-all cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm Sub-Slot
        </button>
      </div>

      <p className="text-[10px] text-zinc-500 leading-relaxed">
        Cho phép lồng các hộp chứa nhỏ bên trong phân vùng lớn với các chế độ hiển thị (Grid, Flex, Block) riêng biệt.
      </p>

      {subSlots.length === 0 ? (
        <div className="p-4 text-center border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
          <p className="text-xs text-zinc-500">
            Chưa có Sub-Slot nào. Toàn bộ thành phần trong vùng này đang dùng chung 1 khung hiển thị mặc định.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* List of sub-slots */}
          <div className="space-y-1.5">
            {subSlots.map((slot, index) => {
              const isSelected = activeSlotId === slot.id;
              const slotElements = zoneElements.filter((el) => el.subSlotId === slot.id);

              return (
                <div
                  key={slot.id}
                  className={`rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-amber-50/50 border-amber-300 ring-1 ring-amber-400/40'
                      : 'bg-zinc-50/60 border-zinc-200 hover:bg-zinc-50'
                  }`}
                >
                  <div
                    className="p-2.5 flex items-center justify-between cursor-pointer select-none"
                    onClick={() => setActiveSlotId(slot.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[10px] font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div>
                        <input
                          type="text"
                          value={slot.name}
                          onChange={(e) => handleUpdateSlot(slot.id, { name: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-bold text-zinc-800 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-amber-500 rounded px-1"
                        />
                        <div className="flex items-center gap-2 text-[9.5px] text-zinc-500 px-1">
                          <span className="uppercase font-mono font-semibold text-amber-700">
                            {slot.display}
                          </span>
                          <span>•</span>
                          <span>{slotElements.length} phần tử gán vào</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveSubSlot(slot.id);
                        }}
                        className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                        title="Xóa Sub-Slot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded configuration for active slot */}
                  {isSelected && (
                    <div className="p-3 pt-0 border-t border-amber-200/60 space-y-2 mt-1">
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-zinc-600">
                            Kiểu hiển thị của ô này (Display)
                          </label>
                          <Select
                            value={slot.display}
                            onChange={(val) =>
                              handleUpdateSlot(slot.id, { display: val as CssDisplayMode })
                            }
                            options={[
                              { value: 'block', label: 'Block (Dòng chảy)' },
                              { value: 'flex', label: 'Flexbox (Hàng ngang/dọc)' },
                              { value: 'grid', label: 'CSS Grid (Lưới)' },
                              { value: 'columns', label: 'Multi-Column (Đa cột)' },
                            ]}
                            variant="white-shadow-4"
                            size="sm"
                          />
                        </div>

                        {slot.display === 'grid' && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-zinc-600">
                              Mẫu cột (Template Columns)
                            </label>
                            <input
                              type="text"
                              value={slot.grid?.templateColumns || '1fr 1fr'}
                              onChange={(e) =>
                                handleUpdateSlot(slot.id, {
                                  grid: {
                                    columnGapMm: 4,
                                    rowGapMm: 4,
                                    templateColumns: e.target.value,
                                  },
                                })
                              }
                              placeholder="1fr 1fr"
                              className="w-full px-2 py-1 text-xs font-mono bg-white border border-zinc-200 rounded"
                            />
                          </div>
                        )}
                      </div>

                      {/* Element Assignment to this sub-slot */}
                      <div className="space-y-1 pt-1">
                        <label className="text-[10px] font-semibold text-zinc-600 block">
                          Gán các phần tử bài báo vào ô này:
                        </label>
                        <div className="flex flex-wrap gap-1">
                          {zoneElements.map((el) => {
                            const isAssigned = el.subSlotId === slot.id;
                            return (
                              <button
                                key={el.id}
                                type="button"
                                onClick={() =>
                                  onAssignElementToSlot(
                                    el.id,
                                    isAssigned ? undefined : slot.id
                                  )
                                }
                                className={`px-2 py-1 rounded-md text-[10px] font-semibold transition-all border cursor-pointer ${
                                  isAssigned
                                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                                    : 'bg-white hover:bg-zinc-100 text-zinc-600 border-zinc-200'
                                }`}
                              >
                                {el.name}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
