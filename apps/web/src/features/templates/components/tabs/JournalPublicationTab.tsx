'use client';

import React from 'react';
import { Newspaper } from 'lucide-react';
import type { JournalProfile, JournalPublicationConfig } from '@structpaper/journal-profiles';

interface JournalPublicationTabProps {
  profile: JournalProfile;
  onChange: (updated: Partial<JournalProfile>) => void;
}

interface FieldDef {
  key: keyof JournalPublicationConfig;
  label: string;
  hint: string;
  placeholder: string;
  wide?: boolean;
}

const FIELDS: FieldDef[] = [
  { key: 'headerText', label: 'Dòng tiêu đề đầu trang', hint: 'In ở đầu mỗi trang của bản PDF.', placeholder: 'VD: Science & Technology Development Journal', wide: true },
  { key: 'officialNameEn', label: 'Tên chính thức (tiếng Anh)', hint: 'Đúng như tạp chí in trên bản PDF của mình; dùng ở "Cite this article".', placeholder: 'VD: VNUHCM Journal of Health Sciences', wide: true },
  { key: 'officialAbbvEn', label: 'Tên viết tắt chính thức', hint: 'Dùng khi trích dẫn.', placeholder: 'VD: VNUHCM J. Health Sci.' },
  { key: 'shortName', label: 'Viết tắt tiếng Anh', hint: 'Hiện ở mục "Tạp chí" của bài.', placeholder: 'VD: Sci. Tech. Dev. J. - Health Sci.' },
  { key: 'name', label: 'Tên đầy đủ (tiếng Việt) trên bài', hint: 'Ghi vào thông tin tạp chí của bản thảo.', placeholder: 'VD: Tạp chí Phát triển Khoa học & Công nghệ – Health Sciences', wide: true },
  { key: 'publisher', label: 'Nhà xuất bản', hint: '', placeholder: 'VD: ĐHQG TP.HCM / VNU-HCM Press', wide: true },
  { key: 'issn', label: 'ISSN', hint: 'Lưu cùng hồ sơ tạp chí.', placeholder: 'VD: 1859-0128' },
  { key: 'eIssn', label: 'e-ISSN', hint: '', placeholder: 'VD: 2588-1469' },
  { key: 'doiPrefix', label: 'Tiền tố DOI', hint: 'DOI = tiền tố.v{tập}i{số}.{mã bài}', placeholder: 'VD: 10.32508/vnuhcmj-hs', wide: true },
];

const INPUT =
  'w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-[#78C841] focus:ring-2 focus:ring-[#78C841]/20 outline-none transition-all';

/** What the journal prints about itself: the header line, official names, publisher, ISSN and DOI prefix. */
export const JournalPublicationTab: React.FC<JournalPublicationTabProps> = ({ profile, onChange }) => {
  const publication = profile.publication ?? {};

  const update = (key: keyof JournalPublicationConfig, value: string) => {
    onChange({ publication: { ...publication, [key]: value } });
  };

  return (
    <div className="space-y-5 w-full" data-testid="journal-publication-tab">
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <Newspaper className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-sm text-zinc-900">Thông tin in trên bài &amp; trích dẫn</h3>
        </div>
        <p className="text-xs text-zinc-500">
          Các thông tin này được dùng khi dựng PDF/Word (tiêu đề đầu trang, trích dẫn bài, DOI) và khi nhận diện tạp chí
          từ file Word tải lên.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className={f.wide ? 'md:col-span-2' : ''}>
              <label htmlFor={`pub-${f.key}`} className="block text-xs font-bold text-zinc-700 mb-1">
                {f.label}
              </label>
              <input
                id={`pub-${f.key}`}
                type="text"
                value={(publication[f.key] as string | undefined) ?? ''}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                className={INPUT}
              />
              {f.hint && <p className="mt-1 text-[11px] text-zinc-500">{f.hint}</p>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
