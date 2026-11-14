'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { CompletePaper } from '@/types/paper';
import { UniversalTemplateSchema } from '@/types/template-builder';
import { mapPaperToTemplateSchema } from '@/lib/authoring/template-paper-mapper';
import { UniversalLiveA4Preview } from '@/components/template-builder/UniversalLiveA4Preview';
import { Check } from 'lucide-react';

interface TypstLivePreviewPaneProps {
  paper: CompletePaper;
  template: UniversalTemplateSchema;
  isCompiling: boolean;
  onRecompile?: () => void;
}

export const TypstLivePreviewPane: React.FC<TypstLivePreviewPaneProps> = ({
  paper,
  template,
  isCompiling,
}) => {
  const [isOverlayActive, setIsOverlayActive] = useState<boolean>(false);
  const [justFinished, setJustFinished] = useState<boolean>(false);

  useEffect(() => {
    if (isCompiling) {
      setIsOverlayActive(true);
      setJustFinished(false);
    } else if (isOverlayActive) {
      setJustFinished(true);
      const timer = setTimeout(() => {
        setIsOverlayActive(false);
        setJustFinished(false);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isCompiling, isOverlayActive]);

  // Map authoring paper data into the template schema
  const mappedSchema = useMemo(() => {
    return mapPaperToTemplateSchema(paper, template);
  }, [paper, template]);

  return (
    <div className="h-full w-full flex flex-col min-h-0 relative overflow-hidden">
      {/* Subtle Blur Loading Overlay with Liquid Glass Badge */}
      <div
        className={`absolute inset-0 z-30 flex flex-col items-center justify-center p-6 text-center transition-all duration-300 ease-out ${
          isOverlayActive
            ? 'opacity-100 backdrop-blur-[2px] bg-white/20 pointer-events-auto'
            : 'opacity-0 backdrop-blur-none bg-transparent pointer-events-none'
        }`}
      >
        <div className="liquid-glass-pill px-5 py-2.5 rounded-2xl flex items-center gap-2.5 shadow-lg transition-all duration-300">
          {justFinished ? (
            <>
              <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
              <span className="font-extrabold text-xs text-zinc-900 tracking-tight">
                Đã cập nhật dàn trang Typst
              </span>
            </>
          ) : (
            <>
              <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#78C841] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#78C841]"></span>
              </span>
              <span className="font-extrabold text-xs text-zinc-900 tracking-tight">
                Đang đồng bộ cấu trúc mẫu Typst...
              </span>
            </>
          )}
        </div>
      </div>

      {/* Single Clean A4 Preview Container with full height and native scroll */}
      <UniversalLiveA4Preview
        schema={mappedSchema}
        className="h-full w-full rounded-3xl border border-[#E8E8EE] shadow-xs"
      />
    </div>
  );
};
