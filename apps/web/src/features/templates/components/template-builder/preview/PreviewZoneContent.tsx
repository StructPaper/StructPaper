'use client';

import React from 'react';
import {
  LayoutZoneConfig,
  SemanticElement,
  FloatingElementsDesignRules,
} from '@/types/template-builder';
import { resolveZoneCssStyle } from '@/lib/template-engine/css-style-resolver';
import { DynamicElementRenderer } from './DynamicElementRenderer';
import { InlineWordEditor } from './InlineWordEditor';

interface PreviewZoneContentProps {
  zone: LayoutZoneConfig;
  zoneElements: SemanticElement[];
  allElements?: SemanticElement[];
  primaryColor: string;
  floatingRules?: FloatingElementsDesignRules;
  unitMultiplier: number;
  onSelectElement?: (elementId: string) => void;
  onUpdateElement?: (elementId: string, updated: Partial<SemanticElement>) => void;
  onDuplicateElement?: (elementId: string) => void;
  onDeleteElement?: (elementId: string) => void;
  onNavigateToStep?: (step: string) => void;
  showGridOverlay?: boolean;
  editingElementId?: string | null;
  editText?: string;
  setEditText?: (text: string) => void;
  onStartInlineEdit?: (element: SemanticElement) => void;
  onSaveInlineEdit?: (elementId: string, text: string) => void;
  onCancelInlineEdit?: () => void;
  onContextMenuElement?: (element: SemanticElement, e: React.MouseEvent) => void;
}

/**
 * Renders the layout content for a specific Zone (CSS Grid, Flexbox, Multi-column, Hybrid Sub-slots, or Fallbacks)
 */
