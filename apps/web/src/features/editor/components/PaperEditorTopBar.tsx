'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { CompletePaper } from '@/types/paper';
import { UniversalTemplateSchema } from '@/types/template-builder';
import {
  ArrowLeft,
  Save,
  CheckCircle2,
  Clock,
  Download,
  Share2,
  FileText,
  Sparkles,
} from 'lucide-react';

interface PaperEditorTopBarProps {
  paper: CompletePaper;
  template: UniversalTemplateSchema;
  isSaving: boolean;
  isDirty: boolean;
  lastSavedAt: string | null;
  onUpdateTitle: (newTitle: string) => void;
  onUpdateStatus: (newStatus: 'draft' | 'review' | 'ready') => void;
  onSave: () => void;
  onDownloadTypst: () => void;
}

export const PaperEditorTopBar: React.FC<PaperEditorTopBarProps> = ({
  paper,
  template,
  isSaving,
  isDirty,
  lastSavedAt,
  onUpdateTitle,
  onUpdateStatus,
  onSave,
  onDownloadTypst,
}) => {
  const router = useRouter();

  const handleBack = () => {
    router.push('/papers');
  };

  return (
    <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={handleBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            title="Quay lại danh sách bài báo"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={paper.metadata.title}
                onChange={(e) => onUpdateTitle(e.target.value)}
                className="font-extrabold text-sm sm:text-base text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-[#78C841] focus:bg-white px-1 py-0.5 rounded transition-all w-full truncate focus:outline-none"
                placeholder="Nhập tiêu đề bài báo..."
              />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-[#14532D] truncate max-w-[200px] sm:max-w-xs">
                Mẫu: {template.name}
              </span>
              <span>•</span>
              {/* Save status */}
              <div className="flex items-center gap-1">
                {isSaving ? (
                  <span className="text-amber-600 flex items-center gap-1 font-medium">
                    <Clock className="w-3 h-3 animate-spin" /> Đang lưu...
                  </span>
                ) : isDirty ? (
                  <span className="text-amber-600 font-medium">
                    Có thay đổi chưa lưu
                  </span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3 h-3" /> Đã lưu
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Status selector & Action buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Status Dropdown */}
          <select
            value={paper.status || 'draft'}
            onChange={(e) => onUpdateStatus(e.target.value as any)}
            className="text-xs font-bold rounded-xl border border-slate-200 px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#78C841]/30 cursor-pointer hidden sm:inline-block"
          >
            <option value="draft">Bản thảo (Draft)</option>
            <option value="review">Chờ phản biện (Under Review)</option>
            <option value="ready">Hoàn tất xuất bản (Ready)</option>
          </select>

          {/* Download Typst */}
          <button
            onClick={onDownloadTypst}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer"
            title="Tải tệp Typst (.typ)"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Tải .typ</span>
          </button>

          {/* Save Button */}
          <button
            onClick={onSave}
            disabled={!isDirty && !isSaving}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-linear-to-r from-[#78C841] to-emerald-600 text-white text-xs font-bold shadow-xs hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lưu bài báo</span>
          </button>
        </div>
      </div>
    </div>
  );
};
