'use client';

import React, { useMemo } from 'react';
import type { CommandBus } from '@structpaper/editor-core';
import type { PaperMetadata } from '@/types/paper';
import { Select, type SelectOption } from '@/components/ui';
import { useJournalArticleTypeOptions } from '@/features/journals';
import { articleTypeCodeFor } from '@/lib/layout/article-type-code';
import { dispatchMetadataField } from './command-bus-adapter';

interface ArticleTypeFieldProps {
  metadata: PaperMetadata;
  onChange: (updated: PaperMetadata) => void;
  commandBus?: CommandBus;
}

/** Stands for a name stored on the paper that is not one of the journal's article types. */
const STORED = '__stored__';

/**
 * Article type of the paper, chosen from the journal's own list (kept on the server) only. Typing one by hand
 * invites mistakes, and every type already carries its own English name (printed on the English page, in Word
 * and in the XML), so there is nothing else to fill in.
 *
 * Choosing a type stores its code on the paper: the server then applies that type's rules to the paper.
 * A name that is already stored but not in the list stays selectable until another one is chosen.
 */
export const ArticleTypeField: React.FC<ArticleTypeFieldProps> = ({ metadata, onChange, commandBus }) => {
  const types = useJournalArticleTypeOptions(metadata.journalId);
  const stored = metadata.articleType || 'Bài báo nghiên cứu';

  /** The type the paper is of: the code it carries, else the one its stored name stands for. */
  const currentCode = useMemo(() => {
    if (metadata.articleTypeCode && types.some((t) => t.code === metadata.articleTypeCode)) return metadata.articleTypeCode;
    const byName = articleTypeCodeFor(metadata.journalId, stored);
    return byName && types.some((t) => t.code === byName) ? byName : undefined;
  }, [metadata.articleTypeCode, metadata.journalId, stored, types]);

  const options = useMemo<SelectOption[]>(() => {
    const list = types.map((t) => ({ value: t.code, label: t.vi, badge: t.en }));
    return currentCode ? list : [{ value: STORED, label: stored, description: 'Giá trị đang lưu trong bản thảo' }, ...list];
  }, [types, currentCode, stored]);

  /** One change for several fields (the editor state is replaced once, the command bus hears each field). */
  const apply = (patch: Partial<PaperMetadata>) => {
    for (const [k, v] of Object.entries(patch)) dispatchMetadataField(commandBus, k, v, () => undefined, metadata);
    onChange({ ...metadata, ...patch });
  };

  const choose = (value: string) => {
    if (value === STORED) return;
    const type = types.find((t) => t.code === value);
    if (!type) return;
    apply({ articleType: type.vi, articleTypeEn: type.en, articleTypeCode: type.code });
  };

  return (
    <div data-testid="article-type-field">
      <Select
        label="Loại bài báo (Article Type):"
        value={currentCode ?? STORED}
        onChange={(val) => choose(String(val))}
        options={options}
        size="md"
      />
    </div>
  );
};
