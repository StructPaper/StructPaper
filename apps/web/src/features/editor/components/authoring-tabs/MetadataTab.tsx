'use client';

import React from 'react';
import { PaperMetadata } from '@/types/paper';
import { FileText, Calendar, BookOpen, Hash, Link as LinkIcon, CheckCircle2 } from 'lucide-react';

interface MetadataTabProps {
  metadata: PaperMetadata;
  onChange: (updated: PaperMetadata) => void;
}

export const MetadataTab: React.FC<MetadataTabProps> = ({ metadata, onChange }) => {
  const handleChange = (field: keyof PaperMetadata, value: any) => {
    onChange({
      ...metadata,
      [field]: value,
    });
  };

  const handleDateChange = (dateField: 'received' | 'revised' | 'accepted' | 'published', val: string) => {
    onChange({
      ...metadata,
      dates: {
        ...(metadata.dates || { received: '', revised: '', accepted: '', published: '' }),
        [dateField]: val,
      },
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title section */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <FileText className="w-4 h-4 text-[#78C841]" />
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
            Tiêu đề bài báo
          </h3>
        </div>

        {/* Vietnamese Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Tiêu đề (Tiếng Việt) <span className="text-red-500">*</span>
          </label>
          <textarea
            value={metadata.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            rows={2}
            className="w-full text-sm font-semibold rounded-xl border border-slate-200 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 focus:border-[#78C841] transition-all resize-y"
            placeholder="Nhập tiêu đề bài báo tiếng Việt..."
          />
        </div>

        {/* English Title */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5">
            Tiêu đề tiếng Anh (Title in English)
          </label>
          <textarea
            value={metadata.titleEn || ''}
            onChange={(e) => handleChange('titleEn', e.target.value)}
            rows={2}
            className="w-full text-sm font-semibold rounded-xl border border-slate-200 p-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 focus:border-[#78C841] transition-all resize-y italic"
            placeholder="Enter English title..."
          />
        </div>

        {/* Article Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Loại bài báo (Article Type)
            </label>
            <select
              value={metadata.articleType || 'Bài báo nghiên cứu'}
              onChange={(e) => handleChange('articleType', e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 focus:border-[#78C841]"
            >
              <option value="Bài báo nghiên cứu">Bài báo nghiên cứu (Research Article)</option>
              <option value="Bài tổng quan">Bài tổng quan (Review Article)</option>
              <option value="Báo cáo ca lâm sàng">Báo cáo ca lâm sàng (Case Report)</option>
              <option value="Phương pháp luận">Phương pháp luận (Methodology)</option>
              <option value="Thư gửi tòa soạn">Thư gửi tòa soạn (Letter)</option>
              <option value="Bình luận & Ý kiến">Bình luận & Ý kiến (Commentary)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tên viết tắt tạp chí (Abbreviation)
            </label>
            <input
              type="text"
              value={metadata.journalAbbv || ''}
              onChange={(e) => handleChange('journalAbbv', e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 focus:border-[#78C841]"
              placeholder="VD: Sci. Tech. Dev. J. - Health Sci."
            />
          </div>
        </div>
      </div>

      {/* Publication details */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <BookOpen className="w-4 h-4 text-[#78C841]" />
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
            Thông tin xuất bản & Định danh
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Tên tạp chí / Kỷ yếu (Journal Name)
            </label>
            <input
              type="text"
              value={metadata.journalName || ''}
              onChange={(e) => handleChange('journalName', e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 focus:border-[#78C841]"
              placeholder="Tạp chí Phát triển Khoa học & Công nghệ"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Định danh số DOI
            </label>
            <div className="relative">
              <input
                type="text"
                value={metadata.doi || ''}
                onChange={(e) => handleChange('doi', e.target.value)}
                className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2.5 pl-8 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 focus:border-[#78C841]"
                placeholder="https://doi.org/10.32508/stdjhs.v1i1.630"
              />
              <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {/* Volume, Issue, Year, Pages */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Tập (Volume)
            </label>
            <input
              type="text"
              value={metadata.volume || ''}
              onChange={(e) => handleChange('volume', e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              placeholder="1"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Số (Issue)
            </label>
            <input
              type="text"
              value={metadata.issue || ''}
              onChange={(e) => handleChange('issue', e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              placeholder="1"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Năm (Year)
            </label>
            <input
              type="text"
              value={metadata.year || ''}
              onChange={(e) => handleChange('year', e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              placeholder="2026"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1">
              Trang (Pages)
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={metadata.firstPage || 1}
                onChange={(e) => handleChange('firstPage', Number(e.target.value))}
                className="w-1/2 text-xs font-semibold rounded-xl border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              />
              <span className="text-slate-400 text-xs">-</span>
              <input
                type="number"
                value={metadata.lastPage || 10}
                onChange={(e) => handleChange('lastPage', Number(e.target.value))}
                className="w-1/2 text-xs font-semibold rounded-xl border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Dates Timeline */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Calendar className="w-4 h-4 text-[#78C841]" />
          <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
            Tiến trình thẩm định & Xuất bản
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Ngày nhận bài
            </label>
            <input
              type="text"
              value={metadata.dates?.received || ''}
              onChange={(e) => handleDateChange('received', e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              placeholder="DD-MM-YYYY"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Ngày chỉnh sửa
            </label>
            <input
              type="text"
              value={metadata.dates?.revised || ''}
              onChange={(e) => handleDateChange('revised', e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              placeholder="DD-MM-YYYY"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Ngày chấp nhận
            </label>
            <input
              type="text"
              value={metadata.dates?.accepted || ''}
              onChange={(e) => handleDateChange('accepted', e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              placeholder="DD-MM-YYYY"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">
              Ngày xuất bản
            </label>
            <input
              type="text"
              value={metadata.dates?.published || ''}
              onChange={(e) => handleDateChange('published', e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 p-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30"
              placeholder="DD-MM-YYYY"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
