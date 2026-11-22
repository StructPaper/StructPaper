'use client';

import React from 'react';
import { Paperclip } from 'lucide-react';
import type { PaperMetadata, PaperReference, PaperSection } from '@/types/paper';
import { APPENDIX_PLACEMENTS, DEFAULT_APPENDIX, type AppendixPlacement, type AppendixSettings } from '@/lib/appendix';
import { SectionsTab } from './SectionsTab';
import { SegmentedOptions } from './sections/SegmentedOptions';
import { ToggleRow } from './settings-ui';

interface Props {
  /** The appendices (only those). */
  sections: PaperSection[];
  onChange: (next: PaperSection[]) => void;
  metadata: PaperMetadata;
  references?: PaperReference[];
  settings: AppendixSettings;
  onSettings: (patch: Partial<AppendixSettings>) => void;
  focusRequest?: React.ComponentProps<typeof SectionsTab>['focusRequest'];
}

/** The "Phụ lục" tab: where the appendices are printed and how they are numbered and set, then the appendices themselves. */
export const AppendixTab: React.FC<Props> = ({ sections, onChange, metadata, references, settings, onSettings, focusRequest }) => (
  <div className="h-full flex flex-col min-h-0 min-w-0" data-testid="appendix-tab">
    <div className="flex-shrink-0 mx-4 sm:mx-5 mt-3 p-3 rounded-2xl bg-white border border-zinc-200/80 shadow-2xs space-y-2.5" data-testid="appendix-settings">
      <div className="flex items-center gap-2">
        <Paperclip className="w-4 h-4 text-zinc-700" />
        <h3 className="font-extrabold text-sm text-zinc-900">Phụ lục ({sections.length})</h3>
      </div>
      <div>
        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Vị trí khi in</div>
        <SegmentedOptions<AppendixPlacement>
          ariaLabel="Vị trí phụ lục"
          value={settings.placement}
          onChange={(placement) => onSettings({ placement })}
          options={APPENDIX_PLACEMENTS.map((p) => ({ value: p.value, label: p.label, title: p.hint, testId: `appendix-placement-${p.value}` }))}
        />
        <p className="mt-1 text-[10.5px] text-zinc-500">{APPENDIX_PLACEMENTS.find((p) => p.value === settings.placement)?.hint}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <ToggleRow
          checked={settings.landscape}
          onChange={(landscape) => onSettings({ landscape })}
          label="Xoay ngang các trang phụ lục"
          hint="Trang phụ lục chiếm cả bề ngang, như bản in chuẩn."
          testId="appendix-landscape"
        />
        <div>
          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Cách đánh số</div>
          <SegmentedOptions<AppendixSettings['numbering']>
            ariaLabel="Cách đánh số phụ lục"
            value={settings.numbering ?? DEFAULT_APPENDIX.numbering}
            onChange={(numbering) => onSettings({ numbering })}
            options={[
              { value: 'number', label: 'Phụ lục 1, 2, 3', testId: 'appendix-numbering-number' },
              { value: 'letter', label: 'Phụ lục A, B, C', testId: 'appendix-numbering-letter' },
            ]}
          />
        </div>
      </div>
    </div>
    <div className="flex-1 min-h-0">
      <SectionsTab sections={sections} onChange={onChange} metadata={metadata} references={references} focusRequest={focusRequest} scope="appendix" />
    </div>
  </div>
);
