'use client';

import React, { useState } from 'react';
import {
  SemanticElement,
  CompositeSubItem,
  LayoutZoneConfig,
} from '@/types/template-builder';
import {
  Plus,
  Trash2,
  Sparkles,
  Layers,
  Tag,
  FileText,
  AlignLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Select } from '@/components/ui/Select';
import { NumberInput } from '@/components/ui/NumberInput';

interface CompositeElementBuilderProps {
  zones: LayoutZoneConfig[];
  primaryColor: string;
  onAddElement: (element: SemanticElement) => void;
  onCancel?: () => void;
}

const FONT_OPTIONS = [
  { value: 'Arial', label: 'Arial (Không chân hiện đại)' },
  { value: 'Times New Roman', label: 'Times New Roman (Chuẩn VNUHCM)' },
  { value: 'Inter', label: 'Inter' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Minion Pro', label: 'Minion Pro' },
  { value: 'Courier', label: 'Courier (Monospace)' },
];

/**
 * CompositeElementBuilder
 * Creates custom composite elements powered by Variables & Constants (Nhãn cố định & Nội dung động)
 */
export const CompositeElementBuilder: React.FC<CompositeElementBuilderProps> = ({
  zones,
  primaryColor,
  onAddElement,
  onCancel,
}) => {
  const [elementName, setElementName] = useState('');
  const [selectedZoneId, setSelectedZoneId] = useState(zones[0]?.id || 'zone-main');
  const [layoutMode, setLayoutMode] = useState<'inline' | 'stacked' | 'split-cols'>('stacked');

  // Sub-items list (default: 1 Constant label + 1 Variable content)
  const [subItems, setSubItems] = useState<CompositeSubItem[]>([
    {
      id: `item-${Date.now()}-1`,
      kind: 'constant',
      label: 'Nhãn Tiêu đề',
      defaultValue: 'TÓM TẮT',
      styling: {
        fontFamily: 'Arial',
        fontSize: 9.5,
        fontWeight: 'bold',
        fontStyle: 'normal',
        textColor: primaryColor || '#78C841',
        textTransform: 'uppercase',
        display: 'block',
        suffix: '',
      },
    },
    {
      id: `item-${Date.now()}-2`,
      kind: 'variable',
      label: 'Nội dung chi tiết',
      defaultValue:
        'Nhập nội dung bài báo khoa học vào đây. Khối này sẽ tự động nhận giá trị bóc tách từ tài liệu DOCX hoặc trình soạn thảo.',
      styling: {
        fontFamily: 'Times New Roman',
        fontSize: 8.5,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textColor: '#1E293B',
        textTransform: 'none',
        display: 'block',
        suffix: '',
      },
    },
  ]);

  // Expand state for editing sub-items
  const [expandedItemId, setExpandedItemId] = useState<string | null>(subItems[0]?.id || null);

  const handleAddSubItem = (kind: 'constant' | 'variable') => {
    const newItem: CompositeSubItem = {
      id: `item-${Date.now()}`,
      kind,
      label: kind === 'constant' ? 'Nhãn cố định mới' : 'Nội dung biến mới',
      defaultValue: kind === 'constant' ? 'GHI CHÚ:' : 'Nội dung tương ứng...',
      styling: {
        fontFamily: kind === 'constant' ? 'Arial' : 'Times New Roman',
        fontSize: kind === 'constant' ? 8.5 : 8,
        fontWeight: kind === 'constant' ? 'bold' : 'normal',
        fontStyle: 'normal',
        textColor: kind === 'constant' ? primaryColor : '#334155',
        textTransform: 'none',
        display: layoutMode === 'inline' ? 'inline' : 'block',
        suffix: kind === 'constant' ? ': ' : '',
      },
    };
    setSubItems((prev) => [...prev, newItem]);
    setExpandedItemId(newItem.id);
  };

  const handleUpdateSubItem = (id: string, updated: Partial<CompositeSubItem>) => {
    setSubItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    );
  };

  const handleUpdateSubItemStyling = (
    id: string,
    stylingUpdate: Partial<CompositeSubItem['styling']>
  ) => {
    setSubItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              styling: { ...item.styling, ...stylingUpdate },
            }
          : item
      )
    );
  };

  const handleDeleteSubItem = (id: string) => {
    if (subItems.length <= 1) return;
    setSubItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleMoveSubItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subItems.length) return;
    const copy = [...subItems];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    setSubItems(copy);
  };

  const handleSave = () => {
    const finalName = elementName.trim() || 'Thành phần Tùy biến';
    const newElement: SemanticElement = {
      id: `custom-comp-${Date.now()}`,
      type: 'custom-composite',
      name: finalName,
      zoneId: selectedZoneId,
      order: 99,
      spanColumns: false,
      visible: true,
      styling: {
        fontFamily: 'Arial',
        fontSize: 8.5,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textColor: '#1E293B',
        textAlign: 'left',
        lineHeight: 1.35,
        textTransform: 'none',
        backgroundColor: 'transparent',
        borderStyle: 'none',
        borderWidth: 0,
        borderColor: 'transparent',
        padding: { top: 2, bottom: 2, left: 0, right: 0 },
        margin: { top: 3, bottom: 4 },
        borderRadius: 0,
      },
      specialProps: {
        compositeLayout: layoutMode,
        subItems: subItems,
      },
    };

    onAddElement(newElement);
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Overview Info Header */}
      <div className="p-4 rounded-2xl bg-slate-100/80 border border-slate-200/80 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-[#78C841] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs">
          <span className="font-extrabold text-slate-900 block">
            Cơ chế Khởi tạo Thành phần theo Biến (Variable) & Hằng (Constant):
          </span>
          <p className="text-slate-600 leading-relaxed">
            Mỗi khối học thuật có thể cấu thành từ các <strong>Hằng (Nhãn cố định)</strong> như &ldquo;Tóm tắt:&rdquo;, &ldquo;Lời cảm ơn:&rdquo;, &ldquo;Tài trợ:&rdquo; và các <strong>Biến (Nội dung thay đổi)</strong>. Bạn có thể tự do kết hợp và tinh chỉnh thiết kế chi tiết độc lập cho từng phần tử.
          </p>
        </div>
      </div>

      {/* Main Form: Name, Zone, Layout */}
      <div className="p-4 rounded-[28px] bg-gray-200/50 space-y-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-zinc-700 mb-1">
              Tên Thành phần Khối *
            </label>
            <input
              type="text"
              value={elementName}
              onChange={(e) => setElementName(e.target.value)}
              placeholder="VD: Khối Tóm tắt & Điểm nhấn, Nguồn tài trợ..."
              className="w-full bg-white rounded-2xl px-3.5 py-2 text-xs font-bold text-zinc-900 outline-none focus:ring-2 focus:ring-[#78C841]/40 border border-zinc-200"
            />
          </div>

          <div>
            <Select
              label="Phân vùng đặt thành phần (Zone)"
              labelClassName="text-[11px] font-bold text-zinc-700 mb-1"
              value={selectedZoneId}
              onChange={setSelectedZoneId}
              variant="flat-white"
              size="sm"
              options={zones.map((z) => ({
                value: z.id,
                label: `${z.name} (${z.type === 'multi-column' ? `${z.columns} cột` : '1 cột'})`,
              }))}
            />
          </div>
        </div>

        {/* Layout Arrangement Mode */}
        <div>
          <label className="block text-[11px] font-bold text-zinc-700 mb-1.5">
            Bố cục sắp xếp giữa Hằng & Biến
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                id: 'inline',
                label: 'Cùng dòng (Inline)',
                desc: '[Hằng]: [Biến nội dung]',
                icon: AlignLeft,
              },
              {
                id: 'stacked',
                label: 'Xếp chồng (Stacked)',
                desc: 'Hằng ở trên, Biến ở dưới',
                icon: Layers,
              },
              {
                id: 'split-cols',
                label: 'Chia 2 cột (Split)',
                desc: 'Hằng cột trái, Biến cột phải',
                icon: Layers,
              },
            ].map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setLayoutMode(mode.id as 'inline' | 'stacked' | 'split-cols')}
                className={`p-2.5 rounded-2xl text-left border transition-all cursor-pointer ${
                  layoutMode === mode.id
                    ? 'bg-white border-[#78C841] ring-2 ring-[#78C841]/30 shadow-xs'
                    : 'bg-white/70 hover:bg-white border-zinc-200 text-zinc-700'
                }`}
              >
                <div className="font-extrabold text-xs text-zinc-900 flex items-center gap-1.5">
                  <mode.icon className="w-3.5 h-3.5 text-[#78C841]" />
                  <span>{mode.label}</span>
                </div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{mode.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-Items List (Constants & Variables) */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="font-extrabold text-xs text-zinc-900 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-600" />
            <span>Các Thành phần con bên trong khối ({subItems.length})</span>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleAddSubItem('constant')}
              className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Tag className="w-3 h-3 text-amber-600" />
              <span>+ Thêm Hằng (Nhãn)</span>
            </button>
            <button
              type="button"
              onClick={() => handleAddSubItem('variable')}
              className="px-2.5 py-1 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold border border-blue-200 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FileText className="w-3 h-3 text-blue-600" />
              <span>+ Thêm Biến (Nội dung)</span>
            </button>
          </div>
        </div>

        {/* List of sub-items */}
        <div className="space-y-2">
          {subItems.map((item, index) => {
            const isExpanded = expandedItemId === item.id;
            const isConstant = item.kind === 'constant';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-zinc-200 shadow-2xs overflow-hidden transition-all"
              >
                {/* Header bar of sub-item */}
                <div
                  onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                  className="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider shrink-0 ${
                        isConstant
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-blue-100 text-blue-900 border border-blue-300'
                      }`}
                    >
                      {isConstant ? 'HẰNG (NHÃN)' : 'BIẾN (NỘI DUNG)'}
                    </span>
                    <span className="font-bold text-xs text-zinc-900 truncate">
                      {item.label}
                    </span>
                    <span className="text-zinc-400 text-xs font-mono">
                      &bull; &ldquo;{item.defaultValue.slice(0, 20)}...&rdquo;
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveSubItem(index, 'up');
                      }}
                      disabled={index === 0}
                      className="p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveSubItem(index, 'down');
                      }}
                      disabled={index === subItems.length - 1}
                      className="p-1 text-zinc-400 hover:text-zinc-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {subItems.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSubItem(item.id);
                        }}
                        className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer ml-1"
                        title="Xóa phần tử con này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-item Deep Design Config Drawer */}
                {isExpanded && (
                  <div className="p-3.5 bg-slate-50/70 border-t border-zinc-200/80 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                          Tên trường gợi nhớ
                        </label>
                        <input
                          type="text"
                          value={item.label}
                          onChange={(e) => handleUpdateSubItem(item.id, { label: e.target.value })}
                          className="w-full bg-white rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-800 border border-zinc-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                          Nội dung mẫu / Mặc định
                        </label>
                        <input
                          type="text"
                          value={item.defaultValue}
                          onChange={(e) =>
                            handleUpdateSubItem(item.id, { defaultValue: e.target.value })
                          }
                          className="w-full bg-white rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-800 border border-zinc-300"
                        />
                      </div>
                    </div>

                    {/* Granular Styling Controls */}
                    <div className="p-2.5 rounded-xl bg-white border border-zinc-200 space-y-2">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                        Định dạng chi tiết (Deep Design)
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Select
                          label="Phông chữ"
                          value={item.styling.fontFamily || 'Arial'}
                          onChange={(val) => handleUpdateSubItemStyling(item.id, { fontFamily: val })}
                          variant="flat-white"
                          size="sm"
                          options={FONT_OPTIONS}
                        />

                        <NumberInput
                          label="Cỡ chữ (pt)"
                          value={item.styling.fontSize || 8.5}
                          onChange={(val) => handleUpdateSubItemStyling(item.id, { fontSize: val })}
                          min={6}
                          max={24}
                          step={0.5}
                          unit="pt"
                          variant="flat-white"
                          size="sm"
                        />

                        <Select
                          label="Độ đậm"
                          value={item.styling.fontWeight || 'normal'}
                          onChange={(val) =>
                            handleUpdateSubItemStyling(item.id, {
                              fontWeight: val as 'normal' | 'medium' | 'semibold' | 'bold',
                            })
                          }
                          variant="flat-white"
                          size="sm"
                          options={[
                            { value: 'normal', label: 'Bình thường (400)' },
                            { value: 'medium', label: 'Trung bình (500)' },
                            { value: 'semibold', label: 'Bán đậm (600)' },
                            { value: 'bold', label: 'Đậm (700)' },
                          ]}
                        />

                        <Select
                          label="Kiểu chữ"
                          value={item.styling.fontStyle || 'normal'}
                          onChange={(val) =>
                            handleUpdateSubItemStyling(item.id, {
                              fontStyle: val as 'normal' | 'italic',
                            })
                          }
                          variant="flat-white"
                          size="sm"
                          options={[
                            { value: 'normal', label: 'Thẳng đứng' },
                            { value: 'italic', label: 'In nghiêng (Italic)' },
                          ]}
                        />
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 border-t border-zinc-100">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                            Màu chữ
                          </label>
                          <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-2 py-1 border border-zinc-200">
                            <input
                              type="color"
                              value={item.styling.textColor || '#1E293B'}
                              onChange={(e) =>
                                handleUpdateSubItemStyling(item.id, { textColor: e.target.value })
                              }
                              className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
                            />
                            <span className="text-[10px] font-mono font-bold text-zinc-800 uppercase">
                              {item.styling.textColor || '#1E293B'}
                            </span>
                          </div>
                        </div>

                        <Select
                          label="Biến đổi chữ"
                          value={item.styling.textTransform || 'none'}
                          onChange={(val) =>
                            handleUpdateSubItemStyling(item.id, {
                              textTransform: val as 'none' | 'uppercase' | 'capitalize',
                            })
                          }
                          variant="flat-white"
                          size="sm"
                          options={[
                            { value: 'none', label: 'Mặc định' },
                            { value: 'uppercase', label: 'IN HOA TOÀN BỘ' },
                            { value: 'capitalize', label: 'In Hoa Đầu Từ' },
                          ]}
                        />

                        {isConstant && (
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                              Ký tự hậu tố nối tiếp
                            </label>
                            <input
                              type="text"
                              value={item.styling.suffix ?? ''}
                              onChange={(e) =>
                                handleUpdateSubItemStyling(item.id, { suffix: e.target.value })
                              }
                              placeholder="VD: ': ' hoặc ' - '"
                              className="w-full bg-white rounded-xl px-2.5 py-1 text-xs font-mono border border-zinc-300"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Real-time Preview in Builder */}
      <div className="p-3.5 rounded-2xl bg-white border border-zinc-200 shadow-2xs space-y-1.5">
        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
          Xem trước hình thái khối (Live Mockup):
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-left">
          {layoutMode === 'inline' ? (
            <div className="leading-relaxed">
              {subItems.map((item) => (
                <span
                  key={item.id}
                  style={{
                    fontFamily: item.styling.fontFamily,
                    fontSize: `${item.styling.fontSize || 8.5}pt`,
                    fontWeight: item.styling.fontWeight === 'bold' ? 700 : item.styling.fontWeight === 'semibold' ? 600 : 400,
                    fontStyle: item.styling.fontStyle || 'normal',
                    color: item.styling.textColor,
                    textTransform: item.styling.textTransform,
                    marginRight: '4px',
                  }}
                >
                  {item.defaultValue}
                  {item.kind === 'constant' && (item.styling.suffix || ' ')}
                </span>
              ))}
            </div>
          ) : layoutMode === 'split-cols' ? (
            <div className="grid grid-cols-[28%_1fr] gap-2 items-baseline">
              <div className="space-y-1 border-r border-slate-200 pr-2">
                {subItems
                  .filter((i) => i.kind === 'constant')
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        fontFamily: item.styling.fontFamily,
                        fontSize: `${item.styling.fontSize || 8.5}pt`,
                        fontWeight: item.styling.fontWeight === 'bold' ? 700 : 400,
                        color: item.styling.textColor,
                        textTransform: item.styling.textTransform,
                      }}
                    >
                      {item.defaultValue}
                    </div>
                  ))}
              </div>
              <div className="space-y-1 pl-1">
                {subItems
                  .filter((i) => i.kind === 'variable')
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        fontFamily: item.styling.fontFamily,
                        fontSize: `${item.styling.fontSize || 8.5}pt`,
                        fontWeight: 400,
                        color: item.styling.textColor,
                      }}
                    >
                      {item.defaultValue}
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {subItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    fontFamily: item.styling.fontFamily,
                    fontSize: `${item.styling.fontSize || 8.5}pt`,
                    fontWeight: item.styling.fontWeight === 'bold' ? 700 : item.styling.fontWeight === 'semibold' ? 600 : 400,
                    fontStyle: item.styling.fontStyle || 'normal',
                    color: item.styling.textColor,
                    textTransform: item.styling.textTransform,
                  }}
                >
                  {item.defaultValue}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="pt-2 flex items-center justify-end gap-2.5">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-700 transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="px-5 py-2 rounded-2xl bg-[#78C841] hover:bg-[#68B435] text-white text-xs font-extrabold shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Thêm Khối vào Mẫu Template</span>
        </button>
      </div>
    </div>
  );
};
