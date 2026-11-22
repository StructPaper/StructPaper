'use client';

import React, { useRef, useState } from 'react';
import { Paperclip, Settings2 } from 'lucide-react';
import type { PaperMetadata, PaperReference, PaperSection } from '@/types/paper';
import type { AppendixSettings } from '@/lib/appendix';
import { SectionsTab } from './SectionsTab';
import { AppendixSettingsModal } from './AppendixSettingsModal';

interface Props {
  /** The appendices (only those). */
  sections: PaperSection[];
  onChange: (next: PaperSection[]) => void;
  metadata: PaperMetadata;
  references?: PaperReference[];
  settings: AppendixSettings;
  /** The whole settings the author saved in the popup. */
  onSettings: (settings: AppendixSettings) => void;
  focusRequest?: React.ComponentProps<typeof SectionsTab>['focusRequest'];
}

/** The "Phụ lục" tab: a title like the other tabs, a button for the settings, and the appendices (tables and figures). */
export const AppendixTab: React.FC<Props> = ({ sections, onChange, metadata, references, settings, onSettings, focusRequest }) => {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | undefined>();
  const button = useRef<HTMLButtonElement>(null);
  return (
    <div className="h-full flex flex-col min-h-0 min-w-0" data-testid="appendix-tab">
      <div className="flex-shrink-0 flex items-center justify-between mx-4 sm:mx-5 mt-3 pb-2 border-b border-zinc-200/80">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-zinc-700" />
          <h3 className="font-extrabold text-sm sm:text-base text-zinc-900">Phụ lục ({sections.length})</h3>
        </div>
        <button
          ref={button}
          type="button"
          data-edit-only
          data-testid="appendix-settings-button"
          title="Cài đặt phụ lục: vị trí, cách đánh số, trang ngang"
          aria-label="Cài đặt phụ lục"
          onClick={() => {
            setRect(button.current?.getBoundingClientRect());
            setOpen(true);
          }}
          className="h-8 w-8 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-700 flex items-center justify-center shadow-2xs cursor-pointer transition-colors"
        >
          <Settings2 className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <SectionsTab sections={sections} onChange={onChange} metadata={metadata} references={references} focusRequest={focusRequest} scope="appendix" />
      </div>
      {open && <AppendixSettingsModal triggerRect={rect} settings={settings} onSave={onSettings} onClose={() => setOpen(false)} />}
    </div>
  );
};
