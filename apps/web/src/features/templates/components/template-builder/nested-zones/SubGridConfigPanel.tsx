'use client';

import React from 'react';
import { LayoutZoneConfig, TemplateGridConfig } from '@/types/template-builder';
import { Columns, Sparkles } from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';

interface SubGridConfigPanelProps {
  currentZone: LayoutZoneConfig;
  onUpdateSubGridConfig: (cfg: TemplateGridConfig) => void;
  onApplyPreset: (columns: number, rows: number, subZones: LayoutZoneConfig[]) => void;
}

export const SubGridConfigPanel: React.FC<SubGridConfigPanelProps> = ({
  currentZone,
  onUpdateSubGridConfig,
  onApplyPreset,
}) => {
  const subCols = currentZone.subGridConfig?.columns || 2;
  const subRows = currentZone.subGridConfig?.rows || 2;

  const handleUpdateCols = (colNum: number) => {
    onUpdateSubGridConfig({
      ...(currentZone.subGridConfig || {
        enabled: true,
        columns: 2,
        rows: 2,
        colGap: 6,
        rowGap: 6,
        unit: 'px',
      }),
      columns: colNum,
    });
  };

  const handleUpdateRows = (rowNum: number) => {
    onUpdateSubGridConfig({
      ...(currentZone.subGridConfig || {
        enabled: true,
        columns: 2,
        rows: 2,
        colGap: 6,
        rowGap: 6,
        unit: 'px',
      }),
      rows: rowNum,
    });
  };

  const presets = [
    {
      label: '2 cột đều (50 / 50)',
      apply: () =>
        onApplyPreset(2, 1, [
          {
            id: `subzone-${Date.now()}-1`,
            name: `${currentZone.name} - Trái`,
            description: 'Cột trái 50%',
            type: 'full-width',
            columns: 1,
            columnGap: 4,
            showColumnRule: false,
            columnRuleColor: '#E2E8F0',
            order: 1,
            gridArea: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
            parentId: currentZone.id,
            pageScope: currentZone.pageScope,
          },
          {
            id: `subzone-${Date.now()}-2`,
            name: `${currentZone.name} - Phải`,
            description: 'Cột phải 50%',
            type: 'full-width',
            columns: 1,
            columnGap: 4,
            showColumnRule: false,
            columnRuleColor: '#E2E8F0',
            order: 2,
            gridArea: { rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
            parentId: currentZone.id,
            pageScope: currentZone.pageScope,
          },
        ]),
    },
    {
      label: '3 cột đều (33 / 33 / 33)',
      apply: () =>
        onApplyPreset(3, 1, [
          {
            id: `subzone-${Date.now()}-1`,
            name: `${currentZone.name} - Cột 1`,
            description: 'Cột 1 33%',
            type: 'full-width',
            columns: 1,
            columnGap: 4,
            showColumnRule: false,
            columnRuleColor: '#E2E8F0',
            order: 1,
            gridArea: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
            parentId: currentZone.id,
            pageScope: currentZone.pageScope,
          },
          {
            id: `subzone-${Date.now()}-2`,
            name: `${currentZone.name} - Cột 2`,
            description: 'Cột 2 33%',
            type: 'full-width',
            columns: 1,
            columnGap: 4,
            showColumnRule: false,
            columnRuleColor: '#E2E8F0',
            order: 2,
            gridArea: { rowStart: 1, colStart: 2, rowSpan: 1, colSpan: 1 },
            parentId: currentZone.id,
            pageScope: currentZone.pageScope,
          },
          {
            id: `subzone-${Date.now()}-3`,
            name: `${currentZone.name} - Cột 3`,
            description: 'Cột 3 33%',
            type: 'full-width',
            columns: 1,
            columnGap: 4,
            showColumnRule: false,
            columnRuleColor: '#E2E8F0',
            order: 3,
            gridArea: { rowStart: 1, colStart: 3, rowSpan: 1, colSpan: 1 },
            parentId: currentZone.id,
            pageScope: currentZone.pageScope,
          },
        ]),
    },
    {
      label: '2 dòng (Trên / Dưới)',
      apply: () =>
        onApplyPreset(1, 2, [
          {
            id: `subzone-${Date.now()}-1`,
            name: `${currentZone.name} - Trên`,
            description: 'Hàng trên',
            type: 'full-width',
            columns: 1,
            columnGap: 4,
            showColumnRule: false,
            columnRuleColor: '#E2E8F0',
            order: 1,
            gridArea: { rowStart: 1, colStart: 1, rowSpan: 1, colSpan: 1 },
            parentId: currentZone.id,
            pageScope: currentZone.pageScope,
          },
          {
            id: `subzone-${Date.now()}-2`,
            name: `${currentZone.name} - Dưới`,
            description: 'Hàng dưới',
            type: 'full-width',
            columns: 1,
            columnGap: 4,
            showColumnRule: false,
            columnRuleColor: '#E2E8F0',
            order: 2,
            gridArea: { rowStart: 2, colStart: 1, rowSpan: 1, colSpan: 1 },
            parentId: currentZone.id,
            pageScope: currentZone.pageScope,
          },
        ]),
    },
  ];

  return (
    <div className="bg-zinc-50 border border-zinc-200/80 rounded-2xl p-3.5 space-y-3 shadow-2xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Columns className="w-4 h-4 text-[#78C841]" />
          <h4 className="text-xs font-extrabold text-zinc-900">Ma trận lưới con của phân vùng</h4>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-800">
          {subCols} cột × {subRows} hàng
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold text-zinc-600 mb-1">Số cột con:</label>
          <div className="flex gap-1 bg-white p-1 rounded-xl border border-zinc-200/80 shadow-2xs select-none">
            {[1, 2, 3, 4, 6].map((colNum) => (
              <button
                key={colNum}
                type="button"
                onClick={() => handleUpdateCols(colNum)}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subCols === colNum
                    ? 'bg-zinc-900 text-white shadow-2xs font-extrabold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                {colNum}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-zinc-600 mb-1">Số hàng con:</label>
          <div className="flex gap-1 bg-white p-1 rounded-xl border border-zinc-200/80 shadow-2xs select-none">
            {[1, 2, 3, 4].map((rowNum) => (
              <button
                key={rowNum}
                type="button"
                onClick={() => handleUpdateRows(rowNum)}
                className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  subRows === rowNum
                    ? 'bg-zinc-900 text-white shadow-2xs font-extrabold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
              >
                {rowNum}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-zinc-600 mb-1">Gợi ý chia nhanh:</label>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={preset.apply}
              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 shadow-2xs cursor-pointer transition-all flex items-center gap-1 active:scale-95"
            >
              <Sparkles className="w-2.5 h-2.5 text-[#78C841]" />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
