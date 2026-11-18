'use client';

import React, { useMemo } from 'react';
import type { CommandBus } from '@structpaper/editor-core';
import type { PaperMetadata } from '@/types/paper';
import { Select, type SelectOption } from '@/components/ui';
import { articleTypeOptionsFor } from '@/lib/article-types';
import { dispatchMetadataField } from './command-bus-adapter';

interface ArticleTypeFieldProps {
  metadata: PaperMetadata;
  onChange: (updated: PaperMetadata) => void;
  commandBus?: CommandBus;
}

/**
 * Article type of the paper, chosen from the journal's list only. Typing one by hand invites
 * mistakes, and every type in the list already carries its own English name (printed on the
 * English page, in Word and in the XML), so there is nothing else to fill in.
 * A value that is already stored but not in the list stays selectable until another one is chosen.
 */
export const ArticleTypeField: React.FC<ArticleTypeFieldProps> = ({ metadata, onChange, commandBus }) => {
  const current = metadata.articleType || 'Bài báo nghiên cứu';

  const options = useMemo<SelectOption[]>(() => {
    const presets = articleTypeOptionsFor(metadata.journalId).map((p) => ({
      value: p.vi,
      label: p.vi,
      badge: p.en,
      description: p.description,
    }));
    const stored = presets.some((p) => p.value === current)
      ? []
      : [{ value: current, label: current, description: 'Giá trị đang lưu trong bản thảo' }];
    return [...stored, ...presets];
  }, [metadata.journalId, current]);

  /** One change for several fields (the editor state is replaced once, the command bus hears each field). */
  const apply = (patch: Partial<PaperMetadata>) => {
    for (const [k, v] of Object.entries(patch)) dispatchMetadataField(commandBus, k, v, () => undefined, metadata);
    onChange({ ...metadata, ...patch });
  };

  return (
    <div data-testid="article-type-field">
      <Select
        label="Loại bài báo (Article Type):"
        value={current}
        // the chosen type brings its own English name, so a hand-typed one is dropped
        onChange={(val) => apply({ articleType: String(val), articleTypeEn: undefined })}
        options={options}
        size="md"
      />
    </div>
  );
};
