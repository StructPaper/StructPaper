'use client';

import React from 'react';
import { ViewLayoutMode } from './types';
import {
  Sparkles,
  Save,
  CheckCircle2,
  RefreshCw,
  Columns,
  Square,
  FileText,
  Eye,
} from 'lucide-react';

interface EditorHeaderProps {
  journalName?: string;
  journalAbbv?: string;
  qualityScore: number;
  layoutMode: ViewLayoutMode;
  onLayoutModeChange: (mode: ViewLayoutMode) => void;
  onSave: () => void;
  onRecompile: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
  isCompiling: boolean;
  isDirty?: boolean;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  journalName,
  journalAbbv,
  qualityScore,
  layoutMode,
  onLayoutModeChange,
  onSave,
  onRecompile,
  saveSuccess,
  isCompiling,
  isDirty,
}) => {
  return (
    <div className="soft-card p-4 bg-white border border-[#E8E8EE] rounded-3xl shadow-xs space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left: Title, step badge and journal tag */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-zinc-900 text-[#78C841] flex items-center justify-center font-bold shadow-xs flex-shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-extrabold text-base sm:text-lg text-zinc-900 tracking-tight">
                Biên Tập & Dàn Trang PDF
              </h2>
              {journalAbbv && (
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#D9F99D] text-[#14532D] shadow-2xs">
                  {journalAbbv}
                </span>
              )}
              <span
                className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${
                  qualityScore >= 85
                    ? 'bg-emerald-100 text-emerald-800'
                    : qualityScore >= 70
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                QC: {qualityScore}%
              </span>
            </div>
            <p className="text-xs text-zinc-500 line-clamp-1 mt-0.5">
              Chỉnh sửa thông tin bản thảo và xem trước bản PDF trực tiếp theo chuẩn tòa soạn ĐHQG-HCM.
            </p>
          </div>
        </div>

        {/* Right: Layout Switcher & Action buttons */}
        <div className="flex items-center gap-2 flex-wrap justify-between lg:justify-end">
          {/* View mode switcher (Split / Editor / Preview) on desktop */}
          <div className="hidden sm:flex items-center p-1 bg-zinc-100 rounded-2xl border border-zinc-200/80">
            <button
              type="button"
              onClick={() => onLayoutModeChange('split')}
              title="Chế độ chia đôi 2 cột (Chỉnh sửa + Xem trước PDF)"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                layoutMode === 'split'
                  ? 'bg-white text-zinc-900 shadow-2xs font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Chia đôi</span>
            </button>
            <button
              type="button"
              onClick={() => onLayoutModeChange('editor')}
              title="Chỉ hiển thị khung soạn thảo"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                layoutMode === 'editor'
                  ? 'bg-white text-zinc-900 shadow-2xs font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Soạn thảo</span>
            </button>
            <button
              type="button"
              onClick={() => onLayoutModeChange('preview')}
              title="Chỉ hiển thị bản xem trước PDF"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                layoutMode === 'preview'
                  ? 'bg-white text-zinc-900 shadow-2xs font-extrabold'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem PDF</span>
            </button>
          </div>

          {/* Save Status Notification */}
          {saveSuccess && (
            <span className="text-xs text-[#14532D] font-bold bg-[#D9F99D] px-3 py-1.5 rounded-full flex items-center gap-1 shadow-2xs animate-in fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu!
            </span>
          )}

          {/* Action: Lưu thay đổi */}
          <button
            type="button"
            onClick={onSave}
            className={`btn-pill-subtle text-xs py-2 px-3.5 font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              isDirty ? 'border-amber-300 bg-amber-50/50 text-amber-900' : ''
            }`}
            title="Lưu các thông tin chỉnh sửa vào bộ nhớ"
          >
            <Save className="w-3.5 h-3.5 text-zinc-700" />
            <span>Lưu thay đổi</span>
          </button>

          {/* Action: Cập nhật & Biên dịch PDF */}
          <button
            type="button"
            onClick={onRecompile}
            disabled={isCompiling}
            className="btn-pill-lime text-xs py-2 px-3.5 font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
            title="Lưu và biên dịch lại bản PDF từ dữ liệu mới nhất"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#14532D] ${isCompiling ? 'animate-spin' : ''}`} />
            <span>{isCompiling ? 'Đang xuất PDF...' : 'Cập nhật PDF'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
