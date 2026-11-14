'use client';

import React, { useMemo, useState } from 'react';
import { CompletePaper } from '@/types/paper';
import { UniversalTemplateSchema } from '@/types/template-builder';
import { mapPaperToTemplateSchema } from '@/lib/authoring/template-paper-mapper';
import { UniversalLiveA4Preview } from '@/components/template-builder/UniversalLiveA4Preview';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RefreshCw,
  FileCheck,
  Eye,
} from 'lucide-react';

interface PaperLiveA4PreviewProps {
  paper: CompletePaper;
  template: UniversalTemplateSchema;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export const PaperLiveA4Preview: React.FC<PaperLiveA4PreviewProps> = ({
  paper,
  template,
  isExpanded,
  onToggleExpand,
}) => {
  // Map real authoring paper data into the template schema
  const mappedSchema = useMemo(() => {
    return mapPaperToTemplateSchema(paper, template);
  }, [paper, template]);

  return (
    <div className="h-full flex flex-col bg-slate-100 rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs">
      {/* Top control bar */}
      <div className="bg-white px-4 py-2.5 border-b border-slate-200/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#78C841]" />
          <span className="font-extrabold text-slate-900">
            Trực quan hóa Live A4
          </span>
          <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
            (Định dạng theo mẫu {template.name})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onToggleExpand && (
            <button
              onClick={onToggleExpand}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title={isExpanded ? 'Thu nhỏ cửa sổ' : 'Phóng to xem trước'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* A4 Preview Container */}
      <div className="flex-1 overflow-auto p-4 flex justify-center bg-slate-200/60 no-scrollbar">
        <div className="w-full max-w-[750px] transition-all">
          <UniversalLiveA4Preview
            schema={mappedSchema}
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
          />
        </div>
      </div>
    </div>
  );
};
