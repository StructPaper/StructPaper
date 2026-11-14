'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  UniversalTemplateSchema,
  BuilderStudioStep,
  SemanticElement,
  LayoutZoneConfig,
  PageArchitectureConfig,
  TemplateGridConfig,
  GridAreaCoords,
  FloatingElementsDesignRules,
} from '@/types/template-builder';
import { VNUHCM_HEALTH_SCIENCES_TEMPLATE } from '@/data/templates';
import {
  templateRegistry,
  exportTemplateToFile,
  importTemplateFromFile,
} from '@/lib/template-engine/storage';

import { TemplateBuilderDock } from './TemplateBuilderDock';
import { ResizableSplitLayout } from '@/features/editor';
import { UniversalLiveA4Preview } from './UniversalLiveA4Preview';

// Step Components
import { Step1PageAndZones } from './steps/Step1PageAndZones';
import { Step15GridZones } from './steps/Step15GridZones';
import { Step2ElementStructure } from './steps/Step2ElementStructure';
import { Step3DeepStyling } from './steps/Step3DeepStyling';
import { StepSpecialElements } from './steps/StepSpecialElements';
import { ElementsManagerView } from './elements-manager/ElementsManagerView';

import { ArrowLeft, Save } from 'lucide-react';
import { toast } from '@/components/toast';
import { ActionConfirmModal } from '@/components/modals';
import { useCustomTemplateSave } from '../../hooks/useCustomTemplateSave';
import {
  addChildSubZone,
  updateZoneDeep,
  deleteZoneDeep,
  flattenAllZones,
} from './nested-zones/nestedZoneUtils';

interface TemplateBuilderViewProps {
  initialSchema?: UniversalTemplateSchema;
  initialPage?: number;
  onBackToHub?: () => void;
}

// Helper to guarantee every zone has a valid gridArea and gridConfig
function ensureSchemaHasGrid(inputSchema: UniversalTemplateSchema): UniversalTemplateSchema {
  const columns = inputSchema.gridConfig?.columns || 4;
  const rows = inputSchema.gridConfig?.rows || 5;

  const gridConfig: TemplateGridConfig = {
    enabled: true,
    columns,
    rows,
    rowGap: inputSchema.gridConfig?.rowGap ?? 8,
    colGap: inputSchema.gridConfig?.colGap ?? 8,
    gapSync: inputSchema.gridConfig?.gapSync ?? true,
    unit: inputSchema.gridConfig?.unit || 'px',
  };

  const zones = inputSchema.zones.map((zone, idx) => {
    if (zone.gridArea && zone.gridArea.rowStart && zone.gridArea.colStart) {
      return zone;
    }
    // Auto-map based on index and total zones
    if (inputSchema.zones.length === 1) {
      return { ...zone, gridArea: { rowStart: 1, colStart: 1, rowSpan: rows, colSpan: columns } };
    }
    if (inputSchema.zones.length === 2) {
      if (idx === 0) {
        return { ...zone, gridArea: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: columns } };
      }
      return { ...zone, gridArea: { rowStart: 2, colStart: 1, rowSpan: rows - 1, colSpan: columns } };
    }
    if (inputSchema.zones.length === 3) {
      if (idx === 0) {
        return { ...zone, gridArea: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: columns } };
      }
      const halfCol = Math.max(1, Math.floor(columns / 2));
      if (idx === 1) {
        return { ...zone, gridArea: { rowStart: 2, colStart: 1, rowSpan: rows - 1, colSpan: halfCol } };
      }
      return { ...zone, gridArea: { rowStart: 2, colStart: halfCol + 1, rowSpan: rows - 1, colSpan: columns - halfCol } };
    }
    // Fallback: stacked rows
    const rowSpan = Math.max(1, Math.floor(rows / inputSchema.zones.length));
    const rowStart = 1 + idx * rowSpan;
    return {
      ...zone,
      gridArea: {
        rowStart: Math.min(rowStart, rows),
        colStart: 1,
        rowSpan: Math.min(rowSpan, rows - rowStart + 1),
        colSpan: columns,
      },
    };
  });

  return {
    ...inputSchema,
    gridConfig,
    zones,
  };
}

