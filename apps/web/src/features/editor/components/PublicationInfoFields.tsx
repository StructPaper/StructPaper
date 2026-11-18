'use client';

import React from 'react';
import { BookMarked, Wand2, History } from 'lucide-react';
import type { PaperMetadata, PublicationInfo } from '@/types/paper';
import { getJournalTemplate } from '@/lib/templates';
import {
  composeDoi,
  hasPublicationValue,
  lastIssue,
  publicationValue,
  rememberIssue,
  UNKNOWN,
  type PublicationKey,
} from '@/lib/publication';

interface Props {
  metadata: PaperMetadata;
  onChange: (metadata: PaperMetadata) => void;
}

const FIELDS: Array<{ key: PublicationKey; label: string; placeholder: string; mono?: boolean; wide?: boolean }> = [
  { key: 'volume', label: 'Tập (Volume):', placeholder: '10' },
  { key: 'issue', label: 'Số (Issue):', placeholder: '3' },
  { key: 'firstPage', label: 'Trang đầu:', placeholder: '6906' },
  { key: 'lastPage', label: 'Trang cuối:', placeholder: '6916' },
  { key: 'published', label: 'Ngày đăng (dd-mm-yyyy):', placeholder: '10-08-2026' },
  { key: 'doi', label: 'Mã định danh DOI:', placeholder: 'https://doi.org/10.32508/…', mono: true, wide: true },
];

/**
 * Publication data assigned by the editorial office. A field that was never entered is simply shown
 * empty here (the "?" placeholder is a print/validation concern, not something to display in the form).
 */
export const PublicationInfoFields: React.FC<Props> = ({ metadata, onChange }) => {
  const set = (key: PublicationKey | 'articleId', value: string) => {
    const publication: PublicationInfo = { ...(metadata.publication || {}), [key]: value };
    onChange({ ...metadata, publication });
  };

  const shown = (key: PublicationKey) => {
    const v = publicationValue(metadata, key);
    return v === UNKNOWN ? '' : v;
  };

  const volume = publicationValue(metadata, 'volume');
  const issue = publicationValue(metadata, 'issue');
  const tmpl = getJournalTemplate(metadata.journalId);
  const articleId = metadata.publication?.articleId;
  const suggestedDoi = composeDoi(tmpl.doiPrefix, volume, issue, articleId);
  const previous = lastIssue(metadata.journalId);
  const offerPrevious =
    previous && (volume === UNKNOWN || issue === UNKNOWN) && (previous.volume !== volume || previous.issue !== issue);

  return (
    <div className="pt-2" data-testid="publication-info">
      <label className="text-xs font-bold text-zinc-700 flex items-center gap-1.5 mb-2">
        <BookMarked className="w-3.5 h-3.5 text-zinc-500" />
        Thông tin xuất bản (do Tòa soạn cấp):
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? 'col-span-2 sm:col-span-4' : ''}>
            <label className="text-[11px] font-bold text-zinc-600 block mb-1" htmlFor={`pub-${f.key}`}>
              {f.label}
            </label>
            <input
              id={`pub-${f.key}`}
              type="text"
              value={shown(f.key)}
              placeholder={f.placeholder}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              onChange={(e) => set(f.key, e.target.value)}
              onBlur={() => {
                if (f.key === 'volume' || f.key === 'issue') {
                  rememberIssue(
                    metadata.journalId,
                    publicationValue(metadata, 'volume'),
                    publicationValue(metadata, 'issue')
                  );
                }
              }}
              className={`w-full p-2.5 rounded-2xl border text-xs text-zinc-900 bg-white focus:outline-none focus:ring-4 focus:ring-blue-200 focus:border-blue-300 shadow-2xs ${
                f.mono ? 'font-mono' : ''
              } border-zinc-200`}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-2">
        {offerPrevious && previous && (
          <button
            type="button"
            onClick={() => onChange({ ...metadata, publication: { ...(metadata.publication || {}), volume: previous.volume, issue: previous.issue } })}
            className="px-3 py-1 rounded-full bg-white border border-zinc-200 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5"
          >
            <History className="w-3 h-3" /> Dùng kỳ gần nhất: Tập {previous.volume}, Số {previous.issue}
          </button>
        )}
        {suggestedDoi && publicationValue(metadata, 'doi') !== suggestedDoi && (
          <button
            type="button"
            onClick={() => set('doi', suggestedDoi)}
            className="px-3 py-1 rounded-full bg-white border border-zinc-200 text-[11px] font-bold text-zinc-700 hover:bg-zinc-50 flex items-center gap-1.5"
            title={suggestedDoi}
          >
            <Wand2 className="w-3 h-3" /> Ghép DOI từ tập, số và mã bài ({articleId})
          </button>
        )}
        {hasPublicationValue(volume) && hasPublicationValue(issue) && !articleId && tmpl.doiPrefix && (
          <span className="text-[11px] text-zinc-500">Nhập mã bài để tự ghép DOI.</span>
        )}
      </div>
    </div>
  );
};
