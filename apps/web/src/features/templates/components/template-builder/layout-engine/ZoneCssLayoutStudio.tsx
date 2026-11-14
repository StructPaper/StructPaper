'use client';

import React, { useState } from 'react';
import {
  ZoneCssLayout,
  CssDisplayMode,
  DEFAULT_FULL_WIDTH_BLOCK_LAYOUT,
  DEFAULT_TWO_COLUMN_LAYOUT,
  DEFAULT_SIDEBAR_SPLIT_LAYOUT,
} from '@/types/template-engine/layout';
import { LayoutZoneConfig, SemanticElement } from '@/types/template-builder';
import { zoneToCssLayout, applyCssLayoutToZone } from '@/lib/template-engine/adapter';
import { DisplayModeSwitcher } from './DisplayModeSwitcher';
import { CssGridEditor } from './CssGridEditor';
import { CssFlexEditor } from './CssFlexEditor';
import { CssColumnsEditor } from './CssColumnsEditor';
import { CssBoxModelEditor } from './CssBoxModelEditor';
import { HybridSubSlotsEditor } from './HybridSubSlotsEditor';
import { Code, Sparkles, Layers, Sliders, Box } from 'lucide-react';

interface ZoneCssLayoutStudioProps {
  zone: LayoutZoneConfig;
  allZones: LayoutZoneConfig[];
  elements: SemanticElement[];
  onUpdateZone: (updatedZone: LayoutZoneConfig) => void;
  onUpdateElement: (elementId: string, updated: Partial<SemanticElement>) => void;
}

