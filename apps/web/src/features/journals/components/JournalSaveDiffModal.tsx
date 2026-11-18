'use client';

import React from 'react';
import { GitCompareArrows, Save, Loader2, Info } from 'lucide-react';
import { ModalCard } from '@/components/modals';
import { countChanges, type ChangeGroup, type FieldChange } from '../profile-changes';

interface JournalSaveDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSaving?: boolean;
  /** Journal being saved: shown beside the title so the author knows what they confirm. */
  journalLabel: { short: string; name: string; color: string };
  groups: ChangeGroup[];
  isNew?: boolean;
}

const LINE = 'flex items-start gap-2 px-3 py-1.5 font-mono text-[11.5px] leading-relaxed break-words';

const ChangeLines: React.FC<{ change: FieldChange }> = ({ change }) => (
  <div className="rounded-2xl overflow-hidden bg-white/70" data-testid="journal-change">
    <p className="px-3 pt-2 pb-1 text-[11px] font-bold text-zinc-600">{change.label}</p>
    {change.kind !== 'added' && (
      <div className={`${LINE} bg-rose-50 text-rose-800`} data-testid="change-removed">
        <span className="select-none font-black w-3 shrink-0">−</span>
        <span className="min-w-0">{change.before}</span>
      </div>
    )}
    {change.kind !== 'removed' && (
      <div className={`${LINE} bg-emerald-50 text-emerald-800`} data-testid="change-added">
        <span className="select-none font-black w-3 shrink-0">+</span>
        <span className="min-w-0">{change.after}</span>
      </div>
    )}
  </div>
);

/**
 * Shown before a journal is saved: every value that changed as removed (−) and added (+) lines, the way a code diff reads,
 * split into who the journal is (saved at once) and its layout rules (published as a new version).
 */
export const JournalSaveDiffModal: React.FC<JournalSaveDiffModalProps> = ({ isOpen, onClose, onConfirm, isSaving = false, journalLabel, groups, isNew = false }) => {
  const counts = countChanges(groups);
  const publishes = counts.rules > 0;

  return (
    <ModalCard
      isOpen={isOpen}
      onClose={isSaving ? () => undefined : onClose}
      icon={<GitCompareArrows className="w-5 h-5" />}
      title={isNew ? 'Tạo tạp chí mới?' : 'Xem lại thay đổi trước khi lưu'}
      subtitle={
        <span className="inline-flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold text-white" style={{ backgroundColor: journalLabel.color }}>
            {journalLabel.short}
          </span>
          <span className="truncate">{journalLabel.name}</span>
        </span>
      }
      headerExtra={
        counts.total > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold" data-testid="diff-counts">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">+{counts.added}</span>
            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">−{counts.removed}</span>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">~{counts.changed}</span>
          </span>
        ) : null
      }
      maxWidthClass="max-w-[720px]"
      testId="template-save-confirm-modal"
      footer={
        <div className="space-y-3">
          {publishes && (
            <p className="flex items-start gap-2 text-[11.5px] text-amber-800 bg-amber-50 rounded-2xl px-3 py-2 leading-relaxed" data-testid="diff-publish-note">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Thay đổi quy định sẽ được xuất bản thành một phiên bản mới. Bài đã ghim vào phiên bản cũ vẫn giữ nguyên quy định cũ.</span>
            </p>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="w-full py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
            >
              Quay lại chỉnh sửa
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isSaving}
              data-testid="confirm-save-template-btn"
              className="w-full py-2.5 sm:py-3 rounded-full text-xs sm:text-sm font-bold bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950 shadow-lg shadow-[#78C841]/25 hover:shadow-[#78C841]/40 hover:scale-102 active:scale-98 transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{isSaving ? 'Đang lưu...' : isNew ? 'Tạo tạp chí' : 'Lưu thay đổi'}</span>
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-1">
        {groups.length === 0 && (
          <p className="text-xs font-bold text-zinc-500 bg-gray-200/50 rounded-3xl px-4 py-5 text-center" data-testid="diff-empty">
            {isNew ? 'Tạp chí mới sẽ kế thừa toàn bộ quy tắc chung.' : 'Không có thay đổi nào so với bản đã lưu.'}
          </p>
        )}
        {groups.map((group) => (
          <section key={`${group.scope}-${group.title}`} className="rounded-3xl bg-gray-200/50 p-3 space-y-2" data-testid={`diff-group-${group.scope}`}>
            <div className="flex items-center gap-2 px-1">
              <h4 className="text-xs font-extrabold text-zinc-900">{group.title}</h4>
              <span className="text-[10px] font-bold text-zinc-500">{group.scope === 'identity' ? 'lưu ngay' : 'phiên bản mới'}</span>
              <span className="ml-auto text-[10.5px] font-bold text-zinc-500">{group.changes.length}</span>
            </div>
            <div className="space-y-1.5">
              {group.changes.map((change) => (
                <ChangeLines key={change.label + change.kind} change={change} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </ModalCard>
  );
};
