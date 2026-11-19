'use client';

import React from 'react';
import { Languages } from 'lucide-react';
import { Select, type SelectOption } from '@/components/ui/Select';
import { useEditorSession } from '@/context/EditorSessionContext';
import type { PageLanguage } from '@/lib/page-labels';

const OPTIONS: SelectOption<PageLanguage>[] = [
  { value: 'vi', label: 'Tiếng Việt', badge: 'VI', description: 'Trang đầu tiếng Việt, trang cuối tiếng Anh' },
  { value: 'en', label: 'English', badge: 'EN', description: 'Trang đầu tiếng Anh, trang cuối tiếng Việt' },
];

/**
 * Title-bar language of the PDF preview. The chosen language is the main one (title, abstract,
 * keywords, article type and printed labels); the closing page is printed in the other one.
 */
export const PdfLanguageSelect: React.FC = () => {
  const { pdfLanguage, setPdfLanguage } = useEditorSession();

  return (
    <div data-no-drag="true" data-testid="titlebar-pdf-language">
      <Select
        options={OPTIONS}
        value={pdfLanguage}
        onChange={setPdfLanguage}
        variant="custom"
        align="right"
        // the select draws its own chevron, so the pill is the select's button itself
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-100 hover:bg-zinc-200/80 text-zinc-600 aria-expanded:bg-[#78C841] aria-expanded:text-zinc-950 transition-all select-none"
        renderTrigger={(selected) => (
          <span title="Ngôn ngữ chính của bản xem trước PDF" className="inline-flex items-center gap-1.5">
            <Languages className="w-3.5 h-3.5" />
            <span>{selected?.label ?? 'Tiếng Việt'}</span>
          </span>
        )}
      />
    </div>
  );
};