export const PreviewZoneContent: React.FC<PreviewZoneContentProps> = ({
  zone,
  zoneElements,
  allElements,
  primaryColor,
  floatingRules,
  unitMultiplier,
  onSelectElement,
  onUpdateElement,
  onDuplicateElement,
  onDeleteElement,
  onNavigateToStep,
  showGridOverlay = false,
  editingElementId = null,
  editText = '',
  setEditText,
  onStartInlineEdit,
  onSaveInlineEdit,
  onCancelInlineEdit,
  onContextMenuElement,
}) => {
  const renderInteractiveElement = (el: SemanticElement) => {
    const isEditing = editingElementId === el.id;

    if (isEditing) {
      return (
        <div
          key={el.id}
          id={`preview-el-${el.id}-editing`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="relative transition-all duration-150 rounded-sm outline-2 outline-dashed outline-[#78C841] outline-offset-2 bg-[#78C841]/5 select-text"
        >
          {/* Subtle Floating Status Pill - Floats unobtrusively above without altering layout */}
          <div className="absolute -top-6 left-0 z-50 pointer-events-none flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900/95 text-white text-[9px] font-sans shadow-lg animate-fadeIn whitespace-nowrap border border-white/10 select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#78C841] animate-pulse" />
            <span className="font-semibold text-lime-300">Đang sửa trực tiếp ({el.name}):</span>
            <span className="text-zinc-300">Bấm ra ngoài để lưu • Esc hủy</span>
          </div>

          <InlineWordEditor
            element={el}
            initialText={editText}
            primaryColor={primaryColor}
            floatingRules={floatingRules}
            onSave={(newText) => onSaveInlineEdit?.(el.id, newText)}
            onCancel={() => onCancelInlineEdit?.()}
          />
        </div>
      );
    }

    return (
      <div
        key={el.id}
        id={`preview-el-${el.id}`}
        onClick={(e) => {
          e.stopPropagation();
          onSelectElement?.(el.id);
        }}
        onDoubleClick={(e) => {
          if (!showGridOverlay) {
            e.stopPropagation();
            e.preventDefault();
            onStartInlineEdit?.(el);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenuElement?.(el, e);
        }}
        className="relative group cursor-pointer transition-all duration-150 rounded-sm select-none hover:outline-2 hover:outline-dashed hover:outline-[#78C841] hover:outline-offset-2 hover:bg-[#78C841]/5"
        title={`${el.name} (Kích đúp để sửa chữ trực tiếp, Chuột phải để chỉnh định dạng Word/Excel)`}
      >
        {/* Floating Tag Badge: Only on hover, clean name text only */}
        <span className="absolute -top-3.5 right-1.5 bg-slate-900/95 text-white text-[8pt] font-medium px-2 py-0.5 rounded-full shadow-md z-30 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap flex items-center gap-1.5">
          <span>{el.name}</span>
          <span className="text-[7pt] text-zinc-400 font-mono">✎ Đúp chuột / Phải chuột</span>
        </span>

        <DynamicElementRenderer
          element={el}
          primaryColor={primaryColor}
          floatingRules={floatingRules}
        />
      </div>
    );
  };

  // 0. HIERARCHICAL RECURSIVE SUB-ZONES & SUB-GRID ENGINE
  if (zone.subZones && zone.subZones.length > 0) {
    const subGrid = zone.subGridConfig || {
      enabled: true,
      columns: zone.subZones.length,
      rows: 1,
      colGap: 6,
      rowGap: 6,
      unit: 'px',
    };

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${subGrid.columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${subGrid.rows}, minmax(0, 1fr))`,
          columnGap: `${subGrid.colGap || 6}px`,
          rowGap: `${subGrid.rowGap || 6}px`,
          width: '100%',
          height: '100%',
          position: 'relative',
        }}
        className="w-full h-full"
      >
        {zone.subZones.map((sz: LayoutZoneConfig, idx: number) => {
          const area = sz.gridArea || {
            rowStart: 1,
            colStart: idx + 1,
            rowSpan: 1,
            colSpan: 1,
          };
          const source = allElements || zoneElements;
          const szElements = source
            .filter((el: SemanticElement) => el.zoneId === sz.id && el.visible)
            .sort((a: SemanticElement, b: SemanticElement) => a.order - b.order);

          return (
            <div
              key={sz.id}
              style={{
                gridRow: `${area.rowStart} / span ${area.rowSpan}`,
                gridColumn: `${area.colStart} / span ${area.colSpan}`,
              }}
              className="min-w-0 min-h-0 relative flex flex-col"
            >
              <PreviewZoneContent
                zone={sz}
                zoneElements={szElements}
                allElements={allElements}
                primaryColor={primaryColor}
                floatingRules={floatingRules}
                unitMultiplier={unitMultiplier}
                onSelectElement={onSelectElement}
                onUpdateElement={onUpdateElement}
                onDuplicateElement={onDuplicateElement}
                onDeleteElement={onDeleteElement}
                onNavigateToStep={onNavigateToStep}
                showGridOverlay={showGridOverlay}
                editingElementId={editingElementId}
                editText={editText}
                setEditText={setEditText}
                onStartInlineEdit={onStartInlineEdit}
                onSaveInlineEdit={onSaveInlineEdit}
                onCancelInlineEdit={onCancelInlineEdit}
                onContextMenuElement={onContextMenuElement}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // 1. HIGH-PRECISION CSS LAYOUT ENGINE (ZoneCssLayout: Grid, Flex, Columns, Block, Hybrid Sub-Slots)
  if (zone.cssLayout) {
    const layoutStyle = resolveZoneCssStyle(zone.cssLayout, unitMultiplier);
    const subSlots = zone.cssLayout.subSlots || [];

    // If hybrid sub-slots are defined, render elements partitioned by subSlotId
    if (subSlots.length > 0) {
      return (
        <div style={layoutStyle} className="w-full h-full">
          {subSlots.map((slot) => {
            const slotElements = zoneElements.filter((el) => el.subSlotId === slot.id);
            const slotStyle: React.CSSProperties = {
              display: slot.display,
              boxSizing: 'border-box',
            };

            if (slot.display === 'grid' && slot.grid) {
              slotStyle.gridTemplateColumns = slot.grid.templateColumns;
              slotStyle.columnGap = `${slot.grid.columnGapMm * unitMultiplier}px`;
              slotStyle.rowGap = `${slot.grid.rowGapMm * unitMultiplier}px`;
            } else if (slot.display === 'flex' && slot.flex) {
              slotStyle.flexDirection = slot.flex.direction;
              slotStyle.justifyContent = slot.flex.justifyContent;
              slotStyle.alignItems = slot.flex.alignItems;
              slotStyle.gap = `${slot.flex.gapMm * unitMultiplier}px`;
            } else if (slot.display === 'columns' && slot.columns) {
              slotStyle.columnCount = slot.columns.columnCount;
              slotStyle.columnGap = `${slot.columns.columnGapMm * unitMultiplier}px`;
            }

            return (
              <div key={slot.id} style={slotStyle} className="min-w-0 min-h-0">
                {slotElements.map((el) => renderInteractiveElement(el))}
              </div>
            );
          })}
        </div>
      );
    }

    // Single unified CSS Display container
    if (zone.cssLayout.display === 'columns' && zone.cssLayout.columns) {
      return (
        <div style={layoutStyle} className="w-full h-full">
          {zoneElements.map((el) => {
            const isSpanning = Boolean(el.spanColumns);
            return (
              <div
                key={el.id}
                style={{ columnSpan: isSpanning ? 'all' : undefined }}
                className={`mb-2 ${isSpanning ? 'w-full' : ''}`}
              >
                {renderInteractiveElement(el)}
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <div style={layoutStyle} className="w-full h-full">
        {zoneElements.map((el) => renderInteractiveElement(el))}
      </div>
    );
  }

  // 2. FALLBACK LEGACY MULTI-COLUMN
  if (zone.type === 'multi-column') {
    return (
      <div
        style={{
          columnCount: zone.columns || 2,
          columnGap: `${(zone.columnGap || 6) * unitMultiplier}px`,
          columnRule: zone.showColumnRule
            ? `1px solid ${zone.columnRuleColor || '#CBD5E1'}`
            : 'none',
          columnFill: zone.balanceLastPageColumns !== false ? 'balance' : 'auto',
          height: '100%',
        }}
        className="h-full w-full"
      >
        {zoneElements.map((el) => {
          const isSpanning = Boolean(el.spanColumns);
          const isHeading = el.type === 'heading';
          const isBody = el.type === 'body-text' || el.type === 'abstract-box';

          let breakClass = 'mb-2';
          if (isHeading) {
            breakClass = 'break-after-avoid mb-1';
          } else if (isBody) {
            breakClass = 'mb-1.5';
          } else {
            breakClass = 'break-inside-avoid mb-2';
          }

          return (
            <div
              key={el.id}
              style={{
                columnSpan: isSpanning ? 'all' : undefined,
              }}
              className={`${breakClass} ${isSpanning ? 'w-full' : ''}`}
            >
              {renderInteractiveElement(el)}
            </div>
          );
        })}
      </div>
    );
  }

  // 3. FALLBACK LEGACY SIDEBAR-SPLIT (VNUHCM-HS specific layout)
  if (zone.type === 'sidebar-split') {
    const isSidebarElement = (el: SemanticElement) => {
      if ((el as any).columnSlot === 'sidebar') return true;
      if ((el as any).columnSlot === 'content' || (el as any).columnSlot === 'bottom') return false;
      if (
        el.id.includes('sidebar') ||
        el.id.includes('meta') ||
        el.id.includes('qr') ||
        el.id.includes('affil')
      )
        return true;
      if (el.type === 'metadata-grid' || el.type === 'affiliation-list') return true;
      if (el.type === 'link-box' && el.specialProps?.showQrCode) return true;
      return false;
    };

    const leftElements = zoneElements.filter(isSidebarElement);
    const leftTop = leftElements.filter((el) => el.type === 'link-box' || el.id.includes('qr'));
    const leftBottom = leftElements.filter((el) => !leftTop.includes(el));

    const rightElements = zoneElements.filter((el) => !isSidebarElement(el));
    const rightBottom = rightElements.filter(
      (el) =>
        (el as any).columnSlot === 'bottom' ||
        el.id.includes('cite_strip') ||
        (el.type === 'custom-block' &&
          el.specialProps?.customContentSample?.toLowerCase().includes('trích dẫn'))
    );
    const rightMain = rightElements.filter((el) => !rightBottom.includes(el));
    const rightSpanning = rightMain.filter(
      (el) => el.spanColumns || el.type === 'abstract-box' || el.type === 'keywords-group'
    );
    const rightColumnar = rightMain.filter((el) => !rightSpanning.includes(el));

    const subColumns = zone.columns || 2;

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `${zone.sidebarWidthPercentage || 24.5}% 1fr`,
          columnGap: `${(zone.columnGap || 3.8) * unitMultiplier}px`,
          height: '100%',
        }}
        className="h-full w-full"
      >
        {/* Left Sidebar */}
        <div
          style={{
            borderRight: zone.showColumnRule
              ? `1px solid ${zone.columnRuleColor || '#CBD5E1'}`
              : 'none',
          }}
          className="pr-2 flex flex-col justify-between font-sans h-full text-[7pt] leading-tight"
        >
          {leftTop.length > 0 && (
            <div className="flex flex-col items-center justify-start text-center pt-1">
              {leftTop.map((el) => renderInteractiveElement(el))}
            </div>
          )}

          {leftBottom.length > 0 && (
            <div className="border-t border-slate-300 pt-1 space-y-1 mt-auto">
              {leftBottom.map((el) => renderInteractiveElement(el))}
            </div>
          )}
        </div>

        {/* Right Main Area */}
        <div className="pl-1 min-w-0 flex flex-col justify-between h-full">
          {/* Top Spanning Elements (Abstract, Keywords) */}
          {rightSpanning.length > 0 && (
            <div className="space-y-1.5 flex-shrink-0">
              {rightSpanning.map((el) => renderInteractiveElement(el))}
            </div>
          )}

          {/* Columnar Elements (Headings, Body text in 2 columns) */}
          {rightColumnar.length > 0 && (
            <div
              style={{
                columnCount: subColumns,
                columnGap: `${(zone.columnGap || 4.23) * unitMultiplier}px`,
                columnFill: 'auto',
              }}
              className="w-full flex-1 min-h-0 text-justify font-serif text-[8.55pt] leading-[1.22] text-[#1A1A1A] overflow-hidden mt-1"
            >
              {rightColumnar.map((el) => renderInteractiveElement(el))}
            </div>
          )}

          {/* Bottom Elements (Citation Strip + Page Number 1) */}
          {rightBottom.length > 0 && (
            <div className="flex-shrink-0 mt-auto pt-2 space-y-0.5">
              {rightBottom.map((el) => renderInteractiveElement(el))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. DEFAULT FULL-WIDTH BLOCK FLOW
  return (
    <div className="h-full w-full space-y-2">
      {zoneElements.map((el) => renderInteractiveElement(el))}
    </div>
  );
};
