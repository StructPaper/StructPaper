'use client';

import React, { useState } from 'react';
import {
  LayoutZoneConfig,
  TemplateGridConfig,
  GridAreaCoords,
  SemanticElement,
} from '@/types/template-builder';
import { NestedZoneBreadcrumb } from './NestedZoneBreadcrumb';
import { SubGridConfigPanel } from './SubGridConfigPanel';
import { SubZoneTreeList } from './SubZoneTreeList';
import { SubZonePropertiesInspector } from './SubZonePropertiesInspector';
import {
  findZoneDeep,
  findZonePath,
  updateZoneDeep,
  deleteZoneDeep,
  addChildSubZone,
} from './nestedZoneUtils';
import { ArrowLeft, Layers } from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';

interface NestedZoneStudioProps {
  zones: LayoutZoneConfig[];
  onZonesChange: (zones: LayoutZoneConfig[]) => void;
  focusedZoneId: string;
  onExitFocus: () => void;
  onFocusZone: (zoneId: string) => void;
  elements?: SemanticElement[];
  onUpdateElement?: (id: string, updated: Partial<SemanticElement>) => void;
  currentPageNumber?: number;
}

/**
 * Intelligent, modular Left Inspector Studio for Nested / Hierarchical Grid Zones.
 * Orchestrates sub-grid configuration, child zone tree list, and property inspector.
 */
export const NestedZoneStudio: React.FC<NestedZoneStudioProps> = ({
  zones,
  onZonesChange,
  focusedZoneId,
  onExitFocus,
  onFocusZone,
  elements = [],
  onUpdateElement,
}) => {
  const currentZone = findZoneDeep(zones, focusedZoneId);
  const path = findZonePath(zones, focusedZoneId) || [];

  const [selectedSubZoneId, setSelectedSubZoneId] = useState<string | null>(
    currentZone?.subZones?.[0]?.id || null
  );

  if (!currentZone) {
    return (
      <div className="p-6 text-center space-y-3 bg-white rounded-3xl border border-zinc-200">
        <p className="text-xs font-bold text-zinc-600">Không tìm thấy phân vùng đang chọn</p>
        <button
          type="button"
          onClick={onExitFocus}
          className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs font-bold cursor-pointer"
        >
          Quay lại toàn trang
        </button>
      </div>
    );
  }

  const selectedSubZone = currentZone.subZones?.find((sz) => sz.id === selectedSubZoneId);

  // Breadcrumb navigation
  const handleNavigateBreadcrumb = (targetId: string | null) => {
    if (!targetId) {
      onExitFocus();
    } else {
      onFocusZone(targetId);
      const target = findZoneDeep(zones, targetId);
      setSelectedSubZoneId(target?.subZones?.[0]?.id || null);
    }
  };

  // Sub-grid resolution updates
  const handleUpdateSubGridConfig = (cfg: TemplateGridConfig) => {
    const updated = updateZoneDeep(zones, currentZone.id, {
      subGridConfig: cfg,
    });
    onZonesChange(updated);
  };

  // Quick preset application
  const handleApplyPreset = (columns: number, rows: number, subZones: LayoutZoneConfig[]) => {
    const updated = updateZoneDeep(zones, currentZone.id, {
      subGridConfig: {
        enabled: true,
        columns,
        rows,
        colGap: 6,
        rowGap: 6,
        unit: 'px',
      },
      subZones,
    });
    onZonesChange(updated);
    setSelectedSubZoneId(subZones[0]?.id || null);
    toast.success('Đã áp dụng mẫu phân chia');
  };

  // Sub-zone property updates
  const handleUpdateSubZone = (subZoneId: string, updatedProps: Partial<LayoutZoneConfig>) => {
    const updated = updateZoneDeep(zones, subZoneId, updatedProps);
    onZonesChange(updated);
  };

  // Delete sub-zone
  const handleDeleteSubZone = (subZoneId: string) => {
    const updated = deleteZoneDeep(zones, subZoneId);
    onZonesChange(updated);
    if (selectedSubZoneId === subZoneId) {
      setSelectedSubZoneId(currentZone.subZones?.find((sz) => sz.id !== subZoneId)?.id || null);
    }
    toast.success('Đã xóa phân vùng con');
  };

  return (
    <div className="space-y-4">
      {/* 1. Breadcrumb Bar */}
      <div className="flex items-center justify-between bg-white border border-zinc-200/80 rounded-2xl px-3.5 py-2.5 shadow-2xs">
        <NestedZoneBreadcrumb path={path} onNavigateToLevel={handleNavigateBreadcrumb} />
        <button
          type="button"
          onClick={onExitFocus}
          className="text-[11px] font-bold text-zinc-600 hover:text-zinc-900 flex items-center gap-1 cursor-pointer transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Toàn trang</span>
        </button>
      </div>

      {/* 2. Sub-Grid Matrix Config Panel (Columns/Rows Steppers & Presets) */}
      <SubGridConfigPanel
        currentZone={currentZone}
        onUpdateSubGridConfig={handleUpdateSubGridConfig}
        onApplyPreset={handleApplyPreset}
      />

      {/* 3. Sub-Zone Tree List */}
      <SubZoneTreeList
        subZones={currentZone.subZones || []}
        selectedSubZoneId={selectedSubZoneId}
        onSelectSubZone={setSelectedSubZoneId}
        onDrillDown={(subId) => {
          onFocusZone(subId);
          setSelectedSubZoneId(null);
        }}
        onDeleteSubZone={handleDeleteSubZone}
      />

      {/* 4. Sub-Zone Property Inspector (When a child zone is selected) */}
      {selectedSubZone && (
        <SubZonePropertiesInspector
          selectedSubZone={selectedSubZone}
          allElements={elements}
          onUpdateSubZone={handleUpdateSubZone}
          onUpdateElement={onUpdateElement}
        />
      )}
    </div>
  );
};
export default NestedZoneStudio;
