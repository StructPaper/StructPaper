'use client';

import React, { useState, useEffect, useMemo } from 'react';
import type { ManuscriptRecord, WorkflowStatus, ManuscriptInfo } from '@structpaper/doc-model';
import { X, Sliders, Save, Tag, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { WORKFLOW_STATUS_CONFIG } from './types';
import { Select, SelectOption } from '@/components/ui/Select';
import { ModalPortal } from '@/components/modals/ModalPortal';
import { validateDisplayNameUniqueness } from '@/lib/storage/paper-naming';
import { toast } from '@/components/DynamicIslandToast';

interface PaperQuickEditModalProps {
  paper: ManuscriptRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (id: string, patch: Partial<ManuscriptInfo>) => Promise<void>;
}

const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

const STATUS_OPTIONS: SelectOption<WorkflowStatus>[] = [
  {
    value: 'draft',
    label: WORKFLOW_STATUS_CONFIG.draft.label,
    description: 'Bản thảo đang được tác giả biên soạn',
    badge: 'Draft',
    color: '#71717A',
  },
  {
    value: 'in-review',
    label: WORKFLOW_STATUS_CONFIG['in-review'].label,
    description: 'Đang trong quá trình bình duyệt kín',
    badge: 'Review',
    color: '#F59E0B',
  },
  {
    value: 'proofing',
    label: WORKFLOW_STATUS_CONFIG.proofing.label,
    description: 'Đang hiệu đính dàn trang và kiểm tra lỗi chính tả',
    badge: 'Proof',
    color: '#3B82F6',
  },
  {
    value: 'ready',
    label: WORKFLOW_STATUS_CONFIG.ready.label,
    description: 'Bản thảo hoàn tất kiểm tra, sẵn sàng phát hành',
    badge: 'Ready',
    color: '#8B5CF6',
  },
  {
    value: 'published',
    label: WORKFLOW_STATUS_CONFIG.published.label,
    description: 'Đã xuất bản chính thức trên tạp chí',
    badge: 'Published',
    color: '#10B981',
  },
];

export const PaperQuickEditModal: React.FC<PaperQuickEditModalProps> = ({
  paper,
  isOpen,
  onClose,
  onSave,
}) => {
  const [cachedPaper, setCachedPaper] = useState<ManuscriptRecord | null>(paper);

  useEffect(() => {
    if (paper) {
      setCachedPaper(paper);
    }
  }, [paper]);

  const activePaper = paper || cachedPaper;

  const [displayName, setDisplayName] = useState(activePaper?.info.displayName || '');
  const [submissionId, setSubmissionId] = useState(activePaper?.info.submissionId || '');
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>(
    activePaper?.info.workflowStatus || 'draft'
  );
  const [note, setNote] = useState(activePaper?.info.note || '');
  const [tags, setTags] = useState<string[]>(activePaper?.info.tags || []);
  const [newTagInput, setNewTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activePaper) {
      setDisplayName(activePaper.info.displayName || '');
      setSubmissionId(activePaper.info.submissionId || '');
      setWorkflowStatus(activePaper.info.workflowStatus || 'draft');
      setNote(activePaper.info.note || '');
      setTags(activePaper.info.tags || []);
      setError(null);
    }
  }, [activePaper]);

  // Tiêu đề học thuật bên trong nội dung bài báo (độc lập với tên hiển thị quản lý)
  const academicTitle = useMemo(() => {
    if (!activePaper) return '';
    if (Array.isArray(activePaper.doc?.meta?.title)) {
      const extracted = activePaper.doc.meta.title
        .map((item: any) => (typeof item === 'string' ? item : item?.v || item?.text || ''))
        .join('')
        .trim();
      if (extracted) return extracted;
    }
    const anyDoc = activePaper.doc as any;
    if (typeof anyDoc?.metadata?.title === 'string' && anyDoc.metadata.title.trim()) {
      return anyDoc.metadata.title.trim();
    }
    return '';
  }, [activePaper]);

  if (!activePaper) return null;
  const { info } = activePaper;

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const trimmed = newTagInput.trim().replace(/^#/, '');
      if (trimmed && !tags.includes(trimmed)) {
        setTags([...tags, trimmed]);
      }
      setNewTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      setError('Vui lòng nhập tên hiển thị cho bài báo.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      // Hiệu ứng kiểm tra mượt mà để nút xoay và hoàn tất thẩm định tính hợp lệ
      if (!isTest) {
        await new Promise((resolve) => setTimeout(resolve, 550));
      }

      // Kiểm tra trùng lặp tên hiển thị và tiêu đề bài báo trong cơ sở dữ liệu IndexedDB
      const { isDuplicate, duplicateSubmissionId } = await validateDisplayNameUniqueness(
        info.id,
        trimmedDisplayName
      );

      if (isDuplicate) {
        const errorMsg = `Tên hiển thị "${trimmedDisplayName}" đã tồn tại trên một bài báo khác trong hệ thống (Mã: ${duplicateSubmissionId}). Hệ thống quy định tiêu đề và tên hiển thị không được trùng nhau, vui lòng đặt tên phân biệt.`;
        setError(errorMsg);
        toast.warning('Tên bài báo bị trùng', errorMsg);
        setIsSaving(false);
        return;
      }

      await onSave(info.id, {
        displayName: trimmedDisplayName,
        submissionId: submissionId.trim() || undefined,
        workflowStatus,
        note: note.trim() || undefined,
        tags,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi lưu thông tin bài báo.');
    } finally {
      setIsSaving(false);
    }
  };

  const activeStatusCfg = WORKFLOW_STATUS_CONFIG[workflowStatus] || WORKFLOW_STATUS_CONFIG.draft;

  return (
    <ModalPortal isOpen={isOpen} onClose={onClose}>
      <motion.div
        data-testid="quick-edit-modal"
        initial={isTest ? undefined : { opacity: 0, scale: 0.9, y: 30 }}
        animate={isTest ? undefined : { opacity: 1, scale: 1, y: 0 }}
        exit={
          isTest
            ? undefined
            : {
                opacity: 0,
                scale: 0.9,
                y: 30,
                transition: { duration: 0.22, ease: [0.32, 0, 0.67, 0] },
              }
        }
        transition={isTest ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 200 }}
        className="bg-[#F8F9FA] w-full max-w-2xl rounded-[40px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/20 select-text"
      >
        {/* Header - Eatzy OrderDetailsModal Identity */}
        <div className="px-7 pt-6 pb-0 sm:px-8 flex items-center justify-between sticky top-0 z-10 shadow-xs">
          <div>
            <div className="flex items-center gap-2.5">
              
              <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Sửa thông tin nhanh 
              </h3>
            </div>
            <div className="flex items-center gap-2 mt-1 pl-0.5">
              <span className="text-xs font-semibold text-gray-400">ID:</span>
              <span className="text-xs font-bold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md">
                {submissionId || info.id.slice(0, 10)}
              </span>
              <span className="text-gray-300">•</span>
              <span className="text-xs text-gray-500 font-medium">
                {info.updatedAt ? new Date(info.updatedAt).toLocaleDateString('vi-VN') : 'Mới tạo'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Status pill badge */}
            <div
              className={`px-3.5 py-1.5 rounded-full text-[11px] font-extrabold uppercase border flex items-center gap-1.5 ${activeStatusCfg.chipBg} ${activeStatusCfg.chipText} ${activeStatusCfg.border}`}
            >
              {activeStatusCfg.label}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-200 transition-all cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Card 1: Display Name */}
          <div className="p-3 px-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                <span>Tên hiển thị bài báo</span>
                <span className="text-rose-500">*</span>
              </label>
              <span className="text-[10px] text-zinc-400 font-normal">
                Tên định danh quản lý nội bộ (không thay đổi nội dung bài báo)
              </span>
            </div>
            <input
              type="text"
              data-testid="quick-edit-displayname"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Nhập tên đại diện hoặc tiêu đề bài báo..."
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-900 outline-none focus:bg-white focus:border-[#78C841] focus:ring-4 focus:ring-[#78C841]/10 transition-all"
              required
            />
            {academicTitle && academicTitle !== displayName && (
              <p className="text-[11px] text-zinc-500 flex items-start gap-1 pt-0.5">
                <span className="font-semibold text-zinc-600 shrink-0">Tiêu đề học thuật trong bài:</span>
                <span className="italic text-zinc-600 line-clamp-1">{academicTitle}</span>
              </p>
            )}
          </div>

          {/* Card 2: Submission ID & Workflow Status (Custom Select) */}
          <div className="p-3 px-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-800">
                Mã định danh nộp bài (Submission ID)
              </label>
              <input
                type="text"
                data-testid="quick-edit-submissionid"
                value={submissionId}
                onChange={(e) => setSubmissionId(e.target.value)}
                placeholder="VD: ID630_HS, STDJ_2026_01"
                className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2 text-xs sm:text-sm font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-[#78C841] focus:ring-4 focus:ring-[#78C841]/10 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-extrabold text-slate-800">
                Trạng thái quy trình xuất bản
              </label>
              <Select
                value={workflowStatus}
                onChange={(val) => setWorkflowStatus(val as WorkflowStatus)}
                options={STATUS_OPTIONS}
                variant="slate"
                size="sm"
              />
              {/* Synchronized hidden select to maintain test automation compatibility */}
              <select
                data-testid="quick-edit-status"
                value={workflowStatus}
                onChange={(e) => setWorkflowStatus(e.target.value as WorkflowStatus)}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Card 3: Tags */}
          <div className="p-3 px-5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-zinc-500" />
                <span>Thẻ phân loại (Tags)</span>
              </label>
              <span className="text-[10.5px] text-zinc-400">
                Nhấn Enter hoặc phẩy để thêm thẻ
              </span>
            </div>

            <div className="min-h-[44px] p-2 bg-white border border-slate-200/90 rounded-2xl flex flex-wrap gap-1.5 items-center">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-gray-200/50 border border-slate-200 text-xs font-bold text-slate-800 shadow-2xs"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="w-4 h-4 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    ×
                  </button>
                </span>
              ))}

              <input
                type="text"
                data-testid="quick-edit-tags-input"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder={tags.length === 0 ? 'Thêm thẻ (VD: AI, IoT, Y Sinh)...' : ''}
                className="flex-1 min-w-[140px] bg-transparent text-xs sm:text-sm font-medium text-slate-800 outline-none px-2"
              />
            </div>
          </div>

          {/* Card 4: Note */}
          <div className="p-3 px-5 space-y-1.5">
            <label className="text-xs font-extrabold text-slate-800">
              Ghi chú nội bộ / Tiến độ
            </label>
            <textarea
              data-testid="quick-edit-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Ghi chú về tiến độ phản biện, ý kiến ban biên tập..."
              className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-[#78C841] focus:ring-4 focus:ring-[#78C841]/10 transition-all resize-none"
            />
          </div>

          {/* Sticky Modal Footer */}
          <div className="pt-2 flex items-center justify-end gap-3 sticky bottom-0 bg-[#F8F9FA]/90 backdrop-blur-sm py-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-slate-600 hover:text-slate-950 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              data-testid="quick-edit-submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-7 py-2.5 rounded-full text-xs sm:text-sm font-extrabold bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950 shadow-md shadow-[#78C841]/20 hover:scale-102 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{isSaving ? 'Đang kiểm tra & lưu...' : 'Lưu thông tin'}</span>
            </button>
          </div>
        </form>
      </motion.div>
    </ModalPortal>
  );
};
