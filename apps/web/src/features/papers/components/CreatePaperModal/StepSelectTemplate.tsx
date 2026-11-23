'use client';

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import type { ManagedJournalProfile } from '@/lib/templates/journal-storage';
import { useJournalTemplates } from '@/features/journals';
import { Shimmer } from '@/components/ui/Shimmer';
import { CompactTemplateCard } from './CompactTemplateCard';

interface StepSelectTemplateProps {
  /** null = no template chosen: the journal is detected from the file. */
  onConfirm: (managed: ManagedJournalProfile | null) => void;
  onBack: () => void;
  /** The paper is being checked and created: Continue spins and nothing can be pressed twice. */
  busy?: boolean;
}

export const StepSelectTemplate: React.FC<StepSelectTemplateProps> = ({
  onConfirm,
  onBack,
  busy = false,
}) => {
  const { templates: journals, isLoading } = useJournalTemplates();
  // Nothing is chosen up front. A card chosen again is un-chosen; without a choice it is automatic.
  const [selectedManaged, setSelectedManaged] = useState<ManagedJournalProfile | null>(null);

  const handleSelectCard = (managed: ManagedJournalProfile) => {
    setSelectedManaged((current) => (current?.id === managed.id ? null : managed));
  };

  const handleContinue = () => {
    if (!busy) onConfirm(selectedManaged);
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-3">
      {/* Top Header info */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại tải file</span>
        </button>

        <span className="text-[11px] font-bold text-slate-400">
          {isLoading ? '' : `${journals.length} Mẫu tạp chí ĐHQG-HCM`}
        </span>
      </div>

      {/* Grid of Compact Template Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto p-1 px-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1 custom-scrollbar">
        {isLoading && Array.from({ length: 6 }, (_, i) => <Shimmer key={`s${i}`} className="h-[88px] w-full rounded-2xl" />)}
        {journals.map((journal) => (
          <CompactTemplateCard
            key={journal.id}
            managed={journal}
            isSelected={selectedManaged?.id === journal.id}
            onSelect={handleSelectCard}
          />
        ))}
      </div>

      {/* Action Footer: Continue to Editor Button */}
      <div className="flex-shrink-0 pt-3 border-t border-slate-200/60 flex items-center justify-between">
        <div className="text-xs text-slate-500 font-medium">
          {selectedManaged ? (
            <>
              Mẫu đang chọn:{' '}
              <span className="font-black text-slate-900">
                {selectedManaged.profile.names?.short || selectedManaged.id.toUpperCase()}
              </span>
              <span className="text-slate-400"> · bấm lại để bỏ chọn</span>
            </>
          ) : (
            <span data-testid="template-auto-hint">Chưa chọn mẫu: hệ thống sẽ tự nhận diện tạp chí từ file</span>
          )}
        </div>

        <button
          type="button"
          data-testid="continue-to-editor-btn"
          onClick={handleContinue}
          disabled={busy}
          aria-busy={busy}
          className="px-6 py-2.5 rounded-full bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950 font-extrabold text-xs inline-flex items-center gap-2 shadow-md shadow-[#78C841]/20 hover:scale-102 active:scale-98 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-wait disabled:hover:scale-100"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          <span>{busy ? 'Đang xử lý...' : 'Tiếp tục'}</span>
          {busy ? null : <ArrowRight className="w-4 h-4 stroke-[2.5]" />}
        </button>
      </div>
    </div>
  );
};
