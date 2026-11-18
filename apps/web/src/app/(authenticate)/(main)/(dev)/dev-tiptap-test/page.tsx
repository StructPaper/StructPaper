'use client';

import React, { useState } from 'react';
import { TipTapParagraphEditor } from '@/features/editor/components/sections/TipTapParagraphEditor';
import type { Inline } from '@structpaper/doc-model';
import type { PaperReference } from '@/types/paper';

const mockReferences: PaperReference[] = [
  {
    id: 1,
    raw: 'Nguyễn Văn A, Trần B (2024). Tạp chí Khoa học & Công nghệ Sức khỏe.',
    authors: 'Nguyễn Văn A, Trần B',
    year: '2024',
    isCited: true,
    citationCount: 1,
  },
  {
    id: 2,
    raw: 'Smith J, et al. (2023). Nature Medicine 29(4): 102-110.',
    authors: 'Smith J, et al.',
    year: '2023',
    isCited: false,
    citationCount: 0,
  },
];

export default function DevTipTapTestPage() {
  const [content, setContent] = useState<string>('Nội dung đoạn văn mẫu ban đầu.');
  const [inlines, setInlines] = useState<Inline[]>([]);

  return (
    <main className="min-h-screen p-8 bg-zinc-100 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-zinc-800">
        Dev TipTap Vietnamese IME & Rich-Text Test Harness
      </h1>
      <div data-testid="ready-indicator" className="text-xs font-mono text-emerald-600 font-bold">
        READY
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-zinc-200 space-y-4">
        <label className="block text-sm font-semibold text-zinc-700">
          TipTap Paragraph Editor:
        </label>
        <TipTapParagraphEditor
          value={content}
          isEditing={true}
          onChange={(newInlines, plainText) => {
            setInlines(newInlines);
            setContent(plainText);
          }}
          references={mockReferences}
        />

        <div className="pt-4 border-t border-zinc-200 text-xs space-y-2">
          <div>
            <span className="font-semibold text-zinc-600">Committed Text: </span>
            <span data-testid="committed-text" className="font-mono bg-zinc-50 px-2 py-1 rounded">
              {content}
            </span>
          </div>
          <div>
            <span className="font-semibold text-zinc-600">Inlines Count: </span>
            <span data-testid="inlines-count" className="font-mono">
              {inlines.length}
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
