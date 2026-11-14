'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutZoneConfig,
  TemplateGridConfig,
  SemanticElement,
} from '@/types/template-builder';
import { GridZoneControls } from '../grid-zone-builder/GridZoneControls';
import { ZoneCssLayoutStudio } from '../layout-engine';
import {
  findZoneDeep,
  findZonePath,
  updateZoneDeep,
  deleteZoneDeep,
  getDefaultSubGridConfig,
} from '../nested-zones/nestedZoneUtils';
import { Select } from '@/components/ui/Select';
import { NumberInput } from '@/components/ui/NumberInput';
import {
  LayoutGrid,
  Columns,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Combine,
  Link2,
  ArrowRight,
  ArrowLeft,
  Sliders,
  Code2,
  Plus,
  Layers,
} from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';
import { getZoneAtCell } from '@/types/grid-zones';

interface Step15GridZonesProps {
  gridConfig?: TemplateGridConfig;
  zones: LayoutZoneConfig[];
  onZonesChange: (zones: LayoutZoneConfig[]) => void;
  onGridConfigChange: (config: TemplateGridConfig) => void;
  selectedZoneId?: string | null;
  onSelectZone?: (id: string) => void;
  onNavigateToBack?: () => void;
  onNavigateToElements?: () => void;
  elements?: SemanticElement[];
  onUpdateElement?: (id: string, updated: Partial<SemanticElement>) => void;
  focusedZoneId?: string | null;
  onFocusZone?: (zoneId: string | null) => void;
  currentPageNumber?: number;
}

