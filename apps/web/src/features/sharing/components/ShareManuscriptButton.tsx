'use client';

import React, { useState } from 'react';
import { Share2, Link2, Check } from 'lucide-react';
import { ShareManuscriptModal } from './ShareManuscriptModal';
import { isServerPaperId, usePaperAccess } from '@/features/papers/access';
import { PaperGate } from '@/features/papers/components/PaperGate';
import { useCopyManuscriptLink } from '../hooks/useCopyManuscriptLink';

const PILL =
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-zinc-100 hover:bg-[#78C841] hover:text-zinc-950 text-zinc-600 transition-all cursor-pointer select-none';

/**
 * Title-bar share control. The owner gets the sharing dialog; everybody else who can read the paper
 * (view-only members, guests with the link) only gets "copy link".
 */
export const ShareManuscriptButton: React.FC<{ manuscriptId?: string | null }> = ({ manuscriptId }) =>
  isServerPaperId(manuscriptId) ? <ShareControls manuscriptId={manuscriptId} /> : null;

const ShareControls: React.FC<{ manuscriptId: string }> = ({ manuscriptId }) => {
  const [open, setOpen] = useState(false);
  const { access, title } = usePaperAccess(manuscriptId);
  const { copy, copied } = useCopyManuscriptLink(manuscriptId);

  return (
    <PaperGate
      access={access}
      allow="view"
    >
      <PaperGate
        access={access}
        allow="share"
        fallback={
          <button
            type="button"
            data-testid="titlebar-copy-link"
            data-no-drag="true"
            onClick={copy}
            title="Sao chép liên kết bài báo"
            aria-label="Sao chép liên kết bài báo"
            className={PILL}
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
            <span>{copied ? 'Đã sao chép' : 'Sao chép liên kết'}</span>
          </button>
        }
      >
        <button
          type="button"
          data-testid="titlebar-share"
          data-no-drag="true"
          onClick={() => setOpen(true)}
          title="Chia sẻ bản thảo"
          aria-label="Chia sẻ bản thảo"
          className={PILL}
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Chia sẻ</span>
        </button>
        <ShareManuscriptModal isOpen={open} onClose={() => setOpen(false)} manuscriptId={manuscriptId} manuscriptTitle={title} />
      </PaperGate>
    </PaperGate>
  );
};
