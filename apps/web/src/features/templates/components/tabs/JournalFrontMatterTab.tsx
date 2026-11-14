'use client';

import React from 'react';
import { JournalProfile } from '@structpaper/journal-profiles';
import { FileText, KeyRound, Quote } from 'lucide-react';
import { Select, SelectOption } from '@/components/ui/Select';

interface JournalFrontMatterTabProps {
  profile: JournalProfile;
  onChange: (updated: Partial<JournalProfile>) => void;
}

const KEYWORD_SEPARATOR_OPTIONS: SelectOption<';' | ','>[] = [
  { value: ';', label: 'Dấu chấm phẩy ( ; )', description: 'Chuẩn quy định ĐHQG-HCM & Quốc tế' },
  { value: ',', label: 'Dấu phẩy ( , )', description: 'Phân cách bằng dấu phẩy đơn' },
];

const CITATION_STYLE_OPTIONS: SelectOption<string>[] = [
  {
    value: 'vancouver',
    label: 'Vancouver (Đánh số [1-3] - Chuẩn ĐHQG-HCM)',
    description: 'Tài liệu tham khảo đánh số theo thứ tự xuất hiện',
  },
  {
    value: 'apa',
    label: 'APA 7th (Tác giả - Năm: Author, Year)',
    description: 'Tài liệu tham khảo sắp xếp theo bảng chữ cái tác giả',
  },
  {
    value: 'ieee',
    label: 'IEEE (Đánh số kỹ thuật trong ngoặc vuông)',
    description: 'Chuẩn ngành Kỹ thuật, Công nghệ & Điện tử',
  },
  {
    value: 'harvard',
    label: 'Harvard (Author-Date Format)',
    description: 'Chuẩn học thuật quốc tế dạng tác giả - năm',
  },
];

const CITATION_INTEXT_OPTIONS: SelectOption<'bracket' | 'superscript'>[] = [
  {
    value: 'bracket',
    label: 'Ngoặc vuông [1-3] - Chuẩn Vancouver STDJ',
    description: 'Chỉ số trích dẫn đặt trong ngoặc vuông đồng dòng',
  },
  {
    value: 'superscript',
    label: 'Chỉ số trên ¹⁻³',
    description: 'Chỉ số trích dẫn hiển thị dạng superscript',
  },
];

const RANGE_DASH_OPTIONS: SelectOption<string>[] = [
  { value: '-', label: 'Dấu gạch nối ngắn ( - )' },
  { value: '–', label: 'Dấu En-dash ( – )' },
];

