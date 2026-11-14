'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { TemplateBuilderView } from '@/features/templates';
import { UniversalTemplateSchema } from '@/types/template-builder';
import {
  templateRegistry,
  deserializeTemplatePackage,
} from '@/lib/template-engine/storage';
import {
  VNUHCM_HEALTH_SCIENCES_TEMPLATE,
  CUSTOM_BLANK_TEMPLATE,
} from '@/data/templates';
import { Loader2 } from 'lucide-react';

function BuilderContent() {
  const searchParams = useSearchParams();
  const presetKey = searchParams.get('preset');
  const pageParam = searchParams.get('page');
  const initialPage = pageParam && !isNaN(Number(pageParam)) ? Number(pageParam) : 1;

  const [schema, setSchema] = useState<UniversalTemplateSchema | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function resolveTemplate() {
      setLoading(true);
      try {
        if (presetKey === 'blank' || presetKey === 'custom_blank_canvas') {
          if (isMounted) {
            setSchema(JSON.parse(JSON.stringify(CUSTOM_BLANK_TEMPLATE)));
            setLoading(false);
          }
          return;
        }

        if (presetKey) {
          // Dynamic load from registry (API / JSON file / local custom templates)
          const loaded = await templateRegistry.loadTemplate(presetKey);
          if (loaded && isMounted) {
            setSchema(loaded);
            setLoading(false);
            return;
          }
        }

        // Default: authentic VNUHCM Health Sciences ID630 Template from JSON specification
        if (isMounted) {
          setSchema(JSON.parse(JSON.stringify(VNUHCM_HEALTH_SCIENCES_TEMPLATE)));
          setLoading(false);
        }
      } catch (err) {
        console.error('Error resolving template schema:', err);
        if (isMounted) {
          setSchema(JSON.parse(JSON.stringify(VNUHCM_HEALTH_SCIENCES_TEMPLATE)));
          setLoading(false);
        }
      }
    }

    resolveTemplate();

    return () => {
      isMounted = false;
    };
  }, [presetKey]);

  if (loading || !schema) {
    return (
      <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex flex-col items-center justify-center bg-[#F8F9FA] text-slate-600 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-[#78C841]" />
        <span className="text-xs font-semibold tracking-wide">
          Đang nạp cấu trúc Template từ file dữ liệu...
        </span>
      </div>
    );
  }

  return <TemplateBuilderView initialSchema={schema} initialPage={initialPage} />;
}

export default function TemplateBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="h-[calc(100vh-var(--titlebar-height,0px))] w-full flex items-center justify-center bg-[#F8F9FA] text-xs font-semibold text-slate-500">
          Đang nạp Trình thiết kế Template StructPaper...
        </div>
      }
    >
      <BuilderContent />
    </Suspense>
  );
}
