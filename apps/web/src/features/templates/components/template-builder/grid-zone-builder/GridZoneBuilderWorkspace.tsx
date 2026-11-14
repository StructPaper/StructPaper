'use client';

import React, { useState } from 'react';
import {
  UniversalTemplateSchema,
  LayoutZoneConfig,
  TemplateGridConfig,
  GridAreaCoords,
} from '@/types/template-builder';
import { GridPresetOption } from '@/types/grid-zones';
import { GridZoneControls } from './GridZoneControls';
import { GridZoneCanvas } from './GridZoneCanvas';
import { GridZonePresetsBar } from './GridZonePresetsBar';
import { FileText, LayoutGrid, Check, Info } from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';

interface GridZoneBuilderWorkspaceProps {
  schema: UniversalTemplateSchema;
  onUpdateZones: (zones: LayoutZoneConfig[]) => void;
  onUpdateGridConfig: (config: TemplateGridConfig) => void;
  onSwitchToPdfPreview: () => void;
}

export const GridZoneBuilderWorkspace: React.FC<GridZoneBuilderWorkspaceProps> = ({
  schema,
  onUpdateZones,
  onUpdateGridConfig,
  onSwitchToPdfPreview,
}) => {
  const { zones, gridConfig } = schema;

  const currentGridConfig: TemplateGridConfig = gridConfig || {
    enabled: true,
    columns: 5,
    rows: 5,
    rowGap: 8,
    colGap: 8,
    gapSync: true,
    unit: 'px',
  };

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    zones[0]?.id || null
  );

  // Update Grid Configuration
  const handleUpdateConfig = (updated: Partial<TemplateGridConfig>) => {
    const nextConfig = {
      ...currentGridConfig,
      ...updated,
      enabled: true,
    };
    onUpdateGridConfig(nextConfig);
  };

  // Add a new zone with specified Grid Area
  const handleAddZoneWithArea = (area: GridAreaCoords) => {
    const newIndex = zones.length + 1;
    const newZone: LayoutZoneConfig = {
      id: `zone-${Date.now()}`,
      name: `Phân vùng ${newIndex}`,
      description: `Vùng ${area.colSpan} cột × ${area.rowSpan} dòng`,
      type: area.colSpan > 1 ? 'multi-column' : 'full-width',
      columns: area.colSpan > 2 ? 3 : area.colSpan > 1 ? 2 : 1,
      columnGap: 8,
      showColumnRule: false,
      columnRuleColor: '#E2E8F0',
      order: newIndex,
      gridArea: area,
    };

    const nextZones = [...zones, newZone];
    onUpdateZones(nextZones);
    setSelectedZoneId(newZone.id);
    toast.success(
      'Đã tạo phân vùng',
      `Tạo "${newZone.name}" tại cột ${area.colStart}-${area.colStart + area.colSpan - 1}, dòng ${area.rowStart}-${area.rowStart + area.rowSpan - 1}`
    );
  };

  // Quick add zone at first available empty spot
  const handleQuickAddZone = () => {
    // Find first empty cell
    for (let r = 1; r <= currentGridConfig.rows; r++) {
      for (let c = 1; c <= currentGridConfig.columns; c++) {
        const isOccupied = zones.some((z) => {
          if (!z.gridArea) return false;
          const { rowStart, colStart, rowSpan, colSpan } = z.gridArea;
          return r >= rowStart && r < rowStart + rowSpan && c >= colStart && c < colStart + colSpan;
        });

        if (!isOccupied) {
          handleAddZoneWithArea({ rowStart: r, colStart: c, rowSpan: 1, colSpan: 1 });
          return;
        }
      }
    }
    toast.error('Lưới đã đầy', 'Không còn ô trống trên lưới để tạo phân vùng mới');
  };

  // Update an existing zone's gridArea
  const handleUpdateZoneArea = (zoneId: string, area: GridAreaCoords) => {
    const nextZones = zones.map((z) => (z.id === zoneId ? { ...z, gridArea: area } : z));
    onUpdateZones(nextZones);
  };

  // Update zone name inline
  const handleUpdateZoneName = (zoneId: string, name: string) => {
    const nextZones = zones.map((z) => (z.id === zoneId ? { ...z, name } : z));
    onUpdateZones(nextZones);
    toast.success('Đổi tên phân vùng', `Đã cập nhật tên thành "${name}"`);
  };

  // Delete a zone
  const handleDeleteZone = (zoneId: string) => {
    const deleted = zones.find((z) => z.id === zoneId);
    const nextZones = zones.filter((z) => z.id !== zoneId);
    onUpdateZones(nextZones);
    if (selectedZoneId === zoneId) {
      setSelectedZoneId(nextZones[0]?.id || null);
    }
    toast.success('Đã xóa phân vùng', `Đã xóa "${deleted?.name || 'phân vùng'}"`);
  };

  // Reset grid: clears zones or restores initial 5x5 layout
  const handleResetGrid = () => {
    const confirmed = window.confirm(
      'Bạn có chắc chắn muốn đặt lại toàn bộ lưới phân vùng về trạng thái ban đầu?'
    );
    if (!confirmed) return;

    onUpdateGridConfig({
      enabled: true,
      columns: 5,
      rows: 5,
      rowGap: 8,
      colGap: 8,
      gapSync: true,
      unit: 'px',
    });

    onUpdateZones([]);
    setSelectedZoneId(null);
    toast.success('Đã đặt lại lưới', 'Đã xóa toàn bộ phân vùng trên lưới');
  };

  // Apply a preset configuration
  const handleApplyPreset = (preset: GridPresetOption) => {
    onUpdateGridConfig({
      enabled: true,
      columns: preset.columns,
      rows: preset.rows,
      rowGap: preset.rowGap,
      colGap: preset.colGap,
      gapSync: true,
      unit: 'px',
    });

    const newZones: LayoutZoneConfig[] = preset.zones.map((pz, idx) => ({
      id: `zone-${Date.now()}-${idx}`,
      name: pz.name,
      description: `Bố cục tự động từ mẫu "${preset.name}"`,
      type: pz.columns === 1 ? 'full-width' : 'multi-column',
      columns: pz.columns || 1,
      columnGap: 8,
      showColumnRule: false,
      columnRuleColor: '#E2E8F0',
      order: idx + 1,
      gridArea: pz.gridArea,
    }));

    onUpdateZones(newZones);
    setSelectedZoneId(newZones[0]?.id || null);
    toast.success('Đã áp dụng mẫu', `Đã tạo ${newZones.length} phân vùng từ mẫu: ${preset.name}`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-200/50 rounded-2xl sm:rounded-3xl border border-black/5 overflow-hidden shadow-xs">
      {/* Top Header Mode Switcher Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-white/80 backdrop-blur-md border-b border-black/5 flex-shrink-0 flex-wrap gap-2">
        {/* Switcher Pill Tabs */}
        <div className="flex items-center gap-1 bg-zinc-200/70 p-1 rounded-2xl select-none">
          <button
            type="button"
            onClick={onSwitchToPdfPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-600 hover:text-zinc-950 hover:bg-white/60 transition-all cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Xem trước PDF A4</span>
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-white text-zinc-900 shadow-2xs border border-zinc-200/60 transition-all cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#78C841]" />
            <span>Trình dựng Grid Phân vùng</span>
          </button>
        </div>

        {/* Stats summary & Close button */}
        <div className="flex items-center gap-3">
          <span className="hidden md:inline text-[11px] font-mono text-zinc-500 font-bold">
            {currentGridConfig.columns} Cột × {currentGridConfig.rows} Dòng • {zones.length} Phân vùng
          </span>

          <button
            type="button"
            onClick={onSwitchToPdfPreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#78C841] hover:bg-[#68af38] text-white text-xs font-extrabold shadow-sm transition-all hover:scale-102 active:scale-98 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Áp dụng vào bản in PDF</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4">
        {/* 1. Grid Generator Controls (matching top inputs in image: Columns, Rows, Gap) */}
        <GridZoneControls
          gridConfig={currentGridConfig}
          onUpdateGridConfig={handleUpdateConfig}
          onResetGrid={handleResetGrid}
        />

        {/* 2. Quick Presets Bar */}
        <GridZonePresetsBar onApplyPreset={handleApplyPreset} />

        {/* 3. Interactive Grid Canvas (matching the matrix in image) */}
        <GridZoneCanvas
          gridConfig={currentGridConfig}
          zones={zones}
          selectedZoneId={selectedZoneId}
          onSelectZone={(id) => setSelectedZoneId(id)}
          onAddZoneWithArea={handleAddZoneWithArea}
          onUpdateZoneArea={handleUpdateZoneArea}
          onDeleteZone={handleDeleteZone}
          onUpdateZoneName={handleUpdateZoneName}
        />

        {/* 4. Bottom Info Helper Note */}
        <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/60 flex items-start gap-2.5 text-xs text-amber-900 leading-relaxed shadow-2xs">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-extrabold">Hướng dẫn tạo phân vùng bằng CSS Grid:</span>
            <p className="text-[11px] text-amber-800">
              • <strong>Tạo vùng nhanh:</strong> Nhấp vào bất kỳ ô dấu cộng <code className="bg-amber-100 px-1 rounded font-bold">+</code> để tạo phân vùng đơn lẻ (1×1).
              <br />
              • <strong>Tạo vùng rộng:</strong> Nhấp giữ chuột trên một ô trống và kéo qua các ô lân cận để tạo phân vùng chiếm nhiều cột và dòng cùng lúc.
              <br />
              • <strong>Co giãn kích thước:</strong> Kéo biểu tượng góc dưới bên phải <code className="bg-amber-100 px-1 rounded font-bold">⌟</code> của khối phân vùng để mở rộng hoặc thu nhỏ.
              <br />
              • <strong>Đổi tên hoặc Xóa:</strong> Nhấp đúp vào tên khối để đổi tên trực tiếp, hoặc nhấp vào nút <code className="bg-pink-100 text-pink-700 px-1 rounded font-bold">×</code> ở góc trên phải để xóa phân vùng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