export const JournalFrontMatterTab: React.FC<JournalFrontMatterTabProps> = ({
  profile,
  onChange,
}) => {
  const frontMatter = profile.frontMatter || {
    abstract: { minWords: 275, maxWords: 500, structured: true },
    keywords: { min: 3, max: 5, separator: ';' },
    dateFormat: 'YYYY-MM-DD',
    doiPattern: '^10\\.32508/.*$',
  };
  const citation = profile.citation || {
    style: 'vancouver',
    inText: 'bracket',
    rangeDash: '-',
  };

  const updateFrontMatter = (patch: Record<string, unknown>) => {
    onChange({
      frontMatter: {
        ...frontMatter,
        ...patch,
      },
    });
  };

  const updateCitation = (patch: Record<string, unknown>) => {
    onChange({
      citation: {
        ...citation,
        ...patch,
      },
    });
  };

  return (
    <div className="space-y-5 w-full">
      {/* 1. Abstract Rules */}
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <FileText className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-md text-zinc-900">
            Quy định Phần Tóm Tắt (Abstract Guidelines)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Số từ tối thiểu (minWords)
            </label>
            <input
              type="number"
              min={50}
              max={1000}
              value={frontMatter.abstract?.minWords ?? 275}
              onChange={(e) =>
                updateFrontMatter({
                  abstract: {
                    ...frontMatter.abstract,
                    minWords: parseInt(e.target.value, 10) || 0,
                  },
                })
              }
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-900 focus:bg-white focus:border-[#78C841] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Số từ tối đa (maxWords)
            </label>
            <input
              type="number"
              min={100}
              max={2000}
              value={frontMatter.abstract?.maxWords ?? 500}
              onChange={(e) =>
                updateFrontMatter({
                  abstract: {
                    ...frontMatter.abstract,
                    maxWords: parseInt(e.target.value, 10) || 0,
                  },
                })
              }
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-900 focus:bg-white focus:border-[#78C841] outline-none"
            />
          </div>

          <div className="flex flex-col justify-center pt-3 md:pt-0">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-700">
              <input
                type="checkbox"
                checked={frontMatter.abstract?.structured ?? true}
                onChange={(e) =>
                  updateFrontMatter({
                    abstract: {
                      ...frontMatter.abstract,
                      structured: e.target.checked,
                    },
                  })
                }
                className="rounded text-[#78C841] focus:ring-[#78C841]"
              />
              <span>Yêu cầu tóm tắt có cấu trúc (Structured Abstract)</span>
            </label>
          </div>
        </div>
      </div>

      {/* 2. Keywords Rules */}
      <div className="p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <KeyRound className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-md text-zinc-900">
            Quy định Từ Khóa (Keywords Guidelines)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Số lượng tối thiểu (min)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={frontMatter.keywords?.min ?? 3}
              onChange={(e) =>
                updateFrontMatter({
                  keywords: {
                    ...frontMatter.keywords,
                    min: parseInt(e.target.value, 10) || 1,
                  },
                })
              }
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-900 focus:bg-white focus:border-[#78C841] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Số lượng tối đa (max)
            </label>
            <input
              type="number"
              min={3}
              max={20}
              value={frontMatter.keywords?.max ?? 5}
              onChange={(e) =>
                updateFrontMatter({
                  keywords: {
                    ...frontMatter.keywords,
                    max: parseInt(e.target.value, 10) || 1,
                  },
                })
              }
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-zinc-900 focus:bg-white focus:border-[#78C841] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Dấu ngăn cách từ khóa
            </label>
            <Select<';' | ','>
              options={KEYWORD_SEPARATOR_OPTIONS}
              value={frontMatter.keywords?.separator ?? ';'}
              onChange={(val) =>
                updateFrontMatter({
                  keywords: {
                    ...frontMatter.keywords,
                    separator: val,
                  },
                })
              }
              size="sm"
              variant="default"
              fullWidth
            />
          </div>
        </div>
      </div>

      {/* 3. Dates, DOI & Citations */}
      <div className="p-5 space-y-4 pb-40">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-2">
          <Quote className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-md text-zinc-900">
            Định dạng Ngày, Mẫu DOI &amp; Phong cách Trích dẫn (Citation Style)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Định dạng ngày (Date Format)
            </label>
            <input
              type="text"
              value={frontMatter.dateFormat || 'YYYY-MM-DD'}
              onChange={(e) => updateFrontMatter({ dateFormat: e.target.value })}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono text-zinc-800 focus:bg-white focus:border-[#78C841] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Quy tắc biểu thức DOI (Regex Pattern)
            </label>
            <input
              type="text"
              value={frontMatter.doiPattern || ''}
              onChange={(e) => updateFrontMatter({ doiPattern: e.target.value })}
              className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-mono text-zinc-800 focus:bg-white focus:border-[#78C841] outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-zinc-700 mb-1">
              Phong cách trích dẫn (Citation Style)
            </label>
            <Select<string>
              options={CITATION_STYLE_OPTIONS}
              value={citation.style || 'vancouver'}
              onChange={(val) => updateCitation({ style: val })}
              size="sm"
              variant="default"
              fullWidth
            />
          </div>

          {(citation.style === 'vancouver' || citation.style === 'ieee' || !citation.style) ? (
            <>
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Kiểu hiển thị trích dẫn trong văn bản (In-text format)
                </label>
                <Select<'bracket' | 'superscript'>
                  options={CITATION_INTEXT_OPTIONS}
                  value={citation.inText || 'bracket'}
                  onChange={(val) => updateCitation({ inText: val })}
                  size="sm"
                  variant="default"
                  fullWidth
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Ký tự dải số trích dẫn (Range Dash)
                </label>
                <Select<string>
                  options={RANGE_DASH_OPTIONS}
                  value={citation.rangeDash || '-'}
                  onChange={(val) => updateCitation({ rangeDash: val })}
                  size="sm"
                  variant="default"
                  fullWidth
                />
              </div>
            </>
          ) : (
            <div className="md:col-span-2 p-3 rounded-2xl bg-zinc-50 border border-zinc-200/80 text-xs text-zinc-600">
              <span className="font-bold text-zinc-800">Quy chuẩn {citation.style?.toUpperCase()}:</span> Trích dẫn trong văn bản sử dụng định dạng Tác giả - Năm xuất bản (Author, Year). Danh mục tài liệu tham khảo cuối bài được tự động sắp xếp theo thứ tự bảng chữ cái tên tác giả.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