export const TemplateBuilderView: React.FC<TemplateBuilderViewProps> = ({
  initialSchema,
  initialPage = 1,
  onBackToHub,
}) => {
  const [schema, setSchema] = useState<UniversalTemplateSchema>(() => {
    if (initialSchema) return ensureSchemaHasGrid(initialSchema);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('structpaper_active_universal_template');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.pageArchitecture && parsed.zones && parsed.elements) {
            return ensureSchemaHasGrid(parsed);
          }
        } catch {}
      }
    }
    return ensureSchemaHasGrid(VNUHCM_HEALTH_SCIENCES_TEMPLATE);
  });

  const [isDirty, setIsDirty] = useState(false);

  // Tách biệt logic kiểm tra tính duy nhất & lưu custom template sang custom hook
  const {
    isSaveConfirmOpen,
    isSaving,
    saveSuccess,
    requestSave: handleRequestSaveToLibrary,
    confirmSave: handleSaveToLibrary,
    cancelSave: handleCancelSaveToLibrary,
  } = useCustomTemplateSave({
    schema,
    setIsDirty,
  });
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    schema.zones[0]?.id || null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevTemplateIdRef = useRef<string | null>(null);

  // If initialSchema changes from parent (e.g. user selected another preset), update state
  useEffect(() => {
    if (initialSchema && initialSchema.id !== prevTemplateIdRef.current) {
      prevTemplateIdRef.current = initialSchema.id;
      const withGrid = ensureSchemaHasGrid(initialSchema);
      setSchema(withGrid);
      setSelectedElementId(withGrid.elements[0]?.id || null);
      setSelectedZoneId(withGrid.zones[0]?.id || null);
      setIsDirty(false);
    }
  }, [initialSchema]);

  const [currentStep, setCurrentStep] = useState<BuilderStudioStep>('page-zones');
  const [isExpandedPreview, setIsExpandedPreview] = useState<boolean>(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(
    schema.elements[0]?.id || null
  );

  const [gridOverlayActive, setGridOverlayActive] = useState<boolean>(false);
  const [demoSpecialElements, setDemoSpecialElements] = useState<boolean>(false);
  const [focusedZoneId, setFocusedZoneId] = useState<string | null>(null);

  // Auto-save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'structpaper_active_universal_template',
        JSON.stringify(schema)
      );
    } catch {}
  }, [schema]);

  // Update Page Architecture
  const handlePageChange = (updated: Partial<PageArchitectureConfig>) => {
    setIsDirty(true);
    setSchema((prev) => ({
      ...prev,
      pageArchitecture: { ...prev.pageArchitecture, ...updated },
      updatedAt: new Date().toISOString().split('T')[0],
    }));
  };

  // Update Zones with automatic sequential reindexing
  const handleZonesChange = (zones: LayoutZoneConfig[]) => {
    setIsDirty(true);
    const reindexedZones = zones.map((z, idx) => ({ ...z, order: idx + 1 }));
    setSchema((prev) => {
      const activeZoneIds = new Set(reindexedZones.map((z) => z.id));
      const preservedElements = prev.elements.map((el) => {
        // If element belonged to a zone that was deleted, keep it safe by moving to unassigned ('')
        if (el.zoneId && !activeZoneIds.has(el.zoneId)) {
          return { ...el, zoneId: '' };
        }
        return el;
      });

      return {
        ...prev,
        zones: reindexedZones,
        elements: preservedElements,
        updatedAt: new Date().toISOString().split('T')[0],
      };
    });
  };

  // Update Grid Config
  const handleGridConfigChange = (gridConfig: TemplateGridConfig) => {
    setIsDirty(true);
    setSchema((prev) => ({
      ...prev,
      gridConfig,
      updatedAt: new Date().toISOString().split('T')[0],
    }));
  };

  // Add a new zone from paper grid overlay (strictly continuous numbering in whole template)
  const handleAddZoneWithArea = (area: GridAreaCoords, pageNumber: number = 1) => {
    setIsDirty(true);
    setSchema((prev) => {
      const newIndex = prev.zones.length + 1;
      const pageScope = pageNumber === 1 ? 'first-page' : 'subsequent-pages';
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
        page: pageNumber,
        pageScope,
        subZones: [],
      };
      setSelectedZoneId(newZone.id);
      return {
        ...prev,
        zones: [...prev.zones, newZone],
        updatedAt: new Date().toISOString().split('T')[0],
      };
    });
    toast.success('Đã tạo phân vùng mới');
  };

  // Update a zone's gridArea
  const handleUpdateZoneArea = (zoneId: string, area: GridAreaCoords) => {
    setIsDirty(true);
    setSchema((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === zoneId ? { ...z, gridArea: area } : z)),
      updatedAt: new Date().toISOString().split('T')[0],
    }));
  };

  // Update a zone's secondaryGridArea (Linked flow block 2)
  const handleUpdateZoneSecondaryArea = (zoneId: string, area: GridAreaCoords | null) => {
    setIsDirty(true);
    setSchema((prev) => ({
      ...prev,
      zones: prev.zones.map((z) =>
        z.id === zoneId ? { ...z, secondaryGridArea: area || undefined } : z
      ),
      updatedAt: new Date().toISOString().split('T')[0],
    }));
  };

  // Delete a zone
  const handleDeleteZone = (zoneId: string) => {
    setIsDirty(true);
    setSchema((prev) => {
      const deleted = prev.zones.find((z) => z.id === zoneId);
      const nextZones = prev.zones.filter((z) => z.id !== zoneId);
      const reindexedZones = nextZones.map((z, idx) => ({ ...z, order: idx + 1 }));
      const activeZoneIds = new Set(reindexedZones.map((z) => z.id));
      const preservedElements = prev.elements.map((el) => {
        if (el.zoneId && !activeZoneIds.has(el.zoneId)) {
          return { ...el, zoneId: '' };
        }
        return el;
      });
      if (selectedZoneId === zoneId) {
        setSelectedZoneId(reindexedZones[0]?.id || null);
      }
      return {
        ...prev,
        zones: reindexedZones,
        elements: preservedElements,
        updatedAt: new Date().toISOString().split('T')[0],
      };
    });
    toast.success('Đã xóa phân vùng');
  };

  // Update zone name inline
  const handleUpdateZoneName = (zoneId: string, name: string) => {
    setIsDirty(true);
    setSchema((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === zoneId ? { ...z, name } : z)),
      updatedAt: new Date().toISOString().split('T')[0],
    }));
    toast.success('Đổi tên phân vùng', `Đã cập nhật tên thành "${name}"`);
  };

  // Add child sub-zone
  const handleAddSubZoneWithArea = (parentId: string, area: GridAreaCoords) => {
    setIsDirty(true);
    const { updatedZones, newChild } = addChildSubZone(schema.zones, parentId, area);
    handleZonesChange(updatedZones);
    toast.success('Đã tạo phân vùng con', `Đã tạo "${newChild.name}"`);
  };

  // Update a sub-zone at any depth
  const handleUpdateSubZone = (subZoneId: string, updated: Partial<LayoutZoneConfig>) => {
    setIsDirty(true);
    const updatedZones = updateZoneDeep(schema.zones, subZoneId, updated);
    handleZonesChange(updatedZones);
  };

  // Delete a sub-zone at any depth
  const handleDeleteSubZone = (subZoneId: string) => {
    setIsDirty(true);
    const updatedZones = deleteZoneDeep(schema.zones, subZoneId);
    handleZonesChange(updatedZones);
    toast.success('Đã xóa phân vùng con');
  };

  // Update Elements
  const handleElementsChange = (elements: SemanticElement[]) => {
    setIsDirty(true);
    setSchema((prev) => ({
      ...prev,
      elements,
      updatedAt: new Date().toISOString().split('T')[0],
    }));
  };

  // Update a single element
  const handleUpdateElement = (id: string, updated: Partial<SemanticElement>) => {
    setIsDirty(true);
    setSchema((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => (el.id === id ? { ...el, ...updated } : el)),
      updatedAt: new Date().toISOString().split('T')[0],
    }));
  };

  // Delete element
  const handleDeleteElement = (id: string) => {
    setIsDirty(true);
    const deleted = schema.elements.find((el) => el.id === id);
    setSchema((prev) => ({
      ...prev,
      elements: prev.elements.filter((el) => el.id !== id),
      updatedAt: new Date().toISOString().split('T')[0],
    }));
    toast.success('Đã xóa thành phần', `Đã xóa "${deleted?.name || 'thành phần'}"`);
  };

  // Duplicate element
  const handleDuplicateElement = (element: SemanticElement) => {
    setIsDirty(true);
    const duplicated: SemanticElement = {
      ...element,
      id: `${element.type}-${Date.now()}`,
      name: `${element.name} (Bản sao)`,
      order: element.order + 1,
    };
    setSchema((prev) => ({
      ...prev,
      elements: [...prev.elements, duplicated],
      updatedAt: new Date().toISOString().split('T')[0],
    }));
    toast.success('Đã nhân bản', `Đã tạo bản sao của "${element.name}"`);
  };

  // Add new element (e.g. from CompositeElementBuilder)
  const handleAddElement = (element: SemanticElement) => {
    setIsDirty(true);
    setSchema((prev) => ({
      ...prev,
      elements: [...prev.elements, element],
      updatedAt: new Date().toISOString().split('T')[0],
    }));
    setSelectedElementId(element.id);
    toast.success('Đã thêm thành phần mới', `Đã thêm "${element.name}" vào bố cục!`);
  };

  // Update Global Floating Rules for Special Elements
  const handleUpdateFloatingRules = (floatingRules: FloatingElementsDesignRules) => {
    setIsDirty(true);
    setSchema((prev) => ({
      ...prev,
      floatingRules,
      updatedAt: new Date().toISOString().split('T')[0],
    }));
  };

  // Update Primary Color
  const handleColorChange = (color: string) => {
    setIsDirty(true);
    setSchema((prev) => ({
      ...prev,
      primaryColor: color,
      updatedAt: new Date().toISOString().split('T')[0],
    }));
    toast.success('Đổi màu chủ đạo', `Đã chuyển sang mã màu: ${color}`);
  };

  // Drag & drop assign element to zone
  const handleAssignElementToZone = (elementId: string, zoneId: string) => {
    handleUpdateElement(elementId, { zoneId });
    const flattened = flattenAllZones(schema.zones);
    const targetZone =
      flattened.find((f) => f.zone.id === zoneId)?.zone ||
      schema.zones.find((z) => z.id === zoneId);
    const targetElement = schema.elements.find((e) => e.id === elementId);
    toast.success(
      'Gán phân vùng thành công',
      targetElement && targetZone
        ? `Đã chuyển "${targetElement.name}" vào "${targetZone.name}"`
        : 'Đã gán khối vào phân vùng mới'
    );
  };



  // Export JSON Schema using standard storage file service
  const handleExportJson = () => {
    try {
      exportTemplateToFile(schema);
      toast.success('Xuất file JSON', 'Đã tải xuống file template chuẩn StructPaper!');
    } catch {
      toast.error('Lỗi khi xuất file JSON');
    }
  };

  // Import JSON Schema using standard storage file service
  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const res = await importTemplateFromFile(file);
      if (res.success && res.schema) {
        const withGrid = ensureSchemaHasGrid(res.schema);
        setSchema(withGrid);
        setSelectedElementId(withGrid.elements[0]?.id || null);
        setSelectedZoneId(withGrid.zones[0]?.id || null);
        setIsDirty(false);
        toast.success('Nhập thành công', `Đã nạp template "${withGrid.name}"!`);
      } else {
        const firstErr =
          res.validation.errors[0]?.message ||
          'File JSON không đúng chuẩn UniversalTemplateSchema';
        toast.error('Lỗi cấu trúc', firstErr);
      }
    } catch (err: any) {
      toast.error('Lỗi đọc file', err?.message || 'Không thể đọc file JSON');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 1. Left Content: Configuration & Step Editor (Controlled purely by Dock navigation)
  const leftEditorContent = (
    <div className="h-full flex flex-col min-h-0 min-w-0 w-full overflow-hidden">
      {/* Scrollable configuration area */}
      <div className="flex-1 overflow-y-auto px-1 sm:px-2 py-1 space-y-4 min-h-0 custom-scrollbar">
        {currentStep === 'page-zones' && (
          <Step1PageAndZones
            pageConfig={schema.pageArchitecture}
            onPageChange={handlePageChange}
            primaryColor={schema.primaryColor}
            templateName={schema.name}
            onNameChange={(name) => setSchema((prev) => ({ ...prev, name }))}
            currentPresetId={schema.id}
            onNavigateToGridZones={() => {
              setCurrentStep('grid-zones');
            }}
            onPresetSelect={async (presetId) => {
              const loaded = await templateRegistry.loadTemplate(presetId);
              if (loaded) {
                const withGrid = ensureSchemaHasGrid(loaded);
                setSchema(withGrid);
                setSelectedElementId(withGrid.elements[0]?.id || null);
                setSelectedZoneId(withGrid.zones[0]?.id || null);
                toast.success('Đã nạp mẫu', withGrid.name);
              }
            }}
          />
        )}

        {currentStep === 'grid-zones' && (
          <Step15GridZones
            gridConfig={schema.gridConfig}
            zones={schema.zones}
            onZonesChange={handleZonesChange}
            onGridConfigChange={handleGridConfigChange}
            selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId}
            elements={schema.elements}
            onUpdateElement={handleUpdateElement}
            focusedZoneId={focusedZoneId}
            onFocusZone={setFocusedZoneId}
            currentPageNumber={initialPage || 1}
            onNavigateToBack={() => {
              setCurrentStep('page-zones');
            }}
            onNavigateToElements={() => {
              setCurrentStep('elements-tree');
            }}
          />
        )}

        {currentStep === 'elements-tree' && (
          <Step2ElementStructure
            elements={schema.elements}
            zones={schema.zones}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onElementsChange={handleElementsChange}
            onNavigateToStyling={(elemId) => {
              setSelectedElementId(elemId);
              setCurrentStep('deep-styling');
            }}
            onNavigateToBack={() => {
              setCurrentStep('grid-zones');
            }}
            onNavigateForward={() => {
              setCurrentStep('deep-styling');
            }}
          />
        )}

        {currentStep === 'deep-styling' && (
          <Step3DeepStyling
            elements={schema.elements}
            selectedElementId={selectedElementId}
            onSelectElement={setSelectedElementId}
            onUpdateElement={handleUpdateElement}
            primaryColor={schema.primaryColor}
            onNavigateToBack={() => {
              setCurrentStep('elements-tree');
            }}
            onNavigateForward={() => {
              setCurrentStep('special-elements');
            }}
          />
        )}

        {currentStep === 'special-elements' && (
          <StepSpecialElements
            floatingRules={schema.floatingRules}
            onUpdateFloatingRules={handleUpdateFloatingRules}
            primaryColor={schema.primaryColor}
            onNavigateToBack={() => {
              setCurrentStep('deep-styling');
            }}
            onNavigateForward={() => {
              setCurrentStep('preview-export');
            }}
            onNavigateToPreview={() => {
              setCurrentStep('preview-export');
            }}
          />
        )}



        {currentStep === 'advanced-manager' && (
          <ElementsManagerView
            schema={schema}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onDuplicateElement={handleDuplicateElement}
            onAddElement={handleAddElement}
            onNavigateToStep={(step) => setCurrentStep(step as BuilderStudioStep)}
          />
        )}
      </div>
    </div>
  );

  // Handlers for interactive click-to-focus from Live A4 Preview
  const handleSelectElementFromPreview = (elementId: string) => {
    setSelectedElementId(elementId);
    setCurrentStep('deep-styling');
  };

  const handleSelectHeaderFromPreview = () => {
    setCurrentStep('page-zones');
  };

  const handleToggleGridOverlay = () => {
    // Chỉ bật/tắt lưới hiển thị trên trang giấy, KHÔNG tự ý nhảy tab
    setGridOverlayActive((prev) => !prev);
  };

  // 2. Right Content: Live Paper Preview with Interactive Grid Overlay
  const rightPreviewContent = (
    <div className="h-full w-full overflow-hidden flex flex-col p-0.5 sm:p-0">
      <UniversalLiveA4Preview
        initialPage={initialPage}
        schema={schema}
        selectedElementId={selectedElementId}
        onSelectElement={handleSelectElementFromPreview}
        onSelectHeader={handleSelectHeaderFromPreview}
        showGridOverlay={gridOverlayActive}
        onToggleGridOverlay={handleToggleGridOverlay}
        isStep4={currentStep === 'special-elements'}
        demoSpecialElements={demoSpecialElements}
        onToggleDemoSpecialElements={() => setDemoSpecialElements((prev) => !prev)}
        onAddZoneWithArea={handleAddZoneWithArea}
        onUpdateZoneArea={handleUpdateZoneArea}
        onUpdateZoneSecondaryArea={handleUpdateZoneSecondaryArea}
        onDeleteZone={handleDeleteZone}
        onUpdateZoneName={handleUpdateZoneName}
        onDrillDownZone={(zoneId) => {
          setFocusedZoneId(zoneId);
          setCurrentStep('grid-zones');
        }}
        focusedZoneId={focusedZoneId}
        onFocusZone={setFocusedZoneId}
        onAddSubZoneWithArea={handleAddSubZoneWithArea}
        onUpdateSubZone={handleUpdateSubZone}
        onDeleteSubZone={handleDeleteSubZone}
        selectedZoneId={selectedZoneId}
        onSelectZone={setSelectedZoneId}
        onAssignElementToZone={handleAssignElementToZone}
        onUpdateElement={handleUpdateElement}
        onDuplicateElement={(id) => {
          const el = schema.elements.find((e) => e.id === id);
          if (el) handleDuplicateElement(el);
        }}
        onDeleteElement={handleDeleteElement}
        onNavigateToStep={(step) => setCurrentStep(step as BuilderStudioStep)}
        isExpanded={isExpandedPreview}
        onToggleExpand={() => setIsExpandedPreview((prev) => !prev)}
      />
    </div>
  );

  return (
    <div className="h-full w-full flex flex-row p-2 sm:p-3 min-h-0 gap-2 sm:gap-3 overflow-hidden">
      {/* 1. DEDICATED LEFT DOCK (Standalone Template Builder Dock, desktop only) */}
      {!isExpandedPreview && (
        <TemplateBuilderDock
          currentStep={currentStep}
          onStepChange={(step) => {
            setCurrentStep(step);
            if (step !== 'grid-zones') {
              setGridOverlayActive(false);
            }
            if (step !== 'special-elements') {
              setDemoSpecialElements(false);
            }
            if (mobilePane === 'preview') setMobilePane('editor');
          }}
          onSaveToLibrary={handleRequestSaveToLibrary}
          onExportJson={handleExportJson}
          onTriggerImport={() => fileInputRef.current?.click()}
          primaryColor={schema.primaryColor}
          onColorChange={handleColorChange}
          saveSuccess={saveSuccess}
          isDirty={isDirty}
        />
      )}

      {/* Hidden file input for schema import from dock */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImportJSON}
      />

      {/* 2. MAIN WORKSPACE WITH RESIZABLE SPLIT LAYOUT */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative z-10">
        {/* Mobile Top Header (only on very small screens where left dock is hidden) */}
        <div className="flex sm:hidden flex-shrink-0 items-center justify-between p-2 mb-2 bg-white/80 rounded-2xl border border-slate-200">
          <Link
            href="/templates"
            className="p-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1.5"
            title="Quay lại Thư viện mẫu"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Thư viện</span>
          </Link>

          {/* Mobile Pane Switcher: Editor / Preview */}
          <div className="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setMobilePane('editor')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mobilePane === 'editor' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Cấu hình
            </button>
            <button
              type="button"
              onClick={() => setMobilePane('preview')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                mobilePane === 'preview' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
              }`}
            >
              Xem trước A4
            </button>
          </div>

          <button
            onClick={handleRequestSaveToLibrary}
            className="p-2 rounded-xl bg-[#78C841] text-white font-bold text-xs shadow-2xs"
            title="Lưu vào Thư viện"
          >
            <Save className="w-4 h-4" />
          </button>
        </div>

        {/* Desktop Split View: Resizable Split Layout (50/50 default, draggable) OR Full Screen Preview */}
        <div className="hidden sm:flex flex-1 min-h-0 h-full w-full overflow-hidden">
          {isExpandedPreview ? (
            <div className="h-full w-full">{rightPreviewContent}</div>
          ) : (
            <ResizableSplitLayout
              className="h-full"
              leftContent={leftEditorContent}
              rightContent={rightPreviewContent}
              defaultSplit={50}
              minPercent={28}
              maxPercent={72}
              storageKey="structpaper_builder_split_v1"
            />
          )}
        </div>

        {/* Mobile Single Pane View */}
        <div className="block sm:hidden flex-1 min-h-0 overflow-y-auto">
          {mobilePane === 'editor' ? leftEditorContent : rightPreviewContent}
        </div>
      </div>

      {/* Warning Confirmation Modal when Saving Custom Template */}
      <ActionConfirmModal
        isOpen={isSaveConfirmOpen}
        onClose={handleCancelSaveToLibrary}
        onConfirm={handleSaveToLibrary}
        isLoading={isSaving}
        variant="warning"
        title="Lưu template vào Thư viện?"
        previewCard={
          <div className="w-full bg-slate-50 border border-slate-200/70 rounded-3xl p-3.5 flex items-center gap-3 shadow-inner">
            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-slate-900 truncate">
                {schema.name}
              </h4>
              <p className="text-[10.5px] text-zinc-500 font-medium truncate">
                Cập nhật phân vùng lưới và cấu trúc trực quan
              </p>
            </div>
          </div>
        }
        description="Thay đổi cấu hình template này sẽ cập nhật trực tiếp bố cục dàn trang và các bản thảo bài báo đang áp dụng mẫu này. Bạn có chắc chắn muốn lưu?"
        cancelLabel="Hủy bỏ"
        confirmLabel="Xác nhận lưu"
        confirmIcon={<Save className="w-4 h-4" />}
        testId="template-builder-save-confirm-modal"
      />
    </div>
  );
};

export default TemplateBuilderView;
