'use client';

import React, { useEffect, useState } from 'react';
import { Bookmark, Loader2, Check } from 'lucide-react';
import { ModalCard } from '@/components/modals';

interface VersionNameModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** "save": keep the paper as it is now; "rename": change the name of a version. */
  mode: 'save' | 'rename';
  initialName?: string;
  initialDescription?: string;
  isSaving?: boolean;
  onSubmit: (value: { name: string; description: string }) => void;
}

const FIELD =
  'w-full bg-gray-200/60 rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-900 placeholder:text-zinc-400 outline-none ring-2 ring-transparent focus:bg-white focus:ring-[#78C841]/40 transition-all';

/** Names a version ("Gửi tòa soạn lần 1"): used to keep the paper as it is now, and to rename a version later. */
export const VersionNameModal: React.FC<VersionNameModalProps> = ({ isOpen, onClose, mode, initialName = '', initialDescription = '', isSaving = false, onSubmit }) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setDescription(initialDescription);
    }
  }, [isOpen, initialName, initialDescription]);

  const valid = name.trim().length > 0 && name.trim().length <= 120;
  const submit = () => valid && !isSaving && onSubmit({ name: name.trim(), description: description.trim() });

  return (
    <ModalCard
      isOpen={isOpen}
      onClose={isSaving ? () => undefined : onClose}
      icon={<Bookmark className="w-5 h-5" />}
      title={mode === 'save' ? 'Lưu phiên bản có tên' : 'Đổi tên phiên bản'}
      subtitle={mode === 'save' ? 'Giữ bài báo đúng như lúc này để quay lại khi cần. Phiên bản có tên không bị xóa tự động.' : 'Tên giúp bạn tìm lại phiên bản này trong lịch sử.'}
      maxWidthClass="max-w-[480px]"
      zIndex={130}
      testId="version-name-modal"
      footer={
        <div className="grid grid-cols-2 gap-2.5">
          <button type="button" onClick={onClose} disabled={isSaving} className="w-full py-2.5 rounded-full text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer active:scale-95 disabled:opacity-50">
            Hủy bỏ
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!valid || isSaving}
            data-testid="version-name-submit"
            className="w-full py-2.5 rounded-full text-xs sm:text-sm font-bold bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950 shadow-lg shadow-[#78C841]/25 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>{isSaving ? 'Đang lưu...' : mode === 'save' ? 'Lưu phiên bản' : 'Đổi tên'}</span>
          </button>
        </div>
      }
    >
      <div className="space-y-3 pb-1">
        <label className="block">
          <span className="block text-[11px] font-bold text-zinc-600 mb-1 px-1">Tên phiên bản</span>
          <input autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} placeholder="Ví dụ: Gửi tòa soạn lần 1" data-testid="version-name-input" className={FIELD} />
        </label>
        <label className="block">
          <span className="block text-[11px] font-bold text-zinc-600 mb-1 px-1">Ghi chú (không bắt buộc)</span>
          <textarea value={description} maxLength={1000} rows={3} onChange={(e) => setDescription(e.target.value)} placeholder="Phiên bản này khác gì…" data-testid="version-description-input" className={`${FIELD} resize-none`} />
        </label>
      </div>
    </ModalCard>
  );
};
