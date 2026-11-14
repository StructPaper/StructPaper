'use client';

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { ManagedJournalProfile, getDefaultVnuhcmJournals } from '@/lib/templates/journal-storage';
import { CompactTemplateCard } from './CompactTemplateCard';

interface StepSelectTemplateProps {
  onConfirm: (managed: ManagedJournalProfile) => void;
  onBack: () => void;
  selectedJournalId?: string;
}

export const StepSelectTemplate: React.FC<StepSelectTemplateProps> = ({
  onConfirm,
  onBack,
  selectedJournalId,
}) => {
  const journals = getDefaultVnuhcmJournals();
  const initialJournal =
    journals.find((j) => j.id.toLowerCase() === selectedJournalId?.toLowerCase()) ||
    journals[0];

  const [selectedManaged, setSelectedManaged] = useState<ManagedJournalProfile>(initialJournal);

  const handleSelectCard = (managed: ManagedJournalProfile) => {
    setSelectedManaged(managed);
  };

  const handleContinue = () => {
    if (selectedManaged) {
      onConfirm(selectedManaged);
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col space-y-3">
      {/* Top Header info */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Quay lại tải file</span>
        </button>

        <span className="text-[11px] font-bold text-slate-400">
          7 Mẫu tạp chí ĐHQG-HCM
        </span>
      </div>

      {/* Grid of Compact Template Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto p-1 px-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1 custom-scrollbar">
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
          Mẫu đang chọn:{' '}
          <span className="font-black text-slate-900">
            {selectedManaged?.profile.names?.short || selectedManaged?.id.toUpperCase()}
          </span>
        </div>

        <button
          type="button"
          data-testid="continue-to-editor-btn"
          disabled={!selectedManaged}
          onClick={handleContinue}
          className="px-6 py-2.5 rounded-full bg-[#78C841] hover:bg-[#6cb43a] text-zinc-950 font-extrabold text-xs inline-flex items-center gap-2 shadow-md shadow-[#78C841]/20 hover:scale-102 active:scale-98 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Tiếp tục</span>
          <ArrowRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};
