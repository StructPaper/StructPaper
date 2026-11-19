'use client';

import React, { useState } from 'react';
import { Bookmark, Loader2 } from 'lucide-react';
import { toast } from '@/components/toast';
import { useEditorSession } from '@/context/EditorSessionContext';
import { isServerPaperId, usePaperAccess } from '@/features/papers/access';
import { PaperGate } from '@/features/papers/components/PaperGate';
import { VersionNameModal } from '@/features/history/components/VersionNameModal';
import { useRevisionActions } from '@/features/history/hooks/useRevisions';

const ICON_PILL =
  'inline-flex items-center justify-center w-7 h-6 rounded-full bg-zinc-100 hover:bg-[#78C841] hover:text-zinc-950 text-zinc-600 transition-all duration-200 cursor-pointer select-none active:scale-95 disabled:opacity-60 disabled:pointer-events-none';

/**
 * Title bar of a paper, between sharing and the profile info: keeps the paper as it is now under a name (a version that is not
 * deleted automatically), without leaving the editor. What was just typed is saved first so the version holds it. Icon only.
 */
export const SaveVersionButton: React.FC = () => {
  const { documentSession } = useEditorSession();
  const paperId = documentSession?.paperId;
  return isServerPaperId(paperId) ? <SaveVersionControl paperId={paperId} /> : null;
};

const SaveVersionControl: React.FC<{ paperId: string }> = ({ paperId }) => {
  const { documentSession } = useEditorSession();
  const { access } = usePaperAccess(paperId);
  const actions = useRevisionActions(paperId);
  const [open, setOpen] = useState(false);
  const [working, setWorking] = useState(false);

  const submit = async (v: { name: string; description: string }) => {
    setWorking(true);
    try {
      // the version must hold what is on screen, not only what was last autosaved
      await documentSession?.onManualSave?.();
      await actions.save.mutateAsync(v);
      setOpen(false);
      toast.success('Đã lưu phiên bản', `"${v.name}" được giữ lại và không bị xóa tự động.`);
    } catch (err) {
      toast.error('Không lưu được phiên bản', (err as Error).message);
    } finally {
      setWorking(false);
    }
  };

  return (
    <PaperGate access={access} allow="edit">
      <button
        type="button"
        data-testid="titlebar-save-version"
        data-no-drag="true"
        onClick={() => setOpen(true)}
        disabled={working}
        title="Lưu phiên bản (giữ bài đúng như lúc này)"
        aria-label="Lưu phiên bản"
        className={ICON_PILL}
      >
        {working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bookmark className="w-3.5 h-3.5" />}
      </button>
      <VersionNameModal isOpen={open} onClose={() => setOpen(false)} mode="save" isSaving={working} onSubmit={submit} />
    </PaperGate>
  );
};
