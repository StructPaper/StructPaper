'use client';

import React, { useMemo } from 'react';
import type { CommandBus } from '@structpaper/editor-core';
import type { PaperMetadata } from '@/types/paper';
import { Select, type SelectOption } from '../ui';
import { articleTypeOptionsFor, findArticleTypePreset, suggestArticleTypeEn } from '@/lib/article-types';
import { dispatchMetadataField } from './command-bus-adapter';

const CUSTOM = '__custom__';

interface ArticleTypeFieldProps {
  metadata: PaperMetadata;
  onChange: (updated: PaperMetadata) => void;
  commandBus?: CommandBus;
}

/**
 * Article type of the paper. Suggestions for the journal, or "Khác": the editor types the Vietnamese
 * name and, if wanted, the English one (printed on the English summary page, in Word and in the XML).
 * Nothing is forced: a type that is not in the list is kept as typed.
 */
export const ArticleTypeField: React.FC<ArticleTypeFieldProps> = ({ metadata, onChange, commandBus }) => {
  const current = metadata.articleType || 'Bài báo nghiên cứu';
  const isPreset = !!findArticleTypePreset(current) && current === findArticleTypePreset(current)!.vi;
  const forceCustom = !isPreset;
  const suggestion = suggestArticleTypeEn(current);

  const options = useMemo<SelectOption[]>(
    () => [
      ...articleTypeOptionsFor(metadata.journalId).map((p) => ({ value: p.vi, label: p.vi, badge: p.en, description: p.description })),
      { value: CUSTOM, label: 'Khác — tự nhập…', description: 'Nhập tên loại bài báo và tên tiếng Anh theo ý bạn' },
    ],
    [metadata.journalId]
  );

  /** One change for several fields (the editor state is replaced once, the command bus hears each field). */
  const apply = (patch: Partial<PaperMetadata>) => {
    for (const [k, v] of Object.entries(patch)) dispatchMetadataField(commandBus, k, v, () => undefined, metadata);
    onChange({ ...metadata, ...patch });
  };

  return (
    <div className="space-y-2" data-testid="article-type-field">
      <Select
        label="Loại bài báo (Article Type):"
        value={forceCustom ? CUSTOM : current}
        onChange={(val) => {
          if (val === CUSTOM) {
            // keep what is there; show the boxes so it can be edited
            apply({ articleType: isPreset ? '' : current });
            return;
          }
          apply({ articleType: val, articleTypeEn: undefined }); // a preset brings its own English name
        }}
        options={options}
        size="md"
      />
      {(forceCustom || current === '') && (
        <input
          data-testid="article-type-custom"
          value={metadata.articleType ?? ''}
          onChange={(e) => apply({ articleType: e.target.value })}
          placeholder="Nhập tên loại bài báo (tiếng Việt)"
          maxLength={80}
          className="w-full rounded-2xl bg-white border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 outline-none focus:ring-2 focus:ring-lime-300"
        />
      )}
      <label className="block">
        <span className="block text-[11px] font-bold text-zinc-500 mb-1 pl-1">
          Tên tiếng Anh (trang tiếng Anh, Word, XML):
        </span>
        <input
          data-testid="article-type-en"
          value={metadata.articleTypeEn ?? ''}
          onChange={(e) => apply({ articleTypeEn: e.target.value })}
          placeholder={suggestion}
          maxLength={80}
          className="w-full rounded-2xl bg-white border border-zinc-200 px-4 py-2 text-sm text-zinc-900 outline-none focus:ring-2 focus:ring-lime-300 placeholder:text-zinc-400"
        />
        <span className="block text-[10px] text-zinc-400 mt-1 pl-1">Để trống sẽ dùng gợi ý: {suggestion}</span>
      </label>
    </div>
  );
};