export const ZoneCssLayoutStudio: React.FC<ZoneCssLayoutStudioProps> = ({
  zone,
  allZones,
  elements,
  onUpdateZone,
  onUpdateElement,
}) => {
  const [activeTab, setActiveTab] = useState<'display' | 'box-model' | 'sub-slots' | 'css-preview'>('display');

  // Ensure zone has a valid cssLayout
  const currentLayout: ZoneCssLayout = zoneToCssLayout(zone);
  const zoneElements = elements.filter((el) => el.zoneId === zone.id);

  const handleUpdateLayout = (updated: Partial<ZoneCssLayout>) => {
    const nextLayout: ZoneCssLayout = {
      ...currentLayout,
      ...updated,
    };
    const nextZone = applyCssLayoutToZone(zone, nextLayout);
    onUpdateZone(nextZone);
  };

  const handleModeChange = (mode: CssDisplayMode) => {
    let nextLayout: ZoneCssLayout = {
      ...currentLayout,
      display: mode,
    };

    if (mode === 'grid' && !nextLayout.grid) {
      nextLayout.grid = {
        templateColumns: '1fr 1fr',
        columnGapMm: 6,
        rowGapMm: 4,
        justifyItems: 'stretch',
        alignItems: 'stretch',
      };
    } else if (mode === 'flex' && !nextLayout.flex) {
      nextLayout.flex = {
        direction: 'row',
        wrap: 'nowrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gapMm: 4,
      };
    } else if (mode === 'columns' && !nextLayout.columns) {
      nextLayout.columns = {
        columnCount: 2,
        columnGapMm: 6,
        columnRule: { show: false, style: 'solid', color: '#CBD5E1', widthPt: 0.5 },
        columnFill: 'balance',
      };
    }

    const nextZone = applyCssLayoutToZone(zone, nextLayout);
    onUpdateZone(nextZone);
  };

  // Quick Preset Loader
  const handleApplyPreset = (presetKey: '1-col' | '2-col' | 'sidebar' | 'flex-row') => {
    let preset: ZoneCssLayout;
    if (presetKey === '1-col') {
      preset = { ...DEFAULT_FULL_WIDTH_BLOCK_LAYOUT, id: zone.id, name: zone.name };
    } else if (presetKey === '2-col') {
      preset = { ...DEFAULT_TWO_COLUMN_LAYOUT, id: zone.id, name: zone.name };
    } else if (presetKey === 'sidebar') {
      preset = { ...DEFAULT_SIDEBAR_SPLIT_LAYOUT, id: zone.id, name: zone.name };
    } else {
      preset = {
        id: zone.id,
        name: zone.name,
        display: 'flex',
        flex: {
          direction: 'row',
          wrap: 'nowrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gapMm: 6,
        },
        boxModel: currentLayout.boxModel,
      };
    }
    const nextZone = applyCssLayoutToZone(zone, preset);
    onUpdateZone(nextZone);
  };

  // Generate CSS string representation for CSS Preview tab
  const generateCssString = (): string => {
    const lines: string[] = [];
    lines.push(`/* CSS Layout rules for zone: ${zone.name} */`);
    lines.push(`.zone-${zone.id} {`);
    lines.push(`  display: ${currentLayout.display};`);

    if (currentLayout.display === 'grid' && currentLayout.grid) {
      lines.push(`  grid-template-columns: ${currentLayout.grid.templateColumns};`);
      lines.push(`  column-gap: ${currentLayout.grid.columnGapMm}mm;`);
      lines.push(`  row-gap: ${currentLayout.grid.rowGapMm}mm;`);
      if (currentLayout.grid.justifyItems) lines.push(`  justify-items: ${currentLayout.grid.justifyItems};`);
      if (currentLayout.grid.alignItems) lines.push(`  align-items: ${currentLayout.grid.alignItems};`);
    } else if (currentLayout.display === 'flex' && currentLayout.flex) {
      lines.push(`  flex-direction: ${currentLayout.flex.direction};`);
      lines.push(`  flex-wrap: ${currentLayout.flex.wrap};`);
      lines.push(`  justify-content: ${currentLayout.flex.justifyContent};`);
      lines.push(`  align-items: ${currentLayout.flex.alignItems};`);
      lines.push(`  gap: ${currentLayout.flex.gapMm}mm;`);
    } else if (currentLayout.display === 'columns' && currentLayout.columns) {
      lines.push(`  column-count: ${currentLayout.columns.columnCount};`);
      lines.push(`  column-gap: ${currentLayout.columns.columnGapMm}mm;`);
      if (currentLayout.columns.columnRule.show) {
        lines.push(
          `  column-rule: ${currentLayout.columns.columnRule.widthPt}pt ${currentLayout.columns.columnRule.style} ${currentLayout.columns.columnRule.color};`
        );
      }
      lines.push(`  column-fill: ${currentLayout.columns.columnFill};`);
    }

    // Box model
    const bm = currentLayout.boxModel;
    if (bm) {
      lines.push(`  margin: ${bm.margin.topMm}mm ${bm.margin.rightMm}mm ${bm.margin.bottomMm}mm ${bm.margin.leftMm}mm;`);
      lines.push(`  padding: ${bm.padding.topMm}mm ${bm.padding.rightMm}mm ${bm.padding.bottomMm}mm ${bm.padding.leftMm}mm;`);
      if (bm.border.show) {
        lines.push(`  border: ${bm.border.widthPt}pt ${bm.border.style} ${bm.border.color};`);
        if (bm.border.radiusPx) lines.push(`  border-radius: ${bm.border.radiusPx}px;`);
      }
      if (bm.backgroundColor && bm.backgroundColor !== 'transparent') {
        lines.push(`  background-color: ${bm.backgroundColor};`);
      }
    }
    lines.push(`}`);
    return lines.join('\n');
  };

  return (
    <div className="space-y-3">
      {/* Quick Layout Presets Bar */}
      <div className="flex items-center justify-between p-2.5 rounded-2xl bg-zinc-100 border border-zinc-200/80">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-zinc-700" />
          <span className="text-xs font-bold text-zinc-800">Mẫu bố cục nhanh:</span>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleApplyPreset('1-col')}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold border border-zinc-200/80 shadow-2xs transition-all cursor-pointer"
          >
            1 Cột (#block)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('2-col')}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold border border-zinc-200/80 shadow-2xs transition-all cursor-pointer"
          >
            2 Cột (#columns)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('sidebar')}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold border border-zinc-200/80 shadow-2xs transition-all cursor-pointer"
          >
            Sidebar (28:72)
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('flex-row')}
            className="px-2.5 py-1 rounded-xl bg-white hover:bg-zinc-50 text-zinc-800 text-xs font-bold border border-zinc-200/80 shadow-2xs transition-all cursor-pointer"
          >
            Flex (#stack)
          </button>
        </div>
      </div>

      {/* Main Studio Navigation Tabs (Pill style matching StructPaper) */}
      <div className="flex items-center gap-1 overflow-x-auto p-1 bg-zinc-200/70 rounded-2xl no-scrollbar scrollbar-none w-full select-none">
        {[
          { id: 'display', label: `Bố Cục (${currentLayout.display.toUpperCase()})`, icon: <Sliders className="w-3.5 h-3.5" /> },
          { id: 'box-model', label: 'Khung Bao (#block)', icon: <Box className="w-3.5 h-3.5" /> },
          { id: 'sub-slots', label: `Sub-Slots (${currentLayout.subSlots?.length || 0})`, icon: <Layers className="w-3.5 h-3.5" /> },
          { id: 'css-preview', label: 'Cú pháp & Typst', icon: <Code className="w-3.5 h-3.5" /> },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer select-none flex-1 min-w-fit ${
                isActive
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

      {/* Tab 1: Display Mode & Specific Mode Settings */}
      {activeTab === 'display' && (
        <div className="space-y-3">
          <DisplayModeSwitcher
            currentMode={currentLayout.display}
            onChange={handleModeChange}
          />

          {currentLayout.display === 'grid' && (
            <CssGridEditor
              config={
                currentLayout.grid || {
                  templateColumns: '1fr 1fr',
                  columnGapMm: 6,
                  rowGapMm: 4,
                  justifyItems: 'stretch',
                  alignItems: 'stretch',
                }
              }
              onChange={(updated) =>
                handleUpdateLayout({
                  grid: {
                    ...(currentLayout.grid || {
                      templateColumns: '1fr 1fr',
                      columnGapMm: 6,
                      rowGapMm: 4,
                    }),
                    ...updated,
                  },
                })
              }
            />
          )}

          {currentLayout.display === 'flex' && (
            <CssFlexEditor
              config={
                currentLayout.flex || {
                  direction: 'row',
                  wrap: 'nowrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gapMm: 4,
                }
              }
              onChange={(updated) =>
                handleUpdateLayout({
                  flex: {
                    ...(currentLayout.flex || {
                      direction: 'row',
                      wrap: 'nowrap',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gapMm: 4,
                    }),
                    ...updated,
                  },
                })
              }
            />
          )}

          {currentLayout.display === 'columns' && (
            <CssColumnsEditor
              config={
                currentLayout.columns || {
                  columnCount: 2,
                  columnGapMm: 6,
                  columnRule: { show: false, style: 'solid', color: '#CBD5E1', widthPt: 0.5 },
                  columnFill: 'balance',
                }
              }
              onChange={(updated) =>
                handleUpdateLayout({
                  columns: {
                    ...(currentLayout.columns || {
                      columnCount: 2,
                      columnGapMm: 6,
                      columnRule: { show: false, style: 'solid', color: '#CBD5E1', widthPt: 0.5 },
                      columnFill: 'balance',
                    }),
                    ...updated,
                  },
                })
              }
            />
          )}

          {currentLayout.display === 'block' && (
            <div className="p-3 bg-zinc-50/80 rounded-xl border border-zinc-200 text-xs text-zinc-600 space-y-1">
              <span className="font-bold text-zinc-800">Block Flow (Dòng chảy khối)</span>
              <p>
                Các phần tử bài báo xếp chồng theo thứ tự từ trên xuống dưới, tự động dàn trải 100% chiều rộng của phân vùng.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Box Model */}
      {activeTab === 'box-model' && (
        <CssBoxModelEditor
          boxModel={currentLayout.boxModel}
          onChange={(updated) =>
            handleUpdateLayout({
              boxModel: {
                ...currentLayout.boxModel,
                ...updated,
              },
            })
          }
        />
      )}

      {/* Tab 3: Hybrid Sub-Slots */}
      {activeTab === 'sub-slots' && (
        <HybridSubSlotsEditor
          subSlots={currentLayout.subSlots}
          zoneElements={zoneElements}
          onChange={(subSlots) => handleUpdateLayout({ subSlots })}
          onAssignElementToSlot={(elId, slotId) =>
            onUpdateElement(elId, { subSlotId: slotId })
          }
        />
      )}

      {/* Tab 4: Generated CSS Snippet */}
      {activeTab === 'css-preview' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-zinc-600">
              Mã CSS sinh động (Compiled CSS Ruleset):
            </span>
          </div>
          <pre className="p-3 rounded-xl bg-zinc-900 text-emerald-400 font-mono text-[11px] overflow-x-auto select-all">
            {generateCssString()}
          </pre>
        </div>
      )}
    </div>
  );
};