export const Step15GridZones: React.FC<Step15GridZonesProps> = ({
  gridConfig,
  zones,
  onZonesChange,
  onGridConfigChange,
  selectedZoneId,
  onSelectZone,
  onNavigateToBack,
  onNavigateToElements,
  elements = [],
  onUpdateElement,
  focusedZoneId = null,
  onFocusZone,
  currentPageNumber = 1,
}) => {
  const [zoneEditModes, setZoneEditModes] = useState<Record<string, 'basic' | 'css-engine'>>({});
  const [showHelpPopup, setShowHelpPopup] = useState(false);
  const helpPopupRef = useRef<HTMLDivElement>(null);
  const helpBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showHelpPopup) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        helpPopupRef.current &&
        !helpPopupRef.current.contains(e.target as Node) &&
        helpBtnRef.current &&
        !helpBtnRef.current.contains(e.target as Node)
      ) {
        setShowHelpPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showHelpPopup]);

  // Active depth level resolution (Root page grid vs Drilled-down Zone sub-grid)
  const isDrilledDown = Boolean(focusedZoneId);
  const currentParentZone = focusedZoneId ? findZoneDeep(zones, focusedZoneId) : null;
  const breadcrumbPath = focusedZoneId ? findZonePath(zones, focusedZoneId) || [] : [];

  // Active grid matrix config: Root page grid vs Current parent zone's subGridConfig
  const activeGridConfig: TemplateGridConfig = isDrilledDown
    ? (currentParentZone?.subGridConfig || getDefaultSubGridConfig())
    : (gridConfig || {
        enabled: true,
        columns: 5,
        rows: 5,
        rowGap: 8,
        colGap: 8,
        gapSync: true,
        unit: 'px',
      });

  // Active zones list: Root zones vs Current parent zone's subZones
  const activeZones: LayoutZoneConfig[] = isDrilledDown
    ? (currentParentZone?.subZones || [])
    : zones;

  // Update Grid Configuration (Page level or Sub-grid level)
  const handleUpdateConfig = (updated: Partial<TemplateGridConfig>) => {
    const newConfig: TemplateGridConfig = {
      ...activeGridConfig,
      ...updated,
      enabled: true,
    };
    if (isDrilledDown && currentParentZone) {
      onZonesChange(updateZoneDeep(zones, currentParentZone.id, { subGridConfig: newConfig }));
    } else {
      onGridConfigChange(newConfig);
    }
  };

  // Reset grid
  const handleResetGrid = () => {
    const confirmed = window.confirm(
      isDrilledDown
        ? `Bạn có chắc chắn muốn đặt lại ma trận lưới con của "${currentParentZone?.name}" về mặc định?`
        : 'Bạn có chắc chắn muốn đặt lại toàn bộ lưới phân vùng về trạng thái ban đầu?'
    );
    if (!confirmed) return;

    if (isDrilledDown && currentParentZone) {
      const defaultSub = getDefaultSubGridConfig();
      onZonesChange(
        updateZoneDeep(zones, currentParentZone.id, { subGridConfig: defaultSub, subZones: [] })
      );
      toast.success('Đã đặt lại lưới con', 'Đã xóa toàn bộ phân vùng con trong vùng này');
    } else {
      onGridConfigChange({
        enabled: true,
        columns: 5,
        rows: 5,
        rowGap: 8,
        colGap: 8,
        gapSync: true,
        unit: 'px',
      });
      onZonesChange([]);
      toast.success('Đã đặt lại lưới', 'Đã xóa toàn bộ phân vùng trên lưới');
    }
  };

  // Delete a zone at any depth
  const handleDeleteZone = (id: string) => {
    onZonesChange(deleteZoneDeep(zones, id));
    toast.success('Đã xóa phân vùng');
  };

  // Move zone up/down in current active level
  const handleMoveZone = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= activeZones.length) return;
    const newActive = [...activeZones];
    const temp = newActive[index];
    newActive[index] = newActive[targetIdx];
    newActive[targetIdx] = temp;
    newActive.forEach((z, i) => (z.order = i + 1));

    if (isDrilledDown && currentParentZone) {
      onZonesChange(updateZoneDeep(zones, currentParentZone.id, { subZones: newActive }));
    } else {
      onZonesChange(newActive);
    }
  };

  // Update a single zone at any depth
  const handleUpdateZone = (id: string, updated: Partial<LayoutZoneConfig>) => {
    onZonesChange(updateZoneDeep(zones, id, updated));
  };

  // Drill down into a zone (enter its sub-grid)
  const handleDrillDownZone = (zoneId: string) => {
    const target = findZoneDeep(zones, zoneId);
    if (!target) return;
    if (!target.subGridConfig) {
      const defaultSub = getDefaultSubGridConfig();
      onZonesChange(updateZoneDeep(zones, target.id, { subGridConfig: defaultSub }));
    }
    onFocusZone?.(zoneId);
  };

  // Find first empty cell on the current grid
  const findFirstEmptyCell = () => {
    const { columns, rows } = activeGridConfig;
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= columns; c++) {
        if (!getZoneAtCell(r, c, activeZones)) {
          return { rowStart: r, colStart: c, rowSpan: 1, colSpan: 1 };
        }
      }
    }
    return null;
  };

  // Add zone (Root zone or Sub-zone)
  const handleAddZone = () => {
    const emptyCell = findFirstEmptyCell();
    const gridArea = emptyCell || {
      rowStart: 1,
      colStart: 1,
      rowSpan: Math.min(2, activeGridConfig.rows),
      colSpan: Math.min(2, activeGridConfig.columns),
    };

    if (isDrilledDown && currentParentZone) {
      const newSubZone: LayoutZoneConfig = {
        id: `zone-${Date.now()}`,
        name: `Vùng con ${activeZones.length + 1}`,
        description: `Phân vùng con bên trong ${currentParentZone.name}`,
        type: 'full-width',
        columns: 1,
        columnGap: 6,
        showColumnRule: false,
        columnRuleColor: '#E2E8F0',
        gridArea,
        parentId: currentParentZone.id,
        order: activeZones.length + 1,
        subZones: [],
      };
      const updatedSubZones = [...(currentParentZone.subZones || []), newSubZone];
      onZonesChange(updateZoneDeep(zones, currentParentZone.id, { subZones: updatedSubZones }));
      onSelectZone?.(newSubZone.id);
      toast.success('Đã thêm phân vùng con mới');
    } else {
      const targetPage = currentPageNumber || 1;
      const newZone: LayoutZoneConfig = {
        id: `zone-${Date.now()}`,
        name: `Phân vùng ${zones.length + 1}`,
        description: 'Phân vùng tạo mới',
        type: 'full-width',
        columns: 1,
        columnGap: 8,
        showColumnRule: false,
        columnRuleColor: '#E2E8F0',
        gridArea,
        page: targetPage,
        pageScope: targetPage === 1 ? 'first-page' : 'subsequent-pages',
        order: zones.length + 1,
        subZones: [],
      };
      onZonesChange([...zones, newZone]);
      onSelectZone?.(newZone.id);
      toast.success('Đã thêm phân vùng mới');
    }
  };

  // Add a linked secondary block (Khối 2)
  const handleAddSecondaryBlock = (zoneId: string) => {
    const emptyCell = findFirstEmptyCell();
    if (!emptyCell) {
      toast.error(
        'Lưới đã kín ô',
        'Không còn ô trống trên lưới để tạo khối tiếp nối. Vui lòng tăng kích thước lưới hoặc thu nhỏ các phân vùng khác.'
      );
      return;
    }
    handleUpdateZone(zoneId, { secondaryGridArea: emptyCell });
    toast.success(
      'Đã liên kết Khối tiếp nối (2)',
      `Tạo Khối 2 tại Cột ${emptyCell.colStart}, Dòng ${emptyCell.rowStart}. Khi Khối 1 đầy nội dung, phần dư sẽ tự động đổ tiếp sang Khối 2!`
    );
  };

  // Remove secondary block
  const handleRemoveSecondaryBlock = (zoneId: string) => {
    handleUpdateZone(zoneId, { secondaryGridArea: undefined });
    toast.success('Đã gỡ khối tiếp nối', 'Phân vùng đã trở về dạng 1 khối đơn.');
  };

  // Merge another zone as a secondary block of targetZone
  const handleMergeWithZone = (targetZoneId: string, sourceZoneId: string) => {
    const sourceZone = findZoneDeep(zones, sourceZoneId);
    if (!sourceZone || !sourceZone.gridArea) return;
    handleUpdateZone(targetZoneId, { secondaryGridArea: sourceZone.gridArea });
    handleDeleteZone(sourceZoneId);
    toast.success(
      'Đã ghép 2 khối thành 1 phân vùng',
      `Đã liên kết "${sourceZone.name}" làm Khối 2 của phân vùng này!`
    );
  };

  return (
    <div className="space-y-4 pb-8">

      {/* 0. Breadcrumb Navigation when drilled into sub-zones */}
      {isDrilledDown && (
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border border-zinc-200/90 rounded-2xl px-3.5 py-2.5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-600 flex-wrap">
            <button
              type="button"
              onClick={() => onFocusZone?.(null)}
              className="hover:text-zinc-950 hover:underline cursor-pointer flex items-center gap-1 text-zinc-500"
            >
              <LayoutGrid className="w-3.5 h-3.5 text-zinc-400" />
              <span>Toàn trang</span>
            </button>
            {breadcrumbPath.map((item, idx) => {
              const isLast = idx === breadcrumbPath.length - 1;
              return (
                <React.Fragment key={item.id}>
                  <span className="text-zinc-300">/</span>
                  {isLast ? (
                    <span className="text-zinc-900 font-extrabold">{item.name}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onFocusZone?.(item.id)}
                      className="hover:text-zinc-950 hover:underline cursor-pointer text-zinc-600"
                    >
                      {item.name}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              if (breadcrumbPath.length <= 1) {
                onFocusZone?.(null);
              } else {
                const parentItem = breadcrumbPath[breadcrumbPath.length - 2];
                onFocusZone?.(parentItem.id);
              }
            }}
            className="text-xs font-bold text-zinc-700 hover:text-black flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 transition-all cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Quay lại cấp trên</span>
          </button>
        </div>
      )}

      {/* 1. Top Banner Header (Root level only, hidden when in sub-zones) */}
      {!isDrilledDown && (
        <div className="relative z-30 focus-within:z-40 p-2 pb-4 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 relative">
              <LayoutGrid className="w-4 h-4 text-zinc-700" />
              <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
                Bước 2: Bố cục Lưới & Phân vùng ({zones.length} phân vùng)
              </h3>

            {/* Help (?) Button & Context-menu-style Popup */}
            <div className="relative inline-flex items-center">
              <button
                ref={helpBtnRef}
                type="button"
                onClick={() => setShowHelpPopup((prev) => !prev)}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all cursor-pointer select-none ${showHelpPopup
                  ? 'bg-zinc-900 text-white shadow-xs scale-105'
                  : 'bg-zinc-200/80 hover:bg-zinc-300 text-zinc-700 hover:text-zinc-950 active:scale-95'
                  }`}
                title="Xem hướng dẫn thao tác Lưới Phân vùng"
                aria-label="Hướng dẫn thao tác"
              >
                ?
              </button>

              {showHelpPopup && (
                <div
                  ref={helpPopupRef}
                  onClick={(e) => e.stopPropagation()}
                  className="w-80 bg-white/98 backdrop-blur-xl border border-zinc-200/90 rounded-2xl shadow-2xl p-2.5 text-xs text-zinc-800 space-y-1 animate-fadeIn select-none absolute left-0 top-full mt-2 z-50"
                >
                  <div className="px-2 py-1 text-[10px] font-bold text-zinc-400 uppercase tracking-wider select-none flex items-center justify-between">
                    <span>Hướng dẫn thao tác Lưới</span>
                    <button
                      type="button"
                      onClick={() => setShowHelpPopup(false)}
                      className="text-zinc-400 hover:text-zinc-700 cursor-pointer p-0.5 rounded-full hover:bg-zinc-100 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="border-t border-zinc-200 my-1" />

                  {/* 1. Tạo vùng nhanh */}
                  <div className="w-full px-2.5 py-2 rounded-xl hover:bg-lime-50/70 transition-colors flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-lime-100 text-lime-800 font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      +
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-zinc-900 text-xs">Tạo vùng nhanh (1×1)</div>
                      <div className="text-[11px] text-zinc-600 mt-0.5 leading-snug">
                        Nhấp vào ô dấu cộng <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold">+</code> trên giấy để tạo ngay phân vùng một ô.
                      </div>
                    </div>
                  </div>

                  {/* 2. Kéo tạo vùng rộng */}
                  <div className="w-full px-2.5 py-2 rounded-xl hover:bg-blue-50/70 transition-colors flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-800 font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Combine className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-zinc-900 text-xs">Kéo tạo vùng rộng (m×n)</div>
                      <div className="text-[11px] text-zinc-600 mt-0.5 leading-snug">
                        Nhấp giữ chuột trên ô trống và kéo liên tục qua các ô lân cận để tạo vùng chiếm nhiều cột và dòng.
                      </div>
                    </div>
                  </div>

                  {/* 3. Co giãn kích thước */}
                  <div className="w-full px-2.5 py-2 rounded-xl hover:bg-amber-50/70 transition-colors flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs font-mono">
                      ⤡
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-zinc-900 text-xs">Co giãn từ 2 góc đối diện</div>
                      <div className="text-[11px] text-zinc-600 mt-0.5 leading-snug">
                        Kéo biểu tượng <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold">⌜</code> ở góc trên-trái hoặc <code className="bg-zinc-100 px-1 py-0.5 rounded font-mono font-bold">⌟</code> ở góc dưới-phải để co giãn kích thước vùng cực kỳ linh hoạt.
                      </div>
                    </div>
                  </div>

                  {/* 4. Kéo thả di chuyển khối */}
                  <div className="w-full px-2.5 py-2 rounded-xl hover:bg-emerald-50/70 transition-colors flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-zinc-900 text-xs">Kéo thả di chuyển khối</div>
                      <div className="text-[11px] text-zinc-600 mt-0.5 leading-snug">
                        Nhấp giữ vào thân khối và kéo thả đến các ô trống mong muốn trên lưới. Hệ thống tự động bắt dính và kiểm tra tránh đè vùng khác.
                      </div>
                    </div>
                  </div>

                  {/* 5. Phân chia lưới con đệ quy */}
                  <div className="w-full px-2.5 py-2 rounded-xl hover:bg-purple-50/70 transition-colors flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-800 font-extrabold flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                      <Layers className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-zinc-900 text-xs">Phân chia vùng con đệ quy</div>
                      <div className="text-[11px] text-zinc-600 mt-0.5 leading-snug">
                        Bấm &quot;Chia vùng con&quot; để đi vào bên trong bất kỳ phân vùng nào, thiết lập ma trận lưới con và thêm các phân vùng con với giao diện đồng nhất.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}

      {/* 2. Grid Dimensions & Gap Settings (Columns, Rows, Gap controls) */}
      <div className="p-4 sm:p-5 rounded-[32px] bg-gray-200/50 space-y-3">
        <h3 className="text-xs font-extrabold text-zinc-800 uppercase tracking-wider flex items-center gap-2">
          <Columns className="w-3.5 h-3.5 text-zinc-500" />
          <span>
            {isDrilledDown
              ? `Cấu hình Ma trận Lưới & Khoảng cách (Gap) - ${currentParentZone?.name}`
              : 'Cấu hình Ma trận Lưới & Khoảng cách (Gap)'}
          </span>
        </h3>

        <GridZoneControls
          gridConfig={activeGridConfig}
          onUpdateGridConfig={handleUpdateConfig}
          onResetGrid={handleResetGrid}
        />
      </div>

      {/* 3. List of Configured Zones */}
      <div className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-200/60">
          <div className="flex items-center gap-2">
            <Columns className="w-4 h-4 text-zinc-700" />
            <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
              {isDrilledDown
                ? `Danh sách Phân vùng (${activeZones.length})`
                : `Danh sách Phân vùng (${zones.length})`}
            </h3>
          </div>
        </div>

        {activeZones.length === 0 ? (
          <div className="p-8 text-center border-2 border-dashed border-zinc-300 rounded-[28px] bg-white space-y-2">
            <LayoutGrid className="w-8 h-8 text-zinc-400 mx-auto" />
            <div className="text-xs font-bold text-zinc-700">
              {isDrilledDown
                ? `Chưa có phân vùng con trong "${currentParentZone?.name}"`
                : 'Chưa có phân vùng nào trên lưới'}
            </div>
            <p className="text-[11px] text-zinc-500 max-w-sm mx-auto leading-relaxed">
              Thao tác trực tiếp trên ma trận lưới trên trang giấy (nhấp ô + hoặc kéo giữ chuột quét ô) để tạo phân vùng.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeZones.map((zone, index) => {
              const isSelected = selectedZoneId === zone.id;

              return (
                <div
                  key={zone.id}
                  onClick={() => onSelectZone?.(zone.id)}
                  className={`p-4 rounded-[28px] transition-all space-y-3 cursor-pointer ${isSelected
                    ? 'bg-gray-200/50 ring-2 ring-[#78C841] border border-[#78C841] shadow-sm'
                    : 'bg-gray-200/50 hover:bg-zinc-100 hover:border-zinc-300/80'
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <span className="w-7 h-7 rounded-xl bg-zinc-900 text-white flex items-center justify-center text-xs font-extrabold font-mono shadow-2xs shrink-0">
                        {index + 1}
                      </span>
                      <input
                        type="text"
                        value={zone.name}
                        onChange={(e) => handleUpdateZone(zone.id, { name: e.target.value })}
                        onClick={(e) => e.stopPropagation()}
                        className="font-extrabold text-xs text-zinc-900 bg-transparent border-b border-transparent hover:border-zinc-300 focus:border-[#78C841] outline-none px-1.5 py-0.5 flex-1 min-w-0"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      {/* Drill down into sub-zones */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDrillDownZone(zone.id);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-white hover:bg-zinc-50 border border-zinc-200/90 text-zinc-800 hover:text-black text-xs font-bold shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                        title="Đi vào chế độ phân chia vùng con đa cấp (Nested Sub-grid)"
                      >
                        <Layers className="w-3.5 h-3.5 text-[#78C841]" />
                        <span>
                          {zone.subZones && zone.subZones.length > 0
                            ? `${zone.subZones.length} vùng con`
                            : 'Chia vùng con'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveZone(index, 'up');
                        }}
                        disabled={index === 0}
                        className="p-1.5 rounded-xl hover:bg-white text-zinc-500 hover:text-zinc-900 disabled:opacity-30 cursor-pointer transition-colors shadow-2xs"
                        title="Di chuyển lên trên"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveZone(index, 'down');
                        }}
                        disabled={index === activeZones.length - 1}
                        className="p-1.5 rounded-xl hover:bg-white text-zinc-500 hover:text-zinc-900 disabled:opacity-30 cursor-pointer transition-colors shadow-2xs"
                        title="Di chuyển xuống dưới"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteZone(zone.id);
                        }}
                        className="p-1.5 rounded-xl hover:bg-red-50 text-red-500 cursor-pointer ml-1 transition-colors"
                        title="Xóa phân vùng này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Zone Configuration Details */}
                  <div className="pt-2 border-t border-zinc-200/60 space-y-3">
                    <div className="flex items-center gap-1.5 p-1 bg-zinc-200/70 rounded-2xl w-fit">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoneEditModes((prev) => ({ ...prev, [zone.id]: 'basic' }));
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${(zoneEditModes[zone.id] || 'basic') === 'basic'
                            ? 'bg-zinc-900 text-white shadow-2xs'
                            : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                      >
                        <Sliders className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Cơ bản</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoneEditModes((prev) => ({ ...prev, [zone.id]: 'css-engine' }));
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${zoneEditModes[zone.id] === 'css-engine'
                            ? 'bg-zinc-900 text-white shadow-2xs ring-2 ring-[#78C841]/50'
                            : 'text-zinc-600 hover:text-zinc-900'
                          }`}
                      >
                        <Code2 className="w-3.5 h-3.5 text-[#78C841]" />
                        <span>Bố cục CSS Engine (Grid / Flexbox / Box Model)</span>
                      </button>
                    </div>

                    {zoneEditModes[zone.id] === 'css-engine' ? (
                      <div onClick={(e) => e.stopPropagation()}>
                        <ZoneCssLayoutStudio
                          zone={zone}
                          allZones={zones}
                          elements={elements}
                          onUpdateZone={(uz) => handleUpdateZone(zone.id, uz)}
                          onUpdateElement={onUpdateElement || (() => { })}
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-bold text-zinc-600 mb-1">
                              Khoảng cách cột (Gap mm):
                            </label>
                            <NumberInput
                              min={0}
                              max={15}
                              step={0.5}
                              unit="mm"
                              size="xs"
                              variant="flat-white"
                              value={zone.columnGap ?? 6}
                              onChange={(val) =>
                                handleUpdateZone(zone.id, {
                                  columnGap: val,
                                })
                              }
                            />
                          </div>

                          {/* Cơ chế khi tràn (Overflow behavior) */}
                          <div>
                            <Select
                              label="Cơ chế tràn khi quá dài:"
                              labelClassName="text-[10px] font-bold text-zinc-600 mb-1"
                              value={
                                zone.overflowBehavior === 'auto-fit' || zone.autoFitHeight || zone.heightMode === 'auto'
                                  ? 'auto-fit'
                                  : (zone.overflowBehavior || 'push-down')
                              }
                              onChange={(val) =>
                                handleUpdateZone(zone.id, {
                                  overflowBehavior: val as 'push-down' | 'overflow-up' | 'clip' | 'auto-fit',
                                  allowOverflowPush: val === 'push-down' || val === 'overflow-up' || val === 'auto-fit',
                                  autoFitHeight: val === 'auto-fit',
                                  heightMode: val === 'auto-fit' ? 'auto' : 'grid',
                                })
                              }
                              variant="flat-white"
                              size="xs"
                              options={[
                                { value: 'push-down', label: '⤋ Tràn xuống (Tự đẩy phân vùng dưới)' },
                                { value: 'overflow-up', label: '⤊ Tràn lên trên (Tràn lên vùng phía trên)' },
                                { value: 'clip', label: '✂ Cắt gọn (Cố định trong ô, không tràn)' },
                                { value: 'auto-fit', label: '↕ Ôm sát nội dung (Tự co dãn khi tắt lưới)' },
                              ]}
                            />
                          </div>
                        </div>

                        {/* Chuỗi dòng chảy 2 khối biệt lập (Multi-block flow chain) */}
                        <div className="pt-2 border-t border-zinc-200/60 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-zinc-800">
                              <Link2 className="w-3.5 h-3.5 text-[#78C841]" />
                              <span>Chuỗi dòng chảy 2 khối (Liên kết 2 khối biệt lập)</span>
                            </div>
                            {zone.secondaryGridArea && (
                              <span className="text-[10px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                                Đang liên kết 2 khối
                              </span>
                            )}
                          </div>

                          {zone.secondaryGridArea ? (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-2xl bg-white border border-emerald-300 shadow-2xs">
                              <div className="text-xs text-zinc-800 space-y-0.5">
                                <div className="font-extrabold flex items-center gap-1.5 text-emerald-900">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-700 text-white text-[10px]">1A</span>
                                  <span>Cột {zone.gridArea?.colStart}, Dòng {zone.gridArea?.rowStart}</span>
                                  <ArrowRight className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-700 text-white text-[10px]">1B</span>
                                  <span>
                                    Cột {zone.secondaryGridArea.colStart}, Dòng {zone.secondaryGridArea.rowStart} ({zone.secondaryGridArea.colSpan}c×{zone.secondaryGridArea.rowSpan}r)
                                  </span>
                                </div>
                                <p className="text-[11px] text-zinc-500">
                                  Khi nội dung Khối 1A đầy, hệ thống sẽ tự động fill tiếp tục nội dung sang Khối 1B.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveSecondaryBlock(zone.id);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
                              >
                                Gỡ khối 2
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddSecondaryBlock(zone.id);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer hover:border-emerald-500"
                              >
                                <Link2 className="w-3.5 h-3.5 text-[#78C841]" />
                                <span>+ Thêm khối tiếp nối (Khối 2) trên lưới</span>
                              </button>

                              {/* Ghép với phân vùng khác có sẵn */}
                              {activeZones.filter((z) => z.id !== zone.id && !z.secondaryGridArea).length > 0 && (
                                <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                                  <span className="text-[11px] text-zinc-400">hoặc ghép:</span>
                                  <select
                                    defaultValue=""
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleMergeWithZone(zone.id, e.target.value);
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-xs bg-white border border-zinc-300 rounded-xl px-2 py-1 outline-none text-zinc-800 font-bold cursor-pointer"
                                  >
                                    <option value="" disabled>
                                      Chọn phân vùng để gộp...
                                    </option>
                                    {activeZones
                                      .filter((z) => z.id !== zone.id && !z.secondaryGridArea)
                                      .map((other) => (
                                        <option key={other.id} value={other.id}>
                                          Gộp &quot;{other.name}&quot; vào làm Khối 2
                                        </option>
                                      ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
