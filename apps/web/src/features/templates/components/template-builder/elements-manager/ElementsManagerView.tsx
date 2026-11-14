'use client';

import React, { useState } from 'react';
import {
  UniversalTemplateSchema,
  SemanticElement,
} from '@/types/template-builder';
import { Settings, Plus, Layers, ArrowLeft } from 'lucide-react';
import { AllElementsOverview } from './AllElementsOverview';
import { CompositeElementBuilder } from './CompositeElementBuilder';

interface ElementsManagerViewProps {
  schema: UniversalTemplateSchema;
  onUpdateElement: (id: string, updated: Partial<SemanticElement>) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (element: SemanticElement) => void;
  onAddElement: (element: SemanticElement) => void;
  onNavigateToStep?: (step: string) => void;
}

/**
 * ElementsManagerView
 * Dedicated Studio Page (accessed via Dock Gear icon):
 * - Complete inventory inspection of ALL elements (core, special, and custom)
 * - Powerful visual builder for creating composite elements based on Variables & Constants
 */
export const ElementsManagerView: React.FC<ElementsManagerViewProps> = ({
  schema,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onAddElement,
  onNavigateToStep,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'create-composite'>('overview');

  const handleAddAndReturn = (newElement: SemanticElement) => {
    onAddElement(newElement);
    setActiveTab('overview');
  };

  return (
    <div className="space-y-4 pb-8 select-none">
      {/* Top Banner Header with Gear Icon */}
      <div className="relative z-30 focus-within:z-40 p-2 pb-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Settings className="w-4 h-4 text-[#78C841]" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">
                Cấu hình Quản lý & Tạo Thành phần Nâng cao
              </h3>
              <p className="text-xs text-zinc-500">
                Toàn quyền kiểm soát mọi thành phần học thuật & thiết kế khối tùy biến
              </p>
            </div>
          </div>

          {onNavigateToStep && (
            <button
              type="button"
              onClick={() => onNavigateToStep('page-zones')}
              className="px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại các Bước chính</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Pills */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-200/50 rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'overview'
              ? 'bg-white text-zinc-950 shadow-xs border border-white font-extrabold'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-zinc-600" />
          <span>Tổng quan Toàn bộ Thành phần ({schema.elements.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('create-composite')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'create-composite'
              ? 'bg-white text-zinc-950 shadow-xs border border-white font-extrabold'
              : 'text-zinc-600 hover:text-zinc-900 hover:bg-white/50'
          }`}
        >
          <Plus className="w-3.5 h-3.5 text-[#78C841] stroke-[3]" />
          <span>+ Tạo Thành phần Mới (Biến & Hằng)</span>
        </button>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'overview' ? (
        <AllElementsOverview
          elements={schema.elements}
          zones={schema.zones}
          floatingRules={schema.floatingRules}
          onUpdateElement={onUpdateElement}
          onDeleteElement={onDeleteElement}
          onDuplicateElement={onDuplicateElement}
          onOpenCreateComposite={() => setActiveTab('create-composite')}
          onNavigateToStep={onNavigateToStep}
        />
      ) : (
        <CompositeElementBuilder
          zones={schema.zones}
          primaryColor={schema.primaryColor}
          onAddElement={handleAddAndReturn}
          onCancel={() => setActiveTab('overview')}
        />
      )}
    </div>
  );
};
export default ElementsManagerView;
