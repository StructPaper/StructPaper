'use client';

import React from 'react';
import { History } from 'lucide-react';
import { useEditorSession } from '@/context/EditorSessionContext';

/**
 * Left of the title bar on a journal's template page: the journal's code in its colour and its name in the language
 * chosen at the right (the same choice that sets the language of the PDF preview).
 */
export const JournalTitleBarInfo: React.FC = () => {
  const { journalBar, pdfLanguage } = useEditorSession();
  if (!journalBar) return null;
  const name = (pdfLanguage === 'en' ? journalBar.names.en : journalBar.names.vi) || journalBar.names.vi || journalBar.names.en;

  return (
    <div className="flex items-center gap-2 min-w-0" data-testid="titlebar-journal" data-no-drag="true">
      <span
        className="shrink-0 px-2.5 py-0.5 rounded-full text-[10.5px] font-extrabold text-white shadow-2xs tracking-wide"
        style={{ backgroundColor: journalBar.color }}
        data-testid="titlebar-journal-code"
      >
        {journalBar.short}
      </span>
      <span key={pdfLanguage} className="text-[12px] font-extrabold text-zinc-800 truncate max-w-[34vw] animate-in fade-in duration-200" data-testid="titlebar-journal-name">
        {name}
      </span>
    </div>
  );
};

/** Right of the title bar on a journal's template page: opens the version history and says which version is on screen. */
export const JournalHistoryButton: React.FC = () => {
  const { journalBar } = useEditorSession();
  if (!journalBar?.onOpenHistory) return null;
  const viewing = journalBar.viewing;
  const old = viewing ? !viewing.isCurrent : false;

  return (
    <button
      type="button"
      onClick={journalBar.onOpenHistory}
      data-testid="titlebar-journal-history"
      data-no-drag="true"
      title="Lịch sử phiên bản quy định"
      aria-label="Lịch sử phiên bản quy định"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-100 hover:bg-[#78C841] hover:text-zinc-950 text-zinc-600 transition-all duration-200 cursor-pointer select-none active:scale-95"
    >
      <History className="w-3.5 h-3.5" />
      <span>Lịch sử</span>
      {viewing && (
        <span
          data-testid="titlebar-journal-version"
          className={`px-1.5 py-px rounded-full text-[10px] font-extrabold ${old ? 'bg-amber-200 text-amber-900' : 'bg-[#D9F99D] text-[#14532D]'}`}
        >
          v{viewing.version}
          {old ? ' · bản cũ' : ' · hiện hành'}
        </span>
      )}
    </button>
  );
};
