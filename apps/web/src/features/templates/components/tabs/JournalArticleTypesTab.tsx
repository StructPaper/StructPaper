'use client';

import React, { useState } from 'react';
import {
  JournalProfile,
  JournalArticleType,
  ALL_ARTICLE_TYPES,
} from '@structpaper/journal-profiles';
import { Layers, Plus, Trash2, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { toast } from '@/components/DynamicIslandToast';

interface JournalArticleTypesTabProps {
  profile: JournalProfile;
  onChange: (updated: Partial<JournalProfile>) => void;
}

const SECTION_OPTIONS = [
  { id: 'heading.abstract', label: 'Tóm tắt (Abstract)' },
  { id: 'h1', label: 'Nội dung chính (H1/IMRaD)' },
  { id: 'heading.references', label: 'Tài liệu tham khảo (References)' },
  { id: 'back.ethics', label: 'Tuyên bố đạo đức (Ethics)' },
  { id: 'back.conflict', label: 'Xung đột lợi ích (Conflict)' },
];

export const JournalArticleTypesTab: React.FC<JournalArticleTypesTabProps> = ({
  profile,
  onChange,
}) => {
  const currentTypes: JournalArticleType[] =
    profile.articleTypes && profile.articleTypes.length > 0
      ? profile.articleTypes
      : ALL_ARTICLE_TYPES;

  const [selectedTypeId, setSelectedTypeId] = useState<string>(currentTypes[0]?.id || 'research');
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newTypeId, setNewTypeId] = useState('');
  const [newLabelVi, setNewLabelVi] = useState('');
  const [newLabelEn, setNewLabelEn] = useState('');

  const selectedType = currentTypes.find((t) => t.id === selectedTypeId) || currentTypes[0];

  const handleUpdateType = (typeId: string, patch: Partial<JournalArticleType>) => {
    const updated = currentTypes.map((t) => {
      if (t.id === typeId) {
        return { ...t, ...patch };
      }
      return t;
    });
    onChange({ articleTypes: updated });
  };

  const handleToggleSection = (typeId: string, secId: string) => {
    if (!selectedType) return;
    const exists = selectedType.requiredSections.includes(secId);
    const nextSections = exists
      ? selectedType.requiredSections.filter((s) => s !== secId)
      : [...selectedType.requiredSections, secId];
    handleUpdateType(typeId, { requiredSections: nextSections });
  };

  const handleRemoveType = (typeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentTypes.length <= 1) {
      toast.warning('Không thể xóa', 'Tạp chí phải có tối thiểu 1 loại bài báo.');
      return;
    }
    const updated = currentTypes.filter((t) => t.id !== typeId);
    onChange({ articleTypes: updated });
    toast.info('Đã xóa chuyên mục', 'Đã loại bỏ chuyên mục khỏi danh sách tiếp nhận của tạp chí.');
    if (selectedTypeId === typeId) {
      setSelectedTypeId(updated[0]?.id || '');
    }
  };

  const handleCreateNewType = () => {
    const cleanId = newTypeId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    if (!cleanId || !newLabelVi.trim()) {
      toast.warning('Thiếu thông tin', 'Vui lòng nhập mã định danh và tên tiếng Việt cho chuyên mục.');
      return;
    }
    if (currentTypes.some((t) => t.id === cleanId)) {
      toast.warning('Trùng lặp', 'Mã chuyên mục này đã tồn tại trong tạp chí.');
      return;
    }

    const newType: JournalArticleType = {
      id: cleanId,
      label: {
        vi: newLabelVi.trim(),
        en: newLabelEn.trim() || newLabelVi.trim(),
      },
      requiredSections: ['heading.abstract', 'h1', 'heading.references'],
    };

    const updated = [...currentTypes, newType];
    onChange({ articleTypes: updated });
    toast.success('Đã thêm chuyên mục', `Đã thêm chuyên mục "${newLabelVi.trim()}"`);
    setSelectedTypeId(cleanId);
    setIsAddingNew(false);
    setNewTypeId('');
    setNewLabelVi('');
    setNewLabelEn('');
  };

  return (
    <div className="space-y-5 w-full">
      {/* Overview Banner */}
      <div className="p-5 pb-2 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-extrabold text-sm text-zinc-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#78C841]" strokeWidth={2.5} />
            <span>Chuyên Mục Tạp Chí Này Được Tiếp Nhận</span>
          </h3>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingNew(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 text-[#78C841]" />
          <span>Thêm chuyên mục</span>
        </button>
      </div>

      {/* Add New Type Modal / Form */}
      {isAddingNew && (
        <div className="bg-[#E4F8D5]/60 border border-[#D9F99D] rounded-[36px] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#D9F99D] pb-2">
            <h4 className="font-extrabold text-xs text-[#14532D] uppercase tracking-wider">
              Khởi tạo thể loại bài báo mới
            </h4>
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="p-1 rounded-lg text-zinc-500 hover:text-zinc-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                Mã định danh (ID) *
              </label>
              <input
                type="text"
                value={newTypeId}
                onChange={(e) => setNewTypeId(e.target.value)}
                placeholder="VD: clinical-case"
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-zinc-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                Tên tiếng Việt *
              </label>
              <input
                type="text"
                value={newLabelVi}
                onChange={(e) => setNewLabelVi(e.target.value)}
                placeholder="VD: Báo cáo ca lâm sàng"
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs font-bold text-zinc-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-700 mb-1">
                Tên tiếng Anh (International)
              </label>
              <input
                type="text"
                value={newLabelEn}
                onChange={(e) => setNewLabelEn(e.target.value)}
                placeholder="VD: Clinical Case Report"
                className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-1.5 text-xs text-zinc-900 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddingNew(false)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-zinc-600 hover:bg-white"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleCreateNewType}
              className="px-4 py-1.5 rounded-xl text-xs font-extrabold bg-[#14532D] text-white hover:bg-[#14532D]/90 shadow-xs"
            >
              Thêm chuyên mục này
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: List on Left, Editor on Right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left column: List of Article Types */}
        <div className="md:col-span-5 border-r border-zinc-200 p-2.5 space-y-1.5 shadow-xs">
          <div className="px-3 py-1.5 text-[11px] font-extrabold text-zinc-400 uppercase tracking-wider flex justify-between">
            <span>Danh mục ({currentTypes.length})</span>
            <span>Trạng thái</span>
          </div>

          {currentTypes.map((type) => {
            const isSelected = type.id === selectedTypeId;
            return (
              <div
                key={type.id}
                onClick={() => setSelectedTypeId(type.id)}
                className={`w-full text-left p-3 border-b border-zinc-200 transition-all cursor-pointer flex items-center justify-between group ${
                  isSelected
                    ? 'rounded-2xl ring-4 ring-blue-300 shadow-xs'
                    : 'hover:bg-white text-zinc-700'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-extrabold truncate">
                    {type.label?.vi || type.id}
                  </div>
                  <div
                    className={`text-[10.5px] truncate font-medium ${
                      isSelected ? 'text-zinc-500' : 'text-zinc-500'
                    }`}
                  >
                    {type.label?.en || type.id}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isSelected
                        ? 'bg-zinc-200/70 text-zinc-600'
                        : 'bg-zinc-200/70 text-zinc-600'
                    }`}
                  >
                    {type.requiredSections?.length || 0} mục
                  </span>

                  {currentTypes.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveType(type.id, e)}
                      title="Xóa chuyên mục này khỏi tạp chí"
                      className={`p-1 rounded-lg transition-colors ${
                        isSelected
                          ? 'hover:bg-white/20 text-zinc-400 hover:text-white'
                          : 'hover:bg-rose-100 text-zinc-400 hover:text-rose-600'
                      }`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right column: Selected Article Type Detail */}
        {selectedType && (
          <div className="md:col-span-7 p-5 pl-1 space-y-4">
            <div className="border-b border-zinc-200 pb-2">
              {/* <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest block">
                MÃ THỂ LOẠI: {selectedType.id}
              </span> */}
              <h4 className="text-sm sm:text-base font-extrabold text-zinc-900">
                {selectedType.label?.vi || selectedType.id}
              </h4>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Tên hiển thị tiếng Việt:
                </label>
                <input
                  type="text"
                  value={selectedType.label?.vi || ''}
                  onChange={(e) =>
                    handleUpdateType(selectedType.id, {
                      label: { ...selectedType.label, vi: e.target.value },
                    })
                  }
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-zinc-900 focus:bg-white focus:border-[#78C841] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 mb-1">
                  Tên hiển thị tiếng Anh:
                </label>
                <input
                  type="text"
                  value={selectedType.label?.en || ''}
                  onChange={(e) =>
                    handleUpdateType(selectedType.id, {
                      label: { ...selectedType.label, en: e.target.value },
                    })
                  }
                  className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-900 focus:bg-white focus:border-[#78C841] outline-none"
                />
              </div>
            </div>

            {/* Required Sections Selection */}
            <div className="pt-2 space-y-2.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-zinc-900">
                <ShieldCheck className="w-4 h-4 text-[#78C841]" strokeWidth={2.5} />
                <span>Các đề mục bắt buộc kiểm duyệt (Preflight Rules):</span>
              </div>

              <div className="space-y-2">
                {SECTION_OPTIONS.map((sec) => {
                  const isChecked = selectedType.requiredSections.includes(sec.id);
                  return (
                    <label
                      key={sec.id}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'border-[#78C841] bg-[#E4F8D5]/30'
                          : 'border-zinc-200/80 bg-zinc-50/50 hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSection(selectedType.id, sec.id)}
                          className="rounded text-[#78C841] focus:ring-[#78C841] w-4 h-4"
                        />
                        <span className="text-xs font-bold text-zinc-800">{sec.label}</span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 font-semibold">
                        {sec.id}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
